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
    enableCodeExecution: true,   // Critical for malware analysis - instruments eval, Function, etc.
    enableEncoding: true,         // Critical for malware analysis - instruments atob, fromCharCode, URI encoding
    dedupeWindowMs: 100,          // Short window to reduce noise from tight loops
    maxPayloadSize: 2051,         // Captures first 1024 + "..." + last 1024 chars for code/encoding output
    maxStackDepth: 20,
    enableDeduplication: true,
    // Monitoring configuration
    monitoringTimeoutSeconds: 15, // Default 15 seconds - increase for slow-loading malware samples
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
        enableEncoding: config.enableEncoding
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

  if (scripts.dom) {
    await page.addInitScript({ content: scripts.dom });
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
    // Wait for events to be captured
    await page.waitForTimeout(monitoringDurationMs);
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
