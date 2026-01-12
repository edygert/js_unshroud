// JS Unshroud Instrumentation Bootstrap
// This script is injected early in page load to instrument JavaScript execution

(function() {
  'use strict';

  // Global event logger function - should be injected by the main monitoring script
  if (typeof window.__js_unshroud_log !== 'function') {
    // Fallback logger that doesn't do anything
    window.__js_unshroud_log = function() {
      // CDP session will pick this up
      console.log('[JS_UNSHROUD]', ...arguments);
    };
  }

  const originalConsole = { ...console };

  // Override console methods to capture messages
  const consoleMethods = ['log', 'warn', 'error', 'info', 'debug'];
  consoleMethods.forEach(method => {
    const original = console[method];
    console[method] = function(...args) {
      window.__js_unshroud_log(JSON.stringify({
        type: 'console',
        level: method,
        message: args.join(' '),
        args: args,
        timestamp: Date.now(),
        url: window.location.href
      }));

      // Call original method to preserve functionality
      return original.apply(console, args);
    };
  });

  // Store references for other instrumentation modules
  window.__js_unshroud_originals = {
    console: originalConsole,
    fetch: window.fetch,
    XMLHttpRequest: window.XMLHttpRequest,
    WebSocket: window.WebSocket,
    localStorage: window.localStorage,
    sessionStorage: window.sessionStorage
  };

  // Mark as loaded
  window.__js_unshroud_loaded = true;

  originalConsole.log('[JS Unshroud] Bootstrap loaded successfully');
})();
