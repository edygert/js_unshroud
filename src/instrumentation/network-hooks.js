// Network Instrumentation - HTTP, WebSocket, and related APIs
(function() {
  'use strict';

  if (!window.__js_unshroud_originals) return;

  const logEvent = function(event) {
    if (window.__js_unshroud_log) {
      window.__js_unshroud_log(JSON.stringify(event));
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

  // Instrument fetch API
  if (window.__js_unshroud_originals.fetch) {
    const originalFetch = window.__js_unshroud_originals.fetch;

    window.fetch = async function(...args) {
      const [resource, init] = args;
      const startTime = Date.now();
      const stackTrace = getStackTrace();

      logEvent({
        type: 'network',
        method: init?.method || 'GET',
        url: resource.toString(),
        requestHeaders: init?.headers,
        requestPayload: init?.body,
        stackTrace: stackTrace,
        timestamp: startTime
      });

      try {
        const response = await originalFetch.apply(this, args);
        const responseTime = Date.now();

        logEvent({
          type: 'network',
          method: init?.method || 'GET',
          url: resource.toString(),
          status: response.status,
          statusText: response.statusText,
          responseHeaders: Object.fromEntries(response.headers.entries()),
          duration: responseTime - startTime,
          timestamp: responseTime
        });

        return response;
      } catch (error) {
        const errorTime = Date.now();

        logEvent({
          type: 'network',
          method: init?.method || 'GET',
          url: resource.toString(),
          error: error.message,
          duration: errorTime - startTime,
          timestamp: errorTime
        });

        throw error;
      }
    };
  }

  // Instrument XMLHttpRequest
  if (window.__js_unshroud_originals.XMLHttpRequest) {
    const OriginalXHR = window.__js_unshroud_originals.XMLHttpRequest;

    window.XMLHttpRequest = function() {
      const xhr = new OriginalXHR();
      const stackTrace = getStackTrace();
      let startTime = Date.now();

      // Override open method
      const originalOpen = xhr.open;
      xhr.open = function(method, url /* , async, user, password */) {
        startTime = Date.now();
        logEvent({
          type: 'network',
          method: method,
          url: url,
          stackTrace: stackTrace,
          timestamp: startTime,
          xhr: true
        });

        return originalOpen.apply(this, arguments);
      };

      // Override send method
      const originalSend = xhr.send;
      xhr.send = function(/* body */) {
        if (this.onreadystatechange) {
          const originalHandler = this.onreadystatechange;
          this.onreadystatechange = function() {
            if (this.readyState === 4) { // DONE
              const endTime = Date.now();

              logEvent({
                type: 'network',
                method: this.__js_unshroud_method,
                url: this.__js_unshroud_url,
                status: this.status,
                statusText: this.statusText,
                responseHeaders: this.getAllResponseHeaders(),
                responsePayload: this.responseText,
                duration: endTime - startTime,
                timestamp: endTime,
                xhr: true
              });
            }
            return originalHandler.apply(this, arguments);
          };
        }

        return originalSend.apply(this, arguments);
      };

      // Store method and URL for later retrieval
      Object.defineProperty(xhr, '__js_unshroud_method', {
        value: arguments[0], // method
        writable: false
      });
      Object.defineProperty(xhr, '__js_unshroud_url', {
        value: arguments[1], // url
        writable: false
      });

      return xhr;
    };

    // Copy prototype
    window.XMLHttpRequest.prototype = OriginalXHR.prototype;

    // Override constructor
    Object.setPrototypeOf(window.XMLHttpRequest, OriginalXHR);
  }

  // Instrument WebSocket
  if (window.__js_unshroud_originals.WebSocket) {
    const OriginalWebSocket = window.__js_unshroud_originals.WebSocket;

    window.WebSocket = function(url, protocols) {
      const stackTrace = getStackTrace();
      const ws = new OriginalWebSocket(url, protocols);

      logEvent({
        type: 'websocket',
        event: 'open',
        url: url,
        protocols: protocols,
        stackTrace: stackTrace,
        timestamp: Date.now()
      });

      // Hook events
      if (ws.addEventListener) {
        const originalAddListener = ws.addEventListener;

        originalAddListener.call(ws, 'message', function(event) {
          logEvent({
            type: 'websocket',
            event: 'message',
            url: url,
            data: event.data,
            timestamp: Date.now()
          });
        });

        originalAddListener.call(ws, 'close', function(event) {
          logEvent({
            type: 'websocket',
            event: 'close',
            url: url,
            code: event.code,
            reason: event.reason,
            timestamp: Date.now()
          });
        });

        originalAddListener.call(ws, 'error', function(event) {
          logEvent({
            type: 'websocket',
            event: 'error',
            url: url,
            error: event.toString(),
            timestamp: Date.now()
          });
        });
      }

      // Store reference to original WebSocket
      ws.__js_unshroud_url = url;
      return ws;
    };

    // Copy prototype and static properties
    window.WebSocket.prototype = OriginalWebSocket.prototype;
    Object.setPrototypeOf(window.WebSocket, OriginalWebSocket);

    // Copy static properties
    Object.getOwnPropertyNames(OriginalWebSocket).forEach(prop => {
      if (!Object.prototype.hasOwnProperty.call(window.WebSocket, prop)) {
        window.WebSocket[prop] = OriginalWebSocket[prop];
      }
    });
  }

  console.log('[JS Unshroud] Network hooks loaded');
})();
