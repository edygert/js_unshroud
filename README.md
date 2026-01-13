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
  "sampleRate": 1.0
}
```

Configuration options:
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
- `sampleRate`: Sample rate for events (0.0 to 1.0, default: `1.0` for 100% sampling)
- `maxEventsPerSecond`: Rate limiting threshold (default: `1000`)
- `dedupeWindowMs`: Time window for deduplication in milliseconds (default: `100`)
- `maxPayloadSize`: Maximum size of event payloads in bytes (default: `1024`)
- `maxStackDepth`: Maximum stack trace depth for captured events (default: `20`)
- `enableSampling`: Enable/disable event sampling (default: `true`)
- `enableRateLimiting`: Enable/disable rate limiting (default: `true`)
- `enableDeduplication`: Enable/disable event deduplication (default: `true`)

Create a config file `my-config.json` and run:

```bash
./dist/js_unshroud run --url https://example.com --out events.jsonl --config my-config.json
```

## Performance Monitoring

js_unshroud includes built-in performance monitoring and optimization features to manage high-volume event capture:

### Sampling
Control the percentage of events captured using `sampleRate` (0.0 to 1.0):
- `1.0` = 100% of events (no sampling)
- `0.5` = 50% of events sampled
- `0.1` = 10% of events sampled

### Rate Limiting
Limit the maximum events per second with `maxEventsPerSecond` to prevent overwhelming the monitoring system.

### Deduplication
Automatically deduplicate similar events within a time window (`dedupeWindowMs`). This prevents log spam from repeated operations.

### Payload Size Control
Limit maximum payload sizes with `maxPayloadSize` and stack trace depths with `maxStackDepth` to keep event data manageable.

Performance metrics are automatically logged every 30 seconds, including acceptance rates, sampled vs. dropped events, and current configuration status.

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

**Performance Monitoring Events:**
```json
{
  "id": "perf_1234567890_001",
  "timestamp": 1640995200500,
  "sessionId": "session_1640995200_abc123",
  "type": "performance_stats",
  "method": "periodic_report",
  "operation": "performance_monitoring",
  "uptime": 30000,
  "totalEventsProcessed": 1250,
  "eventsAccepted": 1200,
  "eventsRejected": 50,
  "eventsSampled": 25,
  "eventsRateLimited": 20,
  "eventsDeduplicated": 5,
  "acceptanceRate": "96.00%",
  "samplingRate": 0.8,
  "maxEventsPerSecond": 1000
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
