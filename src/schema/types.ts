export interface BaseEvent {
  id: string;
  timestamp: number;
  sessionId: string;
  frameId?: string;
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

export type MonitoringEvent =
  | ConsoleEvent
  | NetworkEvent
  | StorageEvent
  | WebSocketEvent
  | TimerEvent
  | ErrorEvent
  | DomEvent;

export interface SessionConfig {
  id: string;
  url: string;
  startTime: number;
  outputPath: string;
  configPath?: string;
}

export interface InstrumentationConfig {
  enableConsole: boolean;
  enableNetwork: boolean;
  enableStorage: boolean;
  enableWebSocket: boolean;
  enableTimer: boolean;
  enableError: boolean;
  enableDOM: boolean;
  sampleRate: number;
}
