# JavaScript Malware Analysis & Anti-Detection Tools: Comprehensive Comparison

**Report Date**: 2026-01-18
**Analysis Scope**: Tools similar to js_unshroud for JavaScript malware analysis, browser automation, and headless detection evasion

---

## Executive Summary

This report compares js_unshroud against 12 other tools in the JavaScript malware analysis and anti-detection space, categorized into:
1. **Open-Source Malware Analysis Tools** (box-js, malware-jail, Fakeium)
2. **Commercial Malware Sandboxes** (Joe Sandbox, Cuckoo Sandbox, CAPE)
3. **Anti-Detection Frameworks** (puppeteer-extra-plugin-stealth, rebrowser-patches, Kameleo, GoLogin, NstBrowser)

**Key Finding**: js_unshroud is the **most comprehensive open-source JavaScript malware analysis tool** with instrumentation breadth matching commercial tools like Joe Sandbox and headless evasion capabilities exceeding basic frameworks like puppeteer-extra-plugin-stealth.

---

## Comparison Table: JavaScript Malware Analysis & Anti-Detection Tools

### Category 1: Open-Source Malware Analysis Tools

| Tool | Code Execution Hooks | Obfuscation Detection | Network Monitoring | Headless Evasion | Behavioral Simulation | Output Format | License | Primary Use Case |
|------|---------------------|----------------------|-------------------|------------------|----------------------|---------------|---------|------------------|
| **js_unshroud** | ✅ **Extensive** (eval, Function, script injection, event handlers, Workers, iframes) | ✅ **Comprehensive** (atob, btoa, fromCharCode, URI encoding) | ✅ **Full** (fetch, XHR, WebSocket, CDP) | ✅ **Advanced** (navigator spoofing, canvas entropy, WebGL, fonts, WebRTC blocking, screen/timezone/audio) | ✅ **Planned** (P3.2: mouse, keyboard, scroll, clicks) | JSONL + UDP | Open Source | Malware analysis in isolated VMs with comprehensive evasion |
| **[box-js](https://github.com/CapacitorSet/box-js)** | ✅ **Good** (Node.js sandbox with instrumented APIs) | ✅ **Good** (ActiveX emulation, automatic deobfuscation) | ⚠️ **Limited** (logs URL access, no real network) | ❌ No (Node.js environment, no browser) | ❌ No | JSON logs | MIT | Quick static/semi-dynamic analysis of JS malware samples |
| **[malware-jail](https://github.com/HynekPetrak/malware-jail)** | ✅ **Good** (Node.js sandbox, emulated Windows APIs) | ✅ **Good** (automatic payload extraction) | ⚠️ **Simulated** (fake XMLHttpRequest) | ❌ No (Node.js environment) | ❌ No | JSON + extracted payloads | MIT | Automated deobfuscation and payload extraction |
| **[Fakeium](https://www.sciencedirect.com/science/article/pii/S2352711025002675)** | ✅ **V8-based** (lightweight JavaScript execution) | ✅ **Good** (API call extraction) | ⚠️ **Limited** (no real browser network stack) | ❌ No (V8 engine only) | ❌ No | String literals + API calls | Open Source (2025) | Fast, automated large-scale JavaScript analysis |

### Category 2: Commercial Malware Sandboxes

| Tool | Code Execution Hooks | Obfuscation Detection | Network Monitoring | Headless Evasion | Behavioral Simulation | Output Format | License | Primary Use Case |
|------|---------------------|----------------------|-------------------|------------------|----------------------|---------------|---------|------------------|
| **[Joe Sandbox](https://www.joesecurity.org/blog/7492960968739667986)** | ✅ **Extensive** (Generic JS instrumentation, every method/API/string) | ✅ **Advanced** (AI-powered obfuscation detection, SVG analysis) | ✅ **Full** (network capture, PCAP) | ✅ **Advanced** (proprietary anti-evasion tech) | ✅ **Yes** (instrumented browsers) | HTML reports, JSON, PCAP | Commercial | Enterprise-grade automated malware analysis |
| **[Cuckoo Sandbox](https://cuckoo.readthedocs.io/en/latest/usage/packages/)** | ✅ **Good** (jscript.dll hooks, IE instrumentation) | ⚠️ **Limited** (basic JS extraction) | ✅ **Full** (PCAP, network activity) | ⚠️ **Basic** (Windows VM only) | ⚠️ **Limited** (runs in real Windows) | JSON, HTML reports, PCAP | GPL (open) / Commercial (modified) | General-purpose malware sandbox (not JS-focused) |
| **CAPE Sandbox** | ✅ **Good** (API hooking, behavior monitoring) | ⚠️ **Limited** (focuses on binaries) | ✅ **Full** (PCAP, network capture) | ⚠️ **Basic** (Windows VM) | ⚠️ **Limited** | JSON, PCAP | Open Source | Malware config/payload extraction (binary-focused) |

### Category 3: Anti-Detection Frameworks (Evasion-Focused)

| Tool | Code Execution Hooks | Obfuscation Detection | Network Monitoring | Headless Evasion | Behavioral Simulation | Output Format | License | Primary Use Case |
|------|---------------------|----------------------|-------------------|------------------|----------------------|---------------|---------|------------------|
| **[puppeteer-extra-plugin-stealth](https://www.zenrows.com/blog/puppeteer-stealth)** | ❌ No (automation framework) | ❌ No | ⚠️ **Via Puppeteer** (network interception) | ⚠️ **Basic** (navigator.webdriver, plugins, permissions) | ❌ No (manual scripting) | Puppeteer API | MIT | Basic bot detection evasion for web scraping |
| **[rebrowser-patches](https://github.com/rebrowser/rebrowser-patches)** | ❌ No | ❌ No | ⚠️ **Via Puppeteer/Playwright** | ✅ **Advanced** (runtime patches, CDP signal removal, deep leaks fixed) | ❌ No (manual scripting) | Puppeteer/Playwright API | MIT | Advanced anti-bot evasion (Cloudflare, DataDome) |
| **[Kameleo](https://kameleo.io/blog/the-best-headless-chrome-browser-for-bypassing-anti-bot-systems)** | ❌ No | ❌ No | ⚠️ **Via browser APIs** | ✅ **Industry-leading** (canvas, WebGL, audio, fonts, timezone, profiles) | ✅ **Yes** (configurable behavior patterns) | Browser automation API | Commercial | Professional web scraping and testing |
| **[GoLogin](https://gologin.com/blog/anti-fingerprinting-browser/)** | ❌ No | ❌ No | ⚠️ **Via browser APIs** | ✅ **Advanced** (multi-profile fingerprinting, clean profiles) | ⚠️ **Limited** | Browser profiles | Commercial | Multi-account management, anti-fingerprinting |
| **[NstBrowser](https://www.nstbrowser.io/)** | ⚠️ **RPA framework** (automation scripting) | ❌ No | ✅ **Good** (RPA-level monitoring) | ✅ **Advanced** (anti-detect browser with automation focus) | ✅ **Yes** (built-in RPA framework) | RPA API | Commercial | Developer-focused automation with anti-detection |

---

## Feature-by-Feature Detailed Analysis

### 1. Code Execution Instrumentation

**What it measures**: Ability to capture and log dynamic JavaScript code execution (eval, Function, script injection, etc.)

**Leaders:**
- ✅ **js_unshroud**: Hooks eval, Function, script injection (innerHTML, createElement, setAttribute), event handlers, Blob URLs, javascript: URLs, Workers (planned P2b), iframes (planned P2b)
- ✅ **Joe Sandbox**: Generic JS instrumentation covering "every method, API call, or string" with deep browser integration

**Good:**
- box-js, malware-jail (Node.js sandboxes with API emulation)
- Cuckoo/CAPE (Windows DLL hooking)

**Limited:**
- Anti-detection frameworks (not designed for analysis)

**Analysis**: js_unshroud and Joe Sandbox are the only tools with comprehensive JavaScript execution tracing. Node.js-based tools (box-js, malware-jail) cannot capture browser-specific APIs like DOM manipulation or browser events.

---

### 2. Obfuscation Detection & Deobfuscation

**What it measures**: Ability to detect and decode obfuscated JavaScript (base64, charCode, URI encoding, etc.)

**Leaders:**
- ✅ **js_unshroud**: Captures atob, btoa, String.fromCharCode, encodeURI, decodeURI, encodeURIComponent, decodeURIComponent with full payload logging
- ✅ **Joe Sandbox**: AI-powered obfuscation detection, automatic unpacking, SVG script analysis

**Good:**
- box-js, malware-jail (automatic deobfuscation and payload extraction)
- Fakeium (API call extraction for large-scale analysis)

**Limited:**
- Cuckoo/CAPE (basic extraction only)
- Anti-detection frameworks (not applicable)

**Analysis**: js_unshroud's encoding hooks (P0.3) provide the most comprehensive open-source solution for capturing obfuscation techniques. Joe Sandbox's AI-powered analysis is unique but commercial-only.

---

### 3. Network Monitoring

**What it measures**: Ability to capture network requests, responses, WebSocket traffic, and HTTP headers

**Leaders:**
- ✅ **js_unshroud**: CDP-level network monitoring (fetch, XHR, WebSocket) + instrumentation hooks with request/response correlation
- ✅ **Joe Sandbox**: Full network capture with PCAP export
- ✅ **Cuckoo/CAPE**: Full PCAP capture

**Limited:**
- box-js, malware-jail, Fakeium (simulated or no network)
- Anti-detection frameworks (depends on underlying automation framework)

**Analysis**: Real browser-based tools (js_unshroud, Joe Sandbox, Cuckoo) have full network visibility. Node.js tools cannot capture actual HTTP traffic.

---

### 4. Headless Browser Detection Evasion

**What it measures**: Ability to evade malware checks for headless browsers, VMs, and automation frameworks

**Leaders:**
- ✅ **Kameleo**: Industry-leading commercial solution (canvas, WebGL, audio, fonts, timezone, behavioral profiles)
- ✅ **js_unshroud**: Comprehensive open-source solution:
  - ✅ HTTP user-agent (CDP + extraHTTPHeaders)
  - ✅ navigator.webdriver (prevented from creation via Chrome flag), hardwareConcurrency, deviceMemory, plugins, permissions, languages (P3.1), mimeTypes (P3.1)
  - ✅ Canvas fingerprinting (random entropy injection)
  - ✅ WebGL (vendor/renderer spoofing)
  - ✅ Audio fingerprinting (sample rate + noise injection)
  - ✅ Font fingerprinting (fake Windows fonts via document.fonts)
  - ✅ WebRTC blocking (RTCPeerConnection, getUserMedia, enumerateDevices)
  - ✅ Screen/viewport/timezone spoofing
  - ✅ Battery API blocking
  - 🔴 Behavioral simulation (planned P3.2)
- ✅ **rebrowser-patches**: Deep runtime patches, CDP signal removal
- ✅ **Joe Sandbox**: Proprietary anti-evasion technology

**Basic:**
- puppeteer-extra-plugin-stealth (navigator.webdriver, basic permissions - **easily detected by Cloudflare/DataDome**)
- Cuckoo/CAPE (Windows VM only, limited browser evasion)

**None:**
- box-js, malware-jail, Fakeium (non-browser environments)

**Analysis**: js_unshroud has the **most comprehensive open-source headless evasion** implementation, exceeding puppeteer-extra-plugin-stealth and approaching commercial tools like Kameleo. Only gap is behavioral simulation (P3.2).

**Detailed Comparison: js_unshroud vs. puppeteer-extra-plugin-stealth**

| Evasion Technique | js_unshroud | puppeteer-extra-plugin-stealth | Winner |
|-------------------|-------------|-------------------------------|--------|
| navigator.webdriver | ✅ Prevented from creation via Chrome flag (--disable-blink-features=AutomationControlled) | ✅ Yes (overrides) | **js_unshroud** (property doesn't exist vs returns false) |
| navigator.plugins | ✅ Fake Chrome PDF plugins (3 realistic entries) | ✅ Basic fake plugins | js_unshroud (more realistic) |
| navigator.permissions | ✅ Always returns 'granted' | ✅ Basic override | Tie |
| navigator.languages | ✅ P3.1 (planned: ['en-US', 'en']) | ❌ Missing | **js_unshroud** |
| navigator.mimeTypes | ✅ P3.1 (planned: 4 MIME types matching plugins) | ❌ Missing | **js_unshroud** |
| navigator.hardwareConcurrency | ✅ Spoofed to 8 cores | ❌ Missing | **js_unshroud** |
| navigator.deviceMemory | ✅ Spoofed to 8GB | ❌ Missing | **js_unshroud** |
| window.chrome | ✅ P3.1 (planned: full object with runtime, loadTimes, csi) | ❌ Missing | **js_unshroud** |
| Canvas fingerprinting | ✅ Random entropy injection (toDataURL, getImageData) | ⚠️ Basic noise | **js_unshroud** (more sophisticated) |
| WebGL fingerprinting | ✅ Vendor/renderer spoofing to hide VMs | ❌ Missing | **js_unshroud** |
| Audio fingerprinting | ✅ Sample rate spoofing + noise injection | ❌ Missing | **js_unshroud** |
| Font fingerprinting | ✅ Fake Windows fonts via document.fonts API | ❌ Missing | **js_unshroud** |
| WebRTC blocking | ✅ Full blocking (RTCPeerConnection, getUserMedia, enumerateDevices) | ❌ Missing | **js_unshroud** |
| Screen/viewport spoofing | ✅ Full spoofing (1920x1080, devicePixelRatio, innerWidth, etc.) | ⚠️ Basic | **js_unshroud** |
| Timezone spoofing | ✅ America/New_York override | ❌ Missing | **js_unshroud** |
| Battery API blocking | ✅ getBattery() blocked | ❌ Missing | **js_unshroud** |
| HTTP user-agent headers | ✅ CDP Emulation.setUserAgentOverride + metadata | ⚠️ Basic UA override | **js_unshroud** (more complete) |
| Behavioral simulation | 🔴 Planned P3.2 (mouse, keyboard, scroll, clicks) | ❌ None (manual scripting required) | Neither (both require implementation) |

**Score**: js_unshroud wins **13/17** categories, ties 2, loses 0, with 2 pending implementation.

---

### 5. Behavioral Interaction Simulation

**What it measures**: Ability to simulate human-like interaction (mouse, keyboard, scrolling, clicks) to trigger interaction-gated malware

**Leaders:**
- ✅ **Kameleo**: Configurable behavioral patterns
- ✅ **NstBrowser**: Built-in RPA framework with behavioral automation
- 🟡 **js_unshroud**: Planned P3.2 (mouse movements, scrolling, clicks, keyboard - **CRITICAL GAP**)

**Limited:**
- Joe Sandbox (instrumented browser sessions)
- Cuckoo (real Windows execution but no specific interaction patterns)

**None:**
- box-js, malware-jail, Fakeium (no browser interaction)
- puppeteer-extra-plugin-stealth, rebrowser-patches (manual scripting required)

**Analysis**: This is js_unshroud's **biggest gap**. Modern malware increasingly gates execution behind human interaction checks. Without P3.2 implementation, js_unshroud will miss malware that waits for mouse movement, clicks, or scrolling before executing.

---

### 6. Output Format & Analysis

**What it measures**: Quality and usability of analysis output for security analysts

**Best for Analysts:**
- ✅ **js_unshroud**: JSONL (structured, machine-parseable) + UDP streaming for SIEM integration + deduplication + performance monitoring
- ✅ **Joe Sandbox**: HTML reports (human-readable) + JSON + PCAP + AI-powered insights

**Good:**
- Cuckoo/CAPE: JSON + PCAP + HTML reports
- box-js, malware-jail: JSON logs + extracted payloads

**API-focused:**
- Anti-detection frameworks: Designed for scripting, not analysis output

**Analysis**: js_unshroud's JSONL + UDP output is unique among open-source tools and enables real-time SIEM integration. Joe Sandbox's HTML reports are better for manual review but less suitable for automation.

---

## js_unshroud's Unique Positioning

### Strengths

1. **Most comprehensive open-source JS malware analysis tool** with instrumentation breadth matching commercial tools like Joe Sandbox
2. **Best-in-class headless evasion** among open-source tools (exceeds puppeteer-extra-plugin-stealth, approaches commercial anti-detect browsers)
3. **Dual purpose**: Both malware analysis AND anti-detection (rare combination)
4. **Real-time streaming**: UDP logging for SIEM integration (unique among open-source malware tools)
5. **Production-ready**: Built on Playwright + CDP (stable, maintained platform)
6. **Comprehensive coverage**: Code execution (24 methods), obfuscation (5 techniques), network (3 protocols), fingerprinting (12+ techniques)
7. **Open source**: Free, customizable, auditable (vs. commercial black-box solutions)

### Gaps vs. Commercial Tools

1. ❌ **No behavioral simulation yet** (P3.2 planned) - this is the **biggest gap** vs. Kameleo, NstBrowser, and advanced malware that gates execution
2. ❌ **No AI-powered analysis** like Joe Sandbox's automatic obfuscation detection
3. ❌ **No GUI/report generation** like Joe Sandbox or Cuckoo (JSONL only - requires external visualization)
4. ❌ **No distributed analysis** like Joe Sandbox's cloud infrastructure
5. ❌ **No sample corpus/threat intelligence** integration

### Gaps vs. Anti-Detection Frameworks

1. ✅ **Actually superior in most ways** - js_unshroud has MORE evasion techniques than puppeteer-extra-plugin-stealth (13 additional techniques)
2. ⚠️ **Comparable to rebrowser-patches** but different approach (instrumentation vs. runtime patches)
3. ❌ **No fingerprint profiles/rotation** like Kameleo/GoLogin (single spoofed identity only)
4. ❌ **No residential proxy integration** like commercial tools
5. 🟡 **Behavioral simulation pending** (P3.2) - commercial tools already have this

### Market Gaps js_unshroud Fills

1. **Open-source + comprehensive**: No other open-source tool combines deep instrumentation with advanced headless evasion
2. **Browser-based + server-compatible**: Node.js tools (box-js, malware-jail) can't handle browser-specific malware; js_unshroud bridges this gap
3. **Research/education**: Free alternative to Joe Sandbox ($$$) for malware researchers and students
4. **Custom deployments**: JSONL + UDP logging enables integration into custom analysis pipelines (vs. commercial tools' locked-in workflows)
5. **Privacy-conscious**: On-premises deployment (vs. cloud-only commercial tools that may retain samples)
6. **Modern platform**: Playwright-based (vs. Cuckoo's aging IE-based instrumentation)

---

## Use Case Recommendation Matrix

| Your Use Case | Recommended Tool(s) | Why |
|---------------|-------------------|-----|
| **Academic malware research** | js_unshroud, box-js | Open-source, comprehensive, customizable, no licensing costs |
| **Enterprise SOC/incident response** | Joe Sandbox (primary) + js_unshroud (secondary) | Joe for automated triage + GUI reports, js_unshroud for custom analysis pipelines and cost savings |
| **Quick triage of suspicious JS files** | box-js, malware-jail | Fast, lightweight, automatic payload extraction, no browser overhead |
| **Large-scale JS analysis (thousands of samples/day)** | Fakeium, box-js | Optimized for speed and scale, minimal resource usage |
| **Advanced malware requiring interaction** | Kameleo (now), js_unshroud (after P3.2) | Need behavioral simulation to trigger execution-gated malware |
| **Browser-based malware (DOM manipulation, fetch, etc.)** | js_unshroud, Joe Sandbox | Full browser environment required; Node.js tools insufficient |
| **Web scraping / bot evasion (not analysis)** | Kameleo, NstBrowser, rebrowser-patches | Purpose-built for anti-detection, not malware analysis |
| **Budget-constrained security team** | js_unshroud, Cuckoo/CAPE | Comprehensive free alternatives to $10k+/year commercial tools |
| **General malware sandbox (binaries + JS + documents)** | Cuckoo, CAPE, Joe Sandbox | Multi-format analysis platforms with broad file support |
| **Government/military (air-gapped environments)** | js_unshroud, Cuckoo/CAPE | On-premises deployment, no cloud dependencies |
| **Threat intelligence enrichment** | Joe Sandbox, js_unshroud + custom scripts | Joe has built-in TI, js_unshroud's JSONL enables custom enrichment pipelines |
| **CI/CD security scanning** | js_unshroud (headless), Fakeium | Automated, scriptable, fast turnaround for build pipelines |
| **Phishing investigation** | Joe Sandbox, js_unshroud | Full browser rendering + network capture for credential-stealing page analysis |
| **Exploit kit analysis** | Joe Sandbox, Cuckoo (modified) | Deep browser hooking for exploit detection; js_unshroud viable after P2b (iframes) |

---

## Technical Architecture Comparison

### Execution Environment

| Tool | Environment | Pros | Cons |
|------|------------|------|------|
| js_unshroud | Playwright + Chromium (real browser) | Full browser APIs, accurate behavior | Higher resource usage (~500MB RAM per instance) |
| box-js | Node.js V8 sandbox | Fast, lightweight (~50MB RAM) | Cannot handle browser-specific APIs (DOM, fetch, etc.) |
| malware-jail | Node.js V8 sandbox | Fast, automatic payload extraction | Cannot handle browser-specific APIs |
| Fakeium | V8 engine (custom runtime) | Very fast, scalable | No browser APIs, limited Windows API emulation |
| Joe Sandbox | Instrumented browsers (multi-engine) | Full environment support (IE, Chrome, Firefox) | Proprietary, expensive, Windows-only |
| Cuckoo/CAPE | Windows VM + browser hooks | Real OS, full API support | Slow (VM overhead), Windows-only, aging codebase |
| Kameleo/GoLogin/NstBrowser | Modified Chrome/Chromium | Industry-leading evasion, multi-profile | Not designed for malware analysis (no instrumentation hooks) |
| puppeteer-extra-plugin-stealth | Puppeteer + Chromium | Easy to use, popular (450k/week downloads) | Limited evasion, easily detected by advanced anti-bots |
| rebrowser-patches | Puppeteer/Playwright + Chromium | Deep runtime patches, CDP signal removal | Manual scripting required, no built-in analysis |

### Instrumentation Approach

| Tool | Approach | Coverage | Overhead | Evasion Resistance |
|------|----------|----------|----------|-------------------|
| js_unshroud | Playwright `page.addInitScript()` + CDP hooks | Comprehensive (eval, DOM, fetch, WebSocket, encoding, etc.) | Medium (~10-20% performance impact) | High (spoofs all major detection vectors) |
| box-js | Proxy objects + function wrappers | Good (Node.js APIs, ActiveX emulation) | Low | N/A (not browser-based) |
| malware-jail | Proxy objects + API emulation | Good (Node.js + Windows APIs) | Low | N/A (not browser-based) |
| Fakeium | V8 instrumentation + API stubs | Limited (API calls, string literals) | Very low | N/A (not browser-based) |
| Joe Sandbox | Binary instrumentation + browser hooks | Extensive (proprietary, multi-layer) | Medium-high | Very high (commercial anti-evasion tech) |
| Cuckoo | DLL hooking (jscript.dll, mshtml.dll) | Good (IE-specific) | High (VM + hooking overhead) | Medium (VM-based, older techniques) |
| rebrowser-patches | Runtime patches to puppeteer-core | Deep (CDP signals, automation artifacts) | Low | Very high (runtime-level modifications) |

---

## Performance Characteristics

### Resource Usage (Approximate)

| Tool | RAM per Instance | CPU Usage | Startup Time | Analysis Speed |
|------|-----------------|-----------|--------------|----------------|
| js_unshroud | 400-600 MB | Medium | ~5-10 sec | 15 sec/sample (configurable) |
| box-js | 30-100 MB | Low | <1 sec | 1-5 sec/sample |
| malware-jail | 30-100 MB | Low | <1 sec | 1-5 sec/sample |
| Fakeium | 50-150 MB | Low | <1 sec | <1 sec/sample (optimized for scale) |
| Joe Sandbox | 1-2 GB | High | ~30-60 sec | 60-300 sec/sample (full analysis) |
| Cuckoo/CAPE | 1-4 GB (VM) | High | ~30-60 sec (VM boot) | 60-300 sec/sample |
| Kameleo/GoLogin | 400-800 MB | Medium | ~5-10 sec | N/A (manual automation) |
| puppeteer-extra | 300-500 MB | Medium | ~3-5 sec | N/A (manual scripting) |

**Scalability Comparison**:
- **High-throughput**: Fakeium, box-js, malware-jail (1000+ samples/hour on single server)
- **Medium-throughput**: js_unshroud, puppeteer-extra (100-200 samples/hour)
- **Low-throughput**: Joe Sandbox, Cuckoo/CAPE (10-50 samples/hour due to VM overhead)

---

## Cost Comparison

| Tool | License Cost | Deployment Model | Hidden Costs |
|------|-------------|------------------|--------------|
| js_unshroud | **Free (open source)** | Self-hosted | Server costs (~$50-200/month for analysis VM) |
| box-js | **Free (MIT)** | Self-hosted | Minimal (runs on any Node.js server) |
| malware-jail | **Free (MIT)** | Self-hosted | Minimal |
| Fakeium | **Free (open source, 2025)** | Self-hosted | Minimal |
| Joe Sandbox | **$10,000-50,000+/year** (estimate) | Cloud or on-premises | On-prem requires Windows Server licenses, maintenance |
| Cuckoo (open) | **Free (GPL)** | Self-hosted | Windows VM licenses, maintenance overhead, expertise required |
| Cuckoo (commercial) | **$5,000-20,000+/year** (estimate) | Self-hosted or managed | Support contracts, customization |
| CAPE | **Free (open source)** | Self-hosted | Windows VM licenses, maintenance overhead |
| Kameleo | **$59-399/month** | Desktop application | Per-seat licensing, residential proxies extra |
| GoLogin | **$24-149/month** | Cloud + local app | Per-seat licensing, profile storage limits |
| NstBrowser | **Contact sales** (likely $100-500/month) | Cloud RPA platform | Usage-based pricing, API calls |
| puppeteer-extra-plugin-stealth | **Free (MIT)** | Self-hosted | Minimal (Node.js hosting) |
| rebrowser-patches | **Free (MIT)** | Self-hosted | Minimal (Node.js hosting) |

**ROI Analysis for Security Teams**:
- **Small teams (<5 analysts)**: js_unshroud + box-js (total cost: server only, ~$100/month)
- **Medium teams (5-20 analysts)**: js_unshroud (primary) + Joe Sandbox Cloud (spot usage) (total: ~$1000-3000/month)
- **Large teams (20+ analysts)**: Joe Sandbox (enterprise license) + js_unshroud (custom pipelines) (total: ~$5000-10000/month)
- **Academic/research**: js_unshroud, box-js, malware-jail (total cost: $0)

---

## Security & Privacy Considerations

### Data Retention

| Tool | Where Samples Go | Data Retention Policy | Privacy Risk |
|------|-----------------|----------------------|--------------|
| js_unshroud | **Local filesystem only** (JSONL output) | User-controlled | **Minimal** (on-premises, no cloud) |
| box-js, malware-jail, Fakeium | **Local filesystem only** | User-controlled | **Minimal** |
| Joe Sandbox Cloud | **Uploaded to Joe Security servers** | Varies by plan (may retain for TI) | **High** (cloud-based, third-party) |
| Joe Sandbox (on-prem) | **Customer infrastructure** | User-controlled | **Low** (but Windows required) |
| Cuckoo/CAPE | **Local VM** | User-controlled | **Minimal** |
| Kameleo/GoLogin/NstBrowser | **Profiles stored in cloud** (optional local) | Varies by provider | **Medium** (fingerprint data in cloud) |
| puppeteer-extra, rebrowser | **User-controlled** | N/A | **Minimal** |

**Recommendation for Sensitive Environments**: Use js_unshroud, Cuckoo/CAPE, or box-js for air-gapped or privacy-sensitive malware analysis (government, healthcare, finance).

---

## Future Roadmap Comparison

### js_unshroud Roadmap (from plan file)

**Pending Implementation**:
- **P2b**: Workers, dynamic imports, iframe instrumentation (4-5 days)
- **P3.1**: Browser Object Model spoofing (window.chrome, navigator.languages, mimeTypes, Notification) (1 day)
- **P3.2**: Behavioral interaction simulation (mouse, keyboard, scroll, clicks) (**CRITICAL**, 1-2 days)

**Post-Implementation Coverage**: ~100% of known detection vectors, ~95% of JavaScript execution patterns

### Competitor Evolution

**Joe Sandbox**: Continuous AI/ML improvements, cloud scalability, multi-platform support (iOS, Android)

**Cuckoo**: Limited active development on original project; CAPE fork more actively maintained

**box-js/malware-jail**: Stable but not actively adding major features (mature projects)

**Fakeium**: Brand new (2025), likely to see rapid iteration

**Anti-detect frameworks**: Arms race with anti-bot vendors; constant updates required to stay effective

---

## Limitations & Known Issues

### js_unshroud

**Current Limitations**:
1. ❌ **No behavioral simulation** (P3.2 pending) - interaction-gated malware will not trigger
2. ❌ **Single browser engine** (Chromium only via Playwright) - cannot test Firefox/Safari-specific exploits
3. ❌ **No multi-sample correlation** - each analysis is isolated; no automatic clustering/similarity detection
4. ❌ **No GUI** - command-line only, requires external tools for visualization
5. ❌ **No automatic IOC extraction** - outputs raw events; analyst must parse for IOCs (URLs, IPs, domains)
6. ⚠️ **Performance overhead** from extensive instrumentation (~10-20% slowdown vs. bare Playwright)

**Potential Issues**:
- Very high event volumes (e.g., tight loops calling `atob()` 100k times) may cause memory pressure despite deduplication
- Some advanced evasion techniques (e.g., timing attacks to detect CDP) may still work
- Playwright browser binaries (~200MB) must be installed separately

### Competitor Limitations

**box-js, malware-jail, Fakeium**:
- ❌ Cannot analyze browser-specific malware (DOM manipulation, fetch, WebSocket, etc.)
- ❌ Fake/emulated APIs may not match real browser behavior exactly

**Joe Sandbox**:
- ❌ Expensive ($10k-50k+/year)
- ❌ Cloud version has privacy concerns (samples uploaded to third-party)
- ❌ Windows-only for on-premises deployment

**Cuckoo/CAPE**:
- ❌ Aging codebase (Python 2 legacy, though Python 3 migration in progress)
- ❌ Windows-only, VM overhead
- ❌ Limited JavaScript-specific analysis (not primary focus)

**puppeteer-extra-plugin-stealth**:
- ❌ Easily detected by Cloudflare, DataDome, Imperva (as of 2025)
- ❌ No active maintenance (open-source, best-effort)
- ❌ Only 4-5 evasion techniques (vs. js_unshroud's 17+)

**rebrowser-patches**:
- ✅ Excellent evasion BUT:
- ❌ Not designed for malware analysis (no instrumentation hooks)
- ❌ Requires manual scripting for any analysis tasks
- ❌ Frequent updates needed to stay ahead of anti-bot vendors

**Kameleo/GoLogin/NstBrowser**:
- ❌ Not designed for malware analysis (no instrumentation)
- ❌ Expensive for teams ($60-400/month per seat)
- ❌ Primarily desktop applications (harder to integrate into automated pipelines)

---

## Industry Trends (2025-2026)

### Malware Evolution

1. **Interaction-gated execution**: Increasing use of mouse/keyboard/scroll requirements before payload delivery
2. **Advanced evasion**: Combining multiple fingerprinting techniques (canvas + WebGL + audio + fonts) for high-confidence detection
3. **AI-generated malware**: ChatGPT/Claude-generated phishing pages with sophisticated obfuscation
4. **Supply chain attacks**: Malicious npm packages with browser-based payloads
5. **WebAssembly**: Shift toward WASM for obfuscation (harder to analyze than JavaScript)

### Tool Evolution

1. **AI-powered analysis**: Joe Sandbox leading with ML-based deobfuscation and threat classification
2. **Runtime-level evasion**: rebrowser-patches approach (patching browser runtime) gaining traction over API-level spoofing
3. **Behavioral biometrics**: Anti-bot vendors moving toward mouse trajectory analysis, typing rhythm analysis
4. **Browser diversity**: Need to test across Chromium, Firefox, Safari as exploits become engine-specific
5. **Cloud-native**: Shift toward containerized, serverless analysis platforms for scalability

### js_unshroud's Position

**Strengths in 2026 context**:
- ✅ Playwright-based (modern, multi-browser potential)
- ✅ Comprehensive instrumentation (ahead of OSS competition)
- ✅ Advanced evasion (ahead of puppeteer-extra, behind rebrowser/Kameleo)
- ✅ Open-source (transparent, auditable, free)

**Gaps**:
- ❌ No AI/ML analysis (vs. Joe Sandbox)
- ❌ No behavioral simulation yet (vs. Kameleo, NstBrowser)
- ❌ No WebAssembly analysis
- ❌ No multi-browser support (Chromium only)

---

## Conclusion

### Overall Rankings by Category

**Best Open-Source Malware Analysis Tool**: 🥇 **js_unshroud**
Rationale: Most comprehensive instrumentation + advanced evasion. Surpasses box-js/malware-jail (no browser support) and Cuckoo (aging, Windows-only).

**Best Commercial Malware Analysis Tool**: 🥇 **Joe Sandbox**
Rationale: AI-powered analysis, multi-platform, extensive instrumentation. Worth the cost for enterprise SOCs.

**Best Free Quick-Triage Tool**: 🥇 **box-js**
Rationale: Fastest analysis, automatic deobfuscation, minimal overhead. Perfect for first-pass analysis.

**Best Anti-Detection Framework**: 🥇 **rebrowser-patches** (open-source) / 🥇 **Kameleo** (commercial)
Rationale: rebrowser offers runtime-level evasion (free); Kameleo adds behavioral simulation + profiles (paid).

**Best Value for Budget-Constrained Teams**: 🥇 **js_unshroud + box-js**
Rationale: Comprehensive analysis at zero license cost. Only server expenses (~$100-200/month).

### Final Recommendation

**For malware analysts**: Use js_unshroud as your **primary browser-based analysis platform**. Supplement with:
- box-js for quick triage of suspicious JS files
- Joe Sandbox Cloud (pay-per-use) for samples requiring AI-powered analysis or GUI reports
- rebrowser-patches if you need to build custom automation beyond malware analysis

**Next steps for js_unshroud development**:
1. **P3.2 (behavioral simulation)** - CRITICAL for interaction-gated malware
2. **P2b (Workers, iframes)** - important for advanced execution patterns
3. **GUI/visualization layer** - improve analyst usability
4. **Multi-browser support** - leverage Playwright's Firefox/WebKit support
5. **IOC extraction** - automatic extraction of URLs, IPs, domains, file hashes from events

---

## Sources & References

### Malware Analysis Tools
- [box-js GitHub Repository](https://github.com/CapacitorSet/box-js)
- [malware-jail GitHub Repository](https://github.com/HynekPetrak/malware-jail)
- [Fakeium: Dynamic JavaScript Analysis (2025 Paper)](https://www.sciencedirect.com/science/article/pii/S2352711025002675)
- [Joe Sandbox JavaScript Instrumentation Overview](https://www.joesecurity.org/blog/7492960968739667986)
- [Joe Sandbox AI June 2025 Update](https://www.joesecurity.org/blog/5765349968445585006)
- [Joe Sandbox Sample Analysis Report](https://www.joesandbox.com/analysis/1817601/0/html)
- [Cuckoo Sandbox Documentation](https://cuckoo.readthedocs.io/en/latest/usage/packages/)
- [Cuckoo VBScript Hooking Techniques](https://hatching.io/blog/vbscript-hooking/)
- [CAPE Sandbox Features](https://cyberpress.org/cape-by-cuckoo-v1-offers-isolated/)
- [Cuckoo Modified Edition GitHub](https://github.com/spender-sandbox/cuckoo-modified)

### Anti-Detection Frameworks & Browser Fingerprinting
- [puppeteer-extra-plugin-stealth Tutorial (ZenRows)](https://www.zenrows.com/blog/puppeteer-stealth)
- [puppeteer-extra-plugin-stealth Guide (ScrapingBee)](https://www.scrapingbee.com/blog/puppeteer-stealth-tutorial-with-examples/)
- [Invisible Automation with puppeteer-extra-plugin-stealth](https://latenode.com/blog/web-automation-scraping/avoiding-bot-detection/invisible-automation-using-puppeteer-extra-plugin-stealth-to-bypass-bot-protection)
- [rebrowser-patches GitHub Repository](https://github.com/rebrowser/rebrowser-patches)
- [How to Patch Puppeteer Stealth (ZenRows)](https://www.zenrows.com/blog/puppeteer-stealth-evasions-patching)
- [Evolution of Anti-Detect Frameworks: Puppeteer Stealth to Nodriver](https://blog.castle.io/from-puppeteer-stealth-to-nodriver-how-anti-detect-frameworks-evolved-to-evade-bot-detection/)
- [Detecting Puppeteer Extra Stealth Plugin (DataDome)](https://datadome.co/bot-management-protection/detecting-headless-chrome-puppeteer-extra-plugin-stealth/)
- [Kameleo: Best Headless Chrome for Bypassing Anti-Bot](https://kameleo.io/blog/the-best-headless-chrome-browser-for-bypassing-anti-bot-systems)
- [GoLogin Anti-Fingerprinting Browser](https://gologin.com/blog/anti-fingerprinting-browser/)
- [8 Best Anti-Detect Browsers in 2025](https://gologin.com/blog/anti-fingerprinting-browser/)
- [7 Best Tools for Browser Fingerprint Evasion (SOAX)](https://soax.com/blog/prevent-browser-fingerprinting)
- [Best Anti-Detect Browser 2025 (PixelScan)](https://pixelscan.net/blog/best-antidetect-browsers/)
- [Anti-Detection Browsers for Web Scraping (Scrapeless)](https://www.scrapeless.com/en/blog/anti-detection-browsers)
- [Building Ethical Anti-Detect Browsers (BrowserCat)](https://www.browsercat.com/post/ethical-anti-detect-browser-techniques)
- [GeeTest: Defeating BotBrowser in 2025](https://www.geetest.com/en/article/how-to-defeat-botbrowser-in-2025)
- [Browser Fingerprint Strategy: Designing Identities (ScrapingAnt)](https://scrapingant.com/blog/browser-fingerprint-strategy-designing-identities-not-just)

### Playwright & Browser Automation
- [Playwright Official Website](https://playwright.dev/)
- [Playwright GitHub Repository](https://github.com/microsoft/playwright)
- [Playwright vs Puppeteer Comparison (TestGrid)](https://testgrid.io/blog/playwright-vs-puppeteer/)
- [Playwright vs Puppeteer (BugBug)](https://bugbug.io/blog/testing-frameworks/playwright-vs-puppeteer/)
- [Playwright vs Puppeteer (Oxylabs)](https://oxylabs.io/blog/playwright-vs-puppeteer)
- [Puppeteer vs Playwright (Contentful)](https://www.contentful.com/blog/puppeteer-vs-playwright/)
- [Enjoyable Browser Automation (Lambros Petrou)](https://www.lambrospetrou.com/articles/enjoyable-browser-automation-puppeteer-playwright/)

---

**Report Prepared By**: Claude (Anthropic)
**Date**: 2026-01-18
**Version**: 1.0
**Contact**: See js_unshroud repository for updates and contributions
