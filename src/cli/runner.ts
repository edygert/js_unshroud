#!/usr/bin/env bun

import { chromium } from 'playwright-core';
import { readFileSync } from 'fs';
import { EventLogger } from '../orchestrator/EventLogger.ts';
import { CDPSessionManager } from '../orchestrator/CDPSessionManager.ts';
import type { SessionConfig, InstrumentationConfig } from '../schema/types.ts';

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
    const userConfig = JSON.parse(configContent);
    return { ...defaultConfig, ...userConfig };
  } catch (error) {
    console.warn(`Failed to load config from ${configPath}, using defaults:`, error);
    return defaultConfig;
  }
}

async function main() {
  const args = parseArgs();
  const config = loadInstrumentationConfig(args.config);

  console.log(`Monitoring ${args.url}, outputting to ${args.out}`);

  // Generate unique session ID
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const sessionConfig: SessionConfig = {
    id: sessionId,
    url: args.url,
    startTime: Date.now(),
    outputPath: args.out,
    configPath: args.config
  };

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

    // Load instrumentation scripts in correct order
    const bootstrapScript = readFileSync('./src/instrumentation/bootstrap.js', 'utf-8');
    const networkScript = readFileSync('./src/instrumentation/network-hooks.js', 'utf-8');
    const storageScript = readFileSync('./src/instrumentation/storage-hooks.js', 'utf-8');

    // Inject bootstrap first
    await page.addInitScript({ content: bootstrapScript });

    // Inject other scripts if enabled
    if (config.enableNetwork) {
      await page.addInitScript({ content: networkScript });
    }

    if (config.enableStorage) {
      await page.addInitScript({ content: storageScript });
    }

    // Navigate to the URL
    console.log(`Navigating to ${args.url}...`);
    await page.goto(args.url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Wait for instrumentation to load
    await page.waitForFunction(() => {
      return (globalThis as { __js_unshroud_loaded?: boolean }).__js_unshroud_loaded === true;
    }, {
      timeout: 5000
    });

    console.log('Instrumentation loaded, monitoring for 10 seconds...');

    // Wait for events to be captured
    await page.waitForTimeout(10000);

    console.log('Monitoring completed.');

  } catch (error) {
    console.error('Error during monitoring:', error);
  } finally {
    // Clean up
    await cdpManager.disconnect();
    await browser.close();
    await eventLogger.close();
  }
}

if (import.meta.main) {
  main().catch(console.error);
}
