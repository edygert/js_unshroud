// Download Detection Instrumentation - Track file downloads via blob/data URLs
(function() {
  'use strict';

  // Check if download detection is enabled
  if (!window.__js_unshroud_config || !window.__js_unshroud_config.enableDownloadDetection) {
    return;
  }

  // Store originals
  const originalCreateElement = document.createElement;
  const originalWindowOpen = window.open;

  // Download correlation tracking
  if (!window.__js_unshroud_download_map) {
    window.__js_unshroud_download_map = new Map(); // anchor element -> download info
  }

  // Generate event ID
  const generateEventId = function() {
    return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  // Get session ID
  const getSessionId = function() {
    return window.__js_unshroud_session_id || 'unknown_session';
  };

  // Get stack trace (currently unused but kept for potential debugging needs)
  // const getStackTrace = function() {
  //   try {
  //     const err = new Error();
  //     const stack = err.stack || '';
  //     return stack.split('\n').slice(2, 10).join('\n');
  //   } catch {
  //     return '';
  //   }
  // };

  // Log event
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

  // Instrument anchor element with property setters
  function instrumentAnchorElement(anchor) {
    const downloadId = 'download_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // Store download info for this anchor
    const downloadInfo = {
      downloadId: downloadId,
      filename: null,
      href: null,
      timestamp: Date.now()
    };
    window.__js_unshroud_download_map.set(anchor, downloadInfo);

    // Track download attribute setter
    /* global HTMLAnchorElement */
    const originalDownloadDescriptor = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, 'download');
    if (originalDownloadDescriptor) {
      try {
        Object.defineProperty(anchor, 'download', {
          get: function() {
            return originalDownloadDescriptor.get ? originalDownloadDescriptor.get.call(this) : this.getAttribute('download');
          },
          set: function(value) {
            const info = window.__js_unshroud_download_map.get(this);
            if (info) {
              info.filename = value;

              logEvent({
                type: 'download',
                eventType: 'download_attribute_set',
                downloadId: info.downloadId,
                filename: value,
                href: this.href,
                isBlobUrl: this.href ? this.href.startsWith('blob:') : false,
                isDataUrl: this.href ? this.href.startsWith('data:') : false
              });
            }

            if (originalDownloadDescriptor.set) {
              originalDownloadDescriptor.set.call(this, value);
            } else {
              this.setAttribute('download', value);
            }
          },
          enumerable: true,
          configurable: true
        });
      } catch (e) {
        // Property may not be configurable, continue without tracking
        if (window.__js_unshroud_debug) {
          window.__js_unshroud_debug('[JS Unshroud] Could not instrument download property:', e.message);
        }
      }
    }

    // Track href setter (for download anchors)
    const originalHrefDescriptor = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, 'href');
    if (originalHrefDescriptor) {
      try {
        Object.defineProperty(anchor, 'href', {
          get: function() {
            return originalHrefDescriptor.get ? originalHrefDescriptor.get.call(this) : this.getAttribute('href');
          },
          set: function(value) {
            const info = window.__js_unshroud_download_map.get(this);
            if (info) {
              info.href = value;

              // Resolve blob content if it's a blob URL
              if (value && value.startsWith('blob:') && window.__js_unshroud_blob_map) {
                const blobInfo = window.__js_unshroud_blob_map[value];
                if (blobInfo) {
                  info.blobContent = blobInfo.content;
                  info.blobType = blobInfo.type;
                  info.blobSize = blobInfo.size;
                }
              }

              logEvent({
                type: 'download',
                eventType: 'download_href_set',
                downloadId: info.downloadId,
                href: value,
                isBlobUrl: value ? value.startsWith('blob:') : false,
                isDataUrl: value ? value.startsWith('data:') : false,
                filename: info.filename,
                blobType: info.blobType,
                blobSize: info.blobSize
              });
            }

            if (originalHrefDescriptor.set) {
              originalHrefDescriptor.set.call(this, value);
            } else {
              this.setAttribute('href', value);
            }
          },
          enumerable: true,
          configurable: true
        });
      } catch (e) {
        // Property may not be configurable
        if (window.__js_unshroud_debug) {
          window.__js_unshroud_debug('[JS Unshroud] Could not instrument href property:', e.message);
        }
      }
    }

    // Track click() invocation
    const originalClick = anchor.click;
    if (originalClick) {
      anchor.click = function() {
        const info = window.__js_unshroud_download_map.get(this);
        if (info) {
          // Try to resolve blob content if not already resolved
          if (info.href && info.href.startsWith('blob:') && !info.blobContent && window.__js_unshroud_blob_map) {
            const blobInfo = window.__js_unshroud_blob_map[info.href];
            if (blobInfo) {
              info.blobContent = blobInfo.content;
              info.blobType = blobInfo.type;
              info.blobSize = blobInfo.size;
            }
          }

          const event = {
            type: 'download',
            eventType: 'download_click',
            downloadId: info.downloadId,
            filename: info.filename,
            href: info.href,
            isBlobUrl: info.href ? info.href.startsWith('blob:') : false,
            isDataUrl: info.href ? info.href.startsWith('data:') : false,
            blobType: info.blobType,
            blobSize: info.blobSize,
            blobContent: info.blobContent ? String(info.blobContent).substring(0, 1024) : null
          };

          logEvent(event);

          // Save artifact if artifact collection is enabled and we have blob content
          if (info.blobContent && window.__js_unshroud_config && window.__js_unshroud_config.enableArtifactCollection) {
            if (typeof window.__js_unshroud_save_artifact === 'function') {
              // Determine file extension from filename or use 'bin' as default
              const extension = info.filename ? info.filename.split('.').pop() || 'bin' : 'bin';
              window.__js_unshroud_save_artifact({
                event: event,
                type: 'download',
                content: String(info.blobContent),  // Full blob content, not truncated
                extension: extension,
                mimeType: info.blobType || 'application/octet-stream'
              });
            }
          }
        }

        return originalClick.apply(this, arguments);
      };
    }
  }

  // 1. Instrument document.createElement to track anchor creation
  document.createElement = function(tagName, options) {
    const element = originalCreateElement.call(this, tagName, options);

    if (tagName && tagName.toLowerCase() === 'a') {
      instrumentAnchorElement(element);
    }

    return element;
  };

  // 2. Instrument existing anchor elements on page
  try {
    const existingAnchors = document.querySelectorAll('a');
    existingAnchors.forEach(function(anchor) {
      instrumentAnchorElement(anchor);
    });
  } catch (e) {
    // DOM may not be ready yet, that's okay
    if (window.__js_unshroud_debug) {
      window.__js_unshroud_debug('[JS Unshroud] Could not instrument existing anchors:', e.message);
    }
  }

  // 3. Instrument window.open for blob/data URLs
  window.open = function(url, target, _features) {
    if (url && (typeof url === 'string') && (url.startsWith('blob:') || url.startsWith('data:'))) {
      const downloadId = 'download_windowopen_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

      // Resolve blob content
      let blobContent = null;
      let blobType = null;
      let blobSize = null;

      if (url.startsWith('blob:') && window.__js_unshroud_blob_map) {
        const blobInfo = window.__js_unshroud_blob_map[url];
        if (blobInfo) {
          blobContent = blobInfo.content;
          blobType = blobInfo.type;
          blobSize = blobInfo.size;
        }
      }

      const event = {
        type: 'download',
        eventType: 'window_open_download',
        downloadId: downloadId,
        url: url,
        isBlobUrl: url.startsWith('blob:'),
        isDataUrl: url.startsWith('data:'),
        target: target || '_blank',
        blobType: blobType,
        blobSize: blobSize,
        blobContent: blobContent ? String(blobContent).substring(0, 1024) : null
      };

      logEvent(event);

      // Save artifact if artifact collection is enabled and we have blob content
      if (blobContent && window.__js_unshroud_config && window.__js_unshroud_config.enableArtifactCollection) {
        if (typeof window.__js_unshroud_save_artifact === 'function') {
          window.__js_unshroud_save_artifact({
            event: event,
            type: 'download',
            content: String(blobContent),  // Full blob content, not truncated
            extension: 'bin',
            mimeType: blobType || 'application/octet-stream'
          });
        }
      }
    }

    return originalWindowOpen.apply(this, arguments);
  };

  // Preserve window.open properties
  try {
    Object.keys(originalWindowOpen).forEach(function(key) {
      if (!(key in window.open)) {
        window.open[key] = originalWindowOpen[key];
      }
    });
  } catch {
    // Ignore if we can't copy properties
  }

  if (window.__js_unshroud_debug) {
    window.__js_unshroud_debug('[JS Unshroud] Download hooks loaded');
  }
})();
