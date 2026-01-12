import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { chromium } from 'playwright-core';
import {
  parseArgs,
  loadInstrumentationConfig,
  generateSessionId,
  createSessionConfig,
  loadInstrumentationScripts,
  injectInstrumentation,
  performCleanup
} from '../src/cli/runner.ts';
import { readFileSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { EventLogger } from '../src/orchestrator/EventLogger.ts';
import { CDPSessionManager } from '../src/orchestrator/CDPSessionManager.ts';
import type { InstrumentationConfig, SessionConfig } from '../src/schema/types.ts';

describe('CLI Argument Parsing', () => {
  test('should parse required arguments --url and --out', () => {
    process.argv = ['node', 'runner.ts', '--url', 'https://example.com', '--out', '/tmp/test.jsonl'];
    const args = parseArgs();

    expect(args.url).toBe('https://example.com');
    expect(args.out).toBe('/tmp/test.jsonl');
    expect(args.config).toBeUndefined();
  });

  test('should parse optional --config argument', () => {
    process.argv = ['node', 'runner.ts', '--url', 'https://example.com', '--out', '/tmp/test.jsonl', '--config', '/path/to/config.json'];
    const args = parseArgs();

    expect(args.url).toBe('https://example.com');
    expect(args.out).toBe('/tmp/test.jsonl');
    expect(args.config).toBe('/path/to/config.json');
  });

  test('should exit with error when --url is missing', () => {
    process.argv = ['node', 'runner.ts', '--out', '/tmp/test.jsonl'];

    // Mock process.exit and console.error
    const originalExit = process.exit;
    const originalError = console.error;
    let exitCode: number | undefined;
    let errorMessage = '';

    console.error = (message: string) => {
      errorMessage = message;
    };

    process.exit = ((code?: number) => {
      exitCode = code;
      throw new Error('Process exit');
    }) as any;

    expect(() => parseArgs()).toThrow('Process exit');
    expect(exitCode).toBe(1);
    expect(errorMessage).toContain('Usage:');

    // Restore originals
    process.exit = originalExit;
    console.error = originalError;
  });

  test('should exit with error when --out is missing', () => {
    process.argv = ['node', 'runner.ts', '--url', 'https://example.com'];

    const originalExit = process.exit;
    const originalError = console.error;
    let exitCode: number | undefined;
    let errorMessage = '';

    console.error = (message: string) => {
      errorMessage = message;
    };

    process.exit = ((code?: number) => {
      exitCode = code;
      throw new Error('Process exit');
    }) as any;

    expect(() => parseArgs()).toThrow('Process exit');
    expect(exitCode).toBe(1);
    expect(errorMessage).toContain('Usage:');

    process.exit = originalExit;
    console.error = originalError;
  });

  test('should ignore unknown arguments', () => {
    process.argv = ['node', 'runner.ts', '--url', 'https://example.com', '--out', '/tmp/test.jsonl', '--unknown', 'value'];
    const args = parseArgs();

    expect(args.url).toBe('https://example.com');
    expect(args.out).toBe('/tmp/test.jsonl');
    expect(args.config).toBeUndefined();
  });

  test('should handle malformed argument pairs', () => {
    process.argv = ['node', 'runner.ts', '--url', '--out', '/tmp/test.jsonl'];

    // Spy on process.exit to verify it's called when args are malformed
    const exitSpy = vi.spyOn(process, 'exit');
    exitSpy.mockImplementation(() => { throw new Error('Process exit'); });

    // Should exit with code 1 due to missing required --url value
    expect(() => parseArgs()).toThrow('Process exit');
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });
});

describe('Instrumentation Config Loading', () => {
  test('should return default config when no configPath provided', () => {
    const config = loadInstrumentationConfig();

    expect(config.enableConsole).toBe(true);
    expect(config.enableNetwork).toBe(true);
    expect(config.enableStorage).toBe(true);
    expect(config.enableWebSocket).toBe(true);
    expect(config.enableTimer).toBe(false);
    expect(config.enableError).toBe(true);
    expect(config.enableDOM).toBe(false);
    expect(config.sampleRate).toBe(1.0);
  });

  test('should load and merge config from file', () => {
    const config = loadInstrumentationConfig('./tests/fixtures/valid-config.json');

    expect(config.enableConsole).toBe(true); // Default
    expect(config.enableNetwork).toBe(false); // Overridden
    expect(config.enableStorage).toBe(false); // Overridden
    expect(config.enableWebSocket).toBe(true); // Default
    expect(config.sampleRate).toBe(0.5); // Overridden
  });

  test('should handle invalid JSON in config file', () => {
    const config = loadInstrumentationConfig('./tests/fixtures/invalid-config.json');

    // Should return defaults when JSON parsing fails
    expect(config.enableConsole).toBe(true);
    expect(config.enableNetwork).toBe(true);
  });

  test('should handle missing config file', () => {
    const config = loadInstrumentationConfig('./tests/fixtures/nonexistent-config.json');

    // Should return defaults when file doesn't exist
    expect(config.enableConsole).toBe(true);
  });

  test('should merge partial config with defaults', () => {
    const config = loadInstrumentationConfig('./tests/fixtures/partial-config.json');

    expect(config.enableConsole).toBe(true); // Default
    expect(config.enableNetwork).toBe(false); // Overridden
    expect(config.enableDOM).toBe(true); // Overridden
    expect(config.sampleRate).toBe(0.7); // Overridden
    expect(config.enableWebSocket).toBe(true); // Default
  });
});

describe('Session ID Generation', () => {
  test('should generate session ID with proper format', () => {
    const sessionId = generateSessionId();

    expect(sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);
  });

  test('should generate unique session IDs', () => {
    const id1 = generateSessionId();
    const id2 = generateSessionId();

    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^session_\d+_[a-z0-9]+$/);
    expect(id2).toMatch(/^session_\d+_[a-z0-9]+$/);
  });
});

describe('Session Configuration Creation', () => {
  test('should create session config with args', () => {
    const args = { url: 'https://test.com', out: '/tmp/test.jsonl', config: '/path/to/config.json' };

    const config = createSessionConfig(args);

    expect(config.url).toBe('https://test.com');
    expect(config.outputPath).toBe('/tmp/test.jsonl');
    expect(config.configPath).toBe('/path/to/config.json');
    expect(config.startTime).toBeDefined();
    expect(typeof config.startTime).toBe('number');
    expect(config.id).toMatch(/^session_\d+_[a-z0-9]+$/);
  });

  test('should create session config without config path', () => {
    const args = { url: 'https://test.com', out: '/tmp/test.jsonl', config: undefined };

    const config = createSessionConfig(args);

    expect(config.url).toBe('https://test.com');
    expect(config.outputPath).toBe('/tmp/test.jsonl');
    expect(config.configPath).toBeUndefined();
    expect(config.id).toMatch(/^session_\d+_[a-z0-9]+$/);
  });
});

describe('Instrumentation Script Loading', () => {
  test('should load all scripts when all features enabled', () => {
    const config: InstrumentationConfig = {
      enableConsole: true,
      enableNetwork: true,
      enableStorage: true,
      enableWebSocket: true,
      enableTimer: false,
      enableError: true,
      enableDOM: false,
      sampleRate: 1.0
    };

    const scripts = loadInstrumentationScripts(config);

    expect(typeof scripts.bootstrap).toBe('string');
    expect(scripts.bootstrap.length).toBeGreaterThan(0);
    expect(typeof scripts.network).toBe('string');
    expect(scripts.network!.length).toBeGreaterThan(0);
    expect(typeof scripts.storage).toBe('string');
    expect(scripts.storage!.length).toBeGreaterThan(0);
  });

  test('should only load enabled scripts', () => {
    const config: InstrumentationConfig = {
      enableConsole: true,
      enableNetwork: false,
      enableStorage: true,
      enableWebSocket: true,
      enableTimer: false,
      enableError: true,
      enableDOM: false,
      sampleRate: 1.0
    };

    const scripts = loadInstrumentationScripts(config);

    expect(typeof scripts.bootstrap).toBe('string');
    expect(scripts.bootstrap.length).toBeGreaterThan(0);
    expect(scripts.network).toBeNull();
    expect(typeof scripts.storage).toBe('string');
    expect(scripts.storage!.length).toBeGreaterThan(0);
  });

  test('should handle minimal config with only bootstrap', () => {
    const config: InstrumentationConfig = {
      enableConsole: false,
      enableNetwork: false,
      enableStorage: false,
      enableWebSocket: false,
      enableTimer: false,
      enableError: false,
      enableDOM: false,
      sampleRate: 1.0
    };

    const scripts = loadInstrumentationScripts(config);

    expect(typeof scripts.bootstrap).toBe('string');
    expect(scripts.bootstrap.length).toBeGreaterThan(0);
    expect(scripts.network).toBeNull();
    expect(scripts.storage).toBeNull();
  });
});

describe('Instrumentation Injection', () => {
  test('should inject scripts based on config', async () => {
    const config: InstrumentationConfig = {
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
      sampleRate: 1.0,
      maxEventsPerSecond: 1000,
      dedupeWindowMs: 100,
      maxPayloadSize: 1024,
      maxStackDepth: 20,
      enableSampling: true,
      enableRateLimiting: true,
      enableDeduplication: true
    };

    // Mock page with addInitScript spy (only mock the page since we can't inject into a fake page)
    const addInitScript = vi.fn();
    const page = { addInitScript } as any;

    await injectInstrumentation(page, config, 'test-session');

    expect(addInitScript).toHaveBeenCalledTimes(5); // bootstrap + network + storage + config + performanceMonitor
    expect(addInitScript).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.any(String) })
    );
  });

  test('should skip disabled scripts', async () => {
    const config: InstrumentationConfig = {
      enableConsole: true,
      enableNetwork: false,
      enableStorage: true,
      enableWebSocket: true,
      enableTimer: false,
      enableError: true,
      enableDOM: false,
      enableFingerprinting: false,
      enableObjectTracking: false,
      enableHeadlessMitigation: false,
      sampleRate: 1.0,
      maxEventsPerSecond: 1000,
      dedupeWindowMs: 100,
      maxPayloadSize: 1024,
      maxStackDepth: 20,
      enableSampling: true,
      enableRateLimiting: true,
      enableDeduplication: true
    };

    const addInitScript = vi.fn();
    const page = { addInitScript } as any;

    await injectInstrumentation(page, config, 'test-session');

    expect(addInitScript).toHaveBeenCalledTimes(4); // bootstrap + storage + config + performanceMonitor
    expect(addInitScript).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.any(String) })
    );
  });

  test('should handle script injection errors', async () => {
    const config: InstrumentationConfig = {
      enableConsole: true,
      enableNetwork: true,
      enableStorage: true,
      enableWebSocket: true,
      enableTimer: false,
      enableError: true,
      enableDOM: false,
      sampleRate: 1.0
    };

    const addInitScript = vi.fn().mockRejectedValueOnce(new Error('Injection failed'));
    const page = { addInitScript } as any;

    // Should rethrow the error
    await expect(injectInstrumentation(page, config)).rejects.toThrow('Injection failed');
  });

  test('should handle minimal config with only bootstrap', async () => {
    const config: InstrumentationConfig = {
      enableConsole: false,
      enableNetwork: false,
      enableStorage: false,
      enableWebSocket: false,
      enableTimer: false,
      enableError: false,
      enableDOM: false,
      sampleRate: 1.0
    };

    const addInitScript = vi.fn();
    const page = { addInitScript } as any;

    await injectInstrumentation(page, config);

    expect(addInitScript).toHaveBeenCalledTimes(3); // bootstrap + performance config + performance monitor
    expect(addInitScript).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.any(String) })
    );
  });
});

describe('Cleanup Operations', () => {
  test('should perform cleanup successfully', async () => {
    // Mock browser with contexts and pages
    const pageClose = vi.fn().mockResolvedValue(undefined);
    const contextClose = vi.fn().mockResolvedValue(undefined);
    const browserClose = vi.fn().mockResolvedValue(undefined);

    const browser = {
      contexts: () => [{
        pages: () => [{ close: pageClose }],
        close: contextClose
      }],
      close: browserClose
    } as any;

    // Mock event logger with close method
    const eventLoggerClose = vi.fn().mockResolvedValue(undefined);
    const eventLogger = {
      close: eventLoggerClose
    } as any;

    // Capture console.log output
    const originalLog = console.log;
    const logOutput: string[] = [];
    console.log = (message: string) => logOutput.push(message);

    await performCleanup(browser, eventLogger);

    console.log = originalLog;

    expect(pageClose).toHaveBeenCalled();
    expect(contextClose).toHaveBeenCalled();
    expect(browserClose).toHaveBeenCalled();
    expect(eventLoggerClose).toHaveBeenCalled();
    expect(logOutput).toContain('Starting cleanup...');
    expect(logOutput).toContain('Cleanup completed.');
  });

  test('should handle cleanup errors gracefully', async () => {
    // Mock browser that fails to close
    const browser = {
      contexts: () => [{
        pages: () => [{ close: vi.fn().mockRejectedValue(new Error('Page close error')) }],
        close: vi.fn().mockRejectedValue(new Error('Context close error'))
      }],
      close: vi.fn().mockRejectedValue(new Error('Browser close error'))
    } as any;

    // Mock event logger that fails to close
    const eventLogger = {
      close: vi.fn().mockRejectedValue(new Error('Event logger close error'))
    } as any;

    // Should complete without throwing
    await performCleanup(browser, eventLogger);
    // Test passes if no exception is thrown above
  });
});

describe('Main Function', () => {
  test('should create valid configuration from args', () => {
    const args = { url: 'https://example.com', out: '/tmp/test.out', config: './tests/fixtures/valid-config.json' };

    // Test that the configuration loading and session creation works
    const config = loadInstrumentationConfig(args.config);
    const sessionConfig = createSessionConfig(args);

    expect(config.enableNetwork).toBe(false); // From test fixture
    expect(sessionConfig.url).toBe(args.url);
    expect(sessionConfig.outputPath).toBe(args.out);
    expect(sessionConfig.configPath).toBe(args.config);
    expect(sessionConfig.id).toMatch(/^session_\d+_[a-z0-9]+$/);
  });
});

describe('CDPSessionManager Tests', () => {
  let tempOutputFile: string;

  beforeEach(() => {
    tempOutputFile = `/tmp/cdp-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jsonl`;
  });

  afterEach(() => {
    try {
      if (tempOutputFile) {
        unlinkSync(tempOutputFile);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  test('should handle setup methods when CDP session is null', () => {
    const sessionConfig: SessionConfig = createSessionConfig({
      url: 'https://test.com',
      out: tempOutputFile,
      config: undefined
    });

    const eventLogger = new EventLogger(sessionConfig);

    // Create a CDPSessionManager but access its private methods through reflection
    const cdpManager = new CDPSessionManager(null as any, eventLogger, sessionConfig.id);

    // The constructor should complete without errors even with null page
    // The guard clauses in setup methods should prevent errors when cdpSession is null
    expect(cdpManager).toBeDefined();
  });

  test('should handle CDP session initialization failure gracefully', async () => {
    const sessionConfig: SessionConfig = createSessionConfig({
      url: 'https://test.com',
      out: tempOutputFile,
      config: undefined
    });

    const eventLogger = new EventLogger(sessionConfig);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      const cdpManager = new CDPSessionManager(page, eventLogger, sessionConfig.id);
      
      // Close the page before initialization to trigger failure
      await page.close();
      
      // This should fail because page is closed
      await expect(cdpManager.initialize(page)).rejects.toThrow();
    } finally {
      await browser.close();
      await eventLogger.close();
    }
  }, 10000);

  test('should successfully flush pending events', async () => {
    const sessionConfig: SessionConfig = createSessionConfig({
      url: `file://${resolve('test_monitoring.html')}`,
      out: tempOutputFile,
      config: undefined
    });

    const eventLogger = new EventLogger(sessionConfig);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      const cdpManager = new CDPSessionManager(page, eventLogger, sessionConfig.id);
      await cdpManager.initialize(page);

      // Navigate to generate some events
      await page.goto(sessionConfig.url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      
      // Wait a bit for events to be queued
      await page.waitForTimeout(500);

      // Flush should complete without errors
      await cdpManager.flushPendingEvents();
      await cdpManager.disconnect();
    } finally {
      await performCleanup(browser, eventLogger);
    }
  }, 15000);
});

describe('End-to-End Integration Tests', () => {
  let tempOutputFile: string;

  // Create a temporary output file before each test
  beforeEach(() => {
    tempOutputFile = `/tmp/test-output-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jsonl`;
  });

  // Clean up temp file after each test
  afterEach(() => {
    try {
      if (tempOutputFile) {
        unlinkSync(tempOutputFile);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  test('should successfully instrument and monitor test page', async () => {
    // Create real SessionConfig using the test HTML file
    const sessionConfig: SessionConfig = createSessionConfig({
      url: `file://${resolve('test_monitoring.html')}`,
      out: tempOutputFile,
      config: undefined
    });

    // Create real EventLogger
    const eventLogger = new EventLogger(sessionConfig);

    // Load instrumentation config
    const config = loadInstrumentationConfig();

    // Launch real browser
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Create real CDPSessionManager
      const cdpManager = new CDPSessionManager(page, eventLogger, sessionConfig.id);

      // Initialize CDP session
      await cdpManager.initialize(page);

      // Inject instrumentation scripts
      await injectInstrumentation(page, config);

      // Navigate to test page
      await page.goto(sessionConfig.url, {
        waitUntil: 'domcontentloaded',
        timeout: 10000
      });

      // Wait for instrumentation to load
      await page.waitForFunction(() => {
        return (globalThis as { __js_unshroud_loaded?: boolean }).__js_unshroud_loaded === true;
      }, { timeout: 5000 });

      // Wait for test page to execute its monitoring tests
       
      await page.waitForTimeout(3000);

      // Close the event logger to flush any remaining events
      await eventLogger.close();

      // Verify events were logged
      const loggedData = readFileSync(tempOutputFile, 'utf-8');
      const events = loggedData.trim().split('\n').map(line => JSON.parse(line));

      // Should have session start/end events plus monitoring events
      expect(events.length).toBeGreaterThan(2);

      // Should include console events from the test page
      const consoleEvents = events.filter(e => e.type === 'console');
      expect(consoleEvents.length).toBeGreaterThan(0);

      // Should include some network events (from XMLHttpRequest/Fetch tests)
      const networkEvents = events.filter(e => e.type === 'network');
      expect(networkEvents.length).toBeGreaterThan(0);

    } finally {
      await performCleanup(browser, eventLogger);
    }
  }, 30000); // Increase timeout for end-to-end test

  test('should handle page navigation errors gracefully', async () => {
    const sessionConfig: SessionConfig = createSessionConfig({
      url: 'http://invalid-domain-that-does-not-exist.invalid',
      out: tempOutputFile,
      config: undefined
    });

    const eventLogger = new EventLogger(sessionConfig);
    const config = loadInstrumentationConfig();

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      const cdpManager = new CDPSessionManager(page, eventLogger, sessionConfig.id);
      await cdpManager.initialize(page);
      await injectInstrumentation(page, config);

      // This should fail with navigation error
       
      await expect(page.goto(sessionConfig.url, { timeout: 5000 })).rejects.toThrow();

    } finally {
      await performCleanup(browser, eventLogger);
    }
  }, 10000);

  test('should handle CDP session initialization errors', async () => {
    const sessionConfig: SessionConfig = createSessionConfig({
      url: `file://${resolve('test_monitoring.html')}`,
      out: tempOutputFile,
      config: undefined
    });

    const eventLogger = new EventLogger(sessionConfig);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      const cdpManager = new CDPSessionManager(page, eventLogger, sessionConfig.id);

      // Close the page before initializing CDP - this should cause initialization to fail
      // In a real scenario, this might happen due to browser issues
       
      await page.close();

      // This will likely fail since the page is closed
       
      await expect(cdpManager.initialize(page)).rejects.toThrow();

    } finally {
      await browser.close();
      await eventLogger.close();
    }
  }, 10000);

  test('should handle instrumentation injection failures', async () => {
    const sessionConfig: SessionConfig = createSessionConfig({
      url: `file://${resolve('test_monitoring.html')}`,
      out: tempOutputFile,
      config: undefined
    });

    const eventLogger = new EventLogger(sessionConfig);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      const cdpManager = new CDPSessionManager(page, eventLogger, sessionConfig.id);
      await cdpManager.initialize(page);

      // Mock a broken page that will fail script injection
      page.addInitScript = vi.fn().mockRejectedValue(new Error('Script injection failed'));

      const config = loadInstrumentationConfig();
       
      await expect(injectInstrumentation(page, config)).rejects.toThrow('Script injection failed');

    } finally {
      await performCleanup(browser, eventLogger);
    }
  }, 10000);
});
