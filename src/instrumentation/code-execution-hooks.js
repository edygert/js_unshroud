// Code Execution Instrumentation - eval(), Function(), and string code execution
(function() {
  'use strict';

  // Check if code execution monitoring is enabled
  if (!window.__js_unshroud_config || !window.__js_unshroud_config.enableCodeExecution) {
    return;
  }

  // Get originals from bootstrap or fallback to window
  const originals = window.__js_unshroud_originals || {};
  const originalEval = originals.eval || window.eval;
  const originalFunction = originals.Function || window.Function;
  const originalAsyncFunction = originals.AsyncFunction || (async function() {}).constructor;
  const originalGeneratorFunction = originals.GeneratorFunction || (function*() {}).constructor;

  // Get config values
  const config = window.__js_unshroud_config || {};
  const maxPayloadSize = config.maxPayloadSize || 1024;

  // Generate a simple event ID
  const generateEventId = function() {
    return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  // Get session ID from window
  const getSessionId = function() {
    return window.__js_unshroud_session_id || 'unknown_session';
  };

  // Simple hash function for code deduplication
  const hashCode = function(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  };

  // Truncate code to maxPayloadSize (captures first and last portions)
  const truncateCode = function(code) {
    if (typeof code !== 'string') {
      return String(code);
    }
    if (code.length <= maxPayloadSize) {
      return code;
    }
    // Capture first 1024 + "..." + last 1024 chars (total 2051)
    const halfSize = 1024;
    const start = code.substring(0, halfSize);
    const end = code.substring(code.length - halfSize);
    return start + '...' + end;
  };

  // Log code execution event BEFORE execution
  const logCodeExecutionEvent = function(method, code, args) {
    if (typeof window.__js_unshroud_log === 'function') {
      const codeStr = String(code);

      // Skip Playwright internal code to avoid noise
      if (codeStr.indexOf('__playwright__') !== -1) {
        return;
      }

      // Skip our own logging bridge code
      if (codeStr.indexOf('__js_unshroud') !== -1) {
        return;
      }

      window.__js_unshroud_log(JSON.stringify({
        id: generateEventId(),
        sessionId: getSessionId(),
        timestamp: Date.now(),
        type: 'code_execution',
        method: method,
        operation: 'execute',
        code: truncateCode(codeStr),
        codeLength: codeStr.length,
        codeHash: hashCode(codeStr),
        args: args
      }));
    }
  };

  // ============================================================================
  // EVAL INSTRUMENTATION
  // ============================================================================

  // Store reference to original eval
  const wrappedEval = function(code) {
    // Log BEFORE execution (critical for malware analysis)
    logCodeExecutionEvent('eval', code, undefined);

    // Execute the code
    return originalEval.call(this, code);
  };

  // Override global eval
  window.eval = wrappedEval;

  // Also override via indirect eval references
  if (window.globalThis) {
    window.globalThis.eval = wrappedEval;
  }

  // ============================================================================
  // FUNCTION CONSTRUCTOR INSTRUMENTATION
  // ============================================================================

  // Create wrapped Function constructor
  const createFunctionWrapper = function(OriginalConstructor, constructorName) {
    const wrapped = new Proxy(OriginalConstructor, {
      construct: function(target, args) {
        // Function constructor: arguments are (arg1, arg2, ..., argN, functionBody)
        // The last argument is the function body code
        const functionBody = args.length > 0 ? args[args.length - 1] : '';
        const functionArgs = args.length > 1 ? args.slice(0, -1) : [];

        // Log BEFORE execution (critical for malware analysis)
        logCodeExecutionEvent(
          constructorName,
          functionBody,
          functionArgs.map(String)
        );

        // Execute the constructor
        return Reflect.construct(target, args);
      },

      apply: function(target, thisArg, args) {
        // Function constructor called as function (without new)
        const functionBody = args.length > 0 ? args[args.length - 1] : '';
        const functionArgs = args.length > 1 ? args.slice(0, -1) : [];

        // Log BEFORE execution (critical for malware analysis)
        logCodeExecutionEvent(
          constructorName,
          functionBody,
          functionArgs.map(String)
        );

        // Execute the function
        return Reflect.apply(target, thisArg, args);
      }
    });

    return wrapped;
  };

  // Override Function constructor
  window.Function = createFunctionWrapper(originalFunction, 'Function');

  // Override AsyncFunction if available
  if (originalAsyncFunction && originalAsyncFunction !== window.Function) {
    try {
      // AsyncFunction is not directly accessible, need to get it via constructor
      const AsyncFunctionConstructor = originalAsyncFunction;
      const wrappedAsyncFunction = createFunctionWrapper(AsyncFunctionConstructor, 'AsyncFunction');

      // Replace the constructor in the prototype chain
      Object.defineProperty(wrappedAsyncFunction, 'constructor', {
        value: wrappedAsyncFunction,
        writable: true,
        configurable: true
      });
    } catch (e) {
      // AsyncFunction wrapping failed, continue without it
      if (window.__js_unshroud_debug) {
        console.warn('[JS Unshroud] Failed to wrap AsyncFunction:', e.message);
      }
    }
  }

  // Override GeneratorFunction if available
  if (originalGeneratorFunction && originalGeneratorFunction !== window.Function) {
    try {
      const GeneratorFunctionConstructor = originalGeneratorFunction;
      const wrappedGeneratorFunction = createFunctionWrapper(GeneratorFunctionConstructor, 'GeneratorFunction');

      Object.defineProperty(wrappedGeneratorFunction, 'constructor', {
        value: wrappedGeneratorFunction,
        writable: true,
        configurable: true
      });
    } catch (e) {
      // GeneratorFunction wrapping failed, continue without it
      if (window.__js_unshroud_debug) {
        console.warn('[JS Unshroud] Failed to wrap GeneratorFunction:', e.message);
      }
    }
  }

  // ============================================================================
  // REFLECT.CONSTRUCT INSTRUMENTATION (for Function constructor via Reflect)
  // ============================================================================

  if (window.Reflect && window.Reflect.construct) {
    const originalReflectConstruct = window.Reflect.construct;

    window.Reflect.construct = function(target, args, _newTarget) {
      // Check if constructing a Function
      if (target === originalFunction ||
          target === originalAsyncFunction ||
          target === originalGeneratorFunction) {

        const constructorName = target === originalAsyncFunction ? 'AsyncFunction' :
                               target === originalGeneratorFunction ? 'GeneratorFunction' :
                               'Function';

        const functionBody = args.length > 0 ? args[args.length - 1] : '';
        const functionArgs = args.length > 1 ? args.slice(0, -1) : [];

        // Log BEFORE execution (critical for malware analysis)
        logCodeExecutionEvent(
          constructorName,
          functionBody,
          functionArgs.map(String)
        );

        // Execute the constructor
        return originalReflectConstruct.apply(this, arguments);
      }

      // Not a Function constructor, pass through
      return originalReflectConstruct.apply(this, arguments);
    };
  }

  console.log('[JS Unshroud] Code execution hooks loaded');
})();
