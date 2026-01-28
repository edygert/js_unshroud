Design an **end‑to‑end architecture + implementation plan** for a headless JavaScript monitoring tool that uses the Chrome DevTools Protocol (CDP) with custom instrumentation to approximate “monitor everything a script does.” The target audience is a senior engineer; output should be deeply technical, concrete, and implementation‑ready.

## 1. High‑level goals and constraints

- Goal: Run a **headless browser** against arbitrary web pages, capture a **forensic trace** of JavaScript behavior: function calls, important variable assignments, network I/O, DOM mutations, environment probes, and console activity.  
- Requirements:  
  - Unit testing must be implemented. 80% or more of the code must be covered by unit tests. 
  - The program must be installable as a single executable (use Bun, https://bun.com/docs).
  - The program must work in Microsoft Windows, Linux, and MacOS.
  - The program is CLI only, no GUI.
  - The primary use case is to analyze javascript scripts contained in web pages in an isolated malware analysis lab or virtual machine.
  - Use **CDP** directly for low‑level control.  
  - If it simplifies implementation, integrate **Playwright for Chromium** as the orchestration layer and drop down to CDP as needed.  
  - Support **multi‑page sessions** (navigations, redirects, iframes).  
  - Persist all captured events into a structured store (e.g., JSONL) for later analysis and correlation.  
  - Allow **configurable instrumentation** (e.g., focus on network + storage in one run, canvas + fingerprinting in another).  
- Non‑goals: Full instruction‑by‑instruction tracing of all JS is not required; instead, provide **high‑signal hooks** (APIs, key objects/properties, network, console, DOM, environment checks).

## 2. System architecture

Design a modular, service‑oriented architecture:

- **Controller / Orchestrator Service**  
  - Written in Node.js or TypeScript.  
  - Option A: Uses **Playwright for Chromium** as the main abstraction for browser lifecycle and navigation, and obtains the underlying CDP session via `page.context().newCDPSession(page)` or equivalent.  
  - Option B: Talks directly to a headless Chrome instance via WebSocket using raw CDP.  
  - Make a recommendation for either option A or option B and the reasons for the recommendation.
  - Responsibilities:  
    - Launch and manage headless browser instances.  
    - Handle navigation, timeouts, and basic automation.  
    - Configure CDP domains (`Runtime`, `Page`, `Network`, `Debugger`, `DOM`, `Log`, `Console`).  
    - Register instrumentation scripts with `addInitScript` (Playwright) or `Page.addScriptToEvaluateOnNewDocument` (raw CDP).  
    - Stream events to the logging pipeline.

- **Instrumentation Layer (Injected JS)**  
  - A set of JS modules injected before any page script runs to hook key APIs and objects.  
  - Uses Proxies, `Object.defineProperty`, and wrapper functions to intercept:  
    - Network‑like APIs: `fetch`, `XMLHttpRequest`, `WebSocket.send`, `EventSource`.  
    - Storage: `localStorage`, `sessionStorage`, `indexedDB` wrapper, cookies access patterns.  
    - Timers: `setTimeout`, `setInterval`, `requestAnimationFrame`.  
    - DOM and events: `addEventListener`, `removeEventListener`, selected DOM mutation operations.  
    - Fingerprinting and environment probes: `navigator` properties, canvas (`toDataURL`, `getImageData`), WebGL, audio contexts.  
  - Each hook emits **structured events** into a lightweight, reliable channel (e.g., `window.__js_unshroud_log(event)` or `console.debug` with a special prefix) that the controller subscribes to via CDP `Runtime.consoleAPICalled` / `Console.messageAdded`.

- **CDP Event Listener Layer**

  - Listens to:  
    - `Network.*` events: `requestWillBeSent`, `responseReceived`, `loadingFinished`, including stack traces when available.  
    - `Runtime.exceptionThrown`, `Runtime.consoleAPICalled`.  
    - `Debugger.paused`, `Debugger.scriptParsed` (optionally for targeted breakpoints and call stacks).  
    - `Page.*` and `DOM.*` as needed.  
  - Enriches events with metadata: navigation ID, frame ID, page URL, timestamps, correlation IDs from instrumentation.

- **Storage + Correlation Layer**

  - Pluggable storage backend (start with JSONL).  
  - A normalized schema, e.g.:  
    - `sessions` (id, start_time, target_url, config).  
    - `events` (id, session_id, timestamp, type, subtype, frame_id, script_url, location, payload JSON).  
    - `network_events`, `console_events`, `instrumentation_events` as specialized tables or types.  
  - Optional: indices for `url`, `event type`, and “interesting keys” (e.g., `exfiltration_target`, `header_name`, `cookie_name`).

## 3. Instrumentation design

Specify detailed instrumentation strategies:

- **Bootstrap timing**

  - Ensure instrumentation runs **before any page JS**:  
    - In Playwright: use `browser.newContext({})` plus `context.addInitScript({ path: 'instrumentation/bootstrap.js' })`.  
    - In raw CDP: call `Page.addScriptToEvaluateOnNewDocument` with the bootstrap script before `Page.navigate`.  
  - The bootstrap creates a global **logging shim**, e.g. `window.__JS_UNSHROUD__` with:  
    - `log(eventType, details)`  
    - `generateId()` to correlate events.  

- **Network hooks**

  - Wrap `window.fetch` to log: method, URL, headers, body (capped size), and call stack (when feasible via `Error().stack`), then call original fetch.  
  - Wrap `XMLHttpRequest.prototype.open` and `send` similarly.  
  - Wrap `WebSocket.prototype.send` and `EventSource` construction.  

- **Storage + state hooks**

  - Wrap `localStorage.setItem/getItem/removeItem/clear`, same for `sessionStorage`.  
  - Provide an opt‑in mechanism to track **specific objects** by identifier:  
    - e.g., a helper `JS_UNSHROUD.trackObject(obj, label)` that returns a `Proxy` logging get/set/delete operations, used by the orchestrator via `page.evaluate` on known globals.  

- **DOM + event hooks**

  - Patch `EventTarget.prototype.addEventListener` to log registrations (type, listener source URL if detectable, options) and potentially wrap listeners with a logging wrapper.  
  - Optionally intercept key DOM mutation methods (`appendChild`, `insertBefore`, `removeChild`, `innerHTML` setter) to log changes that are relevant to the monitored script (to avoid huge noise, make this configurable).  

- **Fingerprinting and environment probes**

  - Override `HTMLCanvasElement.prototype.toDataURL/getContext/getImageData` to log when code attempts to fingerprint via canvas.  
  - Wrap WebGL context methods that reveal GPU/vendor info.  
  - Provide read‑time logging for selected `navigator` properties that are commonly used for detection/fingerprinting (e.g., `userAgent`, `languages`, `platform`, `webdriver`).  

- **Error and console integration**

  - Add global `window.onerror` and `window.onunhandledrejection` hooks that call `__JS_UNSHROUD__.log`.  
  - Encourage all instrumentation to avoid breaking original semantics, especially around `this`, argument order, and return values.

## 4. CDP integration details (with optional Playwright)

Explicitly define how Playwright and CDP interact:

- **Browser lifecycle**

  - Use Playwright’s `chromium.launch({ headless: true })`.  
  - Create a new context per “session” with `context.addInitScript` for instrumentation.  
  - On each new page:  
    - Attach a CDP session: `const client = await context.newCDPSession(page);`  
    - Enable domains: `await client.send('Network.enable', {...})`, `Runtime.enable`, `Page.enable`, `Debugger.enable`, `Log.enable`, `Console.enable`.  

- **Event wiring**

  - Subscribe to CDP events via `client.on('Network.requestWillBeSent', handler)` etc.  
  - Parse and route events:  
    - If `Console.messageAdded` / `Runtime.consoleAPICalled` includes your special prefix or `__JS_UNSHROUD__` payload, treat it as instrumentation data.  
    - Otherwise, log regular console events separately.  
  - Optionally set **breakpoints** or **instrumentation breakpoints** on:  
    - `Debugger.setInstrumentationBreakpoint` (e.g., `beforeScriptExecution` to capture metadata about scripts).  
    - `Debugger.setBreakpointByUrl` on specific script URLs identified as suspicious by a heuristic.

- **Configuration**

  - Provide a user‑facing configuration format (JSON) to control:  
    - Which instrumentation modules are enabled (`network`, `storage`, `canvas`, `fingerprinting`, `dom`, `timers`).  
    - Maximum log sizes (bodies, stack strings).  
    - Per‑domain rate limiting or sampling to avoid blowing up performance.  

## 5. Implementation plan and milestones

Produce a step‑by‑step roadmap:

1. **MVP (single‑page, single‑domain, Playwright‑based)**  
   - Launch Chromium headless.  
   - Inject a minimal instrumentation script (network + console only).  
   - Log `fetch`/XHR calls + console messages to JSONL.  

2. **Core CDP integration + schema**  
   - Attach CDP sessions; enable `Network`, `Runtime`, `Console`.  
   - Implement a unified `EventLogger` that writes events into normalized records.  

3. **Extended instrumentation**  
   - Add storage, WebSocket, timers, and basic DOM hooks.  
   - Implement `trackObject` Proxies for targeted objects.  

4. **Correlation + analysis tools**  
   - Add session IDs, frame IDs, navigation IDs, correlation IDs to events.  
   - Build a CLI tool to filter “show all events leading up to this POST request” or “show all writes to localStorage.cookieJar”.  

5. **Performance and stealth**  
   - Benchmark overhead.  
   - Add options for sampling and selective hooks.  
   - Address basic headless‑detection issues (e.g., `navigator.webdriver` handling via Playwright/launch options).  

6. **Packaging**  
   - Provide a command‑line runner:  
     - `js_unshroud run --url https://example.com --config config.json --out session.jsonl`  
   - Document the architecture, extension points, and security considerations.

Throughout the design, keep the focus on: **safety (don’t break target sites), observability coverage (high‑signal events), stealth, and configurability** so that the tool adapts to different analysis scenarios while using CDP and (optionally) Playwright as the core foundation.

