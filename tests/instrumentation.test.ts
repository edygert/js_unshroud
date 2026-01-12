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
    __js_unshroud_trackObject?: (obj: any, label: string, options?: any) => any;
    __test_log_event?: (event: string) => void;
  }
}

describe('Instrumentation Scripts', () => {
  let browser: Browser;
  let page: Page;
const bootstrapScript = readFileSync(join(process.cwd(), 'src/instrumentation/bootstrap.js'), 'utf-8');
const networkHooksScript = readFileSync(join(process.cwd(), 'src/instrumentation/network-hooks.js'), 'utf-8');
const storageHooksScript = readFileSync(join(process.cwd(), 'src/instrumentation/storage-hooks.js'), 'utf-8');
const timerHooksScript = readFileSync(join(process.cwd(), 'src/instrumentation/timer-hooks.js'), 'utf-8');
const domHooksScript = readFileSync(join(process.cwd(), 'src/instrumentation/dom-hooks.js'), 'utf-8');
const fingerprintingHooksScript = readFileSync(join(process.cwd(), 'src/instrumentation/fingerprinting-hooks.js'), 'utf-8');
const objectTrackingScript = readFileSync(join(process.cwd(), 'src/instrumentation/object-tracking.js'), 'utf-8');

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

  describe('Timer Hooks Script', () => {
    test('should intercept setTimeout calls', async () => {
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

      await page.addInitScript(timerHooksScript); // Load timer hooks first
      await page.addInitScript(bootstrapScript); // Bootstrap second
      await page.goto('about:blank');

      await page.evaluate(() => {
        setTimeout(() => {}, 1000);
      });

      await page.waitForTimeout(100);

      const timerEvents = events.filter(e => e.type === 'timer' && e.timerType === 'setTimeout');
      expect(timerEvents.length).toBeGreaterThan(0);
      expect(timerEvents[0]).toMatchObject({
        type: 'timer',
        timerType: 'setTimeout',
        operation: 'create'
      });
      expect(timerEvents[0].handler).toContain('function');
      await page.close();
    });

    test('should intercept setInterval calls', async () => {
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
      await page.addInitScript(timerHooksScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        const id = setInterval(() => {}, 1000);
        clearInterval(id);
      });

      await page.waitForTimeout(100);

      const timerEvents = events.filter(e => e.type === 'timer' && e.timerType === 'setInterval');
      expect(timerEvents.length).toBeGreaterThan(0);
      expect(timerEvents[0]).toMatchObject({
        type: 'timer',
        timerType: 'setInterval',
        operation: 'create',
        delay: 1000
      });
      await page.close();
    });

    test('should intercept requestAnimationFrame calls', async () => {
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
      await page.addInitScript(timerHooksScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        requestAnimationFrame(() => {});
      });

      await page.waitForTimeout(100);

      const timerEvents = events.filter(e => e.type === 'timer' && e.timerType === 'requestAnimationFrame');
      expect(timerEvents.length).toBeGreaterThan(0);
      expect(timerEvents[0]).toMatchObject({
        type: 'timer',
        timerType: 'requestAnimationFrame',
        operation: 'create'
      });
      await page.close();
    });
  });

  describe('DOM Hooks Script', () => {
    test('should intercept addEventListener calls', async () => {
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
      await page.addInitScript(domHooksScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        document.addEventListener('click', () => {});
      });

      await page.waitForTimeout(100);

      const domEvents = events.filter(e => e.type === 'dom' && e.operation === 'addEventListener');
      expect(domEvents.length).toBeGreaterThan(0);
      expect(domEvents[0]).toMatchObject({
        type: 'dom',
        eventType: 'click',
        operation: 'addEventListener'
      });
      await page.close();
    });

    test('should intercept DOM mutation methods', async () => {
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
      await page.addInitScript(domHooksScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        const div = document.createElement('div');
        document.body.appendChild(div);
      });

      await page.waitForTimeout(100);

      const mutationEvents = events.filter(e => e.type === 'dom' && e.operation === 'appendChild');
      expect(mutationEvents.length).toBeGreaterThan(0);
      expect(mutationEvents[0]).toMatchObject({
        type: 'dom',
        operation: 'appendChild',
        addedNode: 'div'
      });
      await page.close();
    });

    test('should intercept innerHTML changes', async () => {
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
      await page.addInitScript(domHooksScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        document.body.innerHTML = '<p>test</p>';
      });

      await page.waitForTimeout(100);

      const innerHtmlEvents = events.filter(e => e.type === 'dom' && e.operation === 'innerHTML');
      expect(innerHtmlEvents.length).toBeGreaterThan(0);
      expect(innerHtmlEvents[0]).toMatchObject({
        type: 'dom',
        operation: 'innerHTML'
      });
      expect(innerHtmlEvents[0].valueLength).toBeGreaterThan(0);
      await page.close();
    });
  });

  describe('Fingerprinting Hooks Script', () => {
    test('should intercept canvas toDataURL calls', async () => {
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
      await page.addInitScript(fingerprintingHooksScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx?.fillRect(0, 0, 10, 10);
        canvas.toDataURL();
      });

      await page.waitForTimeout(100);

      const fingerprintingEvents = events.filter(e => e.type === 'fingerprinting' && e.method === 'toDataURL');
      expect(fingerprintingEvents.length).toBeGreaterThan(0);
      expect(fingerprintingEvents[0]).toMatchObject({
        type: 'fingerprinting',
        method: 'toDataURL',
        operation: 'canvas_fingerprint'
      });
      await page.close();
    });

    test('should intercept navigator property reads', async () => {
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
      await page.addInitScript(fingerprintingHooksScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        navigator.userAgent;
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        navigator.language;
      });

      await page.waitForTimeout(100);

      const uaEvents = events.filter(e => e.type === 'fingerprinting' && e.method === 'navigator.userAgent');
      const langEvents = events.filter(e => e.type === 'fingerprinting' && e.method === 'navigator.language');

      expect(uaEvents.length).toBeGreaterThan(0);
      expect(langEvents.length).toBeGreaterThan(0);
      expect(uaEvents[0].operation).toBe('navigator_read');
      await page.close();
    });
  });

  describe('Object Tracking Script', () => {
    test('should provide trackObject API', async () => {
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
      await page.addInitScript(objectTrackingScript);
      await page.goto('about:blank');

      const apiExists = await page.evaluate(() => {
        return typeof window.__js_unshroud_trackObject === 'function';
      });

      expect(apiExists).toBe(true);
      await page.close();
    });

    test('should track object property access', async () => {
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
      await page.addInitScript(objectTrackingScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        const testObj = { prop1: 'value1', prop2: 42 };
        const tracked = window.__js_unshroud_trackObject!(testObj, 'testObject');
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _val = tracked.prop1;
        tracked.prop2 = 100;
      });

      await page.waitForTimeout(100);

      const trackingEvents = events.filter(e => e.type === 'object_tracking');
      expect(trackingEvents.length).toBe(2);

      const getEvent = trackingEvents.find(e => e.operation === 'get');
      const setEvent = trackingEvents.find(e => e.operation === 'set');

      expect(getEvent).toMatchObject({
        type: 'object_tracking',
        operation: 'get',
        label: 'testObject',
        property: 'prop1'
      });

      expect(setEvent).toMatchObject({
        type: 'object_tracking',
        operation: 'set',
        label: 'testObject',
        property: 'prop2'
      });
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
