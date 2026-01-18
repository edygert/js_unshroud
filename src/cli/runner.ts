#!/usr/bin/env bun

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { readFileSync } from 'fs';
import { EventLogger } from '../orchestrator/EventLogger.ts';
import { CDPSessionManager } from '../orchestrator/CDPSessionManager.ts';
import type { SessionConfig, InstrumentationConfig } from '../schema/types.ts';
import { validateEvent } from '../schema/events.ts';

// Declare setTimeout for linting purposes
declare const setTimeout: (handler: () => void, timeout?: number) => number;

// Timeout constants (in milliseconds)
const TIMEOUTS = {
  PAGE_NAVIGATION: 60_000,
  BROWSER_CLOSE: 8_000,
  EVENT_LOGGER_CLOSE: 2_000,
  INSTRUMENTATION_LOAD: 5_000,
  MONITORING_DURATION: 15_000
} as const;

interface Args {
  url: string;
  out: string;
  config?: string | undefined;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let url: string | undefined, out: string | undefined, config: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url') {
      const nextArg = args[i + 1];
      if (nextArg) {
        url = nextArg;
        i++;
      }
    } else if (args[i] === '--out') {
      const nextArg = args[i + 1];
      if (nextArg) {
        out = nextArg;
        i++;
      }
    } else if (args[i] === '--config') {
      const nextArg = args[i + 1];
      if (nextArg) {
        config = nextArg;
        i++;
      }
    }
  }

  if (!url || !out) {
    console.error('Usage: js_unshroud run --url <url> --out <output.jsonl> [--config <config.json>]');
    process.exit(1);
  }

  return { url, out, config };  
}

function loadInstrumentationConfig(configPath?: string): InstrumentationConfig {
  const defaultConfig: InstrumentationConfig = {
    enableConsole: true,
    enableNetwork: true,
    enableStorage: true,
    enableWebSocket: true,
    enableTimer: false,
    enableError: true,
    enableDOM: false,
    enableFingerprinting: false,
    enableObjectTracking: false,
    enableHeadlessMitigation: false,
    enableServiceWorker: false,
    enableCodeExecution: true,    // Critical for malware analysis - instruments eval, Function, etc.
    enableEncoding: true,          // Critical for malware analysis - instruments atob, fromCharCode, URI encoding
    enableCryptoJS: true,          // Critical for malware analysis - instruments CryptoJS library (AES, DES, etc.)
    enableEventHandlers: false,    // Instruments event handler property assignments (element.onclick = ...)
    enableBlobTracking: false,     // Instruments Blob creation and URL.createObjectURL/revokeObjectURL
    enableURLExecution: false,     // Instruments javascript: URL execution (location.href, anchor.href, etc.)
    enableWorkers: false,          // Instruments Web Workers and SharedWorkers (creation and messaging)
    enableModules: false,          // Instruments ES module <script type="module"> injection
    enableIframes: false,          // Instruments iframe creation and srcdoc injection
    dedupeWindowMs: 100,           // Short window to reduce noise from tight loops
    maxPayloadSize: 2051,         // Captures first 1024 + "..." + last 1024 chars for code/encoding output
    maxStackDepth: 20,
    enableDeduplication: true,
    // Monitoring configuration
    monitoringTimeoutSeconds: 15, // Default 15 seconds - increase for slow-loading malware samples
    // Behavioral simulation (P3.2) - Defeats interaction-gated malware
    enableBehaviorSimulation: false, // Enable when enableHeadlessMitigation is true
    behaviorSimulationIntensity: 'medium',
    enableFormInteraction: true,
    enableCheckoutSimulation: true,
    enableTimeDelayedBehavior: true,
    // Output configuration
    outputMode: 'file',
    udpLogging: {
      enabled: false,
      host: '127.0.0.1',
      port: 514  // Default syslog port
    }
  };

  if (!configPath) {
    return defaultConfig;
  }

  try {
    const configContent = readFileSync(configPath, 'utf-8');
    const userConfig = JSON.parse(configContent) as Partial<InstrumentationConfig>;
    return { ...defaultConfig, ...userConfig };
  } catch {
    console.warn(`Failed to load config from ${configPath}, using defaults`);
    return defaultConfig;
  }
}

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function createSessionConfig(args: Args): SessionConfig {
  const sessionId = generateSessionId();
  return {
    id: sessionId,
    url: args.url,
    startTime: Date.now(),
    outputPath: args.out,
    configPath: args.config
  };
}

function loadInstrumentationScripts(config: InstrumentationConfig): {
  bootstrap: string;
  network: string | null;
  storage: string | null;
  timer: string | null;
  dom: string | null;
  fingerprinting: string | null;
  objectTracking: string | null;
  headlessMitigation: string | null;
  serviceWorker: string | null;
  codeExecution: string | null;
  encoding: string | null;
  cryptojs: string | null;
  eventHandler: string | null;
  blobTracking: string | null;
  urlExecution: string | null;
  worker: string | null;
  module: string | null;
  iframe: string | null;
  performanceMonitor: string;
} {
  const bootstrapScript = readFileSync('./src/instrumentation/bootstrap.js', 'utf-8');
  const networkScript = readFileSync('./src/instrumentation/network-hooks.js', 'utf-8');
  const storageScript = readFileSync('./src/instrumentation/storage-hooks.js', 'utf-8');
  const timerScript = readFileSync('./src/instrumentation/timer-hooks.js', 'utf-8');
  const domScript = readFileSync('./src/instrumentation/dom-hooks.js', 'utf-8');
  const fingerprintingScript = readFileSync('./src/instrumentation/fingerprinting-hooks.js', 'utf-8');
  const objectTrackingScript = readFileSync('./src/instrumentation/object-tracking.js', 'utf-8');
  const headlessMitigationScript = readFileSync('./src/instrumentation/headless-mitigation.js', 'utf-8');
  const serviceWorkerScript = readFileSync('./src/instrumentation/service-worker-hooks.js', 'utf-8');
  const codeExecutionScript = readFileSync('./src/instrumentation/code-execution-hooks.js', 'utf-8');
  const encodingScript = readFileSync('./src/instrumentation/encoding-hooks.js', 'utf-8');
  const cryptojsScript = readFileSync('./src/instrumentation/cryptojs-hooks.js', 'utf-8');
  const eventHandlerScript = readFileSync('./src/instrumentation/event-handler-hooks.js', 'utf-8');
  const blobTrackingScript = readFileSync('./src/instrumentation/blob-hooks.js', 'utf-8');
  const urlExecutionScript = readFileSync('./src/instrumentation/url-execution-hooks.js', 'utf-8');
  const workerScript = readFileSync('./src/instrumentation/worker-hooks.js', 'utf-8');
  const moduleScript = readFileSync('./src/instrumentation/module-hooks.js', 'utf-8');
  const iframeScript = readFileSync('./src/instrumentation/iframe-hooks.js', 'utf-8');
  const performanceMonitorScript = readFileSync('./src/instrumentation/performance-monitor.js', 'utf-8');

  return {
    bootstrap: bootstrapScript,
    network: config.enableNetwork ? networkScript : null,
    storage: config.enableStorage ? storageScript : null,
    timer: config.enableTimer ? timerScript : null,
    dom: config.enableDOM ? domScript : null,
    fingerprinting: config.enableFingerprinting ? fingerprintingScript : null,
    objectTracking: config.enableObjectTracking ? objectTrackingScript : null,
    headlessMitigation: config.enableHeadlessMitigation ? headlessMitigationScript : null,
    serviceWorker: config.enableServiceWorker ? serviceWorkerScript : null,
    codeExecution: config.enableCodeExecution ? codeExecutionScript : null,
    encoding: config.enableEncoding ? encodingScript : null,
    cryptojs: config.enableCryptoJS ? cryptojsScript : null,
    eventHandler: config.enableEventHandlers ? eventHandlerScript : null,
    blobTracking: config.enableBlobTracking ? blobTrackingScript : null,
    urlExecution: config.enableURLExecution ? urlExecutionScript : null,
    worker: config.enableWorkers ? workerScript : null,
    module: config.enableModules ? moduleScript : null,
    iframe: config.enableIframes ? iframeScript : null,
    performanceMonitor: performanceMonitorScript // Always loaded for performance controls
  };
}

async function injectInstrumentation(
  page: Page,
  config: InstrumentationConfig,
  sessionId: string,
  eventLogger: EventLogger
): Promise<{
  bootstrap: string;
  network: string | null;
  storage: string | null;
  timer: string | null;
  dom: string | null;
  fingerprinting: string | null;
  objectTracking: string | null;
  headlessMitigation: string | null;
  serviceWorker: string | null;
  codeExecution: string | null;
  performanceMonitor: string;
}> {
  const scripts = loadInstrumentationScripts(config);

  // CRITICAL: Set up browser-to-Node.js logging bridge BEFORE bootstrap loads
  // This fixes the bug where instrumentation hooks were silent no-ops
  await page.exposeFunction('__playwright_log_event', async (eventJson: string) => {
    try {
      const event = JSON.parse(eventJson) as unknown;
      if (validateEvent(event)) {
        await eventLogger.logEvent(event);
      } else {
        console.warn('[JS Unshroud] Invalid event received from instrumentation:', eventJson.substring(0, 200));
      }
    } catch (error) {
      console.error('[JS Unshroud] Failed to parse instrumentation event:', error);
    }
  });

  // Install bridge connector BEFORE bootstrap loads
  // This overrides the silent no-op in bootstrap.js with a working implementation
  await page.addInitScript({
    content: `
      window.__js_unshroud_log = function(data) {
        if (window.__playwright_log_event) {
          window.__playwright_log_event(data).catch(function(err) {
            // Error handler - can't use console.log here due to recursion
          });
        }
      };
    `
  });

  // Inject bootstrap first
  await page.addInitScript({ content: scripts.bootstrap });

  // Set up config BEFORE performance monitor and other hooks
  await page.addInitScript({
    content: `
      window.__js_unshroud_config = ${JSON.stringify({
        dedupeWindowMs: config.dedupeWindowMs,
        maxPayloadSize: config.maxPayloadSize,
        maxStackDepth: config.maxStackDepth,
        enableDeduplication: config.enableDeduplication,
        enableServiceWorker: config.enableServiceWorker,
        enableCodeExecution: config.enableCodeExecution,
        enableEncoding: config.enableEncoding,
        enableEventHandlers: config.enableEventHandlers,
        enableBlobTracking: config.enableBlobTracking,
        enableURLExecution: config.enableURLExecution
      })};
      window.__js_unshroud_session_id = '${sessionId}';
    `
  });

  // CRITICAL: Inject performance monitor BEFORE timer hooks
  // Performance monitor wraps setTimeout/setInterval for performance warnings
  // Timer hooks will then wrap those to add instrumentation
  await page.addInitScript({ content: scripts.performanceMonitor });

  // CRITICAL: Inject code execution hooks BEFORE timer hooks
  // Timer hooks may detect setTimeout/setInterval string code execution
  // Code execution hooks must be loaded first to instrument eval/Function
  if (scripts.codeExecution) {
    await page.addInitScript({ content: scripts.codeExecution });
  }

  // Inject encoding hooks after code execution hooks
  // Encoding operations (atob, fromCharCode, etc.) are often used in malware obfuscation
  if (scripts.encoding) {
    await page.addInitScript({ content: scripts.encoding });
  }

  // Inject CryptoJS hooks after encoding hooks
  // CryptoJS is commonly used for malware payload encryption
  if (scripts.cryptojs) {
    await page.addInitScript({ content: scripts.cryptojs });
  }

  // Inject other scripts if enabled
  if (scripts.network) {
    await page.addInitScript({ content: scripts.network });
  }

  if (scripts.storage) {
    await page.addInitScript({ content: scripts.storage });
  }

  if (scripts.timer) {
    await page.addInitScript({ content: scripts.timer });
  }

  // Inject blob tracking BEFORE DOM hooks
  // DOM hooks may need to look up blob content when analyzing blob: URLs
  if (scripts.blobTracking) {
    await page.addInitScript({ content: scripts.blobTracking });
  }

  if (scripts.dom) {
    await page.addInitScript({ content: scripts.dom });
  }

  // Inject event handler hooks after DOM hooks
  // Tracks event handler property assignments (element.onclick = ...)
  if (scripts.eventHandler) {
    await page.addInitScript({ content: scripts.eventHandler });
  }

  // Inject URL execution hooks after event handler hooks
  // Tracks javascript: URL execution (location.href, anchor.href, etc.)
  if (scripts.urlExecution) {
    await page.addInitScript({ content: scripts.urlExecution });
  }

  // Inject worker hooks after URL execution hooks
  if (scripts.worker) {
    await page.addInitScript({ content: scripts.worker });
  }

  // Inject module hooks after worker hooks
  if (scripts.module) {
    await page.addInitScript({ content: scripts.module });
  }

  // Inject iframe hooks after module hooks
  if (scripts.iframe) {
    await page.addInitScript({ content: scripts.iframe });
  }

  if (scripts.fingerprinting) {
    await page.addInitScript({ content: scripts.fingerprinting });
  }

  if (scripts.objectTracking) {
    await page.addInitScript({ content: scripts.objectTracking });
  }

  if (scripts.headlessMitigation) {
    await page.addInitScript({ content: scripts.headlessMitigation });
  }

  if (scripts.serviceWorker) {
    await page.addInitScript({ content: scripts.serviceWorker });
  }

  return scripts;
}

async function performCleanup(browser: Browser, eventLogger: EventLogger): Promise<void> {
  console.log('Starting cleanup...');

  const cleanupPromises = [
    // Timeout wrapper for browser close
    Promise.race([
      (async () => {
        try {
          // Close pages first - these often fail if already closing, so ignore silently
          const pages = browser.contexts().flatMap((ctx: BrowserContext) => ctx.pages());
          await Promise.all(pages.map((page: Page) => page.close().catch(() => {})));

          // Then close contexts - also ignore common closing errors
          await Promise.all(browser.contexts().map((ctx: BrowserContext) => ctx.close().catch(() => {})));

          // Finally close browser
          await browser.close();
        } catch {
          // Fallback: try simple browser close, but don't warn on failure
          await browser.close().catch(() => {});
        }
      })().catch(() => {
        // Browser cleanup failure - don't warn as cleanup is best-effort
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Browser close timeout')), TIMEOUTS.BROWSER_CLOSE)
      )
    ]).catch(() => {
      // Browser cleanup timeout - cleanup is best-effort, don't warn
    }),

    // Timeout wrapper for event logger close
    Promise.race([
      eventLogger.close().catch(() => {
        // Event logger close failure - ignore as cleanup is best-effort
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Event logger close timeout')), TIMEOUTS.EVENT_LOGGER_CLOSE)
      )
    ]).catch(() => {
      // Event logger cleanup failure - cleanup is best-effort, don't warn
    })
  ];

  try {
    await Promise.allSettled(cleanupPromises);
    console.log('Cleanup completed.');
  } catch {
    // Some cleanup operations failed - cleanup is best-effort, no warning needed
  }
}

/**
 * Generate spoofed user agent to mask headless browser indicators.
 * Uses Windows to appear as the most common desktop platform.
 */
function generateSpoofedUserAgent(): string {
  return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.7499.4 Safari/537.36';
}

/**
 * Generate brand metadata for sec-ch-ua headers.
 * This controls what appears in the Client Hints headers.
 */
function generateBrandMetadata(): Array<{ brand: string; version: string }> {
  return [
    { brand: 'Chromium', version: '143' },
    { brand: 'Not A(Brand)', version: '24' },
    { brand: 'Google Chrome', version: '143' }
  ];
}

/**
 * Generate spoofed headers to mask headless browser indicators.
 * Note: User-Agent and sec-ch-ua are handled via CDP Emulation.setUserAgentOverride.
 * These headers serve as fallback for any subrequests.
 */
function generateSpoofedHeaders(): Record<string, string> {
  return {
    'Upgrade-Insecure-Requests': '1',
    'sec-ch-ua': '"Chromium";v="143", "Not A(Brand";v="24", "Google Chrome";v="143"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br'
  };
}

// ===== P3.2: Behavioral Interaction Simulation =====
// These functions simulate human-like interaction to defeat malware that gates execution
// behind interaction checks (ClickFix attacks, form submissions, checkout skimmers, etc.)

/**
 * Generate random number between min and max
 */
function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Simulate realistic mouse movement with bezier-like path
 */
async function simulateMouseMovement(page: Page, viewport: { width: number; height: number }): Promise<void> {
  const targetX = rand(0, viewport.width);
  const targetY = rand(0, viewport.height);
  const steps = Math.floor(rand(10, 30)); // Bezier-like path

  await page.mouse.move(targetX, targetY, { steps });
}

/**
 * Simulate scroll with random distance
 */
async function simulateScroll(page: Page): Promise<void> {
  const scrollDistance = rand(100, 500);
  await page.mouse.wheel(0, scrollDistance);
  await new Promise<void>(r => setTimeout(() => r(), rand(500, 1500)));
}

/**
 * Simulate click on random interactive element
 */
async function simulateRandomClick(page: Page): Promise<void> {
  try {
    const elements = await page.$$('button, a, input[type="button"], input[type="submit"]');
    if (elements.length > 0) {
      const randomEl = elements[Math.floor(Math.random() * elements.length)];
      if (randomEl) {
        const box = await randomEl.boundingBox();
        if (box) {
          const clickX = box.x + rand(5, box.width - 5);
          const clickY = box.y + rand(5, box.height - 5);
          await page.mouse.click(clickX, clickY);
        }
      }
    }
  } catch (error) {
    // Element may have been removed, ignore
  }
}

/**
 * Simulate keyboard input (Tab, arrows, Enter)
 */
async function simulateKeyboard(page: Page): Promise<void> {
  const keys = ['Tab', 'ArrowDown', 'ArrowUp', 'Enter'];
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  if (randomKey) {
    await page.keyboard.press(randomKey);
    await new Promise<void>(r => setTimeout(() => r(), rand(500, 1000)));
  }
}

/**
 * Generate realistic field value based on field type/name/placeholder
 */
function generateRealisticFieldValue(fieldInfo: {
  type: string;
  name: string;
  id: string;
  placeholder: string;
}): string {
  const fieldLower = `${fieldInfo.name} ${fieldInfo.id} ${fieldInfo.placeholder}`.toLowerCase();

  // Detect field purpose from name/id/placeholder
  if (fieldLower.includes('email')) return 'test.user@example.com';
  if (fieldLower.includes('phone') || fieldLower.includes('tel')) return '555-0123';
  if (fieldLower.includes('zip') || fieldLower.includes('postal')) return '12345';
  if (fieldLower.includes('card') || fieldLower.includes('credit')) return '4532123456789012';
  if (fieldLower.includes('cvv') || fieldLower.includes('cvc') || fieldLower.includes('security')) return '123';
  if (fieldLower.includes('expir') || fieldLower.includes('exp')) return '12/26';
  if (fieldLower.includes('first')) return 'John';
  if (fieldLower.includes('last')) return 'Doe';
  if (fieldLower.includes('user')) return 'testuser';
  if (fieldLower.includes('name')) return 'John Doe';
  if (fieldLower.includes('address') || fieldLower.includes('street')) return '123 Main St';
  if (fieldLower.includes('city')) return 'New York';
  if (fieldLower.includes('state')) return 'NY';
  if (fieldLower.includes('country')) return 'United States';

  // Type-based defaults
  if (fieldInfo.type === 'email') return 'test.user@example.com';
  if (fieldInfo.type === 'tel') return '555-0123';
  if (fieldInfo.type === 'number') return '42';
  if (fieldInfo.type === 'date') return '2026-01-18';
  if (fieldInfo.type === 'password') return 'TestPassword123!';
  if (fieldInfo.type === 'search') return 'test query';
  if (fieldInfo.type === 'url') return 'https://example.com';

  // Generic text
  return 'test input';
}

/**
 * Simulate form field interaction (focus, typing, blur)
 * Triggers focus/blur/input/change event listeners used by web skimmers
 */
async function simulateFormInteraction(page: Page): Promise<void> {
  try {
    // Detect all visible form fields (exclude hidden honeypots)
    const formFields = await page.$$eval('input:not([type="hidden"]), textarea, select', (elements) => {
      return elements
        .map((el, idx) => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          const isVisible =
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            parseFloat(style.opacity) >= 0.1 &&
            rect.width >= 1 &&
            rect.height >= 1;

          if (!isVisible) return null;

          const input = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
          return {
            idx,
            type: (input as HTMLInputElement).type || el.tagName.toLowerCase(),
            name: input.name || '',
            id: input.id || '',
            placeholder: (input as HTMLInputElement).placeholder || ''
          };
        })
        .filter(Boolean);
    });

    if (formFields.length === 0) return;

    // Interact with 30-50% of visible fields (realistic user behavior)
    const fieldsToFill = Math.floor(formFields.length * rand(0.3, 0.5));

    for (let i = 0; i < fieldsToFill; i++) {
      const fieldInfo = formFields[Math.floor(Math.random() * formFields.length)];
      if (!fieldInfo) continue;

      // Select the field
      const field = await page.$(`input:not([type="hidden"]), textarea, select`).then(async () => {
        const allFields = await page.$$('input:not([type="hidden"]), textarea, select');
        return allFields[fieldInfo.idx];
      });

      if (!field) continue;

      // Focus field (triggers focus listeners)
      await field.focus();
      await new Promise<void>(r => setTimeout(() => r(), rand(200, 500)));

      // Generate realistic value
      const value = generateRealisticFieldValue(fieldInfo);

      // Type character by character (triggers keypress/input listeners)
      for (const char of value) {
        await page.keyboard.type(char);
        await new Promise<void>(r => setTimeout(() => r(), rand(50, 150))); // Realistic typing speed
      }

      // Occasional backspace (realistic typos)
      if (Math.random() < 0.1) {
        await page.keyboard.press('Backspace');
        await new Promise<void>(r => setTimeout(() => r(), rand(100, 300)));
      }

      // Blur field (triggers blur/change listeners)
      await page.keyboard.press('Tab');
      await new Promise<void>(r => setTimeout(() => r(), rand(300, 800)));
    }
  } catch (error) {
    // Form may have changed during interaction, ignore
  }
}

/**
 * Simulate form submission
 * Triggers submit event listeners used by credential harvesters
 */
async function simulateFormSubmission(page: Page): Promise<void> {
  try {
    const forms = await page.$$('form');
    if (forms.length === 0) return;

    // Submit 1 form (realistic user behavior)
    const form = forms[Math.floor(Math.random() * forms.length)];
    if (!form) return;

    // Check if form has submit button
    const submitButton = await form.$('input[type="submit"], button[type="submit"], button:not([type])');

    if (submitButton) {
      // Wait before submitting (realistic user review time)
      await new Promise<void>(r => setTimeout(() => r(), rand(1000, 3000)));

      // Click submit button (triggers submit event, click listeners)
      await submitButton.click();

      // Wait for potential navigation/XHR
      await new Promise<void>(r => setTimeout(() => r(), rand(500, 1500)));
    }
  } catch (error) {
    // Form may have been submitted and page navigated, ignore
  }
}

/**
 * Simulate autofill trigger (password fields, hidden fields)
 * Triggers autofill exploits that exfiltrate credentials
 */
async function simulateAutofillTrigger(page: Page): Promise<void> {
  try {
    // Detect password fields (trigger password manager)
    const passwordFields = await page.$$('input[type="password"]');

    if (passwordFields.length > 0) {
      const pwField = passwordFields[0];
      if (pwField) {
        await pwField.focus();
        await new Promise<void>(r => setTimeout(() => r(), rand(300, 800)));

        // Type password (simulates autofill behavior)
        await pwField.type('TestPassword123!', { delay: 50 });

        // Find associated username/email field
        const usernameField = await page.$('input[type="email"], input[type="text"][name*="user"], input[type="text"][name*="email"], input[type="text"][autocomplete="username"]');
        if (usernameField) {
          await usernameField.focus();
          await usernameField.type('test.user@example.com', { delay: 50 });
        }
      }
    }

    // Trigger change events on hidden fields (simulates autofill population)
    await page.$$eval('input[type="hidden"]', (elements) => {
      elements.forEach((el) => {
        const input = el as HTMLInputElement;
        input.value = 'autofill-simulated-value';
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
  } catch (error) {
    // Password fields may not exist, ignore
  }
}

/**
 * Detect checkout page and simulate payment form interaction
 * Triggers Magecart/web skimmers that activate only on checkout pages
 */
async function detectAndSimulateCheckoutBehavior(page: Page): Promise<boolean> {
  try {
    const url = page.url();

    // Check if URL contains checkout keywords
    const isCheckoutPage = /checkout|payment|cart|onepage|billing/i.test(url);

    if (isCheckoutPage) {
      console.log('[JS Unshroud] Detected checkout page, simulating payment form interaction');

      // More aggressive form interaction on checkout pages
      await simulateFormInteraction(page);

      // Wait longer (users review purchase)
      await new Promise<void>(r => setTimeout(() => r(), rand(3000, 6000)));

      // Simulate card number field interaction
      const cardFields = await page.$$('input[name*="card"], input[placeholder*="card"], input[autocomplete="cc-number"]');
      for (const cardField of cardFields) {
        await cardField.focus();
        await cardField.type('4532123456789012', { delay: rand(80, 150) });
        await new Promise<void>(r => setTimeout(() => r(), rand(300, 600)));
      }

      // Simulate CVV field
      const cvvFields = await page.$$('input[name*="cvv"], input[name*="cvc"], input[autocomplete="cc-csc"]');
      for (const cvvField of cvvFields) {
        await cvvField.focus();
        await cvvField.type('123', { delay: rand(80, 150) });
        await new Promise<void>(r => setTimeout(() => r(), rand(300, 600)));
      }

      // Try to submit (triggers web skimmers)
      await simulateFormSubmission(page);

      return true;
    }

    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Main behavioral simulation function with time-delayed phased interaction
 * Phase 1 (0-30s): Minimal interaction (defeats basic bot detection)
 * Phase 2 (30-60s): Moderate interaction (simulates page reading)
 * Phase 3 (60s+): Full interaction (form filling, clicking, submitting)
 * This defeats time-bomb malware that waits before activating
 */
async function simulateBehavior(page: Page, config: InstrumentationConfig, durationMs: number): Promise<void> {
  if (!config.enableBehaviorSimulation) {
    // No behavioral simulation, just wait
    await page.waitForTimeout(durationMs);
    return;
  }

  const viewport = page.viewportSize() || { width: 1280, height: 720 };
  const startTime = Date.now();
  const intensity = config.behaviorSimulationIntensity || 'medium';
  const enableForms = config.enableFormInteraction !== false; // Default true
  const enableCheckout = config.enableCheckoutSimulation !== false; // Default true
  const enableTimeDelayed = config.enableTimeDelayedBehavior !== false; // Default true

  if (enableTimeDelayed) {
    // Phase 1: Initial 30s - Minimal interaction (defeats 1-minute delay malware)
    console.log('[JS Unshroud] Phase 1: Minimal interaction (0-30s)');
    while (Date.now() - startTime < 30000 && Date.now() < startTime + durationMs) {
      await simulateMouseMovement(page, viewport);
      await new Promise<void>(r => setTimeout(() => r(), rand(2000, 4000)));
    }

    // Phase 2: 30s-60s - Moderate interaction (reading page)
    console.log('[JS Unshroud] Phase 2: Moderate interaction (30-60s)');
    while (Date.now() - startTime < 60000 && Date.now() < startTime + durationMs) {
      await simulateMouseMovement(page, viewport);
      if (intensity !== 'low' && Math.random() < 0.3) await simulateScroll(page);
      await new Promise<void>(r => setTimeout(() => r(), rand(1500, 3000)));
    }

    // Phase 3: 60s+ - Full interaction
    console.log('[JS Unshroud] Phase 3: Full interaction (60s+)');
  }

  let lastFormInteraction = Date.now();
  let hasTriedCheckout = false;

  while (Date.now() < startTime + durationMs) {
    // Mouse movement (all intensities)
    await simulateMouseMovement(page, viewport);

    if (intensity !== 'low') {
      // Scroll (medium, high)
      if (Math.random() < 0.4) await simulateScroll(page);

      // Click (medium, high)
      if (Math.random() < 0.2) await simulateRandomClick(page);

      // Keyboard (medium, high)
      if (Math.random() < 0.15) await simulateKeyboard(page);
    }

    if (intensity === 'high' && enableForms) {
      // Form interaction every 10-20 seconds (high only)
      if (Date.now() - lastFormInteraction > rand(10000, 20000)) {
        await simulateFormInteraction(page);
        await simulateAutofillTrigger(page);
        lastFormInteraction = Date.now();
      }

      // Checkout detection (high only, once)
      if (enableCheckout && !hasTriedCheckout && Date.now() - startTime > 5000) {
        hasTriedCheckout = await detectAndSimulateCheckoutBehavior(page);
      }
    }

    await new Promise<void>(r => setTimeout(() => r(), rand(1000, 2000)));
  }
}

async function runMonitoring(args: Args): Promise<void> {
  const config = loadInstrumentationConfig(args.config);
  console.log(`Monitoring ${args.url}, outputting to ${args.out}`);
  const sessionConfig = createSessionConfig(args);
  const sessionId = sessionConfig.id;

  // Initialize event logger with UDP support
  const eventLogger = new EventLogger(
    sessionConfig,
    config.outputMode ?? 'file',
    config.udpLogging
  );

  // Generate spoofed values for headless mitigation
  const useHeadlessMitigation = config.enableHeadlessMitigation;
  const spoofedUserAgent = useHeadlessMitigation ? generateSpoofedUserAgent() : '';
  const spoofedHeaders = useHeadlessMitigation ? generateSpoofedHeaders() : {};
  const brandMetadata = useHeadlessMitigation ? generateBrandMetadata() : undefined;
  
  // Launch browser with headless mitigation settings
  const browser = await chromium.launch({ 
    headless: true,
    args: useHeadlessMitigation 
      ? ['--disable-blink-features=AutomationControlled']
      : []
  });
  
  // Create context with custom user agent and headers if headless mitigation is enabled
  const contextOptions = useHeadlessMitigation
    ? { 
        userAgent: spoofedUserAgent,
        extraHTTPHeaders: spoofedHeaders
      }
    : {};
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  // Initialize CDP session manager
  const cdpManager = new CDPSessionManager(page, eventLogger, sessionId);

  try {
    await cdpManager.initialize(page);

    // Apply header spoofing BEFORE navigation if headless mitigation is enabled
    if (config.enableHeadlessMitigation) {
      // Use CDP Emulation.setUserAgentOverride with brand metadata
      // This affects both network requests AND the navigator API
      // The userAgentMetadata parameter controls sec-ch-ua headers
      await cdpManager.setUserAgentOverride(spoofedUserAgent, 'Windows', brandMetadata);

      // Apply additional headers for subrequests (fallback)
      await page.setExtraHTTPHeaders(spoofedHeaders);

      // Remove webdriver property detection
      await page.addInitScript({
        content: `
          Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
            configurable: true
          });
        `
      });
    }

    await injectInstrumentation(page, config, sessionId, eventLogger);

    // Navigate to the URL
    console.log(`Navigating to ${args.url}...`);
    await page.goto(args.url, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUTS.PAGE_NAVIGATION
    });

    // Wait for instrumentation to load (only if bootstrap was injected)
    try {
      await page.waitForFunction(() => {
        return (globalThis as { __js_unshroud_loaded?: boolean }).__js_unshroud_loaded === true;
      }, {
        timeout: TIMEOUTS.INSTRUMENTATION_LOAD
      });
    } catch {
      console.log('Warning: Instrumentation load timeout (bootstrap may be disabled)');
    }

    const monitoringDurationMs = config.monitoringTimeoutSeconds * 1000;
    console.log(`Instrumentation loaded, monitoring for ${config.monitoringTimeoutSeconds} seconds...`);

    // Simulate human behavior if behavioral simulation is enabled
    // This defeats malware that gates execution behind interaction checks
    await simulateBehavior(page, config, monitoringDurationMs);

    console.log('Monitoring completed.');

  } catch (error) {
    console.error('Error during monitoring:', error);
    throw error; // Re-throw for main function to handle
  } finally {
    // Flush pending events before cleanup
    await cdpManager.flushPendingEvents();
    await cdpManager.disconnect();
    await performCleanup(browser, eventLogger);
  }
}

async function main() {
  const args = parseArgs();

  try {
    await runMonitoring(args);
  } catch (error) {
    console.error('Error during monitoring:', error);
  }
}

if (import.meta.main) {
  main()
    .then(() => {
      // Exit on successful completion
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

// Export functions for testing
export {
  parseArgs,
  loadInstrumentationConfig,
  generateSessionId,
  createSessionConfig,
  loadInstrumentationScripts,
  injectInstrumentation,
  performCleanup,
  runMonitoring,
  generateSpoofedUserAgent,
  generateBrandMetadata,
  generateSpoofedHeaders
};
