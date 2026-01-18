// Headless Detection Mitigation - Make browser appear more human/normal
(function() {
  'use strict';

  // Generate a simple event ID
  const generateEventId = function() {
    return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  // Get session ID from window or generate a temporary one
  const getSessionId = function() {
    return window.__js_unshroud_session_id || 'unknown_session';
  };

  const logEvent = function(event) {
    if (window.__js_unshroud_log) {
      // Ensure all events have required fields
      const enrichedEvent = {
        id: generateEventId(),
        sessionId: getSessionId(),
        timestamp: event.timestamp || Date.now(),
        ...event
      };
      window.__js_unshroud_log(JSON.stringify(enrichedEvent));
    }
  };


  // === CORE HEADLESS DETECTION MITIGATIONS ===

  // 1. Navigator.webdriver override - The most common headless detection method
  try {
    Object.defineProperty(window.navigator, 'webdriver', {
      get: function() {
        logEvent({
          type: 'headless_mitigation',
          method: 'navigator.webdriver',
          operation: 'value_override',
          originalValue: true,
          newValue: false,
          timestamp: Date.now()
        });
        return false; // Override to false
      },
      set: function() {
        // Allow setting but log it
        logEvent({
          type: 'headless_mitigation',
          method: 'navigator.webdriver',
          operation: 'set_attempt',
          timestamp: Date.now()
        });
      }
    });
  } catch (e) {
    console.warn('[JS Unshroud] Could not override navigator.webdriver:', e.message);
  }

  // 2. Hardware concurrency - Headless browsers often have unrealistic values
  try {
    const originalHardwareConcurrency = navigator.hardwareConcurrency;
    Object.defineProperty(window.navigator, 'hardwareConcurrency', {
      get: function() {
        const overrideValue = 8; // Realistic value for modern systems
        logEvent({
          type: 'headless_mitigation',
          method: 'navigator.hardwareConcurrency',
          operation: 'value_override',
          originalValue: originalHardwareConcurrency,
          newValue: overrideValue,
          timestamp: Date.now()
        });
        return overrideValue;
      }
    });
  } catch (e) {
    console.warn('[JS Unshroud] Could not override navigator.hardwareConcurrency:', e.message);
  }

  // 3. Device memory - Similar headless detection vector
  try {
    const originalDeviceMemory = navigator.deviceMemory;
    Object.defineProperty(window.navigator, 'deviceMemory', {
      get: function() {
        const overrideValue = 8; // Realistic value for modern systems
        logEvent({
          type: 'headless_mitigation',
          method: 'navigator.deviceMemory',
          operation: 'value_override',
          originalValue: originalDeviceMemory,
          newValue: overrideValue,
          timestamp: Date.now()
        });
        return overrideValue;
      }
    });
  } catch (e) {
    console.warn('[JS Unshroud] Could not override navigator.deviceMemory:', e.message);
  }

  // 4. Plugins - Headless browsers often have no plugins
  try {
    Object.defineProperty(window.navigator, 'plugins', {
      get: function() {
        // Create a minimal but realistic plugin array
        const fakePlugins = [
          {
            name: 'Chrome PDF Plugin',
            description: 'Portable Document Format',
            filename: 'internal-pdf-viewer',
            length: 1,
            0: { type: 'application/pdf', description: 'Portable Document Format' }
          },
          {
            name: 'Chromium PDF Plugin',
            description: 'Portable Document Format',
            filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
            length: 1,
            0: { type: 'application/pdf', description: 'Portable Document Format' }
          },
          {
            name: 'Native Client',
            description: 'Executes NaCl files',
            filename: 'internal-nacl-plugin',
            length: 0
          }
        ];

        logEvent({
          type: 'headless_mitigation',
          method: 'navigator.plugins',
          operation: 'plugins_override',
          pluginCount: fakePlugins.length,
          timestamp: Date.now()
        });

        return fakePlugins;
      }
    });
  } catch (e) {
    console.warn('[JS Unshroud] Could not override navigator.plugins:', e.message);
  }

  // 5. Permissions API - Mitigate "denied" permissions that indicate headless
  try {
    const originalQuery = window.navigator.permissions?.query;
    if (originalQuery) {
      window.navigator.permissions.query = function(permissionDescriptor) {
        return originalQuery.call(this, permissionDescriptor).then(function(result) {
          logEvent({
            type: 'headless_mitigation',
            method: 'navigator.permissions.query',
            operation: 'permission_override',
            name: permissionDescriptor.name,
            originalState: result.state,
            newState: 'granted',
            timestamp: Date.now()
          });

          // Always return 'granted' to mimic normal browser behavior
          return {
            state: 'granted',
            onchange: null
          };
        }).catch(function(error) {
          logEvent({
            type: 'headless_mitigation',
            method: 'navigator.permissions.query',
            operation: 'permission_override',
            name: permissionDescriptor.name,
            originalError: error.message,
            newState: 'granted',
            timestamp: Date.now()
          });

          // Return a fake "granted" permission instead of denying
          return Promise.resolve({
            state: 'granted',
            onchange: null
          });
        });
      };
    }
  } catch (e) {
    console.warn('[JS Unshroud] Could not override permissions.query:', e.message);
  }

  // 6. Canvas fingerprinting mitigation (basic entropy injection)
  try {
    // eslint-disable-next-line no-undef
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    // eslint-disable-next-line no-undef, no-unused-vars
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    // eslint-disable-next-line no-undef
    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;

    // Canvas toDataURL randomization
    // eslint-disable-next-line no-undef
    HTMLCanvasElement.prototype.toDataURL = function() {
      const result = originalToDataURL.apply(this, arguments);

      // Add small random variations to canvas output to avoid exact fingerprinting
      if (result && result.length > 100) { // Only modify lengthy canvas data
        const randByte = Math.floor(Math.random() * 256);
        const modifiedResult = result.slice(0, -2) + randByte.toString(16).padStart(2, '0') + result.slice(-2);

        logEvent({
          type: 'headless_mitigation',
          method: 'canvas.toDataURL',
          operation: 'entropy_injection',
          originalLength: result.length,
          newLength: modifiedResult.length,
          timestamp: Date.now()
        });

        return modifiedResult;
      }

      return result;
    };

    // Canvas getImageData randomization
    // eslint-disable-next-line no-undef
    CanvasRenderingContext2D.prototype.getImageData = function() {
      const result = originalGetImageData.apply(this, arguments);

      // Add small noise to pixel data to break exact fingerprinting
      if (result && result.data && result.data.length > 0) {
        const noiseLevel = 0.01; // 1% noise
        for (let i = 0; i < result.data.length; i += 4) { // Process RGBA pixels
          if (Math.random() < noiseLevel) {
            result.data[i] = Math.min(255, Math.max(0, result.data[i] + (Math.random() * 10 - 5)));     // R
            result.data[i+1] = Math.min(255, Math.max(0, result.data[i+1] + (Math.random() * 10 - 5))); // G
            result.data[i+2] = Math.min(255, Math.max(0, result.data[i+2] + (Math.random() * 10 - 5))); // B
            // A channel unchanged to preserve transparency
          }
        }

        logEvent({
          type: 'headless_mitigation',
          method: 'canvas.getImageData',
          operation: 'noise_injection',
          width: result.width,
          height: result.height,
          timestamp: Date.now()
        });
      }

      return result;
    };

  } catch (e) {
    console.warn('[JS Unshroud] Could not apply canvas mitigations:', e.message);
  }

  // 7. CSS media queries - Some headless detection uses CSS
  try {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = function(query) {
      const result = originalMatchMedia.call(this, query);

      // Monitor for headless-specific media queries
      if (query.includes('device-width') || query.includes('device-height') ||
          query.includes('device-pixel-ratio') || query.includes('forced-colors')) {

        logEvent({
          type: 'headless_mitigation',
          method: 'window.matchMedia',
          operation: 'media_query_monitor',
          query: query,
          originalResult: result.matches,
          timestamp: Date.now()
        });
      }

      return result;
    };
  } catch (e) {
    console.warn('[JS Unshroud] Could not override matchMedia:', e.message);
  }

  // 8. WebGL renderer override
  try {
    // eslint-disable-next-line no-undef
    const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
    if (originalGetParameter) {
      // eslint-disable-next-line no-undef
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        const result = originalGetParameter.call(this, parameter);

        // Override GPU fingerprinting constants
        if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
          const overrideValue = 'Google Inc. (Intel)';
          logEvent({
            type: 'headless_mitigation',
            method: 'webgl.getParameter',
            operation: 'vendor_override',
            parameter: parameter,
            originalValue: result,
            newValue: overrideValue,
            timestamp: Date.now()
          });
          return overrideValue;
        } else if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
          const overrideValue = 'ANGLE (Intel, Mesa Intel(R) UHD Graphics (CML GT2), Version 27.2.1 (Linux x64))';
          logEvent({
            type: 'headless_mitigation',
            method: 'webgl.getParameter',
            operation: 'renderer_override',
            parameter: parameter,
            originalValue: result,
            newValue: overrideValue,
            timestamp: Date.now()
          });
          return overrideValue;
        }

        return result;
      };
    }
  } catch (e) {
    console.warn('[JS Unshroud] Could not apply WebGL mitigations:', e.message);
  }


  // === AUDIO FINGERPRINTING MITIGATION ===

  // 1. Override AudioContext sampleRate to standard 44.1kHz
  try {
    const OriginalAudioContext = window.AudioContext || window.webkitAudioContext;
    if (OriginalAudioContext) {
      const AudioContextWrapper = function() {
        const ctx = new OriginalAudioContext(...arguments);

        // Override sampleRate getter to return standard value
        Object.defineProperty(ctx, 'sampleRate', {
          get: function() {
            logEvent({
              type: 'headless_mitigation',
              method: 'AudioContext.sampleRate',
              operation: 'audio_samplerate_spoofed',
              originalValue: 48000, // Actual value varies by system
              newValue: 44100,
              timestamp: Date.now()
            });
            return 44100; // Standard audio CD quality
          },
          configurable: false
        });

        return ctx;
      };

      AudioContextWrapper.prototype = OriginalAudioContext.prototype;
      window.AudioContext = AudioContextWrapper;
      if (window.webkitAudioContext) {
        window.webkitAudioContext = AudioContextWrapper;
      }
    }
  } catch (e) {
    console.warn('[JS Unshroud] Could not override AudioContext:', e.message);
  }

  // 2. Inject noise into OfflineAudioContext rendering
  try {
    if (window.OfflineAudioContext && window.OfflineAudioContext.prototype.startRendering) {
      const originalStartRendering = window.OfflineAudioContext.prototype.startRendering;

      window.OfflineAudioContext.prototype.startRendering = function() {
        const renderPromise = originalStartRendering.apply(this, arguments);

        return renderPromise.then(function(audioBuffer) {
          // Add imperceptible noise to prevent exact fingerprinting
          for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            // Add noise to every 100th sample to minimize overhead
            for (let i = 0; i < channelData.length; i += 100) {
              channelData[i] += (Math.random() - 0.5) * 0.0001; // ±0.00005 noise
            }
          }

          logEvent({
            type: 'headless_mitigation',
            method: 'OfflineAudioContext.startRendering',
            operation: 'audio_noise_injection',
            originalValue: audioBuffer.numberOfChannels + ' channels, ' + audioBuffer.length + ' samples',
            timestamp: Date.now()
          });

          return audioBuffer;
        });
      };
    }
  } catch (e) {
    console.warn('[JS Unshroud] Could not apply OfflineAudioContext mitigations:', e.message);
  }


  // === FONT FINGERPRINTING MITIGATION ===

  // Spoof document.fonts to return realistic minimal Windows font list
  try {
    Object.defineProperty(document, 'fonts', {
      get: function() {
        logEvent({
          type: 'headless_mitigation',
          method: 'document.fonts',
          operation: 'font_list_spoofed',
          originalValue: 'actual_system_fonts',
          newValue: 'fake_windows_fonts',
          timestamp: Date.now()
        });

        // Fake font faces matching common Windows fonts
        const fakeFonts = [
          { family: 'Arial', style: 'normal', weight: '400' },
          { family: 'Times New Roman', style: 'normal', weight: '400' },
          { family: 'Courier New', style: 'normal', weight: '400' },
          { family: 'Verdana', style: 'normal', weight: '400' }
        ];

        return {
          size: 4,

          check: function(fontSpec) {
            // Extract font family from spec like "12px Arial"
            const normalized = fontSpec.toLowerCase();
            const families = ['arial', 'times new roman', 'courier new', 'verdana'];
            const hasFont = families.some(function(f) {
              return normalized.includes(f);
            });

            logEvent({
              type: 'headless_mitigation',
              method: 'document.fonts.check',
              operation: 'font_check_spoofed',
              originalValue: fontSpec,
              newValue: hasFont,
              timestamp: Date.now()
            });

            return hasFont;
          },

          load: function() {
            return Promise.resolve(this);
          },

          ready: Promise.resolve(this),
          status: 'loaded',

          [Symbol.iterator]: function*() {
            for (let i = 0; i < fakeFonts.length; i++) {
              yield fakeFonts[i];
            }
          },

          forEach: function(callback) {
            for (let i = 0; i < fakeFonts.length; i++) {
              callback(fakeFonts[i], i, this);
            }
          }
        };
      },
      configurable: true
    });
  } catch (e) {
    console.warn('[JS Unshroud] Could not override document.fonts:', e.message);
  }


  // === WEBRTC FINGERPRINTING MITIGATION ===

  // 1. Block RTCPeerConnection
  try {
    window.RTCPeerConnection = function() {
      logEvent({
        type: 'headless_mitigation',
        method: 'RTCPeerConnection',
        operation: 'webrtc_blocked',
        timestamp: Date.now()
      });

      // eslint-disable-next-line no-undef
      throw new DOMException('WebRTC is not supported in this browser', 'NotSupportedError');
    };

    window.webkitRTCPeerConnection = window.RTCPeerConnection;
    window.mozRTCPeerConnection = window.RTCPeerConnection;
  } catch (e) {
    console.warn('[JS Unshroud] Could not block RTCPeerConnection:', e.message);
  }

  // 2. Block getUserMedia and enumerateDevices
  try {
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia = function(constraints) {
        logEvent({
          type: 'headless_mitigation',
          method: 'navigator.mediaDevices.getUserMedia',
          operation: 'media_access_blocked',
          originalValue: JSON.stringify(constraints),
          timestamp: Date.now()
        });

        // eslint-disable-next-line no-undef
        return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
      };

      // Block device enumeration
      navigator.mediaDevices.enumerateDevices = function() {
        logEvent({
          type: 'headless_mitigation',
          method: 'navigator.mediaDevices.enumerateDevices',
          operation: 'device_enumeration_blocked',
          timestamp: Date.now()
        });

        return Promise.resolve([]); // No devices available
      };
    }
  } catch (e) {
    console.warn('[JS Unshroud] Could not block mediaDevices:', e.message);
  }


  // === SCREEN/VIEWPORT FINGERPRINTING MITIGATION ===

  // 1. Spoof screen dimensions to 1920x1080
  try {
    Object.defineProperties(window.screen, {
      width: {
        get: function() {
          logEvent({
            type: 'headless_mitigation',
            method: 'screen.width',
            operation: 'screen_dimension_spoofed',
            newValue: 1920,
            timestamp: Date.now()
          });
          return 1920;
        },
        configurable: true
      },
      height: {
        get: function() { return 1080; },
        configurable: true
      },
      availWidth: {
        get: function() { return 1920; },
        configurable: true
      },
      availHeight: {
        get: function() { return 1040; }, // Account for taskbar
        configurable: true
      },
      colorDepth: {
        get: function() { return 24; },
        configurable: true
      },
      pixelDepth: {
        get: function() { return 24; },
        configurable: true
      }
    });
  } catch (e) {
    console.warn('[JS Unshroud] Could not override screen properties:', e.message);
  }

  // 2. Spoof devicePixelRatio
  try {
    Object.defineProperty(window, 'devicePixelRatio', {
      get: function() { return 1.0; }, // Standard non-retina
      configurable: true
    });
  } catch (e) {
    console.warn('[JS Unshroud] Could not override devicePixelRatio:', e.message);
  }

  // 3. Spoof window dimensions
  try {
    Object.defineProperty(window, 'innerWidth', {
      get: function() { return 1280; },
      configurable: true
    });

    Object.defineProperty(window, 'innerHeight', {
      get: function() { return 720; },
      configurable: true
    });

    Object.defineProperty(window, 'outerWidth', {
      get: function() { return 1296; }, // Account for scrollbar
      configurable: true
    });

    Object.defineProperty(window, 'outerHeight', {
      get: function() { return 825; }, // Account for browser chrome
      configurable: true
    });
  } catch (e) {
    console.warn('[JS Unshroud] Could not override window dimensions:', e.message);
  }


  // === TIMEZONE FINGERPRINTING MITIGATION ===

  // 1. Override Date.prototype.getTimezoneOffset
  try {
    const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;

    Date.prototype.getTimezoneOffset = function() {
      const spoofedOffset = 300; // US Eastern Time (UTC-5, or -300 minutes)

      logEvent({
        type: 'headless_mitigation',
        method: 'Date.prototype.getTimezoneOffset',
        operation: 'timezone_spoofed',
        originalValue: originalGetTimezoneOffset.call(this),
        newValue: spoofedOffset,
        timestamp: Date.now()
      });

      return spoofedOffset;
    };
  } catch (e) {
    console.warn('[JS Unshroud] Could not override getTimezoneOffset:', e.message);
  }

  // 2. Override Intl.DateTimeFormat resolvedOptions
  try {
    const OriginalDateTimeFormat = Intl.DateTimeFormat;

    Intl.DateTimeFormat = function() {
      const formatter = new OriginalDateTimeFormat(...arguments);
      const originalResolvedOptions = formatter.resolvedOptions;

      formatter.resolvedOptions = function() {
        const options = originalResolvedOptions.call(this);
        options.timeZone = 'America/New_York'; // Match getTimezoneOffset offset

        logEvent({
          type: 'headless_mitigation',
          method: 'Intl.DateTimeFormat.resolvedOptions',
          operation: 'timezone_spoofed',
          newValue: 'America/New_York',
          timestamp: Date.now()
        });

        return options;
      };

      return formatter;
    };

    Intl.DateTimeFormat.prototype = OriginalDateTimeFormat.prototype;
  } catch (e) {
    console.warn('[JS Unshroud] Could not override Intl.DateTimeFormat:', e.message);
  }


  // === BATTERY API FINGERPRINTING MITIGATION ===

  // 1. Block navigator.getBattery
  try {
    if (navigator.getBattery) {
      navigator.getBattery = function() {
        logEvent({
          type: 'headless_mitigation',
          method: 'navigator.getBattery',
          operation: 'battery_api_blocked',
          timestamp: Date.now()
        });

        // eslint-disable-next-line no-undef
        return Promise.reject(new DOMException('Battery Status API is not supported', 'NotSupportedError'));
      };
    }

    // Remove battery property if it exists
    if ('battery' in navigator) {
      delete navigator.battery;
    }
  } catch (e) {
    console.warn('[JS Unshroud] Could not block Battery API:', e.message);
  }


  console.log('[JS Unshroud] Headless mitigation hooks loaded');
})();
