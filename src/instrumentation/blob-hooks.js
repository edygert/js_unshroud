// Blob URL Tracking - Track blob creation and URL generation for malware analysis
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
      const enrichedEvent = {
        id: generateEventId(),
        sessionId: getSessionId(),
        timestamp: event.timestamp || Date.now(),
        ...event
      };
      window.__js_unshroud_log(JSON.stringify(enrichedEvent));
    }
  };

  // Initialize blob URL mapping store
  if (!window.__js_unshroud_blob_map) {
    window.__js_unshroud_blob_map = {};
  }

  // Store original Blob constructor
  const OriginalBlob = window.Blob;
  const OriginalFileReader = window.FileReader;

  // Helper to extract text content from blob parts synchronously
  // This is critical for worker blob injection - async extraction causes race conditions
  // where URL.createObjectURL is called before FileReader completes
  const extractBlobPartsContent = function(blobParts) {
    if (!blobParts || !Array.isArray(blobParts)) {
      return null;
    }

    try {
      const parts = [];
      for (let i = 0; i < blobParts.length; i++) {
        const part = blobParts[i];
        if (typeof part === 'string') {
          parts.push(part);
        } else if (part instanceof ArrayBuffer) {
          // Convert ArrayBuffer to string
          // eslint-disable-next-line no-undef
          parts.push(new TextDecoder().decode(part));
        } else if (ArrayBuffer.isView(part)) {
          // TypedArray or DataView
          // eslint-disable-next-line no-undef
          parts.push(new TextDecoder().decode(part));
        }
        // Skip Blob parts - can't read synchronously
      }
      return parts.length > 0 ? parts.join('') : null;
    } catch {
      return null;
    }
  };

  // Instrument Blob constructor
  if (OriginalBlob) {
    window.Blob = function(blobParts, options) {
      // Create the blob using original constructor
      const blob = new OriginalBlob(blobParts, options);

      try {
        const blobType = options && options.type ? options.type : 'unknown';
        const blobSize = blob.size;
        const isJavaScript = blobType.includes('javascript') || blobType.includes('ecmascript');
        const shouldExtractContent = isJavaScript || blobSize < 10240; // 10KB limit

        // Extract content SYNCHRONOUSLY from blobParts for immediate use
        // This is critical for worker blob injection to avoid race conditions
        let syncContent = null;
        if (shouldExtractContent) {
          syncContent = extractBlobPartsContent(blobParts);
        }

        // Store content on the blob object immediately for later retrieval
        if (syncContent !== null) {
          try {
            Object.defineProperty(blob, '__js_unshroud_content', {
              value: syncContent,
              writable: false,
              enumerable: false,
              configurable: false
            });
          } catch {
            // Ignore if property can't be defined
          }
        }

        // Log blob creation event
        logEvent({
          type: 'blob',
          eventType: 'blob_create',
          blobType: blobType,
          blobSize: blobSize,
          content: syncContent ? String(syncContent).substring(0, 1024) : null,
          isJavaScript: isJavaScript,
          timestamp: Date.now()
        });

        // If sync extraction failed (e.g., blob created from other blobs),
        // fall back to async extraction
        if (syncContent === null && shouldExtractContent && OriginalFileReader) {
          const reader = new OriginalFileReader();

          reader.onload = function() {
            const content = reader.result;
            // Store content on the blob object for later retrieval
            try {
              Object.defineProperty(blob, '__js_unshroud_content', {
                value: content,
                writable: false,
                enumerable: false,
                configurable: false
              });
            } catch {
              // Ignore - property might already exist from sync extraction
            }
          };

          // Read blob content as text (async fallback)
          reader.readAsText(blob);
        }
      } catch {
        // Don't break blob creation if tracking fails
      }

      return blob;
    };

    // Preserve Blob prototype and static methods
    window.Blob.prototype = OriginalBlob.prototype;
    if (OriginalBlob.prototype.constructor) {
      Object.defineProperty(window.Blob.prototype, 'constructor', {
        value: window.Blob,
        writable: true,
        enumerable: false,
        configurable: true
      });
    }
  }

  // Instrument URL.createObjectURL()
  const originalCreateObjectURL = window.URL.createObjectURL;
  if (originalCreateObjectURL) {
    window.URL.createObjectURL = function(obj) {
      const blobUrl = originalCreateObjectURL.call(this, obj);

      try {
        // Check if it's a Blob object
        if (obj instanceof OriginalBlob) {
          const blobType = obj.type || 'unknown';
          const blobSize = obj.size;
          const isJavaScript = blobType.includes('javascript') || blobType.includes('ecmascript');

          // Try to get content from the blob
          let content = null;
          try {
            content = obj.__js_unshroud_content || null;
          } catch {
            // Property might not be accessible
          }

          // Store in blob map for later lookup
          window.__js_unshroud_blob_map[blobUrl] = {
            content: content,
            type: blobType,
            size: blobSize,
            isJavaScript: isJavaScript,
            created: Date.now()
          };

          // Log blob URL creation
          logEvent({
            type: 'blob',
            eventType: 'blob_url_create',
            blobUrl: blobUrl,
            blobType: blobType,
            blobSize: blobSize,
            content: content ? String(content).substring(0, 1024) : null,
            isJavaScript: isJavaScript,
            timestamp: Date.now()
          });

          // If content not yet available, try to extract it now
          if (!content && (isJavaScript || blobSize < 10240) && OriginalFileReader) {
            const reader = new OriginalFileReader();

            reader.onload = function() {
              const extractedContent = reader.result;

              // Update blob map with extracted content
              if (window.__js_unshroud_blob_map[blobUrl]) {
                window.__js_unshroud_blob_map[blobUrl].content = extractedContent;
              }
            };

            reader.readAsText(obj);
          }
        }
      } catch (error) {
        window.__js_unshroud_debug('[JS Unshroud] Error tracking blob URL:', error);
      }

      return blobUrl;
    };
  }

  // Instrument URL.revokeObjectURL()
  const originalRevokeObjectURL = window.URL.revokeObjectURL;
  if (originalRevokeObjectURL) {
    window.URL.revokeObjectURL = function(blobUrl) {
      try {
        // Log revocation
        logEvent({
          type: 'blob',
          eventType: 'blob_url_revoke',
          blobUrl: blobUrl,
          timestamp: Date.now()
        });

        // Remove from blob map
        if (window.__js_unshroud_blob_map[blobUrl]) {
          delete window.__js_unshroud_blob_map[blobUrl];
        }
      } catch (error) {
        window.__js_unshroud_debug('[JS Unshroud] Error tracking blob URL revocation:', error);
      }

      return originalRevokeObjectURL.call(this, blobUrl);
    };
  }

  // Periodic cleanup of old blob URLs (every 5 minutes)
  setInterval(function() {
    try {
      const now = Date.now();
      const maxAge = 5 * 60 * 1000; // 5 minutes

      for (const blobUrl in window.__js_unshroud_blob_map) {
        if (Object.prototype.hasOwnProperty.call(window.__js_unshroud_blob_map, blobUrl)) {
          const blobInfo = window.__js_unshroud_blob_map[blobUrl];
          if (blobInfo && blobInfo.created && (now - blobInfo.created) > maxAge) {
            delete window.__js_unshroud_blob_map[blobUrl];
          }
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  }, 5 * 60 * 1000);

  window.__js_unshroud_debug('[JS Unshroud] Blob hooks loaded');
})();
