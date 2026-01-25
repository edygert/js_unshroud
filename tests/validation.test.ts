import { describe, test, expect } from 'vitest';
import { validateHeadlessMitigationConfig } from '../src/cli/validation.ts';
import type { HeadlessMitigationConfig } from '../src/schema/types.ts';

describe('validateHeadlessMitigationConfig', () => {
  // ==================== Valid Configurations ====================
  describe('valid configurations', () => {
    test('should pass with complete valid config', () => {
      const config: HeadlessMitigationConfig = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/143.0.0.0',
        platform: 'Win32',
        vendor: 'Google Inc.',
        language: 'en-US',
        languages: ['en-US', 'en'],
        cdp: {
          platform: 'Windows',
          platformVersion: '10.0.0',
          architecture: 'x86',
          bitness: '64',
          mobile: false,
          brands: [
            { brand: 'Google Chrome', version: '143' }
          ]
        },
        hardware: {
          hardwareConcurrency: 8,
          deviceMemory: 8,
          maxTouchPoints: 0
        },
        screen: {
          width: 1920,
          height: 1080,
          availWidth: 1920,
          availHeight: 1040,
          colorDepth: 24,
          pixelDepth: 24
        },
        window: {
          innerWidth: 1280,
          innerHeight: 720,
          outerWidth: 1296,
          outerHeight: 800,
          devicePixelRatio: 1.0
        },
        timezone: {
          offset: -300,
          name: 'America/New_York'
        },
        webgl: {
          vendor: 'Google Inc. (Intel)',
          renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)'
        },
        audio: {
          sampleRate: 44100
        },
        entropy: {
          canvas: 0.01,
          audio: 0.0001
        }
      };

      const result = validateHeadlessMitigationConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    test('should pass with minimal valid config', () => {
      const config: HeadlessMitigationConfig = {};
      const result = validateHeadlessMitigationConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    test('should pass with only hardware config', () => {
      const config: HeadlessMitigationConfig = {
        hardware: {
          hardwareConcurrency: 16,
          deviceMemory: 16,
          maxTouchPoints: 0
        }
      };
      const result = validateHeadlessMitigationConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should pass with boundary values', () => {
      const config: HeadlessMitigationConfig = {
        hardware: {
          hardwareConcurrency: 1, // min
          deviceMemory: 0.25, // min
          maxTouchPoints: 10 // max
        },
        screen: {
          width: 320, // min
          height: 240, // min
          colorDepth: 48 // max valid
        },
        window: {
          innerWidth: 320,
          innerHeight: 240,
          devicePixelRatio: 0.5 // min typical range (warning threshold)
        },
        timezone: {
          offset: -720, // min
          name: 'Etc/GMT+12'
        },
        entropy: {
          canvas: 0.0, // min
          audio: 1.0 // max
        }
      };
      const result = validateHeadlessMitigationConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  // ==================== Hardware Validation ====================
  describe('hardware validation', () => {
    describe('hardwareConcurrency', () => {
      test.each([
        [3.5, 'hardware.hardwareConcurrency must be an integer'],
        [1.1, 'hardware.hardwareConcurrency must be an integer']
      ])('should error when hardwareConcurrency=%s (non-integer)', (value, expectedMsg) => {
        const config: HeadlessMitigationConfig = {
          hardware: { hardwareConcurrency: value }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(expectedMsg);
      });

      test.each([
        [0, 'hardware.hardwareConcurrency must be between 1 and 128'],
        [-5, 'hardware.hardwareConcurrency must be between 1 and 128'],
        [129, 'hardware.hardwareConcurrency must be between 1 and 128'],
        [256, 'hardware.hardwareConcurrency must be between 1 and 128']
      ])('should error when hardwareConcurrency=%s (out of range)', (value, expectedMsg) => {
        const config: HeadlessMitigationConfig = {
          hardware: { hardwareConcurrency: value }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(expectedMsg);
      });

      test('should pass with valid hardwareConcurrency values', () => {
        const validValues = [1, 2, 4, 8, 16, 32, 64, 128];
        validValues.forEach(value => {
          const config: HeadlessMitigationConfig = {
            hardware: { hardwareConcurrency: value }
          };
          const result = validateHeadlessMitigationConfig(config);
          expect(result.valid).toBe(true);
        });
      });
    });

    describe('deviceMemory', () => {
      test.each([
        [0.1, 'hardware.deviceMemory must be between 0.25 and 256 GB'],
        [0.24, 'hardware.deviceMemory must be between 0.25 and 256 GB'],
        [-1, 'hardware.deviceMemory must be between 0.25 and 256 GB'],
        [257, 'hardware.deviceMemory must be between 0.25 and 256 GB'],
        [512, 'hardware.deviceMemory must be between 0.25 and 256 GB']
      ])('should error when deviceMemory=%s (out of range)', (value, expectedMsg) => {
        const config: HeadlessMitigationConfig = {
          hardware: { deviceMemory: value }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(expectedMsg);
      });

      test('should pass with valid deviceMemory values', () => {
        const validValues = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 64, 128, 256];
        validValues.forEach(value => {
          const config: HeadlessMitigationConfig = {
            hardware: { deviceMemory: value }
          };
          const result = validateHeadlessMitigationConfig(config);
          expect(result.valid).toBe(true);
        });
      });
    });

    describe('maxTouchPoints', () => {
      test.each([
        [2.5, 'hardware.maxTouchPoints must be an integer'],
        [1.1, 'hardware.maxTouchPoints must be an integer'],
        [-0.5, 'hardware.maxTouchPoints must be an integer']
      ])('should error when maxTouchPoints=%s (non-integer)', (value, expectedMsg) => {
        const config: HeadlessMitigationConfig = {
          hardware: { maxTouchPoints: value }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(expectedMsg);
      });

      test.each([
        [-1, 'hardware.maxTouchPoints must be between 0 and 10'],
        [-5, 'hardware.maxTouchPoints must be between 0 and 10'],
        [11, 'hardware.maxTouchPoints must be between 0 and 10'],
        [20, 'hardware.maxTouchPoints must be between 0 and 10']
      ])('should error when maxTouchPoints=%s (out of range)', (value, expectedMsg) => {
        const config: HeadlessMitigationConfig = {
          hardware: { maxTouchPoints: value }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(expectedMsg);
      });

      test('should pass with valid maxTouchPoints values', () => {
        const validValues = [0, 1, 2, 5, 10];
        validValues.forEach(value => {
          const config: HeadlessMitigationConfig = {
            hardware: { maxTouchPoints: value }
          };
          const result = validateHeadlessMitigationConfig(config);
          expect(result.valid).toBe(true);
        });
      });
    });
  });

  // ==================== Screen Validation ====================
  describe('screen validation', () => {
    describe('width', () => {
      test.each([
        [1920.5, 'screen.width must be an integer'],
        [1080.1, 'screen.width must be an integer']
      ])('should error when width=%s (non-integer)', (value, expectedMsg) => {
        const config: HeadlessMitigationConfig = {
          screen: { width: value }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(expectedMsg);
      });

      test.each([
        [319, 'screen.width must be between 320 and 7680'],
        [100, 'screen.width must be between 320 and 7680'],
        [7681, 'screen.width must be between 320 and 7680'],
        [10000, 'screen.width must be between 320 and 7680']
      ])('should error when width=%s (out of range)', (value, expectedMsg) => {
        const config: HeadlessMitigationConfig = {
          screen: { width: value }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(expectedMsg);
      });
    });

    describe('height', () => {
      test.each([
        [1080.5, 'screen.height must be an integer'],
        [720.1, 'screen.height must be an integer']
      ])('should error when height=%s (non-integer)', (value, expectedMsg) => {
        const config: HeadlessMitigationConfig = {
          screen: { height: value }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(expectedMsg);
      });

      test.each([
        [239, 'screen.height must be between 240 and 4320'],
        [100, 'screen.height must be between 240 and 4320'],
        [4321, 'screen.height must be between 240 and 4320'],
        [8000, 'screen.height must be between 240 and 4320']
      ])('should error when height=%s (out of range)', (value, expectedMsg) => {
        const config: HeadlessMitigationConfig = {
          screen: { height: value }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(expectedMsg);
      });
    });

    describe('availWidth and availHeight warnings', () => {
      test('should warn when availWidth > width', () => {
        const config: HeadlessMitigationConfig = {
          screen: {
            width: 1920,
            availWidth: 2000
          }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('screen.availWidth should not exceed screen.width');
      });

      test('should warn when availHeight > height', () => {
        const config: HeadlessMitigationConfig = {
          screen: {
            height: 1080,
            availHeight: 1200
          }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('screen.availHeight should not exceed screen.height');
      });

      test('should not warn when availWidth <= width', () => {
        const config: HeadlessMitigationConfig = {
          screen: {
            width: 1920,
            availWidth: 1920
          }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.warnings).not.toContain('screen.availWidth should not exceed screen.width');
      });

      test('should not warn when availHeight <= height', () => {
        const config: HeadlessMitigationConfig = {
          screen: {
            height: 1080,
            availHeight: 1040
          }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.warnings).not.toContain('screen.availHeight should not exceed screen.height');
      });

      test('should not warn when width defined but availWidth undefined', () => {
        const config: HeadlessMitigationConfig = {
          screen: {
            width: 1920
          }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.warnings.length).toBe(0);
      });
    });

    describe('colorDepth warnings', () => {
      test.each([
        [8], [16], [24], [30], [32], [48]
      ])('should not warn for standard colorDepth=%s', (value) => {
        const config: HeadlessMitigationConfig = {
          screen: { colorDepth: value }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.warnings.length).toBe(0);
      });

      test.each([
        [4, 'screen.colorDepth 4 is unusual, common values: 8, 16, 24, 30, 32, 48'],
        [12, 'screen.colorDepth 12 is unusual, common values: 8, 16, 24, 30, 32, 48'],
        [64, 'screen.colorDepth 64 is unusual, common values: 8, 16, 24, 30, 32, 48']
      ])('should warn for unusual colorDepth=%s', (value, expectedWarning) => {
        const config: HeadlessMitigationConfig = {
          screen: { colorDepth: value }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain(expectedWarning);
      });
    });
  });

  // ==================== Window Validation ====================
  describe('window validation', () => {
    describe('innerWidth', () => {
      test.each([
        [1280.5, 'window.innerWidth must be an integer'],
        [800.1, 'window.innerWidth must be an integer']
      ])('should error when innerWidth=%s (non-integer)', (value, expectedMsg) => {
        const config: HeadlessMitigationConfig = {
          window: { innerWidth: value }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(expectedMsg);
      });

      test.each([
        [319, 'window.innerWidth must be between 320 and 7680'],
        [100, 'window.innerWidth must be between 320 and 7680'],
        [7681, 'window.innerWidth must be between 320 and 7680'],
        [10000, 'window.innerWidth must be between 320 and 7680']
      ])('should error when innerWidth=%s (out of range)', (value, expectedMsg) => {
        const config: HeadlessMitigationConfig = {
          window: { innerWidth: value }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(expectedMsg);
      });

      test('should warn when innerWidth > screen.width', () => {
        const config: HeadlessMitigationConfig = {
          screen: { width: 1920 },
          window: { innerWidth: 2000 }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('window.innerWidth should not exceed screen.width');
      });

      test('should not warn when innerWidth <= screen.width', () => {
        const config: HeadlessMitigationConfig = {
          screen: { width: 1920 },
          window: { innerWidth: 1920 }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.warnings).not.toContain('window.innerWidth should not exceed screen.width');
      });

      test('should not warn when screen.width undefined', () => {
        const config: HeadlessMitigationConfig = {
          window: { innerWidth: 2000 }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.warnings.length).toBe(0);
      });
    });

    describe('innerHeight', () => {
      test.each([
        [720.5, 'window.innerHeight must be an integer'],
        [600.1, 'window.innerHeight must be an integer']
      ])('should error when innerHeight=%s (non-integer)', (value, expectedMsg) => {
        const config: HeadlessMitigationConfig = {
          window: { innerHeight: value }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(expectedMsg);
      });

      test.each([
        [239, 'window.innerHeight must be between 240 and 4320'],
        [100, 'window.innerHeight must be between 240 and 4320'],
        [4321, 'window.innerHeight must be between 240 and 4320'],
        [8000, 'window.innerHeight must be between 240 and 4320']
      ])('should error when innerHeight=%s (out of range)', (value, expectedMsg) => {
        const config: HeadlessMitigationConfig = {
          window: { innerHeight: value }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(expectedMsg);
      });

      test('should warn when innerHeight > screen.height', () => {
        const config: HeadlessMitigationConfig = {
          screen: { height: 1080 },
          window: { innerHeight: 1200 }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('window.innerHeight should not exceed screen.height');
      });

      test('should not warn when innerHeight <= screen.height', () => {
        const config: HeadlessMitigationConfig = {
          screen: { height: 1080 },
          window: { innerHeight: 1080 }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.warnings).not.toContain('window.innerHeight should not exceed screen.height');
      });

      test('should not warn when screen.height undefined', () => {
        const config: HeadlessMitigationConfig = {
          window: { innerHeight: 1200 }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.warnings.length).toBe(0);
      });
    });

    describe('devicePixelRatio', () => {
      test.each([
        [0, 'window.devicePixelRatio must be greater than 0'],
        [-1, 'window.devicePixelRatio must be greater than 0'],
        [-0.5, 'window.devicePixelRatio must be greater than 0']
      ])('should error when devicePixelRatio=%s (<= 0)', (value, expectedMsg) => {
        const config: HeadlessMitigationConfig = {
          window: { devicePixelRatio: value }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(expectedMsg);
      });

      test.each([
        [0.4, 'window.devicePixelRatio outside typical range (0.5-5.0)'],
        [0.1, 'window.devicePixelRatio outside typical range (0.5-5.0)'],
        [5.1, 'window.devicePixelRatio outside typical range (0.5-5.0)'],
        [10.0, 'window.devicePixelRatio outside typical range (0.5-5.0)']
      ])('should warn when devicePixelRatio=%s (outside typical range)', (value, expectedWarning) => {
        const config: HeadlessMitigationConfig = {
          window: { devicePixelRatio: value }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain(expectedWarning);
      });

      test('should not warn for typical devicePixelRatio values', () => {
        const typicalValues = [0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0];
        typicalValues.forEach(value => {
          const config: HeadlessMitigationConfig = {
            window: { devicePixelRatio: value }
          };
          const result = validateHeadlessMitigationConfig(config);
          expect(result.warnings.length).toBe(0);
        });
      });
    });
  });

  // ==================== Timezone Validation ====================
  describe('timezone validation', () => {
    describe('offset', () => {
      test.each([
        [30.5, 'timezone.offset must be an integer (minutes from UTC)'],
        [-60.1, 'timezone.offset must be an integer (minutes from UTC)']
      ])('should error when offset=%s (non-integer)', (value, expectedMsg) => {
        const config: HeadlessMitigationConfig = {
          timezone: { offset: value }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(expectedMsg);
      });

      test.each([
        [-721, 'timezone.offset must be between -720 and 840 minutes'],
        [-1000, 'timezone.offset must be between -720 and 840 minutes'],
        [841, 'timezone.offset must be between -720 and 840 minutes'],
        [1000, 'timezone.offset must be between -720 and 840 minutes']
      ])('should error when offset=%s (out of range)', (value, expectedMsg) => {
        const config: HeadlessMitigationConfig = {
          timezone: { offset: value }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(expectedMsg);
      });

      test('should pass with valid offset values', () => {
        const validValues = [-720, -480, -300, 0, 60, 330, 540, 840];
        validValues.forEach(value => {
          const config: HeadlessMitigationConfig = {
            timezone: { offset: value }
          };
          const result = validateHeadlessMitigationConfig(config);
          expect(result.valid).toBe(true);
        });
      });
    });

    describe('name', () => {
      test('should error when name is empty string', () => {
        const config: HeadlessMitigationConfig = {
          timezone: { name: '' }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('timezone.name must be a non-empty string');
      });

      test('should error when name is not a string', () => {
        const config: HeadlessMitigationConfig = {
          timezone: { name: 123 as any }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('timezone.name must be a non-empty string');
      });

      test('should pass with valid timezone names', () => {
        const validNames = [
          'America/New_York',
          'Europe/London',
          'Asia/Tokyo',
          'UTC',
          'Etc/GMT+5'
        ];
        validNames.forEach(name => {
          const config: HeadlessMitigationConfig = {
            timezone: { name }
          };
          const result = validateHeadlessMitigationConfig(config);
          expect(result.valid).toBe(true);
        });
      });
    });
  });

  // ==================== Audio Validation ====================
  describe('audio validation', () => {
    describe('sampleRate', () => {
      test.each([
        [44100.5, 'audio.sampleRate must be an integer'],
        [48000.1, 'audio.sampleRate must be an integer']
      ])('should error when sampleRate=%s (non-integer)', (value, expectedMsg) => {
        const config: HeadlessMitigationConfig = {
          audio: { sampleRate: value }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(expectedMsg);
      });

      test.each([
        [8000], [16000], [22050], [44100], [48000], [96000], [192000]
      ])('should not warn for standard sampleRate=%s', (value) => {
        const config: HeadlessMitigationConfig = {
          audio: { sampleRate: value }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(true);
        expect(result.warnings.length).toBe(0);
      });

      test.each([
        [11025, 'audio.sampleRate 11025 is non-standard, common values: 8000, 16000, 22050, 44100, 48000, 96000, 192000'],
        [32000, 'audio.sampleRate 32000 is non-standard, common values: 8000, 16000, 22050, 44100, 48000, 96000, 192000'],
        [88200, 'audio.sampleRate 88200 is non-standard, common values: 8000, 16000, 22050, 44100, 48000, 96000, 192000']
      ])('should warn for non-standard sampleRate=%s', (value, expectedWarning) => {
        const config: HeadlessMitigationConfig = {
          audio: { sampleRate: value }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain(expectedWarning);
      });
    });
  });

  // ==================== Entropy Validation ====================
  describe('entropy validation', () => {
    describe('canvas', () => {
      test.each([
        [-0.1, 'entropy.canvas must be between 0.0 and 1.0'],
        [-1.0, 'entropy.canvas must be between 0.0 and 1.0'],
        [1.1, 'entropy.canvas must be between 0.0 and 1.0'],
        [2.0, 'entropy.canvas must be between 0.0 and 1.0']
      ])('should error when canvas=%s (out of range)', (value, expectedMsg) => {
        const config: HeadlessMitigationConfig = {
          entropy: { canvas: value }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(expectedMsg);
      });

      test('should pass with valid canvas entropy values', () => {
        const validValues = [0.0, 0.01, 0.1, 0.5, 1.0];
        validValues.forEach(value => {
          const config: HeadlessMitigationConfig = {
            entropy: { canvas: value }
          };
          const result = validateHeadlessMitigationConfig(config);
          expect(result.valid).toBe(true);
        });
      });
    });

    describe('audio', () => {
      test.each([
        [-0.1, 'entropy.audio must be between 0.0 and 1.0'],
        [-0.5, 'entropy.audio must be between 0.0 and 1.0'],
        [1.1, 'entropy.audio must be between 0.0 and 1.0'],
        [5.0, 'entropy.audio must be between 0.0 and 1.0']
      ])('should error when audio=%s (out of range)', (value, expectedMsg) => {
        const config: HeadlessMitigationConfig = {
          entropy: { audio: value }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(expectedMsg);
      });

      test('should pass with valid audio entropy values', () => {
        const validValues = [0.0, 0.0001, 0.001, 0.01, 0.1, 1.0];
        validValues.forEach(value => {
          const config: HeadlessMitigationConfig = {
            entropy: { audio: value }
          };
          const result = validateHeadlessMitigationConfig(config);
          expect(result.valid).toBe(true);
        });
      });
    });
  });

  // ==================== Cross-Field Consistency Warnings ====================
  describe('cross-field consistency warnings', () => {
    describe('userAgent vs platform - Windows', () => {
      test('should warn when platform is Win32 but userAgent lacks Windows', () => {
        const config: HeadlessMitigationConfig = {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          platform: 'Win32'
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('userAgent should contain "Windows" to match platform "Win32"');
      });

      test('should not warn when both userAgent and platform indicate Windows', () => {
        const config: HeadlessMitigationConfig = {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          platform: 'Win32'
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.warnings).not.toContain('userAgent should contain "Windows" to match platform "Win32"');
      });
    });

    describe('userAgent vs platform - macOS', () => {
      test('should warn when platform is MacIntel but userAgent lacks Mac', () => {
        const config: HeadlessMitigationConfig = {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          platform: 'MacIntel'
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('userAgent should contain "Mac" to match platform "MacIntel"');
      });

      test('should not warn when both userAgent and platform indicate macOS', () => {
        const config: HeadlessMitigationConfig = {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          platform: 'MacIntel'
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.warnings).not.toContain('userAgent should contain "Mac" to match platform "MacIntel"');
      });
    });

    describe('userAgent vs platform - Linux', () => {
      test('should warn when platform is Linux but userAgent lacks Linux/X11', () => {
        const config: HeadlessMitigationConfig = {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          platform: 'Linux x86_64'
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('userAgent should contain "Linux" or "X11" to match platform');
      });

      test('should not warn when userAgent contains Linux', () => {
        const config: HeadlessMitigationConfig = {
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
          platform: 'Linux x86_64'
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.warnings).not.toContain('userAgent should contain "Linux" or "X11" to match platform');
      });

      test('should not warn when userAgent contains X11', () => {
        const config: HeadlessMitigationConfig = {
          userAgent: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64)',
          platform: 'Linux x86_64'
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.warnings).not.toContain('userAgent should contain "Linux" or "X11" to match platform');
      });
    });

    describe('userAgent vs platform - Android', () => {
      test('should not warn when platform is Linux without android keyword', () => {
        const config: HeadlessMitigationConfig = {
          userAgent: 'Mozilla/5.0 (X11; Linux armv81)',
          platform: 'Linux armv81'
        };
        // Note: platform check looks for "android" in lowercase
        const result = validateHeadlessMitigationConfig(config);
        // Should not trigger Android-specific warning since platform doesn't contain "android"
        expect(result.warnings).not.toContain('userAgent should contain "Android" to match platform');
      });

      test('should warn when platform contains android but userAgent does not', () => {
        const config: HeadlessMitigationConfig = {
          userAgent: 'Mozilla/5.0 (Linux; U; en-us)',
          platform: 'Linux android'
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('userAgent should contain "Android" to match platform');
      });

      test('should not warn when both userAgent and platform indicate Android', () => {
        const config: HeadlessMitigationConfig = {
          userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)',
          platform: 'Linux android'
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.warnings).not.toContain('userAgent should contain "Android" to match platform');
      });
    });

    describe('userAgent vs cdp.brands', () => {
      test('should warn when brands contain Chrome but userAgent does not', () => {
        const config: HeadlessMitigationConfig = {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/122.0',
          cdp: {
            brands: [
              { brand: 'Google Chrome', version: '143' },
              { brand: 'Chromium', version: '143' }
            ]
          }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('cdp.brands includes "Google Chrome" but userAgent does not contain "Chrome"');
      });

      test('should not warn when brands and userAgent both indicate Chrome', () => {
        const config: HeadlessMitigationConfig = {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/143.0.0.0',
          cdp: {
            brands: [
              { brand: 'Google Chrome', version: '143' }
            ]
          }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.warnings).not.toContain('cdp.brands includes "Google Chrome" but userAgent does not contain "Chrome"');
      });

      test('should not warn when cdp.brands is undefined', () => {
        const config: HeadlessMitigationConfig = {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/122.0'
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.warnings.length).toBe(0);
      });

      test('should only warn once even if multiple brands contain Chrome', () => {
        const config: HeadlessMitigationConfig = {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/122.0',
          cdp: {
            brands: [
              { brand: 'Google Chrome', version: '143' },
              { brand: 'Chromium', version: '143' },
              { brand: 'Not A;Brand', version: '99' }
            ]
          }
        };
        const result = validateHeadlessMitigationConfig(config);
        const chromeWarnings = result.warnings.filter(w => w.includes('Chrome'));
        expect(chromeWarnings.length).toBe(1); // Should warn once and break
      });
    });

    describe('cdp.mobile vs hardware.maxTouchPoints', () => {
      test('should warn when mobile is true but maxTouchPoints is 0', () => {
        const config: HeadlessMitigationConfig = {
          cdp: { mobile: true },
          hardware: { maxTouchPoints: 0 }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('cdp.mobile is true but hardware.maxTouchPoints is 0 (should be > 0 for mobile)');
      });

      test('should warn when mobile is false but maxTouchPoints > 0', () => {
        const config: HeadlessMitigationConfig = {
          cdp: { mobile: false },
          hardware: { maxTouchPoints: 5 }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('cdp.mobile is false but hardware.maxTouchPoints > 0 (should be 0 for desktop)');
      });

      test('should not warn when mobile is true and maxTouchPoints > 0', () => {
        const config: HeadlessMitigationConfig = {
          cdp: { mobile: true },
          hardware: { maxTouchPoints: 5 }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.warnings).not.toContain('cdp.mobile is true but hardware.maxTouchPoints is 0 (should be > 0 for mobile)');
      });

      test('should not warn when mobile is false and maxTouchPoints is 0', () => {
        const config: HeadlessMitigationConfig = {
          cdp: { mobile: false },
          hardware: { maxTouchPoints: 0 }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.warnings).not.toContain('cdp.mobile is false but hardware.maxTouchPoints > 0 (should be 0 for desktop)');
      });

      test('should not warn when cdp.mobile is undefined', () => {
        const config: HeadlessMitigationConfig = {
          hardware: { maxTouchPoints: 5 }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.warnings.length).toBe(0);
      });

      test('should not warn when hardware.maxTouchPoints is undefined', () => {
        const config: HeadlessMitigationConfig = {
          cdp: { mobile: true }
        };
        const result = validateHeadlessMitigationConfig(config);
        expect(result.warnings.length).toBe(0);
      });
    });
  });

  // ==================== Multiple Errors/Warnings ====================
  describe('multiple errors and warnings', () => {
    test('should accumulate multiple errors', () => {
      const config: HeadlessMitigationConfig = {
        hardware: {
          hardwareConcurrency: 200, // out of range
          deviceMemory: 300, // out of range
          maxTouchPoints: 15 // out of range
        }
      };
      const result = validateHeadlessMitigationConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(3);
      expect(result.errors).toContain('hardware.hardwareConcurrency must be between 1 and 128');
      expect(result.errors).toContain('hardware.deviceMemory must be between 0.25 and 256 GB');
      expect(result.errors).toContain('hardware.maxTouchPoints must be between 0 and 10');
    });

    test('should accumulate multiple warnings', () => {
      const config: HeadlessMitigationConfig = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0)',
        platform: 'MacIntel',
        screen: {
          width: 1920,
          height: 1080,
          availWidth: 2000,
          availHeight: 1200,
          colorDepth: 13
        }
      };
      const result = validateHeadlessMitigationConfig(config);
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThanOrEqual(3);
      expect(result.warnings).toContain('screen.availWidth should not exceed screen.width');
      expect(result.warnings).toContain('screen.availHeight should not exceed screen.height');
      expect(result.warnings).toContain('screen.colorDepth 13 is unusual, common values: 8, 16, 24, 30, 32, 48');
      expect(result.warnings).toContain('userAgent should contain "Mac" to match platform "MacIntel"');
    });

    test('should have both errors and warnings', () => {
      const config: HeadlessMitigationConfig = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0)',
        platform: 'MacIntel',
        hardware: {
          hardwareConcurrency: 500 // error
        },
        window: {
          devicePixelRatio: 0.1 // warning
        }
      };
      const result = validateHeadlessMitigationConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.warnings.length).toBeGreaterThanOrEqual(2);
      expect(result.errors).toContain('hardware.hardwareConcurrency must be between 1 and 128');
      expect(result.warnings).toContain('window.devicePixelRatio outside typical range (0.5-5.0)');
      expect(result.warnings).toContain('userAgent should contain "Mac" to match platform "MacIntel"');
    });
  });

  // ==================== Edge Cases ====================
  describe('edge cases', () => {
    test('should handle config with all undefined nested objects', () => {
      const config: HeadlessMitigationConfig = {};
      const result = validateHeadlessMitigationConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    test('should handle config with empty nested objects', () => {
      const config: HeadlessMitigationConfig = {
        cdp: {},
        hardware: {},
        screen: {},
        window: {},
        timezone: {},
        webgl: {},
        audio: {},
        entropy: {}
      };
      const result = validateHeadlessMitigationConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    test('should validate when only userAgent is provided', () => {
      const config: HeadlessMitigationConfig = {
        userAgent: 'Custom User Agent'
      };
      const result = validateHeadlessMitigationConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should validate when only platform is provided', () => {
      const config: HeadlessMitigationConfig = {
        platform: 'Win32'
      };
      const result = validateHeadlessMitigationConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should handle max boundary values correctly', () => {
      const config: HeadlessMitigationConfig = {
        hardware: {
          hardwareConcurrency: 128,
          deviceMemory: 256,
          maxTouchPoints: 10
        },
        screen: {
          width: 7680,
          height: 4320
        },
        window: {
          innerWidth: 7680,
          innerHeight: 4320,
          devicePixelRatio: 5.0
        },
        timezone: {
          offset: 840
        },
        entropy: {
          canvas: 1.0,
          audio: 1.0
        }
      };
      const result = validateHeadlessMitigationConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});
