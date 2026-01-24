import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  HEADLESS_MITIGATION_PROFILES,
  resolveHeadlessMitigationConfig
} from '../src/cli/headless-profiles.ts';
import type { HeadlessMitigationConfig } from '../src/schema/types.ts';

describe('Headless Profiles', () => {
  describe('HEADLESS_MITIGATION_PROFILES', () => {
    test('should have all 4 profiles defined', () => {
      expect(HEADLESS_MITIGATION_PROFILES).toHaveProperty('windows-chrome');
      expect(HEADLESS_MITIGATION_PROFILES).toHaveProperty('macos-safari');
      expect(HEADLESS_MITIGATION_PROFILES).toHaveProperty('linux-firefox');
      expect(HEADLESS_MITIGATION_PROFILES).toHaveProperty('android-chrome');
    });

    test('should have complete profile structures', () => {
      const profiles = Object.values(HEADLESS_MITIGATION_PROFILES);

      profiles.forEach(profile => {
        expect(profile).toHaveProperty('userAgent');
        expect(profile).toHaveProperty('platform');
        expect(profile).toHaveProperty('vendor');
        expect(profile).toHaveProperty('language');
        expect(profile).toHaveProperty('languages');
        expect(profile).toHaveProperty('cdp');
        expect(profile).toHaveProperty('hardware');
        expect(profile).toHaveProperty('screen');
        expect(profile).toHaveProperty('window');
        expect(profile).toHaveProperty('timezone');
        expect(profile).toHaveProperty('webgl');
        expect(profile).toHaveProperty('audio');
        expect(profile).toHaveProperty('entropy');
      });
    });

    test('should have valid value ranges', () => {
      const profiles = Object.values(HEADLESS_MITIGATION_PROFILES);

      profiles.forEach(profile => {
        // Hardware constraints
        if (profile.hardware?.deviceMemory) {
          expect(profile.hardware.deviceMemory).toBeGreaterThanOrEqual(1);
          expect(profile.hardware.deviceMemory).toBeLessThanOrEqual(64);
        }

        // Entropy constraints (0-1 range)
        if (profile.entropy?.canvas !== undefined) {
          expect(profile.entropy.canvas).toBeGreaterThanOrEqual(0);
          expect(profile.entropy.canvas).toBeLessThanOrEqual(1);
        }
        if (profile.entropy?.audio !== undefined) {
          expect(profile.entropy.audio).toBeGreaterThanOrEqual(0);
          expect(profile.entropy.audio).toBeLessThanOrEqual(1);
        }

        // DevicePixelRatio should be positive
        if (profile.window?.devicePixelRatio) {
          expect(profile.window.devicePixelRatio).toBeGreaterThan(0);
        }
      });
    });

    test('should have complete nested objects', () => {
      const profiles = Object.values(HEADLESS_MITIGATION_PROFILES);

      profiles.forEach(profile => {
        // CDP metadata (brands is optional - only on Chromium-based browsers)
        expect(profile.cdp).toHaveProperty('platform');
        expect(profile.cdp).toHaveProperty('platformVersion');
        expect(profile.cdp).toHaveProperty('architecture');
        expect(profile.cdp).toHaveProperty('bitness');
        expect(profile.cdp).toHaveProperty('mobile');

        // Hardware
        expect(profile.hardware).toHaveProperty('hardwareConcurrency');
        expect(profile.hardware).toHaveProperty('deviceMemory');
        expect(profile.hardware).toHaveProperty('maxTouchPoints');

        // Screen
        expect(profile.screen).toHaveProperty('width');
        expect(profile.screen).toHaveProperty('height');

        // Window
        expect(profile.window).toHaveProperty('innerWidth');
        expect(profile.window).toHaveProperty('innerHeight');

        // Timezone
        expect(profile.timezone).toHaveProperty('offset');
        expect(profile.timezone).toHaveProperty('name');

        // WebGL
        expect(profile.webgl).toHaveProperty('vendor');
        expect(profile.webgl).toHaveProperty('renderer');

        // Audio
        expect(profile.audio).toHaveProperty('sampleRate');

        // Entropy
        expect(profile.entropy).toHaveProperty('canvas');
        expect(profile.entropy).toHaveProperty('audio');
      });
    });

    test('should have brands only on Chromium-based profiles', () => {
      // Chromium-based browsers should have brands (User-Agent Client Hints)
      const windowsChrome = HEADLESS_MITIGATION_PROFILES['windows-chrome']!;
      expect(windowsChrome.cdp?.brands).toBeDefined();
      expect(windowsChrome.cdp?.brands).toHaveLength(3);

      const androidChrome = HEADLESS_MITIGATION_PROFILES['android-chrome']!;
      expect(androidChrome.cdp?.brands).toBeDefined();
      expect(androidChrome.cdp?.brands).toHaveLength(3);

      // Non-Chromium browsers should NOT have brands
      expect(HEADLESS_MITIGATION_PROFILES['macos-safari']!.cdp?.brands).toBeUndefined();
      expect(HEADLESS_MITIGATION_PROFILES['linux-firefox']!.cdp?.brands).toBeUndefined();
    });
  });

  describe('resolveHeadlessMitigationConfig', () => {
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    // Resolution Path Tests
    describe('profile resolution paths', () => {
      test('should return default windows-chrome profile when no config provided', () => {
        const result = resolveHeadlessMitigationConfig(undefined);
        expect(result).toEqual(HEADLESS_MITIGATION_PROFILES['windows-chrome']);
        expect(result.userAgent).toContain('Windows NT 10.0');
        expect(result.platform).toBe('Win32');
      });

      test('should use windows-chrome profile when specified', () => {
        const config: HeadlessMitigationConfig = { profile: 'windows-chrome' };
        const result = resolveHeadlessMitigationConfig(config);
        expect(result.platform).toBe('Win32');
        expect(result.vendor).toBe('Google Inc.');
        expect(result.hardware?.deviceMemory).toBe(8);
      });

      test('should use macos-safari profile when specified', () => {
        const config: HeadlessMitigationConfig = { profile: 'macos-safari' };
        const result = resolveHeadlessMitigationConfig(config);
        expect(result.userAgent).toContain('Macintosh');
        expect(result.platform).toBe('MacIntel');
        expect(result.vendor).toBe('Apple Computer, Inc.');
        expect(result.window?.devicePixelRatio).toBe(2.0);
      });

      test('should use linux-firefox profile when specified', () => {
        const config: HeadlessMitigationConfig = { profile: 'linux-firefox' };
        const result = resolveHeadlessMitigationConfig(config);
        expect(result.userAgent).toContain('Firefox');
        expect(result.platform).toBe('Linux x86_64');
        expect(result.vendor).toBe('');
      });

      test('should use android-chrome profile when specified', () => {
        const config: HeadlessMitigationConfig = { profile: 'android-chrome' };
        const result = resolveHeadlessMitigationConfig(config);
        expect(result.userAgent).toContain('Android 14');
        expect(result.cdp?.mobile).toBe(true);
        expect(result.hardware?.maxTouchPoints).toBe(5);
      });

      test('should warn and use windows-chrome for unknown profile', () => {
        const config: HeadlessMitigationConfig = {
          profile: 'invalid-profile' as any
        };

        const result = resolveHeadlessMitigationConfig(config);

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '[JS Unshroud] Unknown headless mitigation profile: invalid-profile, using windows-chrome'
        );
        expect(result.platform).toBe('Win32'); // windows-chrome default
      });

      test('should merge user overrides with specified profile', () => {
        const config: HeadlessMitigationConfig = {
          profile: 'macos-safari',
          userAgent: 'Custom User Agent',
          timezone: { offset: -480, name: 'America/Los_Angeles' }
        };

        const result = resolveHeadlessMitigationConfig(config);

        // User overrides should win
        expect(result.userAgent).toBe('Custom User Agent');
        expect(result.timezone?.offset).toBe(-480);
        expect(result.timezone?.name).toBe('America/Los_Angeles');

        // Profile defaults should remain for non-overridden values
        expect(result.platform).toBe('MacIntel');
        expect(result.vendor).toBe('Apple Computer, Inc.');
        expect(result.hardware?.deviceMemory).toBe(16);
      });

      test('should merge partial user config with windows-chrome defaults', () => {
        const config: HeadlessMitigationConfig = {
          userAgent: 'Custom UA',
          hardware: { hardwareConcurrency: 16 }
        };

        const result = resolveHeadlessMitigationConfig(config);

        // User values should be used
        expect(result.userAgent).toBe('Custom UA');
        expect(result.hardware?.hardwareConcurrency).toBe(16);

        // Windows-chrome defaults should fill in the rest
        expect(result.platform).toBe('Win32');
        expect(result.hardware?.deviceMemory).toBe(8); // from windows-chrome
        expect(result.screen?.width).toBe(1920); // from windows-chrome
      });
    });

    // Deep Merge Tests - CDP Object
    describe('deep merge - cdp object', () => {
      test('should deep merge cdp object when both exist', () => {
        const config: HeadlessMitigationConfig = {
          profile: 'windows-chrome',
          cdp: {
            platform: 'CustomOS',
            mobile: true
            // Other fields should come from windows-chrome
          }
        };

        const result = resolveHeadlessMitigationConfig(config);

        expect(result.cdp?.platform).toBe('CustomOS');
        expect(result.cdp?.mobile).toBe(true);
        // From base profile
        expect(result.cdp?.platformVersion).toBe('10.0.0');
        expect(result.cdp?.architecture).toBe('x86');
        expect(result.cdp?.brands).toHaveLength(3);
      });

      test('should use override cdp when base has none', () => {
        const config: HeadlessMitigationConfig = {
          cdp: {
            platform: 'Windows',
            mobile: false
          }
        };

        const result = resolveHeadlessMitigationConfig(config);

        expect(result.cdp?.platform).toBe('Windows');
        expect(result.cdp?.mobile).toBe(false);
      });

      test('should use base cdp when override has none', () => {
        const config: HeadlessMitigationConfig = {
          profile: 'windows-chrome',
          userAgent: 'Custom'
          // No cdp override
        };

        const result = resolveHeadlessMitigationConfig(config);

        // Should have cdp from windows-chrome profile
        expect(result.cdp?.platform).toBe('Windows');
        expect(result.cdp?.platformVersion).toBe('10.0.0');
      });
    });

    // Deep Merge Tests - Hardware Object
    describe('deep merge - hardware object', () => {
      test('should deep merge hardware object when both exist', () => {
        const config: HeadlessMitigationConfig = {
          profile: 'windows-chrome',
          hardware: {
            hardwareConcurrency: 32
            // deviceMemory and maxTouchPoints from profile
          }
        };

        const result = resolveHeadlessMitigationConfig(config);

        expect(result.hardware?.hardwareConcurrency).toBe(32);
        expect(result.hardware?.deviceMemory).toBe(8); // from windows-chrome
        expect(result.hardware?.maxTouchPoints).toBe(0); // from windows-chrome
      });

      test('should use override hardware when base has none', () => {
        const config: HeadlessMitigationConfig = {
          hardware: {
            hardwareConcurrency: 4,
            deviceMemory: 16
          }
        };

        const result = resolveHeadlessMitigationConfig(config);
        expect(result.hardware?.hardwareConcurrency).toBe(4);
        expect(result.hardware?.deviceMemory).toBe(16);
      });

      test('should use base hardware when override has none', () => {
        const config: HeadlessMitigationConfig = {
          profile: 'macos-safari',
          userAgent: 'Custom'
        };

        const result = resolveHeadlessMitigationConfig(config);
        expect(result.hardware?.deviceMemory).toBe(16); // from macos-safari
      });
    });

    // Deep Merge Tests - Screen Object
    describe('deep merge - screen object', () => {
      test('should deep merge screen object when both exist', () => {
        const config: HeadlessMitigationConfig = {
          profile: 'windows-chrome',
          screen: {
            width: 3840,
            height: 2160
            // Other fields from profile
          }
        };

        const result = resolveHeadlessMitigationConfig(config);

        expect(result.screen?.width).toBe(3840);
        expect(result.screen?.height).toBe(2160);
        expect(result.screen?.colorDepth).toBe(24); // from windows-chrome
        expect(result.screen?.pixelDepth).toBe(24); // from windows-chrome
      });

      test('should use override screen when base has none', () => {
        const config: HeadlessMitigationConfig = {
          screen: { width: 2560, height: 1440 }
        };

        const result = resolveHeadlessMitigationConfig(config);
        expect(result.screen?.width).toBe(2560);
        expect(result.screen?.height).toBe(1440);
      });

      test('should use base screen when override has none', () => {
        const config: HeadlessMitigationConfig = {
          profile: 'linux-firefox',
          language: 'en-GB'
        };

        const result = resolveHeadlessMitigationConfig(config);
        expect(result.screen?.width).toBe(1920); // from linux-firefox
        expect(result.screen?.height).toBe(1080);
      });
    });

    // Deep Merge Tests - Window Object
    describe('deep merge - window object', () => {
      test('should deep merge window object when both exist', () => {
        const config: HeadlessMitigationConfig = {
          profile: 'windows-chrome',
          window: {
            innerWidth: 1600,
            devicePixelRatio: 2.0
          }
        };

        const result = resolveHeadlessMitigationConfig(config);

        expect(result.window?.innerWidth).toBe(1600);
        expect(result.window?.devicePixelRatio).toBe(2.0);
        expect(result.window?.innerHeight).toBe(720); // from windows-chrome
        expect(result.window?.outerWidth).toBe(1296); // from windows-chrome
      });

      test('should use override window when base has none', () => {
        const config: HeadlessMitigationConfig = {
          window: { innerWidth: 1280, innerHeight: 800 }
        };

        const result = resolveHeadlessMitigationConfig(config);
        expect(result.window?.innerWidth).toBe(1280);
      });

      test('should use base window when override has none', () => {
        const config: HeadlessMitigationConfig = {
          profile: 'macos-safari',
          vendor: 'Custom'
        };

        const result = resolveHeadlessMitigationConfig(config);
        expect(result.window?.devicePixelRatio).toBe(2.0); // from macos-safari
      });
    });

    // Deep Merge Tests - Timezone Object
    describe('deep merge - timezone object', () => {
      test('should deep merge timezone object when both exist', () => {
        const config: HeadlessMitigationConfig = {
          profile: 'windows-chrome',
          timezone: {
            offset: -480 // Pacific time
            // name from profile
          }
        };

        const result = resolveHeadlessMitigationConfig(config);

        expect(result.timezone?.offset).toBe(-480);
        expect(result.timezone?.name).toBe('America/New_York'); // from windows-chrome
      });

      test('should use override timezone when base has none', () => {
        const config: HeadlessMitigationConfig = {
          timezone: { offset: 60, name: 'Europe/London' }
        };

        const result = resolveHeadlessMitigationConfig(config);
        expect(result.timezone?.offset).toBe(60);
        expect(result.timezone?.name).toBe('Europe/London');
      });

      test('should use base timezone when override has none', () => {
        const config: HeadlessMitigationConfig = {
          profile: 'android-chrome',
          language: 'es-ES'
        };

        const result = resolveHeadlessMitigationConfig(config);
        expect(result.timezone?.name).toBe('America/New_York');
      });
    });

    // Deep Merge Tests - WebGL Object
    describe('deep merge - webgl object', () => {
      test('should deep merge webgl object when both exist', () => {
        const config: HeadlessMitigationConfig = {
          profile: 'windows-chrome',
          webgl: {
            vendor: 'NVIDIA Corporation'
            // renderer from profile
          }
        };

        const result = resolveHeadlessMitigationConfig(config);

        expect(result.webgl?.vendor).toBe('NVIDIA Corporation');
        expect(result.webgl?.renderer).toContain('ANGLE'); // from windows-chrome
      });

      test('should use override webgl when base has none', () => {
        const config: HeadlessMitigationConfig = {
          webgl: { vendor: 'AMD', renderer: 'Radeon' }
        };

        const result = resolveHeadlessMitigationConfig(config);
        expect(result.webgl?.vendor).toBe('AMD');
        expect(result.webgl?.renderer).toBe('Radeon');
      });

      test('should use base webgl when override has none', () => {
        const config: HeadlessMitigationConfig = {
          profile: 'macos-safari'
        };

        const result = resolveHeadlessMitigationConfig(config);
        expect(result.webgl?.vendor).toBe('Apple Inc.');
        expect(result.webgl?.renderer).toBe('Apple M1');
      });
    });

    // Deep Merge Tests - Audio Object
    describe('deep merge - audio object', () => {
      test('should deep merge audio object when both exist', () => {
        const config: HeadlessMitigationConfig = {
          profile: 'windows-chrome',
          audio: {
            sampleRate: 96000
          }
        };

        const result = resolveHeadlessMitigationConfig(config);
        expect(result.audio?.sampleRate).toBe(96000);
      });

      test('should use override audio when base has none', () => {
        const config: HeadlessMitigationConfig = {
          audio: { sampleRate: 48000 }
        };

        const result = resolveHeadlessMitigationConfig(config);
        expect(result.audio?.sampleRate).toBe(48000);
      });

      test('should use base audio when override has none', () => {
        const config: HeadlessMitigationConfig = {
          profile: 'macos-safari',
          platform: 'Custom'
        };

        const result = resolveHeadlessMitigationConfig(config);
        expect(result.audio?.sampleRate).toBe(48000); // from macos-safari
      });
    });

    // Deep Merge Tests - Entropy Object
    describe('deep merge - entropy object', () => {
      test('should deep merge entropy object when both exist', () => {
        const config: HeadlessMitigationConfig = {
          profile: 'windows-chrome',
          entropy: {
            canvas: 0.05
            // audio from profile
          }
        };

        const result = resolveHeadlessMitigationConfig(config);

        expect(result.entropy?.canvas).toBe(0.05);
        expect(result.entropy?.audio).toBe(0.0001); // from windows-chrome
      });

      test('should use override entropy when base has none', () => {
        const config: HeadlessMitigationConfig = {
          entropy: { canvas: 0.02, audio: 0.0002 }
        };

        const result = resolveHeadlessMitigationConfig(config);
        expect(result.entropy?.canvas).toBe(0.02);
        expect(result.entropy?.audio).toBe(0.0002);
      });

      test('should use base entropy when override has none', () => {
        const config: HeadlessMitigationConfig = {
          profile: 'linux-firefox'
        };

        const result = resolveHeadlessMitigationConfig(config);
        expect(result.entropy?.canvas).toBe(0.01);
        expect(result.entropy?.audio).toBe(0.0001);
      });
    });

    // Edge Cases and Integration Tests
    describe('edge cases and integration', () => {
      test('should handle complete config override with profile', () => {
        const config: HeadlessMitigationConfig = {
          profile: 'macos-safari',
          userAgent: 'Custom',
          platform: 'Custom',
          vendor: 'Custom',
          language: 'ja-JP',
          languages: ['ja-JP', 'ja', 'en'],
          cdp: { platform: 'Custom', mobile: true },
          hardware: { hardwareConcurrency: 64 },
          screen: { width: 7680, height: 4320 },
          window: { innerWidth: 3840, innerHeight: 2160 },
          timezone: { offset: -540, name: 'Asia/Tokyo' },
          webgl: { vendor: 'Custom', renderer: 'Custom' },
          audio: { sampleRate: 192000 },
          entropy: { canvas: 0.1, audio: 0.001 }
        };

        const result = resolveHeadlessMitigationConfig(config);

        // All user values should override
        expect(result.userAgent).toBe('Custom');
        expect(result.cdp?.mobile).toBe(true);
        expect(result.timezone?.name).toBe('Asia/Tokyo');
        // Partial overrides should merge
        expect(result.cdp?.platformVersion).toBe('14.2.1'); // from macos-safari
      });

      test('should handle empty config object', () => {
        const config: HeadlessMitigationConfig = {};

        const result = resolveHeadlessMitigationConfig(config);

        // Should return windows-chrome defaults
        expect(result.platform).toBe('Win32');
        expect(result.vendor).toBe('Google Inc.');
      });

      test('should handle config with only nested objects', () => {
        const config: HeadlessMitigationConfig = {
          cdp: { mobile: true },
          hardware: { maxTouchPoints: 5 }
        };

        const result = resolveHeadlessMitigationConfig(config);

        // User values
        expect(result.cdp?.mobile).toBe(true);
        expect(result.hardware?.maxTouchPoints).toBe(5);

        // Windows-chrome defaults for everything else
        expect(result.platform).toBe('Win32');
        expect(result.hardware?.hardwareConcurrency).toBe(8);
      });

      test('should preserve arrays in merge (languages, brands)', () => {
        const config: HeadlessMitigationConfig = {
          profile: 'windows-chrome',
          languages: ['es-ES', 'es', 'en'],
          cdp: {
            brands: [
              { brand: 'CustomBrowser', version: '1.0' }
            ]
          }
        };

        const result = resolveHeadlessMitigationConfig(config);

        expect(result.languages).toEqual(['es-ES', 'es', 'en']);
        expect(result.cdp?.brands).toHaveLength(1);
        expect(result.cdp?.brands?.[0]?.brand).toBe('CustomBrowser');
      });
    });

    // Top-level primitive merge tests
    describe('top-level field merging', () => {
      test('should merge top-level primitive fields', () => {
        const config: HeadlessMitigationConfig = {
          profile: 'windows-chrome',
          userAgent: 'Override UA',
          platform: 'Override Platform',
          language: 'fr-FR'
        };

        const result = resolveHeadlessMitigationConfig(config);

        expect(result.userAgent).toBe('Override UA');
        expect(result.platform).toBe('Override Platform');
        expect(result.language).toBe('fr-FR');
        // Unchanged fields from base
        expect(result.vendor).toBe('Google Inc.');
      });

      test('should preserve profile field in merge result', () => {
        const config: HeadlessMitigationConfig = {
          profile: 'macos-safari',
          userAgent: 'Custom'
        };

        const result = resolveHeadlessMitigationConfig(config);
        expect(result.profile).toBe('macos-safari');
      });
    });
  });
});
