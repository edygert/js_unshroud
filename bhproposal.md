# Black Hat USA 2026 – Conference Proposal

## Title

**The Invisible Analyst: JavaScript Malware Analysis via Headless Browser Evasion** [file:18]

---

## Executive Summary

Modern JavaScript malware aggressively fingerprints its environment to detect sandboxes, virtual machines, and automation frameworks, causing traditional analysis pipelines to miss the most evasive campaigns.[file:18] Security teams urgently need an analysis platform that can both evade these checks and capture complete behavioral traces at scale.[file:18]

This presentation introduces **js_unshroud**, an open-source JavaScript malware analysis platform that combines deep browser-level instrumentation with a comprehensive set of headless browser evasion techniques.[file:18] Built on Playwright and Chrome DevTools Protocol (CDP), it operates entirely at the JavaScript layer, remaining transparent to common anti-analysis checks while recording execution, obfuscation, and network behavior in detail.[file:18]

Unlike existing open-source tools that either lack a full browser environment or provide only basic stealth, js_unshroud integrates 24+ execution hooks, 5+ obfuscation detectors, and extensive network monitoring with 17+ fingerprinting countermeasures and realistic behavioral simulation.[file:18] The result is an analysis pipeline capable of processing large volumes of evasive web malware samples with throughput significantly higher than VM-based approaches, and with coverage comparable to commercial anti-detect solutions.[file:18]

Attendees will leave with a deployable, open-source platform for evasive JavaScript malware analysis, a practical taxonomy of browser fingerprinting techniques and countermeasures, and architectural patterns they can reuse in their own tooling.[file:18]

---

## Public Abstract (for conference website)

JavaScript has become the primary vehicle for phishing kits, browser exploit chains, and web-based credential theft—but the most dangerous samples simply refuse to run under analysis.[file:18] When they detect headless browsers, VMs, or automation frameworks, they quietly exit, leaving security teams blind to their behavior.[file:18]

This session presents **js_unshroud**, an open-source platform that turns the tables on evasive JavaScript malware.[file:18] By combining comprehensive browser-level instrumentation with advanced headless detection evasion and realistic user interaction simulation, js_unshroud captures full behavioral traces from samples that defeat popular sandboxes and stealth plugins.[file:18]

Through live demos, attendees will see evasive phishing kits and multi-stage loaders fail in traditional environments but fully execute under js_unshroud, with every step of execution, deobfuscation, and command-and-control communication recorded.[file:18] Participants will gain a reusable architecture and concrete implementation techniques to build or enhance their own headless-resistant analysis pipelines.[file:18]

---

## Detailed Description (~500 words)

JavaScript-centric threats—phishing kits, credential stealers, browser-based miners, and exploit kits—routinely incorporate environment detection to evade analysis.[file:18] They probe navigator properties, canvas/WebGL output, audio and font fingerprints, user interaction patterns, and more, terminating or degrading behavior as soon as they detect a sandbox, VM, or headless browser.[file:18] This creates a critical blind spot for malware analysts, SOC teams, and researchers attempting to understand and mitigate active campaigns.[file:18]

**js_unshroud** addresses this problem with a dual-layer architecture that simultaneously focuses on visibility and stealth.[file:18] The instrumentation layer uses Playwright and Chrome DevTools Protocol (CDP) to hook 24+ JavaScript execution surfaces—including `eval`, `Function`, DOM sinks such as `innerHTML` and `createElement`, event handlers, Web Workers, iframes, Blob URLs, and `javascript:` URLs—while tracking at least five common obfuscation patterns such as `atob`/`btoa`, `String.fromCharCode`, and URI encoding/decoding.[file:18] All major browser-side network APIs (`fetch`, `XMLHttpRequest`, `WebSocket`) are instrumented with request/response correlation, allowing complete end-to-end view of the malware lifecycle from initial loader to command-and-control.[file:18]

In parallel, the evasion layer implements 17+ countermeasures targeting real-world fingerprinting toolchains and anti-bot systems.[file:18] These include navigator and client hint spoofing, canvas entropy injection, WebGL vendor/renderer spoofing, audio fingerprint randomization, font list manipulation, WebRTC IP leak prevention, and realistic desktop screen/timezone profiles.[file:18] A behavioral simulation component generates human-like mouse movements, scrolling, and interaction timing based on stochastic models, defeating interaction-gated malware that waits for convincing user behavior before executing.[file:18]

A logging bridge connects the browser context to a Node.js backend using a JSONL-based event stream and UDP forwarding, enabling analysts to feed execution traces directly into SIEMs and other telemetry pipelines.[file:18] Performance optimizations such as event deduplication and payload truncation allow js_unshroud to process on the order of 100–200 samples per hour per instance, with significantly lower memory requirements than VM-based sandboxes.[file:18]

Through empirical testing against open-source fingerprinting frameworks (e.g., FingerprintJS, CreepJS) and commercial anti-bot solutions, js_unshroud achieves a level of stealth comparable to popular commercial anti-detect browsers, while remaining tailored to defensive analysis use cases.[file:18] The talk will compare its capabilities against existing open-source tools (Cuckoo, CAPE, box-js, malware-jail, puppeteer-extra) and, where possible, against representative commercial analysis platforms.[file:18]

The session will walk through the architecture, showcase live side-by-side demos versus traditional environments, and discuss deployment patterns for SOCs, CERTs, and research labs.[file:18] Ethical use and limitations will be explicitly addressed, including appropriate authorization for red-team usage and realistic boundaries of the evasion techniques.[file:18]

---

## Outline (45 minutes)

1. **Context: Why JS Malware Beats Sandboxes (5 min)**  
   - Current JS malware landscape (phishing kits, exploit kits, interaction-gated loaders).[file:18]  
   - How common sandboxes and headless setups are detected and bypassed.[file:18]  

2. **Architecture Overview (10 min)**  
   - Dual-layer design: instrumentation layer + evasion/behavior layer.[file:18]  
   - Logging bridge and integration into existing analysis pipelines.[file:18]  

3. **Instrumentation Deep Dive (10 min)**  
   - Execution hooks (24+ surfaces) and obfuscation capture.[file:18]  
   - Network tracing, payload truncation, and throughput/performance data.[file:18]  

4. **Evasion & Behavioral Simulation Deep Dive (10 min)**  
   - Fingerprinting countermeasures against canvas/WebGL/audio/fonts/navigator/WebRTC.[file:18]  
   - Generating realistic user interaction and defeating interaction-gated malware.[file:18]  

5. **Live Demos & Comparative Results (8 min)**  
   - Side-by-side runs vs. a standard headless setup and at least one open-source/commercial tool.[file:18]  
   - Example multi-stage attack walkthrough with full trace.[file:18]  

6. **Takeaways, Deployment & Q&A (2 min)**  
   - How to deploy js_unshroud in SOC/research environments.[file:18]  
   - Future work: WebAssembly obfuscation, advanced behavioral fingerprints, and research directions.[file:18]  

---

## Audience Takeaways

By the end of the session, attendees will be able to: [file:18]

1. **Deploy** an evasion-resistant JavaScript malware analysis environment using the open-source js_unshroud platform.  
2. **Recognize** at least 17 browser fingerprinting vectors used by modern malware and apply practical countermeasures at the browser layer.  
3. **Instrument** browser-based execution paths (DOM sinks, Workers, network APIs) to capture complete attack lifecycles.  
4. **Integrate** JSONL/UDP-based logging into SOC/SIEM pipelines for large-scale analysis of web-based threats.  
5. **Evaluate** trade-offs between browser-level and OS-level instrumentation, and between headless and VM-based approaches for their own environments.  

---

## Novelty and Prior Art

This work is positioned relative to: [file:18]

- Open-source analysis frameworks such as Cuckoo/CAPE, box-js, and malware-jail (limited browser support or weaker evasion capabilities).  
- Automation frameworks and stealth plugins (e.g., puppeteer-extra-plugin-stealth) that provide basic anti-detection but lack deep instrumentation and SOC-ready integrations.  
- Commercial anti-detect browsers and analysis platforms that offer strong stealth but are closed-source and not designed primarily for defensive malware analysis.  

**What is new in this talk:** [file:18]

- A unified architecture that combines browser-level instrumentation and a broad set of headless evasion techniques specifically for malware analysis.  
- A practical, open-source implementation with demonstrated throughput and integration into enterprise telemetry pipelines.  
- Systematic empirical evaluation of fingerprinting/evasion techniques focused on defensive analysis outcomes rather than generic automation.  

---

## Target Audience

- Malware analysts and reverse engineers working with phishing kits and web-based threats.[file:18]  
- SOC and incident response teams needing visibility into evasive JavaScript malware.  
- Security researchers focusing on browser fingerprinting, evasion, and analysis tooling.  
- Tool developers and red teams (for authorized testing) who require headless-resistant execution environments.  

---

## Presenter Information

- **Presenter Name:** `[[PRESENTER NAME]]`  
- **Title / Role:** `[[PRESENTER TITLE/ROLE]]`  
- **Organization:** `[[ORGANIZATION]]`  
- **Contact Email:** `[[CONTACT EMAIL]]`  
- **Contact Phone:** `[[CONTACT PHONE]]`  
- **Links (optional):** `[[LinkedIn]]`, `[[X/Twitter]]`, `[[GitHub]]`  

**Relevant Experience (for bio):**  
`[[1–2 sentences on malware analysis / browser security / tool-building background, including prior talks if any]]`  

---

## Logistics and Materials

- **Session Format:** 45-minute Briefing (technical deep dive) with live demonstrations and Q&A.[file:18]  
- **Primary Category:** Briefings (Technical Deep-Dive)  
- **Secondary Category:** Arsenal (Tool Demonstration)  
- **Suggested Tags:** Malware Analysis, Browser Security, Evasion Techniques, Open Source Tools, Threat Intelligence, Incident Response  

**Demonstration Requirements:** [file:18]  
- HDMI-compatible laptop.  
- Reliable internet connection (with pre-recorded backup demos).  
- Curated corpus of evasive JavaScript malware samples suitable for safe demonstration.  

**Open Source Release:**  
- Full source code, documentation, and deployment guides published on GitHub prior to the conference.[file:18]  
- Optional: pre-built VM or container image for attendees.[file:18]  

---

## Placeholders to Fill

- `[[PRESENTER NAME]]`  
- `[[PRESENTER TITLE/ROLE]]`  
- `[[ORGANIZATION]]`  
- `[[CONTACT EMAIL]]`  
- `[[CONTACT PHONE]]`  
- `[[LinkedIn]]`, `[[X/Twitter]]`, `[[GitHub]]`  
- `[[1–2 sentences on relevant experience and prior research/talks]]`  

You can also optionally add concrete, anonymized metrics under the performance and “real-world impact” parts (e.g., “N samples across M families, with X% successful full-trace execution”) once you have them.

