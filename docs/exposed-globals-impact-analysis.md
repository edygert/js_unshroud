# Exposed Globals Impact Assessment

**Date:** 2026-01-20
**Scope:** Analysis of global variable exposure vulnerability in js_unshroud instrumentation
**Finding:** Impact rating of "LOW" is NOT supported by evidence - should be CRITICAL to HIGH

## Executive Summary

The claim that exposed global variables (`window.__js_unshroud_*`, `window.__playwright_log_event`) have "LOW impact" because "malware rarely checks this" is contradicted by:

1. Internal documentation rating this as CRITICAL severity
2. Trivial detection code (one-line check)
3. Modern anti-bot systems (Cloudflare, DataDome) actively checking for automation globals
4. Web-based malware operating in anti-bot environments that already perform these checks

## Evidence Analysis

### Evidence CONTRADICTING the "LOW impact" claim:

#### 1. Internal Documentation Rates This as CRITICAL

From `docs/detection-analysis.md:78-86`:
```javascript
window.__js_unshroud_originals  // Direct evidence
window.__js_unshroud_log        // Direct evidence
window.__js_unshroud_loaded     // Direct evidence
window.__js_unshroud_session_id // Direct evidence
```

**Impact:** CRITICAL - Trivial detection by checking `Object.keys(window).filter(k => k.includes('unshroud'))`

The detection severity table (`detection-analysis.md:131`) rates this as 🔴 **CRITICAL**, not LOW.

#### 2. Working Detection Code is Trivial

From `detection-analysis.md:140-147`, working detection code:
```javascript
function detectJSUnshroud() {
  // Method 1: Check for global variables (EASIEST)
  if (window.__js_unshroud_loaded ||
      window.__js_unshroud_originals ||
      window.__playwright_log_event) {
    return "JS_UNSHROUD_DETECTED";
  }

  // Alternative: Enumerate all globals
  if (Object.keys(window).some(k => k.includes('js_unshroud') || k.includes('playwright'))) {
    return "ANALYSIS_ENVIRONMENT_DETECTED";
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

This is a **one-line check** that any JavaScript can execute - not "sophisticated malware only".

#### 3. Modern Anti-Bot Systems DO Check Global Variables (2025 Research)

Research from Castle.io (2025) shows that Playwright is actively detected via global variables:

**Detection Method:**
- Check for `window.__playwright__` and `__pwInitScripts` globals
- Used by: Cloudflare, DataDome, PerimeterX, and other anti-bot systems
- Purpose: Identify browser automation for bot detection

**Key Finding:** Standard headless browsers (Selenium, Puppeteer, Playwright) can't bypass DataDome's security measures because they contain obvious bot-like information, including automated WebDriver presence and exposed global variables.

**Evolution of Evasion (2025):**
- Patchright: Modified Playwright that patches source code to avoid `Runtime.enable` CDP command
- Rebrowser: Bot detector specifically designed to catch Playwright/Puppeteer via global variables
- Anti-detect browsers: Commercial tools that hide all automation artifacts

**Implication:** If web scraping tools must hide their globals to bypass bot detection in 2025, malware operating in the same environment faces identical detection mechanisms.

#### 4. Web-Based Malware Operates in Anti-Bot Environments

Modern JavaScript malware (phishing, Magecart, banking trojans) operates on websites that **already use anti-bot detection**:

**Cloudflare Page Shield:**
- Uses JavaScript-based behavioral analysis and fingerprinting
- AI model detects malicious JavaScript intent (Magecart, crypto mining, malware)
- Executes obfuscated scripts in browser to evaluate browser entropy and behavior

**DataDome Detection Layers:**
1. Real-time ML models analyzing request patterns
2. Device fingerprinting (Canvas, WebGL, hardware properties)
3. Behavioral analysis (mouse movements, interactions)
4. JavaScript fingerprinting: GPU rendering, font availability, `navigator.webdriver`
5. TLS fingerprinting (JA3 hash)

**Banking Sites:**
- Heavily protected with anti-automation checks
- Webinjects alter login pages with obfuscated JavaScript
- Banking trojans (Gootkit, Trickbot) use anti-analysis techniques including VM detection

**ClickFix Attacks (47% of 2025 attacks per CLAUDE.md:410):**
- Operate on websites with active security measures
- Suggests malware DOES encounter and successfully evade anti-automation checks
- If malware can evade Cloudflare/DataDome, it can check for analysis tool globals

#### 5. Actual Exposed Globals in js_unshroud

From `src/instrumentation/bootstrap.js:90-133`:

```javascript
window.__js_unshroud_originals = {
  console: originalConsole,
  fetch: window.fetch,
  XMLHttpRequest: window.XMLHttpRequest,
  WebSocket: window.WebSocket,
  localStorage: window.localStorage,
  sessionStorage: window.sessionStorage,
  setTimeout: window.setTimeout,
  setInterval: window.setInterval,
  // ... 20+ more properties
};

window.__js_unshroud_loaded = true;
window.__js_unshroud_session_id = [session_id];
window.__js_unshroud_config = [config];
window.__js_unshroud_log = [function];
window.__playwright_log_event = [function];  // From runner.ts page.exposeFunction()
```

**Detection Surface:**
- 6 enumerable global variables with obvious names
- All visible via `Object.keys(window)`
- No obfuscation, non-enumerable properties, or hiding mechanisms
- Direct evidence of instrumentation framework presence

### Evidence SUPPORTING the "LOW impact" Claim (Weak):

#### 1. Traditional Desktop Malware Analysis Tools

The claim that "Malware looks for specific analysis tools (Fiddler, Wireshark, Process Monitor)" is true for **desktop malware** targeting native analysis tools.

**However:**
- js_unshroud targets **web-based JavaScript malware**, not desktop executables
- Different threat model: Browser-based vs. process-based detection
- Web malware checks browser properties, not process names or registry keys

#### 2. Limited Direct Evidence of Global Enumeration in Malware Samples

Search results found limited evidence of malware **specifically** enumerating `Object.keys(window)` to detect js_unshroud.

**However:**
- Absence of evidence ≠ evidence of absence
- Banking trojans DO use anti-analysis techniques (Gootkit, Trickbot, TgToxic)
- Detection frameworks exist specifically to catch automation (Castle.io Bot Detector)
- Malware may check for specific globals without full enumeration

**Why Evidence is Limited:**
- Malware samples are not publicly shared with detection code intact
- Anti-analysis code is often obfuscated or removed before public analysis
- Researchers focus on payload analysis, not environment detection mechanisms
- js_unshroud is new (2025-2026) - malware may not target it specifically yet

## Critical Findings

### Why the "Rarely Checked" Claim is Outdated (2025-2026 Context)

Modern web security has evolved significantly:

**Commercial Anti-Automation Industry:**
- Patchright exists specifically to evade Playwright detection
- Browser automation detection is a billion-dollar industry (DataDome, Castle.io, Cloudflare)
- Anti-detect browsers (Kameleo, GoLogin, NstBrowser) hide all automation artifacts
- Rebrowser bot detector specifically catches Playwright/Puppeteer globals

**Industry Statistics:**
- Cloudflare Page Shield protects millions of websites
- DataDome processes billions of requests daily
- 47% of 2025 attacks use ClickFix (interaction-gated malware)
- Q3 2025: Steep increase in JavaScript-attachment malware campaigns

**Technical Evidence:**
- Patchright patches Playwright source code to avoid `Runtime.enable` CDP command
- puppeteer-extra-plugin-stealth specifically hides automation globals
- DataDome documentation explicitly lists `navigator.webdriver` check
- Castle.io blog (March 2025) details Playwright global variable detection

### Comparison to Other Detection Vectors

| Detection Method | Difficulty | Detectability | js_unshroud Status |
|-----------------|------------|---------------|-------------------|
| **Global variable scan** | Trivial (1 line) | 100% reliable | ❌ Fully exposed |
| **toString() check** | Easy (2 lines) | High reliability | ❌ Shows wrapper code |
| **Descriptor inspection** | Medium (5 lines) | Medium reliability | ❌ Wrong descriptors |
| **Performance timing** | Hard (benchmarking) | Low reliability | ⚠️ Observable overhead |
| **Stack trace analysis** | Medium (error handling) | Medium reliability | ❌ Shows wrapper frames |
| **CDP detection** | Hard (protocol-level) | High reliability | ⚠️ Mitigated by Playwright |

**Global variable exposure is the EASIEST and MOST RELIABLE detection vector.**

### Revised Impact Assessment

| Factor | Original Claim | Evidence-Based Assessment |
|--------|---------------|---------------------------|
| **Detection difficulty** | "Only sophisticated malware" | **Trivial** (1 line of code) |
| **Frequency** | "Rarely checked" | **Common** in anti-bot systems (2025) |
| **Severity** | LOW | **CRITICAL** (per internal docs) |
| **Risk** | "Only APTs check this" | **All malware on protected sites** encounters these checks |
| **Likelihood of exploitation** | "Exception: Banking trojans and APTs" | **High** - Anti-bot systems already use this technique |

### Threat Model Analysis

**Who would detect these globals?**

1. **Anti-Bot Systems (ACTIVE NOW):**
   - Cloudflare, DataDome, PerimeterX - actively checking
   - Used on millions of websites including malware targets
   - Already detect Playwright via `__playwright__` globals

2. **JavaScript Malware (LIKELY):**
   - ClickFix attacks (47% of 2025 attacks) - interaction-gated, likely checks environment
   - Banking trojans (Gootkit, Trickbot, TgToxic) - known anti-analysis capabilities
   - Magecart web skimmers - operate on e-commerce sites with bot protection
   - Phishing pages - often include anti-analysis checks

3. **Sophisticated Malware (CONFIRMED):**
   - APTs and nation-state malware - comprehensive environment detection
   - Banking trojans - check for sandboxes, VMs, debuggers
   - Evasive malware - designed to detect and avoid analysis

4. **Future Malware (INEVITABLE):**
   - As js_unshroud gains adoption, malware will add detection
   - Trivial to implement (copy-paste from StackOverflow)
   - Low cost to add check, high reward to evade analysis

**What happens when detected?**

- **Exit cleanly** - Display benign content, no malicious behavior
- **Fingerprint environment** - Report analysis tool to C2 server
- **Delayed execution** - Trigger payload after analyst gives up
- **Alternative payload** - Serve honeypot code to waste analyst time

**Impact on js_unshroud effectiveness:**

- **0% capture rate** for environment-aware malware
- **False negative** - Analyst concludes sample is benign
- **Analysis failure** - No events captured, no behavior observed
- **Wasted resources** - Time spent analyzing benign behavior

## Existing Mitigations in js_unshroud

The codebase implements some anti-detection measures:

1. **headless-mitigation.js + runner.ts** - Prevents `navigator.webdriver` from being created via `--disable-blink-features=AutomationControlled` Chrome flag. Property remains undefined, evading both direct checks and existence checks (`_.has()`, `'webdriver' in navigator`).
2. **code-execution-hooks.js:63-70** - Filters out Playwright internal code to reduce noise
3. **bootstrap.js:89-130** - Stores originals BEFORE wrapping (allows restoration if needed)

**However, NO mitigations for global variable exposure.**

## Recommended Mitigations

From `detection-analysis.md:180-185` and industry best practices:

### Priority 1: Immediate Fixes (High Impact, Low Effort)

1. **Rename globals to cryptic/random names**
   ```javascript
   // Instead of:
   window.__js_unshroud_originals

   // Use:
   window._0x4a2b = {} // Random hex identifier
   window['\u200B'] = {} // Zero-width space (invisible)
   ```

2. **Use non-enumerable properties**
   ```javascript
   Object.defineProperty(window, '_internals', {
     value: {},
     enumerable: false,    // Hidden from Object.keys()
     writable: false,
     configurable: false
   });
   ```

3. **Store on less obvious objects**
   ```javascript
   // Instead of window, use:
   document.documentElement._data = {}
   navigator.constructor.prototype._cache = {}
   ```

### Priority 2: Enhanced Obfuscation (Medium Impact, Medium Effort)

4. **Implement toString() spoofing**
   ```javascript
   const wrappedFetch = async function(...args) { /* ... */ };
   Object.defineProperty(wrappedFetch, 'toString', {
     value: function() { return 'function fetch() { [native code] }'; },
     enumerable: false
   });
   ```

5. **Preserve property descriptors**
   ```javascript
   const originalDescriptor = Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem');
   Object.defineProperty(Storage.prototype, 'setItem', {
     ...originalDescriptor,  // Preserve original flags
     value: wrappedSetItem
   });
   ```

### Priority 3: Advanced Stealth (High Impact, High Effort)

6. **Timing normalization**
   ```javascript
   // Add random delays to disguise overhead
   await new Promise(r => setTimeout(r, Math.random() * 2));
   ```

7. **Symbol-based storage** (ES6+)
   ```javascript
   const SECRET = Symbol.for('internal');
   window[SECRET] = originals;
   // Not enumerable, harder to discover
   ```

8. **WeakMap storage** (completely hidden)
   ```javascript
   const originalsMap = new WeakMap();
   originalsMap.set(window, { fetch: window.fetch, ... });
   // No global exposure at all
   ```

## Conclusion

**The "LOW impact" rating is NOT supported by evidence and should be revised to CRITICAL to HIGH.**

### Key Findings:

1. ✅ **Internal documentation already rates this as CRITICAL** (detection-analysis.md)
2. ✅ **Detection code is trivial** (1 line) - not "sophisticated malware only"
3. ✅ **Modern anti-bot systems actively check for automation globals** (Cloudflare, DataDome)
4. ✅ **Web malware operates in environments that already perform these checks**
5. ✅ **Industry evidence shows global detection is standard practice** (2025-2026)
6. ❌ **No mitigations currently implemented** for global variable exposure

### Risk Assessment:

| Metric | Rating | Justification |
|--------|--------|---------------|
| **Exploitability** | 🔴 Critical | One-line check, no technical skill required |
| **Detection Reliability** | 🔴 Critical | 100% reliable - globals are always present |
| **Current Exploitation** | 🟡 Medium | Anti-bot systems use it, malware likely does too |
| **Future Exploitation** | 🔴 Critical | Inevitable as tool gains adoption |
| **Impact on Effectiveness** | 🔴 Critical | 0% capture rate if detected |
| **Overall Severity** | 🔴 **CRITICAL** | Easiest and most reliable detection vector |

### Recommendation:

**Implement Priority 1 mitigations immediately:**
- Rename all `__js_unshroud_*` globals to cryptic/random identifiers
- Make all storage properties non-enumerable
- Move critical data off `window` object

**The current implementation prioritizes completeness over stealth** (as stated in detection-analysis.md:190), which is appropriate for isolated VM analysis. However, the exposed globals represent an **unnecessary and trivial detection vector** that can be mitigated with minimal code changes.

Perfect stealth is impossible, but **making detection harder than a one-line check** is achievable and recommended.

---

## References

### Internal Documentation
- `docs/detection-analysis.md` - Detection surface analysis (rates globals as CRITICAL)
- `src/instrumentation/bootstrap.js:90-133` - Global variable definitions
- `CLAUDE.md:410` - ClickFix attack statistics (47% of 2025 attacks)

### External Research (2025-2026)

**Browser Automation Detection:**
- [How to detect Headless Chrome bots with Playwright](https://blog.castle.io/how-to-detect-headless-chrome-bots-instrumented-with-playwright/) - Castle.io (March 2025)
- [Evolution of Anti-Detect Frameworks](https://blog.castle.io/from-puppeteer-stealth-to-nodriver-how-anti-detect-frameworks-evolved-to-evade-bot-detection/) - Castle.io (2025)
- [Avoiding Bot Detection with Playwright Stealth](https://brightdata.com/blog/how-tos/avoid-bot-detection-with-playwright-stealth) - BrightData
- [Patchright: Undetectable Web Scraper](https://roundproxies.com/blog/patchright/) - RoundProxies

**Anti-Bot Systems:**
- [Cloudflare Malicious JavaScript Detection](https://blog.cloudflare.com/how-we-train-ai-to-uncover-malicious-javascript-intent-and-make-web-surfing-safer/) - Cloudflare
- [DataDome Bot Detection Methods](https://datadome.co/anti-detect-tools/cloudflare-captcha/) - DataDome
- [How to Bypass DataDome: Complete Guide 2025](https://www.zenrows.com/blog/datadome-bypass) - ZenRows

**Banking Trojans & Malware:**
- [Banking Trojan Techniques](https://unit42.paloaltonetworks.com/banking-trojan-techniques/) - Palo Alto Networks (Unit 42)
- [Gootkit Banking Trojan Anti-Analysis Features](https://www.sentinelone.com/labs/gootkit-banking-trojan-deep-dive-into-anti-analysis-features/) - SentinelOne
- [Trickbot Delivered via Highly Obfuscated JS File](https://www.trendmicro.com/en_us/research/19/h/latest-trickbot-campaign-delivered-via-highly-obfuscated-js-file.html) - Trend Micro
- [New TgToxic Banking Trojan Variant](https://thehackernews.com/2025/02/new-tgtoxic-banking-trojan-variant.html) - The Hacker News

**JavaScript Malware Research:**
- [Enhancing JavaScript Malware Detection through Weighted Behavioral DFAs](https://arxiv.org/html/2505.21406v1) - arXiv (May 2025)
- [X-Labs Q3 2025 Threat Brief: Obfuscated JavaScript](https://www.forcepoint.com/blog/x-labs/q3-2025-threat-brief-obfuscated-javascript-steganography) - Forcepoint
- [JS#SMUGGLER: Multi-stage Web Attack](https://thehackernews.com/2025/12/experts-confirm-jssmuggler-uses.html) - The Hacker News

**Detection Tools:**
- [Rebrowser Bot Detector](https://github.com/rebrowser/rebrowser-bot-detector) - GitHub (Modern tests to detect automated browser behavior)
- [How to detect Trojan Source attacks in JavaScript with ESLint](https://snyk.io/blog/how-to-detect-mitigate-trojan-source-attacks-javascript-eslint/) - Snyk
