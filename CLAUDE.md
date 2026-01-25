# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

js_unshroud is a headless JavaScript monitoring and forensic analysis tool designed for malware analysis in isolated VM environments. It uses Playwright + Chrome DevTools Protocol (CDP) to instrument web pages, capturing comprehensive traces of JavaScript behavior including network requests, storage operations, console logs, DOM mutations, fingerprinting attempts, Service Worker activity, dynamic code execution (eval/Function), and encoding/decoding operations (atob/btoa/fromCharCode).

The tool targets malicious JavaScript in web pages and requires headless browser detection evasion to avoid triggering anti-analysis checks. All development and testing occurs in isolated malware analysis VMs.

## Core Architecture

### Three-Layer Design

1. **Orchestration Layer** (`src/orchestrator/`, `src/cli/`)
   - `runner.ts`: CLI entry point, browser lifecycle management, session orchestration
   - `CDPSessionManager.ts`: Chrome DevTools Protocol session management, low-level event capture via CDP
   - `EventLogger.ts`: JSONL event persistence, buffered writes, session management

2. **Instrumentation Layer** (`src/instrumentation/*.js`)
   - Pure JavaScript files injected into page context via `page.addInitScript()` BEFORE any page JavaScript executes
   - Each hook module wraps native APIs (fetch, localStorage, canvas, etc.) using Proxies and `Object.defineProperty`
   - All hooks log to `window.__js_unshroud_log()` function installed by `bootstrap.js`
   - **Logging Bridge**: `window.__js_unshroud_log()` bridges to Node.js via `page.exposeFunction('__playwright_log_event', ...)` (fixed in P0.1)
   - Instrumentation files execute in browser context, NOT Node.js (excluded from coverage metrics)
   - Key files:
     - `bootstrap.js`: Core logging infrastructure, creates `window.__js_unshroud_log()`
     - `network-hooks.js`: fetch/XMLHttpRequest/WebSocket interception
     - `storage-hooks.js`: localStorage/sessionStorage tracking
     - `fingerprinting-hooks.js`: Canvas/WebGL fingerprinting detection
     - `headless-mitigation.js`: Browser evasion (navigator properties, permissions, plugins, canvas entropy). Note: navigator.webdriver is NOT overridden - Chrome flag prevents creation.
     - `service-worker-hooks.js`: Service Worker registration/lifecycle/messaging
     - `code-execution-hooks.js`: eval/Function/dynamic code execution (P0.2)
     - `encoding-hooks.js`: atob/btoa/fromCharCode/URI encoding (P0.3)
     - `performance-monitor.js`: Event deduplication and payload size limiting

3. **Schema & Analysis** (`src/schema/`, `src/analysis/`)
   - `types.ts`: TypeScript event type definitions (NetworkEvent, StorageEvent, etc.)
   - `events.ts`: Event creation utilities with correlation IDs
   - `QueryEngine.ts`, `CorrelationEngine.ts`, `TimelineFormatter.ts`: Post-capture analysis tools

### Critical Execution Flow

1. `runner.ts` launches Chromium via Playwright with headless mitigation flags if configured
2. Creates browser context with spoofed user-agent and headers (when `enableHeadlessMitigation: true`)
3. **BEFORE navigation**, initializes CDP session and calls `CDPSessionManager.setUserAgentOverride()` to spoof HTTP headers at protocol level
4. **CRITICAL**: Sets up logging bridge via `page.exposeFunction('__playwright_log_event', ...)` to bridge browser → Node.js
5. Injects all instrumentation scripts via `page.addInitScript()` (must happen before navigation)
   - Injects bridge connector script to override `window.__js_unshroud_log`
   - Injects bootstrap, performance-monitor, and feature-specific hooks
6. Navigates to target URL - instrumentation is already in place to capture everything from first script execution
7. Monitors for configured duration (default 15 seconds, configurable via `monitoringTimeoutSeconds` in config)
8. Flushes pending events and performs cleanup

## Development Commands

### Build
```bash
bun run build                  # Build for current platform (creates dist/js_unshroud)
bun run build:linux            # Linux x64
bun run build:macos            # macOS x64
bun run build:macos-arm        # macOS ARM64
bun run build:windows          # Windows x64
bun run build:all              # All platforms
```

### Testing
```bash
bun test                       # Run all tests
bun test --coverage            # Run tests with coverage report
bun test tests/cli.test.ts     # Run specific test file
bun test:watch                 # Watch mode (vitest)
```

**Coverage Note**: Files in `src/instrumentation/*.js` are excluded from coverage metrics because they execute in the browser context (via Playwright), not Node.js. The V8 coverage provider only tracks Node.js execution. These files are tested via Playwright integration tests in `tests/instrumentation.test.ts`.

### Code Quality
```bash
bun run typecheck              # TypeScript type checking (tsc --noEmit)
bun run lint                   # ESLint check
bun run lint:fix               # ESLint auto-fix
bun run check                  # Both typecheck + lint
```

### Running
```bash
# Development (TypeScript source)
bun run dev --url https://example.com --out events.jsonl --config config.json

# Production (compiled binary)
./dist/js_unshroud --url https://example.com --out events.jsonl --config config.json
```

## CLI Commands

js_unshroud has four main subcommands: **run** (capture), **analyze** (format), **query** (filter), and **correlate** (pattern detection).

### run (Default Command)

Captures JavaScript behavior and outputs JSONL events file.

```bash
js_unshroud [run] --url <url> --out <output.jsonl> [--config <config.json>]
```

**Implementation:** `src/cli/runner.ts:parseArgs()`, `src/cli/runner.ts:runMonitoring()`

### analyze

Post-capture analysis that formats events as timeline or statistics.

```bash
js_unshroud analyze --input <events.jsonl> [--format text|json|stats] [--output <file>]
```

**Implementation:** `src/cli/analyze.ts`
- Always loads ALL events from JSONL file
- Formats using TimelineFormatter
- No filtering capability (use query for filtering)

### query (New in P5)

Targeted filtering of events using QueryEngine, enabling malware analysts to quickly find specific patterns.

```bash
js_unshroud query --input <events.jsonl> [FILTERS] [--format jsonl|count] [--output <file>]
```

**Implementation:** `src/cli/query.ts`

**Key Functions:**
- `parseQueryArgs()`: Parse CLI arguments (slice(3) - skip 'node', 'runner.ts', 'query')
- `validateArgs()`: Validate file existence, format, and regex patterns
- `buildQueryFilter()`: Convert QueryArgs to QueryFilter object
  - Handles comma-separated types (e.g., `network,console`)
  - Converts urlRegex string to RegExp
- `queryEvents()`: Execute query using QueryEngine
  - Uses `queryEventsStream()` for memory-efficient streaming (jsonl format)
  - Uses `countEvents()` for fast counting (count format)
- `runQuery()`: Main entry point

**Filter Options:**
- `--type <types>`: Comma-separated event types
- `--method <method>`: HTTP method (network events only)
- `--url <url>`: Exact URL match (network events only)
- `--url-regex <pattern>`: Regex URL match (network events only)
- `--status <code>`: HTTP status code (network events only)
- `--level <level>`: Console level (console events only)
- `--storage-type <type>`: localStorage or sessionStorage (storage events only)
- `--operation <op>`: set, get, remove, clear (storage events only)
- `--correlation-id <id>`: Match correlation ID

**Output Formats:**
- `jsonl` (default): One JSON per line, streamable, pipeline-friendly
- `count`: Print count only (fast reconnaissance)

**Architecture Notes:**
- Streams events via QueryEngine.queryEventsStream() for memory efficiency
- Can handle large files (10k-100k+ events) without memory issues
- Outputs valid JSONL for piping to other tools or analyze command
- No buffering required for jsonl format (streams as events match)

**Common Pitfalls:**
- Regex escaping in shell: Always quote regex patterns (e.g., `--url-regex "api\.example\.com"`)
- Type-specific filters: Network filters (method, url, status) only apply to network events
  - Solution: Always combine with `--type network` when using network filters
- Empty output: If no events match, outputs empty string (not error)

**Testing:** `tests/query.test.ts` - 92.63% coverage
- Argument parsing tests
- Filter building tests
- QueryEngine integration tests
- Large file streaming tests

### correlate

Post-capture correlation analysis using custom rules.

```bash
js_unshroud correlate --input <events.jsonl> [--rules-file <file>] [--rules <name1,name2,...>] [--format text|json] [--output <file>]
```

**Implementation:** `src/cli/correlate.ts`
- Loads correlation rules from JSON file (default: `correlation_rules.json`)
- Uses CorrelationEngine to find event patterns
- Outputs text (human-readable) or json (machine-readable) format
- No filtering capability (use query for pre-filtering events)

**Key Functions:**
- `parseCorrelateArgs()`: Parse CLI arguments (slice(3) - skip 'node', 'runner.ts', 'correlate')
- `validateArgs()`: Validate file existence, format, and rules schema
- `loadCustomRules()`: Load and validate rules from JSON file
  - Validates rule schema (name, description, patterns)
  - Validates pattern type (sequence/group), events array, maxTimeGap, correlationField
- `correlateEvents()`: Execute correlation using CorrelationEngine
  - Parses comma-delimited rules filter (like query.ts does for --type)
  - Runs each specified rule and combines results
  - Sorts combined results by start time
- `runCorrelate()`: Main entry point

**Rules File Format:**
- JSON file with `"rules"` array
- Each rule defines pattern type (sequence/group), event types, time gap, correlation field
- Default rules file location: `./correlation_rules.json` or `<project-root>/correlation_rules.json`
- Default rules: storage-to-network, network-request-response, error-chains, timer-to-network

**Output Formats:**
- `text` (default): Human-readable chain summaries with timestamps and event summaries
- `json`: Structured JSON with full chain details (totalChains, chains array)

**Architecture Notes:**
- Streams events via QueryEngine.queryEventsStream() for memory efficiency
- Supports multiple rule filtering via comma-delimited --rules flag
- Rules validation happens at CLI layer before engine construction
- No built-in rules in code - all rules loaded from correlation_rules.json

**Testing:** `tests/correlate.test.ts` - Target 90%+ coverage
- Argument parsing tests (all flags, error cases)
- Rules file validation tests (JSON parsing, schema validation, error handling)
- CorrelationEngine integration tests (single/multiple rules, filtering)
- Output formatting tests (text and json, zero/single/multiple chains)

## Configuration System

Configuration is loaded via `loadInstrumentationConfig()` in `runner.ts`. User can provide JSON file via `--config` flag. All options have defaults.

Key configuration options:
- `enableHeadlessMitigation`: Enables spoofing of HTTP headers, user-agent, navigator properties, and canvas fingerprinting entropy (critical for malware analysis)
- `headlessMitigation`: **NEW** - Configuration object for customizing all spoofed values (user agent, screen dimensions, timezone, hardware specs, etc.). Supports 4 built-in profiles (windows-chrome, macos-safari, linux-firefox, android-chrome) with full override capability. See "Headless Detection Mitigation" section below for details.
- `enableServiceWorker`: Service Worker instrumentation hooks
- `enableFingerprinting`: Canvas/WebGL fingerprinting detection
- `enableObjectTracking`: Proxy-based object monitoring
- `enableCodeExecution`: Capture eval(), Function(), dynamic code execution (default: `true`)
- `enableEncoding`: Capture atob/btoa, fromCharCode, URI encoding/decoding (default: `true`)
- `enableDebuggerDetection`: Detect `debugger;` statements via CDP (default: `true`). **Fire-and-forget optimization**: Captures only the first debugger location (~1-5ms latency), then immediately disables the Debugger domain so subsequent debugger statements run at native speed (~0ms). This minimizes detection risk from malware timing checks (typical threshold: 5-10ms). For maximum stealth, disable after confirming debugger usage in initial analysis run.
- `monitoringTimeoutSeconds`: How long to monitor the page in seconds (default: `15`)
- `outputMode`: Output destination - `'file'`, `'udp'`, or `'both'` (default: `'file'`)
- `udpLogging`: UDP logging configuration (host, port, enabled)
- `dedupeWindowMs`: Deduplication window in milliseconds (default: `100`)
- `maxPayloadSize`: Payload size limit in bytes (default: `2051`)
- `maxStackDepth`: Stack trace depth limit (default: `20`)
- `enableDeduplication`: Enable/disable deduplication (default: `true`)
- `eventFiltering` (P4.1): Event filtering configuration to reduce noise during malware triage
  - `eventFiltering.dom.enableLoadEvents`: Log load events (default: `false`)
  - `eventFiltering.dom.enableMouseEvents`: Log mouse events (default: `false`)
  - `eventFiltering.dom.enablePageLifecycle`: Log page lifecycle events (default: `false`)
  - `eventFiltering.dom.enableInteractionEvents`: Log interaction event firings (default: `false`, addEventListener always logged)
  - `eventFiltering.dom.enableMutationEvents`: Log DOM mutations (default: `false`)
  - `eventFiltering.encoding.enableAtobBtoa`: Log Base64 encoding/decoding (default: `false`)
  - `eventFiltering.encoding.enableFromCharCode`: Log fromCharCode (default: `true`)
  - `eventFiltering.encoding.enableURIEncoding`: Log URI encoding/decoding (default: `false`)

See README.md "Configuration" section for full list.

## Headless Detection Mitigation (CRITICAL)

**Problem**: Malicious JavaScript often detects headless browsers (via `navigator.webdriver`, missing plugins, consistent canvas fingerprints, etc.) and alters behavior or refuses to execute.

**Solution**: When `enableHeadlessMitigation: true` in config:

### Configurable Headless Mitigation (NEW)

All spoofed values are fully configurable via the `headlessMitigation` config object. This allows analysts to customize browser fingerprints for different scenarios.

**Architecture:**
- **Profile System** (src/cli/headless-profiles.ts): 4 built-in profiles with realistic fingerprints
  - `windows-chrome` (default): Windows 10 + Chrome 143
  - `macos-safari`: macOS 14.2 + Safari 17.2
  - `linux-firefox`: Linux + Firefox 122
  - `android-chrome`: Android 14 + Chrome 143 (mobile)
- **Resolution Logic**: `resolveHeadlessMitigationConfig()` merges user config with profile defaults (User Config → Profile → Default Profile)
- **Deep Merge**: Supports partial overrides of nested objects (e.g., override just `hardware.deviceMemory` while keeping other values from profile)
- **Validation** (src/cli/validation.ts): Validates ranges, consistency, and warns about suspicious combinations

**Configurable Values:**
- Top-level: `userAgent`, `platform`, `vendor`, `language`, `languages`, `profile`
- `cdp`: CDP metadata (platform, platformVersion, architecture, bitness, mobile, brands)
- `hardware`: CPU cores, RAM, touch points
- `screen`: Width, height, availWidth, availHeight, colorDepth, pixelDepth
- `window`: innerWidth, innerHeight, outerWidth, outerHeight, devicePixelRatio
- `timezone`: Offset (minutes from UTC), name (IANA timezone)
- `webgl`: Vendor, renderer strings
- `audio`: Sample rate
- `entropy`: Canvas noise level (0.0-1.0), audio noise amplitude (0.0-1.0)

**Config Loading Flow** (runner.ts):
1. Load user config from JSON or programmatic object
2. If `enableHeadlessMitigation` is true, call `resolveHeadlessMitigationConfig(config.headlessMitigation)`
3. Validate resolved config via `validateHeadlessMitigationConfig()` - log warnings, throw on errors
4. Pass resolved config to spoofing functions and CDP setup
5. Serialize config to `window.__js_unshroud_headless_config` before injecting headless-mitigation.js
6. Browser-side code reads from `window.__js_unshroud_headless_config` with fallbacks to defaults

**Example Configuration:**
```json
{
  "enableHeadlessMitigation": true,
  "headlessMitigation": {
    "profile": "macos-safari",
    "timezone": {
      "offset": -480,
      "name": "America/Los_Angeles"
    }
  }
}
```

**Backward Compatibility:** If `headlessMitigation` is not specified, uses `windows-chrome` profile (current hardcoded values). No breaking changes.

### Implementation Details

1. **HTTP Header Spoofing** (src/cli/runner.ts):
   - Generate spoofed user-agent via `generateSpoofedUserAgent(headlessConfig)` - now accepts config parameter
   - Generate spoofed headers via `generateSpoofedHeaders(headlessConfig)` - builds from config values
   - Call `CDPSessionManager.setUserAgentOverride(userAgent, platform, brands, headlessConfig)` BEFORE navigation
   - Uses `Emulation.setUserAgentOverride()` CDP call with userAgentMetadata from config
   - Set `extraHTTPHeaders` via `page.setExtraHTTPHeaders()`
   - Launch Chromium with `--disable-blink-features=AutomationControlled` flag

2. **JavaScript-Level Spoofing** (src/instrumentation/headless-mitigation.js):

   **Config Reading Pattern:**
   ```javascript
   const config = window.__js_unshroud_headless_config || {};
   const value = config.path?.to?.value || DEFAULT_FALLBACK;
   ```

   **Navigator Properties (all configurable):**
   - `navigator.webdriver` - **INTENTIONALLY NOT OVERRIDDEN**. The `--disable-blink-features=AutomationControlled` flag (set in runner.ts) prevents Chromium from creating this property. By NOT creating an override in headless-mitigation.js, the property remains undefined, defeating both direct checks (`navigator.webdriver`) AND existence checks (`_.has(navigator, "webdriver")`, `'webdriver' in navigator`). Trade-off: We lose logging capability when malware checks this property, but gain complete evasion of property existence detection.
   - Override `navigator.hardwareConcurrency` to configurable value (default: 8 cores)
   - Override `navigator.deviceMemory` to configurable value (default: 8GB)
   - Override `navigator.plugins` with fake Chrome PDF plugins
   - Override `navigator.languages` to configurable array (default: `['en-US', 'en']`)
   - Override `navigator.language` to configurable string (default: `'en-US'`)
   - Override `navigator.platform` to configurable string (default: `'Win32'`)
   - Override `navigator.vendor` to configurable string (default: `'Google Inc.'`)
   - Override `navigator.maxTouchPoints` to configurable value (default: `0` for desktop)
   - Override `navigator.pdfViewerEnabled` to return `true`
   - Override `navigator.cookieEnabled` to return `true`
   - Override `navigator.userAgent` with configurable UA string (default: Chrome 143)
   - Override `navigator.mimeTypes` with fake MIME types matching plugins

   **Browser Object Model (BOM):**
   - Inject `window.chrome` object with runtime, loadTimes(), csi(), app properties
   - Override `Notification.permission` to return `'default'`

   **Fingerprinting Mitigation (all configurable):**
   - Override `navigator.permissions.query()` to always return 'granted'
   - Inject configurable entropy into `canvas.toDataURL()` and `canvas.getImageData()` (default: 1% noise)
   - Override WebGL `getParameter()` for configurable vendor/renderer spoofing (default: Google Inc. (Intel) / ANGLE Intel UHD)
   - Spoof AudioContext sampleRate to configurable value (default: 44.1kHz)
   - Inject configurable noise into OfflineAudioContext rendering (default: ±0.00005)
   - Spoof document.fonts API with fake Windows fonts
   - Block RTCPeerConnection and getUserMedia (WebRTC)
   - Spoof screen dimensions to configurable values (default: 1920x1080)
   - Spoof window dimensions to configurable values (default: 1280x720)
   - Spoof devicePixelRatio to configurable value (default: 1.0)
   - Override timezone to configurable offset and name (default: US Eastern -300 / America/New_York)
   - Block Battery API
   - Monitor `matchMedia()` calls for headless-specific queries

## Testing Strategy

- **Unit Tests**: TypeScript code in `src/orchestrator/`, `src/cli/`, `src/schema/`, `src/utils/`, `src/analysis/`
- **Integration Tests**: `tests/instrumentation.test.ts` launches Playwright, navigates to fixtures, verifies injected hooks work
- **Test Fixtures**: `tests/fixtures/` contains HTML files for testing specific instrumentation scenarios
- **Target Coverage**: 80%+ (excluding `src/instrumentation/*.js` which run in browser context)

## Key Implementation Patterns

### Event Correlation
All events have correlation IDs to link related events:
- Network requests: `correlationId` links request/response/failure events (see CDPSessionManager.ts:43-115)
- Session ID: All events tagged with session ID for grouping

### Instrumentation Timing
Critical: Instrumentation MUST be injected BEFORE page navigation. Order matters:
1. Create CDP session
2. Enable CDP domains (Network, Runtime, Console, Page)
3. Set user-agent override (if headless mitigation enabled)
4. **Set up logging bridge** via `page.exposeFunction('__playwright_log_event', ...)`
5. Inject bridge connector script via `page.addInitScript()` to override `window.__js_unshroud_log`
6. Inject instrumentation via `page.addInitScript()` (bootstrap, performance-monitor, hooks)
7. Navigate to URL

**Critical Bug Fixed (P0.1)**: Prior to P0.1, there was NO bridge from browser context to Node.js. All instrumentation hooks called `window.__js_unshroud_log()` which was a silent no-op. Only CDP-captured events (network, console, errors) worked. The bridge was fixed by adding `page.exposeFunction()` and bridge connector script in `runner.ts`.

### Error Handling
- Instrumentation hooks use try-catch to avoid breaking target page
- Each hook logs errors via `console.warn('[JS Unshroud] ...')`
- Cleanup operations have timeouts to prevent hangs (see `performCleanup()` in runner.ts)

## Output Format

Events are written to JSONL (JSON Lines) format. Each event has:
- `id`: Unique event ID (evt_timestamp_random)
- `sessionId`: Session identifier
- `timestamp`: Unix timestamp (milliseconds)
- `type`: Event type (network, storage, console, error, websocket, timer, dom, fingerprinting, headless_mitigation, service_worker, code_execution, encoding, performance_stats, performance_warning)
- Type-specific fields (see `src/schema/types.ts`)

**UDP Logging (P0.1b)**: Events can optionally be sent via UDP to remote collectors for real-time analysis or SIEM integration. Configure via `outputMode: 'udp'` or `'both'` and `udpLogging` settings.

## Analyst Workflows

### Two-Pass Anti-Analysis Detection Workflow

When analyzing malware that may use `debugger;` statements as anti-analysis techniques:

**Pass 1: Initial Analysis (Detect Anti-Analysis)**
```bash
# Run with default config (debugger detection enabled)
js_unshroud --url https://malicious-site.com --out initial.jsonl

# Check for debugger events
js_unshroud query --input initial.jsonl --type debugger
```

If debugger events are found, the malware is using anti-analysis checks. The fire-and-forget optimization already minimizes detection risk (~1-5ms latency on first debugger only), but sophisticated malware with very aggressive timing thresholds (<3ms) may still detect it.

**Pass 2: Full Behavior Capture (Maximum Stealth)**
```bash
# Disable debugger detection entirely
echo '{"enableDebuggerDetection": false}' > stealth-config.json
js_unshroud --url https://malicious-site.com --out full-behavior.jsonl --config stealth-config.json
```

**Rationale:**
- Pass 1 captures the debugger location (valuable intelligence about anti-analysis techniques)
- Pass 2 runs with zero detection risk - debugger statements execute at native speed (~0ms)
- Information about anti-analysis is already gathered from Pass 1, so disabling detection in Pass 2 is safe

**Performance Characteristics:**
- With detection enabled (default): First debugger ~1-5ms, subsequent ~0ms (fire-and-forget optimization)
- With detection disabled: All debuggers ~0ms (native speed)
- Malware timing thresholds: Conservative 20ms, Moderate 10ms, Aggressive 5ms, Very Aggressive 3ms

## Common Pitfalls

1. **Modifying instrumentation files**: Remember these are plain JavaScript (not TypeScript), executed in browser context. No imports, no Node.js APIs. Use IIFE pattern.
2. **CDP timing**: Many CDP operations must occur BEFORE navigation. Check `runner.ts` flow carefully.
3. **Logging bridge**: Instrumentation hooks depend on `page.exposeFunction()` being called BEFORE scripts are injected. Without this bridge, events are silently lost.
4. **Testing instrumentation**: Can't use normal unit tests. Must use Playwright integration tests.
5. **Event correlation**: Use `correlationId` to link related events (e.g., request → response)
6. **Performance**: High event volume can cause memory pressure. Use deduplication via performance-monitor.js. Rate limiting was removed in P0.5.

## Debugging

- Instrumentation hooks log to browser console with `[JS Unshroud]` prefix
- CDP events are logged by CDPSessionManager (can add debug logs)
- Use `bun run dev` for TypeScript source debugging (faster iteration)
- Test single instrumentation module by disabling others in config
- Check JSONL output file for event capture: `cat events.jsonl | jq .`

## Implementation Status

### Completed Features

**P0-P2a (Code Execution & Obfuscation Detection):**
- ✅ eval/Function/dynamic code execution hooks
- ✅ Script injection detection (innerHTML, createElement, setAttribute)
- ✅ Event handler instrumentation (addEventListener, onclick, etc.)
- ✅ Blob URL tracking and content resolution
- ✅ javascript: URL execution detection
- ✅ Encoding/decoding hooks (atob, btoa, fromCharCode, URI)

**P1.5 (CryptoJS Deobfuscation):**
- ✅ CryptoJS encryption/decryption monitoring (AES, DES, TripleDES, RC4, Rabbit)
- ✅ Encoding converter hooks (Base64, Utf8, Hex)
- ✅ Decryption key capture

**P2b (Advanced Code Execution Patterns):**
- ✅ Web Worker and SharedWorker instrumentation
- ✅ ES Module script injection detection
- ✅ iframe creation and srcdoc monitoring

**P2 (Fingerprinting Countermeasures):**
- ✅ Audio fingerprinting mitigation
- ✅ Font fingerprinting mitigation
- ✅ WebRTC blocking
- ✅ Screen/viewport spoofing
- ✅ Timezone spoofing
- ✅ Battery API blocking

**P3.1 (Browser Object Model Spoofing):**
- ✅ window.chrome object injection
- ✅ navigator.languages override
- ✅ navigator.mimeTypes spoofing
- ✅ Notification.permission override
- ✅ Additional navigator properties (vendor, platform, userAgent, etc.)

**P3.2 (Behavioral Interaction Simulation - CRITICAL):**
- ✅ Mouse movement simulation with Bezier-like trajectories
- ✅ Scroll simulation
- ✅ Click simulation on interactive elements (buttons, links)
- ✅ Keyboard input simulation (Tab, arrows, Enter)
- ✅ Form field interaction (focus, type, blur events)
- ✅ Smart field value generation based on context
- ✅ Form submission simulation
- ✅ Autofill trigger simulation
- ✅ Checkout page detection and simulation
- ✅ Honeypot field avoidance
- ✅ Time-delayed phased interaction (0-30s, 30-60s, 60s+)
- ✅ Configurable intensity levels (low, medium, high)
- **Impact**: Defeats interaction-gated malware including ClickFix attacks (47% of 2025 attacks), form submission-based harvesters, Magecart web skimmers, time-delayed malware (60s+), and autofill exploits

**P4.1 (Event Filtering - Noise Reduction):**
- ✅ DOM event filtering by category (load, mouse, lifecycle, interaction, mutations)
- ✅ Smart filtering: Always log addEventListener (malware signal), filter eventFired (noise)
- ✅ Never log removeEventListener (cleanup noise)
- ✅ Encoding event filtering (atobBtoa, fromCharCode, URI encoding)
- ✅ Fixed missing eventType field in DOM mutation events (appendChild, innerHTML, etc.)
- ✅ Configurable filtering via eventFiltering config object
- **Impact**: Reduces benign site noise by ~60-70% (google.com: 440→~50 DOM events, 264→0 atob/btoa events) while preserving 100% malware-relevant signals

### Pending Features

None - All planned features have been implemented.

**Current Headless Evasion Coverage**: ~98-100%
