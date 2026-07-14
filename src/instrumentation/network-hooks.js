// Network Instrumentation - HTTP, WebSocket, and related APIs
(function() {
  'use strict';

  // Wait for bootstrap to set up originals, or use current window objects
  const originals = window.__js_unshroud_originals || {
    fetch: window.fetch,
    XMLHttpRequest: window.XMLHttpRequest,
    WebSocket: window.WebSocket
  };

  // Generate a simple event ID
  const generateEventId = function() {
    return (window.__js_unshroud && window.__js_unshroud.newEventId)
      ? window.__js_unshroud.newEventId()
      : 'evt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 11);
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


  // Instrument fetch API
  if (originals.fetch) {
    const originalFetch = originals.fetch;

    window.fetch = async function(...args) {
      const [resource, init] = args;
      const startTime = Date.now();

      logEvent({
        type: 'network',
        method: init?.method || 'GET',
        url: resource.toString(),
        requestHeaders: init?.headers,
        requestPayload: init?.body,
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
  if (originals.XMLHttpRequest) {
    const OriginalXHR = originals.XMLHttpRequest;

    const originalOpen = OriginalXHR.prototype.open;
    const originalSend = OriginalXHR.prototype.send;

    // Override open method on prototype
    OriginalXHR.prototype.open = function(method, url /* , async, user, password */) {
      this._js_unshroud_method = method;
      this._js_unshroud_url = url;
      this._js_unshroud_startTime = Date.now();

      logEvent({
        type: 'network',
        method: method,
        url: url,
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
          // Guard against double-logging: onreadystatechange and onload both
          // fire on completion, so log the response exactly once (L2).
          if (this.readyState === 4 && !xhr._js_unshroud_response_logged) { // DONE
            xhr._js_unshroud_response_logged = true;
            const endTime = Date.now();

            // responseText throws (InvalidStateError) for binary responseType
            // (arraybuffer/blob/json). Only read it for text-like responses.
            const canReadText = this.responseType === '' || this.responseType === 'text';

            logEvent({
              type: 'network',
              method: xhr._js_unshroud_method,
              url: xhr._js_unshroud_url,
              status: this.status,
              statusText: this.statusText,
              responseHeaders: this.getAllResponseHeaders(),
              responsePayload: canReadText ? this.responseText : undefined,
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
        // Guard against double-logging: onreadystatechange (above) may have
        // already logged this response on readyState 4 (L2).
        if (!xhr._js_unshroud_response_logged) {
          xhr._js_unshroud_response_logged = true;
          const endTime = Date.now();

          // responseText throws (InvalidStateError) for binary responseType
          // (arraybuffer/blob/json). Only read it for text-like responses.
          const canReadText = this.responseType === '' || this.responseType === 'text';

          logEvent({
            type: 'network',
            method: xhr._js_unshroud_method,
            url: xhr._js_unshroud_url,
            status: this.status,
            statusText: this.statusText,
            responseHeaders: this.getAllResponseHeaders(),
            responsePayload: canReadText ? this.responseText : undefined,
            duration: endTime - startTime,
            timestamp: endTime,
            xhr: true
          });
        }

        if (originalOnLoad) {
          return originalOnLoad.apply(this, arguments);
        }
      };

      return originalSend.apply(this, arguments);
    };
  }

  // Instrument WebSocket - Use safer approach without constructor wrapping
  if (originals.WebSocket) {
    const OriginalWebSocket = originals.WebSocket;

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
          } catch (e) {
            // Log ignored properties in debug mode
            if (window.__js_unshroud_debug) {
              window.__js_unshroud_debug('[JS Unshroud] Could not copy WebSocket property:', prop, e.message);
            }
          }
        }
      }
    });
  }

  window.__js_unshroud_debug('[JS Unshroud] Network hooks loaded');
})();
