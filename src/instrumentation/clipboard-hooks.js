// Clipboard Instrumentation - Monitor clipboard operations for ClickFix attack detection
(function() {
  'use strict';

  // Check if clipboard monitoring is enabled
  if (!window.__js_unshroud_config || !window.__js_unshroud_config.enableClipboard) {
    return;
  }

  // Get originals from bootstrap or fallback to window
  const originals = window.__js_unshroud_originals || {};
  const originalExecCommand = originals.execCommand || (document.execCommand ? document.execCommand.bind(document) : null);

  // Get config values
  const config = window.__js_unshroud_config || {};
  const maxPayloadSize = config.maxPayloadSize || 2051;
  const patternDetectionEnabled = config.clipboardPatternDetection !== false; // Default: true

  // Generate a simple event ID
  const generateEventId = function() {
    return (window.__js_unshroud && window.__js_unshroud.newEventId)
      ? window.__js_unshroud.newEventId()
      : 'evt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 11);
  };

  // Get session ID from window
  const getSessionId = function() {
    return window.__js_unshroud_session_id || 'unknown_session';
  };

  // Truncate data to maxPayloadSize
  const truncateData = function(data) {
    if (typeof data !== 'string') {
      return String(data);
    }
    if (data.length <= maxPayloadSize) {
      return data;
    }
    // Capture first 1024 + "..." + last 1024 chars (total 2051)
    const halfSize = 1024;
    const start = data.substring(0, halfSize);
    const end = data.substring(data.length - halfSize);
    return start + '...' + end;
  };

  // Get stack trace
  const getStackTrace = function() {
    try {
      const err = new Error();
      const stack = err.stack || '';
      return stack.split('\n').slice(2, 10).join('\n'); // Skip first 2 lines
    } catch {
      return '';
    }
  };

  // === MALICIOUS PATTERN DETECTION (P6 Phase 2) ===

  const SUSPICIOUS_PATTERNS = {
    powershell: /powershell|pwsh|iex|invoke-expression|downloadstring|start-process|new-object\s+net\.webclient/i,
    mshta: /mshta|vbscript:|wscript|cscript/i,
    base64: /frombase64string|-enc|-encodedcommand/i,
    obfuscation: /[a-z0-9]{100,}/i,  // Long random strings (likely obfuscated)
    runDialog: /cmd\.exe|rundll32|regsvr32|certutil|bitsadmin/i
  };

  function detectSuspiciousPatterns(data) {
    if (!patternDetectionEnabled || typeof data !== 'string') {
      return {
        suspiciousPatterns: [],
        containsPowerShell: false,
        containsMSHTA: false,
        isBase64Encoded: false
      };
    }

    const patterns = [];
    let containsPowerShell = false;
    let containsMSHTA = false;
    let isBase64Encoded = false;

    if (SUSPICIOUS_PATTERNS.powershell.test(data)) {
      patterns.push('powershell');
      containsPowerShell = true;
    }

    if (SUSPICIOUS_PATTERNS.mshta.test(data)) {
      patterns.push('mshta');
      containsMSHTA = true;
    }

    if (SUSPICIOUS_PATTERNS.base64.test(data)) {
      patterns.push('base64');
      isBase64Encoded = true;
    }

    if (SUSPICIOUS_PATTERNS.obfuscation.test(data)) {
      patterns.push('obfuscation');
    }

    if (SUSPICIOUS_PATTERNS.runDialog.test(data)) {
      patterns.push('run_dialog');
    }

    return {
      suspiciousPatterns: patterns.length > 0 ? patterns : undefined,
      containsPowerShell,
      containsMSHTA,
      isBase64Encoded
    };
  }

  // === CLIPBOARD EVENT FILTERING (P6 Phase 3) ===

  function shouldLogClipboardEvent(operation) {
    const config = window.__js_unshroud_config;
    if (!config || !config.eventFiltering || !config.eventFiltering.clipboard) {
      return true; // No filtering config, log everything
    }

    const clipboardConfig = config.eventFiltering.clipboard;

    // Read operations (readText, read)
    if (operation === 'readText' || operation === 'read') {
      return clipboardConfig.enableReadOperations === true;
    }

    // Write operations (writeText, write, execCommand with copy/cut)
    if (operation === 'writeText' || operation === 'write') {
      return clipboardConfig.enableWriteOperations !== false; // Default: true
    }

    // execCommand operations
    if (operation === 'execCommand') {
      // For execCommand, we check enableWriteOperations for copy/cut
      return clipboardConfig.enableWriteOperations !== false; // Default: true
    }

    return true; // Log unknown operations
  }

  const logEvent = function(event) {
    if (window.__js_unshroud_log) {
      const enrichedEvent = {
        id: generateEventId(),
        sessionId: getSessionId(),
        timestamp: Date.now(),
        ...event
      };
      window.__js_unshroud_log(JSON.stringify(enrichedEvent));
    }
  };

  // === HOOK: navigator.clipboard.writeText() ===
  // Primary ClickFix attack vector - writes text to clipboard

  if (navigator.clipboard && navigator.clipboard.writeText) {
    const originalWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);

    navigator.clipboard.writeText = function(text) {
      const operation = 'writeText';

      if (shouldLogClipboardEvent(operation)) {
        const textStr = String(text);
        const patterns = detectSuspiciousPatterns(textStr);

        const event = {
          type: 'clipboard',
          operation: operation,
          method: 'navigator.clipboard.writeText',
          data: truncateData(textStr),
          dataLength: textStr.length,
          success: true, // Will update on error
          stackTrace: getStackTrace(),
          ...patterns
        };

        logEvent(event);

        // Save artifact if artifact collection is enabled
        if (window.__js_unshroud_config && window.__js_unshroud_config.enableArtifactCollection) {
          if (typeof window.__js_unshroud_save_artifact === 'function') {
            window.__js_unshroud_save_artifact({
              event: event,
              type: 'clipboard',
              content: textStr,  // Full clipboard text, not truncated
              extension: 'txt',
              mimeType: 'text/plain'
            });
          }
        }
      }

      // Call original and handle promise
      return originalWriteText(text).catch(function(error) {
        if (shouldLogClipboardEvent(operation)) {
          logEvent({
            type: 'clipboard',
            operation: operation,
            method: 'navigator.clipboard.writeText',
            data: truncateData(String(text)),
            dataLength: String(text).length,
            success: false,
            error: String(error),
            stackTrace: getStackTrace()
          });
        }
        throw error;
      });
    };
  }

  // === HOOK: navigator.clipboard.write() ===
  // Rich clipboard data (images, HTML, etc.)

  if (navigator.clipboard && navigator.clipboard.write) {
    const originalWrite = navigator.clipboard.write.bind(navigator.clipboard);

    navigator.clipboard.write = function(data) {
      const operation = 'write';

      if (shouldLogClipboardEvent(operation)) {
        // Try to extract text data from ClipboardItem
        const textContent = '<rich_data>';
        let dataType = 'unknown';

        try {
          if (data && data.length > 0 && data[0].types) {
            dataType = data[0].types.join(', ');
          }
        } catch {
          // Ignore
        }

        logEvent({
          type: 'clipboard',
          operation: operation,
          method: 'navigator.clipboard.write',
          data: textContent,
          dataLength: textContent.length,
          dataType: dataType,
          success: true,
          stackTrace: getStackTrace()
        });
      }

      return originalWrite(data).catch(function(error) {
        if (shouldLogClipboardEvent(operation)) {
          logEvent({
            type: 'clipboard',
            operation: operation,
            method: 'navigator.clipboard.write',
            success: false,
            error: String(error),
            stackTrace: getStackTrace()
          });
        }
        throw error;
      });
    };
  }

  // === HOOK: navigator.clipboard.readText() ===
  // Read clipboard text

  if (navigator.clipboard && navigator.clipboard.readText) {
    const originalReadText = navigator.clipboard.readText.bind(navigator.clipboard);

    navigator.clipboard.readText = function() {
      const operation = 'readText';

      return originalReadText().then(function(text) {
        if (shouldLogClipboardEvent(operation)) {
          logEvent({
            type: 'clipboard',
            operation: operation,
            method: 'navigator.clipboard.readText',
            data: truncateData(text),
            dataLength: text.length,
            success: true,
            stackTrace: getStackTrace()
          });
        }
        return text;
      }).catch(function(error) {
        if (shouldLogClipboardEvent(operation)) {
          logEvent({
            type: 'clipboard',
            operation: operation,
            method: 'navigator.clipboard.readText',
            success: false,
            error: String(error),
            stackTrace: getStackTrace()
          });
        }
        throw error;
      });
    };
  }

  // === HOOK: navigator.clipboard.read() ===
  // Read rich clipboard data

  if (navigator.clipboard && navigator.clipboard.read) {
    const originalRead = navigator.clipboard.read.bind(navigator.clipboard);

    navigator.clipboard.read = function() {
      const operation = 'read';

      return originalRead().then(function(clipboardItems) {
        if (shouldLogClipboardEvent(operation)) {
          let dataType = 'unknown';
          try {
            if (clipboardItems && clipboardItems.length > 0 && clipboardItems[0].types) {
              dataType = clipboardItems[0].types.join(', ');
            }
          } catch {
            // Ignore
          }

          logEvent({
            type: 'clipboard',
            operation: operation,
            method: 'navigator.clipboard.read',
            dataType: dataType,
            success: true,
            stackTrace: getStackTrace()
          });
        }
        return clipboardItems;
      }).catch(function(error) {
        if (shouldLogClipboardEvent(operation)) {
          logEvent({
            type: 'clipboard',
            operation: operation,
            method: 'navigator.clipboard.read',
            success: false,
            error: String(error),
            stackTrace: getStackTrace()
          });
        }
        throw error;
      });
    };
  }

  // === HOOK: document.execCommand() ===
  // Legacy clipboard API (copy, cut, paste)

  if (originalExecCommand && document.execCommand) {
    document.execCommand = function(command) {
      const operation = 'execCommand';

      // Only log clipboard-related commands
      if ((command === 'copy' || command === 'cut' || command === 'paste') &&
          shouldLogClipboardEvent(operation)) {

        // Try to get selected text for copy/cut operations
        let selectedText = '';
        if (command === 'copy' || command === 'cut') {
          try {
            const selection = window.getSelection();
            selectedText = selection ? selection.toString() : '';
          } catch {
            // Ignore
          }
        }

        const patterns = (command === 'copy' || command === 'cut') ?
          detectSuspiciousPatterns(selectedText) : {};

        logEvent({
          type: 'clipboard',
          operation: operation,
          method: 'document.execCommand',
          command: command,
          data: selectedText ? truncateData(selectedText) : undefined,
          dataLength: selectedText.length,
          success: true, // Will be updated based on return value
          stackTrace: getStackTrace(),
          ...patterns
        });
      }

      // Call original
      const args = Array.prototype.slice.call(arguments);
      const result = originalExecCommand.apply(document, args);

      // Log failure if command didn't execute
      if ((command === 'copy' || command === 'cut' || command === 'paste') &&
          !result && shouldLogClipboardEvent(operation)) {
        logEvent({
          type: 'clipboard',
          operation: operation,
          method: 'document.execCommand',
          command: command,
          success: false,
          error: 'execCommand returned false',
          stackTrace: getStackTrace()
        });
      }

      return result;
    };
  }

  // Log successful initialization (debug-gated so it never leaks into the page console)
  window.__js_unshroud_debug('[JS Unshroud] Clipboard hooks installed (ClickFix detection enabled)');

})();
