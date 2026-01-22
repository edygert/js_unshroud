# Detection Implications: Function Replacement vs Proxies

## Overview

This document analyzes the detection surface of js_unshroud's instrumentation techniques and how sophisticated malware could detect the analysis environment.

## Instrumentation Methods Used

js_unshroud uses **both techniques strategically**:

### Function Replacement (Primary Method)
Used in most instrumentation modules:
- `network-hooks.js`: `window.fetch`, `XMLHttpRequest.prototype.open/send`, `WebSocket.prototype.send`
- `storage-hooks.js`: `localStorage.getItem/setItem/removeItem/clear`
- `encoding-hooks.js`: `window.atob/btoa`, `String.fromCharCode`, URI functions
- `fingerprinting-hooks.js`: `canvas.toDataURL`, `canvas.getImageData`

**Example from network-hooks.js:40-84:**
```javascript
const originalFetch = originals.fetch;
window.fetch = async function(...args) {
  // Logging code
  const response = await originalFetch.apply(this, args);
  // More logging
  return response;
};
```

### Proxies (Selective Use)
Used in two specific cases:
- `code-execution-hooks.js:114-150`: Wrapping `Function` constructor
- `object-tracking.js:76-149`: Tracking custom object property access

**Example from code-execution-hooks.js:114:**
```javascript
const wrapped = new Proxy(OriginalConstructor, {
  construct: function(target, args) {
    // Log before execution
    return Reflect.construct(target, args);
  },
  apply: function(target, thisArg, args) {
    // Log before execution
    return Reflect.apply(target, thisArg, args);
  }
});
```

## Detection Implications for Both Methods

### Function Replacement Detection Vectors

#### ✅ VULNERABLE: toString() Check
```javascript
// Malware can detect wrapped functions:
fetch.toString()
// Returns: "async function(...args) { ... }"
// NOT: "function fetch() { [native code] }"
```
**Impact:** HIGH - bootstrap.js:90-130 stores originals but doesn't preserve native appearance

#### ✅ VULNERABLE: Property Descriptor Inspection
```javascript
Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem')
// Shows: {value: function, writable: true, enumerable: false, configurable: true}
// Native descriptor is often non-configurable/non-writable
```
**Impact:** MEDIUM - storage-hooks.js:41 doesn't preserve original descriptors

#### ✅ VULNERABLE: Performance Timing
```javascript
// Each wrapped call has logging overhead
const start = performance.now();
localStorage.setItem('key', 'value'); // ~0.1-0.5ms overhead
const end = performance.now();
```
**Impact:** MEDIUM - Detectable with micro-benchmarks, but not obvious in real-world usage

#### ✅ CRITICAL: Global Variables Exposed
```javascript
// From bootstrap.js:90-130
window.__js_unshroud_originals  // Direct evidence
window.__js_unshroud_log        // Direct evidence
window.__js_unshroud_loaded     // Direct evidence
window.__js_unshroud_session_id // Direct evidence
```
**Impact:** CRITICAL - Trivial detection by checking `Object.keys(window).filter(k => k.includes('unshroud'))`

### Proxy Detection Vectors

#### ✅ VULNERABLE: Constructor Identity Changes
```javascript
// code-execution-hooks.js:153
window.Function = new Proxy(originalFunction, {...})

// Detection:
const fn = new Function('return 1');
fn.constructor === Function  // true (but Function is now a Proxy)
Object.getPrototypeOf(Function) !== Object.getPrototypeOf(originalFunction)
```
**Impact:** MEDIUM - Can detect Proxy wrapper on Function constructor

#### ✅ VULNERABLE: Proxy toString() Patterns
```javascript
Function.toString()
// May reveal Proxy handler code or non-native implementation
```
**Impact:** MEDIUM - Proxies don't have "[native code]" toString output

#### ✅ VULNERABLE: Performance Degradation
```javascript
// Proxy overhead is 2-10x vs native
const start = performance.now();
for(let i = 0; i < 10000; i++) {
  new Function('return ' + i);  // ~0.1-0.5ms overhead per call
}
```
**Impact:** LOW - Only detectable with intensive benchmarking

## Current Mitigations in js_unshroud

The codebase does implement some anti-detection:

1. **headless-mitigation.js:32-57** - Overrides `navigator.webdriver` to return `false`
2. **code-execution-hooks.js:63-70** - Filters out Playwright internal code to reduce noise
3. **bootstrap.js:89-130** - Stores originals BEFORE wrapping (allows restoration if needed)

## Critical Detection Gaps

| Detection Method | Function Replacement | Proxy | Severity |
|-----------------|---------------------|-------|----------|
| **Global variable scan** | ❌ Exposed | ❌ Exposed | 🔴 CRITICAL |
| **toString() check** | ❌ Shows wrapper | ❌ Shows Proxy | 🔴 HIGH |
| **Descriptor inspection** | ❌ Wrong descriptor | ⚠️ Partially OK | 🟡 MEDIUM |
| **Performance timing** | ⚠️ Slow | ⚠️ Slower | 🟡 MEDIUM |
| **Stack trace analysis** | ❌ Shows wrapper | ❌ Shows Proxy | 🟡 MEDIUM |

## How Sophisticated Malware Could Detect js_unshroud

```javascript
// Detection code malware might use:
function detectJSUnshroud() {
  // Method 1: Check for global variables (EASIEST)
  if (window.__js_unshroud_loaded ||
      window.__js_unshroud_originals ||
      window.__playwright_log_event) {
    return "JS_UNSHROUD_DETECTED";
  }

  // Method 2: Check fetch toString
  if (!fetch.toString().includes('[native code]')) {
    return "FETCH_WRAPPED";
  }

  // Method 3: Check for Playwright
  if (navigator.webdriver || window.__playwright) {
    return "PLAYWRIGHT_DETECTED";
  }

  // Method 4: Performance test
  const start = performance.now();
  for(let i = 0; i < 1000; i++) eval('1+1');
  if (performance.now() - start > 100) { // Normally ~10ms
    return "EVAL_HOOKED";
  }

  return null;
}

if (detectJSUnshroud()) {
  // Malware behavior:
  // - Exit cleanly
  // - Display benign content
  // - Fingerprint the analysis environment
  // - Trigger only after long delay
}
```

## Recommendations for Reducing Detection

The codebase could improve stealth by:

1. **Rename globals** - Use cryptic names instead of `__js_unshroud_*`
2. **Implement toString() spoofing** - Make wrapped functions return `"function fetch() { [native code] }"`
3. **Preserve property descriptors** - Copy original descriptor properties
4. **Hide from Object.keys()** - Use non-enumerable properties
5. **Timing normalization** - Add random delays to disguise overhead

## Conclusion

However, **perfect stealth is impossible** - any instrumentation adds observable side effects. js_unshroud prioritizes **completeness** over **stealth**, which is appropriate for isolated VM malware analysis.

The hybrid approach (function replacement + selective Proxies) makes sense:
- **Function replacement** provides better performance and simpler code for most APIs
- **Proxies** handle complex cases (constructors, object tracking) where function replacement is insufficient

Both methods have similar detection surfaces, with the **global variable leakage** being the most critical vulnerability that sophisticated malware could exploit.
