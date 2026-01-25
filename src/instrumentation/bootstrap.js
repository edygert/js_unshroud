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

  // Generate a simple event ID
  const generateEventId = function() {
    return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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
        // Log to instrumentation system
        window.__js_unshroud_log(JSON.stringify({
          id: generateEventId(),
          sessionId: getSessionId(),
          timestamp: Date.now(),
          type: 'console',
          level: method,
          message: Array.prototype.join.call(args, ' '),
          args: args,
          url: window.location.href
        }));

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
  if (document.readyState === 'loading') {
    // Use MutationObserver for immediate execution when body is available
    // This eliminates the 100ms detection window while ensuring DOM safety
    const observer = new MutationObserver(function(_mutations) {
      if (document.body) {
        observer.disconnect();
        interceptConsole();
      }
    });
    observer.observe(document, { childList: true, subtree: true });

    // Fallback: intercept on DOMContentLoaded if MutationObserver doesn't fire (shouldn't happen)
    document.addEventListener('DOMContentLoaded', function() {
      observer.disconnect(); // Clean up observer
      if (!window.__js_unshroud_console_intercepted) {
        interceptConsole();
      }
    });
  } else {
    // Page already loaded, intercept immediately
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
