# js_unshroud

A headless JavaScript monitoring and analysis tool that instruments web pages to capture network requests, storage operations, console logs, and other runtime events.

## Prerequisites

- [Bun](https://bun.com) runtime (v1.3.5 or later)
- Node.js (for Playwright's browser dependencies)

## Installation

### Linux/macOS Setup

Follow these steps to set up the development environment on Linux or macOS:

1. **Install Bun runtime:**
   ```bash
   curl -fsSL https://bun.com/install | bash
   ```

2. **Reload your shell configuration:**
   ```bash
   # For bash
   . ~/.bashrc

   # For zsh
   . ~/.zshrc
   ```

3. **Verify Bun installation:**
   ```bash
   bun --version
   ```

4. **Clone the repository and install dependencies:**
   ```bash
   git clone <repository-url>
   cd js_unshroud
   bun install
   ```

5. **Install Playwright test dependencies:**
   ```bash
   npm install @playwright/test
   ```

6. **Install Chromium browser for Playwright:**
   ```bash
   npx playwright install chromium
   ```

7. **Verify installation by running tests:**
   ```bash
   bun test
   ```

8. **Build the standalone executable:**
   ```bash
   bun run build
   ```

After completing these steps, you'll have a fully functional development environment with the compiled binary at `dist/js_unshroud`.

### Windows Setup

Follow these steps to set up the development environment on Windows:

1. **Install Bun runtime:**

   Open PowerShell and run:
   ```powershell
   powershell -c "irm bun.sh/install.ps1 | iex"
   ```

2. **Restart PowerShell** to reload environment variables

3. **Verify Bun installation:**
   ```powershell
   bun --version
   ```

4. **Clone the repository and install dependencies:**
   ```powershell
   git clone <repository-url>
   cd js_unshroud
   bun install
   ```

5. **Install Playwright test dependencies:**
   ```powershell
   npm install @playwright/test
   ```

6. **Install Chromium browser for Playwright:**
   ```powershell
   npx playwright install chromium
   ```

7. **Verify installation by running tests:**
   ```powershell
   bun test
   ```

8. **Build the standalone executable:**
   ```powershell
   bun run build
   ```

After completing these steps, you'll have a fully functional development environment with the compiled binary at `dist/js_unshroud-windows-x64.exe`.

**Note for Windows users:**
- The shell scripts (`*.sh` files) require WSL, Git Bash, or similar Unix-like environment
- All `bun` commands work natively in PowerShell or Command Prompt
- The compiled executable embeds the Bun runtime (no Bun/Node.js needed at runtime), but still
  requires its `node_modules/playwright-core` and `instrumentation/` siblings plus a Chromium
  browser — use `bun run release:windows` to produce a portable bundle (see
  [Packaging and Distribution](#packaging-and-distribution))

## Building

Build the compiled executable:

```bash
bun run build
```

This creates a binary at `dist/js_unshroud`. The binary embeds the Bun runtime (no Bun or
Node.js needed at runtime), but it is **not** a single self-contained file: it requires
`playwright-core` and the `instrumentation/` scripts to be present on disk next to it (see
[Packaging and Distribution](#packaging-and-distribution)). Building alone is enough for local
use from the project root; to produce a portable artifact for another machine, use the release
scripts below.

### Portable release builds

```bash
bun run release:linux        # dist/js_unshroud-linux-x64.tar.gz
bun run release:macos        # dist/js_unshroud-macos-x64.tar.gz
bun run release:macos-arm    # dist/js_unshroud-macos-arm64.tar.gz
bun run release:windows      # dist/js_unshroud-windows-x64.tar.gz
bun run release:all          # all of the above
```

Each `release:*` script builds the binary with `playwright-core` marked external (so no
build-machine path is baked into the executable) and packages a tarball whose layout is:

```
js_unshroud-<target>/
├── js_unshroud-<target>          # the binary
├── node_modules/playwright-core/ # vendored Playwright (resolved relative to the binary)
└── instrumentation/              # browser-context hook scripts
```

Extract the tarball anywhere and run the binary from inside it (or symlink it onto `PATH` — the
binary resolves its dependencies via the real path of the executable, so symlinks work). Browser
binaries are supplied separately via `PLAYWRIGHT_BROWSERS_PATH`; see
[Packaging and Distribution](#packaging-and-distribution).

## Development

For development, you can run the TypeScript source directly:

```bash
bun run dev
```

## Running

### Using the built binary (recommended for production)

**Linux/macOS:**
```bash
./dist/js_unshroud run --url https://example.com --out events.jsonl
```

**Windows (PowerShell):**
```powershell
.\dist\js_unshroud-windows-x64.exe run --url https://example.com --out events.jsonl
```

**Windows (Command Prompt):**
```cmd
dist\js_unshroud-windows-x64.exe run --url https://example.com --out events.jsonl
```

### Using TypeScript source (development)

Works the same on all platforms:
```bash
bun run dev --url https://example.com --out events.jsonl
```

### Capture command options

- `--url <url>`: Required. The URL to monitor
- `--out <path>`: Required. Output file path (will be in JSONL format)
- `--config <path>`: Optional. Path to instrumentation configuration JSON file

## Analyzing Captured Events

After capturing events, use the `analyze` subcommand to generate human-readable reports from the JSONL output.

### Usage

```bash
js_unshroud analyze --input <events.jsonl> [options]
```

### Analyze command options

**Required:**
- `--input <file>`: Path to JSONL events file

**Optional:**
- `--format <text|json|stats>`: Output format (default: `text`)
  - `text`: Human-readable timeline with timestamps and event summaries
  - `json`: Structured JSON output for programmatic consumption
  - `stats`: Event statistics summary (counts, time span, breakdown)
- `--output <file>`: Write to file instead of stdout (default: stdout)

### Examples

```bash
# Capture events
js_unshroud --url https://example.com --out events.jsonl

# Analyze: human-readable timeline to stdout
js_unshroud analyze --input events.jsonl

# Analyze: JSON format to file
js_unshroud analyze --input events.jsonl --format json --output timeline.json

# Analyze: statistics summary
js_unshroud analyze --input events.jsonl --format stats

# Pipeline-friendly: search for network events
js_unshroud analyze --input events.jsonl | grep "GET"

# Capture and analyze in sequence
js_unshroud --url https://example.com --out events.jsonl && \
  js_unshroud analyze --input events.jsonl --format stats
```

### Workflow

**Typical malware analysis workflow:**

1. **Capture** - Monitor JavaScript execution and capture events:
   ```bash
   js_unshroud --url https://malicious-site.com --out malware.jsonl
   ```

2. **Analyze** - Generate timeline to understand attack flow:
   ```bash
   js_unshroud analyze --input malware.jsonl
   ```

3. **Triage** - Get statistics to identify suspicious patterns:
   ```bash
   js_unshroud analyze --input malware.jsonl --format stats
   ```

The analyzer supports all 26 event types captured by the tool, including code execution, network requests, cryptographic operations, download detection, and advanced attack patterns.

### Anti-Analysis Detection Workflow

When malware uses `debugger;` statements as anti-analysis techniques, follow this two-pass workflow:

**Pass 1: Detect Anti-Analysis Techniques**
```bash
# Run with debugger detection enabled (default)
js_unshroud --url https://malicious-site.com --out initial.jsonl
```

Check for debugger events:
```bash
js_unshroud query --input initial.jsonl --type debugger
```

If debugger events are detected, the malware is using anti-analysis checks. Note the location and proceed to Pass 2.

**Pass 2: Capture Full Behavior Without Detection Risk**
```bash
# Disable debugger detection to avoid timing-based detection
echo '{"enableDebuggerDetection": false}' > no-debugger.json
js_unshroud --url https://malicious-site.com --out full-behavior.jsonl --config no-debugger.json
```

**Rationale:**
- Pass 1 confirms the malware uses `debugger;` statements and captures the location (valuable intelligence)
- Pass 2 disables debugger detection to eliminate timing-based detection risk (~1-5ms overhead)
- After disabling, subsequent `debugger` statements execute at native speed (~0ms), avoiding detection
- The information about anti-analysis techniques is already gathered from Pass 1

**Note:** The fire-and-forget optimization (implemented by default) already minimizes detection risk by only capturing the first debugger location and disabling the domain immediately. However, for maximum stealth against sophisticated malware with aggressive timing checks (<3ms threshold), disable debugger detection entirely in Pass 2.

## Querying Events

The `query` subcommand enables targeted filtering of captured events, allowing malware analysts to quickly find specific patterns without loading entire event logs into memory.

### Usage

```bash
js_unshroud query --input <events.jsonl> [FILTERS] [OPTIONS]
```

### Query Command Options

**Required:**
- `--input <file>`: Path to JSONL events file

**Filter Options:**
- `--type <types>`: Event types (comma-separated, e.g., `network,console,code_execution`)
- `--method <method>`: HTTP method for network events (GET, POST, etc.)
- `--url <url>`: Exact URL match for network events
- `--url-regex <pattern>`: Regex URL match for network events (e.g., `api\.evil\.com`)
- `--status <code>`: HTTP status code for network events
- `--level <level>`: Console level for console events (log, warn, error, info, debug)
- `--storage-type <type>`: Storage type for storage events (localStorage, sessionStorage)
- `--operation <op>`: Storage operation (set, get, remove, clear)
- `--correlation-id <id>`: Match events with specific correlation ID

**Output Options:**
- `--format <jsonl|count>`: Output format (default: `jsonl`)
  - `jsonl`: One JSON event per line (pipeline-friendly, streamable)
  - `count`: Print only the count of matching events (fast reconnaissance)
- `--output <file>`: Write to file instead of stdout (default: stdout)

### Examples

```bash
# Find all network requests
js_unshroud query --input events.jsonl --type network

# Find POST requests to suspicious domains
js_unshroud query --input events.jsonl --type network --method POST --url-regex "\\.ru$"

# Count code execution events (fast)
js_unshroud query --input events.jsonl --type code_execution --format count

# Find localStorage operations
js_unshroud query --input events.jsonl --type storage --storage-type localStorage --operation set

# Find console errors
js_unshroud query --input events.jsonl --type console --level error

# Query and save to file
js_unshroud query --input events.jsonl --type network --method POST --output suspicious.jsonl

# Pipeline: query → analyze
js_unshroud query --input events.jsonl --type code_execution | \
  js_unshroud analyze --input - --format stats

# Multi-type query
js_unshroud query --input events.jsonl --type "network,storage,code_execution"

# Combine multiple filters
js_unshroud query --input events.jsonl \
  --type network \
  --method GET \
  --url-regex "api\.example\.com" \
  --status 200
```

### Query vs Analyze

| Feature | query | analyze |
|---------|-------|---------|
| **Purpose** | Filter/search specific events | Format events as timeline/stats |
| **Filtering** | Full QueryFilter support | No filtering (loads all events) |
| **Output** | Raw events (JSONL) or count | Timeline text/JSON or stats summary |
| **Use Case** | "Show me X events" | "Summarize what happened" |
| **Memory** | Streams (low memory) | Buffers all events |
| **Pipeline** | Output can pipe to analyze | End of pipeline |

**Workflow:** `capture → query (filter) → analyze (format)`

### Malware Analysis Workflows

**Triage Workflow:**
```bash
# 1. Quick reconnaissance - count suspicious event types
js_unshroud query --input malware.jsonl --type code_execution --format count
js_unshroud query --input malware.jsonl --type cryptojs --format count

# 2. Extract suspicious events
js_unshroud query --input malware.jsonl --type code_execution --output suspicious.jsonl

# 3. Analyze the filtered subset
js_unshroud analyze --input suspicious.jsonl --format text
```

**Network Exfiltration Investigation:**
```bash
# Find all POST requests (potential data exfiltration)
js_unshroud query --input malware.jsonl --type network --method POST

# Find requests to foreign TLDs
js_unshroud query --input malware.jsonl --type network --url-regex "\\.ru$|\\.cn$"

# Count suspicious network activity
js_unshroud query --input malware.jsonl --type network --method POST --format count
```

**Obfuscation Analysis:**
```bash
# Find Base64 encoding operations
js_unshroud query --input malware.jsonl --type encoding

# Find CryptoJS decryption operations
js_unshroud query --input malware.jsonl --type cryptojs --operation decrypt

# Combine with analyze for timeline
js_unshroud query --input malware.jsonl --type "code_execution,encoding,cryptojs" | \
  js_unshroud analyze --input - --format text
```

### Correlate Command

Post-capture correlation analysis to find related event patterns using custom correlation rules.

#### Usage

```bash
js_unshroud correlate --input <events.jsonl> [OPTIONS]
```

#### Required Options

- `--input <file>`: Path to JSONL events file

#### Optional Options

- `--rules-file <file>`: Path to correlation rules JSON file
  - Default: Checks `./correlation_rules.json`, then `<project-root>/correlation_rules.json`
- `--rules <name1,name2,...>`: Apply only specified correlation rules (comma-delimited list, default: apply all rules)
- `--format <text|json>`: Output format (default: `text`)
  - `text`: Human-readable correlation chains with timestamps and event summaries
  - `json`: Structured JSON output for programmatic consumption
- `--output <file>`: Write to file instead of stdout (default: stdout)

#### Correlation Rules

Correlation rules define patterns to detect in event streams. The default rules file (`correlation_rules.json`) includes:

- **storage-to-network**: Local storage writes followed by network requests (data exfiltration pattern)
- **network-request-response**: Network request-response pairs (correlationId matching)
- **error-chains**: Network failures followed by error events
- **timer-to-network**: Timer executions followed by network activity (delayed beaconing)

#### Custom Rules File Format

Create a JSON file with this schema:

```json
{
  "rules": [
    {
      "name": "crypto-to-network",
      "description": "CryptoJS decryption followed by network exfiltration",
      "patterns": {
        "type": "sequence",
        "events": ["cryptojs", "network"],
        "maxTimeGap": 3000,
        "correlationField": "sessionId"
      }
    }
  ]
}
```

**Rule Schema:**
- `name` (string, required): Unique rule identifier
- `description` (string, required): Human-readable explanation
- `patterns` (object, required):
  - `type` (string, required): Either `"sequence"` (events must occur in order) or `"group"` (events can occur in any order)
  - `events` (array, required): Event types to correlate (e.g., `["storage", "network"]`)
  - `maxTimeGap` (number, optional): Maximum time gap in milliseconds between events in the correlation
  - `correlationField` (string, optional): Field to correlate by - `sessionId`, `correlationId`, or `url` (default: `sessionId`)

#### Examples

```bash
# Find all correlations using default rules
js_unshroud correlate --input events.jsonl

# Use custom rules file
js_unshroud correlate --input events.jsonl --rules-file my_rules.json

# Find only storage-to-network correlations
js_unshroud correlate --input events.jsonl --rules storage-to-network

# Find multiple specific correlations
js_unshroud correlate --input events.jsonl --rules storage-to-network,timer-to-network

# Output as JSON and save to file
js_unshroud correlate --input events.jsonl --format json --output chains.json

# Combine custom rules with rule filter
js_unshroud correlate --input events.jsonl --rules-file my_rules.json --rules crypto-to-network,eval-chain
```

#### Relationship to Other Commands

The correlate command is a **parallel post-processing tool** alongside analyze and query:

```
capture (run) → events.jsonl
                    ├─→ analyze: Format events as timeline or statistics
                    ├─→ query: Filter events by criteria
                    └─→ correlate: Find event correlation patterns
```

These commands operate on the same JSONL file but produce different outputs:
- **analyze**: Timeline text/JSON, statistics
- **query**: Filtered JSONL events (pipeable to analyze)
- **correlate**: Correlation chains text/JSON (standalone analysis)

#### Use Cases

**Malware Analysis:**
- Detect data exfiltration patterns (storage → network)
- Find obfuscation chains (encoding → eval → network)
- Identify delayed execution (timer → code_execution)
- Track fingerprinting flows (fingerprinting → storage → network)

**Behavioral Pattern Detection:**
- Correlate error events with network failures
- Find repeated API call patterns
- Detect Service Worker lifecycle anomalies
- Track multi-stage code execution chains

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
  "enableCryptoJS": true,
  "enableDebuggerDetection": true,
  "enableDownloadDetection": true,
  "enableClipboard": false,
  "enableBlobTracking": false,
  "enableArtifactCollection": false,
  "artifactDirectory": "./artifacts",
  "artifactTypes": {
    "pageSnapshot": true,
    "downloads": true,
    "codeExecution": true,
    "encoding": true,
    "cryptojs": true,
    "clipboard": true,
    "workers": true,
    "iframes": true
  },
  "maxArtifactSize": 10485760,
  "monitoringTimeoutSeconds": 15,
  "outputMode": "file",
  "udpLogging": {
    "enabled": false,
    "host": "127.0.0.1",
    "port": 514
  },
  "debug": false
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
- `enableCryptoJS`: Capture CryptoJS library encryption/decryption (AES, DES, TripleDES, RC4, Rabbit) (default: `true`)
- `enableDebuggerDetection`: Detect and automatically resume from `debugger;` statements - common anti-analysis technique (default: `true`). Uses fire-and-forget optimization: captures only the first debugger location (~1-5ms latency), then disables the domain so subsequent debuggers run at native speed (~0ms). For maximum stealth against sophisticated malware, disable this setting after confirming debugger usage in an initial run (see Anti-Analysis Detection Workflow).
- `enableWorkers`: Capture Web Worker and SharedWorker creation, messaging, and errors (default: `false`)
- `enableModules`: Capture ES module script injection via `<script type="module">` (default: `false`)
- `enableIframes`: Capture iframe creation, srcdoc injection, and embedded scripts (default: `false`)
- `enableDownloadDetection`: Capture file downloads via anchor elements and window.open() (default: `true`)
- `enableClipboard`: Capture clipboard read/write operations (default: `false`)
- `enableBlobTracking`: Capture Blob URL creation and content tracking (default: `false`)

**Artifact Collection (Opt-In):**
- `enableArtifactCollection`: Save full (non-truncated) content to disk for offline analysis (default: `false`)
- `artifactDirectory`: Base directory for artifact storage (default: `'./artifacts'`)
- `artifactTypes`: Object controlling which artifact types to save (default: all enabled)
  - `pageSnapshot`: Initial page HTML snapshot after navigation (default: `true`)
  - `downloads`: Downloaded files (blob URLs, data URLs) (default: `true`)
  - `codeExecution`: Full eval/Function code (default: `true`)
  - `encoding`: Full atob/btoa/fromCharCode output (default: `true`)
  - `cryptojs`: Full decrypted plaintext (default: `true`)
  - `clipboard`: Clipboard payloads (default: `true`)
  - `workers`: Web Worker scripts (default: `true`)
  - `iframes`: iframe srcdoc HTML (default: `true`)
- `maxArtifactSize`: Maximum artifact size in bytes (default: `10485760` = 10MB)

**Output Configuration:**
- `outputMode`: Output destination - `'file'`, `'udp'`, or `'both'` (default: `'file'`)
- `udpLogging`: UDP logging configuration object
  - `enabled`: Enable UDP logging (default: `false`)
  - `host`: UDP destination IP address (default: `'127.0.0.1'`)
  - `port`: UDP destination port (default: `514`)
- `debug`: Enable console output for debugging (default: `false`). When disabled, the tool runs silently except for critical errors.

**Monitoring Configuration:**
- `monitoringTimeoutSeconds`: How long to monitor the page in seconds (default: `15`). Increase this for slow-loading malware samples that require more time to execute.

**Behavioral Simulation (P3.2) - Defeats Interaction-Gated Malware:**
- `enableBehaviorSimulation`: Enable human-like interaction simulation (default: `false`, auto-enabled when `enableHeadlessMitigation` is `true`)
- `behaviorSimulationIntensity`: Intensity of simulated interaction - `'low'`, `'medium'`, or `'high'` (default: `'medium'`)
  - `low`: Mouse movement only, no forms
  - `medium`: Mouse, scroll, click, keyboard, basic form filling
  - `high`: All features, multiple form submissions, checkout simulation
- `enableFormInteraction`: Enable form field typing and submission simulation (default: `true` when `enableBehaviorSimulation` is true)
- `enableCheckoutSimulation`: Enable checkout/payment page detection and simulation (default: `true` when `enableFormInteraction` is true)
- `enableTimeDelayedBehavior`: Enable phased interaction over time to defeat time-bomb malware (default: `true` when `enableBehaviorSimulation` is true)

**Performance Tuning:**
- `maxPayloadSize`: Maximum size of event payloads in bytes (default: `2051`)
- `maxStackDepth`: Maximum stack trace depth for captured events (default: `20`)

**Event Filtering (P4.1) - Reduce Noise for Malware Triage:**

Control which events are logged to reduce noise when analyzing sites for triage. Defaults are optimized to filter benign site noise while preserving malware-relevant signals.

DOM event filtering (`eventFiltering.dom`):
- `enableLoadEvents`: Log resource load events (images, scripts, iframes) (default: `false`)
- `enableMouseEvents`: Log mouse movement and hover events (default: `false`)
- `enablePageLifecycle`: Log page navigation lifecycle events (pageshow, pagehide, visibilitychange) (default: `false`)
- `enableInteractionEvents`: Log user interaction event firings (click, keydown, submit, focus, blur) (default: `false`)
  - Note: `addEventListener` registrations are ALWAYS logged (critical malware signal), regardless of this setting
  - This setting only filters the individual event firings (noise from simulation/user)
- `enableMutationEvents`: Log DOM mutations (appendChild, innerHTML, etc.) (default: `false`)
  - Note: Script injections are always captured via `script_injection` events regardless of this setting

Encoding event filtering (`eventFiltering.encoding`):
- `enableAtobBtoa`: Log Base64 encoding/decoding (atob, btoa) (default: `false`)
  - Base64 is ubiquitous on modern web (data URIs, API responses) - disable for triage
- `enableFromCharCode`: Log character code conversion (String.fromCharCode) (default: `true`)
  - More suspicious, commonly used in obfuscation
- `enableURIEncoding`: Log URI encoding/decoding (encodeURI, decodeURIComponent, etc.) (default: `false`)

Example configuration for aggressive noise filtering (recommended for triage):
```json
{
  "eventFiltering": {
    "dom": {
      "enableLoadEvents": false,
      "enableMouseEvents": false,
      "enablePageLifecycle": false,
      "enableInteractionEvents": false,
      "enableMutationEvents": false
    },
    "encoding": {
      "enableAtobBtoa": false,
      "enableFromCharCode": true,
      "enableURIEncoding": false
    }
  }
}
```

Example configuration for comprehensive capture (no filtering):
```json
{
  "eventFiltering": {
    "dom": {
      "enableLoadEvents": true,
      "enableMouseEvents": true,
      "enablePageLifecycle": true,
      "enableInteractionEvents": true,
      "enableMutationEvents": true
    },
    "encoding": {
      "enableAtobBtoa": true,
      "enableFromCharCode": true,
      "enableURIEncoding": true
    }
  }
}
```

Create a config file `my-config.json` and run:

```bash
./dist/js_unshroud run --url https://example.com --out events.jsonl --config my-config.json
```

## Performance Monitoring

js_unshroud includes built-in performance features to manage high-volume event capture:

### Payload Size Control
Code execution and encoding events can generate very large payloads (obfuscated JavaScript can be megabytes). The `maxPayloadSize` setting limits payload sizes by truncating to the first 1024 bytes + "..." + last 1024 bytes, preserving both the beginning and end of the code for analysis.

Stack traces are limited to `maxStackDepth` frames to keep event data manageable while still providing debugging context.

### UDP Logging
For real-time monitoring and SIEM integration, events can be sent via UDP to a remote collector using the `outputMode` and `udpLogging` configuration options. UDP logging is fire-and-forget (no acknowledgment) and suitable for high-volume scenarios where some event loss is acceptable.

## Headless Browser Mitigation

When `enableHeadlessMitigation` is enabled, js_unshroud applies countermeasures to appear more like a regular browser.

### Configurable Headless Mitigation

All headless mitigation spoofed values are fully configurable via the `headlessMitigation` configuration object. This allows you to customize browser fingerprints for specific analysis scenarios.

**Built-in Profiles:**
- `windows-chrome` (default) - Windows 10 desktop with Chrome 143
- `macos-safari` - macOS with Safari 17.2
- `linux-firefox` - Linux with Firefox 122
- `android-chrome` - Android mobile with Chrome 143

**Configuration Examples:**

Using a profile:
```json
{
  "enableHeadlessMitigation": true,
  "headlessMitigation": {
    "profile": "macos-safari"
  }
}
```

Profile with custom overrides:
```json
{
  "enableHeadlessMitigation": true,
  "headlessMitigation": {
    "profile": "windows-chrome",
    "timezone": {
      "offset": -480,
      "name": "America/Los_Angeles"
    },
    "hardware": {
      "hardwareConcurrency": 16,
      "deviceMemory": 32
    }
  }
}
```

Full custom configuration (no profile):
```json
{
  "enableHeadlessMitigation": true,
  "headlessMitigation": {
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...",
    "platform": "Win32",
    "vendor": "Google Inc.",
    "language": "en-US",
    "languages": ["en-US", "en"],
    "hardware": {
      "hardwareConcurrency": 8,
      "deviceMemory": 8,
      "maxTouchPoints": 0
    },
    "screen": {
      "width": 1920,
      "height": 1080,
      "availWidth": 1920,
      "availHeight": 1040,
      "colorDepth": 24,
      "pixelDepth": 24
    },
    "window": {
      "innerWidth": 1280,
      "innerHeight": 720,
      "outerWidth": 1296,
      "outerHeight": 825,
      "devicePixelRatio": 1.0
    },
    "timezone": {
      "offset": 300,
      "name": "America/New_York"
    },
    "webgl": {
      "vendor": "Google Inc. (Intel)",
      "renderer": "ANGLE (Intel, Mesa Intel(R) UHD Graphics ...)"
    },
    "audio": {
      "sampleRate": 44100
    },
    "entropy": {
      "canvas": 0.01,
      "audio": 0.0001
    }
  }
}
```

**Configurable Values:**
- `profile` - Profile name to use as base (optional)
- `userAgent` - Full user agent string
- `platform` - navigator.platform (Win32, MacIntel, Linux x86_64, etc.)
- `vendor` - navigator.vendor (Google Inc., Apple Computer, Inc., etc.)
- `language` - Primary language (en-US, de-DE, etc.)
- `languages` - Language array (["en-US", "en"], etc.)
- `cdp` - Chrome DevTools Protocol metadata (platform, architecture, bitness, brands)
- `hardware` - Hardware specs (hardwareConcurrency, deviceMemory, maxTouchPoints)
- `screen` - Screen dimensions (width, height, availWidth, availHeight, colorDepth, pixelDepth)
- `window` - Window dimensions (innerWidth, innerHeight, outerWidth, outerHeight, devicePixelRatio)
- `timezone` - Timezone info (offset in minutes, IANA name)
- `webgl` - WebGL fingerprint (vendor, renderer)
- `audio` - Audio context (sampleRate)
- `entropy` - Fingerprint entropy levels (canvas noise 0.0-1.0, audio noise 0.0-1.0)

If `headlessMitigation` is not specified, the `windows-chrome` profile is used by default.

### Navigator Overrides (Configurable)
- `navigator.webdriver` - **INTENTIONALLY NOT OVERRIDDEN**. The `--disable-blink-features=AutomationControlled` Chrome flag prevents Chromium from creating this property. By NOT creating an override, the property remains undefined, defeating both direct checks (`navigator.webdriver`) AND existence checks (`_.has(navigator, "webdriver")`, `'webdriver' in navigator`). Trade-off: We lose logging capability when malware checks this property, but gain complete evasion of property existence detection (~90% success rate on bot.sannysoft.com).
- `navigator.hardwareConcurrency` returns realistic values (configurable, default: 8 cores)
- `navigator.deviceMemory` returns realistic values (configurable, default: 8GB)
- `navigator.plugins` provides fake Chrome PDF plugin entries
- `navigator.languages` returns configurable language array (default: `['en-US', 'en']`)
- `navigator.language` returns configurable primary language (default: `'en-US'`)
- `navigator.platform` returns configurable platform (default: `'Win32'` for Windows desktop)
- `navigator.vendor` returns configurable vendor (default: `'Google Inc.'` for Chrome branding)
- `navigator.maxTouchPoints` returns configurable touch points (default: `0` for desktop)
- `navigator.pdfViewerEnabled` returns `true` matching Chrome PDF support
- `navigator.cookieEnabled` returns `true`
- `navigator.userAgent` returns configurable realistic user agent string (default: Chrome 143)
- `navigator.mimeTypes` provides fake MIME types matching plugin list (PDF, NaCl)

### Browser Object Model (BOM) Spoofing
- `window.chrome` object injected with realistic properties:
  - `chrome.runtime` - Full API implementation with id, connect(), sendMessage(), onConnect, onMessage event listeners
  - `chrome.loadTimes()` - Returns realistic page load timing data
  - `chrome.csi()` - Returns Chrome Speed Index metrics
  - `chrome.app` - Empty object for Chrome app APIs
- `Notification.permission` returns `'default'` instead of undefined

### CDP Detection Evasion (CRITICAL)

**Advanced Protection Against CDP-Based Detection:**

Many sophisticated malware samples attempt to detect Chrome DevTools Protocol (CDP) automation by:
- Checking for CDP Runtime binding functions (`__playwright_binding__`, `__pw_inspect`)
- Inspecting global object properties for automation signatures
- Testing WebGL consistency between contexts
- Detecting CDP-specific timing characteristics

js_unshroud implements comprehensive CDP evasion:

1. **CDP Binding Concealment**: Uses `Runtime.addBinding()` exclusively (not `Page.addBinding()`) to prevent `__playwright_binding__` from appearing in main context global scope
2. **Worker Context Protection**: Hides CDP bindings and Playwright functions in Web Worker contexts
3. **chrome.runtime API**: Full implementation prevents detection via missing Chrome extension APIs
4. **WebGL Consistency**: Ensures WebGL vendor/renderer strings are consistent between main context and workers
5. **Global Object Sanitization**: Removes automation signatures from global scope enumeration

These techniques defeat advanced detection libraries including bot.sannysoft.com, fpscanner.io, and custom CDP fingerprinting code.

### Permission Overrides
Intercepts permission queries to return "granted" instead of denying common permissions that indicate headless operation.

### Canvas Fingerprinting Mitigation (Configurable)
Adds configurable random entropy to canvas `toDataURL()` and `getImageData()` outputs to break exact fingerprinting hashes (default: 1% noise level).

### WebGL Override (Configurable)
Overrides GPU vendor/renderer information to configurable values (default: Google Inc. (Intel) / ANGLE Intel UHD Graphics).

### Audio Fingerprinting Mitigation (Configurable)
- Spoofs `AudioContext.sampleRate` to configurable value (default: 44.1kHz)
- Injects configurable imperceptible random noise into `OfflineAudioContext` rendering to prevent exact audio fingerprinting (default: ±0.00005)

### Font Fingerprinting Mitigation
Returns a realistic minimal Windows font list (Arial, Times New Roman, Courier New, Verdana) via `document.fonts` API instead of exposing actual system fonts, preventing VM detection through Linux-specific font enumeration.

### WebRTC Blocking
- Blocks `RTCPeerConnection` to prevent IP address leaks
- Blocks `navigator.mediaDevices.getUserMedia()` to prevent camera/microphone access
- Blocks `navigator.mediaDevices.enumerateDevices()` to prevent device fingerprinting

### Screen & Viewport Spoofing (Configurable)
Spoofs screen and window dimensions (all values configurable):
- `screen.width/height`: Default 1920x1080
- `window.innerWidth/innerHeight`: Default 1280x720
- `devicePixelRatio`: Default 1.0 (standard non-retina)
- `screen.colorDepth`: Default 24-bit color

### Timezone Spoofing (Configurable)
- Overrides `Date.prototype.getTimezoneOffset()` to return configurable offset (default: US Eastern Time, -300 minutes)
- Overrides `Intl.DateTimeFormat().resolvedOptions().timeZone` to return configurable timezone name (default: "America/New_York")

### Battery API Blocking
Blocks `navigator.getBattery()` API which is deprecated and indicates desktop vs mobile environment.

### Media Query Monitoring
Monitors for headless-specific CSS media queries and logs detection attempts.

### Behavioral Interaction Simulation

**CRITICAL for defeating interaction-gated malware.** When `enableBehaviorSimulation` is enabled (default when `enableHeadlessMitigation` is true), js_unshroud simulates realistic human interaction patterns to trigger malware that gates execution behind user activity checks.

**Malware Techniques Defeated:**
- **ClickFix Attacks** (47% of 2025 attacks) - Malware waiting for click events
- **Form Submission-Based Harvesters** - Credential theft gated behind form submission
- **Magecart/Web Skimmers** - Payment card theft only on checkout pages
- **Time-Delayed Malware** - 60+ second delays to bypass automated analysis
- **Autofill Exploits** - Hidden field population detection
- **Honeypot Field Detection** - Avoiding hidden fields that detect automation

**Phased Interaction (Time-Delayed Behavior):**

When `enableTimeDelayedBehavior` is true (default), simulation occurs in 3 phases:

1. **Phase 1 (0-30s)**: Minimal mouse movement only
   - Defeats malware with short delays (15-30s)
   - Simulates initial page load reading

2. **Phase 2 (30-60s)**: Moderate interaction
   - Mouse movement + occasional scrolling
   - Simulates reading/browsing behavior
   - Defeats malware with 60s delays

3. **Phase 3 (60s+)**: Full interaction
   - Mouse, scroll, click, keyboard input
   - Form filling and submission
   - Checkout page simulation
   - Triggers all interaction-gated malware

**Form Interaction Capabilities:**

When `enableFormInteraction` is true (default with behavioral simulation):

- **Smart Field Detection**: Identifies visible form fields while avoiding honeypot fields (hidden, opacity < 0.1, size < 1px)
- **Realistic Value Generation**: Context-aware field filling based on name/id/placeholder:
  - Email fields → `test.user@example.com`
  - Phone fields → `555-0123`
  - Card numbers → `4532123456789012`
  - CVV → `123`
  - Names → `John`, `Doe`, `John Doe`
  - Usernames → `testuser`
  - Passwords → `Test123!@#`
- **Natural Typing**: Simulates typing with 50-150ms delays per character
- **Event Triggering**: Fires focus, blur, input, change, submit events to trigger all event listeners
- **Autofill Simulation**: Populates password fields to trigger autofill-based exfiltration
- **Form Submission**: Clicks submit buttons to trigger submission-gated malware

**Checkout Page Detection:**

When `enableCheckoutSimulation` is true (default with form interaction):

- **URL Pattern Matching**: Detects checkout/payment/cart/billing URLs
- **Payment Form Interaction**: Fills card number, CVV, expiry fields with realistic test data
- **Submit Triggering**: Clicks "Pay Now" / "Place Order" buttons
- **Defeats Magecart**: Triggers web skimmers that only activate on checkout pages

**Intensity Levels:**

Configure via `behaviorSimulationIntensity`:

- **`low`**: Mouse movement only, no form interaction
  - Use for: Quick scans, minimal interaction requirements
  - Triggers: Basic interaction gates (mouse movement detection)

- **`medium`** (default): Mouse, scroll, click, keyboard, basic form filling
  - Use for: General malware analysis
  - Triggers: Most interaction-gated malware including forms

- **`high`**: All features, multiple form submissions, aggressive checkout simulation
  - Use for: Sophisticated web skimmers, time-delayed malware
  - Triggers: All known interaction-gated malware patterns

**Configuration Example:**

```json
{
  "enableHeadlessMitigation": true,
  "enableBehaviorSimulation": true,
  "behaviorSimulationIntensity": "high",
  "enableFormInteraction": true,
  "enableCheckoutSimulation": true,
  "enableTimeDelayedBehavior": true,
  "monitoringTimeoutSeconds": 90
}
```

**Note**: For time-delayed malware (60s+ delays), set `monitoringTimeoutSeconds` to at least 75-90 seconds to allow Phase 3 interaction to occur.

### Detection Evasion Testing

js_unshroud includes a comprehensive detection evasion test suite to validate headless mitigation effectiveness:

**Test Infrastructure:**
- `detection/device_info.min.js` - Device fingerprinting library for validation
- `test_detection.html` - Comprehensive detection test page
- `test_detection_simple.html` - Simplified detection validation
- `tests/detection-evasion/` - Specialized detection test fixtures

**Testing Workflow:**
```bash
# Run against detection test page
js_unshroud --url file://$(pwd)/test_detection.html --out detection_results.jsonl --config config.json

# Analyze detection events
js_unshroud analyze --input detection_results.jsonl | grep -i "detection\|webdriver\|headless"

# Test specific detection vectors
js_unshroud --url https://bot.sannysoft.com --out bot_test.jsonl --config config.json
js_unshroud --url https://arh.antoinevastel.com/bots/areyouheadless --out headless_test.jsonl --config config.json
```

**Detection Coverage:**
- ✅ navigator.webdriver property existence checks
- ✅ CDP Runtime binding detection (`__playwright_binding__`, `__pw_inspect`)
- ✅ chrome.runtime API presence validation
- ✅ Canvas fingerprinting consistency
- ✅ WebGL vendor/renderer spoofing
- ✅ Plugin and MIME type enumeration
- ✅ Screen and window dimension consistency
- ✅ Timezone and language consistency
- ✅ Hardware concurrency and device memory
- ✅ Audio context fingerprinting
- ✅ Font enumeration fingerprinting
- ✅ Permission API behavior
- ✅ Media device enumeration
- ✅ WebRTC IP leak protection

**Current Evasion Rate**: ~98-100% on common detection frameworks (bot.sannysoft.com, fpscanner.io, Cloudflare challenges)

## Download Detection

js_unshroud automatically detects file downloads initiated through blob URLs, data URLs, and `window.open()` calls. This feature is critical for capturing malware payloads that are generated dynamically in the browser and downloaded to the victim's system.

**Enabled by default.** Set `enableDownloadDetection: false` to disable.

### What's Detected

**Anchor Element Downloads:**
- Download attribute assignment (`<a download="malware.exe">`)
- Href assignment with blob/data URLs (`<a href="blob:...">`)
- Click events on download links
- Full download correlation chain (blob → URL → anchor → click)

**window.open() Downloads:**
- `window.open()` calls with blob URLs
- `window.open()` calls with data URLs
- Target parameter tracking

**Blob Content Resolution:**
- Automatic blob content lookup from blob map
- Content size and MIME type tracking
- Optional artifact saving (see Artifact Collection below)

### Download Events

Download detection generates `DownloadEvent` objects with these event types:

- `download_attribute_set`: Download attribute was set on anchor element
- `download_href_set`: Href was set to blob/data URL
- `download_click`: Download link was clicked
- `window_open_download`: window.open() called with blob/data URL

Each download event includes:
- `downloadId`: Correlation ID linking related events
- `filename`: Download filename (if specified)
- `href` or `url`: Blob/data URL
- `blobContent`: Truncated blob content preview (1KB) in event log
- `artifactPath`: Path to saved artifact file (if artifact collection enabled)

### Configuration

```json
{
  "enableDownloadDetection": true
}
```

### Example Download Event

```json
{
  "id": "evt_1234567890_012",
  "timestamp": 1640995201100,
  "sessionId": "session_1640995200_abc123",
  "type": "download",
  "eventType": "download_click",
  "downloadId": "dl_1234567890_xyz",
  "filename": "payload.exe",
  "href": "blob:http://example.com/abc-123-def",
  "isBlobUrl": true,
  "isDataUrl": false,
  "blobType": "application/octet-stream",
  "blobSize": 524288,
  "blobContent": "MZ\u0090\u0000\u0003...",
  "artifactPath": "artifacts/session_xyz/downloads/evt_1234567890_012.exe"
}
```

## Artifact Collection

**CRITICAL for malware analysis:** Artifact collection saves the full, non-truncated content of malware payloads, obfuscated code, decrypted data, and other forensic artifacts to disk for offline analysis.

**Disabled by default (opt-in).** Enable via `enableArtifactCollection: true` in config.

### Why Artifact Collection?

Event logs (JSONL) truncate large payloads to keep file sizes manageable. For example:
- Code execution events truncate eval code to first/last 1KB
- Encoding events truncate decoded output to first/last 1KB
- Download events include only 1KB blob preview

**With artifact collection enabled**, the full (non-truncated) content is saved to organized filesystem directories for in-depth analysis.

### Directory Structure

```
artifacts/
  session_{timestamp}_{random}/
    page_snapshot/      # Initial page HTML snapshot
      evt_000_aaa.html
      evt_000_aaa.meta.json
    downloads/          # Downloaded files (blobs, data URLs)
      evt_123_abc.exe
      evt_123_abc.meta.json
    code_execution/     # Full eval/Function code
      evt_456_def.js
      evt_456_def.meta.json
    encoding/           # Full decoded/encoded output
      evt_789_ghi.txt
      evt_789_ghi.meta.json
    cryptojs/           # Full decrypted plaintext
      evt_012_jkl.txt
      evt_012_jkl.meta.json
    clipboard/          # Clipboard payloads
      evt_345_mno.txt
      evt_345_mno.meta.json
    workers/            # Web Worker scripts
      evt_678_pqr.js
      evt_678_pqr.meta.json
    iframes/            # iframe srcdoc HTML
      evt_901_stu.html
      evt_901_stu.meta.json
```

**Naming Convention:** `{eventId}.{extension}`

**Metadata Files:** Each artifact has a `.meta.json` file containing:
- Original event data
- Artifact type, size, MIME type
- Timestamp, session ID
- Truncation status

### Artifact Types

7 artifact types are supported:

1. **downloads** - Downloaded files (blob URLs, data URLs, window.open)
2. **codeExecution** - Full eval(), Function(), and dynamic code execution
3. **encoding** - Full atob/btoa/fromCharCode/URI encoding output
4. **cryptojs** - Full decrypted plaintext from CryptoJS
5. **clipboard** - Clipboard read/write payloads
6. **workers** - Web Worker and SharedWorker scripts
7. **iframes** - iframe srcdoc HTML content

### Configuration

**Minimal Configuration (Opt-In):**
```json
{
  "enableArtifactCollection": true
}
```

**Full Configuration:**
```json
{
  "enableArtifactCollection": true,
  "artifactDirectory": "./malware-artifacts",
  "artifactTypes": {
    "pageSnapshot": true,
    "downloads": true,
    "codeExecution": true,
    "encoding": true,
    "cryptojs": true,
    "clipboard": true,
    "workers": true,
    "iframes": true
  },
  "maxArtifactSize": 10485760
}
```

**Configuration Options:**
- `enableArtifactCollection`: Enable artifact saving (default: `false`)
- `artifactDirectory`: Base directory for artifacts (default: `./artifacts`)
- `artifactTypes`: Which artifact types to save (default: all enabled)
- `maxArtifactSize`: Maximum artifact size in bytes (default: 10MB = 10485760 bytes)

### Size Limits

Artifacts exceeding `maxArtifactSize` are logged as events but **not saved to disk**. A warning is logged to console.

**Recommended Size Limits:**
- **5MB (5242880 bytes)**: Conservative - saves disk space, may miss large payloads
- **10MB (10485760 bytes)**: Balanced (default) - captures most malware artifacts
- **25MB (26214400 bytes)**: Generous - captures larger payloads with moderate disk usage
- **50MB (52428800 bytes)**: Aggressive - captures almost all artifacts, high disk usage

### Security Warnings

⚠️ **WARNING: Artifact directories contain live malware payloads.**

**Security Best Practices:**
- Store artifacts in isolated directories with restricted permissions
- **DO NOT** open artifacts on production systems
- Use dedicated malware analysis VMs only
- Consider encrypting artifact directories at rest
- Regularly purge old artifact sessions to free disk space
- Never extract artifacts from the analysis VM without proper sanitization

**Recommended Filesystem Permissions:**
```bash
# Restrict artifact directory to current user only
chmod 700 artifacts/

# On multi-user systems, consider separate partition
sudo mount -t tmpfs -o size=1G,mode=700,uid=$(id -u) tmpfs /mnt/artifacts
```

### Workflow Examples

**Capture with Artifact Collection:**
```bash
# Enable artifact collection
echo '{
  "enableArtifactCollection": true,
  "artifactDirectory": "./malware-artifacts",
  "maxArtifactSize": 10485760
}' > artifact-config.json

# Run against malware sample
js_unshroud --url https://malicious-site.com --out events.jsonl --config artifact-config.json

# Verify artifacts saved
ls -lh malware-artifacts/session_*/

# Check artifact metadata
cat malware-artifacts/session_*/downloads/*.meta.json | jq .

# View full malware payload (⚠️ DANGER - isolated VM only)
cat malware-artifacts/session_*/code_execution/*.js
```

**Selective Artifact Collection (Downloads Only):**
```bash
# Save only downloaded files, ignore code execution
echo '{
  "enableArtifactCollection": true,
  "artifactTypes": {
    "downloads": true,
    "codeExecution": false,
    "encoding": false,
    "cryptojs": false,
    "clipboard": false,
    "workers": false,
    "iframes": false
  }
}' > downloads-only-config.json

js_unshroud --url https://malicious-site.com --out events.jsonl --config downloads-only-config.json
```

**Conservative Disk Usage (5MB Limit):**
```bash
echo '{
  "enableArtifactCollection": true,
  "maxArtifactSize": 5242880,
  "artifactTypes": {
    "downloads": true,
    "codeExecution": true,
    "encoding": false,
    "cryptojs": true,
    "clipboard": false,
    "workers": false,
    "iframes": false
  }
}' > conservative-config.json

js_unshroud --url https://malicious-site.com --out events.jsonl --config conservative-config.json
```

### Disk Space Planning

**Estimated Artifact Storage:**
- **Minimal malware (dropper)**: 10-50MB per session
- **Average malware sample**: 50-200MB per session
- **Complex multi-stage attack**: 200-500MB per session
- **Aggressive collection (all types, 50MB limit)**: 500MB-2GB per session

**Recommendations:**
- Allocate 1-2GB storage per captured session
- Regularly purge old sessions (cron job or manual cleanup)
- Use separate partition or mount point for artifacts
- Monitor disk usage: `du -sh artifacts/`

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
- `headless-mitigation.js` - Browser evasion techniques (navigator overrides, BOM spoofing, fingerprinting mitigation)
- `performance-monitor.js` - Wraps setTimeout/setInterval to flag very short timers (performance_warning events)
- `service-worker-hooks.js` - Service Worker monitoring
- `code-execution-hooks.js` - eval/Function/dynamic code execution
- `encoding-hooks.js` - atob/btoa/fromCharCode/URI encoding
- `cryptojs-hooks.js` - CryptoJS encryption/decryption monitoring
- `worker-hooks.js` - Web Worker and SharedWorker monitoring
- `module-hooks.js` - ES module script injection detection
- `iframe-hooks.js` - iframe creation and srcdoc monitoring
- `blob-hooks.js` - Blob URL creation and content tracking
- `url-execution-hooks.js` - javascript: URL execution detection
- `download-hooks.js` - Download detection (anchor elements, window.open)
- `clipboard-hooks.js` - Clipboard read/write monitoring
- `behavior-simulation.js` - Human-like interaction simulation

All other TypeScript/JavaScript code (CLI, orchestration, analysis) runs in Node.js and contributes to coverage metrics normally.

Run specific test files:

```bash
bun test tests/cli.test.ts  # CLI-specific tests
bun test tests/runner.test.ts  # Event logger and schema tests
bun test tests/analysis.test.ts  # Analysis layer tests (QueryEngine, CorrelationEngine, TimelineFormatter)
```

### Analysis Layer Coverage

The analysis layer (`src/analysis/`) maintains comprehensive test coverage:

- **TimelineFormatter.ts**: 100% statement and line coverage
  - Complete coverage of all 25 event types (network, storage, console, error, dom, timer, websocket, fingerprinting, headless_mitigation, performance_warning, service_worker, code_execution, encoding, cryptojs, script_injection, event_handler, blob, url_execution, worker, module, iframe, clipboard, debugger, download)
  - Branch coverage for event variants (blob operations, worker messaging, module injection types)
  - Edge case testing (empty filters, time boundaries, missing optional fields)

- **QueryEngine.ts**: 98.78% line coverage
  - Comprehensive query filtering and search capabilities

- **CorrelationEngine.ts**: 100% line coverage
  - Complete event correlation and relationship mapping

These tests ensure reliable post-capture analysis and reporting for malware triage workflows.

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

A js_unshroud release has two runtime dependencies that live **on disk**, not inside the binary:

1. **`playwright-core` and the `instrumentation/` scripts** — shipped *alongside* the binary by
   the `release:*` scripts. playwright-core cannot be embedded in a Bun `--compile` binary
   because it reads its own data files (browser registry, etc.) from disk at runtime; the binary
   therefore resolves it relative to the executable's real path.
2. **The Chromium browser binary** — supplied via the `PLAYWRIGHT_BROWSERS_PATH` environment
   variable (not packaged, due to size and licensing).

### Producing a release

```bash
bun run release:linux   # → dist/js_unshroud-linux-x64.tar.gz
```

The tarball is self-contained except for the browser. To use it on a target machine:

```bash
tar -xzf js_unshroud-linux-x64.tar.gz
cd js_unshroud-linux-x64
PLAYWRIGHT_BROWSERS_PATH=/path/to/ms-playwright \
  ./js_unshroud-linux-x64 run --url https://example.com --out events.jsonl
```

You can verify the binary is portable without a capture by running `./js_unshroud-linux-x64 --help`
(prints usage and exits 0).

### Installing the Chromium browser

Since js_unshroud uses Playwright to drive Chromium for instrumentation, the browser binary must
be available at runtime. Install it with the standard Playwright tooling, then point
`PLAYWRIGHT_BROWSERS_PATH` at the install location:

- **Default (recommended)**: Chromium only — `npx playwright install chromium`
- **All browsers**: `npx playwright install`
- **CI/containers**: pre-install in the image with the commands above

By default Playwright installs to `~/.cache/ms-playwright` (Linux). Set
`PLAYWRIGHT_BROWSERS_PATH` to that directory (or wherever you installed it) when running the
binary. Without a reachable browser, `run` fails with an error indicating the browser was not
found (the other subcommands — `analyze`, `query`, `correlate` — do not need a browser).

### Advanced: overriding the playwright-core location

The binary resolves `playwright-core` in this order: the `JS_UNSHROUD_PLAYWRIGHT_CORE`
environment variable (a path to the package directory or its entry file), then
`<dir-of-binary>/node_modules/playwright-core`, then standard module resolution (dev mode). Set
`JS_UNSHROUD_PLAYWRIGHT_CORE` only if you keep playwright-core somewhere other than next to the
binary.

## Deployment

### Option 1: Direct distribution (recommended)
- Build a portable release with `bun run release:<target>`.
- Distribute the `dist/js_unshroud-<target>.tar.gz` (binary + `node_modules/playwright-core` +
  `instrumentation/`).
- Ensure a Chromium browser is available and pass `PLAYWRIGHT_BROWSERS_PATH` at runtime.
- For a system install (e.g. REMnux/`/opt`): extract the tarball to `/opt/js_unshroud` and
  symlink the binary into `PATH` (`ln -s /opt/js_unshroud/js_unshroud-linux-x64 /usr/local/bin/js_unshroud`).

### Option 2: Containerized
Create a `Dockerfile` that copies the whole extracted release directory and installs a browser:

```dockerfile
FROM node:18-slim
WORKDIR /app
# Copy the extracted release dir (binary + node_modules/playwright-core + instrumentation/)
COPY js_unshroud-linux-x64/ ./
RUN chmod +x js_unshroud-linux-x64 \
 && npx playwright install --with-deps chromium
ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright
ENTRYPOINT ["./js_unshroud-linux-x64"]
```

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

**CryptoJS Events (Encryption/Decryption):**
```json
{
  "id": "evt_1234567890_008",
  "timestamp": 1640995200700,
  "sessionId": "session_1640995200_abc123",
  "type": "cryptojs",
  "method": "AES.decrypt",
  "operation": "decrypt",
  "algorithm": "AES",
  "key": "secret-key-123",
  "output": "console.log('malicious payload');",
  "outputLength": 34,
  "success": true
}
```

Note: For `decrypt` operations, `output` contains the decrypted plaintext. For `encrypt` operations, `output` contains the cleartext input (not the encrypted result). This allows analysts to see what data is being encrypted without storing large encrypted payloads.

**Debugger Events (Anti-Analysis Detection):**
```json
{
  "id": "evt_1234567890_009",
  "timestamp": 1640995200750,
  "sessionId": "session_1640995200_abc123",
  "type": "debugger",
  "reason": "other",
  "url": "https://example.com/malware.js",
  "lineNumber": 42,
  "columnNumber": 4,
  "scriptId": "123"
}
```

Note: Malicious JavaScript often uses `debugger;` statements to detect analysis tools. When enabled, js_unshroud automatically detects and resumes from debugger statements, allowing execution to continue normally while logging the anti-analysis attempt.

**Web Worker Events:**
```json
{
  "id": "evt_1234567890_009",
  "timestamp": 1640995200800,
  "sessionId": "session_1640995200_abc123",
  "type": "worker",
  "eventType": "worker_create",
  "workerType": "Worker",
  "scriptURL": "blob:http://example.com/abc123",
  "blobContent": "self.postMessage('malicious payload');",
  "stackTrace": "createWorker@https://example.com/app.js:42:10"
}
```

**ES Module Events:**
```json
{
  "id": "evt_1234567890_010",
  "timestamp": 1640995200900,
  "sessionId": "session_1640995200_abc123",
  "type": "module",
  "eventType": "module_script_inject",
  "src": "https://cdn.example.com/module.js",
  "isInline": false,
  "stackTrace": "loadModule@https://example.com/loader.js:15:5"
}
```

**iframe Events:**
```json
{
  "id": "evt_1234567890_011",
  "timestamp": 1640995201000,
  "sessionId": "session_1640995200_abc123",
  "type": "iframe",
  "eventType": "iframe_srcdoc_set",
  "srcdoc": "<html><body><script>alert('XSS')</script></body></html>",
  "scriptCount": 1,
  "scripts": ["alert('XSS')"],
  "element": "iframe#malicious-frame",
  "stackTrace": "injectIframe@https://example.com/inject.js:20:3"
}
```

**Performance Warning Events:** (emitted when a page schedules a very short timer)
```json
{
  "id": "3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607",
  "timestamp": 1640995200700,
  "sessionId": "session_1640995200_abc123",
  "type": "performance_warning",
  "method": "setTimeout",
  "operation": "short_timeout_detected",
  "delay": 5,
  "warning": "Instrumentation may be impacting performance"
}
```

**Headless Mitigation Events:**
```json
{
  "id": "evt_1234567890_006",
  "timestamp": 1640995200600,
  "sessionId": "session_1640995200_abc123",
  "type": "headless_mitigation",
  "method": "navigator.hardwareConcurrency",
  "operation": "value_override",
  "originalValue": 2,
  "newValue": 8,
  "stackTrace": "checkCPU@https://example.com/detection.js:15:5"
}
```

Note: `navigator.webdriver` is NOT overridden and will not generate events. The Chrome flag `--disable-blink-features=AutomationControlled` prevents the property from being created, making it completely undetectable.
