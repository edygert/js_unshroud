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
     - `headless-mitigation.js`: Browser evasion (navigator.webdriver, permissions, plugins, canvas entropy)
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

## Configuration System

Configuration is loaded via `loadInstrumentationConfig()` in `runner.ts`. User can provide JSON file via `--config` flag. All options have defaults.

Key configuration options:
- `enableHeadlessMitigation`: Enables spoofing of HTTP headers, user-agent, navigator properties, and canvas fingerprinting entropy (critical for malware analysis)
- `enableServiceWorker`: Service Worker instrumentation hooks
- `enableFingerprinting`: Canvas/WebGL fingerprinting detection
- `enableObjectTracking`: Proxy-based object monitoring
- `enableCodeExecution`: Capture eval(), Function(), dynamic code execution (default: `true`)
- `enableEncoding`: Capture atob/btoa, fromCharCode, URI encoding/decoding (default: `true`)
- `monitoringTimeoutSeconds`: How long to monitor the page in seconds (default: `15`)
- `outputMode`: Output destination - `'file'`, `'udp'`, or `'both'` (default: `'file'`)
- `udpLogging`: UDP logging configuration (host, port, enabled)
- `dedupeWindowMs`: Deduplication window in milliseconds (default: `100`)
- `maxPayloadSize`: Payload size limit in bytes (default: `2051`)
- `maxStackDepth`: Stack trace depth limit (default: `20`)
- `enableDeduplication`: Enable/disable deduplication (default: `true`)

See README.md "Configuration" section for full list.

## Headless Detection Mitigation (CRITICAL)

**Problem**: Malicious JavaScript often detects headless browsers (via `navigator.webdriver`, missing plugins, consistent canvas fingerprints, etc.) and alters behavior or refuses to execute.

**Solution**: When `enableHeadlessMitigation: true` in config:

1. **HTTP Header Spoofing** (src/cli/runner.ts:277-343):
   - Generate spoofed user-agent via `generateSpoofedUserAgent()`
   - Generate spoofed headers via `generateSpoofedHeaders()` (sec-ch-ua, Accept, etc.)
   - Call `CDPSessionManager.setUserAgentOverride()` BEFORE navigation (src/orchestrator/CDPSessionManager.ts:197-220)
   - Uses `Emulation.setUserAgentOverride()` CDP call with userAgentMetadata support (VERIFIED WORKING)
   - Set `extraHTTPHeaders` via `page.setExtraHTTPHeaders()`
   - Launch Chromium with `--disable-blink-features=AutomationControlled` flag

2. **JavaScript-Level Spoofing** (src/instrumentation/headless-mitigation.js):

   **Navigator Properties:**
   - Override `navigator.webdriver` to return `false`
   - Override `navigator.hardwareConcurrency` to realistic value (8 cores)
   - Override `navigator.deviceMemory` to realistic value (8GB)
   - Override `navigator.plugins` with fake Chrome PDF plugins
   - Override `navigator.languages` to return `['en-US', 'en']`
   - Override `navigator.language` to return `'en-US'`
   - Override `navigator.platform` to return `'Win32'`
   - Override `navigator.vendor` to return `'Google Inc.'`
   - Override `navigator.maxTouchPoints` to return `0` (desktop)
   - Override `navigator.pdfViewerEnabled` to return `true`
   - Override `navigator.cookieEnabled` to return `true`
   - Override `navigator.userAgent` with realistic Chrome UA string
   - Override `navigator.mimeTypes` with fake MIME types matching plugins

   **Browser Object Model (BOM):**
   - Inject `window.chrome` object with runtime, loadTimes(), csi(), app properties
   - Override `Notification.permission` to return `'default'`

   **Fingerprinting Mitigation:**
   - Override `navigator.permissions.query()` to always return 'granted'
   - Inject entropy into `canvas.toDataURL()` and `canvas.getImageData()` (break exact fingerprinting hashes)
   - Override WebGL `getParameter()` for vendor/renderer spoofing
   - Spoof AudioContext sampleRate to 44.1kHz
   - Inject noise into OfflineAudioContext rendering
   - Spoof document.fonts API with fake Windows fonts
   - Block RTCPeerConnection and getUserMedia (WebRTC)
   - Spoof screen dimensions to 1920x1080
   - Override timezone to US Eastern (-300 minutes)
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

### Pending Features

None - All planned features have been implemented.

**Current Headless Evasion Coverage**: ~98-100%
