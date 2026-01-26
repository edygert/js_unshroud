#!/usr/bin/env node
/**
 * Investigation 1: Does Playwright create __playwright__binding__ unconditionally?
 *
 * Test: Launch Playwright WITHOUT using exposeFunction() and check if the binding exists
 */

import { chromium } from 'playwright-core';

async function main() {
  console.log('=== Investigation 1: Is __playwright__binding__ created unconditionally? ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // DON'T use page.exposeFunction() - just navigate and check
  await page.goto('about:blank');

  // Check if the binding exists
  const result = await page.evaluate(() => {
    return {
      hasPlaywrightBinding: '__playwright__binding__' in window,
      hasPlaywrightInitScripts: '__pwInitScripts' in window,
      typeofBinding: typeof window.__playwright__binding__,
      windowKeys: Object.keys(window).filter(k => k.includes('playwright') || k.includes('__pw'))
    };
  });

  console.log('Results WITHOUT using exposeFunction():');
  console.log(JSON.stringify(result, null, 2));

  await browser.close();
}

main().catch(console.error);
