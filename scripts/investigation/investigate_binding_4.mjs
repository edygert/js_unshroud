#!/usr/bin/env node
/**
 * Investigation 4: Full CDP-only approach without exposeFunction
 *
 * Test: Can we completely avoid __playwright__binding__ by using only CDP?
 */

import { chromium } from 'playwright-core';

async function main() {
  console.log('=== Investigation 4: Full CDP-only approach ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Get CDP session BEFORE any navigation
  const cdpSession = await context.newCDPSession(page);

  // Enable required CDP domains
  await cdpSession.send('Runtime.enable');
  await cdpSession.send('Page.enable');

  // Create a custom binding with an innocuous name
  const bindingName = '_0x' + Math.random().toString(16).substr(2, 8); // Random hex name
  console.log('Using random binding name:', bindingName);

  await cdpSession.send('Runtime.addBinding', { name: bindingName });

  // Collect messages
  const messages = [];
  cdpSession.on('Runtime.bindingCalled', (event) => {
    if (event.name === bindingName) {
      messages.push(JSON.parse(event.payload));
    }
  });

  // Add init script that creates logging function using our binding
  // This script runs BEFORE any page content
  await cdpSession.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      (function() {
        // Create our logging function using the CDP binding
        const binding = window['${bindingName}'];
        if (binding) {
          window.__js_unshroud_log = function(data) {
            binding(JSON.stringify({ type: 'log', data: data }));
          };
          // Make it non-enumerable
          Object.defineProperty(window, '__js_unshroud_log', {
            enumerable: false
          });
        }
      })();
    `
  });

  // Navigate to a test page
  await page.goto('about:blank');

  // Test the logging
  await page.evaluate(() => {
    window.__js_unshroud_log({ message: 'Test log from page' });
    window.__js_unshroud_log({ event: 'click', target: 'button' });
  });

  await new Promise(r => setTimeout(r, 100));

  // Check for Playwright bindings
  const result = await page.evaluate((bn) => {
    const suspicious = [];
    for (const key of Object.getOwnPropertyNames(window)) {
      if (key.includes('playwright') || key.includes('__pw')) {
        suspicious.push(key);
      }
    }

    return {
      hasPlaywrightBinding: '__playwright__binding__' in window,
      hasOurBinding: bn in window,
      suspiciousProps: suspicious,
      // Full detection check
      isPlaywright: '__pwInitScripts' in window || '__playwright__binding__' in window
    };
  }, bindingName);

  console.log('\nDetection results:');
  console.log(JSON.stringify(result, null, 2));

  console.log('\nReceived messages:', messages);

  await browser.close();
}

main().catch(console.error);
