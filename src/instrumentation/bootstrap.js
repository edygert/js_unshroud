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

  // Store original console reference (direct reference, not copy)
  const originalConsole = console;

  // Store console methods for later interception (avoid overriding during page load)
  window.__js_unshroud_console_methods = ['log', 'warn', 'error', 'info', 'debug'];

  // Generate a simple event ID
  const generateEventId = function() {
    return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  // Get session ID from window or generate a temporary one
  const getSessionId = function() {
    return window.__js_unshroud_session_id || 'unknown_session';
  };

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
    console.log('[JS Unshroud] Console instrumentation activated');
  };

  // Intercept console methods after page load to avoid crashes
  if (document.readyState === 'loading') {
    // Wait for DOM to be ready before intercepting console
    document.addEventListener('DOMContentLoaded', function() {
      // Small additional delay to avoid timing issues
      setTimeout(interceptConsole, 100);
    });
  } else {
    // Page already loaded, intercept immediately
    interceptConsole();
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
