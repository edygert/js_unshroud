// Timer Instrumentation - setTimeout, setInterval, and requestAnimationFrame tracking
(function() {
  'use strict';

  // Wait for bootstrap to set up originals, or use current window objects
  const originals = window.__js_unshroud_originals || {
    setTimeout: window.setTimeout,
    setInterval: window.setInterval,
    requestAnimationFrame: window.requestAnimationFrame,
    clearTimeout: window.clearTimeout,
    clearInterval: window.clearInterval,
    cancelAnimationFrame: window.cancelAnimationFrame
  };

  // Generate a simple event ID
  const generateEventId = function() {
    return (window.__js_unshroud && window.__js_unshroud.newEventId)
      ? window.__js_unshroud.newEventId()
      : 'evt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 11);
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

  // Get handler string representation (safely)
  const getHandlerString = function(handler) {
    try {
      if (typeof handler === 'function') {
        return handler.toString().substring(0, 200); // Limit size
      } else if (typeof handler === 'string') {
        return handler;
      }
    } catch {
      // Ignore
    }
    return '<unknown>';
  };

  // Instrument setTimeout
  if (originals.setTimeout) {
    const originalSetTimeout = originals.setTimeout;

    window.setTimeout = function(handler, delay /*, ...args */) {
      const handlerStr = getHandlerString(handler);
      const timerId = originalSetTimeout.apply(this, arguments);

      logEvent({
        type: 'timer',
        timerType: 'setTimeout',
        operation: 'create',
        handler: handlerStr,
        delay: delay || 0,
        timerId: timerId,
        timestamp: Date.now()
      });

      return timerId;
    };
  }

  // Instrument setInterval
  if (originals.setInterval) {
    const originalSetInterval = originals.setInterval;

    window.setInterval = function(handler, delay /*, ...args */) {
      const handlerStr = getHandlerString(handler);
      const timerId = originalSetInterval.apply(this, arguments);

      logEvent({
        type: 'timer',
        timerType: 'setInterval',
        operation: 'create',
        handler: handlerStr,
        delay: delay || 0,
        timerId: timerId,
        timestamp: Date.now()
      });

      return timerId;
    };
  }

  // Instrument requestAnimationFrame
  if (originals.requestAnimationFrame) {
    const originalRequestAnimationFrame = originals.requestAnimationFrame;

    window.requestAnimationFrame = function(callback) {
      const handlerStr = getHandlerString(callback);
      const requestId = originalRequestAnimationFrame.apply(this, arguments);

      logEvent({
        type: 'timer',
        timerType: 'requestAnimationFrame',
        operation: 'create',
        handler: handlerStr,
        requestId: requestId,
        timestamp: Date.now()
      });

      return requestId;
    };
  }

  // Instrument clearTimeout
  if (originals.clearTimeout) {
    const originalClearTimeout = originals.clearTimeout;

    window.clearTimeout = function(timerId) {
      logEvent({
        type: 'timer',
        timerType: 'setTimeout',
        operation: 'clear',
        timerId: timerId,
        timestamp: Date.now()
      });

      return originalClearTimeout.apply(this, arguments);
    };
  }

  // Instrument clearInterval
  if (originals.clearInterval) {
    const originalClearInterval = originals.clearInterval;

    window.clearInterval = function(timerId) {
      logEvent({
        type: 'timer',
        timerType: 'setInterval',
        operation: 'clear',
        timerId: timerId,
        timestamp: Date.now()
      });

      return originalClearInterval.apply(this, arguments);
    };
  }

  // Instrument cancelAnimationFrame
  if (originals.cancelAnimationFrame) {
    const originalCancelAnimationFrame = originals.cancelAnimationFrame;

    window.cancelAnimationFrame = function(requestId) {
      logEvent({
        type: 'timer',
        timerType: 'requestAnimationFrame',
        operation: 'clear',
        requestId: requestId,
        timestamp: Date.now()
      });

      return originalCancelAnimationFrame.apply(this, arguments);
    };
  }

  window.__js_unshroud_debug('[JS Unshroud] Timer hooks loaded');
})();
