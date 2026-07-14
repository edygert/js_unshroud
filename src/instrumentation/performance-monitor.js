// Performance optimization - deduplication and overhead control
(function() {
  'use strict';

  // === CONFIGURATION ===
  let config = {
    maxPayloadSize: 1024,       // Max bytes for payload logging
    maxStackDepth: 20           // Max stack frames to capture
  };

  // Initialize configuration from global object if available
  if (window.__js_unshroud_config) {
    config = { ...config, ...window.__js_unshroud_config };
  }

  // === PERFORMANCE MONITORING HOOKS ===

  // Hook setTimeout/setInterval to monitor our own impact
  const originalSetTimeout = window.setTimeout;
  const originalSetInterval = window.setInterval;

  window.setTimeout = function(callback, delay) {
    if (delay && delay < 10) { // Very short timeouts indicating heavy instrumentation
      if (window.__js_unshroud_log) {
        const performanceWarning = {
          id: 'perf_warn_' + Date.now(),
          sessionId: window.__js_unshroud_session_id || 'unknown_session',
          timestamp: Date.now(),
          type: 'performance_warning',
          method: 'setTimeout',
          operation: 'short_timeout_detected',
          delay: delay,
          warning: 'Instrumentation may be impacting performance'
        };
        window.__js_unshroud_log(JSON.stringify(performanceWarning));
      }
    }
    // Forward ALL arguments (callback, delay, ...args) so trailing timer args are preserved
    return originalSetTimeout.apply(this, arguments);
  };

  window.setInterval = function(callback, delay) {
    if (delay && delay < 100) { // Very short intervals indicating high-frequency monitoring
      if (window.__js_unshroud_log) {
        const performanceWarning = {
          id: 'perf_warn_' + Date.now(),
          sessionId: window.__js_unshroud_session_id || 'unknown_session',
          timestamp: Date.now(),
          type: 'performance_warning',
          method: 'setInterval',
          operation: 'short_interval_detected',
          delay: delay,
          warning: 'Instrumentation frequency may be impacting performance'
        };
        window.__js_unshroud_log(JSON.stringify(performanceWarning));
      }
    }
    // Forward ALL arguments (callback, delay, ...args) so trailing timer args are preserved
    return originalSetInterval.apply(this, arguments);
  };

  // === EXPORT PERFORMANCE API ===
  window.__js_unshroud = window.__js_unshroud || {};
  window.__js_unshroud.updateConfig = (newConfig) => {
    config = { ...config, ...newConfig };
    window.__js_unshroud_config = { ...window.__js_unshroud_config, ...newConfig };
  };

  window.__js_unshroud_debug('[JS Unshroud] Performance monitor loaded');
})();
