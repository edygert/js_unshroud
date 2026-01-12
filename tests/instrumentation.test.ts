/* eslint-disable no-undef */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';
import { readFileSync } from 'fs';
import { join } from 'path';

// Type augmentation for instrumentation globals
declare global {
  interface Window {
    __js_unshroud_log?: (data: string) => void;
    __js_unshroud_loaded?: boolean;
    __js_unshroud_originals?: {
      console?: Console;
      fetch?: typeof fetch;
      XMLHttpRequest?: typeof XMLHttpRequest;
      WebSocket?: typeof WebSocket;
      localStorage?: Storage;
      sessionStorage?: Storage;
    };
    __test_log_event?: (event: string) => void;
  }
}

describe('Instrumentation Scripts', () => {
  let browser: Browser;
  let page: Page;
  const bootstrapScript = readFileSync(join(process.cwd(), 'src/instrumentation/bootstrap.js'), 'utf-8');
  const networkHooksScript = readFileSync(join(process.cwd(), 'src/instrumentation/network-hooks.js'), 'utf-8');
  const storageHooksScript = readFileSync(join(process.cwd(), 'src/instrumentation/storage-hooks.js'), 'utf-8');

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  describe('Bootstrap Script', () => {
    test('should initialize __js_unshroud_log function', async () => {
      page = await browser.newPage();
      await page.addInitScript(bootstrapScript);
      await page.goto('about:blank');

      const hasLogger = await page.evaluate(() => {
        return typeof window.__js_unshroud_log === 'function';
      });

      expect(hasLogger).toBe(true);
      await page.close();
    });

    test('should intercept console methods', async () => {
      page = await browser.newPage();
      await page.addInitScript(bootstrapScript);
      
      const events: any[] = [];
      await page.exposeFunction('__test_log_event', (event: string) => {
        events.push(JSON.parse(event));
      });

      await page.addInitScript(() => {
        window.__js_unshroud_log = (data: string) => {
          (window as any).__test_log_event(data);
        };
      });

      await page.goto('about:blank');
      
      // Give time for console interception to activate
      await page.waitForTimeout(200);

      await page.evaluate(() => {
        console.log('test message');
      });

      await page.waitForTimeout(100);

      const consoleEvents = events.filter(e => e.type === 'console' && e.message === 'test message');
      expect(consoleEvents.length).toBeGreaterThan(0);
      await page.close();
    });
  });

  describe('Network Hooks Script', () => {
    test('should intercept fetch calls', async () => {
      page = await browser.newPage();
      
      const events: any[] = [];
      await page.exposeFunction('__test_log_event', (event: string) => {
        events.push(JSON.parse(event));
      });

      await page.addInitScript(() => {
        window.__js_unshroud_log = (data: string) => {
          (window as any).__test_log_event(data);
        };
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(networkHooksScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        fetch('https://api.example.com/data').catch(() => {});
      });

      await page.waitForTimeout(500);

      const networkEvents = events.filter(e => e.type === 'network' && e.url.includes('api.example.com'));
      expect(networkEvents.length).toBeGreaterThan(0);
      expect(networkEvents[0]).toMatchObject({
        type: 'network',
        method: 'GET',
        url: expect.stringContaining('api.example.com')
      });
      await page.close();
    });

    test('should intercept XMLHttpRequest calls', async () => {
      page = await browser.newPage();
      
      const events: any[] = [];
      await page.exposeFunction('__test_log_event', (event: string) => {
        events.push(JSON.parse(event));
      });

      await page.addInitScript(() => {
        window.__js_unshroud_log = (data: string) => {
          (window as any).__test_log_event(data);
        };
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(networkHooksScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://api.example.com/xhr-test');
        xhr.send();
      });

      await page.waitForTimeout(100);

      const xhrEvents = events.filter(e => e.type === 'network' && e.xhr === true);
      expect(xhrEvents.length).toBeGreaterThan(0);
      expect(xhrEvents[0]).toMatchObject({
        type: 'network',
        method: 'GET',
        xhr: true
      });
      await page.close();
    });

    test('should capture stack traces', async () => {
      page = await browser.newPage();
      
      const events: any[] = [];
      await page.exposeFunction('__test_log_event', (event: string) => {
        events.push(JSON.parse(event));
      });

      await page.addInitScript(() => {
        window.__js_unshroud_log = (data: string) => {
          (window as any).__test_log_event(data);
        };
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(networkHooksScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        fetch('https://api.example.com/trace-test').catch(() => {});
      });

      await page.waitForTimeout(100);

      const networkEvents = events.filter(e => e.type === 'network' && e.stackTrace);
      expect(networkEvents.length).toBeGreaterThan(0);
      expect(networkEvents[0].stackTrace).toBeDefined();
      expect(typeof networkEvents[0].stackTrace).toBe('string');
      await page.close();
    });
  });

  describe('Storage Hooks Script', () => {
    test('should intercept localStorage.setItem', async () => {
      page = await browser.newPage();
      await page.addInitScript(bootstrapScript);
      
      const events: any[] = [];
      await page.exposeFunction('__test_log_event', (event: string) => {
        events.push(JSON.parse(event));
      });

      await page.addInitScript(() => {
        window.__js_unshroud_log = (data: string) => {
          (window as any).__test_log_event(data);
        };
      });

      await page.addInitScript(storageHooksScript);
      await page.goto(`file://${join(process.cwd(), 'tests/fixtures/test-page.html')}`);

      await page.evaluate(() => {
        localStorage.setItem('testKey', 'testValue');
      });

      await page.waitForTimeout(100);

      const storageEvents = events.filter(e => e.type === 'storage');
      expect(storageEvents.length).toBeGreaterThan(0);
      expect(storageEvents[0]).toMatchObject({
        type: 'storage',
        storageType: 'localStorage',
        operation: 'setItem',
        key: 'testKey',
        value: 'testValue'
      });
      await page.close();
    });

    test('should intercept sessionStorage.setItem', async () => {
      page = await browser.newPage();
      await page.addInitScript(bootstrapScript);
      
      const events: any[] = [];
      await page.exposeFunction('__test_log_event', (event: string) => {
        events.push(JSON.parse(event));
      });

      await page.addInitScript(() => {
        window.__js_unshroud_log = (data: string) => {
          (window as any).__test_log_event(data);
        };
      });

      await page.addInitScript(storageHooksScript);
      await page.goto(`file://${join(process.cwd(), 'tests/fixtures/test-page.html')}`);

      await page.evaluate(() => {
        sessionStorage.setItem('sessionKey', 'sessionValue');
      });

      await page.waitForTimeout(100);

      const storageEvents = events.filter(e => e.type === 'storage' && e.storageType === 'sessionStorage');
      expect(storageEvents.length).toBeGreaterThan(0);
      expect(storageEvents[0]).toMatchObject({
        type: 'storage',
        storageType: 'sessionStorage',
        operation: 'setItem',
        key: 'sessionKey',
        value: 'sessionValue'
      });
      await page.close();
    });

    test('should track old values when updating storage', async () => {
      page = await browser.newPage();
      await page.addInitScript(bootstrapScript);
      
      const events: any[] = [];
      await page.exposeFunction('__test_log_event', (event: string) => {
        events.push(JSON.parse(event));
      });

      await page.addInitScript(() => {
        window.__js_unshroud_log = (data: string) => {
          (window as any).__test_log_event(data);
        };
      });

      await page.addInitScript(storageHooksScript);
      await page.goto(`file://${join(process.cwd(), 'tests/fixtures/test-page.html')}`);

      await page.evaluate(() => {
        localStorage.setItem('updateKey', 'oldValue');
        localStorage.setItem('updateKey', 'newValue');
      });

      await page.waitForTimeout(100);

      const storageEvents = events.filter(e => e.type === 'storage' && e.key === 'updateKey');
      expect(storageEvents.length).toBe(2);
      expect(storageEvents[1].oldValue).toBe('oldValue');
      expect(storageEvents[1].value).toBe('newValue');
      await page.close();
    });
  });

  describe('Error Handling', () => {
    test('should not break page when instrumentation errors occur', async () => {
      page = await browser.newPage();
      await page.addInitScript(bootstrapScript);
      await page.addInitScript(networkHooksScript);
      await page.addInitScript(storageHooksScript);
      
      // Don't set up logging function - should use fallback
      await page.goto(`file://${join(process.cwd(), 'tests/fixtures/test-page.html')}`);

      // These should not throw errors
      const result = await page.evaluate(() => {
        try {
          console.log('test');
          fetch('https://example.com').catch(() => {});
          localStorage.setItem('test', 'value');
          return true;
        } catch {
          return false;
        }
      });

      expect(result).toBe(true);
      await page.close();
    });
  });
});
