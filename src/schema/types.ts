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
  | PerformanceWarningEvent;

export interface SessionConfig {
  id: string;
  url: string;
  startTime: number;
  outputPath: string;
  configPath?: string | undefined;
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
  sampleRate: number;
  maxEventsPerSecond: number;
  dedupeWindowMs: number;
  maxPayloadSize: number;
  maxStackDepth: number;
  enableSampling: boolean;
  enableRateLimiting: boolean;
  enableDeduplication: boolean;
}
