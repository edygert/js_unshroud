// JavaScript URL Execution Tracking - Track javascript: URL execution for malware analysis
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

  // Extract and decode JavaScript from javascript: URL
  const extractJavaScriptFromUrl = function(url) {
    if (!url || typeof url !== 'string') {
      return null;
    }

    // Check if it's a javascript: URL
    if (!url.toLowerCase().startsWith('javascript:')) {
      return null;
    }

    // Extract the code after "javascript:"
    let code = url.substring(11); // Length of "javascript:"

    // Decode URL encoding
    try {
      code = decodeURIComponent(code);
    } catch {
      // If decoding fails, use the raw code
    }

    return code;
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

  // Instrument location.href setter
  if (window.Location && window.Location.prototype) {
    const originalHrefDescriptor = Object.getOwnPropertyDescriptor(window.Location.prototype, 'href');

    if (originalHrefDescriptor && originalHrefDescriptor.set) {
      const originalHrefSetter = originalHrefDescriptor.set;
      const originalHrefGetter = originalHrefDescriptor.get;

      Object.defineProperty(window.Location.prototype, 'href', {
        get: function() {
          return originalHrefGetter ? originalHrefGetter.call(this) : undefined;
        },
        set: function(url) {
          const code = extractJavaScriptFromUrl(url);

          if (code !== null) {
            logEvent({
              type: 'url_execution',
              eventType: 'location_href_set',
              url: url,
              code: code,
              timestamp: Date.now()
            });
          }

          originalHrefSetter.call(this, url);
        },
        configurable: true,
        enumerable: true
      });
    }
  }

  // Instrument location.assign()
  const originalLocationAssign = window.Location.prototype.assign;
  if (originalLocationAssign) {
    window.Location.prototype.assign = function(url) {
      const code = extractJavaScriptFromUrl(url);

      if (code !== null) {
        logEvent({
          type: 'url_execution',
          eventType: 'location_assign',
          url: url,
          code: code,
          timestamp: Date.now()
        });
      }

      return originalLocationAssign.call(this, url);
    };
  }

  // Instrument location.replace()
  const originalLocationReplace = window.Location.prototype.replace;
  if (originalLocationReplace) {
    window.Location.prototype.replace = function(url) {
      const code = extractJavaScriptFromUrl(url);

      if (code !== null) {
        logEvent({
          type: 'url_execution',
          eventType: 'location_replace',
          url: url,
          code: code,
          timestamp: Date.now()
        });
      }

      return originalLocationReplace.call(this, url);
    };
  }

  // Instrument anchor.href setter
  if (window.HTMLAnchorElement && window.HTMLAnchorElement.prototype) {
    const originalAnchorHrefDescriptor = Object.getOwnPropertyDescriptor(window.HTMLAnchorElement.prototype, 'href');

    if (originalAnchorHrefDescriptor && originalAnchorHrefDescriptor.set) {
      const originalAnchorHrefSetter = originalAnchorHrefDescriptor.set;
      const originalAnchorHrefGetter = originalAnchorHrefDescriptor.get;

      Object.defineProperty(window.HTMLAnchorElement.prototype, 'href', {
        get: function() {
          return originalAnchorHrefGetter ? originalAnchorHrefGetter.call(this) : undefined;
        },
        set: function(url) {
          const code = extractJavaScriptFromUrl(url);

          if (code !== null) {
            const elementSelector = getElementSelector(this);

            logEvent({
              type: 'url_execution',
              eventType: 'anchor_href_set',
              url: url,
              code: code,
              element: elementSelector,
              timestamp: Date.now()
            });
          }

          originalAnchorHrefSetter.call(this, url);
        },
        configurable: true,
        enumerable: true
      });
    }
  }

  console.log('[JS Unshroud] URL execution hooks loaded');
})();
