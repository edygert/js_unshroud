# Research Paper Outline: A Comprehensive Instrumentation Methodology for Analyzing Evasive JavaScript Malware

## I. Abstract (1 page)
- The malware analysis challenge: modern JavaScript malware uses evasion, interaction-gating, and time delays
- Existing tools fail to observe complete behavior due to detection and incomplete instrumentation
- We present a multi-layer methodology combining pre-execution instrumentation, headless evasion, and behavioral simulation
- Evaluation on known malware samples demonstrates capture of behaviors missed by existing approaches
- Target: deep forensic analysis in isolated malware analysis environments

## II. Introduction & Problem Statement (1.5 pages)

### A. The Modern JavaScript Malware Landscape
- Evolution of web-based threats: ClickFix (47% of 2025 attacks), Magecart, credential harvesters
- Three defensive techniques used by malware:
  1. Headless browser detection (navigator.webdriver, fingerprinting)
  2. Interaction-gating (payloads only execute after user clicks/form submission)
  3. Time-delayed execution (60s+ delays to evade sandboxes)

### B. Gaps in Existing Analysis Approaches
- Browser DevTools: manual, no automation, easily detected
- Basic automation (Puppeteer/Playwright): trivially detected via navigator.webdriver
- Post-load instrumentation: misses early execution behaviors
- Passive observation: fails to trigger interaction-gated payloads
- Commercial sandboxes: opaque, limited customization for forensic investigation

### C. Threat Model & Research Scope
- Target: individual malware sample analysis in isolated VM environments
- Analyst-driven forensic investigation (not automated triage)
- Goal: complete behavioral observation, not high-throughput scanning
- Assumption: analyst has sample to investigate, needs comprehensive event trace

## III. Research Questions (0.5 pages)

**RQ1**: Can pre-execution instrumentation capture JavaScript behaviors that post-load instrumentation approaches miss?

**RQ2**: Does behavioral simulation effectively trigger interaction-gated malware payloads that passive observation misses?

**RQ3**: Can multi-layer headless evasion enable observation of detection-aware malware without altering execution behavior?

**RQ4**: What API instrumentation coverage is necessary to achieve complete behavioral observation of modern JavaScript malware?

## IV. Methodology: Multi-Layer Instrumentation Architecture (2.5 pages)

### A. Pre-Execution Instrumentation Design
- **Critical timing requirement**: Instrumentation must be in place BEFORE any page JavaScript executes
- **Implementation approach**: Playwright `page.addInitScript()` for hook injection
- **Logging bridge**: Browser-to-Node.js event transport via `page.exposeFunction()`
- **Why this matters**: Captures initial script execution, early eval() calls, Service Worker registration

### B. Multi-Protocol Event Capture
- **Chrome DevTools Protocol (CDP)**: Low-level browser events (network, console, errors)
- **JavaScript Proxy-based hooks**: API call interception (fetch, storage, crypto)
- **Complementary coverage**: CDP for browser internals, Proxies for JavaScript APIs
- **Event correlation**: Correlation IDs link related events (request → response → storage)

### C. Comprehensive API Coverage
Instrumentation targets across malware behavior spectrum:
- **Code execution**: eval(), Function(), Web Workers, dynamic script injection
- **Network communication**: fetch, XMLHttpRequest, WebSocket, Service Workers
- **Data persistence**: localStorage, sessionStorage, IndexedDB, cookies
- **Encoding/obfuscation**: atob/btoa, String.fromCharCode, CryptoJS (AES/DES/RC4)
- **Fingerprinting detection**: Canvas/WebGL, Audio, fonts, screen dimensions
- **DOM manipulation**: innerHTML, createElement, setAttribute, event listeners

### D. Event Filtering for Forensic Analysis
- **Signal preservation**: 100% malware-relevant event capture
- **Noise reduction**: Filter benign UI events (mouse moves, page lifecycle)
- **Smart filtering**: Always log addEventListener (malware indicator), filter eventFired (noise)
- **Empirical results**: 60-70% noise reduction on benign sites while preserving malware signals

## V. Methodology: Multi-Layer Headless Evasion (2 pages)

### A. Why Evasion Is Necessary for Research Validity
- Malware that detects headless browsers alters or suppresses behavior
- Observing true malicious behavior requires bypassing detection
- Not about "being stealthy" - about obtaining accurate measurements

### B. Protocol-Level Spoofing
- **CDP user-agent override**: `Emulation.setUserAgentOverride()` before navigation
- **HTTP header manipulation**: User-agent metadata (brands, platform, architecture)
- **Browser launch flags**: `--disable-blink-features=AutomationControlled`

### C. JavaScript Property Spoofing
- **Navigator object overrides**: webdriver, hardwareConcurrency, deviceMemory, plugins, mimeTypes
- **Browser Object Model (BOM)**: window.chrome, Notification API, permissions
- **Screen/viewport dimensions**: Configurable realistic values

### D. Fingerprinting Countermeasures
- **Canvas fingerprinting**: Controlled entropy injection (configurable noise level)
- **WebGL spoofing**: Vendor/renderer string override
- **Audio fingerprinting**: Sample rate spoofing, OfflineAudioContext noise injection
- **Font enumeration**: Fake font list matching spoofed OS
- **API blocking**: WebRTC, Battery API (common detection vectors)

### E. Configurable Profile System
- 4 built-in profiles: Windows/Chrome, macOS/Safari, Linux/Firefox, Android/Chrome
- Deep merge configuration for partial overrides
- Validation layer ensures consistency (screen size ↔ mobile flag, timezone coherence)

## VI. Methodology: Behavioral Interaction Simulation (1.5 pages)

### A. Interaction-Gated Malware Problem
- ClickFix attacks require user clicks on overlays
- Form-based harvesters activate on submission
- Magecart skimmers hook payment form interactions
- Time-delayed malware requires extended dwell time

### B. Simulation Techniques
- **Mouse movement**: Bezier-like trajectories simulating human cursor paths
- **Scrolling**: Realistic viewport scrolling patterns
- **Smart form interaction**:
  - Context-aware field value generation (email, phone, credit card patterns)
  - Honeypot field avoidance (hidden/display:none fields)
  - Focus → type → blur event sequences
- **Click targeting**: Interactive element detection (buttons, links, form controls)
- **Keyboard simulation**: Tab navigation, arrow keys, Enter presses

### C. Phased Interaction Strategy
- **Phase 1 (0-30s)**: Initial page exploration, mouse movement, scrolling
- **Phase 2 (30-60s)**: Form field interaction, value population
- **Phase 3 (60s+)**: Form submission, extended dwell time
- Configurable intensity levels (low/medium/high) for different investigation scenarios

### D. Research Validity Consideration
- Simulation enables observation of otherwise hidden behaviors
- Not about "executing all malware" - about triggering interaction gates
- Analyst can disable simulation if investigating non-interactive malware

## VII. Evaluation (3 pages)

### A. Dataset
- **Malware samples**: Known ClickFix, Magecart, credential harvesters, time-delayed malware
- **Ground truth sources**: Public malware reports, IOC databases, manual reverse engineering
- **Sample selection criteria**: Documented use of evasion or interaction-gating
- **Size and time window**: [To be determined based on actual evaluation]

### B. Comparison Baseline
- **Browser DevTools**: Manual inspection, network tab, console
- **Basic Playwright**: Standard automation without evasion or simulation
- **Metrics compared**: Event capture completeness, payload trigger success

### C. Evaluation Metrics

**RQ1 - Pre-Execution Instrumentation Completeness**:
- Comparison: Events captured at t=0 vs. post-load instrumentation
- Hypothesis: Pre-execution captures Service Worker registration, early eval(), initial script injection
- Measurement: % of malware samples where early-execution behaviors are observed

**RQ2 - Interaction Trigger Effectiveness**:
- Comparison: Passive observation vs. behavioral simulation on interaction-gated samples
- Hypothesis: Simulation triggers payloads that passive observation misses
- Measurement: % of interaction-gated samples where payload executes
- Validation: Comparison against ground truth expected behaviors

**RQ3 - Headless Evasion Success**:
- Comparison: Behavior observed with vs. without evasion on detection-aware samples
- Hypothesis: Evasion enables observation of true malicious behavior
- Measurement: % of detection-aware samples where expected malicious behavior is captured
- Validation: Comparison of event traces (altered behavior vs. true behavior)

**RQ4 - API Coverage Completeness**:
- Analysis: Which instrumented APIs are invoked by malware samples
- Hypothesis: Comprehensive coverage captures diverse malware techniques
- Measurement: Coverage map of API calls across sample corpus
- Findings: Which APIs are most commonly used by malware families

### D. Observed Behavioral Patterns (Validation Examples)

Examples demonstrating methodology effectiveness:

1. **ClickFix Pattern**:
   - Expected: Overlay DOM creation → clipboard API → user click → external download
   - Observed: Timeline showing event sequence captured via DOM + clipboard + network instrumentation
   - Validation: Matches documented ClickFix behavior from threat reports

2. **Credential Harvesting Pattern**:
   - Expected: Form field monitoring → input capture → localStorage → network POST
   - Observed: addEventListener on password field → storage write → fetch with encoded payload
   - Validation: Correlation of storage write timestamp with network request

3. **Magecart Skimming Pattern**:
   - Expected: Payment form detection → submission hook → credit card exfiltration
   - Observed: Form interaction triggers hidden event handler → encoded network beacon
   - Validation: Behavioral simulation required to trigger (passive observation failed)

4. **Time-Delayed Execution Pattern**:
   - Expected: setTimeout(60s+) → eval() → network callback
   - Observed: Timer event → code execution event → network event at 60s+ offset
   - Validation: Extended monitoring window captures delayed payload

### E. What Existing Tools Missed
- Analysis of same malware samples with DevTools and basic Playwright
- Documented gaps: early execution events, interaction-gated payloads, altered behavior under detection
- Quantification: % of malicious behaviors only observable with complete methodology

## VIII. Limitations & Threats to Validity (1 page)

### A. Evasion Arms Race
- Fingerprinting techniques evolve continuously
- Statistical timing analysis could detect simulation
- Future detection vectors (GPU fingerprinting, etc.)
- Limitation: No evasion is perfect or permanent

### B. Environmental Dependencies
- Requires Chromium browser (not Firefox, Safari)
- VM environment assumptions (isolated network, snapshot capability)
- Resource requirements (headless Chromium + full instrumentation)

### C. Behavioral Simulation Limitations
- Simulation patterns may be detectable by advanced malware
- Not all interaction gates can be automatically triggered
- Analyst judgment still required for unusual samples

### D. Scope Constraints
- Single-page analysis (no multi-page crawling)
- Focus on JavaScript malware (not WASM, native plugins)
- Not designed for high-throughput scanning (per-sample focus)

### E. Validation Constraints
- Ground truth for novel/unknown malware is difficult
- Reliance on public malware reports for validation
- Sample corpus may not represent all malware families

## IX. Future Work (0.5 pages)

### A. Adaptation for Automated Triage
- Performance optimization for high-throughput scanning
- Selective instrumentation based on sample characteristics
- Distributed analysis architecture

### B. Enhanced Evasion Techniques
- GPU fingerprinting countermeasures
- Timing attack mitigation
- Advanced entropy modeling

### C. Multi-Page Analysis
- Crawling capabilities for site-wide profiling
- Cross-page correlation of behaviors
- Session persistence and state management

### D. Machine Learning Integration
- Automated malware family classification from event streams
- Anomaly detection for novel attack patterns
- Behavioral clustering

## X. Related Work (0.5 pages)
- Browser automation and headless detection
- JavaScript instrumentation approaches
- Malware analysis sandboxes and dynamic analysis tools
- Fingerprinting and anti-fingerprinting techniques

## XI. Conclusion (0.5 pages)
- Summary of methodology contributions
- Validation that comprehensive instrumentation + evasion + simulation enables complete observation
- Impact on malware forensic analysis workflow
- Open-source availability for research community

## XII. References (0.5 pages)

---

## Appendices (Supplementary Material)

### Appendix A: Complete Event Schema
- Event type definitions (network, storage, console, encoding, etc.)
- Example JSONL event outputs
- Correlation ID structure

### Appendix B: Instrumentation Implementation Details
- Hook injection code examples
- Logging bridge architecture
- Performance monitoring and deduplication

### Appendix C: Headless Profile Specifications
- Windows/Chrome profile parameter values
- macOS/Safari profile parameter values
- Linux/Firefox profile parameter values
- Android/Chrome profile parameter values
- Configuration override syntax

### Appendix D: Tool Usage and Availability
- CLI command reference
- Configuration file format
- Query and correlation capabilities
- Open-source repository location

---

**Estimated Length: 8-10 pages main body + 4-6 pages appendices**

**Research Framing:**
- **What we contribute**: A comprehensive methodology for observing evasive malware
- **What we evaluate**: Does the methodology capture behaviors that existing approaches miss?
- **What we validate**: Observed behaviors match ground truth on known malware samples
- **What we enable**: Deep forensic investigation of individual samples in isolated environments
