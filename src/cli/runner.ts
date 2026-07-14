#!/usr/bin/env bun

// playwright-core is loaded at runtime (see loadPlaywrightChromium) so the compiled
// binary does not bake an absolute build-machine path into require.resolve(). Only
// type information is imported statically here, which is erased at build time.
import type { Browser, BrowserContext, BrowserType, Page } from 'playwright-core';
import { readFileSync, existsSync, realpathSync } from 'fs';
import { dirname, join } from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { EventLogger } from '../orchestrator/EventLogger.ts';
import { CDPSessionManager } from '../orchestrator/CDPSessionManager.ts';
import { ArtifactCollector, type ArtifactConfig } from '../orchestrator/ArtifactCollector.ts';
import type { SessionConfig, InstrumentationConfig, HeadlessMitigationConfig, MonitoringEvent, PageSnapshotEvent } from '../schema/types.ts';
import { validateEvent, createEvent } from '../schema/events.ts';
import { resolveHeadlessMitigationConfig } from './headless-profiles.ts';
import { validateHeadlessMitigationConfig } from './validation.ts';

// Declare setTimeout for linting purposes
declare const setTimeout: (handler: () => void, timeout?: number) => number;

/**
 * Test Coverage Note:
 * This file has intentionally lower coverage (63%) than the project standard (80%) because:
 * - Behavioral simulation functions (lines 487-881) are non-deterministic and integration-tested
 * - Error handling branches are defensive silent failures
 * - Main entry point is tested manually in production
 * - Conditional script injection for disabled features is excluded
 *
 * Critical orchestration paths (CLI, config, session, instrumentation injection) have 95%+ coverage.
 */

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
  config?: string | Partial<InstrumentationConfig> | undefined;
}

const USAGE_LINES = [
  'Usage:',
  '  Run:       js_unshroud run --url <url> --out <output.jsonl> [--config <config.json>]',
  '  Analyze:   js_unshroud analyze --input <events.jsonl> [--format text|json|stats] [--output <file>]',
  '  Query:     js_unshroud query --input <events.jsonl> [FILTERS] [--format jsonl|count] [--output <file>]',
  '  Correlate: js_unshroud correlate --input <events.jsonl> [--rules-file <file>] [--rules <names>] [OPTIONS]'
];

function printUsage(stream: 'stdout' | 'stderr' = 'stdout'): void {
  const write = stream === 'stdout' ? console.log : console.error;
  for (const line of USAGE_LINES) write(line);
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
    printUsage('stderr');
    process.exit(1);
  }

  return { url, out, config };  
}

function loadInstrumentationConfig(configPath?: string | Partial<InstrumentationConfig>): InstrumentationConfig {
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
    enableClipboard: true,         // CRITICAL: ClickFix detection - instruments clipboard operations (47% of 2025 attacks)
    clipboardPatternDetection: true,  // Enable malicious pattern detection (PowerShell, MSHTA, Base64)
    enableDebuggerDetection: true, // Detects debugger statements via CDP - common anti-analysis technique
    enableDownloadDetection: true, // Detects file downloads via blob/data URLs and anchor elements
    maxPayloadSize: 2051,         // Captures first 1024 + "..." + last 1024 chars for code/encoding output
    maxStackDepth: 20,
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
    },
    // Artifact collection configuration (opt-in, disabled by default)
    enableArtifactCollection: false,
    artifactDirectory: './artifacts',
    artifactTypes: {
      pageSnapshot: true,
      downloads: true,
      codeExecution: true,
      encoding: true,
      cryptojs: true,
      clipboard: true,
      workers: true,
      iframes: true
    },
    maxArtifactSize: 10 * 1024 * 1024,  // 10MB default
    // Debug configuration
    debug: false,  // Suppress console output unless explicitly enabled
    // Event filtering configuration (P4.1) - Reduce noise during malware triage
    eventFiltering: {
      dom: {
        enableLoadEvents: false,           // Filter resource load noise (images, scripts, iframes)
        enableMouseEvents: false,           // Filter mouse tracking noise
        enablePageLifecycle: false,         // Filter navigation lifecycle noise
        enableInteractionEvents: false,     // Filter interaction event firings (addEventListener always logged)
        enableMutationEvents: false         // Filter DOM mutations (covered by script_injection events)
      },
      encoding: {
        enableAtobBtoa: false,             // Filter Base64 encoding/decoding (ubiquitous on benign sites)
        enableFromCharCode: true,           // Keep fromCharCode (common obfuscation technique)
        enableURIEncoding: false            // Filter URI encoding (benign noise)
      },
      clipboard: {
        enableReadOperations: false,        // Filter clipboard reads (rarely malicious)
        enableWriteOperations: true,        // CRITICAL: Always log clipboard writes (ClickFix detection)
        enableEvents: false                 // Filter copy/paste/cut DOM events (covered by writeText/execCommand)
      }
    }
  };

  if (!configPath) {
    return defaultConfig;
  }

  // If config is already an object (from tests), merge with defaults
  if (typeof configPath === 'object') {
    return { ...defaultConfig, ...configPath };
  }

  // Otherwise load from file path
  try {
    const configContent = readFileSync(configPath, 'utf-8');
    const userConfig = JSON.parse(configContent) as Partial<InstrumentationConfig>;
    return { ...defaultConfig, ...userConfig };
  } catch {
    // Always show config loading warnings, even when debug is disabled
    console.warn(`Failed to load config from ${configPath}, using defaults`);
    return defaultConfig;
  }
}

/**
 * Conditional logger that only outputs when debug mode is enabled
 */
export class Logger {
  constructor(private readonly config: InstrumentationConfig) {}

  log(message: string): void {
    if (this.config.debug) {
      console.log(message);
    }
  }

  warn(message: string): void {
    if (this.config.debug) {
      console.warn(message);
    }
  }

  error(message: string, error?: unknown): void {
    if (this.config.debug) {
      if (error) {
        console.error(message, error);
      } else {
        console.error(message);
      }
    }
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
    configPath: typeof args.config === 'string' ? args.config : undefined
  };
}

// Instrumentation scripts run in the browser context and are read from disk at runtime.
// The directory is resolved relative to this module (dev / `bun run` / vitest) or relative
// to the executable (compiled binary, where the scripts are shipped alongside it), never
// relative to the current working directory. Resolved once and cached.
let instrumentationDir: string | null = null;
function resolveInstrumentationDir(): string {
  if (instrumentationDir) return instrumentationDir;
  const candidates: string[] = [];
  // Dev / vitest / `bun run`: relative to this module (robust to cwd).
  try {
    candidates.push(join(dirname(fileURLToPath(import.meta.url)), '..', 'instrumentation'));
  } catch {
    // import.meta.url not resolvable; fall through to the candidates below.
  }
  // Compiled binary: shipped alongside the executable (see scripts/package-release.ts).
  try {
    candidates.push(join(dirname(realpathSync(process.execPath)), 'instrumentation'));
  } catch {
    // process.execPath not resolvable; fall through to the cwd fallback below.
  }
  // Last-resort fallback (matches tests/instrumentation.test.ts).
  candidates.push(join(process.cwd(), 'src', 'instrumentation'));

  for (const dir of candidates) {
    if (existsSync(join(dir, 'bootstrap.js'))) {
      instrumentationDir = dir;
      return dir;
    }
  }
  throw new Error(
    'Could not locate instrumentation scripts. Ship the instrumentation/ directory next to ' +
    'the js_unshroud binary.'
  );
}

function readInstrumentationSource(name: string): string {
  return readFileSync(join(resolveInstrumentationDir(), name), 'utf-8');
}

/** The set of instrumentation hook sources loaded for a session (Q5). */
interface InstrumentationScripts {
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
  clipboard: string | null;
  download: string | null;
  performanceMonitor: string;
}

function loadInstrumentationScripts(config: InstrumentationConfig): InstrumentationScripts {
  // Scripts are read from disk (resolved relative to the module or the executable).
  return {
    bootstrap: readInstrumentationSource('bootstrap.js'),
    network: config.enableNetwork ? readInstrumentationSource('network-hooks.js') : null,
    storage: config.enableStorage ? readInstrumentationSource('storage-hooks.js') : null,
    timer: config.enableTimer ? readInstrumentationSource('timer-hooks.js') : null,
    dom: config.enableDOM ? readInstrumentationSource('dom-hooks.js') : null,
    fingerprinting: config.enableFingerprinting ? readInstrumentationSource('fingerprinting-hooks.js') : null,
    objectTracking: config.enableObjectTracking ? readInstrumentationSource('object-tracking.js') : null,
    headlessMitigation: config.enableHeadlessMitigation ? readInstrumentationSource('headless-mitigation.js') : null,
    serviceWorker: config.enableServiceWorker ? readInstrumentationSource('service-worker-hooks.js') : null,
    codeExecution: config.enableCodeExecution ? readInstrumentationSource('code-execution-hooks.js') : null,
    encoding: config.enableEncoding ? readInstrumentationSource('encoding-hooks.js') : null,
    cryptojs: config.enableCryptoJS ? readInstrumentationSource('cryptojs-hooks.js') : null,
    eventHandler: config.enableEventHandlers ? readInstrumentationSource('event-handler-hooks.js') : null,
    // Blob tracking needed for worker CDP mitigation (to capture blob content)
    blobTracking: (config.enableBlobTracking || config.enableHeadlessMitigation) ? readInstrumentationSource('blob-hooks.js') : null,
    urlExecution: config.enableURLExecution ? readInstrumentationSource('url-execution-hooks.js') : null,
    // Worker hooks needed for CDP mitigation in workers (even if worker logging disabled)
    worker: (config.enableWorkers || config.enableHeadlessMitigation) ? readInstrumentationSource('worker-hooks.js') : null,
    module: config.enableModules ? readInstrumentationSource('module-hooks.js') : null,
    iframe: config.enableIframes ? readInstrumentationSource('iframe-hooks.js') : null,
    clipboard: config.enableClipboard ? readInstrumentationSource('clipboard-hooks.js') : null,
    download: config.enableDownloadDetection ? readInstrumentationSource('download-hooks.js') : null,
    performanceMonitor: readInstrumentationSource('performance-monitor.js') // Always loaded for performance controls
  };
}

async function injectInstrumentation(
  page: Page,
  config: InstrumentationConfig,
  sessionId: string,
  eventLogger: EventLogger,
  artifactCollector: ArtifactCollector,
  logger: Logger,
  cdpManager: CDPSessionManager,
  headlessConfig?: HeadlessMitigationConfig
): Promise<InstrumentationScripts> {
  const scripts = loadInstrumentationScripts(config);

  // CRITICAL: Set up browser-to-Node.js logging bridge using CDP Runtime.addBinding
  // This avoids creating __playwright__binding__ which is detected by bot detection scripts
  // The binding names mimic Zone.js (Angular) patterns to blend in with common frameworks
  const { logBindingName, artifactBindingName } = await cdpManager.setupLoggingBridge(
    // Log event handler
    async (eventJson: string) => {
      try {
        const event = JSON.parse(eventJson) as unknown;
        if (validateEvent(event)) {
          await eventLogger.logEvent(event);
        } else {
          logger.warn('[JS Unshroud] Invalid event received from instrumentation:' + eventJson.substring(0, 200));
        }
      } catch (error) {
        logger.error('[JS Unshroud] Failed to parse instrumentation event:', error);
      }
    },
    // Artifact save handler
    async (artifactJson: string) => {
      try {
        const artifact = JSON.parse(artifactJson) as {
          event: MonitoringEvent;
          type: string;
          content: string;
          extension: string;
          mimeType?: string;
        };
        const artifactPath = await artifactCollector.saveArtifact(artifact.event, {
          type: artifact.type,
          content: artifact.content,
          extension: artifact.extension,
          ...(artifact.mimeType !== undefined && { mimeType: artifact.mimeType })
        });

        // If artifact was saved, update event with path and log it
        if (artifactPath) {
          const updatedEvent = { ...artifact.event, artifactPath };
          await eventLogger.logEvent(updatedEvent);
        }
      } catch (error) {
        logger.error('[JS Unshroud] Failed to save artifact:', error);
      }
    }
  );

  // CRITICAL: Freeze Error.prepareStackTrace BEFORE any page scripts run
  // This prevents CDP detection via the prepareStackTrace trap technique
  // Detection scripts try to set Error.prepareStackTrace to a function that sets a flag
  // when invoked. By freezing it first, their assignment silently fails.
  await page.addInitScript({
    content: `
      (function() {
        // Save original prepareStackTrace (may be undefined)
        var originalPrepareStackTrace = Error.prepareStackTrace;

        // Freeze prepareStackTrace so detection scripts cannot install their trap
        Object.defineProperty(Error, 'prepareStackTrace', {
          get: function() { return originalPrepareStackTrace; },
          set: function(value) {
            // Silently ignore attempts to override
            // This prevents detection scripts from installing their trap
            return value;
          },
          enumerable: false,
          configurable: false
        });
      })();
    `
  });

  // Create internal bridge functions that use the CDP bindings
  // The binding names are injected at runtime to avoid hardcoding detectable strings
  await page.addInitScript({
    content: `
      (function() {
        // Get CDP binding references (created by Runtime.addBinding)
        var logBinding = window['${logBindingName}'];
        var artifactBinding = window['${artifactBindingName}'];

        // Create internal bridge functions using the CDP bindings
        Object.defineProperty(window, '__js_unshroud_log', {
          value: function(data) {
            if (logBinding) {
              try {
                logBinding(data);
              } catch (e) {
                // Silent error handling
              }
            }
          },
          writable: false,
          enumerable: false,
          configurable: false
        });

        Object.defineProperty(window, '__js_unshroud_save_artifact', {
          value: function(artifactData) {
            if (artifactBinding) {
              try {
                artifactBinding(JSON.stringify(artifactData));
              } catch (e) {
                // Silent error handling
              }
            }
          },
          writable: false,
          enumerable: false,
          configurable: false
        });
      })();
    `
  });

  // Inject bootstrap first
  await page.addInitScript({ content: scripts.bootstrap });

  // Set up config BEFORE performance monitor and other hooks
  await page.addInitScript({
    content: `
      Object.defineProperty(window, '__js_unshroud_config', {
        value: ${JSON.stringify({
          maxPayloadSize: config.maxPayloadSize,
          maxStackDepth: config.maxStackDepth,
          enableServiceWorker: config.enableServiceWorker,
          enableCodeExecution: config.enableCodeExecution,
          enableEncoding: config.enableEncoding,
          enableEventHandlers: config.enableEventHandlers,
          enableBlobTracking: config.enableBlobTracking,
          enableURLExecution: config.enableURLExecution,
          enableClipboard: config.enableClipboard,
          clipboardPatternDetection: config.clipboardPatternDetection,
          enableDownloadDetection: config.enableDownloadDetection,
          enableArtifactCollection: config.enableArtifactCollection ?? false,
          eventFiltering: config.eventFiltering,
          debug: config.debug ?? false,
          // Worker-related flags needed by worker-hooks.js for CDP mitigation
          enableWorkers: config.enableWorkers,
          enableHeadlessMitigation: config.enableHeadlessMitigation
        })},
        writable: true,
        enumerable: false,  // Hidden from Object.keys()
        configurable: false
      });
      Object.defineProperty(window, '__js_unshroud_session_id', {
        value: '${sessionId}',
        writable: true,
        enumerable: false,  // Hidden from Object.keys()
        configurable: false
      });
    `
  });

  // Inject headless mitigation config if enabled
  if (config.enableHeadlessMitigation && headlessConfig) {
    await page.addInitScript({
      content: `Object.defineProperty(window, '__js_unshroud_headless_config', {
        value: ${JSON.stringify(headlessConfig)},
        writable: true,
        enumerable: false,  // Hidden from Object.keys()
        configurable: false
      });`
    });
  }

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

  // Inject download hooks AFTER blob tracking
  // Download hooks need access to blob map for content resolution
  if (scripts.download) {
    await page.addInitScript({ content: scripts.download });
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

  // Inject clipboard hooks for ClickFix detection (CRITICAL for 2025 attack landscape)
  if (scripts.clipboard) {
    await page.addInitScript({ content: scripts.clipboard });
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

async function performCleanup(browser: Browser, eventLogger: EventLogger, logger: Logger): Promise<void> {
  logger.log('Starting cleanup...');

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
    logger.log('Cleanup completed.');
  } catch {
    // Some cleanup operations failed - cleanup is best-effort, no warning needed
  }
}

/**
 * Generate spoofed user agent to mask headless browser indicators.
 * Returns user agent from config, or uses Windows Chrome default.
 */
export function generateSpoofedUserAgent(config: HeadlessMitigationConfig): string {
  return config.userAgent ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.7499.4 Safari/537.36';
}

/**
 * Generate brand metadata for sec-ch-ua headers.
 * This controls what appears in the Client Hints headers.
 * Returns brands from config, or uses Chromium 143 default.
 */
export function generateBrandMetadata(config: HeadlessMitigationConfig): Array<{ brand: string; version: string }> {
  return config.cdp?.brands ?? [
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
export function generateSpoofedHeaders(config: HeadlessMitigationConfig): Record<string, string> {
  // Build sec-ch-ua header from brands
  const brands = config.cdp?.brands ?? [
    { brand: 'Chromium', version: '143' },
    { brand: 'Not A(Brand)', version: '24' },
    { brand: 'Google Chrome', version: '143' }
  ];
  const secChUa = brands.map(b => `"${b.brand}";v="${b.version}"`).join(', ');

  // Determine platform for sec-ch-ua-platform
  const platform = config.cdp?.platform ?? 'Windows';

  // Determine mobile flag
  const mobile = config.cdp?.mobile ? '?1' : '?0';

  // Build Accept-Language from config
  const languages = config.languages ?? ['en-US', 'en'];
  const acceptLanguage = languages.join(',') + (languages.length === 1 ? '' : ';q=0.9');

  return {
    'Upgrade-Insecure-Requests': '1',
    'sec-ch-ua': secChUa,
    'sec-ch-ua-mobile': mobile,
    'sec-ch-ua-platform': `"${platform}"`,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': acceptLanguage,
    'Accept-Encoding': 'gzip, deflate, br'
  };
}

// ===== P3.2: Behavioral Interaction Simulation =====
// These functions simulate human-like interaction to defeat malware that gates execution
// behind interaction checks (ClickFix attacks, form submissions, checkout skimmers, etc.)

/**
 * Generate random number between min and max
 */
export function rand(min: number, max: number): number {
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
  } catch {
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
          // eslint-disable-next-line no-undef
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
  } catch {
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
  } catch {
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
  } catch {
    // Password fields may not exist, ignore
  }
}

/**
 * Detect checkout page and simulate payment form interaction
 * Triggers Magecart/web skimmers that activate only on checkout pages
 */
async function detectAndSimulateCheckoutBehavior(page: Page, logger: Logger): Promise<boolean> {
  try {
    const url = page.url();

    // Check if URL contains checkout keywords
    const isCheckoutPage = /checkout|payment|cart|onepage|billing/i.test(url);

    if (isCheckoutPage) {
      logger.log('[JS Unshroud] Detected checkout page, simulating payment form interaction');

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
  } catch {
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
async function simulateBehavior(page: Page, config: InstrumentationConfig, durationMs: number, logger: Logger): Promise<void> {
  try {
    if (!config.enableBehaviorSimulation) {
      // No behavioral simulation, just wait
      await page.waitForTimeout(durationMs);
      return;
    }

    const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
    const startTime = Date.now();
    const intensity = config.behaviorSimulationIntensity ?? 'medium';
    const enableForms = config.enableFormInteraction !== false; // Default true
    const enableCheckout = config.enableCheckoutSimulation !== false; // Default true
    const enableTimeDelayed = config.enableTimeDelayedBehavior !== false; // Default true

  if (enableTimeDelayed) {
    // Phase 1: Initial 30s - Minimal interaction (defeats 1-minute delay malware)
    logger.log('[JS Unshroud] Phase 1: Minimal interaction (0-30s)');
    while (Date.now() - startTime < 30000 && Date.now() < startTime + durationMs) {
      await simulateMouseMovement(page, viewport);

      // Check if we have time to sleep before sleeping (avoid overshoot)
      const maxSleep = 4000;
      if (Date.now() < startTime + durationMs - maxSleep) {
        await new Promise<void>(r => setTimeout(() => r(), rand(2000, 4000)));
      } else {
        break; // Exit if we can't complete another full cycle
      }
    }

    // Phase 2: 30s-60s - Moderate interaction (reading page)
    logger.log('[JS Unshroud] Phase 2: Moderate interaction (30-60s)');
    while (Date.now() - startTime < 60000 && Date.now() < startTime + durationMs) {
      await simulateMouseMovement(page, viewport);
      if (intensity !== 'low' && Math.random() < 0.3) await simulateScroll(page);

      // Check if we have time to sleep before sleeping (avoid overshoot)
      const maxSleep = 3000;
      if (Date.now() < startTime + durationMs - maxSleep) {
        await new Promise<void>(r => setTimeout(() => r(), rand(1500, 3000)));
      } else {
        break; // Exit if we can't complete another full cycle
      }
    }

    // Phase 3: 60s+ - Full interaction
    logger.log('[JS Unshroud] Phase 3: Full interaction (60s+)');
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
        hasTriedCheckout = await detectAndSimulateCheckoutBehavior(page, logger);
      }
    }

    // Check if we have time to sleep before sleeping (avoid overshoot)
    const maxSleep = 2000;
    if (Date.now() < startTime + durationMs - maxSleep) {
      await new Promise<void>(r => setTimeout(() => r(), rand(1000, 2000)));
    } else {
      break; // Exit if we can't complete another full cycle
    }
  }
  } catch (error: unknown) {
    // Handle browser/page closure gracefully (happens during test timeouts/cleanup)
    if (error && typeof error === 'object' && 'message' in error &&
        typeof error.message === 'string' && error.message.includes('Target')) {
      return; // Browser closed, exit gracefully
    }
    throw error; // Re-throw unexpected errors
  }
}

/**
 * Resolve a playwright-core package directory (or a direct entry file) to an
 * importable entry file path. Returns null if nothing usable is found.
 */
function resolvePlaywrightEntry(target: string): string | null {
  // Direct reference to an entry file (e.g. .../playwright-core/index.mjs).
  if (/\.(mjs|cjs|js)$/.test(target)) {
    return existsSync(target) ? target : null;
  }
  // Package directory: prefer the ESM entry, then fall back to CJS.
  for (const entry of ['index.mjs', 'index.js']) {
    const full = join(target, entry);
    if (existsSync(full)) return full;
  }
  return null;
}

/**
 * Load playwright-core's `chromium` at runtime.
 *
 * The compiled binary intentionally does NOT embed playwright-core: it reads
 * browser-registry data files from disk that Bun cannot bundle, and bundling it
 * bakes the build machine's absolute path into the executable. Instead we resolve
 * the package relative to the binary's own location so releases stay portable -
 * ship `node_modules/playwright-core` next to the executable. Resolution order:
 *   1. JS_UNSHROUD_PLAYWRIGHT_CORE env var (package dir or entry file)
 *   2. <dir-of-binary>/node_modules/playwright-core   (vendored release layout)
 *   3. bare "playwright-core" specifier                (dev: `bun run`)
 */
async function loadPlaywrightChromium(): Promise<BrowserType> {
  const candidates: string[] = [];

  const fromEnv = process.env['JS_UNSHROUD_PLAYWRIGHT_CORE'];
  if (fromEnv) {
    candidates.push(fromEnv);
  }

  try {
    // realpathSync resolves a PATH symlink (e.g. /usr/local/bin/js_unshroud) back
    // to the real install directory so the vendored package is found alongside it.
    const binDir = dirname(realpathSync(process.execPath));
    candidates.push(join(binDir, 'node_modules', 'playwright-core'));
  } catch {
    // process.execPath not resolvable; fall through to the bare specifier below.
  }

  for (const candidate of candidates) {
    const entry = resolvePlaywrightEntry(candidate);
    if (!entry) continue;
    try {
      const mod = (await import(pathToFileURL(entry).href)) as { chromium?: BrowserType };
      if (mod.chromium) return mod.chromium;
    } catch {
      // Try the next candidate.
    }
  }

  // Dev fallback: standard module resolution (works under `bun run`).
  try {
    const mod = (await import('playwright-core')) as { chromium?: BrowserType };
    if (mod.chromium) return mod.chromium;
  } catch {
    // Fall through to the error below.
  }

  throw new Error(
    'Could not locate playwright-core. Ship node_modules/playwright-core next to the ' +
    'js_unshroud binary, or set JS_UNSHROUD_PLAYWRIGHT_CORE to its location.'
  );
}

async function runMonitoring(args: Args): Promise<void> {
  const config = loadInstrumentationConfig(args.config);
  const logger = new Logger(config);
  logger.log(`Monitoring ${args.url}, outputting to ${args.out}`);
  const sessionConfig = createSessionConfig(args);
  const sessionId = sessionConfig.id;

  // Initialize event logger with UDP support
  const eventLogger = new EventLogger(
    sessionConfig,
    config.outputMode ?? 'file',
    config.udpLogging
  );

  // Initialize artifact collector if enabled
  const artifactConfig: ArtifactConfig = {
    enabled: config.enableArtifactCollection ?? false,
    baseDirectory: config.artifactDirectory ?? './artifacts',
    types: {
      pageSnapshot: config.artifactTypes?.pageSnapshot ?? true,
      downloads: config.artifactTypes?.downloads ?? true,
      codeExecution: config.artifactTypes?.codeExecution ?? true,
      encoding: config.artifactTypes?.encoding ?? true,
      cryptojs: config.artifactTypes?.cryptojs ?? true,
      clipboard: config.artifactTypes?.clipboard ?? true,
      workers: config.artifactTypes?.workers ?? true,
      iframes: config.artifactTypes?.iframes ?? true
    },
    maxArtifactSize: config.maxArtifactSize ?? (10 * 1024 * 1024) // 10MB default
  };
  const artifactCollector = new ArtifactCollector(sessionConfig, artifactConfig);
  if (artifactConfig.enabled) {
    await artifactCollector.initialize();
    logger.log(`Artifact collection enabled: ${artifactCollector.getSessionDirectory()}`);
  }

  // Resolve and validate headless mitigation configuration
  let headlessConfig: HeadlessMitigationConfig | undefined;
  if (config.enableHeadlessMitigation) {
    headlessConfig = resolveHeadlessMitigationConfig(config.headlessMitigation);

    // Validate resolved config
    const validation = validateHeadlessMitigationConfig(headlessConfig);
    if (validation.warnings.length > 0) {
      console.warn('[JS Unshroud] Headless mitigation config warnings:');
      validation.warnings.forEach(w => console.warn(`  - ${w}`));
    }
    if (!validation.valid) {
      throw new Error(`Invalid headless mitigation config: ${validation.errors.join(', ')}`);
    }
  }

  // Generate spoofed values for headless mitigation
  const useHeadlessMitigation = config.enableHeadlessMitigation && headlessConfig !== undefined;
  const spoofedUserAgent = useHeadlessMitigation && headlessConfig ? generateSpoofedUserAgent(headlessConfig) : '';
  const spoofedHeaders = useHeadlessMitigation && headlessConfig ? generateSpoofedHeaders(headlessConfig) : {};
  const brandMetadata = useHeadlessMitigation && headlessConfig ? generateBrandMetadata(headlessConfig) : undefined;
  
  // Launch browser with headless mitigation settings.
  // playwright-core is resolved at runtime relative to the binary (see loadPlaywrightChromium).
  const chromium = await loadPlaywrightChromium();
  const browser = await chromium.launch({
    headless: false,
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
  const cdpManager = new CDPSessionManager(page, eventLogger, sessionId, config.enableDebuggerDetection);

  try {
    await cdpManager.initialize(page);

    // Apply header spoofing BEFORE navigation if headless mitigation is enabled
    if (config.enableHeadlessMitigation && headlessConfig) {
      // Use CDP Emulation.setUserAgentOverride with brand metadata
      // This affects both network requests AND the navigator API
      // The userAgentMetadata parameter controls sec-ch-ua headers
      await cdpManager.setUserAgentOverride(spoofedUserAgent, 'Windows', brandMetadata, headlessConfig);

      // Apply additional headers for subrequests (fallback)
      await page.setExtraHTTPHeaders(spoofedHeaders);

      // Note: navigator.webdriver is prevented from being created by the
      // --disable-blink-features=AutomationControlled flag at browser launch.
      // We intentionally do NOT override it here, as creating the property
      // (even with a getter returning false) makes it detectable by _.has() checks.
    }

    await injectInstrumentation(page, config, sessionId, eventLogger, artifactCollector, logger, cdpManager, headlessConfig);

    // Navigate to the URL
    logger.log(`Navigating to ${args.url}...`);
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
      logger.log('Warning: Instrumentation load timeout (bootstrap may be disabled)');
    }

    // Capture initial page HTML snapshot if artifact collection is enabled
    if (artifactCollector.isEnabled() && artifactConfig.types.pageSnapshot) {
      try {
        const htmlContent = await page.content();

        // Warn if snapshot is empty
        if (!htmlContent || htmlContent.trim().length === 0) {
          logger.warn('Warning: Initial page snapshot is empty - page may not have loaded properly');
        }

        const pageTitle = await page.title();
        const captureTime = Date.now();

        // Create page snapshot event (initial state)
        const snapshotEvent = createEvent<PageSnapshotEvent>(sessionId, undefined, {
          type: 'page_snapshot',
          url: args.url,
          title: pageTitle,
          htmlLength: Buffer.byteLength(htmlContent, 'utf-8'),
          captureTime: captureTime,
          snapshotStage: 'initial'
        });

        // Save HTML content as artifact
        const artifactPath = await artifactCollector.saveArtifact(snapshotEvent, {
          type: 'page_snapshot',
          content: htmlContent,
          extension: 'html',
          mimeType: 'text/html'
        });

        // Log the event with artifact path
        if (artifactPath) {
          snapshotEvent.artifactPath = artifactPath;
          await eventLogger.logEvent(snapshotEvent);
          logger.log(`Initial page snapshot saved: ${artifactPath}`);

          // Verify file was written
          if (!existsSync(artifactPath)) {
            logger.warn(`Warning: Initial snapshot file not found after write: ${artifactPath}`);
          }
        }
      } catch (error) {
        logger.error('Failed to capture initial page snapshot:', error);
      }
    }

    const monitoringDurationMs = config.monitoringTimeoutSeconds * 1000;
    logger.log(`Instrumentation loaded, monitoring for ${config.monitoringTimeoutSeconds} seconds...`);

    // Simulate human behavior if behavioral simulation is enabled
    // This defeats malware that gates execution behind interaction checks
    await simulateBehavior(page, config, monitoringDurationMs, logger);

    logger.log('Monitoring completed.');

  } catch (error) {
    logger.error('Error during monitoring:', error);
    throw error; // Re-throw for main function to handle
  } finally {
    // Capture final page HTML snapshot before cleanup
    if (artifactCollector.isEnabled() && artifactConfig.types.pageSnapshot) {
      try {
        const htmlContent = await page.content();

        // Warn if snapshot is empty
        if (!htmlContent || htmlContent.trim().length === 0) {
          logger.warn('Warning: Final page snapshot is empty - page may have unloaded');
        }

        const pageTitle = await page.title();
        const captureTime = Date.now();

        // Create page snapshot event (final state)
        const finalSnapshotEvent = createEvent<PageSnapshotEvent>(sessionId, undefined, {
          type: 'page_snapshot',
          url: args.url,
          title: pageTitle,
          htmlLength: Buffer.byteLength(htmlContent, 'utf-8'),
          captureTime: captureTime,
          snapshotStage: 'final'
        });

        // Save HTML content as artifact (final state)
        const artifactPath = await artifactCollector.saveArtifact(finalSnapshotEvent, {
          type: 'page_snapshot',
          content: htmlContent,
          extension: 'html',
          mimeType: 'text/html'
        });

        // Log the event with artifact path
        if (artifactPath) {
          finalSnapshotEvent.artifactPath = artifactPath;
          await eventLogger.logEvent(finalSnapshotEvent);

          // CRITICAL: Flush logger to ensure write completes before cleanup
          await eventLogger.flush();

          // Verify file was written before cleanup starts
          if (!existsSync(artifactPath)) {
            logger.error(`ERROR: Final snapshot file not found after write: ${artifactPath}`);
          } else {
            logger.log(`Final page snapshot saved and verified: ${artifactPath}`);
          }
        }
      } catch (error) {
        logger.error('Failed to capture final page snapshot:', error);
      }
    }

    // Flush pending events before cleanup
    await cdpManager.flushPendingEvents();
    await cdpManager.disconnect();
    await performCleanup(browser, eventLogger, logger);
  }
}

async function main() {
  const subcommand = process.argv[2];

  // Explicit help: print usage to stdout and exit 0 (no subcommand also shows help).
  if (subcommand === undefined || subcommand === '--help' || subcommand === '-h') {
    printUsage('stdout');
    process.exit(0);
  }

  if (subcommand === 'analyze') {
    const { runAnalyze } = await import('./analyze.ts');
    await runAnalyze();
  } else if (subcommand === 'query') {
    const { runQuery } = await import('./query.ts');
    await runQuery();
  } else if (subcommand === 'correlate') {
    const { runCorrelate } = await import('./correlate.ts');
    await runCorrelate();
  } else {
    // Support both direct flags and optional "run" subcommand
    if (subcommand === 'run') {
      process.argv.splice(2, 1); // Remove "run" keyword
    }
    const args = parseArgs();

    try {
      await runMonitoring(args);
    } catch (error) {
      console.error('Error during monitoring:', error);
    }
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
  runMonitoring
};
