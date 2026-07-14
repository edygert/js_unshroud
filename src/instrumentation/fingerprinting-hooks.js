// Fingerprinting Detection - Canvas, WebGL, Navigator, and Audio fingerprinting
(function() {
  'use strict';

  // Wait for bootstrap to set up originals, or use current window objects
  const originals = window.__js_unshroud_originals || {
    HTMLCanvasElement: window.HTMLCanvasElement,
    getContext: window.HTMLCanvasElement?.prototype?.getContext,
    toDataURL: window.HTMLCanvasElement?.prototype?.toDataURL,
    getImageData: window.CanvasRenderingContext2D?.prototype?.getImageData,
    navigator: window.navigator,
    userAgent: Object.getOwnPropertyDescriptor(window.navigator.constructor.prototype, 'userAgent'),
    language: Object.getOwnPropertyDescriptor(window.navigator.constructor.prototype, 'language'),
    languages: Object.getOwnPropertyDescriptor(window.navigator.constructor.prototype, 'languages'),
    platform: Object.getOwnPropertyDescriptor(window.navigator.constructor.prototype, 'platform'),
    webdriver: Object.getOwnPropertyDescriptor(window.navigator.constructor.prototype, 'webdriver'),
    AudioContext: window.AudioContext || window.webkitAudioContext,
    OfflineAudioContext: window.OfflineAudioContext || window.webkitOfflineAudioContext
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


  // Instrument canvas getContext
  if (originals.getContext) {
    const originalGetContext = originals.getContext;

    window.HTMLCanvasElement.prototype.getContext = function(contextType, options) {

      // Log WebGL context creation (common fingerprinting method)
      if (contextType && contextType.includes('webgl')) {
        logEvent({
          type: 'fingerprinting',
          method: 'getContext',
          contextType: contextType,
          options: options,
          operation: 'webgl_context',
          timestamp: Date.now()
        });
      }

      return originalGetContext.apply(this, arguments);
    };
  }

  // Instrument canvas toDataURL (classic fingerprinting method)
  if (originals.toDataURL) {
    const originalToDataURL = originals.toDataURL;

    window.HTMLCanvasElement.prototype.toDataURL = function() {

      logEvent({
        type: 'fingerprinting',
        method: 'toDataURL',
        operation: 'canvas_fingerprint',
        timestamp: Date.now()
      });

      return originalToDataURL.apply(this, arguments);
    };
  }

  // Instrument getImageData (canvas fingerprinting)
  if (originals.getImageData) {
    const originalGetImageData = originals.getImageData;

    window.CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {

      logEvent({
        type: 'fingerprinting',
        method: 'getImageData',
        operation: 'canvas_read',
        sx: sx, sy: sy, sw: sw, sh: sh,
        timestamp: Date.now()
      });

      return originalGetImageData.apply(this, arguments);
    };
  }

  // Instrument navigator properties (common fingerprinting targets)
  const navigatorProperties = ['userAgent', 'language', 'languages', 'platform', 'webdriver'];

  navigatorProperties.forEach(prop => {
    const descriptor = originals[prop];
    if (descriptor && descriptor.get) {
      const originalGetter = descriptor.get;

      Object.defineProperty(window.navigator.constructor.prototype, prop, {
        get: function() {
          const value = originalGetter.call(this);

          logEvent({
            type: 'fingerprinting',
            method: 'navigator.' + prop,
            operation: 'navigator_read',
            value: typeof value === 'string' ? value.substring(0, 100) : value, // Limit string length
            timestamp: Date.now()
          });

          return value;
        },
        set: descriptor.set,
        enumerable: descriptor.enumerable,
        configurable: descriptor.configurable
      });
    }
  });

  // Instrument AudioContext creation (audio fingerprinting)
  [window.AudioContext || window.webkitAudioContext, window.OfflineAudioContext || window.webkitOfflineAudioContext].forEach(AudioCtx => {
    if (AudioCtx) {
      const originalConstructor = AudioCtx;

      // Audio fingerprinting by creating contexts and analyzing output
      const WrappedAudioContext = function(options) {
        const instance = new originalConstructor(options);

        // Listen for audio destination creation and analysis methods
        if (instance.destination) {
          const originalConnect = instance.destination.connect;
          if (originalConnect) {
            instance.destination.connect = function() {
              logEvent({
                type: 'fingerprinting',
                method: 'audioDestination.connect',
                operation: 'audio_fingerprint',
                timestamp: Date.now()
              });
              return originalConnect.apply(this, arguments);
            };
          }
        }

        // Monitor createAnalyser and other fingerprinting methods
        const methods = ['createAnalyser', 'createOscillator', 'getChannelData'];
        methods.forEach(method => {
          if (instance[method]) {
            const originalMethod = instance[method];
            instance[method] = function() {
              logEvent({
                type: 'fingerprinting',
                method: 'AudioContext.' + method,
                operation: 'audio_fingerprint',
                timestamp: Date.now()
              });
              return originalMethod.apply(this, arguments);
            };
          }
        });

        logEvent({
          type: 'fingerprinting',
          method: AudioCtx.name || 'AudioContext',
          operation: 'audio_context_created',
          options: options,
          timestamp: Date.now()
        });

        return instance;
      };

      // Copy prototype and static properties
      WrappedAudioContext.prototype = originalConstructor.prototype;
      Object.getOwnPropertyNames(originalConstructor).forEach(prop => {
        if (prop !== 'prototype' && prop !== 'length' && prop !== 'name') {
          try {
            WrappedAudioContext[prop] = originalConstructor[prop];
          } catch {
            // Ignore non-configurable properties
          }
        }
      });

      // Replace the global constructor
      if (AudioCtx === window.AudioContext || AudioCtx === window.webkitAudioContext) {
        window.AudioContext = WrappedAudioContext;
        if (window.webkitAudioContext) {
          window.webkitAudioContext = WrappedAudioContext;
        }
      } else if (AudioCtx === window.OfflineAudioContext || AudioCtx === window.webkitOfflineAudioContext) {
        window.OfflineAudioContext = WrappedAudioContext;
        if (window.webkitOfflineAudioContext) {
          window.webkitOfflineAudioContext = WrappedAudioContext;
        }
      }
    }
  });

  window.__js_unshroud_debug('[JS Unshroud] Fingerprinting hooks loaded');
})();
