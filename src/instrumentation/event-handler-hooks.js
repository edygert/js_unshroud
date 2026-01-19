// Event Handler Instrumentation - Track event handler property assignments
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
      const enrichedEvent = {
        id: generateEventId(),
        sessionId: getSessionId(),
        timestamp: event.timestamp || Date.now(),
        ...event
      };
      window.__js_unshroud_log(JSON.stringify(enrichedEvent));
    }
  };

  // Get element selector for logging (safely)
  const getElementSelector = function(element) {
    try {
      if (!element || !element.nodeType) return '<unknown>';

      let selector = element.tagName ? element.tagName.toLowerCase() : '';

      if (element.id) {
        selector += '#' + element.id;
      } else if (element.className && typeof element.className === 'string') {
        const classes = element.className.split(' ').filter(c => c).slice(0, 3);
        if (classes.length > 0) {
          selector += '.' + classes.join('.');
        }
      }

      return selector || '<element>';
    } catch {
      return '<error>';
    }
  };

  // List of common event handler properties to instrument
  const eventHandlerProperties = [
    'onclick', 'ondblclick', 'onmousedown', 'onmouseup', 'onmouseover', 'onmouseout', 'onmousemove',
    'onkeydown', 'onkeyup', 'onkeypress',
    'onfocus', 'onblur', 'onchange', 'onsubmit', 'onreset',
    'onload', 'onunload', 'onbeforeunload',
    'onerror', 'onabort',
    'onresize', 'onscroll',
    'ondrag', 'ondrop', 'ondragstart', 'ondragend', 'ondragover', 'ondragenter', 'ondragleave',
    'oncontextmenu',
    'oninput', 'oninvalid',
    'onsearch',
    'ontouchstart', 'ontouchend', 'ontouchmove', 'ontouchcancel',
    'onpointerdown', 'onpointerup', 'onpointermove', 'onpointerover', 'onpointerout', 'onpointerenter', 'onpointerleave', 'onpointercancel',
    'onwheel',
    'oncopy', 'oncut', 'onpaste',
    'onanimationstart', 'onanimationend', 'onanimationiteration',
    'ontransitionend'
  ];

  // Instrument event handler properties on HTMLElement
  if (window.HTMLElement && window.HTMLElement.prototype) {
    eventHandlerProperties.forEach(function(handlerName) {
      const originalDescriptor = Object.getOwnPropertyDescriptor(window.HTMLElement.prototype, handlerName);

      // Only instrument if the property exists and has a setter
      if (originalDescriptor && originalDescriptor.set) {
        const originalSetter = originalDescriptor.set;
        const originalGetter = originalDescriptor.get;

        Object.defineProperty(window.HTMLElement.prototype, handlerName, {
          get: function() {
            return originalGetter ? originalGetter.call(this) : undefined;
          },
          set: function(handler) {
            const targetSelector = getElementSelector(this);
            const handlerCode = handler ? (typeof handler === 'function' ? handler.toString().substring(0, 200) : String(handler)) : null;

            if (handler !== null && handler !== undefined) {
              logEvent({
                type: 'event_handler',
                eventType: 'property_set',
                handlerName: handlerName,
                handlerCode: handlerCode,
                element: targetSelector,
                method: 'property_assignment',
                timestamp: Date.now()
              });
            }

            originalSetter.call(this, handler);
          },
          configurable: true,
          enumerable: true
        });
      }
    });
  }

  // Also instrument Document event handlers
  if (window.Document && window.Document.prototype) {
    const documentHandlers = ['onclick', 'onload', 'onunload', 'onbeforeunload', 'onerror', 'onresize', 'onscroll'];

    documentHandlers.forEach(function(handlerName) {
      const originalDescriptor = Object.getOwnPropertyDescriptor(window.Document.prototype, handlerName);

      if (originalDescriptor && originalDescriptor.set) {
        const originalSetter = originalDescriptor.set;
        const originalGetter = originalDescriptor.get;

        Object.defineProperty(window.Document.prototype, handlerName, {
          get: function() {
            return originalGetter ? originalGetter.call(this) : undefined;
          },
          set: function(handler) {
            const handlerCode = handler ? (typeof handler === 'function' ? handler.toString().substring(0, 200) : String(handler)) : null;

            if (handler !== null && handler !== undefined) {
              logEvent({
                type: 'event_handler',
                eventType: 'property_set',
                handlerName: handlerName,
                handlerCode: handlerCode,
                element: 'document',
                method: 'property_assignment',
                timestamp: Date.now()
              });
            }

            originalSetter.call(this, handler);
          },
          configurable: true,
          enumerable: true
        });
      }
    });
  }

  // Instrument Window event handlers
  if (window.Window && window.Window.prototype) {
    const windowHandlers = ['onload', 'onunload', 'onbeforeunload', 'onerror', 'onresize', 'onscroll', 'onhashchange', 'onpopstate', 'onmessage'];

    windowHandlers.forEach(function(handlerName) {
      const originalDescriptor = Object.getOwnPropertyDescriptor(window.Window.prototype, handlerName);

      if (originalDescriptor && originalDescriptor.set) {
        const originalSetter = originalDescriptor.set;
        const originalGetter = originalDescriptor.get;

        Object.defineProperty(window.Window.prototype, handlerName, {
          get: function() {
            return originalGetter ? originalGetter.call(this) : undefined;
          },
          set: function(handler) {
            const handlerCode = handler ? (typeof handler === 'function' ? handler.toString().substring(0, 200) : String(handler)) : null;

            if (handler !== null && handler !== undefined) {
              logEvent({
                type: 'event_handler',
                eventType: 'property_set',
                handlerName: handlerName,
                handlerCode: handlerCode,
                element: 'window',
                method: 'property_assignment',
                timestamp: Date.now()
              });
            }

            originalSetter.call(this, handler);
          },
          configurable: true,
          enumerable: true
        });
      }
    });
  }

  window.__js_unshroud_debug('[JS Unshroud] Event handler hooks loaded');
})();
