import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { runMonitoring } from '../src/cli/runner.ts';
import { readFileSync, unlinkSync, existsSync, writeFileSync, rmSync } from 'fs';
import { resolve } from 'path';

describe('runMonitoring Function', () => {
  let tempOutputFile: string;
  let isFirstTest = true;

  beforeEach(async () => {
    // Add delay between tests to ensure browser cleanup completes
    // Prevents resource contention when multiple tests run consecutively
    if (!isFirstTest) {
      await new Promise(resolve => globalThis.setTimeout(resolve, 500));
    }
    isFirstTest = false;

    tempOutputFile = `/tmp/runmon-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jsonl`;
  });

  afterEach(() => {
    try {
      if (tempOutputFile && existsSync(tempOutputFile)) {
        unlinkSync(tempOutputFile);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  test('should complete full monitoring cycle with runMonitoring', async () => {
    const args = {
      url: `file://${resolve('tests/fixtures/test_monitoring.html')}`,
      out: tempOutputFile,
      config: undefined
    };

    // This should execute the full runMonitoring function
    await runMonitoring(args);

    // Verify output file was created
    expect(existsSync(tempOutputFile)).toBe(true);

    // Verify events were logged
    const loggedData = readFileSync(tempOutputFile, 'utf-8');
    const events = loggedData.trim().split('\n').map(line => JSON.parse(line));

    // Should have session start/end and monitoring events
    expect(events.length).toBeGreaterThan(0);

    // Should have session_start event
    const sessionStart = events.find(e => e.type === 'session_start');
    expect(sessionStart).toBeDefined();

    // Should have session_end event
    const sessionEnd = events.find(e => e.type === 'session_end');
    expect(sessionEnd).toBeDefined();
  }, 30000);

  test('should handle runMonitoring with custom config', async () => {
    const args = {
      url: `file://${resolve('tests/fixtures/test_monitoring.html')}`,
      out: tempOutputFile,
      config: './tests/fixtures/valid-config.json'
    };

    await runMonitoring(args);

    expect(existsSync(tempOutputFile)).toBe(true);
    const loggedData = readFileSync(tempOutputFile, 'utf-8');
    const events = loggedData.trim().split('\n').map(line => JSON.parse(line));
    
    expect(events.length).toBeGreaterThan(0);
  }, 30000);

  test('should handle navigation errors in runMonitoring', async () => {
    const args = {
      url: 'http://this-domain-does-not-exist-12345.invalid',
      out: tempOutputFile,
      config: undefined
    };

    // Should throw error due to navigation failure
    await expect(runMonitoring(args)).rejects.toThrow();

    // Output file should still be created (session_start logged before error)
    expect(existsSync(tempOutputFile)).toBe(true);
  }, 15000);

  test('should capture console and network events via runMonitoring', async () => {
    const args = {
      url: `file://${resolve('tests/fixtures/test_monitoring.html')}`,
      out: tempOutputFile,
      config: undefined
    };

    await runMonitoring(args);

    const loggedData = readFileSync(tempOutputFile, 'utf-8');
    const events = loggedData.trim().split('\n').map(line => JSON.parse(line));

    // Should have console events
    const consoleEvents = events.filter(e => e.type === 'console');
    expect(consoleEvents.length).toBeGreaterThan(0);

    // Should have network events (from fetch/XHR in test page)
    const networkEvents = events.filter(e => e.type === 'network');
    expect(networkEvents.length).toBeGreaterThan(0);
  }, 30000);

  test('should properly cleanup on success', async () => {
    const args = {
      url: `file://${resolve('tests/fixtures/test_monitoring.html')}`,
      out: tempOutputFile,
      config: undefined
    };

    // Run monitoring - should complete cleanup successfully
    await runMonitoring(args);

    // If we get here, cleanup didn't hang or error out
    expect(existsSync(tempOutputFile)).toBe(true);
  }, 30000);

  test('should handle partial config in runMonitoring', async () => {
    const args = {
      url: `file://${resolve('tests/fixtures/test_monitoring.html')}`,
      out: tempOutputFile,
      config: './tests/fixtures/partial-config.json'
    };

    await runMonitoring(args);

    const loggedData = readFileSync(tempOutputFile, 'utf-8');
    const events = loggedData.trim().split('\n').map(line => JSON.parse(line));
    
    // Network should be disabled in partial-config.json
    // But console should still work
    const consoleEvents = events.filter(e => e.type === 'console');
    expect(consoleEvents.length).toBeGreaterThan(0);
  }, 30000);
});

describe('Main Function Entry Point', () => {
  let tempOutputFile: string;
  let isFirstTest = true;

  beforeEach(async () => {
    // Add delay between tests to ensure browser cleanup completes
    if (!isFirstTest) {
      await new Promise(resolve => globalThis.setTimeout(resolve, 500));
    }
    isFirstTest = false;

    tempOutputFile = `/tmp/main-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jsonl`;
  });

  afterEach(() => {
    try {
      if (tempOutputFile && existsSync(tempOutputFile)) {
        unlinkSync(tempOutputFile);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  test('should handle errors in monitoring gracefully', async () => {
    // Note: We can't easily test the main() function directly since it calls
    // process.exit(), but we can test runMonitoring which main() calls
    const args = {
      url: 'http://invalid-url-that-will-fail.test',
      out: tempOutputFile,
      config: undefined
    };

    await expect(runMonitoring(args)).rejects.toThrow();
  }, 15000);

  test('should execute with headless mitigation enabled', async () => {
    const args = {
      url: `file://${resolve('tests/fixtures/test_monitoring.html')}`,
      out: tempOutputFile,
      config: {
        enableHeadlessMitigation: true,
        monitoringTimeoutSeconds: 5
      }
    };

    await runMonitoring(args);

    expect(existsSync(tempOutputFile)).toBe(true);

    const loggedData = readFileSync(tempOutputFile, 'utf-8');
    const events = loggedData.trim().split('\n').map(line => JSON.parse(line));

    expect(events.length).toBeGreaterThan(0);

    // Should have headless_mitigation events
    const mitigationEvents = events.filter(e => e.type === 'headless_mitigation');
    expect(mitigationEvents.length).toBeGreaterThan(0);
  }, 20000);

  test('should execute with UDP logging enabled', async () => {
    const args = {
      url: `file://${resolve('tests/fixtures/test_monitoring.html')}`,
      out: tempOutputFile,
      config: {
        outputMode: 'both' as const,
        udpLogging: {
          enabled: true,
          host: '127.0.0.1',
          port: 9999 // Use non-standard port that likely won't have anything listening
        },
        monitoringTimeoutSeconds: 3
      }
    };

    // Should not throw even if UDP send fails
    await runMonitoring(args);

    expect(existsSync(tempOutputFile)).toBe(true);
  }, 15000);

  test('should execute with all instrumentation features enabled', async () => {
    const args = {
      url: `file://${resolve('tests/fixtures/test_monitoring.html')}`,
      out: tempOutputFile,
      config: {
        enableHeadlessMitigation: true,
        enableServiceWorker: true,
        enableFingerprinting: true,
        enableObjectTracking: true,
        enableCodeExecution: true,
        enableEncoding: true,
        enableCryptoJS: true,
        enableWorkers: true,
        enableModules: true,
        enableIframes: true,
        monitoringTimeoutSeconds: 5
      }
    };

    await runMonitoring(args);

    expect(existsSync(tempOutputFile)).toBe(true);

    const loggedData = readFileSync(tempOutputFile, 'utf-8');
    const events = loggedData.trim().split('\n').map(line => JSON.parse(line));

    expect(events.length).toBeGreaterThan(0);
  }, 20000);

  test('should execute with custom monitoring timeout', async () => {
    const args = {
      url: `file://${resolve('tests/fixtures/test_monitoring.html')}`,
      out: tempOutputFile,
      config: {
        monitoringTimeoutSeconds: 2
      }
    };

    await runMonitoring(args);

    expect(existsSync(tempOutputFile)).toBe(true);

    const loggedData = readFileSync(tempOutputFile, 'utf-8');
    const events = loggedData.trim().split('\n').map(line => JSON.parse(line));

    // Should have captured events even with short timeout
    expect(events.length).toBeGreaterThan(0);
  }, 15000);

  test('should execute with performance tuning configuration', async () => {
    const args = {
      url: `file://${resolve('tests/fixtures/test_monitoring.html')}`,
      out: tempOutputFile,
      config: {
        dedupeWindowMs: 200,
        maxPayloadSize: 1024,
        maxStackDepth: 10,
        enableDeduplication: true,
        monitoringTimeoutSeconds: 3
      }
    };

    await runMonitoring(args);

    expect(existsSync(tempOutputFile)).toBe(true);

    const loggedData = readFileSync(tempOutputFile, 'utf-8');
    const events = loggedData.trim().split('\n').map(line => JSON.parse(line));

    expect(events.length).toBeGreaterThan(0);
  }, 15000);
});

describe('Page Snapshot Dual-Save', () => {
  beforeEach(async () => {
    // Add delay to ensure browser cleanup from previous tests
    await new Promise(resolve => globalThis.setTimeout(resolve, 500));
  });

  test('should capture both initial and final page snapshots with distinct stages', async () => {
    const artifactsDir = `/tmp/artifacts-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create temp config file with artifact collection enabled
    const configPath = `/tmp/snapshot-test-config-${Date.now()}.json`;
    const testConfig = {
      enableArtifactCollection: true,
      artifactDirectory: artifactsDir,
      artifactTypes: {
        pageSnapshot: true,
        downloads: false,
        codeExecution: false,
        encoding: false,
        cryptojs: false,
        clipboard: false,
        workers: false,
        iframes: false
      },
      monitoringTimeoutSeconds: 3
    };
    writeFileSync(configPath, JSON.stringify(testConfig));

    const tempOutputFile = `/tmp/test-output-snapshots-${Date.now()}.jsonl`;
    const args = {
      url: `file://${resolve('tests/fixtures/test_monitoring.html')}`,
      out: tempOutputFile,
      config: configPath
    };

    try {
      await runMonitoring(args);

      // Read events from JSONL output
      expect(existsSync(tempOutputFile)).toBe(true);
      const loggedData = readFileSync(tempOutputFile, 'utf-8');
      const events = loggedData.trim().split('\n').map(line => JSON.parse(line));

      // Find snapshot events
      const snapshotEvents = events.filter(e => e.type === 'page_snapshot');

      // Should have exactly 2 snapshots
      expect(snapshotEvents.length).toBe(2);

      // Should have one initial and one final
      const initialSnapshot = snapshotEvents.find(e => e.snapshotStage === 'initial');
      const finalSnapshot = snapshotEvents.find(e => e.snapshotStage === 'final');

      expect(initialSnapshot).toBeDefined();
      expect(finalSnapshot).toBeDefined();

      // Verify both have artifact paths
      expect(initialSnapshot.artifactPath).toBeDefined();
      expect(finalSnapshot.artifactPath).toBeDefined();

      // Verify paths are different
      expect(initialSnapshot.artifactPath).not.toBe(finalSnapshot.artifactPath);

      // Verify filenames contain stage markers
      expect(initialSnapshot.artifactPath).toContain('_initial.html');
      expect(finalSnapshot.artifactPath).toContain('_final.html');

      // Verify initial snapshot was captured before final
      expect(initialSnapshot.timestamp).toBeLessThan(finalSnapshot.timestamp);
      expect(initialSnapshot.captureTime).toBeLessThan(finalSnapshot.captureTime);

      // CRITICAL: Verify both artifact files actually exist on disk
      expect(existsSync(initialSnapshot.artifactPath)).toBe(true);
      expect(existsSync(finalSnapshot.artifactPath)).toBe(true);

      // Verify files have content (not empty)
      const initialContent = readFileSync(initialSnapshot.artifactPath, 'utf-8');
      const finalContent = readFileSync(finalSnapshot.artifactPath, 'utf-8');

      expect(initialContent.length).toBeGreaterThan(0);
      expect(finalContent.length).toBeGreaterThan(0);

      // Both should be valid HTML
      expect(initialContent).toContain('<html');
      expect(finalContent).toContain('<html');

    } finally {
      // Cleanup
      try {
        unlinkSync(tempOutputFile);
        unlinkSync(configPath);
        if (existsSync(artifactsDir)) {
          rmSync(artifactsDir, { recursive: true, force: true });
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }, 30000);
});
