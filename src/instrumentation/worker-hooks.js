// Web Worker Instrumentation - Track Worker and SharedWorker creation and communication
(function() {
  'use strict';

  // Determine if worker monitoring (logging) is enabled
  const workerLoggingEnabled = window.__js_unshroud_config && window.__js_unshroud_config.enableWorkers;

  // Determine if headless mitigation is enabled (for CDP detection prevention in workers)
  const headlessMitigationEnabled = window.__js_unshroud_config && window.__js_unshroud_config.enableHeadlessMitigation;

  // If neither feature is enabled, exit early
  if (!workerLoggingEnabled && !headlessMitigationEnabled) {
    return;
  }

  // Generate a simple event ID
  const generateEventId = function() {
    return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  // Get session ID from window
  const getSessionId = function() {
    return window.__js_unshroud_session_id || 'unknown_session';
  };

  // Get stack trace
  const getStackTrace = function() {
    try {
      const stack = new Error().stack;
      if (stack) {
        const lines = stack.split('\n').slice(3); // Skip first 3 lines (Error, getStackTrace, caller)
        return lines.join('\n');
      }
    } catch {
      // Ignore errors
    }
    return undefined;
  };

  // Helper function to get full blob content (not truncated)
  const getFullBlobContent = function(url) {
    if (url && url.startsWith('blob:') && window.__js_unshroud_blob_map) {
      const blobInfo = window.__js_unshroud_blob_map[url];
      if (blobInfo && blobInfo.content) {
        return String(blobInfo.content);
      }
    }
    return undefined;
  };

  // Log worker event
  const logWorkerEvent = function(eventType, workerType, scriptURL, message, direction, error, blobContent) {
    if (typeof window.__js_unshroud_log === 'function') {
      const event = {
        id: generateEventId(),
        sessionId: getSessionId(),
        timestamp: Date.now(),
        type: 'worker',
        eventType: eventType,
        workerType: workerType,
        scriptURL: scriptURL,
        blobContent: blobContent,
        message: message,
        direction: direction,
        error: error,
        stackTrace: getStackTrace()
      };

      window.__js_unshroud_log(JSON.stringify(event));

      // Save artifact if artifact collection is enabled and this is worker creation with blob content
      if (eventType === 'worker_create' && scriptURL && window.__js_unshroud_config && window.__js_unshroud_config.enableArtifactCollection) {
        if (typeof window.__js_unshroud_save_artifact === 'function') {
          const fullBlobContent = getFullBlobContent(scriptURL);
          if (fullBlobContent) {
            window.__js_unshroud_save_artifact({
              event: event,
              type: 'worker',
              content: fullBlobContent,  // Full worker script, not truncated
              extension: 'js',
              mimeType: 'application/javascript'
            });
          }
        }
      }
    }
  };

  // Helper function to resolve blob URLs to content
  const resolveBlobContent = function(url) {
    if (url && url.startsWith('blob:') && window.__js_unshroud_blob_map) {
      const blobInfo = window.__js_unshroud_blob_map[url];
      if (blobInfo && blobInfo.content) {
        return String(blobInfo.content).substring(0, 2048); // Truncate to 2KB
      }
    }
    return undefined;
  };

  // Helper function to serialize message data safely
  const serializeMessage = function(data) {
    try {
      // Try JSON stringify first
      const serialized = JSON.stringify(data);
      // Truncate if too large
      if (serialized.length > 1024) {
        return serialized.substring(0, 1024) + '... (truncated)';
      }
      return serialized;
    } catch {
      // If serialization fails, return type info
      return '<' + typeof data + ' (unserializable)>';
    }
  };

  // Store original constructors
  const OriginalWorker = window.Worker;
  const OriginalSharedWorker = window.SharedWorker;

  // ============================================================================
  // CDP DETECTION MITIGATION FOR WORKERS
  // ============================================================================

  // Get headless mitigation config for worker spoofing
  // These values must match what's spoofed in main context (headless-mitigation.js)
  const headlessConfig = window.__js_unshroud_headless_config || {};
  const spoofedValues = {
    hardwareConcurrency: headlessConfig.hardware?.cores || 8,
    deviceMemory: headlessConfig.hardware?.deviceMemory || 8,
    userAgent: headlessConfig.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
    platform: headlessConfig.platform || 'Win32',
    language: headlessConfig.language || 'en-US',
    languages: headlessConfig.languages || ['en-US', 'en'],
    // WebGL values must match main context to pass isSameAsMainJsContext check
    webglVendor: headlessConfig.webgl?.vendor || 'Google Inc. (Intel)',
    webglRenderer: headlessConfig.webgl?.renderer || 'ANGLE (Intel, Mesa Intel(R) UHD Graphics (CML GT2), Version 27.2.1 (Linux x64))'
  };

  // Generate worker CDP mitigation script
  // This prevents detection via Error.prepareStackTrace in worker contexts
  // Also spoofs navigator properties to match main context (prevents value comparison detection)
  const getWorkerMitigationScript = function() {
    return `
      // Worker-side CDP detection prevention and navigator spoofing (js_unshroud)
      (function() {
        // Prevent Error.prepareStackTrace detection in workers
        // Detection scripts set Error.prepareStackTrace to a function that sets wasAccessed=true
        // Then call console.log(new Error()) which triggers CDP serialization
        // By freezing prepareStackTrace, we prevent the detection script from installing its trap
        const OriginalError = self.Error;
        const originalPrepareStackTrace = OriginalError.prepareStackTrace;

        // Freeze prepareStackTrace so it cannot be overridden by detection scripts
        Object.defineProperty(OriginalError, 'prepareStackTrace', {
          get: function() { return originalPrepareStackTrace; },
          set: function(value) {
            // Silently ignore attempts to set prepareStackTrace
            // This prevents the detection script from installing its trap
            return value;
          },
          enumerable: false,
          configurable: false
        });

        // Spoof navigator properties to match main context
        // This prevents detection via worker/main value comparison
        var nav = self.navigator;
        var spoofedProps = {
          hardwareConcurrency: { value: ${spoofedValues.hardwareConcurrency} },
          deviceMemory: { value: ${spoofedValues.deviceMemory} },
          userAgent: { value: ${JSON.stringify(spoofedValues.userAgent)} },
          platform: { value: ${JSON.stringify(spoofedValues.platform)} },
          language: { value: ${JSON.stringify(spoofedValues.language)} },
          languages: { value: Object.freeze(${JSON.stringify(spoofedValues.languages)}) }
        };

        for (var prop in spoofedProps) {
          try {
            Object.defineProperty(nav, prop, {
              get: function(val) { return function() { return val; }; }(spoofedProps[prop].value),
              enumerable: true,
              configurable: false
            });
          } catch (e) {
            // Ignore if property cannot be overridden
          }
        }

        // Spoof WebGL getParameter to match main context
        // Workers use OffscreenCanvas for WebGL, detection compares vendor/renderer
        var webglVendor = ${JSON.stringify(spoofedValues.webglVendor)};
        var webglRenderer = ${JSON.stringify(spoofedValues.webglRenderer)};
        var UNMASKED_VENDOR_WEBGL = 37445;
        var UNMASKED_RENDERER_WEBGL = 37446;

        // Override WebGLRenderingContext.prototype.getParameter
        if (typeof WebGLRenderingContext !== 'undefined') {
          var originalGetParameter = WebGLRenderingContext.prototype.getParameter;
          WebGLRenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === UNMASKED_VENDOR_WEBGL) {
              return webglVendor;
            } else if (parameter === UNMASKED_RENDERER_WEBGL) {
              return webglRenderer;
            }
            return originalGetParameter.call(this, parameter);
          };
        }

        // Also override WebGL2RenderingContext if available
        if (typeof WebGL2RenderingContext !== 'undefined') {
          var originalGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
          WebGL2RenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === UNMASKED_VENDOR_WEBGL) {
              return webglVendor;
            } else if (parameter === UNMASKED_RENDERER_WEBGL) {
              return webglRenderer;
            }
            return originalGetParameter2.call(this, parameter);
          };
        }
      })();
    `;
  };

  // Inject mitigation script into blob URL workers
  const injectMitigationIntoBlob = function(scriptURL) {
    if (typeof scriptURL === 'string' && scriptURL.startsWith('blob:')) {
      try {
        // Get original blob content using full content (not truncated)
        const blobContent = getFullBlobContent(scriptURL);
        if (blobContent) {
          // Create new blob with mitigation prepended
          const mitigationScript = getWorkerMitigationScript();
          // eslint-disable-next-line no-undef
          const newBlob = new Blob(
            [mitigationScript + '\n' + blobContent],
            { type: 'application/javascript' }
          );
          // eslint-disable-next-line no-undef
          return URL.createObjectURL(newBlob);
        }
      } catch {
        // Fall back to original if injection fails
      }
    }
    return scriptURL;
  };

  // ============================================================================
  // HOOK Worker CONSTRUCTOR
  // ============================================================================

  if (OriginalWorker) {
    window.Worker = function(scriptURL, options) {
      // Inject CDP mitigation into blob workers (if headless mitigation enabled)
      const modifiedScriptURL = headlessMitigationEnabled
        ? injectMitigationIntoBlob(scriptURL)
        : scriptURL;

      const worker = new OriginalWorker(modifiedScriptURL, options);

      // If worker logging is disabled, just return the worker without wrapping
      if (!workerLoggingEnabled) {
        return worker;
      }

      // --- Worker logging is enabled below this point ---
      const blobContent = resolveBlobContent(scriptURL);

      // Log worker creation
      logWorkerEvent(
        'worker_create',
        'Worker',
        String(scriptURL),
        undefined,
        undefined,
        undefined,
        blobContent
      );

      // Wrap postMessage
      const originalPostMessage = worker.postMessage;
      worker.postMessage = function(message, transfer) {
        try {
          // Log message TO worker
          logWorkerEvent(
            'worker_postmessage',
            'Worker',
            String(scriptURL),
            serializeMessage(message),
            'to_worker',
            undefined,
            undefined
          );
        } catch {
          // Don't break postMessage if logging fails
        }

        return originalPostMessage.call(this, message, transfer);
      };

      // Wrap onmessage setter - must call native setter to connect to browser's event system
      const originalOnmessageDescriptor = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(worker),
        'onmessage'
      ) || Object.getOwnPropertyDescriptor(worker, 'onmessage');

      const nativeOnmessageSetter = originalOnmessageDescriptor?.set;
      const nativeOnmessageGetter = originalOnmessageDescriptor?.get;

      Object.defineProperty(worker, 'onmessage', {
        get: function() {
          if (nativeOnmessageGetter) {
            return nativeOnmessageGetter.call(this);
          }
          return null;
        },
        set: function(handler) {
          if (handler && typeof handler === 'function') {
            const wrappedHandler = function(event) {
              try {
                // Log message FROM worker
                logWorkerEvent(
                  'worker_message',
                  'Worker',
                  String(scriptURL),
                  serializeMessage(event.data),
                  'from_worker',
                  undefined,
                  undefined
                );
              } catch {
                // Don't break message handling if logging fails
              }

              return handler.call(this, event);
            };

            // Set wrapped handler using native setter (connects to browser's event system)
            if (nativeOnmessageSetter) {
              nativeOnmessageSetter.call(this, wrappedHandler);
            }
          } else {
            // Setting to null/undefined
            if (nativeOnmessageSetter) {
              nativeOnmessageSetter.call(this, handler);
            }
          }
        },
        enumerable: true,
        configurable: true
      });

      // Wrap addEventListener for 'message' events
      const originalAddEventListener = worker.addEventListener;
      worker.addEventListener = function(type, listener, options) {
        if (type === 'message' && typeof listener === 'function') {
          const wrappedListener = function(event) {
            try {
              // Log message FROM worker
              logWorkerEvent(
                'worker_message',
                'Worker',
                String(scriptURL),
                serializeMessage(event.data),
                'from_worker',
                undefined,
                undefined
              );
            } catch {
              // Don't break message handling if logging fails
            }

            return listener.call(this, event);
          };

          return originalAddEventListener.call(this, type, wrappedListener, options);
        }

        return originalAddEventListener.call(this, type, listener, options);
      };

      // Wrap onerror setter - must call native setter to connect to browser's event system
      const originalOnerrorDescriptor = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(worker),
        'onerror'
      ) || Object.getOwnPropertyDescriptor(worker, 'onerror');

      const nativeOnerrorSetter = originalOnerrorDescriptor?.set;
      const nativeOnerrorGetter = originalOnerrorDescriptor?.get;

      Object.defineProperty(worker, 'onerror', {
        get: function() {
          if (nativeOnerrorGetter) {
            return nativeOnerrorGetter.call(this);
          }
          return null;
        },
        set: function(handler) {
          if (handler && typeof handler === 'function') {
            const wrappedHandler = function(event) {
              try {
                // Log worker error
                logWorkerEvent(
                  'worker_error',
                  'Worker',
                  String(scriptURL),
                  undefined,
                  undefined,
                  event.message || String(event),
                  undefined
                );
              } catch {
                // Don't break error handling if logging fails
              }

              return handler.call(this, event);
            };

            // Set wrapped handler using native setter (connects to browser's event system)
            if (nativeOnerrorSetter) {
              nativeOnerrorSetter.call(this, wrappedHandler);
            }
          } else {
            // Setting to null/undefined
            if (nativeOnerrorSetter) {
              nativeOnerrorSetter.call(this, handler);
            }
          }
        },
        enumerable: true,
        configurable: true
      });

      return worker;
    };

    // Preserve prototype
    window.Worker.prototype = OriginalWorker.prototype;
  }

  // ============================================================================
  // HOOK SharedWorker CONSTRUCTOR
  // ============================================================================

  if (OriginalSharedWorker) {
    window.SharedWorker = function(scriptURL, options) {
      // Inject CDP mitigation into blob workers (if headless mitigation enabled)
      const modifiedScriptURL = headlessMitigationEnabled
        ? injectMitigationIntoBlob(scriptURL)
        : scriptURL;

      const sharedWorker = new OriginalSharedWorker(modifiedScriptURL, options);

      // If worker logging is disabled, just return the worker without wrapping
      if (!workerLoggingEnabled) {
        return sharedWorker;
      }

      // --- Worker logging is enabled below this point ---
      const blobContent = resolveBlobContent(scriptURL);

      // Log shared worker creation
      logWorkerEvent(
        'worker_create',
        'SharedWorker',
        String(scriptURL),
        undefined,
        undefined,
        undefined,
        blobContent
      );

      // SharedWorker uses a 'port' property for communication
      const port = sharedWorker.port;

      if (port) {
        // Wrap port.postMessage
        const originalPostMessage = port.postMessage;
        port.postMessage = function(message, transfer) {
          try {
            // Log message TO shared worker
            logWorkerEvent(
              'worker_postmessage',
              'SharedWorker',
              String(scriptURL),
              serializeMessage(message),
              'to_worker',
              undefined,
              undefined
            );
          } catch {
            // Don't break postMessage if logging fails
          }

          return originalPostMessage.call(this, message, transfer);
        };

        // Wrap port.onmessage setter
        let onmessageHandler = null;
        Object.defineProperty(port, 'onmessage', {
          get: function() {
            return onmessageHandler;
          },
          set: function(handler) {
            if (handler && typeof handler === 'function') {
              onmessageHandler = function(event) {
                try {
                  // Log message FROM shared worker
                  logWorkerEvent(
                    'worker_message',
                    'SharedWorker',
                    String(scriptURL),
                    serializeMessage(event.data),
                    'from_worker',
                    undefined,
                    undefined
                  );
                } catch {
                  // Don't break message handling if logging fails
                }

                return handler.call(this, event);
              };
            } else {
              onmessageHandler = handler;
            }
          },
          enumerable: true,
          configurable: true
        });

        // Wrap port.addEventListener for 'message' events
        const originalAddEventListener = port.addEventListener;
        port.addEventListener = function(type, listener, options) {
          if (type === 'message' && typeof listener === 'function') {
            const wrappedListener = function(event) {
              try {
                // Log message FROM shared worker
                logWorkerEvent(
                  'worker_message',
                  'SharedWorker',
                  String(scriptURL),
                  serializeMessage(event.data),
                  'from_worker',
                  undefined,
                  undefined
                );
              } catch {
                // Don't break message handling if logging fails
              }

              return listener.call(this, event);
            };

            return originalAddEventListener.call(this, type, wrappedListener, options);
          }

          return originalAddEventListener.call(this, type, listener, options);
        };
      }

      return sharedWorker;
    };

    // Preserve prototype
    window.SharedWorker.prototype = OriginalSharedWorker.prototype;
  }

  window.__js_unshroud_debug('[JS Unshroud] Worker hooks loaded');
})();
