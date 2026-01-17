// Performance optimization - sampling, rate limiting, and overhead control
(function() {
  'use strict';

  // === CONFIGURATION ===
  let config = {
    maxEventsPerSecond: 100000, // High threshold for malware analysis - protects against flooding
    dedupeWindowMs: 100,        // Window for deduplication (ms)
    maxPayloadSize: 1024,       // Max bytes for payload logging
    maxStackDepth: 20,          // Max stack frames to capture
    enableRateLimiting: true,
    enableDeduplication: true
  };

  // Initialize configuration from global object if available
  if (window.__js_unshroud_config) {
    config = { ...config, ...window.__js_unshroud_config };
  }

  // === RATE LIMITING SYSTEM ===
  let eventCount = 0;
  let rateLimitWindow = Date.now();

  function checkRateLimit() {
    if (!config.enableRateLimiting) return true;

    const now = Date.now();
    const windowDuration = 1000; // 1 second window

    if (now - rateLimitWindow >= windowDuration) {
      // Reset window
      eventCount = 0;
      rateLimitWindow = now;
    }

    if (eventCount >= config.maxEventsPerSecond * (Math.min(windowDuration, now - rateLimitWindow) / windowDuration)) {
      return false; // Rate limited
    }

    eventCount++;
    return true;
  }

  // === DEDUPLICATION SYSTEM ===
  const dedupeCache = new Map();

  function shouldDedupe(eventType, signature) {
    if (!config.enableDeduplication) return false;

    const cacheKey = `${eventType}:${signature}`;
    const now = Date.now();
    const lastSeen = dedupeCache.get(cacheKey);

    if (!lastSeen || (now - lastSeen) > config.dedupeWindowMs) {
      dedupeCache.set(cacheKey, now);
      return false; // Not a duplicate
    }

    // Clean up old entries occasionally
    if (Math.random() < 0.01) { // 1% chance to cleanup
      const cutoff = now - config.dedupeWindowMs * 2;
      for (const [key, timestamp] of dedupeCache.entries()) {
        if (timestamp < cutoff) {
          dedupeCache.delete(key);
        }
      }
    }

    return true; // This is a duplicate
  }

  // === PAYLOAD SIZE LIMITING ===
  function limitPayloadSize(data, maxSize = config.maxPayloadSize) {
    if (!data) return data;

    if (typeof data === 'string' && data.length > maxSize) {
      return data.substring(0, maxSize) + `... (+${data.length - maxSize} chars truncated)`;
    }

    if (typeof data === 'object') {
      const jsonString = JSON.stringify(data);
      if (jsonString.length > maxSize) {
        return JSON.parse(jsonString.substring(0, maxSize - 50)) + '... (truncated)';
      }
    }

    return data;
  }

  // === STACK TRACE LIMITING ===
  function limitStackTrace(stack, maxDepth = config.maxStackDepth) {
    if (!stack) return stack;

    const lines = stack.split('\n');
    if (lines.length <= maxDepth + 2) { // +2 for first two header lines
      return stack;
    }

    const headerLines = lines.slice(0, 2);
    const relevantLines = lines.slice(2, 2 + maxDepth);
    headerLines.push(`    ... (${lines.length - 2 - maxDepth} more frames truncated)`);
    return headerLines.concat([''], relevantLines).join('\n');
  }

  // === PERFORMANCE MONITORING ===
  const performanceStats = {
    eventsAccepted: 0,
    eventsRejected: 0,
    eventsRateLimited: 0,
    eventsDeduplicated: 0,
    startTime: Date.now(),
    lastReportTime: Date.now()
  };

  function updatePerformanceStats(event, decision, _reason) {
    performanceStats.eventsAccepted++;

    if (decision === 'rate_limited') {
      performanceStats.eventsRejected++;
      performanceStats.eventsRateLimited++;
    } else if (decision === 'deduplicated') {
      performanceStats.eventsRejected++;
      performanceStats.eventsDeduplicated++;
    }

    // Periodic performance reporting
    const now = Date.now();
    if (now - performanceStats.lastReportTime > 30000) { // Every 30 seconds
      reportPerformanceStats();
      performanceStats.lastReportTime = now;
    }
  }

  function reportPerformanceStats() {
    if (!window.__js_unshroud_log) return;

    const uptime = Date.now() - performanceStats.startTime;
    const totalEvents = performanceStats.eventsAccepted + performanceStats.eventsRejected;
    const acceptanceRate = totalEvents > 0 ? (performanceStats.eventsAccepted / totalEvents * 100) : 100;

    const performanceEvent = {
      id: 'perf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      sessionId: window.__js_unshroud_session_id || 'unknown_session',
      timestamp: Date.now(),
      type: 'performance_stats',
      method: 'periodic_report',
      operation: 'performance_monitoring',
      uptime: uptime,
      totalEventsProcessed: totalEvents,
      eventsAccepted: performanceStats.eventsAccepted,
      eventsRejected: performanceStats.eventsRejected,
      eventsRateLimited: performanceStats.eventsRateLimited,
      eventsDeduplicated: performanceStats.eventsDeduplicated,
      acceptanceRate: acceptanceRate.toFixed(2) + '%',
      maxEventsPerSecond: config.maxEventsPerSecond
    };

    window.__js_unshroud_log(JSON.stringify(performanceEvent));
  }

  // === MAIN PERFORMANCE GATE ===
  function filterEvent(rawEvent) {
    // 1. Check rate limiting
    if (!checkRateLimit()) {
      updatePerformanceStats(rawEvent, 'rate_limited');
      return null;
    }

    // 2. Check deduplication
    const signature = generateEventSignature(rawEvent);
    if (shouldDedupe(rawEvent.type, signature)) {
      updatePerformanceStats(rawEvent, 'deduplicated');
      return null;
    }

    // Event passed all filters, optimize payload
    const optimizedEvent = { ...rawEvent };

    // Limit payload sizes
    if (optimizedEvent.payload) {
      optimizedEvent.payload = limitPayloadSize(optimizedEvent.payload);
    }

    // Limit stack traces but preserve important frames
    if (optimizedEvent.stackTrace) {
      optimizedEvent.stackTrace = limitStackTrace(optimizedEvent.stackTrace);
    }

    // Add performance metadata
    optimizedEvent.performanceNote = 'passed_filters';

    updatePerformanceStats(optimizedEvent, 'accepted');
    return optimizedEvent;
  }

  // Generate signature for deduplication
  function generateEventSignature(event) {
    // Create a simple signature based on event properties
    let signature = `${event.type}_${event.method || 'unknown'}`;

    // Add some context-specific data
    if (event.payload) {
      if (typeof event.payload === 'string' && event.payload.length > 50) {
        signature += '_' + event.payload.substring(0, 50);
      } else {
        signature += '_' + JSON.stringify(event.payload).substring(0, 50);
      }
    }

    // Include URL for network events
    if (event.url) {
      signature += '_url:' + event.url.substring(0, 30);
    }

    // Include key for storage events
    if (event.key) {
      signature += '_key:' + event.key.substring(0, 20);
    }

    return signature;
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
    return originalSetTimeout.call(this, callback, delay);
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
    return originalSetInterval.call(this, callback, delay);
  };

  // === EXPORT PERFORMANCE API ===
  window.__js_unshroud = window.__js_unshroud || {};
  window.__js_unshroud.filterEvent = filterEvent;
  window.__js_unshroud.getPerformanceStats = () => ({ ...performanceStats });
  window.__js_unshroud.updateConfig = (newConfig) => {
    config = { ...config, ...newConfig };
    window.__js_unshroud_config = { ...window.__js_unshroud_config, ...newConfig };
  };

  console.log('[JS Unshroud] Performance monitor loaded - Max Events/sec:', config.maxEventsPerSecond);
})();
