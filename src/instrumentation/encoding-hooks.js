// Encoding/Decoding Instrumentation - atob, btoa, fromCharCode, URI encoding, etc.
(function() {
  'use strict';

  // Check if encoding monitoring is enabled
  if (!window.__js_unshroud_config || !window.__js_unshroud_config.enableEncoding) {
    return;
  }

  // Get originals from bootstrap or fallback to window
  const originals = window.__js_unshroud_originals || {};
  const originalAtob = originals.atob || window.atob;
  const originalBtoa = originals.btoa || window.btoa;
  const originalFromCharCode = originals.fromCharCode || String.fromCharCode;
  const originalFromCodePoint = originals.fromCodePoint || String.fromCodePoint;
  const originalDecodeURI = originals.decodeURI || window.decodeURI;
  const originalDecodeURIComponent = originals.decodeURIComponent || window.decodeURIComponent;
  const originalUnescape = originals.unescape || window.unescape;
  const originalEncodeURI = originals.encodeURI || window.encodeURI;
  const originalEncodeURIComponent = originals.encodeURIComponent || window.encodeURIComponent;
  const originalEscape = originals.escape || window.escape;

  // Get config values
  const config = window.__js_unshroud_config || {};
  const maxPayloadSize = config.maxPayloadSize || 2051;

  // Generate a simple event ID
  const generateEventId = function() {
    return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  // Get session ID from window
  const getSessionId = function() {
    return window.__js_unshroud_session_id || 'unknown_session';
  };

  // Truncate output to maxPayloadSize (captures first and last portions)
  const truncateOutput = function(output) {
    if (typeof output !== 'string') {
      return String(output);
    }
    if (output.length <= maxPayloadSize) {
      return output;
    }
    // Capture first 1024 + "..." + last 1024 chars (total 2051)
    const halfSize = 1024;
    const start = output.substring(0, halfSize);
    const end = output.substring(output.length - halfSize);
    return start + '...' + end;
  };

  // Log encoding event AFTER execution
  const logEncodingEvent = function(method, operation, output, outputLength, success, error) {
    if (typeof window.__js_unshroud_log === 'function') {
      window.__js_unshroud_log(JSON.stringify({
        id: generateEventId(),
        sessionId: getSessionId(),
        timestamp: Date.now(),
        type: 'encoding',
        method: method,
        operation: operation,
        output: truncateOutput(output || ''),
        outputLength: outputLength,
        success: success,
        error: error
      }));
    }
  };

  // ============================================================================
  // BASE64 DECODING/ENCODING
  // ============================================================================

  // atob - Base64 decode
  const wrappedAtob = function(encodedData) {
    let result, success = true, error;

    try {
      result = originalAtob.call(this, encodedData);
    } catch (err) {
      success = false;
      error = err.message;
      throw err;
    } finally {
      // Log AFTER execution - we need the decoded output for analysis
      logEncodingEvent('atob', 'decode', result, result ? result.length : 0, success, error);
    }

    return result;
  };

  // btoa - Base64 encode
  const wrappedBtoa = function(stringToEncode) {
    let result, success = true, error;

    try {
      result = originalBtoa.call(this, stringToEncode);
    } catch (err) {
      success = false;
      error = err.message;
      throw err;
    } finally {
      // Log AFTER execution - encoded output may be used for obfuscation
      logEncodingEvent('btoa', 'encode', result, result ? result.length : 0, success, error);
    }

    return result;
  };

  // Override global functions
  window.atob = wrappedAtob;
  window.btoa = wrappedBtoa;

  // ============================================================================
  // CHARACTER CODE CONVERSION
  // ============================================================================

  // String.fromCharCode - Convert character codes to string
  const wrappedFromCharCode = function() {
    let result, success = true, error;

    try {
      result = originalFromCharCode.apply(String, arguments);
    } catch (err) {
      success = false;
      error = err.message;
      throw err;
    } finally {
      // Log AFTER execution - decoded string is what matters
      logEncodingEvent('fromCharCode', 'decode', result, result ? result.length : 0, success, error);
    }

    return result;
  };

  // String.fromCodePoint - Convert code points to string
  const wrappedFromCodePoint = function() {
    let result, success = true, error;

    try {
      result = originalFromCodePoint.apply(String, arguments);
    } catch (err) {
      success = false;
      error = err.message;
      throw err;
    } finally {
      // Log AFTER execution - decoded string is what matters
      logEncodingEvent('fromCodePoint', 'decode', result, result ? result.length : 0, success, error);
    }

    return result;
  };

  // Override String methods
  String.fromCharCode = wrappedFromCharCode;
  String.fromCodePoint = wrappedFromCodePoint;

  // ============================================================================
  // URI DECODING
  // ============================================================================

  // decodeURI
  const wrappedDecodeURI = function(encodedURI) {
    let result, success = true, error;

    try {
      result = originalDecodeURI.call(this, encodedURI);
    } catch (err) {
      success = false;
      error = err.message;
      throw err;
    } finally {
      // Log AFTER execution - decoded URI is what matters
      logEncodingEvent('decodeURI', 'decode', result, result ? result.length : 0, success, error);
    }

    return result;
  };

  // decodeURIComponent
  const wrappedDecodeURIComponent = function(encodedURIComponent) {
    let result, success = true, error;

    try {
      result = originalDecodeURIComponent.call(this, encodedURIComponent);
    } catch (err) {
      success = false;
      error = err.message;
      throw err;
    } finally {
      // Log AFTER execution - decoded URI component is what matters
      logEncodingEvent('decodeURIComponent', 'decode', result, result ? result.length : 0, success, error);
    }

    return result;
  };

  // unescape (deprecated but still used in malware)
  const wrappedUnescape = function(string) {
    let result, success = true, error;

    try {
      result = originalUnescape.call(this, string);
    } catch (err) {
      success = false;
      error = err.message;
      throw err;
    } finally {
      // Log AFTER execution - unescaped string is what matters
      logEncodingEvent('unescape', 'decode', result, result ? result.length : 0, success, error);
    }

    return result;
  };

  // Override global functions
  window.decodeURI = wrappedDecodeURI;
  window.decodeURIComponent = wrappedDecodeURIComponent;
  if (window.unescape) {
    window.unescape = wrappedUnescape;
  }

  // ============================================================================
  // URI ENCODING
  // ============================================================================

  // encodeURI
  const wrappedEncodeURI = function(uri) {
    let result, success = true, error;

    try {
      result = originalEncodeURI.call(this, uri);
    } catch (err) {
      success = false;
      error = err.message;
      throw err;
    } finally {
      // Log AFTER execution - encoded URI may be used for obfuscation
      logEncodingEvent('encodeURI', 'encode', result, result ? result.length : 0, success, error);
    }

    return result;
  };

  // encodeURIComponent
  const wrappedEncodeURIComponent = function(uriComponent) {
    let result, success = true, error;

    try {
      result = originalEncodeURIComponent.call(this, uriComponent);
    } catch (err) {
      success = false;
      error = err.message;
      throw err;
    } finally {
      // Log AFTER execution - encoded URI component may be used for obfuscation
      logEncodingEvent('encodeURIComponent', 'encode', result, result ? result.length : 0, success, error);
    }

    return result;
  };

  // escape (deprecated but still used in malware)
  const wrappedEscape = function(string) {
    let result, success = true, error;

    try {
      result = originalEscape.call(this, string);
    } catch (err) {
      success = false;
      error = err.message;
      throw err;
    } finally {
      // Log AFTER execution - escaped string may be used for obfuscation
      logEncodingEvent('escape', 'encode', result, result ? result.length : 0, success, error);
    }

    return result;
  };

  // Override global functions
  window.encodeURI = wrappedEncodeURI;
  window.encodeURIComponent = wrappedEncodeURIComponent;
  if (window.escape) {
    window.escape = wrappedEscape;
  }

  console.log('[JS Unshroud] Encoding hooks loaded');
})();
