// DOM Instrumentation - Event listeners and basic mutation observation
(function() {
  'use strict';

  // Wait for bootstrap to set up originals, or use current window objects
  const originals = window.__js_unshroud_originals || {
    EventTarget: window.EventTarget,
    addEventListener: window.EventTarget?.prototype?.addEventListener,
    removeEventListener: window.EventTarget?.prototype?.removeEventListener,
    appendChild: window.Node?.prototype?.appendChild,
    insertBefore: window.Node?.prototype?.insertBefore,
    removeChild: window.Node?.prototype?.removeChild,
    replaceChild: window.Node?.prototype?.replaceChild,
    innerHTML: Object.getOwnPropertyDescriptor(window.Element?.prototype, 'innerHTML')
  };

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

  // Get element selector for logging (safely)
  const getElementSelector = function(element) {
    try {
      if (!element || !element.nodeType) return '<unknown>';

      // Simple selector generation
      let selector = element.tagName ? element.tagName.toLowerCase() : '';

      if (element.id) {
        selector += '#' + element.id;
      } else if (element.className && typeof element.className === 'string') {
        const classes = element.className.split(' ').filter(c => c).slice(0, 3);
        if (classes.length > 0) {
          selector += '.' + classes.join('.');
        }
      }

      if (element.getAttribute && element.getAttribute('data-testid')) {
        selector += '[data-testid="' + element.getAttribute('data-testid') + '"]';
      }

      return selector || '<element>';
    } catch {
      return '<error>';
    }
  };

  // Get listener string representation (safely)
  const getListenerString = function(listener) {
    try {
      if (typeof listener === 'function') {
        return listener.toString().substring(0, 200); // Limit size
      }
    } catch {
      // Ignore
    }
    return '<function>';
  };

  // === DOM EVENT FILTERING (P4.1) ===

  const DOM_EVENT_CATEGORIES = {
    load: ['load', 'DOMContentLoaded', 'beforeunload', 'unload'],
    mouse: ['mouseover', 'mouseout', 'mousemove', 'pointermove', 'mouseenter',
            'mouseleave', 'pointerover', 'pointerout'],
    lifecycle: ['pageshow', 'pagehide', 'visibilitychange', 'freeze', 'resume'],
    interaction: ['click', 'dblclick', 'submit', 'focus', 'blur', 'focusin',
                  'focusout', 'keydown', 'keyup', 'keypress', 'input', 'change'],
    mutation: ['appendChild', 'insertBefore', 'removeChild', 'replaceChild',
               'innerHTML', 'outerHTML', 'insertAdjacentHTML']
  };

  function shouldLogDomEvent(eventType, operation) {
    // ALWAYS log addEventListener (malware registering handlers - critical signal)
    if (operation === 'addEventListener') {
      return true;
    }

    // NEVER log removeEventListener (cleanup noise)
    if (operation === 'removeEventListener') {
      return false;
    }

    const config = window.__js_unshroud_config;
    if (!config || !config.eventFiltering || !config.eventFiltering.dom) {
      return true; // No filtering config, log everything
    }

    const domConfig = config.eventFiltering.dom;

    // Check mutation operations
    if (operation && DOM_EVENT_CATEGORIES.mutation.includes(operation)) {
      return domConfig.enableMutationEvents === true;
    }

    // For eventFired, apply category filtering based on eventType
    if (eventType) {
      if (DOM_EVENT_CATEGORIES.load.includes(eventType)) {
        return domConfig.enableLoadEvents === true;
      }
      if (DOM_EVENT_CATEGORIES.mouse.includes(eventType)) {
        return domConfig.enableMouseEvents === true;
      }
      if (DOM_EVENT_CATEGORIES.lifecycle.includes(eventType)) {
        return domConfig.enablePageLifecycle === true;
      }
      if (DOM_EVENT_CATEGORIES.interaction.includes(eventType)) {
        return domConfig.enableInteractionEvents === true;
      }
    }

    return true; // Log unknown event types
  }

  // === HTML ANALYSIS UTILITIES FOR SCRIPT INJECTION DETECTION ===

  // Analyze HTML for <script> tags and extract src attributes
  const analyzeScriptTags = function(html) {
    if (!html || typeof html !== 'string') {
      return { containsScript: false, scriptCount: 0, sources: [] };
    }

    const scriptRegex = /<script\b[^>]*>/gi;
    const matches = html.match(scriptRegex);

    if (!matches || matches.length === 0) {
      return { containsScript: false, scriptCount: 0, sources: [] };
    }

    const sources = [];
    const srcRegex = /src=["']([^"']+)["']/i;

    for (let i = 0; i < matches.length; i++) {
      const srcMatch = matches[i].match(srcRegex);
      if (srcMatch && srcMatch[1]) {
        sources.push(srcMatch[1]);
      }
    }

    return {
      containsScript: true,
      scriptCount: matches.length,
      sources: sources
    };
  };

  // Analyze HTML for event handler attributes (onerror, onclick, etc.)
  const analyzeEventHandlers = function(html) {
    if (!html || typeof html !== 'string') {
      return { containsHandlers: false, handlerCount: 0, handlerTypes: [] };
    }

    // Match on* attributes
    const handlerRegex = /\bon([a-z]+)\s*=/gi;
    const matches = html.match(handlerRegex);

    if (!matches || matches.length === 0) {
      return { containsHandlers: false, handlerCount: 0, handlerTypes: [] };
    }

    const handlerTypes = [];
    const seenTypes = {};

    for (let i = 0; i < matches.length; i++) {
      const type = matches[i].toLowerCase().replace(/\s*=\s*$/, '');
      if (!seenTypes[type]) {
        handlerTypes.push(type);
        seenTypes[type] = true;
      }
    }

    return {
      containsHandlers: true,
      handlerCount: matches.length,
      handlerTypes: handlerTypes
    };
  };

  // Analyze URL for data: and blob: schemes, decode base64
  const analyzeScriptUrl = function(url) {
    if (!url || typeof url !== 'string') {
      return { isDataUrl: false, isBlobUrl: false, isBase64: false, decodedContent: null };
    }

    const isDataUrl = url.startsWith('data:');
    const isBlobUrl = url.startsWith('blob:');
    let isBase64 = false;
    let decodedContent = null;

    if (isDataUrl) {
      // Check if base64 encoded
      const base64Match = url.match(/^data:[^,]*;base64,(.+)$/);
      if (base64Match && base64Match[1]) {
        isBase64 = true;
        try {
          // Use original atob if available, otherwise window.atob
          const atobFunc = (window.__js_unshroud_originals && window.__js_unshroud_originals.atob) || window.atob;
          decodedContent = atobFunc(base64Match[1]);
        } catch {
          decodedContent = '<decode_failed>';
        }
      } else {
        // Extract non-base64 data
        const dataMatch = url.match(/^data:[^,]*,(.+)$/);
        if (dataMatch && dataMatch[1]) {
          try {
            decodedContent = decodeURIComponent(dataMatch[1]);
          } catch {
            decodedContent = dataMatch[1];
          }
        }
      }
    }

    if (isBlobUrl) {
      // Look up blob content from blob map
      try {
        if (window.__js_unshroud_blob_map && window.__js_unshroud_blob_map[url]) {
          const blobInfo = window.__js_unshroud_blob_map[url];
          decodedContent = blobInfo.content;
        }
      } catch {
        // Blob map might not be available yet
        decodedContent = null;
      }
    }

    return {
      isDataUrl: isDataUrl,
      isBlobUrl: isBlobUrl,
      isBase64: isBase64,
      decodedContent: decodedContent
    };
  };

  // Instrument addEventListener
  if (originals.addEventListener) {
    const originalAddEventListener = originals.addEventListener;

    window.EventTarget.prototype.addEventListener = function(type, listener, options) {
      const listenerStr = getListenerString(listener);
      const targetSelector = getElementSelector(this);

      // Check if we should log addEventListener (always true per filtering logic)
      if (shouldLogDomEvent(type, 'addEventListener')) {
        logEvent({
          type: 'dom',
          eventType: type,
          targetSelector: targetSelector,
          operation: 'addEventListener',
          listener: listenerStr,
          options: options,
          timestamp: Date.now()
        });
      }

      // Create wrapped listener that logs when event fires
      const wrappedListener = function(event) {
        // Check if we should log eventFired (filtered by category)
        if (shouldLogDomEvent(type, 'eventFired')) {
          logEvent({
            type: 'dom',
            eventType: type,
            targetSelector: targetSelector,
            operation: 'eventFired',
            bubble: event.bubbles,
            cancelable: event.cancelable,
            defaultPrevented: event.defaultPrevented,
            composed: event.composed,
            eventPhase: event.eventPhase === 1 ? 'capture' : event.eventPhase === 2 ? 'target' : event.eventPhase === 3 ? 'bubble' : 'unknown',
            timestamp: Date.now()
          });
        }

        // Call original listener
        return listener.apply(this, arguments);
      };

      // Store reference for removal tracking
      if (!this.__js_unshroud_listeners) {
        this.__js_unshroud_listeners = new Map();
      }
      const key = type + '_' + listener.toString().substring(0, 50);
      this.__js_unshroud_listeners.set(key, { original: listener, wrapped: wrappedListener });

      return originalAddEventListener.call(this, type, wrappedListener, options);
    };
  }

  // Instrument removeEventListener
  if (originals.removeEventListener) {
    const originalRemoveEventListener = originals.removeEventListener;

    window.EventTarget.prototype.removeEventListener = function(type, listener, options) {
      const targetSelector = getElementSelector(this);

      // Check if we should log removeEventListener (always false per filtering logic)
      if (shouldLogDomEvent(type, 'removeEventListener')) {
        logEvent({
          type: 'dom',
          eventType: type,
          targetSelector: targetSelector,
          operation: 'removeEventListener',
          timestamp: Date.now()
        });
      }

      // Try to find and remove from our tracking
      if (this.__js_unshroud_listeners) {
        const key = type + '_' + listener.toString().substring(0, 50);
        const stored = this.__js_unshroud_listeners.get(key);
        if (stored) {
          this.__js_unshroud_listeners.delete(key);
          return originalRemoveEventListener.call(this, type, stored.wrapped, options);
        }
      }

      return originalRemoveEventListener.apply(this, arguments);
    };
  }

  // Instrument DOM mutation methods with script detection
  const mutationMethods = [
    { name: 'appendChild', method: originals.appendChild },
    { name: 'insertBefore', method: originals.insertBefore },
    { name: 'removeChild', method: originals.removeChild },
    { name: 'replaceChild', method: originals.replaceChild }
  ];

  mutationMethods.forEach(({ name, method }) => {
    if (method) {
      const originalMethod = method;

      window.Node.prototype[name] = function() {
        const targetSelector = getElementSelector(this);
        let addedSelector = '';
        let removedSelector = '';
        let addedNode = null;

        // Get selectors for added/removed nodes
        if (arguments[0] && arguments[0].nodeType) {
          addedNode = arguments[0];
          addedSelector = getElementSelector(addedNode);
        }
        if (name === 'removeChild' && arguments[0]) {
          removedSelector = getElementSelector(arguments[0]);
        }
        if (name === 'replaceChild' && arguments[1]) {
          removedSelector = getElementSelector(arguments[1]);
        }

        // Check if appending/inserting a script element
        if ((name === 'appendChild' || name === 'insertBefore') && addedNode) {
          if (addedNode.tagName && addedNode.tagName.toLowerCase() === 'script') {
            const scriptSrc = addedNode.src || '';
            const scriptContent = addedNode.textContent || addedNode.innerHTML || '';

            // Log script injection if there's src or content
            if (scriptSrc || scriptContent) {
              const urlAnalysis = scriptSrc ? analyzeScriptUrl(scriptSrc) : { isDataUrl: false, isBlobUrl: false, decodedContent: null };

              logEvent({
                type: 'script_injection',
                method: name,
                targetSelector: targetSelector,
                scriptSrc: scriptSrc || undefined,
                scriptContent: scriptContent || undefined,
                isDataUrl: urlAnalysis.isDataUrl,
                isBlobUrl: urlAnalysis.isBlobUrl,
                decodedContent: urlAnalysis.decodedContent,
                timestamp: Date.now()
              });
            }
          }
        }

        // Always log basic DOM mutation (subject to filtering)
        if (shouldLogDomEvent(null, name)) {
          logEvent({
            type: 'dom',
            eventType: name,
            operation: name,
            targetSelector: targetSelector,
            addedNode: addedSelector,
            removedNode: removedSelector,
            timestamp: Date.now()
          });
        }

        return originalMethod.apply(this, arguments);
      };
    }
  });

  // Instrument innerHTML setter with script injection detection
  if (originals.innerHTML && originals.innerHTML.set) {
    const originalSetter = originals.innerHTML.set;

    Object.defineProperty(window.Element.prototype, 'innerHTML', {
      get: originals.innerHTML.get,
      set: function(value) {
        const targetSelector = getElementSelector(this);
        const htmlContent = value ? String(value) : '';

        // Analyze HTML content for script injection
        const scriptAnalysis = analyzeScriptTags(htmlContent);
        const handlerAnalysis = analyzeEventHandlers(htmlContent);

        // If scripts or event handlers detected, log as script_injection
        if (scriptAnalysis.containsScript || handlerAnalysis.containsHandlers) {
          logEvent({
            type: 'script_injection',
            method: 'innerHTML',
            targetSelector: targetSelector,
            htmlContent: htmlContent,
            htmlLength: htmlContent.length,
            containsScriptTag: scriptAnalysis.containsScript,
            scriptTagCount: scriptAnalysis.scriptCount,
            scriptSources: scriptAnalysis.sources,
            containsEventHandlers: handlerAnalysis.containsHandlers,
            eventHandlerTypes: handlerAnalysis.handlerTypes,
            timestamp: Date.now()
          });
        } else {
          // Basic DOM event for non-injection innerHTML (subject to filtering)
          if (shouldLogDomEvent(null, 'innerHTML')) {
            logEvent({
              type: 'dom',
              eventType: 'innerHTML',
              operation: 'innerHTML',
              targetSelector: targetSelector,
              valueLength: htmlContent.length,
              timestamp: Date.now()
            });
          }
        }

        originalSetter.call(this, value);
      }
    });
  }

  // Instrument outerHTML setter with script injection detection
  const outerHTMLDescriptor = Object.getOwnPropertyDescriptor(window.Element?.prototype, 'outerHTML');
  if (outerHTMLDescriptor && outerHTMLDescriptor.set) {
    const originalOuterHTMLSetter = outerHTMLDescriptor.set;

    Object.defineProperty(window.Element.prototype, 'outerHTML', {
      get: outerHTMLDescriptor.get,
      set: function(value) {
        const targetSelector = getElementSelector(this);
        const htmlContent = value ? String(value) : '';

        // Analyze HTML content for script injection
        const scriptAnalysis = analyzeScriptTags(htmlContent);
        const handlerAnalysis = analyzeEventHandlers(htmlContent);

        // If scripts or event handlers detected, log as script_injection
        if (scriptAnalysis.containsScript || handlerAnalysis.containsHandlers) {
          logEvent({
            type: 'script_injection',
            method: 'outerHTML',
            targetSelector: targetSelector,
            htmlContent: htmlContent,
            htmlLength: htmlContent.length,
            containsScriptTag: scriptAnalysis.containsScript,
            scriptTagCount: scriptAnalysis.scriptCount,
            scriptSources: scriptAnalysis.sources,
            containsEventHandlers: handlerAnalysis.containsHandlers,
            eventHandlerTypes: handlerAnalysis.handlerTypes,
            timestamp: Date.now()
          });
        } else {
          // Basic DOM event for non-injection outerHTML (subject to filtering)
          if (shouldLogDomEvent(null, 'outerHTML')) {
            logEvent({
              type: 'dom',
              eventType: 'outerHTML',
              operation: 'outerHTML',
              targetSelector: targetSelector,
              valueLength: htmlContent.length,
              timestamp: Date.now()
            });
          }
        }

        originalOuterHTMLSetter.call(this, value);
      }
    });
  }

  // Instrument insertAdjacentHTML
  const originalInsertAdjacentHTML = window.Element.prototype.insertAdjacentHTML;
  if (originalInsertAdjacentHTML) {
    window.Element.prototype.insertAdjacentHTML = function(position, html) {
      const targetSelector = getElementSelector(this);
      const htmlContent = html ? String(html) : '';

      // Analyze HTML content for script injection
      const scriptAnalysis = analyzeScriptTags(htmlContent);
      const handlerAnalysis = analyzeEventHandlers(htmlContent);

      // If scripts or event handlers detected, log as script_injection
      if (scriptAnalysis.containsScript || handlerAnalysis.containsHandlers) {
        logEvent({
          type: 'script_injection',
          method: 'insertAdjacentHTML',
          targetSelector: targetSelector,
          htmlContent: htmlContent,
          htmlLength: htmlContent.length,
          containsScriptTag: scriptAnalysis.containsScript,
          scriptTagCount: scriptAnalysis.scriptCount,
          scriptSources: scriptAnalysis.sources,
          containsEventHandlers: handlerAnalysis.containsHandlers,
          eventHandlerTypes: handlerAnalysis.handlerTypes,
          timestamp: Date.now()
        });
      } else {
        // Basic DOM event for non-injection insertAdjacentHTML (subject to filtering)
        if (shouldLogDomEvent(null, 'insertAdjacentHTML')) {
          logEvent({
            type: 'dom',
            eventType: 'insertAdjacentHTML',
            operation: 'insertAdjacentHTML',
            targetSelector: targetSelector,
            valueLength: htmlContent.length,
            timestamp: Date.now()
          });
        }
      }

      return originalInsertAdjacentHTML.call(this, position, html);
    };
  }

  // Instrument document.write and document.writeln
  const originalDocumentWrite = window.document.write;
  const originalDocumentWriteln = window.document.writeln;

  if (originalDocumentWrite) {
    window.document.write = function(html) {
      const htmlContent = html ? String(html) : '';

      // Analyze HTML content
      const scriptAnalysis = analyzeScriptTags(htmlContent);
      const handlerAnalysis = analyzeEventHandlers(htmlContent);

      // document.write is always suspicious for script injection
      logEvent({
        type: 'script_injection',
        method: 'document.write',
        htmlContent: htmlContent,
        htmlLength: htmlContent.length,
        containsScriptTag: scriptAnalysis.containsScript,
        scriptTagCount: scriptAnalysis.scriptCount,
        scriptSources: scriptAnalysis.sources,
        containsEventHandlers: handlerAnalysis.containsHandlers,
        eventHandlerTypes: handlerAnalysis.handlerTypes,
        timestamp: Date.now()
      });

      return originalDocumentWrite.apply(this, arguments);
    };
  }

  if (originalDocumentWriteln) {
    window.document.writeln = function(html) {
      const htmlContent = html ? String(html) : '';

      // Analyze HTML content
      const scriptAnalysis = analyzeScriptTags(htmlContent);
      const handlerAnalysis = analyzeEventHandlers(htmlContent);

      // document.writeln is always suspicious for script injection
      logEvent({
        type: 'script_injection',
        method: 'document.writeln',
        htmlContent: htmlContent,
        htmlLength: htmlContent.length,
        containsScriptTag: scriptAnalysis.containsScript,
        scriptTagCount: scriptAnalysis.scriptCount,
        scriptSources: scriptAnalysis.sources,
        containsEventHandlers: handlerAnalysis.containsHandlers,
        eventHandlerTypes: handlerAnalysis.handlerTypes,
        timestamp: Date.now()
      });

      return originalDocumentWriteln.apply(this, arguments);
    };
  }

  // Instrument setAttribute for event handler detection
  const originalSetAttribute = window.Element.prototype.setAttribute;
  if (originalSetAttribute) {
    window.Element.prototype.setAttribute = function(name, value) {
      const targetSelector = getElementSelector(this);
      const attrName = name ? String(name).toLowerCase() : '';
      const attrValue = value ? String(value) : '';

      // Check if setting an event handler attribute (on*)
      if (attrName && attrName.startsWith('on')) {
        logEvent({
          type: 'script_injection',
          method: 'setAttribute',
          targetSelector: targetSelector,
          attributeName: attrName,
          attributeValue: attrValue,
          timestamp: Date.now()
        });
      }

      return originalSetAttribute.call(this, name, value);
    };
  }

  // Instrument document.createElement to track script element creation
  const originalCreateElement = window.document.createElement;
  if (originalCreateElement) {
    window.document.createElement = function(tagName, options) {
      const element = originalCreateElement.call(this, tagName, options);

      // If creating a script element, instrument its properties
      if (tagName && tagName.toLowerCase() === 'script') {
        const scriptElement = element;

        // Track script.src property
        const originalSrcDescriptor = Object.getOwnPropertyDescriptor(window.HTMLScriptElement.prototype, 'src');
        if (originalSrcDescriptor && originalSrcDescriptor.set) {
          const originalSrcSetter = originalSrcDescriptor.set;

          Object.defineProperty(scriptElement, 'src', {
            get: function() {
              return originalSrcDescriptor.get.call(this);
            },
            set: function(value) {
              const url = value ? String(value) : '';
              const urlAnalysis = analyzeScriptUrl(url);

              logEvent({
                type: 'script_injection',
                method: 'script.src',
                scriptSrc: url,
                isDataUrl: urlAnalysis.isDataUrl,
                isBlobUrl: urlAnalysis.isBlobUrl,
                decodedContent: urlAnalysis.decodedContent,
                timestamp: Date.now()
              });

              originalSrcSetter.call(this, value);
            },
            configurable: true,
            enumerable: true
          });
        }

        // Track script.textContent property
        const originalTextContentDescriptor = Object.getOwnPropertyDescriptor(window.Node.prototype, 'textContent');
        if (originalTextContentDescriptor && originalTextContentDescriptor.set) {
          const originalTextContentSetter = originalTextContentDescriptor.set;

          Object.defineProperty(scriptElement, 'textContent', {
            get: function() {
              return originalTextContentDescriptor.get.call(this);
            },
            set: function(value) {
              const scriptContent = value ? String(value) : '';

              if (scriptContent) {
                logEvent({
                  type: 'script_injection',
                  method: 'script.textContent',
                  scriptContent: scriptContent,
                  timestamp: Date.now()
                });
              }

              originalTextContentSetter.call(this, value);
            },
            configurable: true,
            enumerable: true
          });
        }

        // Track script.innerHTML property (alternative to textContent)
        const scriptInnerHTMLDescriptor = Object.getOwnPropertyDescriptor(window.Element.prototype, 'innerHTML');
        if (scriptInnerHTMLDescriptor && scriptInnerHTMLDescriptor.set) {
          const originalScriptInnerHTMLSetter = scriptInnerHTMLDescriptor.set;

          Object.defineProperty(scriptElement, 'innerHTML', {
            get: function() {
              return scriptInnerHTMLDescriptor.get.call(this);
            },
            set: function(value) {
              const scriptContent = value ? String(value) : '';

              if (scriptContent) {
                logEvent({
                  type: 'script_injection',
                  method: 'script.innerHTML',
                  scriptContent: scriptContent,
                  timestamp: Date.now()
                });
              }

              originalScriptInnerHTMLSetter.call(this, value);
            },
            configurable: true,
            enumerable: true
          });
        }
      }

      return element;
    };
  }

  window.__js_unshroud_debug('[JS Unshroud] DOM hooks loaded');
})();
