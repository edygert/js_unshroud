#!/usr/bin/env bun

/**
 * Standalone Verification Tool: Runtime.enable() Detection Test
 *
 * Tests whether the classic Error.stack getter trap CDP detection technique
 * still works after V8's May 2025 security changes.
 *
 * Usage:
 *   bun run verify-runtime-detection.ts                    # All scenarios
 *   bun run verify-runtime-detection.ts runtime-enabled    # Scenario 1 only
 *   bun run verify-runtime-detection.ts runtime-disabled   # Scenario 2 only
 *   bun run verify-runtime-detection.ts no-runtime         # Scenario 3 only
 */

import { chromium, type Browser, type Page, type CDPSession } from 'playwright-core';
import { join } from 'path';

type Scenario = 'runtime-enabled' | 'runtime-disabled' | 'no-runtime';

interface DetectionResult {
  scenario: Scenario;
  detected: boolean;
  getterAccessed: boolean;
  riskLevel: 'HIGH' | 'NONE';
  chromeVersion: string;
  explanation: string;
}

async function runDetectionTest(scenario: Scenario): Promise<DetectionResult> {
  const browser: Browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page: Page = await browser.newPage();
  let cdpSession: CDPSession | null = null;

  const results: DetectionResult = {
    scenario,
    detected: false,
    getterAccessed: false,
    riskLevel: 'NONE',
    chromeVersion: '',
    explanation: ''
  };

  try {
    // Capture console output from test page
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push(text);

      // Parse structured metrics
      if (text.startsWith('DETECTION_RESULT: ')) {
        results.detected = text.includes('DETECTED') && !text.includes('NOT DETECTED');
      }
      if (text.startsWith('GETTER_ACCESSED: ')) {
        results.getterAccessed = text.includes('true');
      }
    });

    // Create CDP session BEFORE navigation
    cdpSession = await page.context().newCDPSession(page);

    // SCENARIO-SPECIFIC CDP CONFIGURATION
    switch (scenario) {
      case 'runtime-enabled':
        // Scenario 1: Runtime.enable() active (current js_unshroud behavior)
        await cdpSession.send('Runtime.enable', {});
        results.explanation = 'Runtime.enable() called and kept active throughout page lifecycle';
        break;

      case 'runtime-disabled':
        // Scenario 2: Fire-and-forget (enable then immediately disable)
        await cdpSession.send('Runtime.enable', {});
        await cdpSession.send('Runtime.disable', {});
        results.explanation = 'Runtime.enable() called then disabled before navigation (fire-and-forget)';
        break;

      case 'no-runtime':
        // Scenario 3: Runtime never enabled (baseline control)
        // Don't call Runtime.enable() at all
        results.explanation = 'Runtime.enable() never called (baseline control)';
        break;
    }

    // Navigate to test fixture
    const fixturePath = 'file://' + join(process.cwd(), 'tests/fixtures/runtime-detection-test.html');
    await page.goto(fixturePath, { waitUntil: 'networkidle' });

    // Wait for test to complete
    await page.waitForFunction(() => {
      return document.body.innerText.includes('TEST_COMPLETE') ||
             document.querySelector('#results')?.innerHTML?.includes('Detection Test Results');
    }, { timeout: 5000 });

    // Extra delay to ensure all console messages captured
    await page.waitForTimeout(1000);

    // Extract Chrome version
    const userAgent = await page.evaluate(() => navigator.userAgent);
    const versionMatch = userAgent.match(/Chrome\/(\d+)/);
    results.chromeVersion = versionMatch ? versionMatch[1] : 'Unknown';

    // Update risk level based on detection
    results.riskLevel = results.detected ? 'HIGH' : 'NONE';

  } catch (error) {
    console.error(`Error in scenario ${scenario}:`, error);
    results.explanation += ` [ERROR: ${error instanceof Error ? error.message : String(error)}]`;
  } finally {
    // Cleanup
    if (cdpSession) {
      try {
        await cdpSession.detach();
      } catch {
        // Ignore detach errors
      }
    }
    await browser.close();
  }

  return results;
}

function formatResults(results: DetectionResult[]): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════════════');
  lines.push('  Runtime.enable() Detection Verification Results');
  lines.push('═══════════════════════════════════════════════════════════════════════');
  lines.push('');

  // Chrome version (from first result)
  const chromeVersion = results[0]?.chromeVersion || 'Unknown';
  lines.push(`Chrome Version: ${chromeVersion}`);
  lines.push('');

  // Expected behavior
  const expectedVersion = 125; // Chrome M125 (May 2025)
  const versionNum = parseInt(chromeVersion);
  const isNewChrome = !isNaN(versionNum) && versionNum >= expectedVersion;

  lines.push('Expected Behavior:');
  if (isNewChrome) {
    lines.push(`  ✅ Chrome ${chromeVersion} >= M${expectedVersion} (May 2025)`);
    lines.push('  ✅ V8 getter guard should be active');
    lines.push('  ✅ Error.stack getter should NOT be invoked');
    lines.push('  ✅ Expected Result: NOT DETECTED (all scenarios)');
  } else {
    lines.push(`  ⚠️  Chrome ${chromeVersion} < M${expectedVersion} (Pre-May 2025)`);
    lines.push('  ⚠️  V8 getter guard may not be active');
    lines.push('  ⚠️  Error.stack getter MAY be invoked when Runtime.enable() is active');
    lines.push('  ⚠️  Expected Result: DETECTED (runtime-enabled scenario)');
  }
  lines.push('');
  lines.push('───────────────────────────────────────────────────────────────────────');
  lines.push('');

  // Results table
  results.forEach((result, idx) => {
    const icon = result.detected ? '🔴' : '✅';
    const status = result.detected ? 'DETECTED' : 'NOT DETECTED';

    lines.push(`${idx + 1}. ${result.scenario.toUpperCase()}`);
    lines.push(`   Status: ${icon} ${status}`);
    lines.push(`   Getter Accessed: ${result.getterAccessed}`);
    lines.push(`   Risk Level: ${result.riskLevel === 'HIGH' ? '🔴 HIGH' : '✅ NONE'}`);
    lines.push(`   Configuration: ${result.explanation}`);
    lines.push('');
  });

  lines.push('───────────────────────────────────────────────────────────────────────');
  lines.push('');

  // Analysis
  lines.push('Analysis:');
  lines.push('');

  const anyDetected = results.some(r => r.detected);
  const runtimeEnabledResult = results.find(r => r.scenario === 'runtime-enabled');
  const noRuntimeResult = results.find(r => r.scenario === 'no-runtime');

  if (!anyDetected) {
    lines.push('✅ CONCLUSION: V8 Getter Guard is ACTIVE');
    lines.push('');
    lines.push('   • Error.stack getter was NOT invoked in any scenario');
    lines.push('   • CDP detection technique is INEFFECTIVE (as expected post-May 2025)');
    lines.push('   • Runtime.enable() does NOT expose this detection vector');
    lines.push('   • js_unshroud is SAFE from this specific attack');
    lines.push('');
    lines.push('✅ RECOMMENDATION: Keep Runtime.enable() active');
    lines.push('   • No detection risk from Error.stack getter trap');
    lines.push('   • Provides valuable Runtime.exceptionThrown events');
    lines.push('   • Fire-and-forget pattern NOT needed for this vector');
  } else {
    lines.push('⚠️  CONCLUSION: Detection Technique Still Works');
    lines.push('');

    if (runtimeEnabledResult?.detected && !noRuntimeResult?.detected) {
      lines.push('   • Error.stack getter WAS invoked when Runtime.enable() active');
      lines.push('   • CDP detection technique is EFFECTIVE (unexpected for post-May 2025)');
      lines.push('   • Runtime.enable() DOES expose detection vector');
      lines.push('   • Possible causes:');
      lines.push('     - Chrome version < M125 (V8 fix not present)');
      lines.push('     - V8 protection disabled/regressed');
      lines.push('     - Detection technique evolved beyond V8 fix');
      lines.push('');
      lines.push('⚠️  RECOMMENDATION: Consider mitigation strategies');
      lines.push('   • Option 1: Fire-and-forget Runtime.enable()');
      lines.push('   • Option 2: Switch to page.on("pageerror") instead of Runtime.exceptionThrown');
      lines.push('   • Option 3: Accept detection (if malware analysis in isolated VMs)');
    } else {
      lines.push('   • Unexpected detection pattern');
      lines.push('   • Review individual scenario results above');
    }
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════════════');
  lines.push('');

  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const requestedScenario = args[0] as Scenario | undefined;

  // Determine which scenarios to run
  let scenarios: Scenario[];
  if (requestedScenario && ['runtime-enabled', 'runtime-disabled', 'no-runtime'].includes(requestedScenario)) {
    scenarios = [requestedScenario];
  } else {
    scenarios = ['runtime-enabled', 'runtime-disabled', 'no-runtime'];
  }

  console.log('');
  console.log('Starting Runtime.enable() Detection Verification...');
  console.log(`Running ${scenarios.length} scenario(s): ${scenarios.join(', ')}`);
  console.log('');

  // Run all scenarios
  const results: DetectionResult[] = [];
  for (const scenario of scenarios) {
    console.log(`Testing scenario: ${scenario}...`);
    const result = await runDetectionTest(scenario);
    results.push(result);
  }

  // Format and display results
  const output = formatResults(results);
  console.log(output);

  // Exit with appropriate code
  const anyDetected = results.some(r => r.detected);
  const expectedSafe = true; // We expect detection to NOT work post-May 2025

  if (!anyDetected === expectedSafe) {
    process.exit(0); // Success - behavior matches expectation
  } else {
    process.exit(1); // Unexpected behavior
  }
}

// Execute
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
