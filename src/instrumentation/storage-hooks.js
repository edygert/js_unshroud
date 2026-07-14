// Storage Instrumentation - localStorage and sessionStorage tracking
(function() {
  'use strict';

  if (!window.__js_unshroud_originals) return;

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

  // Helper to instrument storage object
  function instrumentStorage(storage, storageType) {
    // Only instrument if storage is available
    if (!storage) return;

    const originalGetItem = storage.getItem;
    const originalSetItem = storage.setItem;
    const originalRemoveItem = storage.removeItem;
    const originalClear = storage.clear;

    // Override getItem
    storage.getItem = function(key) {
      const result = originalGetItem.apply(this, arguments);

      logEvent({
        type: 'storage',
        storageType: storageType,
        operation: 'get',
        key: key,
        value: result,
        timestamp: Date.now()
      });

      return result;
    };

    // Override setItem
    storage.setItem = function(key, value) {
      const oldValue = originalGetItem.call(this, key);

      const result = originalSetItem.apply(this, arguments);

      logEvent({
        type: 'storage',
        storageType: storageType,
        operation: 'set',
        key: key,
        value: value,
        oldValue: oldValue,
        timestamp: Date.now()
      });

      return result;
    };

    // Override removeItem
    storage.removeItem = function(key) {
      const oldValue = originalGetItem.call(this, key);

      const result = originalRemoveItem.apply(this, arguments);

      logEvent({
        type: 'storage',
        storageType: storageType,
        operation: 'remove',
        key: key,
        oldValue: oldValue,
        timestamp: Date.now()
      });

      return result;
    };

    // Override clear
    storage.clear = function() {

      logEvent({
        type: 'storage',
        storageType: storageType,
        operation: 'clear',
        timestamp: Date.now()
      });

      return originalClear.apply(this, arguments);
    };
  }

  // Instrument localStorage
  if (window.__js_unshroud_originals.localStorage) {
    try {
      instrumentStorage(window.localStorage, 'localStorage');
    } catch (e) {
      window.__js_unshroud_debug('[JS Unshroud] Failed to instrument localStorage:', e);
    }
  }

  // Instrument sessionStorage
  if (window.__js_unshroud_originals.sessionStorage) {
    try {
      instrumentStorage(window.sessionStorage, 'sessionStorage');
    } catch (e) {
      window.__js_unshroud_debug('[JS Unshroud] Failed to instrument sessionStorage:', e);
    }
  }

  window.__js_unshroud_debug('[JS Unshroud] Storage hooks loaded');
})();
