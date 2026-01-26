#!/usr/bin/env node
/**
 * Investigation 3: Use CDP Runtime.addBinding directly with custom name
 *
 * Test: Can we create our own binding with a non-detectable name?
 */

import { chromium } from 'playwright-core';

async function main() {
  console.log('=== Investigation 3: CDP Runtime.addBinding with custom name ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Get CDP session
  const cdpSession = await context.newCDPSession(page);

  // Enable Runtime domain
  await cdpSession.send('Runtime.enable');

  // Add our own binding with a custom (less detectable) name
  // Using a name that looks like a legitimate browser internal
  const customBindingName = '__cdp_internal_msg_handler__';

  await cdpSession.send('Runtime.addBinding', {
    name: customBindingName
  });

  // Listen for binding calls
  const receivedMessages = [];
  cdpSession.on('Runtime.bindingCalled', (event) => {
    if (event.name === customBindingName) {
      console.log('Received via CDP binding:', event.payload);
      receivedMessages.push(event.payload);
    }
  });

  // Inject a script that uses our custom binding
  await page.addInitScript(`
    window.__customLog = function(data) {
      if (typeof window['${customBindingName}'] === 'function') {
        window['${customBindingName}'](JSON.stringify(data));
      }
    };
  `);

  await page.goto('about:blank');

  // Test calling our custom binding from page context
  await page.evaluate((bindingName) => {
    window[bindingName]('Hello from page context!');
    window.__customLog({ test: 'data', value: 123 });
  }, customBindingName);

  // Wait a bit for messages
  await new Promise(r => setTimeout(r, 100));

  // Check what bindings exist now
  const result = await page.evaluate((bindingName) => {
    return {
      hasPlaywrightBinding: '__playwright__binding__' in window,
      hasCustomBinding: bindingName in window,
      typeofCustomBinding: typeof window[bindingName],
      // Check what other __ prefixed properties exist
      doubleUnderscoreProps: Object.getOwnPropertyNames(window).filter(k =>
        k.startsWith('__') && k.endsWith('__')
      )
    };
  }, customBindingName);

  console.log('\nBinding check results:');
  console.log(JSON.stringify(result, null, 2));

  console.log('\nReceived messages:', receivedMessages);

  await browser.close();
}

main().catch(console.error);
