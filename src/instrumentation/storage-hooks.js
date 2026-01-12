// Storage Instrumentation - localStorage and sessionStorage tracking
(function() {
  'use strict';

  if (!window.__js_unshroud_originals) return;

  const logEvent = function(event) {
    if (window.__js_unshroud_log) {
      window.__js_unshroud_log(JSON.stringify(event));
    }
  };

  // Function to capture stack trace
  const getStackTrace = function() {
    try {
      throw new Error();
    } catch (e) {
      return e.stack || '';
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
      const stackTrace = getStackTrace();
      const result = originalGetItem.apply(this, arguments);

      logEvent({
        type: 'storage',
        storageType: storageType,
        operation: 'get',
        key: key,
        value: result,
        stackTrace: stackTrace,
        timestamp: Date.now()
      });

      return result;
    };

    // Override setItem
    storage.setItem = function(key, value) {
      const stackTrace = getStackTrace();
      const oldValue = originalGetItem.call(this, key);

      const result = originalSetItem.apply(this, arguments);

      logEvent({
        type: 'storage',
        storageType: storageType,
        operation: 'set',
        key: key,
        value: value,
        oldValue: oldValue,
        stackTrace: stackTrace,
        timestamp: Date.now()
      });

      return result;
    };

    // Override removeItem
    storage.removeItem = function(key) {
      const stackTrace = getStackTrace();
      const oldValue = originalGetItem.call(this, key);

      const result = originalRemoveItem.apply(this, arguments);

      logEvent({
        type: 'storage',
        storageType: storageType,
        operation: 'remove',
        key: key,
        oldValue: oldValue,
        stackTrace: stackTrace,
        timestamp: Date.now()
      });

      return result;
    };

    // Override clear
    storage.clear = function() {
      const stackTrace = getStackTrace();

      logEvent({
        type: 'storage',
        storageType: storageType,
        operation: 'clear',
        stackTrace: stackTrace,
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
      console.warn('[JS Unshroud] Failed to instrument localStorage:', e);
    }
  }

  // Instrument sessionStorage
  if (window.__js_unshroud_originals.sessionStorage) {
    try {
      instrumentStorage(window.sessionStorage, 'sessionStorage');
    } catch (e) {
      console.warn('[JS Unshroud] Failed to instrument sessionStorage:', e);
    }
  }

  console.log('[JS Unshroud] Storage hooks loaded');
})();
