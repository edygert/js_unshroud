import { describe, test, expect, beforeEach, afterAll } from 'vitest';
import { runMonitoring } from '../src/cli/runner';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import type { InstrumentationConfig } from '../src/schema/types';

// Run tests sequentially to avoid browser resource contention
// Each test launches a Chromium instance via runMonitoring()
describe('Behavioral Simulation Integration Tests', () => {
  const testOutputDir = '/tmp';
  const createdFiles: string[] = [];

  // Add delay between tests to ensure browser cleanup completes
  // Prevents resource contention when multiple tests run consecutively
  let isFirstTest = true;
  beforeEach(async () => {
    if (!isFirstTest) {
      // Wait 500ms between tests for browser cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    isFirstTest = false;
  });

  afterAll(() => {
    // Clean up test output files
    createdFiles.forEach(file => {
      if (existsSync(file)) {
        try {
          unlinkSync(file);
        } catch {
          // Ignore cleanup errors
        }
      }
    });
  });

  test('should execute with behavioral simulation enabled (low intensity)', async () => {
    const outputFile = join(testOutputDir, `behavioral-low-${Date.now()}.jsonl`);
    createdFiles.push(outputFile);

    const config: Partial<InstrumentationConfig> = {
      enableHeadlessMitigation: true,
      enableBehaviorSimulation: true,
      behaviorSimulationIntensity: 'low',
      monitoringTimeoutSeconds: 3
    };

    const fixtureUrl = `file://${join(__dirname, 'fixtures/interaction-gate-test.html')}`;

    await runMonitoring({
      url: fixtureUrl,
      out: outputFile,
      config
    });

    expect(existsSync(outputFile)).toBe(true);

    const events = readFileSync(outputFile, 'utf-8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));

    expect(events.length).toBeGreaterThan(0);
  }, 15000);

  test('should execute with behavioral simulation enabled (medium intensity)', async () => {
    const outputFile = join(testOutputDir, `behavioral-medium-${Date.now()}.jsonl`);
    createdFiles.push(outputFile);

    const config: Partial<InstrumentationConfig> = {
      enableHeadlessMitigation: true,
      enableBehaviorSimulation: true,
      behaviorSimulationIntensity: 'medium',
      monitoringTimeoutSeconds: 3
    };

    const fixtureUrl = `file://${join(__dirname, 'fixtures/interaction-gate-test.html')}`;

    await runMonitoring({
      url: fixtureUrl,
      out: outputFile,
      config
    });

    expect(existsSync(outputFile)).toBe(true);
  }, 15000);

  test('should execute with behavioral simulation enabled (high intensity)', async () => {
    const outputFile = join(testOutputDir, `behavioral-high-${Date.now()}.jsonl`);
    createdFiles.push(outputFile);

    const config: Partial<InstrumentationConfig> = {
      enableHeadlessMitigation: true,
      enableBehaviorSimulation: true,
      behaviorSimulationIntensity: 'high',
      enableFormInteraction: true,
      monitoringTimeoutSeconds: 3
    };

    const fixtureUrl = `file://${join(__dirname, 'fixtures/form-submission-gate-test.html')}`;

    await runMonitoring({
      url: fixtureUrl,
      out: outputFile,
      config
    });

    expect(existsSync(outputFile)).toBe(true);
  }, 15000);

  test('should execute with form interaction disabled', async () => {
    const outputFile = join(testOutputDir, `behavioral-noform-${Date.now()}.jsonl`);
    createdFiles.push(outputFile);

    const config: Partial<InstrumentationConfig> = {
      enableHeadlessMitigation: true,
      enableBehaviorSimulation: true,
      behaviorSimulationIntensity: 'medium',
      enableFormInteraction: false,
      monitoringTimeoutSeconds: 3
    };

    const fixtureUrl = `file://${join(__dirname, 'fixtures/form-submission-gate-test.html')}`;

    await runMonitoring({
      url: fixtureUrl,
      out: outputFile,
      config
    });

    expect(existsSync(outputFile)).toBe(true);
  }, 15000);

  test('should execute with checkout simulation enabled', async () => {
    const outputFile = join(testOutputDir, `behavioral-checkout-${Date.now()}.jsonl`);
    createdFiles.push(outputFile);

    const config: Partial<InstrumentationConfig> = {
      enableHeadlessMitigation: true,
      enableBehaviorSimulation: true,
      behaviorSimulationIntensity: 'high',
      enableFormInteraction: true,
      enableCheckoutSimulation: true,
      monitoringTimeoutSeconds: 3
    };

    const fixtureUrl = `file://${join(__dirname, 'fixtures/checkout-skimmer-test.html')}?checkout`;

    await runMonitoring({
      url: fixtureUrl,
      out: outputFile,
      config
    });

    expect(existsSync(outputFile)).toBe(true);
  }, 15000);

  test('should execute with behavioral simulation disabled', async () => {
    const outputFile = join(testOutputDir, `behavioral-disabled-${Date.now()}.jsonl`);
    createdFiles.push(outputFile);

    const config: Partial<InstrumentationConfig> = {
      enableHeadlessMitigation: true,
      enableBehaviorSimulation: false,
      monitoringTimeoutSeconds: 2
    };

    const fixtureUrl = `file://${join(__dirname, 'fixtures/interaction-gate-test.html')}`;

    await runMonitoring({
      url: fixtureUrl,
      out: outputFile,
      config
    });

    expect(existsSync(outputFile)).toBe(true);
  }, 10000);

  test('should execute with time-delayed behavior enabled', async () => {
    const outputFile = join(testOutputDir, `behavioral-timedelay-${Date.now()}.jsonl`);
    createdFiles.push(outputFile);

    const config: Partial<InstrumentationConfig> = {
      enableHeadlessMitigation: true,
      enableBehaviorSimulation: true,
      behaviorSimulationIntensity: 'medium',
      enableTimeDelayedBehavior: true,
      monitoringTimeoutSeconds: 5 // Short for test, normally 60+
    };

    const fixtureUrl = `file://${join(__dirname, 'fixtures/interaction-gate-test.html')}`;

    await runMonitoring({
      url: fixtureUrl,
      out: outputFile,
      config
    });

    expect(existsSync(outputFile)).toBe(true);
  }, 30000);
});
