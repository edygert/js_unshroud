// Service Worker Instrumentation Hooks
// Detects and monitors Service Worker registration, lifecycle, and operations

(function() {
  'use strict';

  // Check if Service Worker monitoring is enabled
  if (!window.__js_unshroud_config || !window.__js_unshroud_config.enableServiceWorker) {
    return;
  }

  // Generate a simple event ID
  const generateEventId = function() {
    return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  // Get session ID from window
  const getSessionId = function() {
    return window.__js_unshroud_session_id || 'unknown_session';
  };

  // Log Service Worker event
  const logServiceWorkerEvent = function(eventData) {
    if (typeof window.__js_unshroud_log === 'function') {
      window.__js_unshroud_log(JSON.stringify({
        id: generateEventId(),
        sessionId: getSessionId(),
        timestamp: Date.now(),
        type: 'service_worker',
        url: window.location.href,
        ...eventData
      }));
    }
  };

  // Store original Service Worker methods
  const originalRegister = navigator.serviceWorker ? navigator.serviceWorker.register : null;
  const originalGetRegistration = navigator.serviceWorker ? navigator.serviceWorker.getRegistration : null;

  // Monitor Service Worker registration
  if (originalRegister) {
    navigator.serviceWorker.register = function(scriptUrl, options) {
      logServiceWorkerEvent({
        eventType: 'register',
        scriptUrl: scriptUrl,
        scope: options ? options.scope : undefined,
      });

      return originalRegister.apply(navigator.serviceWorker, [scriptUrl, options]).then(function(registration) {
        logServiceWorkerEvent({
          eventType: 'register',
          scriptUrl: scriptUrl,
          scope: registration.scope,
          success: true,
          state: registration.installing ? 'installing' : 
                 registration.waiting ? 'installed' : 
                 registration.active ? 'activated' : 'unknown'
        });

        // Monitor installation lifecycle
        if (registration.installing) {
          registration.installing.addEventListener('statechange', function(e) {
            logServiceWorkerEvent({
              eventType: 'install',
              scriptUrl: scriptUrl,
              state: e.target.state,
              success: e.target.state !== 'redundant'
            });
          });
        }

        return registration;
      }).catch(function(error) {
        logServiceWorkerEvent({
          eventType: 'register',
          scriptUrl: scriptUrl,
          scope: options ? options.scope : undefined,
          success: false,
          error: error.message || String(error),
        });
        throw error;
      });
    };
  }

  // Monitor Service Worker unregistration
  if (originalGetRegistration) {
    navigator.serviceWorker.getRegistration = function(scope) {
      return originalGetRegistration.apply(navigator.serviceWorker, [scope]).then(function(registration) {
        if (registration) {
          logServiceWorkerEvent({
            eventType: 'update',
            scriptUrl: registration.active ? registration.active.scriptURL : undefined,
            scope: registration.scope,
            success: true
          });
        }
        return registration;
      });
    };
  }

  // Monitor Service Worker messages
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', function(event) {
      logServiceWorkerEvent({
        eventType: 'message',
        messageData: event.data,
        success: true
      });
    });
  }

  // Monitor Cache API operations
  if (typeof window.caches === 'object' && window.caches !== null) {
    const originalCacheOpen = window.caches.open;
    window.caches.open = function(cacheName) {
      logServiceWorkerEvent({
        eventType: 'cache_open',
        cacheName: cacheName,
        success: true
      });
      return originalCacheOpen.apply(window.caches, [cacheName]);
    };

    // Intercept cache operations on returned cache objects
    const originalCacheMethods = ['add', 'addAll', 'put', 'delete', 'keys'];
    originalCacheMethods.forEach(function(method) {
      if (typeof window.Cache === 'function' && window.Cache.prototype && window.Cache.prototype[method]) {
        const originalMethod = window.Cache.prototype[method];
        window.Cache.prototype[method] = function() {
          const cacheName = this.name;
          if (method === 'delete') {
            logServiceWorkerEvent({
              eventType: 'cache_delete',
              cacheName: cacheName,
              cacheKey: arguments[0],
              success: true
            });
          } else if (method === 'add' || method === 'addAll') {
            logServiceWorkerEvent({
              eventType: 'cache_add',
              cacheName: cacheName,
              cacheKey: arguments[0],
              success: true
            });
          }
          return originalMethod.apply(this, arguments);
        };
      }
    });
  }

  // Monitor Push API subscription
  if (navigator.serviceWorker && navigator.serviceWorker.ready) {
    navigator.serviceWorker.ready.then(function(registration) {
      if (registration && registration.pushManager) {
        const originalSubscribe = registration.pushManager.subscribe;
        if (originalSubscribe) {
          registration.pushManager.subscribe = function(options) {
            return originalSubscribe.apply(registration.pushManager, [options]).then(function(subscription) {
              logServiceWorkerEvent({
                eventType: 'push_subscribe',
                subscriptionEndpoint: subscription.endpoint,
                success: true
              });
              return subscription;
            }).catch(function(error) {
              logServiceWorkerEvent({
                eventType: 'push_subscribe',
                success: false,
                error: error.message || String(error)
              });
              throw error;
            });
          };
        }

        const originalUnsubscribe = registration.pushManager.getSubscription;
        if (originalUnsubscribe) {
          registration.pushManager.getSubscription = function() {
            return originalUnsubscribe.apply(registration.pushManager, []).then(function(subscription) {
              if (subscription) {
                logServiceWorkerEvent({
                  eventType: 'push_unsubscribe',
                  subscriptionEndpoint: subscription.endpoint,
                  success: true
                });
              }
              return subscription;
            });
          };
        }
      }
    });
  }

  console.log('[JS Unshroud] Service Worker instrumentation activated');
})();
