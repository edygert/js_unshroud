# js_unshroud

A headless JavaScript monitoring and analysis tool that instruments web pages to capture network requests, storage operations, console logs, and other runtime events.

## Prerequisites

- [Bun](https://bun.com) runtime (v1.3.5 or later)
- Node.js (for Playwright's browser dependencies)

## Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd js_unshroud
bun install
```

## Building

Build the application into a standalone executable:

```bash
bun run build
```

This creates a compiled binary at `dist/js_unshroud` that can be run on any compatible system without requiring Bun or Node.js to be installed.

## Development

For development, you can run the TypeScript source directly:

```bash
bun run dev
```

## Running

### Using the built binary (recommended for production)

```bash
./dist/js_unshroud run --url https://example.com --out events.jsonl
```

### Using TypeScript source (development)

```bash
bun run dev --url https://example.com --out events.jsonl
```

### Command-line options

- `--url <url>`: Required. The URL to monitor
- `--out <path>`: Required. Output file path (will be in JSONL format)
- `--config <path>`: Optional. Path to instrumentation configuration JSON file

### Configuration

You can optionally provide a configuration file to control what instrumentation is enabled:

```json
{
  "enableConsole": true,
  "enableNetwork": true,
  "enableStorage": true,
  "enableWebSocket": true,
  "enableTimer": false,
  "enableError": true,
  "enableDOM": false,
  "enableCodeExecution": true,
  "enableEncoding": true,
  "monitoringTimeoutSeconds": 15,
  "outputMode": "file",
  "udpLogging": {
    "enabled": false,
    "host": "127.0.0.1",
    "port": 514
  }
}
```

Configuration options:

**Event Capture:**
- `enableConsole`: Capture console.log, console.warn, console.error, etc. (default: `true`)
- `enableNetwork`: Capture XMLHttpRequest and fetch network requests (default: `true`)
- `enableStorage`: Capture localStorage and sessionStorage operations (default: `true`)
- `enableWebSocket`: Capture WebSocket connections and messages (default: `true`)
- `enableTimer`: Capture setTimeout, setInterval operations (default: `false`)
- `enableError`: Capture JavaScript errors and exceptions (default: `true`)
- `enableDOM`: Capture DOM mutation events (default: `false`)
- `enableFingerprinting`: Capture canvas fingerprinting, WebGL properties, and navigator probes (default: `false`)
- `enableObjectTracking`: Enable proxy-based tracking of specific JavaScript objects (default: `false`)
- `enableHeadlessMitigation`: Enable countermeasures against headless browser detection (default: `false`)
- `enableServiceWorker`: Capture Service Worker registration, lifecycle, and messaging (default: `false`)
- `enableCodeExecution`: Capture eval(), Function(), and dynamic code execution (default: `true`)
- `enableEncoding`: Capture atob/btoa, fromCharCode, URI encoding/decoding (default: `true`)

**Output Configuration:**
- `outputMode`: Output destination - `'file'`, `'udp'`, or `'both'` (default: `'file'`)
- `udpLogging`: UDP logging configuration object
  - `enabled`: Enable UDP logging (default: `false`)
  - `host`: UDP destination IP address (default: `'127.0.0.1'`)
  - `port`: UDP destination port (default: `514`)

**Monitoring Configuration:**
- `monitoringTimeoutSeconds`: How long to monitor the page in seconds (default: `15`). Increase this for slow-loading malware samples that require more time to execute.

**Performance Tuning:**
- `dedupeWindowMs`: Time window for deduplication in milliseconds (default: `100`)
- `maxPayloadSize`: Maximum size of event payloads in bytes (default: `2051`)
- `maxStackDepth`: Maximum stack trace depth for captured events (default: `20`)
- `enableDeduplication`: Enable/disable event deduplication (default: `true`)

Create a config file `my-config.json` and run:

```bash
./dist/js_unshroud run --url https://example.com --out events.jsonl --config my-config.json
```

## Performance Monitoring

js_unshroud includes built-in performance monitoring and optimization features to manage high-volume event capture:

### Deduplication
Automatically deduplicate similar events within a time window (`dedupeWindowMs`). This prevents log spam from repeated operations like tight loops or high-frequency timer callbacks. Events are deduplicated based on a signature combining event type, method, and key properties (URL, payload snippet, etc.).

### Payload Size Control
Code execution and encoding events can generate very large payloads (obfuscated JavaScript can be megabytes). The `maxPayloadSize` setting limits payload sizes by truncating to the first 1024 bytes + "..." + last 1024 bytes, preserving both the beginning and end of the code for analysis.

Stack traces are limited to `maxStackDepth` frames to keep event data manageable while still providing debugging context.

### UDP Logging
For real-time monitoring and SIEM integration, events can be sent via UDP to a remote collector using the `outputMode` and `udpLogging` configuration options. UDP logging is fire-and-forget (no acknowledgment) and suitable for high-volume scenarios where some event loss is acceptable.

Performance metrics are automatically logged every 30 seconds, including total events processed, acceptance rates, and deduplication statistics.

## Headless Browser Mitigation

When `enableHeadlessMitigation` is enabled, js_unshroud applies countermeasures to appear more like a regular browser:

### Navigator Overrides
- `navigator.webdriver` returns `false` instead of `true`
- `navigator.hardwareConcurrency` returns realistic values (8 cores)
- `navigator.deviceMemory` returns realistic values (8GB)
- `navigator.plugins` provides fake plugin entries

### Permission Overrides
Intercepts permission queries to return "granted" instead of denying common permissions that indicate headless operation.

### Canvas Fingerprinting Mitigation
Adds small random entropy to canvas `toDataURL()` and `getImageData()` outputs to break exact fingerprinting hashes.

### WebGL Override
Overrides GPU vendor/renderer information to appear as typical desktop hardware.

### Media Query Monitoring
Monitors for headless-specific CSS media queries and logs detection attempts.

## Testing

Run the test suite:

```bash
bun test
```

Run tests with coverage reporting:

```bash
bun test --coverage
```

### Coverage Notes

The instrumentation scripts in `src/instrumentation/` are **excluded from coverage metrics** despite being thoroughly tested. This is intentional and expected because:

- **Execution Context**: Instrumentation scripts execute in the browser context (Chromium via Playwright), not in the Node.js test environment
- **Coverage Limitation**: The V8 coverage provider only tracks code execution in the Node.js process, and cannot see code running in a separate browser process
- **Testing Approach**: These files are comprehensively tested via Playwright integration tests (`tests/instrumentation.test.ts`), which inject and execute the scripts in a real browser environment
- **Architectural Decision**: This separation between test coverage (Node.js) and actual testing (browser) is a fundamental architectural constraint when testing browser-injected code

The excluded files include:
- `bootstrap.js` - Core logging infrastructure
- `network-hooks.js` - fetch/XHR interception
- `storage-hooks.js` - localStorage/sessionStorage tracking
- `timer-hooks.js` - setTimeout/setInterval monitoring
- `dom-hooks.js` - DOM mutation tracking
- `fingerprinting-hooks.js` - Canvas/WebGL fingerprinting detection
- `object-tracking.js` - Proxy-based object monitoring
- `headless-mitigation.js` - Browser evasion techniques
- `performance-monitor.js` - Event filtering and deduplication
- `service-worker-hooks.js` - Service Worker monitoring
- `code-execution-hooks.js` - eval/Function/dynamic code execution
- `encoding-hooks.js` - atob/btoa/fromCharCode/URI encoding

All other TypeScript/JavaScript code (CLI, orchestration, analysis) runs in Node.js and contributes to coverage metrics normally.

Run specific test files:

```bash
bun test tests/cli.test.ts  # CLI-specific tests
bun test tests/runner.test.ts  # Event logger and schema tests
```

## Code Quality

### Type Checking

Run TypeScript type checking:

```bash
bun run typecheck
```

This runs the TypeScript compiler in no-emit mode to check for type errors without generating output files.

### Linting

Lint the codebase:

```bash
bun run lint
```

Auto-fix linting issues:

```bash
bun run lint:fix
```

### Combined Check

Run both type checking and linting:

```bash
bun run check
```

## Packaging and Distribution

The build process creates a standalone executable that can be distributed:

1. Build the application: `bun run build`
2. The executable `dist/js_unshroud` is ready to distribute
3. Install Playwright browser dependencies:

   Since js_unshroud uses Playwright to control a headless Chrome browser for instrumentation, the executable needs access to browser binaries. Users must install Playwright's Chromium browser (the executable is not packaged with its own browser binaries due to size and licensing considerations).

   **Installation Options:**

   - **Default (recommended)**: Install Chromium only
     ```bash
     npx playwright install chromium
     ```

   - **All browsers**: Install Chromium, Firefox, and WebKit
     ```bash
     npx playwright install
     ```

   - **System browser** (if you have Chromium/Chromium installed):
     ```bash
     PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npx playwright install-deps
     ```
     This installs system dependencies but uses your system-installed browser instead of downloading a specific Playwright version.

   - **CI/CD environments**: For automated deployments, you can pre-install browsers in your container or CI image using the above commands.

   Without the browser, the executable will fail to run with an error indicating the browser is not found.

## Deployment

Since this is a CLI tool that produces a standalone binary, deployment options include:

### Option 1: Direct Distribution
- Build the executable on your target platform
- Distribute the `dist/js_unshroud` binary
- Ensure Playwright browsers are available (`npx playwright install chromium`)

### Option 2: Containerized
Create a `Dockerfile` for containerized deployment:

```dockerfile
FROM node:18-alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY dist/js_unshroud ./
RUN chmod +x js_unshroud
RUN npx playwright install-deps chromium
CMD ["./js_unshroud"]
```

### Option 3: NPM Package
Publish as an NPM package where the `bin` field in package.json points to the executable.

## Output Format

The tool outputs events in JSONL format (one JSON object per line). Each event includes:
- `id`: Unique event identifier
- `timestamp`: Unix timestamp in milliseconds
- `sessionId`: Session identifier for grouping events
- `type`: Event type (network, storage, console, error, websocket, etc.)
- Event-specific data fields

### Event Types and Examples

**Network Events:**
```json
{
  "id": "evt_1234567890_001",
  "timestamp": 1640995200000,
  "sessionId": "session_1640995200_abc123",
  "type": "network",
  "method": "GET",
  "url": "https://api.example.com/data",
  "status": 200,
  "statusText": "OK",
  "duration": 250,
  "requestHeaders": {"Authorization": "Bearer token"},
  "responseHeaders": {"Content-Type": "application/json"}
}
```

**Storage Events:**
```json
{
  "id": "evt_1234567890_002",
  "timestamp": 1640995200100,
  "sessionId": "session_1640995200_abc123",
  "type": "storage",
  "storageType": "localStorage",
  "operation": "set",
  "key": "userId",
  "value": "12345",
  "oldValue": null
}
```

**Console Events:**
```json
{
  "id": "evt_1234567890_003",
  "timestamp": 1640995200200,
  "sessionId": "session_1640995200_abc123",
  "type": "console",
  "level": "log",
  "message": "User logged in successfully",
  "args": ["user@example.com"]
}
```

**Error Events:**
```json
{
  "id": "evt_1234567890_004",
  "timestamp": 1640995200300,
  "sessionId": "session_1640995200_abc123",
  "type": "error",
  "message": "TypeError: Cannot read property 'foo' of null",
  "filename": "https://example.com/app.js",
  "lineno": 42,
  "colno": 15,
  "stack": "TypeError: Cannot read property..."
}
```

**WebSocket Events:**
```json
{
  "id": "evt_1234567890_005",
  "timestamp": 1640995200400,
  "sessionId": "session_1640995200_abc123",
  "type": "websocket",
  "url": "wss://api.example.com/ws",
  "event": "message",
  "data": "{\"type\":\"notification\",\"message\":\"Hello\"}"
}
```

**Code Execution Events:**
```json
{
  "id": "evt_1234567890_006",
  "timestamp": 1640995200500,
  "sessionId": "session_1640995200_abc123",
  "type": "code_execution",
  "method": "eval",
  "operation": "execute",
  "code": "console.log('Dynamically executed code'); alert('XSS attempt');",
  "codeLength": 62,
  "codeHash": "a1b2c3d4e5f6"
}
```

**Encoding Events (Deobfuscation):**
```json
{
  "id": "evt_1234567890_007",
  "timestamp": 1640995200600,
  "sessionId": "session_1640995200_abc123",
  "type": "encoding",
  "method": "atob",
  "operation": "decode",
  "output": "eval(function(p,a,c,k,e,d){...})",
  "outputLength": 1247,
  "success": true
}
```

**Performance Monitoring Events:**
```json
{
  "id": "perf_1234567890_001",
  "timestamp": 1640995200700,
  "sessionId": "session_1640995200_abc123",
  "type": "performance_stats",
  "method": "periodic_report",
  "operation": "performance_monitoring",
  "uptime": 30000,
  "totalEventsProcessed": 1250,
  "eventsAccepted": 1200,
  "eventsRejected": 50,
  "eventsDeduplicated": 50,
  "acceptanceRate": "96.00%"
}
```

**Headless Mitigation Events:**
```json
{
  "id": "evt_1234567890_006",
  "timestamp": 1640995200600,
  "sessionId": "session_1640995200_abc123",
  "type": "headless_mitigation",
  "method": "navigator.webdriver",
  "operation": "value_override",
  "originalValue": true,
  "newValue": false,
  "stackTrace": "checkWebdriver@https://example.com/detection.js:10:5"
}
```
