export interface BaseEvent {
  id: string;
  timestamp: number;
  sessionId: string;
  frameId?: string;
  correlationId?: string;
  type: string;
}

export interface ConsoleEvent extends BaseEvent {
  type: 'console';
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
  args?: unknown[];
  stackTrace?: string;
}

export interface NetworkEvent extends BaseEvent {
  type: 'network';
  method: string;
  url: string;
  status?: number;
  statusText?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  duration?: number;
  error?: string;
  requestPayload?: unknown;
  responsePayload?: unknown;
}

export interface StorageEvent extends BaseEvent {
  type: 'storage';
  storageType: 'localStorage' | 'sessionStorage';
  operation: 'set' | 'get' | 'remove' | 'clear';
  key?: string;
  value?: string;
  oldValue?: string;
}

export interface WebSocketEvent extends BaseEvent {
  type: 'websocket';
  url: string;
  event: 'open' | 'close' | 'error' | 'message';
  data?: string | ArrayBuffer | Buffer;
  code?: number;
  reason?: string;
  error?: string;
}

export interface TimerEvent extends BaseEvent {
  type: 'timer';
  timerType: 'setTimeout' | 'setInterval' | 'requestAnimationFrame';
  operation: 'create' | 'execute' | 'clear';
  handler?: string;
  delay?: number;
  stackTrace?: string;
}

export interface ErrorEvent extends BaseEvent {
  type: 'error';
  message: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  error?: unknown;
}

export interface DomEvent extends BaseEvent {
  type: 'dom';
  eventType: string;
  target?: string;
  eventPhase: 'capture' | 'target' | 'bubble';
  bubbles: boolean;
  cancelable: boolean;
  defaultPrevented: boolean;
  composed: boolean;
  targetSelector?: string;
  details?: unknown;
}

export interface FingerprintingEvent extends BaseEvent {
  type: 'fingerprinting';
  method: string;
  operation: string;
  value?: unknown;
  contextType?: string;
  options?: unknown;
  stackTrace?: string;
}

export interface HeadlessMitigationEvent extends BaseEvent {
  type: 'headless_mitigation';
  method: string;
  operation: string;
  originalValue?: unknown;
  newValue?: unknown;
  originalError?: string;
  newState?: string;
  pluginCount?: number;
  width?: number;
  height?: number;
  originalLength?: number;
  newLength?: number;
  parameter?: number;
  query?: string;
  originalResult?: boolean;
  stackTrace?: string;
}

export interface PerformanceStatsEvent extends BaseEvent {
  type: 'performance_stats';
  method: string;
  operation: 'performance_monitoring';
  uptime: number;
  totalEventsProcessed: number;
  eventsAccepted: number;
  eventsRejected: number;
  eventsSampled: number;
  eventsRateLimited: number;
  eventsDeduplicated: number;
  acceptanceRate: string;
  samplingRate: number;
  maxEventsPerSecond: number;
}

export interface PerformanceWarningEvent extends BaseEvent {
  type: 'performance_warning';
  method: 'setTimeout' | 'setInterval';
  operation: 'short_timeout_detected' | 'short_interval_detected';
  delay: number;
  warning: string;
}

export interface ServiceWorkerEvent extends BaseEvent {
  type: 'service_worker';
  eventType: 'register' | 'unregister' | 'update' | 'install' | 'activate' | 'message' | 'fetch_intercept' | 'cache_open' | 'cache_add' | 'cache_delete' | 'push_subscribe' | 'push_unsubscribe';
  scriptUrl?: string;
  scope?: string;
  state?: 'installing' | 'installed' | 'activating' | 'activated' | 'redundant';
  messageData?: unknown;
  cacheName?: string;
  cacheKey?: string;
  subscriptionEndpoint?: string;
  success?: boolean;
  error?: string;
  stackTrace?: string;
}

export interface CodeExecutionEvent extends BaseEvent {
  type: 'code_execution';
  method: 'eval' | 'Function' | 'AsyncFunction' | 'GeneratorFunction' | 'setTimeout' | 'setInterval';
  operation: 'execute';
  code: string;           // Truncated to maxPayloadSize
  codeLength: number;     // Original length
  codeHash?: string;      // Hash for deduplication
  args?: string[];        // Function constructor arguments
}

export interface EncodingEvent extends BaseEvent {
  type: 'encoding';
  method: 'atob' | 'btoa' | 'fromCharCode' | 'fromCodePoint' |
          'decodeURI' | 'decodeURIComponent' | 'unescape' |
          'encodeURI' | 'encodeURIComponent' | 'escape';
  operation: 'encode' | 'decode';
  output: string;         // De-obfuscated/encoded result (truncated to maxPayloadSize)
  outputLength: number;   // Original output length
  success: boolean;
  error?: string;
}

export interface CryptoJSEvent extends BaseEvent {
  type: 'cryptojs';
  method: string;         // e.g., 'AES.decrypt', 'DES.encrypt', 'enc.Base64.parse'
  operation: 'decrypt' | 'encrypt' | 'parse' | 'stringify';
  algorithm?: 'AES' | 'DES' | 'TripleDES' | 'RC4' | 'Rabbit';
  encoding?: 'Base64' | 'Utf8' | 'Hex' | 'Latin1';
  key?: string;           // Decryption/encryption key (if available)
  output: string;         // For decrypt: decrypted plaintext, For encrypt: cleartext input, For parse/stringify: result (truncated to maxPayloadSize)
  outputLength: number;   // Original length
  success: boolean;
  error?: string;
}

export interface ScriptInjectionEvent extends BaseEvent {
  type: 'script_injection';
  method: 'innerHTML' | 'outerHTML' | 'insertAdjacentHTML' | 'document.write' | 'document.writeln' |
          'createElement' | 'setAttribute' | 'script.src' | 'script.textContent' | 'script.innerHTML' |
          'appendChild' | 'insertBefore';
  htmlContent?: string;           // Full HTML content for innerHTML/outerHTML/insertAdjacentHTML/document.write
  htmlLength?: number;            // Length of HTML content
  containsScriptTag?: boolean;    // Does HTML contain <script> tags?
  scriptTagCount?: number;        // Number of <script> tags found
  scriptSources?: string[];       // Array of script src URLs found in HTML
  containsEventHandlers?: boolean; // Does HTML contain event handler attributes (on*)?
  eventHandlerTypes?: string[];   // Array of event handler types (onclick, onerror, etc.)
  scriptSrc?: string;             // Script element src URL (for createElement/appendChild)
  scriptContent?: string;         // Inline script content (for createElement/appendChild)
  isDataUrl?: boolean;            // Is src a data: URL?
  isBlobUrl?: boolean;            // Is src a blob: URL?
  decodedContent?: string;        // Decoded content from data: URL
  attributeName?: string;         // Attribute name for setAttribute
  attributeValue?: string;        // Attribute value for setAttribute
  targetSelector?: string;        // CSS selector of target element
}

export interface EventHandlerEvent extends BaseEvent {
  type: 'event_handler';
  eventType: 'property_set';
  handlerName: string;            // Event handler property name (onclick, onerror, etc.)
  handlerCode: string;            // Handler function code (truncated to 200 chars)
  element: string;                // CSS selector of target element or 'document' or 'window'
  method: 'property_assignment';
}

export interface BlobEvent extends BaseEvent {
  type: 'blob';
  eventType: 'blob_create' | 'blob_url_create' | 'blob_url_revoke';
  blobUrl?: string;               // Blob URL (for blob_url_create/blob_url_revoke)
  blobType?: string;              // MIME type of blob
  blobSize?: number;              // Size of blob in bytes
  content?: string;               // Blob content (truncated to 1KB for logging)
  isJavaScript?: boolean;         // Is blob type JavaScript?
}

export interface URLExecutionEvent extends BaseEvent {
  type: 'url_execution';
  eventType: 'location_href_set' | 'location_assign' | 'location_replace' | 'anchor_href_set';
  url: string;                    // Full javascript: URL
  code: string;                   // Extracted and decoded JavaScript code
  element?: string;               // CSS selector of anchor element (for anchor_href_set)
}

export interface WorkerEvent extends BaseEvent {
  type: 'worker';
  eventType: 'worker_create' | 'worker_postmessage' | 'worker_message' | 'worker_error';
  workerType: 'Worker' | 'SharedWorker';
  scriptURL: string;              // URL of worker script
  blobContent?: string;           // Resolved content from blob: URL (if applicable)
  message?: string;               // Serialized message data (for postmessage/message events)
  direction?: 'to_worker' | 'from_worker';  // Message direction
  error?: string;                 // Error message (for worker_error)
  stackTrace?: string;
}

export interface ModuleEvent extends BaseEvent {
  type: 'module';
  eventType: 'module_script_inject';
  src?: string;                   // Source URL for external module scripts
  content?: string;               // Inline module script content (truncated)
  isInline: boolean;              // Whether this is an inline module vs external
  stackTrace?: string;
}

export interface IframeEvent extends BaseEvent {
  type: 'iframe';
  eventType: 'iframe_create' | 'iframe_srcdoc_set' | 'iframe_eval';
  src?: string;                   // Source URL for iframe
  srcdoc?: string;                // Inline srcdoc HTML content (truncated)
  scriptCount?: number;           // Number of scripts found in srcdoc
  scripts?: string[];             // Extracted scripts from srcdoc (truncated)
  code?: string;                  // For iframe_eval event
  element: string;                // CSS selector of iframe element
  stackTrace?: string;
}

export type MonitoringEvent =
  | ConsoleEvent
  | NetworkEvent
  | StorageEvent
  | WebSocketEvent
  | TimerEvent
  | ErrorEvent
  | DomEvent
  | FingerprintingEvent
  | HeadlessMitigationEvent
  | PerformanceStatsEvent
  | PerformanceWarningEvent
  | ServiceWorkerEvent
  | CodeExecutionEvent
  | EncodingEvent
  | CryptoJSEvent
  | ScriptInjectionEvent
  | EventHandlerEvent
  | BlobEvent
  | URLExecutionEvent
  | WorkerEvent
  | ModuleEvent
  | IframeEvent;

export interface SessionConfig {
  id: string;
  url: string;
  startTime: number;
  outputPath: string;
  configPath?: string | undefined;
}

export interface UDPLoggingConfig {
  enabled: boolean;
  host: string;    // IP address, e.g., "192.168.1.100"
  port: number;    // Port, e.g., 514 (syslog) or custom port
}

export interface InstrumentationConfig {
  enableConsole: boolean;
  enableNetwork: boolean;
  enableStorage: boolean;
  enableWebSocket: boolean;
  enableTimer: boolean;
  enableError: boolean;
  enableDOM: boolean;
  enableFingerprinting: boolean;
  enableObjectTracking: boolean;
  enableHeadlessMitigation: boolean;
  enableServiceWorker: boolean;
  enableCodeExecution: boolean; // Instruments eval(), Function(), setTimeout/setInterval string code
  enableEncoding: boolean;      // Instruments atob/btoa, fromCharCode, URI encoding/decoding
  enableCryptoJS: boolean;      // Instruments CryptoJS library (AES/DES/TripleDES/RC4/Rabbit decrypt/encrypt)
  enableEventHandlers: boolean; // Instruments event handler property assignments (element.onclick = ...)
  enableBlobTracking: boolean;  // Instruments Blob creation and URL.createObjectURL/revokeObjectURL
  enableURLExecution: boolean;  // Instruments javascript: URL execution (location.href, anchor.href, etc.)
  enableWorkers: boolean;       // Instruments Web Workers and SharedWorkers (creation and messaging)
  enableModules: boolean;       // Instruments ES module <script type="module"> injection
  enableIframes: boolean;       // Instruments iframe creation and srcdoc injection
  dedupeWindowMs: number;       // Deduplication window in milliseconds
  maxPayloadSize: number;       // Maximum payload size in bytes
  maxStackDepth: number;        // Maximum stack trace depth
  enableDeduplication: boolean; // Reduce noise from tight loops

  // Monitoring configuration
  monitoringTimeoutSeconds: number;  // How long to monitor the page in seconds (default: 15)

  // Output configuration
  outputMode?: 'file' | 'udp' | 'both';  // Default: 'file'
  udpLogging?: UDPLoggingConfig;
}
