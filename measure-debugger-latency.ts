#!/usr/bin/env bun

/**
 * Standalone script to measure debugger latency with different implementations.
 *
 * CRITICAL: Only the FIRST debugger statement matters for detection!
 * For fire-and-forget technique, Debugger.disable() is called after first pause,
 * making all subsequent debugger statements run at native speed (~0ms).
 *
 * Usage:
 *   bun run measure-debugger-latency.ts [implementation]
 *
 * Where implementation is:
 *   - current: Current log-then-resume approach (keeps domain enabled)
 *   - optimized: Fire-and-forget + immediate disable (disables after first)
 *   - baseline: No Debugger domain (native performance)
 */

import { chromium, type CDPSession } from 'playwright-core';
import { join } from 'path';

type Implementation = 'current' | 'optimized' | 'baseline';

async function measureLatency(implementation: Implementation) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  Measuring ${implementation.toUpperCase()} Implementation`);
  console.log(`${'='.repeat(70)}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let cdpSession: CDPSession | undefined;
  let firstDebuggerLatency: number | null = null;

  // Set up debugger handling based on implementation
  if (implementation !== 'baseline') {
    cdpSession = await page.context().newCDPSession(page);
    await cdpSession.send('Debugger.enable', {});

    if (implementation === 'current') {
      // Current: Log then resume (slow, keeps domain enabled)
      cdpSession.on('Debugger.paused', (params) => {
        void (async () => {
          // Extract location (simulate logging overhead)
          const location = params.callFrames[0];
          const event = {
            type: 'debugger',
            reason: params.reason,
            url: location?.url,
            lineNumber: location?.location?.lineNumber,
            columnNumber: location?.location?.columnNumber
          };

          // Simulate queueing log event
          Promise.resolve(event);

          // THEN resume (domain stays enabled)
          await cdpSession?.send('Debugger.resume', {});
        })();
      });
    } else if (implementation === 'optimized') {
      // Optimized: Fire-and-forget resume + disable (fast)
      cdpSession.on('Debugger.paused', () => {
        void (async () => {
          // Fire-and-forget (immediate)
          cdpSession?.send('Debugger.resume', {}).catch(() => {});
          cdpSession?.send('Debugger.disable', {}).catch(() => {});

          // Background logging happens after
        })();
      });
    }
  }

  // Intercept console logs to get first debugger latency
  page.on('console', msg => {
    const text = msg.text();
    const match = text.match(/FIRST_DEBUGGER_LATENCY: ([\d.]+)ms/);
    if (match && match[1]) {
      firstDebuggerLatency = parseFloat(match[1]);
    }
  });

  // Navigate to timing test page
  const fixturePath = 'file://' + join(process.cwd(), 'tests/fixtures/debugger-timing.html');
  await page.goto(fixturePath);

  // Wait for measurements to complete
  await page.waitForTimeout(2000);

  // Analyze results
  if (firstDebuggerLatency === null) {
    console.error('❌ ERROR: No timing data collected!\n');
    await browser.close();
    return;
  }

  // Assert non-null for TypeScript (checked above)
  const latency: number = firstDebuggerLatency;

  // Determine detection risk
  let detectionRisk = '';
  let riskIcon = '';
  if (latency > 10) {
    detectionRisk = 'HIGH - Detectable by all thresholds';
    riskIcon = '🔴';
  } else if (latency > 5) {
    detectionRisk = 'MEDIUM - Detectable by aggressive (5ms) thresholds';
    riskIcon = '🟡';
  } else if (latency > 1) {
    detectionRisk = 'LOW - May evade most thresholds';
    riskIcon = '🟢';
  } else {
    detectionRisk = 'NONE - Native speed (undetectable)';
    riskIcon = '✅';
  }

  // Print results
  console.log('━'.repeat(70));
  console.log(`  CRITICAL MEASUREMENT (What Malware Detects)`);
  console.log('━'.repeat(70));
  console.log(`  First Debugger Latency: ${riskIcon}  ${latency.toFixed(3)} ms\n`);

  console.log('━'.repeat(70));
  console.log(`  Detection Risk Assessment`);
  console.log('━'.repeat(70));
  console.log(`  > 20ms (Conservative):     ${latency > 20 ? '🔴 DETECTED' : '✅ Undetected'}`);
  console.log(`  > 10ms (Moderate):         ${latency > 10 ? '🔴 DETECTED' : '✅ Undetected'}`);
  console.log(`  > 5ms  (Aggressive):       ${latency > 5 ? '🔴 DETECTED' : '✅ Undetected'}`);
  console.log(`  > 3ms  (Very Aggressive):  ${latency > 3 ? '🔴 DETECTED' : '✅ Undetected'}\n`);

  console.log('━'.repeat(70));
  console.log(`  Overall Risk: ${riskIcon} ${detectionRisk}`);
  console.log('━'.repeat(70));

  console.log('\nNote: Subsequent debugger statements are irrelevant - they run at native');
  console.log('      speed (~0ms) after Debugger.disable() is called.\n');

  if (cdpSession) {
    await cdpSession.detach();
  }
  await browser.close();
}

// Main execution
const implementation = (process.argv[2] as Implementation) || 'current';

if (!['current', 'optimized', 'baseline'].includes(implementation)) {
  console.error('❌ Invalid implementation. Use: current, optimized, or baseline');
  process.exit(1);
}

measureLatency(implementation).catch(console.error);
