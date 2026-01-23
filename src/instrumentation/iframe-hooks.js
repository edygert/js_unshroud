// iframe Instrumentation - Track iframe creation and script execution
/* eslint-disable no-undef, no-setter-return */
(function() {
  'use strict';

  // Check if iframe monitoring is enabled
  if (!window.__js_unshroud_config || !window.__js_unshroud_config.enableIframes) {
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

  // Get stack trace
  const getStackTrace = function() {
    try {
      const stack = new Error().stack;
      if (stack) {
        const lines = stack.split('\n').slice(3); // Skip first 3 lines
        return lines.join('\n');
      }
    } catch {
      // Ignore errors
    }
    return undefined;
  };

  // Truncate content to maxPayloadSize
  const truncateContent = function(content) {
    const maxSize = (window.__js_unshroud_config && window.__js_unshroud_config.maxPayloadSize) || 2051;
    if (typeof content !== 'string') {
      return String(content);
    }
    if (content.length <= maxSize) {
      return content;
    }
    // Capture first 1024 + "..." + last 1024 chars
    const halfSize = 1024;
    const start = content.substring(0, halfSize);
    const end = content.substring(content.length - halfSize);
    return start + '...' + end;
  };

  // Get CSS selector for element
  const getElementSelector = function(element) {
    try {
      if (element.id) {
        return 'iframe#' + element.id;
      }
      if (element.className && typeof element.className === 'string') {
        const classes = element.className.trim().split(/\s+/).join('.');
        if (classes) {
          return 'iframe.' + classes;
        }
      }
      return 'iframe';
    } catch {
      return 'iframe';
    }
  };

  // Extract scripts from HTML content
  const extractScripts = function(html) {
    const scripts = [];
    try {
      // Simple regex-based script extraction
      const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
      let match;
      while ((match = scriptRegex.exec(html)) !== null) {
        const scriptContent = match[1];
        if (scriptContent && scriptContent.trim()) {
          scripts.push(truncateContent(scriptContent.trim()));
        }
      }
    } catch {
      // Ignore errors in script extraction
    }
    return scripts;
  };

  // Log iframe event
  const logIframeEvent = function(eventType, src, srcdoc, scriptCount, scripts, code, element) {
    if (typeof window.__js_unshroud_log === 'function') {
      const event = {
        id: generateEventId(),
        sessionId: getSessionId(),
        timestamp: Date.now(),
        type: 'iframe',
        eventType: eventType,
        src: src,
        srcdoc: srcdoc ? truncateContent(srcdoc) : undefined,
        scriptCount: scriptCount,
        scripts: scripts,
        code: code,
        element: element,
        stackTrace: getStackTrace()
      };

      window.__js_unshroud_log(JSON.stringify(event));

      // Save artifact if artifact collection is enabled and we have srcdoc content
      if (srcdoc && window.__js_unshroud_config && window.__js_unshroud_config.enableArtifactCollection) {
        if (typeof window.__js_unshroud_save_artifact === 'function') {
          window.__js_unshroud_save_artifact({
            event: event,
            type: 'iframe',
            content: srcdoc,  // Full srcdoc HTML, not truncated
            extension: 'html',
            mimeType: 'text/html'
          });
        }
      }
    }
  };

  // Helper to check if element is an iframe
  const isIframe = function(element) {
    return element &&
           element.tagName &&
           element.tagName.toLowerCase() === 'iframe';
  };

  // ============================================================================
  // HOOK appendChild - Detect iframe creation
  // ============================================================================

  if (Node.prototype.appendChild) {
    const originalAppendChild = Node.prototype.appendChild;

    Node.prototype.appendChild = function(child) {
      const result = originalAppendChild.call(this, child);

      try {
        if (isIframe(child)) {
          const src = child.getAttribute('src');
          const srcdoc = child.getAttribute('srcdoc');
          const element = getElementSelector(child);

          let scriptCount = 0;
          let scripts = [];

          if (srcdoc) {
            scripts = extractScripts(srcdoc);
            scriptCount = scripts.length;
          }

          logIframeEvent(
            'iframe_create',
            src,
            srcdoc,
            scriptCount,
            scripts.length > 0 ? scripts : undefined,
            undefined,
            element
          );
        }
      } catch (error) {
        // Don't break appendChild if logging fails
        window.__js_unshroud_debug('[JS Unshroud] Error tracking iframe:', error);
      }

      return result;
    };
  }

  // ============================================================================
  // HOOK insertBefore - Detect iframe creation
  // ============================================================================

  if (Node.prototype.insertBefore) {
    const originalInsertBefore = Node.prototype.insertBefore;

    Node.prototype.insertBefore = function(newNode, referenceNode) {
      const result = originalInsertBefore.call(this, newNode, referenceNode);

      try {
        if (isIframe(newNode)) {
          const src = newNode.getAttribute('src');
          const srcdoc = newNode.getAttribute('srcdoc');
          const element = getElementSelector(newNode);

          let scriptCount = 0;
          let scripts = [];

          if (srcdoc) {
            scripts = extractScripts(srcdoc);
            scriptCount = scripts.length;
          }

          logIframeEvent(
            'iframe_create',
            src,
            srcdoc,
            scriptCount,
            scripts.length > 0 ? scripts : undefined,
            undefined,
            element
          );
        }
      } catch (error) {
        // Don't break insertBefore if logging fails
        window.__js_unshroud_debug('[JS Unshroud] Error tracking iframe:', error);
      }

      return result;
    };
  }

  // ============================================================================
  // HOOK iframe.srcdoc setter
  // ============================================================================

  const hookIframeSrcdocSetter = function(iframe) {
    try {
      // Get the property descriptor for srcdoc
      let descriptor = Object.getOwnPropertyDescriptor(iframe, 'srcdoc');
      if (!descriptor) {
        // Try to get it from the prototype
        descriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'srcdoc');
      }

      if (descriptor && descriptor.configurable) {
        const originalSetter = descriptor.set;

        if (originalSetter) {
          Object.defineProperty(iframe, 'srcdoc', {
            get: descriptor.get,
            set: function(value) {
              try {
                const element = getElementSelector(iframe);
                const scripts = extractScripts(value);
                const scriptCount = scripts.length;

                logIframeEvent(
                  'iframe_srcdoc_set',
                  undefined,
                  value,
                  scriptCount,
                  scripts.length > 0 ? scripts : undefined,
                  undefined,
                  element
                );
              } catch {
                // Don't break setter if logging fails
              }

              return originalSetter.call(this, value);
            },
            configurable: true,
            enumerable: descriptor.enumerable
          });
        }
      }
    } catch {
      // Silently fail if we can't hook the setter
    }
  };

  // Monitor for newly created iframes and hook their srcdoc setter
  if (window.MutationObserver) {
    const observer = new MutationObserver(function(mutations) {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (isIframe(node)) {
            hookIframeSrcdocSetter(node);
          }
        }
      }
    });

    // Start observing
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      // Body not ready yet, wait for DOMContentLoaded
      document.addEventListener('DOMContentLoaded', function() {
        if (document.body) {
          observer.observe(document.body, { childList: true, subtree: true });
        }
      });
    }

    // Also hook existing iframes
    document.addEventListener('DOMContentLoaded', function() {
      const iframes = document.getElementsByTagName('iframe');
      for (let i = 0; i < iframes.length; i++) {
        hookIframeSrcdocSetter(iframes[i]);
      }
    });
  }

  window.__js_unshroud_debug('[JS Unshroud] Iframe hooks loaded');
})();
