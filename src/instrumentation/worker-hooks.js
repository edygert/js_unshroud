// Web Worker Instrumentation - Track Worker and SharedWorker creation and communication
(function() {
  'use strict';

  // Check if worker monitoring is enabled
  if (!window.__js_unshroud_config || !window.__js_unshroud_config.enableWorkers) {
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

  // Log worker event
  const logWorkerEvent = function(eventType, workerType, scriptURL, message, direction, error, blobContent) {
    if (typeof window.__js_unshroud_log === 'function') {
      window.__js_unshroud_log(JSON.stringify({
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
      }));
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
  // HOOK Worker CONSTRUCTOR
  // ============================================================================

  if (OriginalWorker) {
    window.Worker = function(scriptURL, options) {
      const worker = new OriginalWorker(scriptURL, options);
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

      // Wrap onmessage setter
      let onmessageHandler = null;
      Object.defineProperty(worker, 'onmessage', {
        get: function() {
          return onmessageHandler;
        },
        set: function(handler) {
          if (handler && typeof handler === 'function') {
            onmessageHandler = function(event) {
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
          } else {
            onmessageHandler = handler;
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

      // Wrap onerror setter
      let onerrorHandler = null;
      Object.defineProperty(worker, 'onerror', {
        get: function() {
          return onerrorHandler;
        },
        set: function(handler) {
          if (handler && typeof handler === 'function') {
            onerrorHandler = function(event) {
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
          } else {
            onerrorHandler = handler;
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
      const sharedWorker = new OriginalSharedWorker(scriptURL, options);
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

  console.log('[JS Unshroud] Worker hooks loaded');
})();
