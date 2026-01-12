#!/usr/bin/env bun

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { readFileSync } from 'fs';
import { EventLogger } from '../orchestrator/EventLogger.ts';
import { CDPSessionManager } from '../orchestrator/CDPSessionManager.ts';
import type { SessionConfig, InstrumentationConfig } from '../schema/types.ts';

// Declare setTimeout for linting purposes
declare const setTimeout: (handler: () => void, timeout?: number) => number;

interface Args {
  url: string;
  out: string;
  config?: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let url: string | undefined, out: string | undefined, config: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && i+1 < args.length) {
      url = args[i+1];
      i++;
    } else if (args[i] === '--out' && i+1 < args.length) {
      out = args[i+1];
      i++;
    } else if (args[i] === '--config' && i+1 < args.length) {
      config = args[i+1];
      i++;
    }
  }

  if (!url || !out) {
    console.error('Usage: js_unshroud run --url <url> --out <output.jsonl> [--config <config.json>]');
    process.exit(1);
  }

  return { url: url, out: out, config };  
}

function loadInstrumentationConfig(configPath?: string): InstrumentationConfig {
  const defaultConfig: InstrumentationConfig = {
    enableConsole: true,
    enableNetwork: true,
    enableStorage: true,
    enableWebSocket: true,
    enableTimer: false, // Will be implemented in Phase 3
    enableError: true,
    enableDOM: false, // Will be implemented in Phase 3
    sampleRate: 1.0
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

function loadInstrumentationScripts(config: InstrumentationConfig) {
  const bootstrapScript = readFileSync('./src/instrumentation/bootstrap.js', 'utf-8');
  const networkScript = readFileSync('./src/instrumentation/network-hooks.js', 'utf-8');
  const storageScript = readFileSync('./src/instrumentation/storage-hooks.js', 'utf-8');

  return {
    bootstrap: bootstrapScript,
    network: config.enableNetwork ? networkScript : null,
    storage: config.enableStorage ? storageScript : null
  };
}

async function injectInstrumentation(page: Page, config: InstrumentationConfig) {
  const scripts = loadInstrumentationScripts(config);

  // Inject bootstrap first
  await page.addInitScript({ content: scripts.bootstrap });

  // Inject other scripts if enabled
  if (scripts.network) {
    await page.addInitScript({ content: scripts.network });
  }

  if (scripts.storage) {
    await page.addInitScript({ content: scripts.storage });
  }

  return scripts;
}

async function performCleanup(browser: Browser, eventLogger: EventLogger) {
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
        setTimeout(() => reject(new Error('Browser close timeout')), 8000)
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
        setTimeout(() => reject(new Error('Event logger close timeout')), 2000)
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

async function runMonitoring(args: Args) {
  const config = loadInstrumentationConfig(args.config);
  console.log(`Monitoring ${args.url}, outputting to ${args.out}`);
  const sessionConfig = createSessionConfig(args);
  const sessionId = sessionConfig.id;

  // Initialize event logger
  const eventLogger = new EventLogger(sessionConfig);

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Initialize CDP session manager
  const cdpManager = new CDPSessionManager(page, eventLogger, sessionId);

  try {
    await cdpManager.initialize(page);
    await injectInstrumentation(page, config);

    // Navigate to the URL
    console.log(`Navigating to ${args.url}...`);
    await page.goto(args.url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Wait for instrumentation to load (only if bootstrap was injected)
    try {
      await page.waitForFunction(() => {
        return (globalThis as { __js_unshroud_loaded?: boolean }).__js_unshroud_loaded === true;
      }, {
        timeout: 5000
      });
    } catch {
      console.log('Warning: Instrumentation load timeout (bootstrap may be disabled)');
    }

    console.log('Instrumentation loaded, monitoring for 10 seconds...');
    // Wait for events to be captured (increased to 15s for comprehensive testing)
    await page.waitForTimeout(15000);
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
  runMonitoring
};
