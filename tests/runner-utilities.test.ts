import { describe, test, expect, vi } from 'vitest';
import {
  generateSpoofedUserAgent,
  generateBrandMetadata,
  generateSpoofedHeaders,
  Logger,
  rand
} from '../src/cli/runner.ts';
import type { InstrumentationConfig, HeadlessMitigationConfig } from '../src/schema/types.ts';
import { HEADLESS_MITIGATION_PROFILES } from '../src/cli/headless-profiles.ts';

const testConfig: HeadlessMitigationConfig = HEADLESS_MITIGATION_PROFILES['windows-chrome']!;

describe('Runner Utility Functions', () => {
  describe('generateSpoofedUserAgent', () => {
    test('should return valid spoofed user agent', () => {
      const ua = generateSpoofedUserAgent(testConfig);

      expect(ua).toMatch(/Mozilla.*Windows.*Chrome/);
      expect(ua.length).toBeGreaterThan(50);
      expect(ua).toContain('AppleWebKit');
      expect(ua).toContain('Safari');
    });

    test('should return consistent user agent on multiple calls', () => {
      const ua1 = generateSpoofedUserAgent(testConfig);
      const ua2 = generateSpoofedUserAgent(testConfig);

      expect(ua1).toBe(ua2);
    });
  });

  describe('generateBrandMetadata', () => {
    test('should return valid brand metadata array', () => {
      const brands = generateBrandMetadata(testConfig);

      expect(Array.isArray(brands)).toBe(true);
      expect(brands).toHaveLength(3);
      expect(brands[0]).toEqual({ brand: 'Chromium', version: '143' });
      expect(brands[1]).toEqual({ brand: 'Not A(Brand)', version: '24' });
      expect(brands[2]).toEqual({ brand: 'Google Chrome', version: '143' });
    });
  });

  describe('generateSpoofedHeaders', () => {
    test('should return valid spoofed headers object', () => {
      const headers = generateSpoofedHeaders(testConfig);

      expect(headers['Upgrade-Insecure-Requests']).toBe('1');
      expect(headers['sec-ch-ua-mobile']).toBe('?0');
      expect(headers['sec-ch-ua-platform']).toBe('"Windows"');
      expect(headers['Accept-Encoding']).toContain('br');
      expect(headers['Accept-Encoding']).toContain('gzip');
      expect(headers['Accept-Language']).toContain('en-US');
    });

    test('should have exactly 7 header fields', () => {
      const headers = generateSpoofedHeaders(testConfig);

      expect(Object.keys(headers)).toHaveLength(7);
    });
  });

  describe('Logger', () => {
    // Create base config for Logger tests
    const baseConfig: InstrumentationConfig = {
      enableConsole: true,
      enableNetwork: true,
      enableStorage: true,
      enableWebSocket: true,
      enableTimer: false,
      enableError: true,
      enableDOM: false,
      enableFingerprinting: false,
      enableObjectTracking: false,
      enableHeadlessMitigation: false,
      enableServiceWorker: false,
      enableCodeExecution: false,
      enableEncoding: false,
      enableCryptoJS: false,
      enableEventHandlers: false,
      enableBlobTracking: false,
      enableURLExecution: false,
      enableWorkers: false,
      enableModules: false,
      enableIframes: false,
      enableClipboard: true,
      clipboardPatternDetection: true,
      enableDebuggerDetection: false,
      enableDownloadDetection: true,
      maxPayloadSize: 1024,
      maxStackDepth: 20,
      monitoringTimeoutSeconds: 15,
      debug: false
    };

    test('Logger.log() should output when debug is true', () => {
      const config = { ...baseConfig, debug: true };
      const logger = new Logger(config);
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.log('test message');

      expect(spy).toHaveBeenCalledWith('test message');
      spy.mockRestore();
    });

    test('Logger.log() should be silent when debug is false', () => {
      const config = { ...baseConfig, debug: false };
      const logger = new Logger(config);
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.log('test message');

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    test('Logger.warn() should output when debug is true', () => {
      const config = { ...baseConfig, debug: true };
      const logger = new Logger(config);
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      logger.warn('warning message');

      expect(spy).toHaveBeenCalledWith('warning message');
      spy.mockRestore();
    });

    test('Logger.warn() should be silent when debug is false', () => {
      const config = { ...baseConfig, debug: false };
      const logger = new Logger(config);
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      logger.warn('warning message');

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    test('Logger.error() should output when debug is true', () => {
      const config = { ...baseConfig, debug: true };
      const logger = new Logger(config);
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      logger.error('error message');

      expect(spy).toHaveBeenCalledWith('error message');
      spy.mockRestore();
    });

    test('Logger.error() should be silent when debug is false', () => {
      const config = { ...baseConfig, debug: false };
      const logger = new Logger(config);
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      logger.error('error message');

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('rand', () => {
    test('should return value in range [min, max]', () => {
      for (let i = 0; i < 100; i++) {
        const value = rand(10, 20);

        expect(value).toBeGreaterThanOrEqual(10);
        expect(value).toBeLessThanOrEqual(20);
      }
    });

    test('should work with negative ranges', () => {
      const value = rand(-10, -5);

      expect(value).toBeGreaterThanOrEqual(-10);
      expect(value).toBeLessThanOrEqual(-5);
    });
  });
});
