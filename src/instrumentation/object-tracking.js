// Object Tracking - Proxy-based monitoring for custom objects and global variables
(function() {
  'use strict';

  // Generate a simple event ID
  const generateEventId = function() {
    return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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

  // Function to capture stack trace
  const getStackTrace = function() {
    try {
      throw new Error();
    } catch (e) {
      return e.stack || '';
    }
  };

  // Safe serialization of values
  const serializeValue = function(value, maxDepth = 2, currentDepth = 0) {
    if (currentDepth >= maxDepth) {
      return '<max_depth_exceeded>';
    }

    try {
      const type = typeof value;
      if (value === null || type === 'undefined' || type === 'boolean' || type === 'number') {
        return value;
      }

      if (type === 'string') {
        return value.length > 100 ? value.substring(0, 100) + '...' : value;
      }

      if (type === 'function') {
        return '<function:' + (value.name || 'anonymous') + '>';
      }

      if (Array.isArray(value)) {
        if (value.length > 10) {
          return value.slice(0, 10).map(v => serializeValue(v, maxDepth, currentDepth + 1));
        }
        return value.map(v => serializeValue(v, maxDepth, currentDepth + 1));
      }

      if (type === 'object') {
        const result = {};
        let count = 0;
        for (const key in value) {
          if (count >= 5) { // Limit properties to avoid overwhelming logs
            result['...'] = '<truncated>';
            break;
          }
          result[key] = serializeValue(value[key], maxDepth, currentDepth + 1);
          count++;
        }
        return result;
      }

      return '<' + type + '>';
    } catch {
      return '<serialization_error>';
    }
  };

  // Create a proxy for object tracking
  const createTrackingProxy = function(target, label, options = {}) {
    const {
      trackGets = true,
      trackSets = true,
      trackDeletes = false,
      maxDepth = 2
    } = options;

    const handler = {
      get: function(targetObj, property, receiver) {
        const value = Reflect.get(targetObj, property, receiver);
        const stackTrace = getStackTrace();

        if (trackGets && property !== '__js_unshroud_proxy_label') {
          logEvent({
            type: 'object_tracking',
            operation: 'get',
            label: label,
            property: String(property),
            value: serializeValue(value, maxDepth),
            stackTrace: stackTrace,
            timestamp: Date.now()
          });
        }

        // If the property is also an object, consider wrapping it too
        if (value && typeof value === 'object' && !value.__js_unshroud_proxy_label && options.deepTracking) {
          return createTrackingProxy(value, label + '.' + String(property), options);
        }

        return value;
      },

      set: function(targetObj, property, value, receiver) {
        const oldValue = targetObj[property];
        const result = Reflect.set(targetObj, property, value, receiver);
        const stackTrace = getStackTrace();

        if (trackSets && property !== '__js_unshroud_proxy_label') {
          logEvent({
            type: 'object_tracking',
            operation: 'set',
            label: label,
            property: String(property),
            oldValue: serializeValue(oldValue, maxDepth),
            newValue: serializeValue(value, maxDepth),
            stackTrace: stackTrace,
            timestamp: Date.now()
          });
        }

        return result;
      },

      deleteProperty: function(targetObj, property) {
        const oldValue = targetObj[property];
        const result = Reflect.deleteProperty(targetObj, property);
        const stackTrace = getStackTrace();

        if (trackDeletes) {
          logEvent({
            type: 'object_tracking',
            operation: 'delete',
            label: label,
            property: String(property),
            oldValue: serializeValue(oldValue, maxDepth),
            stackTrace: stackTrace,
            timestamp: Date.now()
          });
        }

        return result;
      }
    };

    const proxy = new Proxy(target, handler);
    proxy.__js_unshroud_proxy_label = label; // Mark to avoid double-wrapping
    return proxy;
  };

  // Public API for tracking objects
  window.__js_unshroud_trackObject = function(obj, label, options = {}) {
    if (!obj || typeof obj !== 'object') {
      console.warn('[JS Unshroud] trackObject: first argument must be an object');
      return obj;
    }

    try {
      console.log('[JS Unshroud] Tracking object:', label);
      return createTrackingProxy(obj, label, options);
    } catch (e) {
      console.warn('[JS Unshroud] Failed to track object:', label, e);
      return obj;
    }
  };

  // Convenience methods for tracking global objects
  window.__js_unshroud_trackGlobal = function(propertyName, options = {}) {
    if (propertyName in window) {
      try {
        const original = window[propertyName];
        if (original && typeof original === 'object') {
          window[propertyName] = createTrackingProxy(original, 'global.' + propertyName, options);
          console.log('[JS Unshroud] Tracking global:', propertyName);
        } else {
          console.warn('[JS Unshroud] Global property is not an object:', propertyName);
        }
      } catch (e) {
        console.warn('[JS Unshroud] Failed to track global:', propertyName, e);
      }
    } else {
      console.warn('[JS Unshroud] Global property not found:', propertyName);
    }
  };

  // Method to untrack objects (remove proxy wrapping)
  window.__js_unshroud_untrackObject = function(proxy) {
    if (proxy && proxy.__js_unshroud_proxy_label) {
      // For now, we can't easily unwrap proxies, but we can mark them as untracked
      console.log('[JS Unshroud] Untracking object:', proxy.__js_unshroud_proxy_label);
      // In a real implementation, you'd need to maintain a registry of original objects
    }
  };

  console.log('[JS Unshroud] Object tracking loaded');
})();
