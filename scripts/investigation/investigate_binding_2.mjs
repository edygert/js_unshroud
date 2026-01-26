#!/usr/bin/env node
/**
 * Investigation 2: Compare with and without exposeFunction()
 *
 * Test: Check what bindings exist in different scenarios
 */

import { chromium } from 'playwright-core';

async function checkBindings(page, scenario) {
  const result = await page.evaluate(() => {
    const playwrightRelated = [];
    for (const key in window) {
      if (key.includes('playwright') || key.includes('__pw') || key.startsWith('__')) {
        playwrightRelated.push(key);
      }
    }
    // Also check non-enumerable properties
    const allProps = Object.getOwnPropertyNames(window).filter(k =>
      k.includes('playwright') || k.includes('__pw')
    );

    return {
      hasPlaywrightBinding: '__playwright__binding__' in window,
      hasPlaywrightInitScripts: '__pwInitScripts' in window,
      typeofBinding: typeof window.__playwright__binding__,
      enumerablePlaywrightKeys: playwrightRelated,
      allPlaywrightProps: allProps
    };
  });

  console.log(`\n=== ${scenario} ===`);
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function main() {
  console.log('=== Investigation 2: Comparing binding creation scenarios ===');

  const browser = await chromium.launch({ headless: true });

  // Scenario 1: Fresh page, no exposeFunction
  console.log('\n--- Scenario 1: Fresh page, no exposeFunction ---');
  const context1 = await browser.newContext();
  const page1 = await context1.newPage();
  await page1.goto('about:blank');
  await checkBindings(page1, 'Fresh page - no exposeFunction');
  await context1.close();

  // Scenario 2: Page with exposeFunction
  console.log('\n--- Scenario 2: Page with exposeFunction ---');
  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  await page2.exposeFunction('myTestFunction', () => 'hello');
  await page2.goto('about:blank');
  await checkBindings(page2, 'After exposeFunction');
  await context2.close();

  // Scenario 3: Page with addInitScript only
  console.log('\n--- Scenario 3: Page with addInitScript only ---');
  const context3 = await browser.newContext();
  const page3 = await context3.newPage();
  await page3.addInitScript(() => {
    window.__test_init_ran__ = true;
  });
  await page3.goto('about:blank');
  await checkBindings(page3, 'After addInitScript only');
  await context3.close();

  await browser.close();
}

main().catch(console.error);
