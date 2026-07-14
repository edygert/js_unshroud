// CryptoJS Deobfuscation Instrumentation - AES, DES, TripleDES, RC4, Rabbit, etc.
(function() {
  'use strict';

  // Check if CryptoJS monitoring is enabled
  if (!window.__js_unshroud_config || !window.__js_unshroud_config.enableCryptoJS) {
    return;
  }

  // Get config values
  const config = window.__js_unshroud_config || {};
  const maxPayloadSize = config.maxPayloadSize || 2051;

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

  // Log CryptoJS event AFTER execution
  const logCryptoJSEvent = function(method, operation, algorithm, encoding, key, output, outputLength, success, error) {
    if (typeof window.__js_unshroud_log === 'function') {
      const event = {
        id: generateEventId(),
        sessionId: getSessionId(),
        timestamp: Date.now(),
        type: 'cryptojs',
        method: method,
        operation: operation,
        algorithm: algorithm,
        encoding: encoding,
        key: key,
        output: truncateOutput(output || ''),
        outputLength: outputLength,
        success: success,
        error: error
      };

      window.__js_unshroud_log(JSON.stringify(event));

      // Save artifact if artifact collection is enabled and operation succeeded (decrypt only)
      if (success && operation === 'decrypt' && window.__js_unshroud_config && window.__js_unshroud_config.enableArtifactCollection) {
        if (typeof window.__js_unshroud_save_artifact === 'function') {
          window.__js_unshroud_save_artifact({
            event: event,
            type: 'cryptojs',
            content: output || '',  // Full decrypted plaintext, not truncated
            extension: 'txt',
            mimeType: 'text/plain'
          });
        }
      }
    }
  };

  // Monitor for CryptoJS global object
  let cryptoJSHooked = false;

  const hookCryptoJS = function(CryptoJS) {
    if (cryptoJSHooked || !CryptoJS) return;
    cryptoJSHooked = true;

    // ============================================================================
    // HOOK ENCRYPTION ALGORITHMS
    // ============================================================================

    const algorithms = ['AES', 'DES', 'TripleDES', 'RC4', 'Rabbit'];
    algorithms.forEach(function(algo) {
      if (CryptoJS[algo]) {
        // Wrap decrypt
        if (CryptoJS[algo].decrypt) {
          const originalDecrypt = CryptoJS[algo].decrypt;
          CryptoJS[algo].decrypt = function(ciphertext, key, cfg) {
            let result, success = true, error, output = '', outputLength = 0;
            try {
              result = originalDecrypt.call(this, ciphertext, key, cfg);
              // Convert to string to get decrypted content
              if (result && result.toString) {
                try {
                  output = result.toString(CryptoJS.enc.Utf8);
                  outputLength = output.length;
                } catch {
                  // Failed to convert to UTF8, try raw
                  output = String(result);
                  outputLength = output.length;
                }
              }
            } catch (err) {
              success = false;
              error = err.message;
              throw err;
            } finally {
              // Log AFTER decryption - we need the decrypted output
              // Do NOT log encrypted input (user requirement)
              logCryptoJSEvent(
                algo + '.decrypt',
                'decrypt',
                algo,
                undefined,
                String(key),  // Log the key
                output,
                outputLength,
                success,
                error
              );
            }
            return result;
          };
        }

        // Wrap encrypt
        if (CryptoJS[algo].encrypt) {
          const originalEncrypt = CryptoJS[algo].encrypt;
          CryptoJS[algo].encrypt = function(message, key, cfg) {
            let result, success = true, error;
            // Log the INPUT message (cleartext being encrypted)
            let cleartextInput = '';
            let inputLength = 0;

            try {
              // Extract cleartext from message parameter
              if (typeof message === 'string') {
                cleartextInput = message;
                inputLength = message.length;
              } else if (message && message.toString) {
                try {
                  cleartextInput = message.toString(CryptoJS.enc.Utf8);
                  inputLength = cleartextInput.length;
                } catch {
                  cleartextInput = String(message);
                  inputLength = cleartextInput.length;
                }
              }
            } catch {
              // Ignore errors in extracting input
            }

            try {
              result = originalEncrypt.call(this, message, key, cfg);
            } catch (err) {
              success = false;
              error = err.message;
              throw err;
            } finally {
              // Log the cleartext INPUT, not the encrypted output
              logCryptoJSEvent(
                algo + '.encrypt',
                'encrypt',
                algo,
                undefined,
                String(key),
                cleartextInput,  // Log cleartext input
                inputLength,
                success,
                error
              );
            }
            return result;
          };
        }
      }
    });

    // ============================================================================
    // HOOK ENCODING CONVERTERS
    // ============================================================================

    if (CryptoJS.enc) {
      const encodings = ['Base64', 'Utf8', 'Hex', 'Latin1'];
      encodings.forEach(function(encoding) {
        if (CryptoJS.enc[encoding]) {
          // Wrap stringify
          if (CryptoJS.enc[encoding].stringify) {
            const originalStringify = CryptoJS.enc[encoding].stringify;
            CryptoJS.enc[encoding].stringify = function(wordArray) {
              let result, success = true, error;
              try {
                result = originalStringify.call(this, wordArray);
              } catch (err) {
                success = false;
                error = err.message;
                throw err;
              } finally {
                logCryptoJSEvent(
                  'enc.' + encoding + '.stringify',
                  'stringify',
                  undefined,
                  encoding,
                  undefined,
                  result,
                  result ? result.length : 0,
                  success,
                  error
                );
              }
              return result;
            };
          }

          // Wrap parse
          if (CryptoJS.enc[encoding].parse) {
            const originalParse = CryptoJS.enc[encoding].parse;
            CryptoJS.enc[encoding].parse = function(str) {
              let result, success = true, error;
              try {
                result = originalParse.call(this, str);
              } catch (err) {
                success = false;
                error = err.message;
                throw err;
              } finally {
                // Log the parsed result (converted to string if possible)
                let output = '';
                if (result && result.toString && CryptoJS.enc.Utf8) {
                  try {
                    output = result.toString(CryptoJS.enc.Utf8);
                  } catch {
                    output = String(result);
                  }
                }
                logCryptoJSEvent(
                  'enc.' + encoding + '.parse',
                  'parse',
                  undefined,
                  encoding,
                  undefined,
                  output,
                  output.length,
                  success,
                  error
                );
              }
              return result;
            };
          }
        }
      });
    }

    window.__js_unshroud_debug('[JS Unshroud] CryptoJS hooks installed');
  };

  // Option 1: Hook immediately if CryptoJS already exists
  if (window.CryptoJS) {
    hookCryptoJS(window.CryptoJS);
  }

  // Option 2: Monitor for CryptoJS assignment.
  // Seed from the existing value first — otherwise redefining the property with a getter
  // that returns an uninitialized `cryptoJSValue` blanks a pre-existing window.CryptoJS
  // to `undefined`, breaking the page's own access.
  let cryptoJSValue = window.CryptoJS;
  try {
    Object.defineProperty(window, 'CryptoJS', {
      get: function() {
        return cryptoJSValue;
      },
      set: function(value) {
        cryptoJSValue = value;
        hookCryptoJS(value);
      },
      enumerable: true,
      configurable: true
    });
  } catch (e) {
    // Property already exists and is not configurable
    // This is fine, we'll catch it via Option 1
    if (window.__js_unshroud_debug) {
      window.__js_unshroud_debug('[JS Unshroud] Could not intercept CryptoJS assignment:', e.message);
    }
  }

  window.__js_unshroud_debug('[JS Unshroud] CryptoJS monitoring loaded');
})();
