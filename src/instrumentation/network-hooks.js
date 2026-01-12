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

    const originalOpen = OriginalXHR.prototype.open;
    const originalSend = OriginalXHR.prototype.send;

    // Override open method on prototype
    OriginalXHR.prototype.open = function(method, url /* , async, user, password */) {
      this._js_unshroud_method = method;
      this._js_unshroud_url = url;
      this._js_unshroud_startTime = Date.now();
      this._js_unshroud_stackTrace = getStackTrace();

      logEvent({
        type: 'network',
        method: method,
        url: url,
        stackTrace: this._js_unshroud_stackTrace,
        timestamp: this._js_unshroud_startTime,
        xhr: true
      });

      return originalOpen.apply(this, arguments);
    };

    // Override send method on prototype
    OriginalXHR.prototype.send = function(/* body */) {
      const xhr = this;
      const startTime = this._js_unshroud_startTime;

      if (this.onreadystatechange) {
        const originalHandler = this.onreadystatechange;
        this.onreadystatechange = function() {
          if (this.readyState === 4) { // DONE
            const endTime = Date.now();

            logEvent({
              type: 'network',
              method: xhr._js_unshroud_method,
              url: xhr._js_unshroud_url,
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

      // Hook load event for modern code
      const originalOnLoad = this.onload;
      this.onload = function() {
        const endTime = Date.now();

        logEvent({
          type: 'network',
          method: xhr._js_unshroud_method,
          url: xhr._js_unshroud_url,
          status: this.status,
          statusText: this.statusText,
          responseHeaders: this.getAllResponseHeaders(),
          responsePayload: this.responseText,
          duration: endTime - startTime,
          timestamp: endTime,
          xhr: true
        });

        if (originalOnLoad) {
          return originalOnLoad.apply(this, arguments);
        }
      };

      return originalSend.apply(this, arguments);
    };
  }

  // Instrument WebSocket - Use safer approach without constructor wrapping
  if (window.__js_unshroud_originals.WebSocket) {
    const OriginalWebSocket = window.__js_unshroud_originals.WebSocket;

    // Override send method on prototype to detect WebSocket usage
    const originalSend = OriginalWebSocket.prototype.send;
    OriginalWebSocket.prototype.send = function(data) {
      if (!this._js_unshroud_logged) {
        logEvent({
          type: 'websocket',
          event: 'connect_attempt',
          url: this.url,
          timestamp: Date.now()
        });
        this._js_unshroud_logged = true;

        // Hook events once per instance
        const ws = this;

        const originalAddListener = this.addEventListener;
        originalAddListener.call(this, 'message', function(event) {
          logEvent({
            type: 'websocket',
            event: 'message',
            url: ws.url,
            data: event.data,
            timestamp: Date.now()
          });
        });

        originalAddListener.call(this, 'close', function(event) {
          logEvent({
            type: 'websocket',
            event: 'close',
            url: ws.url,
            code: event.code,
            reason: event.reason,
            timestamp: Date.now()
          });
        });

        originalAddListener.call(this, 'error', function(event) {
          logEvent({
            type: 'websocket',
            event: 'error',
            url: ws.url,
            error: event.toString(),
            timestamp: Date.now()
          });
        });
      }

      return originalSend.call(this, data);
    };

    // Copy static properties safely
    Object.getOwnPropertyNames(OriginalWebSocket).forEach(prop => {
      if (!Object.prototype.hasOwnProperty.call(window.WebSocket, prop)) {
        const descriptor = Object.getOwnPropertyDescriptor(OriginalWebSocket, prop);
        if (descriptor && !descriptor.get && !descriptor.set) {
        try {
          window.WebSocket[prop] = OriginalWebSocket[prop];
        } catch {
          // Ignore read-only property errors
        }
        }
      }
    });
  }

  console.log('[JS Unshroud] Network hooks loaded');
})();
