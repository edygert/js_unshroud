import type { HeadlessMitigationConfig } from '../schema/types.ts';

/**
 * Validation result containing errors (fatal) and warnings (non-fatal).
 */
export interface ValidationResult {
  valid: boolean;        // False if any errors exist
  errors: string[];      // Fatal errors that prevent execution
  warnings: string[];    // Non-fatal warnings about suspicious configurations
}

/**
 * Validate headless mitigation configuration for range validity and consistency.
 *
 * Errors (fatal):
 * - Values outside valid ranges (e.g., hardwareConcurrency > 128)
 * - Invalid entropy levels (not 0.0-1.0)
 * - Invalid timezone offsets (not -720 to 840 minutes)
 *
 * Warnings (non-fatal):
 * - Cross-field inconsistencies (e.g., Windows UA + MacIntel platform)
 * - Non-standard values (e.g., unusual sample rates)
 * - Suspicious combinations (e.g., screen dimensions)
 *
 * @param config Headless mitigation configuration to validate
 * @returns Validation result with errors and warnings
 */
export function validateHeadlessMitigationConfig(
  config: HeadlessMitigationConfig
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Hardware validation
  if (config.hardware) {
    if (config.hardware.hardwareConcurrency !== undefined) {
      if (!Number.isInteger(config.hardware.hardwareConcurrency)) {
        errors.push('hardware.hardwareConcurrency must be an integer');
      } else if (config.hardware.hardwareConcurrency < 1 || config.hardware.hardwareConcurrency > 128) {
        errors.push('hardware.hardwareConcurrency must be between 1 and 128');
      }
    }

    if (config.hardware.deviceMemory !== undefined) {
      if (config.hardware.deviceMemory < 0.25 || config.hardware.deviceMemory > 256) {
        errors.push('hardware.deviceMemory must be between 0.25 and 256 GB');
      }
    }

    if (config.hardware.maxTouchPoints !== undefined) {
      if (!Number.isInteger(config.hardware.maxTouchPoints)) {
        errors.push('hardware.maxTouchPoints must be an integer');
      } else if (config.hardware.maxTouchPoints < 0 || config.hardware.maxTouchPoints > 10) {
        errors.push('hardware.maxTouchPoints must be between 0 and 10');
      }
    }
  }

  // Screen validation
  if (config.screen) {
    if (config.screen.width !== undefined) {
      if (!Number.isInteger(config.screen.width)) {
        errors.push('screen.width must be an integer');
      } else if (config.screen.width < 320 || config.screen.width > 7680) {
        errors.push('screen.width must be between 320 and 7680');
      }
    }

    if (config.screen.height !== undefined) {
      if (!Number.isInteger(config.screen.height)) {
        errors.push('screen.height must be an integer');
      } else if (config.screen.height < 240 || config.screen.height > 4320) {
        errors.push('screen.height must be between 240 and 4320');
      }
    }

    if (config.screen.availWidth !== undefined && config.screen.width !== undefined) {
      if (config.screen.availWidth > config.screen.width) {
        warnings.push('screen.availWidth should not exceed screen.width');
      }
    }

    if (config.screen.availHeight !== undefined && config.screen.height !== undefined) {
      if (config.screen.availHeight > config.screen.height) {
        warnings.push('screen.availHeight should not exceed screen.height');
      }
    }

    if (config.screen.colorDepth !== undefined) {
      const validDepths = [8, 16, 24, 30, 32, 48];
      if (!validDepths.includes(config.screen.colorDepth)) {
        warnings.push(`screen.colorDepth ${config.screen.colorDepth} is unusual, common values: ${validDepths.join(', ')}`);
      }
    }
  }

  // Window validation
  if (config.window) {
    if (config.window.innerWidth !== undefined) {
      if (!Number.isInteger(config.window.innerWidth)) {
        errors.push('window.innerWidth must be an integer');
      } else if (config.window.innerWidth < 320 || config.window.innerWidth > 7680) {
        errors.push('window.innerWidth must be between 320 and 7680');
      }

      // Check against screen width if both are defined
      if (config.screen?.width !== undefined && config.window.innerWidth > config.screen.width) {
        warnings.push('window.innerWidth should not exceed screen.width');
      }
    }

    if (config.window.innerHeight !== undefined) {
      if (!Number.isInteger(config.window.innerHeight)) {
        errors.push('window.innerHeight must be an integer');
      } else if (config.window.innerHeight < 240 || config.window.innerHeight > 4320) {
        errors.push('window.innerHeight must be between 240 and 4320');
      }

      // Check against screen height if both are defined
      if (config.screen?.height !== undefined && config.window.innerHeight > config.screen.height) {
        warnings.push('window.innerHeight should not exceed screen.height');
      }
    }

    if (config.window.devicePixelRatio !== undefined) {
      if (config.window.devicePixelRatio <= 0) {
        errors.push('window.devicePixelRatio must be greater than 0');
      } else if (config.window.devicePixelRatio < 0.5 || config.window.devicePixelRatio > 5.0) {
        warnings.push('window.devicePixelRatio outside typical range (0.5-5.0)');
      }
    }
  }

  // Timezone validation
  if (config.timezone) {
    if (config.timezone.offset !== undefined) {
      if (!Number.isInteger(config.timezone.offset)) {
        errors.push('timezone.offset must be an integer (minutes from UTC)');
      } else if (config.timezone.offset < -720 || config.timezone.offset > 840) {
        errors.push('timezone.offset must be between -720 and 840 minutes');
      }
    }

    // Validate timezone name format (basic check)
    if (config.timezone.name !== undefined) {
      if (typeof config.timezone.name !== 'string' || config.timezone.name.length === 0) {
        errors.push('timezone.name must be a non-empty string');
      }
    }
  }

  // Audio validation
  if (config.audio?.sampleRate !== undefined) {
    const validRates = [8000, 16000, 22050, 44100, 48000, 96000, 192000];
    if (!Number.isInteger(config.audio.sampleRate)) {
      errors.push('audio.sampleRate must be an integer');
    } else if (!validRates.includes(config.audio.sampleRate)) {
      warnings.push(`audio.sampleRate ${config.audio.sampleRate} is non-standard, common values: ${validRates.join(', ')}`);
    }
  }

  // Entropy validation
  if (config.entropy) {
    if (config.entropy.canvas !== undefined) {
      if (config.entropy.canvas < 0 || config.entropy.canvas > 1) {
        errors.push('entropy.canvas must be between 0.0 and 1.0');
      }
    }

    if (config.entropy.audio !== undefined) {
      if (config.entropy.audio < 0 || config.entropy.audio > 1) {
        errors.push('entropy.audio must be between 0.0 and 1.0');
      }
    }
  }

  // Cross-field consistency warnings
  if (config.userAgent && config.platform) {
    const uaLower = config.userAgent.toLowerCase();
    const platformLower = config.platform.toLowerCase();

    // Check Windows consistency
    if (platformLower.includes('win') && !uaLower.includes('windows')) {
      warnings.push('userAgent should contain "Windows" to match platform "Win32"');
    }

    // Check macOS consistency
    if (platformLower.includes('mac') && !uaLower.includes('mac')) {
      warnings.push('userAgent should contain "Mac" to match platform "MacIntel"');
    }

    // Check Linux consistency
    if (platformLower.includes('linux') && !uaLower.includes('linux') && !uaLower.includes('x11')) {
      warnings.push('userAgent should contain "Linux" or "X11" to match platform');
    }

    // Check Android consistency
    if (platformLower.includes('android') && !uaLower.includes('android')) {
      warnings.push('userAgent should contain "Android" to match platform');
    }
  }

  // Validate brand metadata consistency (if both userAgent and cdp.brands exist)
  if (config.userAgent && config.cdp?.brands) {
    const uaLower = config.userAgent.toLowerCase();

    // Check if brand versions are mentioned in user agent
    for (const brand of config.cdp.brands) {
      if (brand.brand.toLowerCase().includes('chrome') && !uaLower.includes('chrome')) {
        warnings.push(`cdp.brands includes "${brand.brand}" but userAgent does not contain "Chrome"`);
        break;
      }
    }
  }

  // Validate mobile flag consistency
  if (config.cdp?.mobile !== undefined && config.hardware?.maxTouchPoints !== undefined) {
    if (config.cdp.mobile && config.hardware.maxTouchPoints === 0) {
      warnings.push('cdp.mobile is true but hardware.maxTouchPoints is 0 (should be > 0 for mobile)');
    }
    if (!config.cdp.mobile && config.hardware.maxTouchPoints > 0) {
      warnings.push('cdp.mobile is false but hardware.maxTouchPoints > 0 (should be 0 for desktop)');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
