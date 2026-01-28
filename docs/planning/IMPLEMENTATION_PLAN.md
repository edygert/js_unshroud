# Implementation Plan: JavaScript Obfuscation & Dynamic Code Execution Detection

## Executive Summary

This plan implements comprehensive instrumentation for detecting JavaScript obfuscation and dynamic code execution in js_unshroud, a malware analysis tool. The work is divided into three priorities based on the evaluation findings:

**CRITICAL BUG DISCOVERED**: All instrumentation hooks (timer, DOM, storage, etc.) are currently non-functional in production because `window.__js_unshroud_log()` is a silent no-op with no bridge to Node.js. This must be fixed FIRST in P0.

### Scope Overview

**PART 1: Code Execution & Obfuscation Detection**
- **P0 (Critical - 3.5-4.5 days)**: Fix logging bridge bug + UDP logging + add eval/Function/encoding hooks - ✅ COMPLETE
- **P1 (High - 2 days)**: Script injection detection (innerHTML, createElement, setAttribute) - ✅ COMPLETE
- **P2a (Medium - 3-4 days)**: Event handlers, Blob URLs, javascript: URLs - ✅ COMPLETE
- **P2b (Medium - 4-5 days)**: Workers, dynamic imports, iframes - 🔴 PENDING

**PART 2: Fingerprinting Countermeasures**
- Audio, Font, WebRTC, Screen/Viewport, Timezone, Battery mitigations - ✅ COMPLETE (commit 421adfe)

**PART 3: Additional Headless Detection Mitigations**
- **P3.1 (1 day)**: Browser Object Model Spoofing (window.chrome, navigator.languages, navigator.mimeTypes, Notification) - 🔴 NEW
- **P3.2 (1-2 days)**: Behavioral Interaction Simulation (mouse, keyboard, scroll, click) - 🔴 NEW (CRITICAL)

**Total Remaining Effort**: 6-7 days (P2b: 4-5 days + P3: 2-3 days)

### Current Coverage (After P0, P1, P2a Completion)

- **Obfuscation decoding**: ✅ 5/5 methods instrumented (atob, btoa, fromCharCode, URI encoding)
- **Code execution**: ✅ 24/24 methods instrumented (eval, Function, script injection, event handlers, etc.)
- **Behavior monitoring**: ✅ 4/4 working (network, console, storage, errors)
- **Advanced patterns**: ⚠️ 3/6 (Blob URLs, javascript: URLs, event handlers complete; workers, modules, iframes pending)
- **Headless evasion**: ⚠️ 85% complete (missing: window.chrome, navigator.languages/mimeTypes, Notification API, behavioral simulation)
- **Overall malware analysis coverage**: ~85% → 100% (after P2b + P3)

---

## CRITICAL: Logging Bridge Bug

### Problem

All instrumentation hooks call `window.__js_unshroud_log(JSON.stringify(event))`, but this function is a **silent no-op** (bootstrap.js:8-14). There is NO bridge from browser context to Node.js EventLogger.

**Evidence**:
- Timer hooks load successfully but produce 0 events in JSONL
- DOM hooks load successfully but produce 0 events in JSONL
- Tests work because they manually set up `page.exposeFunction('__test_log_event', ...)`
- Production code in `runner.ts` never sets up this bridge

**Impact**: ALL instrumentation hooks are broken in production. Only CDP-captured events (network, console, errors) work.

### Required Fix (P0 Phase 1)

Add to `runner.ts` in `injectInstrumentation()` function BEFORE line 165:

```typescript
// Set up browser-to-Node.js logging bridge
await page.exposeFunction('__playwright_log_event', async (eventJson: string) => {
  try {
    const event = JSON.parse(eventJson);
    if (validateEvent(event)) {
      await eventLogger.logEvent(event as MonitoringEvent);
    }
  } catch (error) {
    console.error('[JS Unshroud] Failed to parse instrumentation event:', error);
  }
});

// Install bridge connector BEFORE bootstrap loads
await page.addInitScript({
  content: `
    window.__js_unshroud_log = function(data) {
      if (window.__playwright_log_event) {
        window.__playwright_log_event(data).catch(function(err) {
          console.warn('[JS Unshroud] Bridge error:', err);
        });
      }
    };
  `
});
```

This MUST be done first - all other work depends on events being capturable.

**STATUS**: P0, P1, and P2a phases have been completed and committed. P2b is pending.

---
---

# PART 2: Missing Fingerprinting Countermeasures Implementation Plan

## Executive Summary

This plan addresses gaps between **detection** (fingerprinting-hooks.js) and **countermeasures** (headless-mitigation.js). Currently, audio, font, WebRTC, screen/viewport, timezone, and battery fingerprinting techniques are either unmonitored or detected without mitigation, allowing malware to detect the analysis environment.

**Current State:**
- fingerprinting-hooks.js: Detection ONLY (Canvas, WebGL, Navigator, Audio)
- headless-mitigation.js: Both detection AND countermeasures (navigator properties, plugins, canvas noise, WebGL spoofing)
  - Note: navigator.webdriver is NOT overridden - Chrome flag prevents creation

**Gaps to Address:**
1. Audio fingerprinting - detection exists, no countermeasures
2. Font fingerprinting - no detection or countermeasures
3. WebRTC fingerprinting - no detection or countermeasures
4. Screen/viewport - partial detection (matchMedia), no countermeasures
5. Timezone - no detection or countermeasures
6. Battery API - no detection or countermeasures

**STATUS**: All 6 fingerprinting countermeasures have been implemented and committed (commit 421adfe).

---

## Summary

Implementation status:
- **PART 1**: P0, P1, and P2a complete. P2b (workers, modules, iframes) remains pending.
- **PART 2**: All 6 fingerprinting countermeasures implemented and tested (commit 421adfe).
- **PART 3**: Additional headless detection mitigations - NOT STARTED

---

# PART 3: Additional Headless Detection Mitigations

## Executive Summary

Based on comprehensive analysis of headless browser detection techniques used by malicious JavaScript, several common detection vectors are not currently mitigated. These gaps allow malware to detect the analysis environment and alter behavior.

**Documentation Update**: HTTP user-agent spoofing IS working correctly via `Emulation.setUserAgentOverride()` in CDPSessionManager.ts. CLAUDE.md incorrectly states this is broken and should be updated.

**Current State Verified**:
- ✅ HTTP user-agent spoofing (both CDP and extraHTTPHeaders) - WORKING
- ✅ navigator.webdriver - Property prevented from creation via Chrome flag (not overridden)
- ✅ navigator.hardwareConcurrency (8 cores) - IMPLEMENTED
- ✅ navigator.deviceMemory (8GB) - IMPLEMENTED
- ✅ navigator.plugins (fake Chrome PDF plugins) - IMPLEMENTED
- ✅ navigator.permissions.query() - IMPLEMENTED
- ✅ Canvas, WebGL, Audio, Font, WebRTC, Screen, Timezone, Battery - ALL IMPLEMENTED

**Missing Mitigations** (from industry detection technique analysis):
1. `window.chrome` object - MISSING
2. `navigator.languages` array - MISSING
3. `navigator.mimeTypes` collection - MISSING
4. `Notification` API spoofing - MISSING
5. Behavioral interaction simulation - MISSING (CRITICAL)

**Effort Estimate**: 2-3 days

---

## Phase P3.1: Browser Object Model Spoofing (1 day)

Add missing BOM properties that are commonly checked by headless detection scripts.

### P3.1.1: window.chrome Object (2-3 hours)

**File**: `src/instrumentation/headless-mitigation.js` (add to existing file)

**Implementation**:
```javascript
// Spoof window.chrome object (common headless check)
if (!window.chrome) {
  window.chrome = {
    runtime: {},
    loadTimes: function() {
      return {
        requestTime: Date.now() / 1000,
        startLoadTime: Date.now() / 1000,
        commitLoadTime: Date.now() / 1000,
        finishDocumentLoadTime: Date.now() / 1000,
        finishLoadTime: Date.now() / 1000,
        firstPaintTime: Date.now() / 1000,
        firstPaintAfterLoadTime: 0,
        navigationType: "Other",
        wasFetchedViaSpdy: false,
        wasNpnNegotiated: true,
        npnNegotiatedProtocol: "h2",
        wasAlternateProtocolAvailable: false,
        connectionInfo: "h2"
      };
    },
    csi: function() {
      return {
        startE: Date.now(),
        onloadT: Date.now(),
        pageT: Math.random() * 1000 + 500,
        tran: 15
      };
    },
    app: {}
  };

  logEvent({
    type: 'headless_mitigation',
    method: 'window.chrome',
    operation: 'object_injection',
    message: 'Injected fake window.chrome object'
  });
}
```

**Event**: Logs one-time injection event on page load.

**Testing**: Add test in `tests/instrumentation.test.ts` checking `typeof window.chrome === 'object'` and `typeof window.chrome.runtime === 'object'`.

### P3.1.2: navigator.languages Override (1 hour)

**File**: `src/instrumentation/headless-mitigation.js` (add to existing file)

**Implementation**:
```javascript
// Override navigator.languages (headless often has empty or single entry)
try {
  Object.defineProperty(navigator, 'languages', {
    get: function() {
      logEvent({
        type: 'headless_mitigation',
        method: 'navigator.languages',
        operation: 'value_override',
        originalValue: navigator.languages,
        newValue: ['en-US', 'en']
      });
      return ['en-US', 'en'];
    }
  });
} catch (e) {
  console.warn('[JS Unshroud] Failed to override navigator.languages:', e);
}
```

**Event**: Logs each access to `navigator.languages`.

**Testing**: Verify `navigator.languages` returns `['en-US', 'en']`.

### P3.1.3: navigator.mimeTypes Spoofing (2-3 hours)

**File**: `src/instrumentation/headless-mitigation.js` (add to existing file)

**Implementation**: Create fake `MimeTypeArray` matching the fake `navigator.plugins`. Each plugin should have associated MIME types.

```javascript
// Override navigator.mimeTypes (should match fake plugins)
try {
  const fakeMimeTypes = [
    {
      type: 'application/pdf',
      description: 'Portable Document Format',
      suffixes: 'pdf',
      enabledPlugin: { name: 'Chrome PDF Plugin' }
    },
    {
      type: 'application/x-google-chrome-pdf',
      description: 'Portable Document Format',
      suffixes: 'pdf',
      enabledPlugin: { name: 'Chrome PDF Plugin' }
    },
    {
      type: 'application/x-nacl',
      description: 'Native Client Executable',
      suffixes: '',
      enabledPlugin: { name: 'Native Client' }
    },
    {
      type: 'application/x-pnacl',
      description: 'Portable Native Client Executable',
      suffixes: '',
      enabledPlugin: { name: 'Native Client' }
    }
  ];

  Object.defineProperty(navigator, 'mimeTypes', {
    get: function() {
      logEvent({
        type: 'headless_mitigation',
        method: 'navigator.mimeTypes',
        operation: 'value_override',
        message: 'Returned fake MIME types array'
      });
      return fakeMimeTypes;
    }
  });
} catch (e) {
  console.warn('[JS Unshroud] Failed to override navigator.mimeTypes:', e);
}
```

**Event**: Logs each access to `navigator.mimeTypes`.

**Testing**: Verify `navigator.mimeTypes.length === 4` and check for PDF MIME types.

### P3.1.4: Notification API Spoofing (1 hour)

**File**: `src/instrumentation/headless-mitigation.js` (add to existing file)

**Implementation**:
```javascript
// Ensure Notification API exists and has realistic permission
if (typeof Notification !== 'undefined') {
  const originalPermission = Notification.permission;

  Object.defineProperty(Notification, 'permission', {
    get: function() {
      logEvent({
        type: 'headless_mitigation',
        method: 'Notification.permission',
        operation: 'value_override',
        originalValue: originalPermission,
        newValue: 'default'
      });
      return 'default';  // or 'granted' depending on realism preference
    }
  });
}
```

**Event**: Logs each access to `Notification.permission`.

**Testing**: Verify `Notification.permission === 'default'`.

---

## Phase P3.2: Behavioral Interaction Simulation (1-2 days)

**CRITICAL**: Many modern malware samples gate execution behind human interaction checks. Without simulation, malware that requires mouse movement, clicks, or scrolling will not execute.

### Problem

Current implementation:
1. Loads page
2. Waits `monitoringTimeoutSeconds` (default 15s)
3. Does NOTHING (no mouse, keyboard, scroll simulation)

Malware that requires interaction will detect this as non-human behavior and refuse to execute.

### Solution

Add realistic human-like interaction simulation to `src/cli/runner.ts`.

**File**: `src/cli/runner.ts` (modify `monitorPage()` function)

**Implementation**:
```typescript
async function simulateHumanBehavior(page: Page, durationMs: number) {
  const endTime = Date.now() + durationMs;
  const viewport = page.viewportSize() || { width: 1280, height: 720 };

  // Random helper
  const rand = (min: number, max: number) => Math.random() * (max - min) + min;

  while (Date.now() < endTime) {
    // 1. Random mouse movements (every 1-3 seconds)
    const moveDelay = rand(1000, 3000);
    await page.mouse.move(
      rand(0, viewport.width),
      rand(0, viewport.height),
      { steps: Math.floor(rand(10, 30)) }  // Realistic bezier-like path
    );
    await new Promise(r => setTimeout(r, moveDelay));

    // 2. Occasional scrolls (every 3-5 seconds)
    if (Math.random() < 0.3) {
      await page.mouse.wheel(0, rand(100, 500));
      await new Promise(r => setTimeout(r, rand(500, 1500)));
    }

    // 3. Occasional clicks on random elements (every 5-8 seconds)
    if (Math.random() < 0.2) {
      const elements = await page.$$('button, a, input[type="button"], input[type="submit"]');
      if (elements.length > 0) {
        const randomEl = elements[Math.floor(Math.random() * elements.length)];
        const box = await randomEl.boundingBox();
        if (box) {
          await page.mouse.click(
            box.x + rand(5, box.width - 5),
            box.y + rand(5, box.height - 5)
          );
        }
      }
      await new Promise(r => setTimeout(r, rand(1000, 2000)));
    }

    // 4. Random keypresses (very occasional, every 10-15 seconds)
    if (Math.random() < 0.1) {
      await page.keyboard.press('Tab');
      await new Promise(r => setTimeout(r, rand(500, 1000)));
    }
  }
}
```

**Integration**: Call from `monitorPage()`:
```typescript
async function monitorPage(page: Page, config: InstrumentationConfig): Promise<void> {
  const durationMs = (config.monitoringTimeoutSeconds || 15) * 1000;

  // Start human behavior simulation in background
  const behaviorPromise = simulateHumanBehavior(page, durationMs);

  // Wait for monitoring duration
  await Promise.race([
    behaviorPromise,
    new Promise(resolve => setTimeout(resolve, durationMs))
  ]);
}
```

**Configuration**: Add `enableBehaviorSimulation: boolean` (default: `true` when `enableHeadlessMitigation: true`)

**Event**: Optionally log interaction simulation events (mouse_move, scroll, click) for debugging. These would be internal monitoring events, not page-originated events.

**Testing**:
1. Create `tests/fixtures/interaction-gate-test.html` that only executes malicious code after detecting:
   - 3 mouse movements
   - 1 scroll event
   - 1 click event
2. Run js_unshroud with `enableBehaviorSimulation: true` and verify malicious code executes
3. Run with `enableBehaviorSimulation: false` and verify it does NOT execute

---

## Configuration Changes

Add to `InstrumentationConfig` in `src/schema/types.ts`:

```typescript
export interface InstrumentationConfig {
  // ... existing fields ...

  // Behavioral simulation (P3.2)
  enableBehaviorSimulation?: boolean;  // Default: true when enableHeadlessMitigation is true
  behaviorSimulationIntensity?: 'low' | 'medium' | 'high';  // Default: 'medium'
  // low: minimal interaction (1-2 movements, 1 scroll)
  // medium: realistic interaction (described above)
  // high: frequent interaction (more clicks, typing, etc.)
}
```

---

## Testing Strategy

### P3.1 Testing (BOM Spoofing)

**File**: `tests/instrumentation.test.ts` (add new test section)

```typescript
describe('Additional Headless Mitigations (P3.1)', () => {
  test('window.chrome object is present', async () => {
    const result = await page.evaluate(() => {
      return {
        hasChromeObject: typeof window.chrome === 'object',
        hasRuntime: typeof window.chrome?.runtime === 'object',
        hasLoadTimes: typeof window.chrome?.loadTimes === 'function',
        hasCsi: typeof window.chrome?.csi === 'function'
      };
    });
    expect(result.hasChromeObject).toBe(true);
    expect(result.hasRuntime).toBe(true);
    expect(result.hasLoadTimes).toBe(true);
    expect(result.hasCsi).toBe(true);
  });

  test('navigator.languages returns realistic array', async () => {
    const languages = await page.evaluate(() => navigator.languages);
    expect(languages).toEqual(['en-US', 'en']);
  });

  test('navigator.mimeTypes has realistic entries', async () => {
    const mimeTypes = await page.evaluate(() => {
      const types = [];
      for (let i = 0; i < navigator.mimeTypes.length; i++) {
        types.push({
          type: navigator.mimeTypes[i].type,
          description: navigator.mimeTypes[i].description
        });
      }
      return types;
    });
    expect(mimeTypes.length).toBeGreaterThan(0);
    expect(mimeTypes.some(m => m.type.includes('pdf'))).toBe(true);
  });

  test('Notification.permission is defined', async () => {
    const permission = await page.evaluate(() => {
      return typeof Notification !== 'undefined' ? Notification.permission : null;
    });
    expect(permission).toBeTruthy();
    expect(['default', 'granted', 'denied']).toContain(permission);
  });
});
```

### P3.2 Testing (Behavioral Simulation)

**New Fixture**: `tests/fixtures/interaction-gate-test.html`

```html
<!DOCTYPE html>
<html>
<head><title>Interaction Gate Test</title></head>
<body>
  <button id="testBtn">Click Me</button>
  <div id="result">Waiting for interaction...</div>
  <script>
    let mouseMoves = 0, scrolls = 0, clicks = 0;

    document.addEventListener('mousemove', () => mouseMoves++);
    document.addEventListener('scroll', () => scrolls++);
    document.getElementById('testBtn').addEventListener('click', () => clicks++);

    setTimeout(() => {
      const passed = mouseMoves >= 3 && scrolls >= 1 && clicks >= 1;
      document.getElementById('result').textContent = passed
        ? 'INTERACTION_DETECTED'
        : `FAILED: moves=${mouseMoves}, scrolls=${scrolls}, clicks=${clicks}`;

      if (passed) {
        console.log('MALICIOUS_CODE_EXECUTED');
      }
    }, 5000);
  </script>
</body>
</html>
```

**Test**:
```typescript
test('behavioral simulation triggers interaction-gated malware', async () => {
  const page = await browser.newPage();
  // ... inject headless-mitigation.js with enableBehaviorSimulation: true ...
  await page.goto('file://' + path.join(__dirname, 'fixtures/interaction-gate-test.html'));

  // Simulate for 6 seconds
  await new Promise(r => setTimeout(r, 6000));

  const result = await page.$eval('#result', el => el.textContent);
  expect(result).toContain('INTERACTION_DETECTED');

  const logs = await page.evaluate(() => {
    return window.__test_logs.filter(log => log.message === 'MALICIOUS_CODE_EXECUTED');
  });
  expect(logs.length).toBeGreaterThan(0);
});
```

---

## Documentation Updates

### Update CLAUDE.md

Remove the "Known Bug" section about HTTP user-agent spoofing:

```diff
- **Known Bug**: HTTP header spoofing currently does not work. The CDP `Network.setUserAgentOverride()` call in `CDPSessionManager.setUserAgentOverride()` is invoked but does not affect actual HTTP requests sent by the browser.
```

Add instead:

```markdown
**HTTP User-Agent Spoofing**: Fully functional via `Emulation.setUserAgentOverride()` CDP call with userAgentMetadata support. Called before navigation in `CDPSessionManager.ts`.
```

### Update README.md

Add to "Headless Browser Mitigation" section:

```markdown
### Browser Object Model Overrides
When `enableHeadlessMitigation` is enabled, additional browser objects are spoofed:
- `window.chrome` object with `runtime`, `loadTimes()`, `csi()` methods
- `navigator.languages` returns realistic language array (`['en-US', 'en']`)
- `navigator.mimeTypes` provides fake MIME types matching fake plugins
- `Notification.permission` returns realistic permission state

### Behavioral Simulation
When `enableBehaviorSimulation` is enabled (default when headless mitigation is on):
- Simulates realistic mouse movements with bezier-like trajectories
- Performs occasional scrolling at random intervals
- Clicks interactive elements (buttons, links) sporadically
- Sends random keypresses (Tab navigation)

This allows malware that gates execution behind human interaction checks to execute normally in the analysis environment.
```

---

## Verification

After implementation, verify all mitigations with comprehensive headless detection test:

**File**: `tests/fixtures/comprehensive-headless-detection.html`

This should check ALL known detection vectors:
1. navigator.webdriver
2. navigator.plugins.length
3. navigator.languages
4. navigator.mimeTypes
5. window.chrome presence
6. Canvas fingerprinting
7. WebGL vendor/renderer
8. User interaction (mousemove, scroll, click counts)
9. Notification API
10. Screen dimensions

Score each check (pass/fail) and report final score. With all P3 mitigations, should achieve 100% evasion.

---

## Next Steps

Based on remaining work from PART 1:

### Phase P2b: High-Value, Higher-Complexity (4-5 days)

#### P2b.1: Web Worker Instrumentation (2 days)

**New File**: `/home/edygert333/ai/js_unshroud/src/instrumentation/worker-hooks.js`

**Instruments**:
- `Worker` constructor
- `SharedWorker` constructor
- `worker.postMessage()`
- `worker.onmessage`
- Worker error events

**Event Schema**:
```typescript
export interface WorkerEvent extends BaseEvent {
  type: 'worker';
  eventType: 'worker_create' | 'worker_postmessage' | 'worker_message' | 'worker_error';
  workerType: 'Worker' | 'SharedWorker';
  scriptURL: string;
  blobContent?: string;  // Resolved from blob map
  message?: unknown;
  direction?: 'to_worker' | 'from_worker';
  error?: string;
  stackTrace?: string;
}
```

**Dependencies**: Requires P2a.2 (Blob tracking) for blob: URL resolution.

**Config**: `enableWorkers: boolean` (default: false)

#### P2b.2: Dynamic import() Detection (1 day)

**New File**: `/home/edygert333/ai/js_unshroud/src/instrumentation/module-hooks.js`

**Instruments**:
- `<script type="module">` element detection via appendChild/insertBefore

**Event Schema**:
```typescript
export interface ModuleEvent extends BaseEvent {
  type: 'module';
  eventType: 'module_script_inject';
  src?: string;
  content?: string;
  isInline: boolean;
  stackTrace?: string;
}
```

**Limitation**: Cannot reliably detect dynamic `import()` syntax without AST parsing. Focus on `<script type="module">` elements.

**Config**: `enableModules: boolean` (default: false)

#### P2b.3: iframe Instrumentation (1-2 days)

**New File**: `/home/edygert333/ai/js_unshroud/src/instrumentation/iframe-hooks.js`

**Instruments**:
- `iframe.srcdoc` setter - analyze HTML for scripts
- iframe creation via appendChild/insertBefore
- `iframe.contentWindow.eval()` (best-effort, fails for cross-origin)

**Event Schema**:
```typescript
export interface IframeEvent extends BaseEvent {
  type: 'iframe';
  eventType: 'iframe_create' | 'iframe_srcdoc_set' | 'iframe_eval';
  src?: string;
  srcdoc?: string;
  scriptCount?: number;
  scripts?: string[];
  code?: string;  // For iframe_eval
  element: string;
  stackTrace?: string;
}
```

**Limitation**: contentWindow.eval monitoring fails for cross-origin iframes (Same-Origin Policy).

**Config**: `enableIframes: boolean` (default: false)
