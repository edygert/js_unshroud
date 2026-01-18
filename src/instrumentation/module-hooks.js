// ES Module Script Detection - Track <script type="module"> injection
/* eslint-disable no-undef */
(function() {
  'use strict';

  // Check if module monitoring is enabled
  if (!window.__js_unshroud_config || !window.__js_unshroud_config.enableModules) {
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

  // Log module event
  const logModuleEvent = function(src, content, isInline) {
    if (typeof window.__js_unshroud_log === 'function') {
      window.__js_unshroud_log(JSON.stringify({
        id: generateEventId(),
        sessionId: getSessionId(),
        timestamp: Date.now(),
        type: 'module',
        eventType: 'module_script_inject',
        src: src,
        content: truncateContent(content || ''),
        isInline: isInline,
        stackTrace: getStackTrace()
      }));
    }
  };

  // Helper to check if element is a module script
  const isModuleScript = function(element) {
    return element &&
           element.tagName &&
           element.tagName.toLowerCase() === 'script' &&
           element.getAttribute('type') === 'module';
  };

  // Helper to extract script content
  const getScriptContent = function(scriptElement) {
    try {
      return scriptElement.textContent || scriptElement.innerHTML || '';
    } catch {
      return '';
    }
  };

  // ============================================================================
  // HOOK appendChild
  // ============================================================================

  if (Node.prototype.appendChild) {
    const originalAppendChild = Node.prototype.appendChild;

    Node.prototype.appendChild = function(child) {
      const result = originalAppendChild.call(this, child);

      try {
        if (isModuleScript(child)) {
          const src = child.getAttribute('src');
          const content = src ? null : getScriptContent(child);
          const isInline = !src;

          logModuleEvent(src, content, isInline);
        }
      } catch (error) {
        // Don't break appendChild if logging fails
        console.warn('[JS Unshroud] Error tracking module script:', error);
      }

      return result;
    };
  }

  // ============================================================================
  // HOOK insertBefore
  // ============================================================================

  if (Node.prototype.insertBefore) {
    const originalInsertBefore = Node.prototype.insertBefore;

    Node.prototype.insertBefore = function(newNode, referenceNode) {
      const result = originalInsertBefore.call(this, newNode, referenceNode);

      try {
        if (isModuleScript(newNode)) {
          const src = newNode.getAttribute('src');
          const content = src ? null : getScriptContent(newNode);
          const isInline = !src;

          logModuleEvent(src, content, isInline);
        }
      } catch (error) {
        // Don't break insertBefore if logging fails
        console.warn('[JS Unshroud] Error tracking module script:', error);
      }

      return result;
    };
  }

  // ============================================================================
  // HOOK replaceChild (for completeness)
  // ============================================================================

  if (Node.prototype.replaceChild) {
    const originalReplaceChild = Node.prototype.replaceChild;

    Node.prototype.replaceChild = function(newChild, oldChild) {
      const result = originalReplaceChild.call(this, newChild, oldChild);

      try {
        if (isModuleScript(newChild)) {
          const src = newChild.getAttribute('src');
          const content = src ? null : getScriptContent(newChild);
          const isInline = !src;

          logModuleEvent(src, content, isInline);
        }
      } catch (error) {
        // Don't break replaceChild if logging fails
        console.warn('[JS Unshroud] Error tracking module script:', error);
      }

      return result;
    };
  }

  console.log('[JS Unshroud] Module hooks loaded');
})();
