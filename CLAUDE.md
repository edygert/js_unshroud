# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

js_unshroud is a headless JavaScript monitoring and forensic analysis tool designed for malware analysis in isolated VM environments. It uses Playwright + Chrome DevTools Protocol (CDP) to instrument web pages, capturing comprehensive traces of JavaScript behavior including network requests, storage operations, console logs, DOM mutations, fingerprinting attempts, and Service Worker activity.

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
   - Instrumentation files execute in browser context, NOT Node.js (excluded from coverage metrics)
   - Key files:
     - `bootstrap.js`: Core logging infrastructure, creates `window.__js_unshroud_log()`
     - `network-hooks.js`: fetch/XMLHttpRequest/WebSocket interception
     - `storage-hooks.js`: localStorage/sessionStorage tracking
     - `fingerprinting-hooks.js`: Canvas/WebGL fingerprinting detection
     - `headless-mitigation.js`: Browser evasion (navigator.webdriver, permissions, plugins, canvas entropy)
     - `service-worker-hooks.js`: Service Worker registration/lifecycle/messaging
     - `performance-monitor.js`: Event sampling, rate limiting, deduplication

3. **Schema & Analysis** (`src/schema/`, `src/analysis/`)
   - `types.ts`: TypeScript event type definitions (NetworkEvent, StorageEvent, etc.)
   - `events.ts`: Event creation utilities with correlation IDs
   - `QueryEngine.ts`, `CorrelationEngine.ts`, `TimelineFormatter.ts`: Post-capture analysis tools

### Critical Execution Flow

1. `runner.ts` launches Chromium via Playwright with headless mitigation flags if configured
2. Creates browser context with spoofed user-agent and headers (when `enableHeadlessMitigation: true`)
3. **BEFORE navigation**, initializes CDP session and calls `CDPSessionManager.setUserAgentOverride()` to spoof HTTP headers at protocol level
4. Injects all instrumentation scripts via `page.addInitScript()` (must happen before navigation)
5. Navigates to target URL - instrumentation is already in place to capture everything from first script execution
6. Monitors for 15 seconds (configurable via `TIMEOUTS.MONITORING_DURATION`)
7. Flushes pending events and performs cleanup

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
- `sampleRate`: Event sampling (0.0-1.0)
- `maxEventsPerSecond`: Rate limiting threshold
- `dedupeWindowMs`: Deduplication window
- `maxPayloadSize`: Payload size limit (bytes)
- `maxStackDepth`: Stack trace depth limit

See README.md "Configuration" section for full list.

## Headless Detection Mitigation (CRITICAL)

**Problem**: Malicious JavaScript often detects headless browsers (via `navigator.webdriver`, missing plugins, consistent canvas fingerprints, etc.) and alters behavior or refuses to execute.

**Solution**: When `enableHeadlessMitigation: true` in config:

1. **HTTP Header Spoofing** (src/cli/runner.ts:277-343):
   - Generate spoofed user-agent via `generateSpoofedUserAgent()`
   - Generate spoofed headers via `generateSpoofedHeaders()` (sec-ch-ua, Accept, etc.)
   - Call `CDPSessionManager.setUserAgentOverride()` BEFORE navigation (src/orchestrator/CDPSessionManager.ts:197-220)
   - Set `extraHTTPHeaders` via `page.setExtraHTTPHeaders()`
   - Launch Chromium with `--disable-blink-features=AutomationControlled` flag

2. **JavaScript-Level Spoofing** (src/instrumentation/headless-mitigation.js):
   - Override `navigator.webdriver` to return `false`
   - Override `navigator.hardwareConcurrency` to realistic value (8 cores)
   - Override `navigator.deviceMemory` to realistic value (8GB)
   - Override `navigator.plugins` with fake Chrome PDF plugins
   - Override `navigator.permissions.query()` to always return 'granted'
   - Inject entropy into `canvas.toDataURL()` and `canvas.getImageData()` (break exact fingerprinting hashes)
   - Override WebGL `getParameter()` for vendor/renderer spoofing
   - Monitor `matchMedia()` calls for headless-specific queries

**Known Bug**: HTTP header spoofing currently does not work. The CDP `Network.setUserAgentOverride()` call in `CDPSessionManager.setUserAgentOverride()` is invoked but does not affect actual HTTP requests sent by the browser. This may be due to timing (must be called before Network domain is enabled?) or incorrect CDP usage. The user reports that malicious JavaScript can still detect the headless browser via HTTP headers despite `enableHeadlessMitigation: true`.

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
4. Inject instrumentation via `page.addInitScript()`
5. Navigate to URL

### Error Handling
- Instrumentation hooks use try-catch to avoid breaking target page
- Each hook logs errors via `console.warn('[JS Unshroud] ...')`
- Cleanup operations have timeouts to prevent hangs (see `performCleanup()` in runner.ts)

## Output Format

Events are written to JSONL (JSON Lines) format. Each event has:
- `id`: Unique event ID (evt_timestamp_random)
- `sessionId`: Session identifier
- `timestamp`: Unix timestamp (milliseconds)
- `type`: Event type (network, storage, console, error, websocket, timer, dom, fingerprinting, headless_mitigation, service_worker, performance_stats, performance_warning)
- Type-specific fields (see `src/schema/types.ts`)

## Common Pitfalls

1. **Modifying instrumentation files**: Remember these are plain JavaScript (not TypeScript), executed in browser context. No imports, no Node.js APIs. Use IIFE pattern.
2. **CDP timing**: Many CDP operations must occur BEFORE navigation. Check `runner.ts` flow carefully.
3. **Testing instrumentation**: Can't use normal unit tests. Must use Playwright integration tests.
4. **Event correlation**: Use `correlationId` to link related events (e.g., request → response)
5. **Performance**: High event volume can cause memory pressure. Use sampling/rate limiting/deduplication via performance-monitor.js.

## Debugging

- Instrumentation hooks log to browser console with `[JS Unshroud]` prefix
- CDP events are logged by CDPSessionManager (can add debug logs)
- Use `bun run dev` for TypeScript source debugging (faster iteration)
- Test single instrumentation module by disabling others in config
- Check JSONL output file for event capture: `cat events.jsonl | jq .`

## Relevant Context for Bug Fixing

The user reports that HTTP header spoofing does not work despite:
1. `enableHeadlessMitigation: true` in config
2. `generateSpoofedUserAgent()` and `generateSpoofedHeaders()` generating correct values
3. `CDPSessionManager.setUserAgentOverride()` being called before navigation
4. `page.setExtraHTTPHeaders()` being called

Investigate CDP timing and Network domain initialization order in `CDPSessionManager.ts` and `runner.ts`.
