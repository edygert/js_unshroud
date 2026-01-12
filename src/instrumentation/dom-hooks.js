// DOM Instrumentation - Event listeners and basic mutation observation
(function() {
  'use strict';

  // Wait for bootstrap to set up originals, or use current window objects
  const originals = window.__js_unshroud_originals || {
    EventTarget: window.EventTarget,
    addEventListener: window.EventTarget?.prototype?.addEventListener,
    removeEventListener: window.EventTarget?.prototype?.removeEventListener,
    appendChild: window.Node?.prototype?.appendChild,
    insertBefore: window.Node?.prototype?.insertBefore,
    removeChild: window.Node?.prototype?.removeChild,
    replaceChild: window.Node?.prototype?.replaceChild,
    innerHTML: Object.getOwnPropertyDescriptor(window.Element?.prototype, 'innerHTML')
  };

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

  // Get element selector for logging (safely)
  const getElementSelector = function(element) {
    try {
      if (!element || !element.nodeType) return '<unknown>';

      // Simple selector generation
      let selector = element.tagName ? element.tagName.toLowerCase() : '';

      if (element.id) {
        selector += '#' + element.id;
      } else if (element.className && typeof element.className === 'string') {
        const classes = element.className.split(' ').filter(c => c).slice(0, 3);
        if (classes.length > 0) {
          selector += '.' + classes.join('.');
        }
      }

      if (element.getAttribute && element.getAttribute('data-testid')) {
        selector += '[data-testid="' + element.getAttribute('data-testid') + '"]';
      }

      return selector || '<element>';
    } catch {
      return '<error>';
    }
  };

  // Get listener string representation (safely)
  const getListenerString = function(listener) {
    try {
      if (typeof listener === 'function') {
        return listener.toString().substring(0, 200); // Limit size
      }
    } catch {
      // Ignore
    }
    return '<function>';
  };

  // Instrument addEventListener
  if (originals.addEventListener) {
    const originalAddEventListener = originals.addEventListener;

    window.EventTarget.prototype.addEventListener = function(type, listener, options) {
      const stackTrace = getStackTrace();
      const listenerStr = getListenerString(listener);
      const targetSelector = getElementSelector(this);

      logEvent({
        type: 'dom',
        eventType: type,
        targetSelector: targetSelector,
        operation: 'addEventListener',
        listener: listenerStr,
        options: options,
        stackTrace: stackTrace,
        timestamp: Date.now()
      });

      // Create wrapped listener that logs when event fires
      const wrappedListener = function(event) {
        logEvent({
          type: 'dom',
          eventType: type,
          targetSelector: targetSelector,
          operation: 'eventFired',
          bubble: event.bubbles,
          cancelable: event.cancelable,
          defaultPrevented: event.defaultPrevented,
          composed: event.composed,
          eventPhase: event.eventPhase === 1 ? 'capture' : event.eventPhase === 2 ? 'target' : event.eventPhase === 3 ? 'bubble' : 'unknown',
          timestamp: Date.now()
        });

        // Call original listener
        return listener.apply(this, arguments);
      };

      // Store reference for removal tracking
      if (!this.__js_unshroud_listeners) {
        this.__js_unshroud_listeners = new Map();
      }
      const key = type + '_' + listener.toString().substring(0, 50);
      this.__js_unshroud_listeners.set(key, { original: listener, wrapped: wrappedListener });

      return originalAddEventListener.call(this, type, wrappedListener, options);
    };
  }

  // Instrument removeEventListener
  if (originals.removeEventListener) {
    const originalRemoveEventListener = originals.removeEventListener;

    window.EventTarget.prototype.removeEventListener = function(type, listener, options) {
      const targetSelector = getElementSelector(this);

      logEvent({
        type: 'dom',
        eventType: type,
        targetSelector: targetSelector,
        operation: 'removeEventListener',
        timestamp: Date.now()
      });

      // Try to find and remove from our tracking
      if (this.__js_unshroud_listeners) {
        const key = type + '_' + listener.toString().substring(0, 50);
        const stored = this.__js_unshroud_listeners.get(key);
        if (stored) {
          this.__js_unshroud_listeners.delete(key);
          return originalRemoveEventListener.call(this, type, stored.wrapped, options);
        }
      }

      return originalRemoveEventListener.apply(this, arguments);
    };
  }

  // Instrument DOM mutation methods
  const mutationMethods = [
    { name: 'appendChild', method: originals.appendChild },
    { name: 'insertBefore', method: originals.insertBefore },
    { name: 'removeChild', method: originals.removeChild },
    { name: 'replaceChild', method: originals.replaceChild }
  ];

  mutationMethods.forEach(({ name, method }) => {
    if (method) {
      const originalMethod = method;

      window.Node.prototype[name] = function() {
        const stackTrace = getStackTrace();
        const targetSelector = getElementSelector(this);
        let addedSelector = '';
        let removedSelector = '';

        // Get selectors for added/removed nodes
        if (arguments[0] && arguments[0].nodeType) {
          addedSelector = getElementSelector(arguments[0]);
        }
        if (name === 'removeChild' && arguments[0]) {
          removedSelector = getElementSelector(arguments[0]);
        }
        if (name === 'replaceChild' && arguments[1]) {
          removedSelector = getElementSelector(arguments[1]);
        }

        logEvent({
          type: 'dom',
          operation: name,
          targetSelector: targetSelector,
          addedNode: addedSelector,
          removedNode: removedSelector,
          stackTrace: stackTrace,
          timestamp: Date.now()
        });

        return originalMethod.apply(this, arguments);
      };
    }
  });

  // Instrument innerHTML setter
  if (originals.innerHTML && originals.innerHTML.set) {
    const originalSetter = originals.innerHTML.set;

    Object.defineProperty(window.Element.prototype, 'innerHTML', {
      get: originals.innerHTML.get,
      set: function(value) {
        const stackTrace = getStackTrace();
        const targetSelector = getElementSelector(this);

        logEvent({
          type: 'dom',
          operation: 'innerHTML',
          targetSelector: targetSelector,
          valueLength: value ? value.length : 0,
          stackTrace: stackTrace,
          timestamp: Date.now()
        });

        originalSetter.call(this, value);
      }
    });
  }

  console.log('[JS Unshroud] DOM hooks loaded');
})();
