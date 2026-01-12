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

  // Function to capture stack trace
  const getStackTrace = function() {
    try {
      throw new Error();
    } catch (e) {
      return e.stack || '';
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
          stackTrace: getStackTrace(),
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
          stackTrace: getStackTrace(),
          timestamp: Date.now()
        });
      }
    });
  } catch (e) {
    console.warn('[JS Unshroud] Could not override navigator.webdriver:', e.message);
  }

  // 2. Hardware concurrency - Headless browsers often have unrealistic values
  try {
    Object.defineProperty(window.navigator, 'hardwareConcurrency', {
      get: function() {
        const overrideValue = 8; // Realistic value for modern systems
        logEvent({
          type: 'headless_mitigation',
          method: 'navigator.hardwareConcurrency',
          operation: 'value_override',
          originalValue: navigator.hardwareConcurrency,
          newValue: overrideValue,
          stackTrace: getStackTrace(),
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
    Object.defineProperty(window.navigator, 'deviceMemory', {
      get: function() {
        const overrideValue = 8; // Realistic value for modern systems
        logEvent({
          type: 'headless_mitigation',
          method: 'navigator.deviceMemory',
          operation: 'value_override',
          originalValue: navigator.deviceMemory,
          newValue: overrideValue,
          stackTrace: getStackTrace(),
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
          stackTrace: getStackTrace(),
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
        const promise = originalQuery.call(this, permissionDescriptor);

        return promise.catch(function(error) {
          logEvent({
            type: 'headless_mitigation',
            method: 'navigator.permissions.query',
            operation: 'permission_override',
            name: permissionDescriptor.name,
            originalError: error.message,
            newState: 'granted',
            stackTrace: getStackTrace(),
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
          stackTrace: getStackTrace(),
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
          stackTrace: getStackTrace(),
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
          query.includes('-webkit-min-device-pixel-ratio') || query.includes('forced-colors')) {

        logEvent({
          type: 'headless_mitigation',
          method: 'window.matchMedia',
          operation: 'media_query_monitor',
          query: query,
          originalResult: result.matches,
          stackTrace: getStackTrace(),
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
            stackTrace: getStackTrace(),
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
            stackTrace: getStackTrace(),
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

  console.log('[JS Unshroud] Headless mitigation hooks loaded');
})();
