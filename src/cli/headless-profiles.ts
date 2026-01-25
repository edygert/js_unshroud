import type { HeadlessMitigationConfig } from '../schema/types.ts';

/**
 * Built-in headless mitigation profiles for common browser fingerprints.
 * These profiles provide realistic, consistent fingerprints for different platforms.
 */
export const HEADLESS_MITIGATION_PROFILES: Record<string, HeadlessMitigationConfig> = {
  'windows-chrome': {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.7499.4 Safari/537.36',
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
        { brand: 'Chromium', version: '143' },
        { brand: 'Not A(Brand)', version: '24' },
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
      outerHeight: 825,
      devicePixelRatio: 1.0
    },
    timezone: {
      offset: 300,
      name: 'America/New_York'
    },
    webgl: {
      vendor: 'Google Inc. (Intel)',
      renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },
    audio: {
      sampleRate: 44100
    },
    entropy: {
      canvas: 0.01,
      audio: 0.0001
    }
  },

  'macos-safari': {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    platform: 'MacIntel',
    vendor: 'Apple Computer, Inc.',
    language: 'en-US',
    languages: ['en-US', 'en'],
    cdp: {
      platform: 'macOS',
      platformVersion: '14.2.1',
      architecture: 'x86',
      bitness: '64',
      mobile: false
    },
    hardware: {
      hardwareConcurrency: 8,
      deviceMemory: 16,
      maxTouchPoints: 0
    },
    screen: {
      width: 2560,
      height: 1440,
      availWidth: 2560,
      availHeight: 1415,
      colorDepth: 30,
      pixelDepth: 30
    },
    window: {
      innerWidth: 1440,
      innerHeight: 900,
      outerWidth: 1440,
      outerHeight: 967,
      devicePixelRatio: 2.0
    },
    timezone: {
      offset: 300,
      name: 'America/New_York'
    },
    webgl: {
      vendor: 'Apple Inc.',
      renderer: 'Apple M1'
    },
    audio: {
      sampleRate: 48000
    },
    entropy: {
      canvas: 0.01,
      audio: 0.0001
    }
  },

  'linux-firefox': {
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0',
    platform: 'Linux x86_64',
    vendor: '',
    language: 'en-US',
    languages: ['en-US', 'en'],
    cdp: {
      platform: 'Linux',
      platformVersion: '6.6.0',
      architecture: 'x86',
      bitness: '64',
      mobile: false
    },
    hardware: {
      hardwareConcurrency: 16,
      deviceMemory: 32,
      maxTouchPoints: 0
    },
    screen: {
      width: 1920,
      height: 1080,
      availWidth: 1920,
      availHeight: 1055,
      colorDepth: 24,
      pixelDepth: 24
    },
    window: {
      innerWidth: 1280,
      innerHeight: 720,
      outerWidth: 1280,
      outerHeight: 804,
      devicePixelRatio: 1.0
    },
    timezone: {
      offset: 300,
      name: 'America/New_York'
    },
    webgl: {
      vendor: 'Mesa',
      renderer: 'Mesa Intel(R) UHD Graphics 630 (CFL GT2)'
    },
    audio: {
      sampleRate: 48000
    },
    entropy: {
      canvas: 0.01,
      audio: 0.0001
    }
  },

  'android-chrome': {
    userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.6722.0 Mobile Safari/537.36',
    platform: 'Linux armv8l',
    vendor: 'Google Inc.',
    language: 'en-US',
    languages: ['en-US', 'en'],
    cdp: {
      platform: 'Android',
      platformVersion: '14',
      architecture: 'arm',
      bitness: '64',
      mobile: true,
      brands: [
        { brand: 'Chromium', version: '143' },
        { brand: 'Not A(Brand)', version: '24' },
        { brand: 'Google Chrome', version: '143' }
      ]
    },
    hardware: {
      hardwareConcurrency: 8,
      deviceMemory: 6,
      maxTouchPoints: 5
    },
    screen: {
      width: 1080,
      height: 2400,
      availWidth: 1080,
      availHeight: 2340,
      colorDepth: 24,
      pixelDepth: 24
    },
    window: {
      innerWidth: 412,
      innerHeight: 915,
      outerWidth: 412,
      outerHeight: 915,
      devicePixelRatio: 2.625
    },
    timezone: {
      offset: 300,
      name: 'America/New_York'
    },
    webgl: {
      vendor: 'Qualcomm',
      renderer: 'Adreno (TM) 740'
    },
    audio: {
      sampleRate: 48000
    },
    entropy: {
      canvas: 0.01,
      audio: 0.0001
    }
  }
};

/**
 * Resolve headless mitigation configuration by merging user config with profile defaults.
 *
 * Resolution priority:
 * 1. User-provided values (highest priority)
 * 2. Profile values (if profile specified)
 * 3. windows-chrome profile (default fallback)
 *
 * @param config User-provided headless mitigation config (may be undefined)
 * @returns Fully resolved configuration with all values populated
 */
export function resolveHeadlessMitigationConfig(
  config: HeadlessMitigationConfig | undefined
): HeadlessMitigationConfig {
  // Default profile - we know it exists at runtime
  const defaultProfile = HEADLESS_MITIGATION_PROFILES['windows-chrome']!;

  // If no config provided, use default windows-chrome profile
  if (!config) {
    return defaultProfile;
  }

  // If profile specified, start with profile and merge user overrides
  if (config.profile) {
    const profile = HEADLESS_MITIGATION_PROFILES[config.profile];
    if (!profile) {
      console.warn(`[JS Unshroud] Unknown headless mitigation profile: ${config.profile}, using windows-chrome`);
      return deepMerge(defaultProfile, config);
    }

    // Deep merge: profile + user overrides
    return deepMerge(profile, config);
  }

  // No profile specified, merge user config with windows-chrome defaults
  return deepMerge(defaultProfile, config);
}

/**
 * Deep merge two HeadlessMitigationConfig objects.
 * User values override base values. Nested objects are merged recursively.
 *
 * @param base Base configuration (lower priority)
 * @param override Override configuration (higher priority)
 * @returns Merged configuration
 */
function deepMerge(
  base: HeadlessMitigationConfig,
  override: HeadlessMitigationConfig
): HeadlessMitigationConfig {
  const result: HeadlessMitigationConfig = {
    ...base,
    ...override
  };

  // Deep merge nested objects - only assign if value exists (not undefined)
  // This satisfies exactOptionalPropertyTypes requirement
  if (override.cdp && base.cdp) {
    result.cdp = { ...base.cdp, ...override.cdp };
  } else if (override.cdp) {
    result.cdp = override.cdp;
  } else if (base.cdp) {
    result.cdp = base.cdp;
  }

  if (override.hardware && base.hardware) {
    result.hardware = { ...base.hardware, ...override.hardware };
  } else if (override.hardware) {
    result.hardware = override.hardware;
  } else if (base.hardware) {
    result.hardware = base.hardware;
  }

  if (override.screen && base.screen) {
    result.screen = { ...base.screen, ...override.screen };
  } else if (override.screen) {
    result.screen = override.screen;
  } else if (base.screen) {
    result.screen = base.screen;
  }

  if (override.window && base.window) {
    result.window = { ...base.window, ...override.window };
  } else if (override.window) {
    result.window = override.window;
  } else if (base.window) {
    result.window = base.window;
  }

  if (override.timezone && base.timezone) {
    result.timezone = { ...base.timezone, ...override.timezone };
  } else if (override.timezone) {
    result.timezone = override.timezone;
  } else if (base.timezone) {
    result.timezone = base.timezone;
  }

  if (override.webgl && base.webgl) {
    result.webgl = { ...base.webgl, ...override.webgl };
  } else if (override.webgl) {
    result.webgl = override.webgl;
  } else if (base.webgl) {
    result.webgl = base.webgl;
  }

  if (override.audio && base.audio) {
    result.audio = { ...base.audio, ...override.audio };
  } else if (override.audio) {
    result.audio = override.audio;
  } else if (base.audio) {
    result.audio = base.audio;
  }

  if (override.entropy && base.entropy) {
    result.entropy = { ...base.entropy, ...override.entropy };
  } else if (override.entropy) {
    result.entropy = override.entropy;
  } else if (base.entropy) {
    result.entropy = base.entropy;
  }

  return result;
}
