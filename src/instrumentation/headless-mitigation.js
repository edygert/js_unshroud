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

  // Read headless mitigation config from window object
  // Config is injected by runner.ts before this script loads
  const config = window.__js_unshroud_headless_config || {};

  // === UTILITY FUNCTIONS FOR NATIVE SPOOFING ===

  // Make a regular function appear native by spoofing toString()
  const makeNativeFunction = function(func, functionName) {
    Object.defineProperty(func, 'toString', {
      value: function() {
        return 'function ' + functionName + '() { [native code] }';
      },
      writable: false,
      enumerable: false,
      configurable: false  // Match native behavior (non-configurable)
    });

    Object.defineProperty(func, 'name', {
      value: functionName,
      writable: false,
      enumerable: false,
      configurable: false  // Match native behavior (non-configurable)
    });

    return func;
  };

  // Make a getter function appear native (includes "get" keyword)
  const makeNativeGetter = function(func, propertyName) {
    Object.defineProperty(func, 'toString', {
      value: function() {
        return 'function get ' + propertyName + '() { [native code] }';
      },
      writable: false,
      enumerable: false,
      configurable: false  // Match native behavior (non-configurable)
    });

    Object.defineProperty(func, 'name', {
      value: 'get ' + propertyName,
      writable: false,
      enumerable: false,
      configurable: false  // Match native behavior (non-configurable)
    });

    return func;
  };

  // Create a Chrome event object with addListener, removeListener, etc.
  // These are stubs that exist but do nothing (matching non-extension page behavior)
  const createChromeEvent = function(_eventName) {
    const listeners = [];
    return {
      addListener: makeNativeFunction(function(callback) {
        if (typeof callback === 'function') {
          listeners.push(callback);
        }
      }, 'addListener'),
      removeListener: makeNativeFunction(function(callback) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }, 'removeListener'),
      hasListener: makeNativeFunction(function(callback) {
        return listeners.indexOf(callback) > -1;
      }, 'hasListener'),
      hasListeners: makeNativeFunction(function() {
        return listeners.length > 0;
      }, 'hasListeners'),
      // getRules and other methods exist but throw in non-extension context
      getRules: makeNativeFunction(function() {
        return [];
      }, 'getRules'),
      addRules: makeNativeFunction(function() {}, 'addRules'),
      removeRules: makeNativeFunction(function() {}, 'removeRules')
    };
  };

  // === CORE HEADLESS DETECTION MITIGATIONS ===

  // 0. Fix broken image dimensions - Real Chrome reports 0x0, not 16x16
  try {
    // Override naturalWidth and naturalHeight for broken images
    // eslint-disable-next-line no-undef
    const originalImageDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'naturalWidth');
    // eslint-disable-next-line no-undef
    const originalHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'naturalHeight');

    // eslint-disable-next-line no-undef
    Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', {
      get: function() {
        // If image failed to load, return 0 (real Chrome behavior)
        if (this.complete && !this.naturalWidth) {
          logEvent({
            type: 'headless_mitigation',
            method: 'HTMLImageElement.naturalWidth',
            operation: 'broken_image_dimension_fix',
            originalValue: originalImageDescriptor ? originalImageDescriptor.get.call(this) : 16,
            newValue: 0,
            timestamp: Date.now()
          });
          return 0;
        }
        return originalImageDescriptor ? originalImageDescriptor.get.call(this) : 0;
      },
      configurable: true
    });

    // eslint-disable-next-line no-undef
    Object.defineProperty(HTMLImageElement.prototype, 'naturalHeight', {
      get: function() {
        // If image failed to load, return 0 (real Chrome behavior)
        if (this.complete && !this.naturalHeight) {
          logEvent({
            type: 'headless_mitigation',
            method: 'HTMLImageElement.naturalHeight',
            operation: 'broken_image_dimension_fix',
            originalValue: originalHeightDescriptor ? originalHeightDescriptor.get.call(this) : 16,
            newValue: 0,
            timestamp: Date.now()
          });
          return 0;
        }
        return originalHeightDescriptor ? originalHeightDescriptor.get.call(this) : 0;
      },
      configurable: true
    });

    // Also override width/height properties for broken images
    // eslint-disable-next-line no-undef
    Object.defineProperty(HTMLImageElement.prototype, 'width', {
      get: function() {
        if (this.complete && this.naturalWidth === 0) {
          return 0;
        }
        return this.getAttribute('width') || this.naturalWidth || 0;
      },
      set: function(value) {
        this.setAttribute('width', value);
      },
      configurable: true
    });

    // eslint-disable-next-line no-undef
    Object.defineProperty(HTMLImageElement.prototype, 'height', {
      get: function() {
        if (this.complete && this.naturalHeight === 0) {
          return 0;
        }
        return this.getAttribute('height') || this.naturalHeight || 0;
      },
      set: function(value) {
        this.setAttribute('height', value);
      },
      configurable: true
    });
  } catch (e) {
    window.__js_unshroud_debug('[JS Unshroud] Could not fix broken image dimensions:', e.message);
  }

  // 1. Navigator.webdriver - INTENTIONALLY NOT OVERRIDDEN
  // The --disable-blink-features=AutomationControlled flag (set in runner.ts) prevents
  // Chromium from creating navigator.webdriver at all. By NOT creating an override here,
  // the property remains undefined, which defeats both direct checks (navigator.webdriver)
  // AND existence checks like _.has(navigator, "webdriver").
  //
  // Trade-off: We lose the ability to log when malware checks this property, but gain
  // complete evasion of property existence detection (_.has, 'webdriver' in navigator, etc.)

  // 2. Hardware concurrency - Headless browsers often have unrealistic values
  try {
    const originalHardwareConcurrency = navigator.hardwareConcurrency;
    Object.defineProperty(window.navigator, 'hardwareConcurrency', {
      get: makeNativeGetter(function() {
        const overrideValue = config.hardware?.hardwareConcurrency || 8; // Realistic value for modern systems
        logEvent({
          type: 'headless_mitigation',
          method: 'navigator.hardwareConcurrency',
          operation: 'value_override',
          originalValue: originalHardwareConcurrency,
          newValue: overrideValue,
          timestamp: Date.now()
        });
        return overrideValue;
      }, 'hardwareConcurrency')
    });
  } catch (e) {
    window.__js_unshroud_debug('[JS Unshroud] Could not override navigator.hardwareConcurrency:', e.message);
  }

  // 3. Device memory - Similar headless detection vector
  try {
    const originalDeviceMemory = navigator.deviceMemory;
    Object.defineProperty(window.navigator, 'deviceMemory', {
      get: makeNativeGetter(function() {
        const overrideValue = config.hardware?.deviceMemory || 8; // Realistic value for modern systems
        logEvent({
          type: 'headless_mitigation',
          method: 'navigator.deviceMemory',
          operation: 'value_override',
          originalValue: originalDeviceMemory,
          newValue: overrideValue,
          timestamp: Date.now()
        });
        return overrideValue;
      }, 'deviceMemory')
    });
  } catch (e) {
    window.__js_unshroud_debug('[JS Unshroud] Could not override navigator.deviceMemory:', e.message);
  }

  // 4. Plugins - Headless browsers often have no plugins
  try {
    // Get the original plugins object to access prototypes
    const originalPlugins = navigator.plugins;
    const PluginArrayProto = Object.getPrototypeOf(originalPlugins);

    // Get Plugin prototype from an existing plugin if available, otherwise use Object
    let PluginProto = Object.prototype;
    if (originalPlugins.length > 0) {
      PluginProto = Object.getPrototypeOf(originalPlugins[0]);
    }

    Object.defineProperty(window.navigator, 'plugins', {
      get: makeNativeGetter(function() {
        // Create individual Plugin objects with proper Plugin.prototype chain
        // Use Object.defineProperty to avoid "getter only" errors
        const plugin1 = Object.create(PluginProto);
        Object.defineProperty(plugin1, 'name', { value: 'Chrome PDF Plugin', writable: false, enumerable: true, configurable: true });
        Object.defineProperty(plugin1, 'description', { value: 'Portable Document Format', writable: false, enumerable: true, configurable: true });
        Object.defineProperty(plugin1, 'filename', { value: 'internal-pdf-viewer', writable: false, enumerable: true, configurable: true });
        Object.defineProperty(plugin1, 'length', { value: 1, writable: false, enumerable: true, configurable: true });
        Object.defineProperty(plugin1, '0', { value: { type: 'application/pdf', description: 'Portable Document Format', suffixes: 'pdf', enabledPlugin: plugin1 }, writable: false, enumerable: true, configurable: true });
        Object.defineProperty(plugin1, 'toString', { value: makeNativeFunction(function() { return '[object Plugin]'; }, 'toString'), writable: false, enumerable: false, configurable: true });
        Object.defineProperty(plugin1, Symbol.toStringTag, { value: 'Plugin', writable: false, enumerable: false, configurable: true });

        const plugin2 = Object.create(PluginProto);
        Object.defineProperty(plugin2, 'name', { value: 'Chromium PDF Plugin', writable: false, enumerable: true, configurable: true });
        Object.defineProperty(plugin2, 'description', { value: 'Portable Document Format', writable: false, enumerable: true, configurable: true });
        Object.defineProperty(plugin2, 'filename', { value: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', writable: false, enumerable: true, configurable: true });
        Object.defineProperty(plugin2, 'length', { value: 1, writable: false, enumerable: true, configurable: true });
        Object.defineProperty(plugin2, '0', { value: { type: 'application/pdf', description: 'Portable Document Format', suffixes: 'pdf', enabledPlugin: plugin2 }, writable: false, enumerable: true, configurable: true });
        Object.defineProperty(plugin2, 'toString', { value: makeNativeFunction(function() { return '[object Plugin]'; }, 'toString'), writable: false, enumerable: false, configurable: true });
        Object.defineProperty(plugin2, Symbol.toStringTag, { value: 'Plugin', writable: false, enumerable: false, configurable: true });

        const plugin3 = Object.create(PluginProto);
        Object.defineProperty(plugin3, 'name', { value: 'Native Client', writable: false, enumerable: true, configurable: true });
        Object.defineProperty(plugin3, 'description', { value: 'Executes NaCl files', writable: false, enumerable: true, configurable: true });
        Object.defineProperty(plugin3, 'filename', { value: 'internal-nacl-plugin', writable: false, enumerable: true, configurable: true });
        Object.defineProperty(plugin3, 'length', { value: 0, writable: false, enumerable: true, configurable: true });
        Object.defineProperty(plugin3, 'toString', { value: makeNativeFunction(function() { return '[object Plugin]'; }, 'toString'), writable: false, enumerable: false, configurable: true });
        Object.defineProperty(plugin3, Symbol.toStringTag, { value: 'Plugin', writable: false, enumerable: false, configurable: true });

        // Create PluginArray with proper PluginArray.prototype chain
        // CRITICAL: Use __proto__ to set prototype - this makes instanceof PluginArray work
        // Based on research: https://github.com/infosimples/detect-headless/issues/6
        const fakePlugins = {
          0: plugin1,
          1: plugin2,
          2: plugin3,
          length: 3,
          item: function(index) {
            return this[index] || null;
          },
          namedItem: function(name) {
            for (let i = 0; i < this.length; i++) {
              if (this[i] && this[i].name === name) return this[i];
            }
            return null;
          },
          refresh: function() {
            // No-op for fake plugins
          },
          toString: makeNativeFunction(function() {
            return '[object PluginArray]';
          }, 'toString'),
          __proto__: PluginArrayProto
        };

        // Set Symbol.toStringTag for correct Object.prototype.toString behavior
        try {
          Object.defineProperty(fakePlugins, Symbol.toStringTag, {
            value: 'PluginArray',
            configurable: true
          });
        } catch {
          // Ignore if Symbol.toStringTag can't be set
        }

        logEvent({
          type: 'headless_mitigation',
          method: 'navigator.plugins',
          operation: 'plugins_override',
          pluginCount: fakePlugins.length,
          timestamp: Date.now()
        });

        return fakePlugins;
      }, 'plugins'),
      configurable: true
    });
  } catch (e) {
    window.__js_unshroud_debug('[JS Unshroud] Could not override navigator.plugins:', e.message);
  }

  // 5. Permissions API - Mitigate "denied" permissions that indicate headless
  try {
    if (window.navigator.permissions && window.navigator.permissions.query) {
      window.navigator.permissions.query = makeNativeFunction(function(permissionDescriptor) {
        logEvent({
          type: 'headless_mitigation',
          method: 'navigator.permissions.query',
          operation: 'permission_override',
          name: permissionDescriptor.name,
          newState: 'prompt',
          timestamp: Date.now()
        });

        // Return 'prompt' to mimic normal browser behavior (more realistic than 'granted')
        // Real browsers show 'prompt' until user explicitly grants/denies permission
        return Promise.resolve({
          state: 'prompt',
          onchange: null,
          addEventListener: function() {},
          removeEventListener: function() {},
          dispatchEvent: function() { return true; }
        });
      }, 'query');
    }
  } catch (e) {
    window.__js_unshroud_debug('[JS Unshroud] Could not override permissions.query:', e.message);
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
    HTMLCanvasElement.prototype.toDataURL = makeNativeFunction(function() {
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
    }, 'toDataURL');

    // Canvas getImageData randomization
    // eslint-disable-next-line no-undef
    CanvasRenderingContext2D.prototype.getImageData = makeNativeFunction(function() {
      const result = originalGetImageData.apply(this, arguments);

      // Add small noise to pixel data to break exact fingerprinting
      if (result && result.data && result.data.length > 0) {
        const noiseLevel = config.entropy?.canvas || 0.01; // 1% noise (configurable)
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
    }, 'getImageData');

  } catch (e) {
    window.__js_unshroud_debug('[JS Unshroud] Could not apply canvas mitigations:', e.message);
  }

  // 7. CSS media queries - Some headless detection uses CSS
  try {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = makeNativeFunction(function(query) {
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
    }, 'matchMedia');
  } catch (e) {
    window.__js_unshroud_debug('[JS Unshroud] Could not override matchMedia:', e.message);
  }

  // 8. WebGL renderer override
  try {
    // eslint-disable-next-line no-undef
    const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
    if (originalGetParameter) {
      // eslint-disable-next-line no-undef
      WebGLRenderingContext.prototype.getParameter = makeNativeFunction(function(parameter) {
        const result = originalGetParameter.call(this, parameter);

        // Override GPU fingerprinting constants
        if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
          const overrideValue = config.webgl?.vendor || 'Google Inc. (Intel)';
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
          const overrideValue = config.webgl?.renderer || 'ANGLE (Intel, Mesa Intel(R) UHD Graphics (CML GT2), Version 27.2.1 (Linux x64))';
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
      }, 'getParameter');
    }
  } catch (e) {
    window.__js_unshroud_debug('[JS Unshroud] Could not apply WebGL mitigations:', e.message);
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
              newValue: config.audio?.sampleRate || 44100,
              timestamp: Date.now()
            });
            return config.audio?.sampleRate || 44100; // Standard audio CD quality (configurable)
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
    window.__js_unshroud_debug('[JS Unshroud] Could not override AudioContext:', e.message);
  }

  // 2. Inject noise into OfflineAudioContext rendering
  try {
    if (window.OfflineAudioContext && window.OfflineAudioContext.prototype.startRendering) {
      const originalStartRendering = window.OfflineAudioContext.prototype.startRendering;

      window.OfflineAudioContext.prototype.startRendering = makeNativeFunction(function() {
        const renderPromise = originalStartRendering.apply(this, arguments);

        return renderPromise.then(function(audioBuffer) {
          // Add imperceptible noise to prevent exact fingerprinting
          for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            // Add noise to every 100th sample to minimize overhead
            const audioNoiseAmplitude = config.entropy?.audio || 0.0001;
            for (let i = 0; i < channelData.length; i += 100) {
              channelData[i] += (Math.random() - 0.5) * audioNoiseAmplitude; // Configurable noise amplitude
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
      }, 'startRendering');
    }
  } catch (e) {
    window.__js_unshroud_debug('[JS Unshroud] Could not apply OfflineAudioContext mitigations:', e.message);
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
    window.__js_unshroud_debug('[JS Unshroud] Could not override document.fonts:', e.message);
  }


  // === WEBRTC FINGERPRINTING MITIGATION ===

  // 1. Block RTCPeerConnection
  try {
    const rtcPeerConnectionWrapper = makeNativeFunction(function() {
      logEvent({
        type: 'headless_mitigation',
        method: 'RTCPeerConnection',
        operation: 'webrtc_blocked',
        timestamp: Date.now()
      });

      // eslint-disable-next-line no-undef
      throw new DOMException('WebRTC is not supported in this browser', 'NotSupportedError');
    }, 'RTCPeerConnection');

    window.RTCPeerConnection = rtcPeerConnectionWrapper;
    window.webkitRTCPeerConnection = rtcPeerConnectionWrapper;
    window.mozRTCPeerConnection = rtcPeerConnectionWrapper;
  } catch (e) {
    window.__js_unshroud_debug('[JS Unshroud] Could not block RTCPeerConnection:', e.message);
  }

  // 2. Block getUserMedia and enumerateDevices
  try {
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia = makeNativeFunction(function(constraints) {
        logEvent({
          type: 'headless_mitigation',
          method: 'navigator.mediaDevices.getUserMedia',
          operation: 'media_access_blocked',
          originalValue: JSON.stringify(constraints),
          timestamp: Date.now()
        });

        // eslint-disable-next-line no-undef
        return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
      }, 'getUserMedia');

      // Block device enumeration
      navigator.mediaDevices.enumerateDevices = makeNativeFunction(function() {
        logEvent({
          type: 'headless_mitigation',
          method: 'navigator.mediaDevices.enumerateDevices',
          operation: 'device_enumeration_blocked',
          timestamp: Date.now()
        });

        return Promise.resolve([]); // No devices available
      }, 'enumerateDevices');
    }
  } catch (e) {
    window.__js_unshroud_debug('[JS Unshroud] Could not block mediaDevices:', e.message);
  }


  // === SCREEN/VIEWPORT FINGERPRINTING MITIGATION ===

  // 1. Spoof screen dimensions (configurable)
  try {
    const screenWidth = config.screen?.width || 1920;
    const screenHeight = config.screen?.height || 1080;
    const screenAvailWidth = config.screen?.availWidth || screenWidth;
    const screenAvailHeight = config.screen?.availHeight || 1040;
    const screenColorDepth = config.screen?.colorDepth || 24;
    const screenPixelDepth = config.screen?.pixelDepth || screenColorDepth;

    Object.defineProperties(window.screen, {
      width: {
        get: makeNativeGetter(function() {
          logEvent({
            type: 'headless_mitigation',
            method: 'screen.width',
            operation: 'screen_dimension_spoofed',
            newValue: screenWidth,
            timestamp: Date.now()
          });
          return screenWidth;
        }, 'width'),
        configurable: true
      },
      height: {
        get: makeNativeGetter(function() { return screenHeight; }, 'height'),
        configurable: true
      },
      availWidth: {
        get: makeNativeGetter(function() { return screenAvailWidth; }, 'availWidth'),
        configurable: true
      },
      availHeight: {
        get: makeNativeGetter(function() { return screenAvailHeight; }, 'availHeight'),
        configurable: true
      },
      colorDepth: {
        get: makeNativeGetter(function() { return screenColorDepth; }, 'colorDepth'),
        configurable: true
      },
      pixelDepth: {
        get: makeNativeGetter(function() { return screenPixelDepth; }, 'pixelDepth'),
        configurable: true
      }
    });
  } catch (e) {
    window.__js_unshroud_debug('[JS Unshroud] Could not override screen properties:', e.message);
  }

  // 2. Spoof devicePixelRatio (configurable)
  try {
    const devicePixelRatio = config.window?.devicePixelRatio || 1.0;
    Object.defineProperty(window, 'devicePixelRatio', {
      get: makeNativeGetter(function() { return devicePixelRatio; }, 'devicePixelRatio'),
      configurable: true
    });
  } catch (e) {
    window.__js_unshroud_debug('[JS Unshroud] Could not override devicePixelRatio:', e.message);
  }

  // 3. Spoof window dimensions (configurable)
  try {
    const innerWidth = config.window?.innerWidth || 1280;
    const innerHeight = config.window?.innerHeight || 720;
    const outerWidth = config.window?.outerWidth || 1296;
    const outerHeight = config.window?.outerHeight || 825;

    Object.defineProperty(window, 'innerWidth', {
      get: makeNativeGetter(function() { return innerWidth; }, 'innerWidth'),
      configurable: true
    });

    Object.defineProperty(window, 'innerHeight', {
      get: makeNativeGetter(function() { return innerHeight; }, 'innerHeight'),
      configurable: true
    });

    Object.defineProperty(window, 'outerWidth', {
      get: makeNativeGetter(function() { return outerWidth; }, 'outerWidth'),
      configurable: true
    });

    Object.defineProperty(window, 'outerHeight', {
      get: makeNativeGetter(function() { return outerHeight; }, 'outerHeight'),
      configurable: true
    });
  } catch (e) {
    window.__js_unshroud_debug('[JS Unshroud] Could not override window dimensions:', e.message);
  }


  // === TIMEZONE FINGERPRINTING MITIGATION ===

  // 1. Override Date.prototype.getTimezoneOffset (configurable)
  try {
    const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
    const spoofedOffset = config.timezone?.offset || 300; // US Eastern Time (UTC-5, or -300 minutes)

    Date.prototype.getTimezoneOffset = makeNativeFunction(function() {
      logEvent({
        type: 'headless_mitigation',
        method: 'Date.prototype.getTimezoneOffset',
        operation: 'timezone_spoofed',
        originalValue: originalGetTimezoneOffset.call(this),
        newValue: spoofedOffset,
        timestamp: Date.now()
      });

      return spoofedOffset;
    }, 'getTimezoneOffset');
  } catch (e) {
    window.__js_unshroud_debug('[JS Unshroud] Could not override getTimezoneOffset:', e.message);
  }

  // 2. Override Intl.DateTimeFormat resolvedOptions
  try {
    const OriginalDateTimeFormat = Intl.DateTimeFormat;

    Intl.DateTimeFormat = makeNativeFunction(function() {
      const formatter = new OriginalDateTimeFormat(...arguments);
      const originalResolvedOptions = formatter.resolvedOptions;

      formatter.resolvedOptions = makeNativeFunction(function() {
        const options = originalResolvedOptions.call(this);
        const timeZoneName = config.timezone?.name || 'America/New_York';
        options.timeZone = timeZoneName;

        logEvent({
          type: 'headless_mitigation',
          method: 'Intl.DateTimeFormat.resolvedOptions',
          operation: 'timezone_spoofed',
          newValue: timeZoneName,
          timestamp: Date.now()
        });

        return options;
      }, 'resolvedOptions');

      return formatter;
    }, 'DateTimeFormat');

    Intl.DateTimeFormat.prototype = OriginalDateTimeFormat.prototype;
  } catch (e) {
    window.__js_unshroud_debug('[JS Unshroud] Could not override Intl.DateTimeFormat:', e.message);
  }


  // === BATTERY API FINGERPRINTING MITIGATION ===

  // 1. Block navigator.getBattery
  try {
    if (navigator.getBattery) {
      navigator.getBattery = makeNativeFunction(function() {
        logEvent({
          type: 'headless_mitigation',
          method: 'navigator.getBattery',
          operation: 'battery_api_blocked',
          timestamp: Date.now()
        });

        // eslint-disable-next-line no-undef
        return Promise.reject(new DOMException('Battery Status API is not supported', 'NotSupportedError'));
      }, 'getBattery');
    }

    // Remove battery property if it exists
    if ('battery' in navigator) {
      delete navigator.battery;
    }
  } catch (e) {
    window.__js_unshroud_debug('[JS Unshroud] Could not block Battery API:', e.message);
  }


  // === P3.1: BROWSER OBJECT MODEL SPOOFING ===

  // Helper to create the full chrome.runtime object
  const createChromeRuntime = function() {
    return {
      // Properties (undefined on regular pages, matching real Chrome)
      id: undefined,
      lastError: undefined,

      // Methods that exist but behave appropriately for non-extension context
      sendMessage: makeNativeFunction(function(extensionId, message, options, callback) {
        // In real Chrome on non-extension pages, this returns undefined
        if (typeof options === 'function') {
          callback = options;
        }
        if (typeof callback === 'function') {
          setTimeout(function() { callback(undefined); }, 0);
        }
        return undefined;
      }, 'sendMessage'),

      connect: makeNativeFunction(function(_extensionId, _connectInfo) {
        // Return undefined for non-extension pages
        return undefined;
      }, 'connect'),

      getURL: makeNativeFunction(function(_path) {
        return undefined;
      }, 'getURL'),

      getManifest: makeNativeFunction(function() {
        return undefined;
      }, 'getManifest'),

      getPlatformInfo: makeNativeFunction(function(callback) {
        const platformInfo = {
          os: 'win',
          arch: 'x86-64',
          nacl_arch: 'x86-64'
        };
        if (typeof callback === 'function') {
          setTimeout(function() { callback(platformInfo); }, 0);
        }
        // Return a promise for modern usage
        return Promise.resolve(platformInfo);
      }, 'getPlatformInfo'),

      getBackgroundPage: makeNativeFunction(function(callback) {
        if (typeof callback === 'function') {
          setTimeout(function() { callback(undefined); }, 0);
        }
        return undefined;
      }, 'getBackgroundPage'),

      openOptionsPage: makeNativeFunction(function(callback) {
        if (typeof callback === 'function') {
          setTimeout(function() { callback(); }, 0);
        }
        return undefined;
      }, 'openOptionsPage'),

      setUninstallURL: makeNativeFunction(function(_url, callback) {
        if (typeof callback === 'function') {
          setTimeout(function() { callback(); }, 0);
        }
        return undefined;
      }, 'setUninstallURL'),

      reload: makeNativeFunction(function() {
        // No-op for non-extension context
      }, 'reload'),

      requestUpdateCheck: makeNativeFunction(function(callback) {
        if (typeof callback === 'function') {
          setTimeout(function() { callback('no_update', {}); }, 0);
        }
        return Promise.resolve({ status: 'no_update' });
      }, 'requestUpdateCheck'),

      // Event objects (stubs that exist but do nothing in non-extension context)
      onConnect: createChromeEvent('onConnect'),
      onConnectExternal: createChromeEvent('onConnectExternal'),
      onMessage: createChromeEvent('onMessage'),
      onMessageExternal: createChromeEvent('onMessageExternal'),
      onInstalled: createChromeEvent('onInstalled'),
      onStartup: createChromeEvent('onStartup'),
      onSuspend: createChromeEvent('onSuspend'),
      onSuspendCanceled: createChromeEvent('onSuspendCanceled'),
      onUpdateAvailable: createChromeEvent('onUpdateAvailable'),
      onBrowserUpdateAvailable: createChromeEvent('onBrowserUpdateAvailable'),
      onRestartRequired: createChromeEvent('onRestartRequired')
    };
  };

  // Helper to create chrome.app object
  const createChromeApp = function() {
    return {
      isInstalled: false,
      InstallState: {
        DISABLED: 'disabled',
        INSTALLED: 'installed',
        NOT_INSTALLED: 'not_installed'
      },
      RunningState: {
        CANNOT_RUN: 'cannot_run',
        READY_TO_RUN: 'ready_to_run',
        RUNNING: 'running'
      },
      getDetails: makeNativeFunction(function() {
        return null;
      }, 'getDetails'),
      getIsInstalled: makeNativeFunction(function() {
        return false;
      }, 'getIsInstalled'),
      installState: makeNativeFunction(function(callback) {
        if (typeof callback === 'function') {
          setTimeout(function() { callback('not_installed'); }, 0);
        }
        return undefined;
      }, 'installState'),
      runningState: makeNativeFunction(function() {
        return 'cannot_run';
      }, 'runningState')
    };
  };

  // 1. window.chrome object - Common headless detection check
  try {
    // Check if chrome.runtime is missing or incomplete (empty object)
    const needsRuntimeFix = !window.chrome ||
                           !window.chrome.runtime ||
                           Object.keys(window.chrome.runtime).length === 0 ||
                           typeof window.chrome.runtime.sendMessage !== 'function';

    if (!window.chrome) {
      // Create entire chrome object
      window.chrome = {
        runtime: createChromeRuntime(),
        loadTimes: makeNativeFunction(function() {
          return {
            requestTime: Date.now() / 1000,
            startLoadTime: Date.now() / 1000,
            commitLoadTime: Date.now() / 1000,
            finishDocumentLoadTime: Date.now() / 1000,
            finishLoadTime: Date.now() / 1000,
            firstPaintTime: Date.now() / 1000,
            firstPaintAfterLoadTime: 0,
            navigationType: 'Other',
            wasFetchedViaSpdy: false,
            wasNpnNegotiated: true,
            npnNegotiatedProtocol: 'h2',
            wasAlternateProtocolAvailable: false,
            connectionInfo: 'h2'
          };
        }, 'loadTimes'),
        csi: makeNativeFunction(function() {
          return {
            startE: Date.now(),
            onloadT: Date.now(),
            pageT: Math.random() * 1000 + 500,
            tran: 15
          };
        }, 'csi'),
        app: createChromeApp()
      };

      logEvent({
        type: 'headless_mitigation',
        method: 'window.chrome',
        operation: 'object_injection',
        message: 'Injected fake window.chrome object',
        timestamp: Date.now()
      });
    } else if (needsRuntimeFix) {
      // window.chrome exists but runtime is missing or incomplete - fix it
      window.chrome.runtime = createChromeRuntime();

      // Also fix app if missing
      if (!window.chrome.app || Object.keys(window.chrome.app).length === 0) {
        window.chrome.app = createChromeApp();
      }

      // Add loadTimes if missing
      if (typeof window.chrome.loadTimes !== 'function') {
        window.chrome.loadTimes = makeNativeFunction(function() {
          return {
            requestTime: Date.now() / 1000,
            startLoadTime: Date.now() / 1000,
            commitLoadTime: Date.now() / 1000,
            finishDocumentLoadTime: Date.now() / 1000,
            finishLoadTime: Date.now() / 1000,
            firstPaintTime: Date.now() / 1000,
            firstPaintAfterLoadTime: 0,
            navigationType: 'Other',
            wasFetchedViaSpdy: false,
            wasNpnNegotiated: true,
            npnNegotiatedProtocol: 'h2',
            wasAlternateProtocolAvailable: false,
            connectionInfo: 'h2'
          };
        }, 'loadTimes');
      }

      // Add csi if missing
      if (typeof window.chrome.csi !== 'function') {
        window.chrome.csi = makeNativeFunction(function() {
          return {
            startE: Date.now(),
            onloadT: Date.now(),
            pageT: Math.random() * 1000 + 500,
            tran: 15
          };
        }, 'csi');
      }

      logEvent({
        type: 'headless_mitigation',
        method: 'window.chrome.runtime',
        operation: 'runtime_fix',
        message: 'Fixed incomplete window.chrome.runtime object',
        timestamp: Date.now()
      });
    }
  } catch (e) {
    window.__js_unshroud_debug('[JS Unshroud] Could not inject window.chrome:', e.message);
  }

  // 2. navigator.languages - Headless often has empty or single entry (configurable)
  try {
    const languagesValue = config.languages || ['en-US', 'en'];
    Object.defineProperty(navigator, 'languages', {
      get: makeNativeGetter(function() {
        logEvent({
          type: 'headless_mitigation',
          method: 'navigator.languages',
          operation: 'value_override',
          newValue: languagesValue,
          timestamp: Date.now()
        });
        return languagesValue;
      }, 'languages'),
      configurable: true
    });
  } catch (e) {
    window.__js_unshroud_debug('[JS Unshroud] Could not override navigator.languages:', e.message);
  }

  // 3. navigator.mimeTypes - Should match fake plugins
  try {
    const fakeMimeTypes = [
      {
        type: 'application/pdf',
        description: 'Portable Document Format',
        suffixes: 'pdf',
        enabledPlugin: { name: 'Chrome PDF Plugin' }
      },
      {
        type: 'application/x-google-chrome-pdf',
        description: 'Portable Document Format',
        suffixes: 'pdf',
        enabledPlugin: { name: 'Chrome PDF Plugin' }
      },
      {
        type: 'application/x-nacl',
        description: 'Native Client Executable',
        suffixes: '',
        enabledPlugin: { name: 'Native Client' }
      },
      {
        type: 'application/x-pnacl',
        description: 'Portable Native Client Executable',
        suffixes: '',
        enabledPlugin: { name: 'Native Client' }
      }
    ];

    // Add length property and indexing
    fakeMimeTypes.length = 4;
    Object.defineProperty(navigator, 'mimeTypes', {
      get: makeNativeGetter(function() {
        logEvent({
          type: 'headless_mitigation',
          method: 'navigator.mimeTypes',
          operation: 'value_override',
          mimeTypeCount: 4,
          timestamp: Date.now()
        });
        return fakeMimeTypes;
      }, 'mimeTypes'),
      configurable: true
    });
  } catch (e) {
    window.__js_unshroud_debug('[JS Unshroud] Could not override navigator.mimeTypes:', e.message);
  }

  // 4. navigator.vendor - Should be "Google Inc." for Chrome (configurable)
  try {
    const vendorValue = config.vendor || 'Google Inc.';
    Object.defineProperty(navigator, 'vendor', {
      get: makeNativeGetter(function() {
        logEvent({
          type: 'headless_mitigation',
          method: 'navigator.vendor',
          operation: 'value_override',
          newValue: vendorValue,
          timestamp: Date.now()
        });
        return vendorValue;
      }, 'vendor'),
      configurable: true
    });
  } catch (e) {
    window.__js_unshroud_debug('[JS Unshroud] Could not override navigator.vendor:', e.message);
  }

  // 5. navigator.maxTouchPoints - Desktop should be 0 (configurable)
  try {
    const maxTouchPointsValue = config.hardware?.maxTouchPoints ?? 0;
    Object.defineProperty(navigator, 'maxTouchPoints', {
      get: makeNativeGetter(function() {
        logEvent({
          type: 'headless_mitigation',
          method: 'navigator.maxTouchPoints',
          operation: 'value_override',
          newValue: maxTouchPointsValue,
          timestamp: Date.now()
        });
        return maxTouchPointsValue;
      }, 'maxTouchPoints'),
      configurable: true
    });
  } catch (e) {
    window.__js_unshroud_debug('[JS Unshroud] Could not override navigator.maxTouchPoints:', e.message);
  }

  // 6. navigator.pdfViewerEnabled - Should be true for Chrome
  try {
    Object.defineProperty(navigator, 'pdfViewerEnabled', {
      get: makeNativeGetter(function() {
        logEvent({
          type: 'headless_mitigation',
          method: 'navigator.pdfViewerEnabled',
          operation: 'value_override',
          newValue: true,
          timestamp: Date.now()
        });
        return true;
      }, 'pdfViewerEnabled'),
      configurable: true
    });
  } catch (e) {
    window.__js_unshroud_debug('[JS Unshroud] Could not override navigator.pdfViewerEnabled:', e.message);
  }

  // 7. navigator.cookieEnabled - Should be true
  try {
    Object.defineProperty(navigator, 'cookieEnabled', {
      get: makeNativeGetter(function() {
        logEvent({
          type: 'headless_mitigation',
          method: 'navigator.cookieEnabled',
          operation: 'value_override',
          newValue: true,
          timestamp: Date.now()
        });
        return true;
      }, 'cookieEnabled'),
      configurable: true
    });
  } catch (e) {
    window.__js_unshroud_debug('[JS Unshroud] Could not override navigator.cookieEnabled:', e.message);
  }

  // 8. navigator.userAgent - Override with realistic Chrome user agent (configurable)
  try {
    const spoofedUserAgent = config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    Object.defineProperty(navigator, 'userAgent', {
      get: makeNativeGetter(function() {
        logEvent({
          type: 'headless_mitigation',
          method: 'navigator.userAgent',
          operation: 'value_override',
          newValue: spoofedUserAgent,
          timestamp: Date.now()
        });
        return spoofedUserAgent;
      }, 'userAgent'),
      configurable: true
    });
  } catch (e) {
    window.__js_unshroud_debug('[JS Unshroud] Could not override navigator.userAgent:', e.message);
  }

  // 9. navigator.language - Should match first entry in languages (configurable)
  try {
    const languageValue = config.language || 'en-US';
    Object.defineProperty(navigator, 'language', {
      get: makeNativeGetter(function() {
        logEvent({
          type: 'headless_mitigation',
          method: 'navigator.language',
          operation: 'value_override',
          newValue: languageValue,
          timestamp: Date.now()
        });
        return languageValue;
      }, 'language'),
      configurable: true
    });
  } catch (e) {
    window.__js_unshroud_debug('[JS Unshroud] Could not override navigator.language:', e.message);
  }

  // 10. navigator.platform - Should be realistic for OS (configurable)
  try {
    const platformValue = config.platform || 'Win32';
    Object.defineProperty(navigator, 'platform', {
      get: makeNativeGetter(function() {
        logEvent({
          type: 'headless_mitigation',
          method: 'navigator.platform',
          operation: 'value_override',
          newValue: platformValue,
          timestamp: Date.now()
        });
        return platformValue;
      }, 'platform'),
      configurable: true
    });
  } catch (e) {
    window.__js_unshroud_debug('[JS Unshroud] Could not override navigator.platform:', e.message);
  }

  // 11. Notification.permission - Should be 'default' or 'granted'
  try {
    if (typeof Notification !== 'undefined') {
      // eslint-disable-next-line no-undef
      Object.defineProperty(Notification, 'permission', {
        get: makeNativeGetter(function() {
          logEvent({
            type: 'headless_mitigation',
            method: 'Notification.permission',
            operation: 'value_override',
            newValue: 'default',
            timestamp: Date.now()
          });
          return 'default';
        }, 'permission'),
        configurable: true
      });
    }
  } catch (e) {
    window.__js_unshroud_debug('[JS Unshroud] Could not override Notification.permission:', e.message);
  }


  window.__js_unshroud_debug('[JS Unshroud] Headless mitigation hooks loaded');
})();
