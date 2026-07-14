// JS Unshroud Instrumentation Bootstrap
// This script is injected early in page load to instrument JavaScript execution

(function() {
  'use strict';

  // Global event logger function - should be injected by the main monitoring script
  if (typeof window.__js_unshroud_log !== 'function') {
    // Fallback logger that doesn't do anything (to avoid recursion issues)
    Object.defineProperty(window, '__js_unshroud_log', {
      value: function() {
        // Silent fallback to prevent recursion when console is intercepted
        // CDP session can capture console output if needed
      },
      writable: true,
      enumerable: false,  // Hidden from Object.keys()
      configurable: false
    });
  }

  // Store original console reference (direct reference, not copy)
  const originalConsole = console;

  // Store console methods for later interception (avoid overriding during page load)
  Object.defineProperty(window, '__js_unshroud_console_methods', {
    value: ['log', 'warn', 'error', 'info', 'debug'],
    writable: true,
    enumerable: false,  // Hidden from Object.keys()
    configurable: false
  });

  // Canonical event-ID generator (single source of truth for all hooks).
  // Emits a v4 UUID. Uses crypto.getRandomValues (available even in insecure http://
  // contexts, unlike crypto.randomUUID) with a Math.random fallback. Kept identical in
  // spirit to the TS side (crypto.randomUUID in src/schema/events.ts) so both event
  // sources share one format.
  window.__js_unshroud = window.__js_unshroud || {};
  window.__js_unshroud.newEventId = function() {
    const rnd = (window.crypto && window.crypto.getRandomValues)
      ? window.crypto.getRandomValues(new Uint8Array(16))
      : Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
    rnd[6] = (rnd[6] & 0x0f) | 0x40;
    rnd[8] = (rnd[8] & 0x3f) | 0x80;
    const hex = [];
    for (let i = 0; i < 16; i++) {
      hex.push((rnd[i] + 0x100).toString(16).slice(1));
    }
    return hex[0] + hex[1] + hex[2] + hex[3] + '-' + hex[4] + hex[5] + '-' +
      hex[6] + hex[7] + '-' + hex[8] + hex[9] + '-' +
      hex[10] + hex[11] + hex[12] + hex[13] + hex[14] + hex[15];
  };

  // Generate a simple event ID (delegates to the canonical generator above)
  const generateEventId = function() {
    return window.__js_unshroud.newEventId();
  };

  // Get session ID from window or generate a temporary one
  const getSessionId = function() {
    return window.__js_unshroud_session_id || 'unknown_session';
  };

  // Conditional debug logger - only logs when debug mode is enabled
  Object.defineProperty(window, '__js_unshroud_debug', {
    value: function(message) {
      if (window.__js_unshroud_config && window.__js_unshroud_config.debug) {
        originalConsole.log(message);
      }
    },
    writable: true,
    enumerable: false,  // Hidden from Object.keys()
    configurable: false
  });

  // Shared console interception logic
  const interceptConsole = function() {
    window.__js_unshroud_console_methods.forEach(function(method) {
      const original = console[method];
      console[method] = function(...args) {
        // Log to instrumentation system.
        // CRITICAL: this must NEVER throw into the page. console.log(circularObj),
        // console.log(window), etc. would otherwise make JSON.stringify throw and
        // abort the page's own console call. Sanitize defensively and swallow errors.
        try {
          let message;
          try {
            message = Array.prototype.join.call(args, ' ');
          } catch {
            message = '<unstringifiable console arguments>';
          }

          const safeArgs = Array.prototype.map.call(args, function(arg) {
            try {
              JSON.stringify(arg);
              return arg;
            } catch {
              return '<unserializable>';
            }
          });

          window.__js_unshroud_log(JSON.stringify({
            id: generateEventId(),
            sessionId: getSessionId(),
            timestamp: Date.now(),
            type: 'console',
            level: method,
            message: message,
            args: safeArgs,
            url: window.location.href
          }));
        } catch {
          // Never let instrumentation break the page's console output
        }

        // Call original method to preserve functionality
        return original.apply(console, args);
      };
    });
    window.__js_unshroud_debug('[JS Unshroud] Console instrumentation activated');
    // Mark as intercepted to avoid duplicate interception
    Object.defineProperty(window, '__js_unshroud_console_intercepted', {
      value: true,
      writable: true,
      enumerable: false,  // Hidden from Object.keys()
      configurable: false
    });
  };

  // Intercept console methods immediately when safe, using MutationObserver to avoid timing detection
  // Special handling for about:blank and pages that already have body
  if (document.body || document.readyState === 'complete' || document.readyState === 'interactive') {
    // Body already exists or page is loaded - intercept immediately
    interceptConsole();
  } else if (document.readyState === 'loading') {
    // Use MutationObserver for immediate execution when body is available
    // This eliminates the 100ms detection window while ensuring DOM safety
    const observer = new MutationObserver(function(_mutations) {
      if (document.body) {
        observer.disconnect();
        interceptConsole();
      }
    });
    observer.observe(document, { childList: true, subtree: true });

    // Fallback: intercept on DOMContentLoaded if MutationObserver doesn't fire
    document.addEventListener('DOMContentLoaded', function() {
      observer.disconnect(); // Clean up observer
      if (!window.__js_unshroud_console_intercepted) {
        interceptConsole();
      }
    });

    // Safety timeout fallback for edge cases (about:blank without body, broken DOM)
    // This ensures instrumentation always activates even if observer never fires
    setTimeout(function() {
      if (!window.__js_unshroud_console_intercepted) {
        observer.disconnect();
        interceptConsole();
      }
    }, 100);
  } else {
    // Unknown state, intercept immediately
    interceptConsole();
  }

  // Store references for other instrumentation modules
  Object.defineProperty(window, '__js_unshroud_originals', {
    value: {
      console: originalConsole,
      fetch: window.fetch,
      XMLHttpRequest: window.XMLHttpRequest,
      WebSocket: window.WebSocket,
      localStorage: window.localStorage,
      sessionStorage: window.sessionStorage,
      setTimeout: window.setTimeout,
      setInterval: window.setInterval,
      requestAnimationFrame: window.requestAnimationFrame,
      clearTimeout: window.clearTimeout,
      clearInterval: window.clearInterval,
      cancelAnimationFrame: window.cancelAnimationFrame,
      // Code execution originals
      eval: window.eval,
      Function: window.Function,
      AsyncFunction: (async function() {}).constructor,
      GeneratorFunction: (function*() {}).constructor,
      // Encoding/decoding originals
      atob: window.atob,
      btoa: window.btoa,
      fromCharCode: String.fromCharCode,
      fromCodePoint: String.fromCodePoint,
      decodeURI: window.decodeURI,
      decodeURIComponent: window.decodeURIComponent,
      unescape: window.unescape,
      encodeURI: window.encodeURI,
      encodeURIComponent: window.encodeURIComponent,
      escape: window.escape,
      // DOM manipulation originals
      EventTarget: window.EventTarget,
      addEventListener: window.EventTarget?.prototype?.addEventListener,
      removeEventListener: window.EventTarget?.prototype?.removeEventListener,
      appendChild: window.Node?.prototype?.appendChild,
      insertBefore: window.Node?.prototype?.insertBefore,
      removeChild: window.Node?.prototype?.removeChild,
      replaceChild: window.Node?.prototype?.replaceChild,
      innerHTML: Object.getOwnPropertyDescriptor(window.Element?.prototype, 'innerHTML'),
      serviceWorker: navigator.serviceWorker ? navigator.serviceWorker : null,
      caches: window.caches ? window.caches : null
    },
    writable: true,
    enumerable: false,  // Hidden from Object.keys()
    configurable: false
  });

  // Mark as loaded
  Object.defineProperty(window, '__js_unshroud_loaded', {
    value: true,
    writable: true,
    enumerable: false,  // Hidden from Object.keys()
    configurable: false
  });

  window.__js_unshroud_debug('[JS Unshroud] Bootstrap loaded successfully');
})();
