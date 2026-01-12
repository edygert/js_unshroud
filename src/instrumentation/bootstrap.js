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

  // Store console methods for later interception (avoid overriding during page load)
  window.__js_unshroud_console_methods = ['log', 'warn', 'error', 'info', 'debug'];

  // Intercept console methods after page load to avoid crashes
  if (document.readyState === 'loading') {
    // Wait for DOM to be ready before intercepting console
    document.addEventListener('DOMContentLoaded', function() {
      // Small additional delay to avoid timing issues
      setTimeout(function() {
        window.__js_unshroud_console_methods.forEach(function(method) {
          const original = console[method];
          console[method] = function(...args) {
            // Log to instrumentation system
            window.__js_unshroud_log(JSON.stringify({
              type: 'console',
              level: method,
              message: Array.prototype.join.call(args, ' '),
              args: args,
              timestamp: Date.now(),
              url: window.location.href
            }));

            // Call original method to preserve functionality
            return original.apply(console, args);
          };
        });
        console.log('[JS Unshroud] Console instrumentation activated');
      }, 100);
    });
  } else {
    // Page already loaded, intercept immediately
    window.__js_unshroud_console_methods.forEach(function(method) {
      const original = console[method];
      console[method] = function(...args) {
        window.__js_unshroud_log(JSON.stringify({
          type: 'console',
          level: method,
          message: Array.prototype.join.call(args, ' '),
          args: args,
          timestamp: Date.now(),
          url: window.location.href
        }));

        return original.apply(console, args);
      };
    });
    console.log('[JS Unshroud] Console instrumentation activated');
  }

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
