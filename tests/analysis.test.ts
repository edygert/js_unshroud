import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { QueryEngine, type QueryFilter } from '../src/analysis/QueryEngine.ts';
import { TimelineFormatter, type TimeRange } from '../src/analysis/TimelineFormatter.ts';
import { CorrelationEngine, type CorrelationRule } from '../src/analysis/CorrelationEngine.ts';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type {
  MonitoringEvent,
  ConsoleEvent,
  NetworkEvent,
  StorageEvent,
  ErrorEvent,
  DomEvent,
  TimerEvent,
  WebSocketEvent,
  FingerprintingEvent,
  HeadlessMitigationEvent,
  PerformanceStatsEvent,
  PerformanceWarningEvent,
  ServiceWorkerEvent,
  CodeExecutionEvent,
  EncodingEvent,
  CryptoJSEvent,
  ScriptInjectionEvent,
  EventHandlerEvent,
  BlobEvent,
  URLExecutionEvent,
  WorkerEvent,
  ModuleEvent,
  IframeEvent
} from '../src/schema/types.ts';
import { writeFileSync, unlinkSync } from 'fs';

describe('Analysis Engine Tests', () => {
  // Phase 2: QueryEngine Testing (Focus: Stream processing, filtering)

  const events: MonitoringEvent[] = [
    {
      id: 'event-1',
      timestamp: 1640995200000,
      sessionId: 'session-1',
      type: 'console',
      level: 'log',
      message: 'Test message',
      args: []
    } as ConsoleEvent,
    {
      id: 'event-2',
      timestamp: 1640995200100,
      sessionId: 'session-1',
      type: 'network',
      method: 'GET',
      url: 'https://api.example.com/users',
      correlationId: 'corr-1'
    } as NetworkEvent,
    {
      id: 'event-3',
      timestamp: 1640995200200,
      sessionId: 'session-1',
      type: 'storage',
      storageType: 'localStorage',
      operation: 'set',
      key: 'testKey'
    } as StorageEvent,
    {
      id: 'event-4',
      timestamp: 1640995200300,
      sessionId: 'session-2',
      type: 'network',
      method: 'POST',
      url: 'https://api.example.com/login',
      status: 200,
      correlationId: 'corr-2'
    } as NetworkEvent
  ];

  let tempFilePath: string;

  beforeEach(() => {
    // Create temp file with test data
    tempFilePath = `/tmp/analysis-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jsonl`;
    const content = events.map(event => JSON.stringify(event)).join('\n');
    writeFileSync(tempFilePath, content);
  });

  afterEach(() => {
    try {
      unlinkSync(tempFilePath);
    } catch {
      // ignore if file doesn't exist
    }
  });

  describe('QueryEngine', () => {
    let queryEngine: QueryEngine;

    beforeEach(() => {
      queryEngine = new QueryEngine();
    });

    test('should return all events when no filter is provided', async () => {
      const results = await queryEngine.queryEvents(tempFilePath, {});
      expect(results).toHaveLength(4);
      expect(results[0]?.type).toBe('console');
      expect(results[1]?.type).toBe('network');
    });

    test('should filter by type', async () => {
      const filter: QueryFilter = { type: 'network' };
      const results = await queryEngine.queryEvents(tempFilePath, filter);
      expect(results).toHaveLength(2);
      expect(results.every(event => event.type === 'network')).toBe(true);
    });

    test('should filter by type console', async () => {
      const filter: QueryFilter = { type: 'console' };
      const results = await queryEngine.queryEvents(tempFilePath, filter);
      expect(results).toHaveLength(1);
      expect(results[0]?.type).toBe('console');
    });

    test('should filter network events by method', async () => {
      const filter: QueryFilter = { type: 'network', method: 'GET' };
      const results = await queryEngine.queryEvents(tempFilePath, filter);
      expect(results).toHaveLength(1);
      const networkEvent = results[0] as NetworkEvent;
      expect(networkEvent.method).toBe('GET');
    });

    test('should filter network events by URL', async () => {
      const filter: QueryFilter = { type: 'network', url: 'https://api.example.com/users' };
      const results = await queryEngine.queryEvents(tempFilePath, filter);
      expect(results).toHaveLength(1);
      const networkEvent = results[0] as NetworkEvent;
      expect(networkEvent.url).toBe('https://api.example.com/users');
    });

    test('should filter network events by URL regex', async () => {
      const filter: QueryFilter = { type: 'network', url: /api\.example\.com/ };
      const results = await queryEngine.queryEvents(tempFilePath, filter);
      expect(results).toHaveLength(2);
      expect(results.every(event => event.type === 'network')).toBe(true);
    });

    test('should filter network events by status', async () => {
      const filter: QueryFilter = { type: 'network', status: 200 };
      const results = await queryEngine.queryEvents(tempFilePath, filter);
      expect(results).toHaveLength(1);
      const networkEvent = results[0] as NetworkEvent;
      expect(networkEvent.status).toBe(200);
    });

    test('should filter console events by level', async () => {
      const filter: QueryFilter = { type: 'console', level: 'log' };
      const results = await queryEngine.queryEvents(tempFilePath, filter);
      expect(results).toHaveLength(1);
      const consoleEvent = results[0] as ConsoleEvent;
      expect(consoleEvent.level).toBe('log');
    });

    test('should filter by correlationId', async () => {
      const filter: QueryFilter = { correlationId: 'corr-1' };
      const results = await queryEngine.queryEvents(tempFilePath, filter);
      expect(results).toHaveLength(1);
      expect(results[0]?.correlationId).toBe('corr-1');
    });

    test('should filter by timestamp range', async () => {
      const filter: QueryFilter = {
        timestamp: {
          from: 1640995200100,
          to: 1640995200200
        }
      };
      const results = await queryEngine.queryEvents(tempFilePath, filter);
      expect(results).toHaveLength(2);
      expect(results[0]?.timestamp).toBe(1640995200100);
      expect(results[1]?.timestamp).toBe(1640995200200);
    });

    test('should filter by timestamp from only', async () => {
      const filter: QueryFilter = {
        timestamp: { from: 1640995200250 }
      };
      const results = await queryEngine.queryEvents(tempFilePath, filter);
      expect(results).toHaveLength(1);
      expect(results[0]?.timestamp).toBe(1640995200300);
    });

    test('should filter by timestamp to only', async () => {
      const filter: QueryFilter = {
        timestamp: { to: 1640995200150 }
      };
      const results = await queryEngine.queryEvents(tempFilePath, filter);
      expect(results).toHaveLength(2);
      expect(results.every(event => event.timestamp <= 1640995200150)).toBe(true);
    });

    test('should return empty array for non-matching filter', async () => {
      const filter: QueryFilter = { type: 'nonexistent' };
      const results = await queryEngine.queryEvents(tempFilePath, filter);
      expect(results).toHaveLength(0);
    });

    test('should handle streaming with filters', async () => {
      const filter: QueryFilter = { type: 'network' };
      const results: MonitoringEvent[] = [];

      for await (const event of queryEngine.queryEventsStream(tempFilePath, filter)) {
        results.push(event);
      }

      expect(results).toHaveLength(2);
      expect(results.every(event => event.type === 'network')).toBe(true);
    });

    test('should handle streaming without filters', async () => {
      const results: MonitoringEvent[] = [];

      for await (const event of queryEngine.queryEventsStream(tempFilePath, {})) {
        results.push(event);
      }

      expect(results).toHaveLength(4);
    });

    test('should count events with filter', async () => {
      const filter: QueryFilter = { type: 'network' };
      const count = await queryEngine.countEvents(tempFilePath, filter);
      expect(count).toBe(2);
    });

    test('should count all events without filter', async () => {
      const count = await queryEngine.countEvents(tempFilePath, {});
      expect(count).toBe(4);
    });

    test('should count zero for non-matching filter', async () => {
      const filter: QueryFilter = { type: 'nonexistent' };
      const count = await queryEngine.countEvents(tempFilePath, filter);
      expect(count).toBe(0);
    });

    test('should filter storage events by storageType', async () => {
      const filter: QueryFilter = { type: 'storage', storageType: 'localStorage' };
      const results = await queryEngine.queryEvents(tempFilePath, filter);
      expect(results).toHaveLength(1);
      const storageEvent = results[0] as StorageEvent;
      expect(storageEvent.storageType).toBe('localStorage');
    });

    test('should filter storage events by operation', async () => {
      const filter: QueryFilter = { type: 'storage', operation: 'set' };
      const results = await queryEngine.queryEvents(tempFilePath, filter);
      expect(results).toHaveLength(1);
      const storageEvent = results[0] as StorageEvent;
      expect(storageEvent.operation).toBe('set');
    });

    test('should handle malformed JSON lines gracefully', async () => {
      // Create a file with malformed JSON
      const badContent = events.map(event => JSON.stringify(event)).join('\n') + '\n{"incomplete": json}\n' + events.slice(0, 2).map(event => JSON.stringify(event)).join('\n');
      writeFileSync(tempFilePath, badContent);

      const results = await queryEngine.queryEvents(tempFilePath, {});
      expect(results).toHaveLength(6); // 4 good events before + 2 good events after malformed line
    });

    test('should handle filters on custom fields in query filter', async () => {
      // Test the [key: string]: unknown part allows custom filters
      const filter = {
        type: 'network',
        customField: 'customValue'
      };
      const results = await queryEngine.queryEvents(tempFilePath, filter);
      expect(results).toHaveLength(2); // Still returns network events, custom field ignored
    });
  });

  // Phase 3: TimelineFormatter Testing (Focus: Formatting, grouping)

  describe('TimelineFormatter', () => {
    let timelineFormatter: TimelineFormatter;

    beforeEach(() => {
      timelineFormatter = new TimelineFormatter(events);
    });

    test('should create timeline entries correctly', () => {
      const timeline = timelineFormatter.formatTimeline();
      expect(timeline).toHaveLength(4);

      // Events are sorted by timestamp
      expect(timeline[0]?.timestamp).toBe(1640995200000);
      expect(timeline[0]?.summary).toContain('console.log');

      expect(timeline[1]?.timestamp).toBe(1640995200100);
      expect(timeline[1]?.summary).toBe('GET https://api.example.com/users');

      expect(timeline[2]?.timestamp).toBe(1640995200200);
      expect(timeline[2]?.summary).toContain('localStorage.set');

      expect(timeline[3]?.timestamp).toBe(1640995200300);
      expect(timeline[3]?.summary).toBe('POST https://api.example.com/login (200)');
    });

    test('should format as text correctly', () => {
      const text = timelineFormatter.formatAsText();
      expect(text).toContain('Timeline (4 entries)');
      expect(text).toContain('GET https://api.example.com/users');
      expect(text).toContain('localStorage.set(testKey)');
      expect(text).toContain('console.log(Test message)');
      expect(text).toContain('POST https://api.example.com/login (200)');
    });

    test('should format as JSON correctly', () => {
      const json = timelineFormatter.formatAsJSON();
      const parsed = JSON.parse(json);
      expect(parsed.timeline).toHaveLength(4);
      expect(parsed.totalEntries).toBe(4);
      expect(parsed.timeline[0]?.events).toHaveLength(1);
      expect(parsed.timeline[0]?.summary).toContain('console.log');
    });

    test('should group simultaneous events', () => {
      // Create events with same timestamp (will be grouped within 50ms tolerance)
      const simultaneousEvents: MonitoringEvent[] = [
        { ...events[0], timestamp: 1640995200000 } as ConsoleEvent,
        { ...events[1], timestamp: 1640995200005 } as NetworkEvent, // Within 50ms of first
        { ...events[2], timestamp: 1640995200100 } as StorageEvent   // Different timestamp
      ];
      const formatter = new TimelineFormatter(simultaneousEvents);

      const timeline = formatter.formatTimeline();
      expect(timeline).toHaveLength(2);
      expect(timeline[0]?.events).toHaveLength(2); // First two events grouped
      expect(timeline[1]?.events).toHaveLength(1); // Third event separate
    });

    test('should handle empty events array', () => {
      const emptyFormatter = new TimelineFormatter([]);
      const timeline = emptyFormatter.formatTimeline();
      expect(timeline).toHaveLength(0);

      const text = emptyFormatter.formatAsText();
      expect(text).toContain('No events found');
    });

    test('should filter by time range', () => {
      const range: TimeRange = {
        start: 1640995200100,
        end: 1640995200200
      };
      const timeline = timelineFormatter.formatTimeline(range);
      expect(timeline).toHaveLength(2);
      expect(timeline[0]?.timestamp).toBe(1640995200100);
      expect(timeline[1]?.timestamp).toBe(1640995200200);
    });

    test('should filter by start time only', () => {
      const range: TimeRange = { start: 1640995200250 };
      const timeline = timelineFormatter.formatTimeline(range);
      expect(timeline).toHaveLength(1);
      expect(timeline[0]?.timestamp).toBe(1640995200300);
    });

    test('should filter by end time only', () => {
      const range: TimeRange = { end: 1640995200150 };
      const timeline = timelineFormatter.formatTimeline(range);
      expect(timeline).toHaveLength(2);
      expect(timeline.every(entry => entry.timestamp <= 1640995200150)).toBe(true);
    });

    test('should respect max entries limit', () => {
      const timeline = timelineFormatter.formatTimeline(undefined, 2);
      expect(timeline).toHaveLength(2);
    });

    test('should generate correct event summaries for all types', () => {
      const testEvents: MonitoringEvent[] = [
        {
          id: 'console-test',
          timestamp: 1640995200000,  // Earliest timestamp
          sessionId: 'session-1',
          type: 'console',
          level: 'log',
          message: 'Test message',
          args: []
        } as ConsoleEvent,
        {
          id: 'network-test',
          timestamp: 1640995200100,
          sessionId: 'session-1',
          type: 'network',
          method: 'GET',
          url: 'https://api.example.com/users'
        } as NetworkEvent,
        {
          id: 'storage-test',
          timestamp: 1640995200200,
          sessionId: 'session-1',
          type: 'storage',
          storageType: 'localStorage',
          operation: 'set',
          key: 'testKey'
        } as StorageEvent,
        {
          id: 'error-test',
          timestamp: 1640995200400,
          sessionId: 'session-1',
          type: 'error',
          message: 'Test error'
        } as ErrorEvent,
        {
          id: 'dom-test',
          timestamp: 1640995200500,
          sessionId: 'session-1',
          type: 'dom',
          eventType: 'click',
          target: 'button#submit',
          eventPhase: 'target',
          bubbles: true,
          cancelable: true
        } as DomEvent,
        {
          id: 'timer-test',
          timestamp: 1640995200600,
          sessionId: 'session-1',
          type: 'timer',
          timerType: 'setInterval',
          operation: 'create'
        } as TimerEvent
      ];

      const formatter = new TimelineFormatter(testEvents);
      const timeline = formatter.formatTimeline();

      expect(timeline[0]?.summary).toContain('console.log');  // First by timestamp
      expect(timeline[1]?.summary).toBe('GET https://api.example.com/users');
      expect(timeline[2]?.summary).toContain('localStorage.set');
      expect(timeline[3]?.summary).toBe('Error: Test error');
      expect(timeline[4]?.summary).toBe('DOM: click');
      expect(timeline[5]?.summary).toBe('Timer: setInterval.create');
    });

    test('should combine multiple events at same timestamp', () => {
      const sameTimeEvents: MonitoringEvent[] = [
        {
          id: 'console-test',
          timestamp: 1640995200000,
          sessionId: 'session-1',
          type: 'console',
          level: 'log',
          message: 'Test message',
          args: []
        } as ConsoleEvent,
        {
          id: 'network-test',
          timestamp: 1640995200005,
          sessionId: 'session-1',
          type: 'network',
          method: 'GET',
          url: 'https://api.example.com/test'
        } as NetworkEvent,
        {
          id: 'storage-test',
          timestamp: 1640995200005,
          sessionId: 'session-1',
          type: 'storage',
          storageType: 'localStorage',
          operation: 'set',
          key: 'testKey'
        } as StorageEvent
      ];
      const formatter = new TimelineFormatter(sameTimeEvents);
      const timeline = formatter.formatTimeline();

      expect(timeline).toHaveLength(1);
      expect(timeline[0]?.events).toHaveLength(3);
      const summary = timeline[0]?.summary;
      expect(summary).toContain('network');
      expect(summary).toContain('console');
      expect(summary).toContain('storage');
      expect(summary).toMatch(/1x \w+, 1x \w+, 1x \w+:/);
    });

    test('should get statistics correctly', () => {
      const stats = timelineFormatter.getStats();
      expect(stats.totalEvents).toBe(4);
      expect(stats.eventTypes).toEqual({
        console: 1,
        network: 2,
        storage: 1
      });
      expect(stats.timeSpan.start).toBe(1640995200000);
      expect(stats.timeSpan.end).toBe(1640995200300);
    });

    test('should get statistics with time range filter', () => {
      const range: TimeRange = {
        start: 1640995200100,
        end: 1640995200200
      };
      const stats = timelineFormatter.getStats(range);
      expect(stats.totalEvents).toBe(2);
      expect(stats.timeSpan.start).toBe(1640995200100);
      expect(stats.timeSpan.end).toBe(1640995200200);
    });

    test('should handle unknown event types', () => {
      const unknownEvent = {
        id: 'unknown-test',
        timestamp: 1640995200700,
        sessionId: 'session-1',
        type: 'unknown' as any
      } as unknown as MonitoringEvent;
      const formatter = new TimelineFormatter([unknownEvent]);
      const timeline = formatter.formatTimeline();
      expect(timeline[0]?.summary).toBe('unknown event');
    });

    // Additional event type tests for coverage
    test('should format websocket event summary', () => {
      const wsEvent: WebSocketEvent = {
        id: 'ws-test',
        timestamp: 1640995200800,
        sessionId: 'session-1',
        type: 'websocket',
        url: 'wss://example.com/socket',
        event: 'open'
      };
      const formatter = new TimelineFormatter([wsEvent]);
      const timeline = formatter.formatTimeline();
      expect(timeline[0]?.summary).toBe('WebSocket: open wss://example.com/socket');
    });

    test('should format fingerprinting event summary', () => {
      const fpEvent: FingerprintingEvent = {
        id: 'fp-test',
        timestamp: 1640995200900,
        sessionId: 'session-1',
        type: 'fingerprinting',
        method: 'canvas',
        operation: 'toDataURL'
      };
      const formatter = new TimelineFormatter([fpEvent]);
      const timeline = formatter.formatTimeline();
      expect(timeline[0]?.summary).toBe('Fingerprinting: canvas.toDataURL');
    });

    test('should format headless_mitigation event summary', () => {
      const hmEvent: HeadlessMitigationEvent = {
        id: 'hm-test',
        timestamp: 1640995201000,
        sessionId: 'session-1',
        type: 'headless_mitigation',
        method: 'navigator',
        operation: 'webdriver'
      };
      const formatter = new TimelineFormatter([hmEvent]);
      const timeline = formatter.formatTimeline();
      expect(timeline[0]?.summary).toBe('Headless Mitigation: navigator.webdriver');
    });

    test('should format performance_stats event summary', () => {
      const psEvent: PerformanceStatsEvent = {
        id: 'ps-test',
        timestamp: 1640995201100,
        sessionId: 'session-1',
        type: 'performance_stats',
        method: 'performance_monitor',
        operation: 'performance_monitoring',
        uptime: 5000,
        totalEventsProcessed: 100,
        eventsAccepted: 95,
        eventsRejected: 5,
        eventsRateLimited: 0,
        eventsDeduplicated: 10,
        acceptanceRate: '95.00%',
        maxEventsPerSecond: 50
      };
      const formatter = new TimelineFormatter([psEvent]);
      const timeline = formatter.formatTimeline();
      expect(timeline[0]?.summary).toContain('Performance Stats: performance_monitoring');
      expect(timeline[0]?.summary).toContain('uptime: 5000ms');
    });

    test('should format performance_warning event summary', () => {
      const pwEvent: PerformanceWarningEvent = {
        id: 'pw-test',
        timestamp: 1640995201200,
        sessionId: 'session-1',
        type: 'performance_warning',
        method: 'setTimeout',
        operation: 'short_timeout_detected',
        delay: 5,
        warning: 'Timeout less than 10ms detected'
      };
      const formatter = new TimelineFormatter([pwEvent]);
      const timeline = formatter.formatTimeline();
      expect(timeline[0]?.summary).toBe('Performance Warning: setTimeout - Timeout less than 10ms detected');
    });

    test('should format service_worker event summary', () => {
      const swEvent: ServiceWorkerEvent = {
        id: 'sw-test',
        timestamp: 1640995201300,
        sessionId: 'session-1',
        type: 'service_worker',
        eventType: 'register',
        scriptUrl: '/service-worker.js',
        scope: '/'
      };
      const formatter = new TimelineFormatter([swEvent]);
      const timeline = formatter.formatTimeline();
      expect(timeline[0]?.summary).toContain('Service Worker: register');
      expect(timeline[0]?.summary).toContain('/service-worker.js');
    });

    test('should format code_execution event summary', () => {
      const codeEvent: CodeExecutionEvent = {
        id: 'code-test',
        timestamp: 1640995201400,
        sessionId: 'session-1',
        type: 'code_execution',
        method: 'eval',
        operation: 'execute',
        code: 'console.log("malicious code"); alert("warning");',
        codeLength: 48
      };
      const formatter = new TimelineFormatter([codeEvent]);
      const timeline = formatter.formatTimeline();
      expect(timeline[0]?.summary).toContain('Code Execution: eval(console.log("malicious code");');
    });

    test('should format encoding event summary', () => {
      const encEvent: EncodingEvent = {
        id: 'enc-test',
        timestamp: 1640995201500,
        sessionId: 'session-1',
        type: 'encoding',
        method: 'atob',
        operation: 'decode',
        output: 'decoded string output',
        outputLength: 20,
        success: true
      };
      const formatter = new TimelineFormatter([encEvent]);
      const timeline = formatter.formatTimeline();
      expect(timeline[0]?.summary).toContain('Encoding: atob.decode -> decoded string output...');
    });

    test('should format cryptojs event summary with algorithm', () => {
      const cryptoEvent: CryptoJSEvent = {
        id: 'crypto-test',
        timestamp: 1640995201600,
        sessionId: 'session-1',
        type: 'cryptojs',
        method: 'AES.decrypt',
        operation: 'decrypt',
        algorithm: 'AES',
        key: 'secretkey123',
        output: 'decrypted plaintext',
        outputLength: 18,
        success: true
      };
      const formatter = new TimelineFormatter([cryptoEvent]);
      const timeline = formatter.formatTimeline();
      expect(timeline[0]?.summary).toContain('CryptoJS: AES.decrypt.decrypt (AES)');
      expect(timeline[0]?.summary).toContain('key=secretkey123');
    });

    test('should format cryptojs event summary with encoding', () => {
      const cryptoEvent: CryptoJSEvent = {
        id: 'crypto-enc-test',
        timestamp: 1640995201700,
        sessionId: 'session-1',
        type: 'cryptojs',
        method: 'enc.Base64.parse',
        operation: 'parse',
        encoding: 'Base64',
        output: 'parsed data',
        outputLength: 11,
        success: true
      };
      const formatter = new TimelineFormatter([cryptoEvent]);
      const timeline = formatter.formatTimeline();
      expect(timeline[0]?.summary).toContain('CryptoJS: enc.Base64.parse.parse (Base64)');
    });

    test('should format script_injection event summary', () => {
      const siEvent: ScriptInjectionEvent = {
        id: 'si-test',
        timestamp: 1640995201800,
        sessionId: 'session-1',
        type: 'script_injection',
        method: 'innerHTML',
        htmlContent: '<script>alert("xss")</script><div>content</div>',
        htmlLength: 47,
        containsScriptTag: true,
        scriptTagCount: 1
      };
      const formatter = new TimelineFormatter([siEvent]);
      const timeline = formatter.formatTimeline();
      expect(timeline[0]?.summary).toContain('Script Injection: innerHTML (<script>alert("xss")</script><div>content</div>...');
    });

    test('should format event_handler event summary', () => {
      const ehEvent: EventHandlerEvent = {
        id: 'eh-test',
        timestamp: 1640995201900,
        sessionId: 'session-1',
        type: 'event_handler',
        eventType: 'property_set',
        handlerName: 'onclick',
        handlerCode: 'function() { window.location = "http://evil.com"; }',
        element: 'button#submit',
        method: 'property_assignment'
      };
      const formatter = new TimelineFormatter([ehEvent]);
      const timeline = formatter.formatTimeline();
      expect(timeline[0]?.summary).toContain('Event Handler: onclick on button#submit');
    });

    test('should format blob create event summary', () => {
      const blobEvent: BlobEvent = {
        id: 'blob-create-test',
        timestamp: 1640995202000,
        sessionId: 'session-1',
        type: 'blob',
        eventType: 'blob_create',
        blobType: 'text/javascript',
        blobSize: 1024
      };
      const formatter = new TimelineFormatter([blobEvent]);
      const timeline = formatter.formatTimeline();
      expect(timeline[0]?.summary).toBe('Blob Create: text/javascript (1024 bytes)');
    });

    test('should format blob url create event summary', () => {
      const blobEvent: BlobEvent = {
        id: 'blob-url-test',
        timestamp: 1640995202100,
        sessionId: 'session-1',
        type: 'blob',
        eventType: 'blob_url_create',
        blobUrl: 'blob:http://example.com/abc123',
        blobType: 'application/javascript'
      };
      const formatter = new TimelineFormatter([blobEvent]);
      const timeline = formatter.formatTimeline();
      expect(timeline[0]?.summary).toBe('Blob URL Create: blob:http://example.com/abc123 (application/javascript)');
    });

    test('should format blob url revoke event summary', () => {
      const blobEvent: BlobEvent = {
        id: 'blob-revoke-test',
        timestamp: 1640995202200,
        sessionId: 'session-1',
        type: 'blob',
        eventType: 'blob_url_revoke',
        blobUrl: 'blob:http://example.com/abc123'
      };
      const formatter = new TimelineFormatter([blobEvent]);
      const timeline = formatter.formatTimeline();
      expect(timeline[0]?.summary).toBe('Blob URL Revoke: blob:http://example.com/abc123');
    });

    test('should format url_execution event summary', () => {
      const urlEvent: URLExecutionEvent = {
        id: 'url-exec-test',
        timestamp: 1640995202300,
        sessionId: 'session-1',
        type: 'url_execution',
        eventType: 'location_href_set',
        url: 'javascript:alert("xss")',
        code: 'alert("xss")'
      };
      const formatter = new TimelineFormatter([urlEvent]);
      const timeline = formatter.formatTimeline();
      expect(timeline[0]?.summary).toContain('JavaScript URL: location_href_set (alert("xss")');
    });

    test('should format worker create event summary', () => {
      const workerEvent: WorkerEvent = {
        id: 'worker-create-test',
        timestamp: 1640995202400,
        sessionId: 'session-1',
        type: 'worker',
        eventType: 'worker_create',
        workerType: 'Worker',
        scriptURL: '/worker.js'
      };
      const formatter = new TimelineFormatter([workerEvent]);
      const timeline = formatter.formatTimeline();
      expect(timeline[0]?.summary).toBe('Worker Create: Worker (/worker.js)');
    });

    test('should format worker postmessage event summary', () => {
      const workerEvent: WorkerEvent = {
        id: 'worker-msg-test',
        timestamp: 1640995202500,
        sessionId: 'session-1',
        type: 'worker',
        eventType: 'worker_postmessage',
        workerType: 'Worker',
        scriptURL: '/worker.js',
        message: 'message data here',
        direction: 'to_worker'
      };
      const formatter = new TimelineFormatter([workerEvent]);
      const timeline = formatter.formatTimeline();
      expect(timeline[0]?.summary).toContain('Worker PostMessage: to_worker (message data here');
    });

    test('should format worker message event summary', () => {
      const workerEvent: WorkerEvent = {
        id: 'worker-msg2-test',
        timestamp: 1640995202600,
        sessionId: 'session-1',
        type: 'worker',
        eventType: 'worker_message',
        workerType: 'Worker',
        scriptURL: '/worker.js',
        message: 'response from worker',
        direction: 'from_worker'
      };
      const formatter = new TimelineFormatter([workerEvent]);
      const timeline = formatter.formatTimeline();
      expect(timeline[0]?.summary).toContain('Worker Message: from_worker (response from worker');
    });

    test('should format worker error event summary', () => {
      const workerEvent: WorkerEvent = {
        id: 'worker-error-test',
        timestamp: 1640995202700,
        sessionId: 'session-1',
        type: 'worker',
        eventType: 'worker_error',
        workerType: 'Worker',
        scriptURL: '/worker.js',
        error: 'Worker script failed to load'
      };
      const formatter = new TimelineFormatter([workerEvent]);
      const timeline = formatter.formatTimeline();
      expect(timeline[0]?.summary).toBe('Worker Error: Worker script failed to load');
    });

    test('should format module inline event summary', () => {
      const moduleEvent: ModuleEvent = {
        id: 'module-inline-test',
        timestamp: 1640995202800,
        sessionId: 'session-1',
        type: 'module',
        eventType: 'module_script_inject',
        isInline: true,
        content: 'import { malware } from "./evil.js"; malware.run();'
      };
      const formatter = new TimelineFormatter([moduleEvent]);
      const timeline = formatter.formatTimeline();
      expect(timeline[0]?.summary).toContain('Module Script Inject: inline (import { malware } from "./evil.js"; malware.run()');
      expect(timeline[0]?.summary).toContain('...');
    });

    test('should format module external event summary', () => {
      const moduleEvent: ModuleEvent = {
        id: 'module-external-test',
        timestamp: 1640995202900,
        sessionId: 'session-1',
        type: 'module',
        eventType: 'module_script_inject',
        isInline: false,
        src: 'https://evil.com/malware.mjs'
      };
      const formatter = new TimelineFormatter([moduleEvent]);
      const timeline = formatter.formatTimeline();
      expect(timeline[0]?.summary).toBe('Module Script Inject: https://evil.com/malware.mjs');
    });

    test('should format iframe create event summary', () => {
      const iframeEvent: IframeEvent = {
        id: 'iframe-create-test',
        timestamp: 1640995203000,
        sessionId: 'session-1',
        type: 'iframe',
        eventType: 'iframe_create',
        element: 'iframe#malicious',
        src: 'https://evil.com/phishing.html',
        scriptCount: 3
      };
      const formatter = new TimelineFormatter([iframeEvent]);
      const timeline = formatter.formatTimeline();
      expect(timeline[0]?.summary).toBe('Iframe Create: https://evil.com/phishing.html (3 scripts)');
    });

    test('should format iframe srcdoc event summary', () => {
      const iframeEvent: IframeEvent = {
        id: 'iframe-srcdoc-test',
        timestamp: 1640995203100,
        sessionId: 'session-1',
        type: 'iframe',
        eventType: 'iframe_srcdoc_set',
        element: 'iframe#embedded',
        scriptCount: 2
      };
      const formatter = new TimelineFormatter([iframeEvent]);
      const timeline = formatter.formatTimeline();
      expect(timeline[0]?.summary).toBe('Iframe Srcdoc Set: iframe#embedded (2 scripts)');
    });

    test('should format iframe eval event summary', () => {
      const iframeEvent: IframeEvent = {
        id: 'iframe-eval-test',
        timestamp: 1640995203200,
        sessionId: 'session-1',
        type: 'iframe',
        eventType: 'iframe_eval',
        element: 'iframe#sandbox',
        code: 'window.parent.postMessage("stolen data", "*");'
      };
      const formatter = new TimelineFormatter([iframeEvent]);
      const timeline = formatter.formatTimeline();
      expect(timeline[0]?.summary).toContain('Iframe Eval: window.parent.postMessage("stolen data", "*");');
    });

    // Branch coverage tests
    test('should format text with multiple simultaneous events showing individual bullets', () => {
      const simultaneousEvents: MonitoringEvent[] = [
        {
          id: 'event1',
          timestamp: 1640995203300,
          sessionId: 'session-1',
          type: 'console',
          level: 'log',
          message: 'First event',
          args: []
        } as ConsoleEvent,
        {
          id: 'event2',
          timestamp: 1640995203300,
          sessionId: 'session-1',
          type: 'network',
          method: 'POST',
          url: 'https://api.example.com/data'
        } as NetworkEvent,
        {
          id: 'event3',
          timestamp: 1640995203300,
          sessionId: 'session-1',
          type: 'storage',
          storageType: 'localStorage',
          operation: 'set',
          key: 'token'
        } as StorageEvent
      ];

      const formatter = new TimelineFormatter(simultaneousEvents);
      const text = formatter.formatAsText();

      // Should indicate multiple events
      expect(text).toContain('(3 events)');
      // Should have individual bullet points for each event
      expect(text).toMatch(/\s+-\s+/);
      // Should contain summaries from all events
      expect(text).toContain('console');
      expect(text).toContain('network');
      expect(text).toContain('storage');
    });

    // Edge case tests
    test('should handle empty filtered timeline', () => {
      const events: MonitoringEvent[] = [
        {
          id: 'event1',
          timestamp: 1000,
          sessionId: 'session-1',
          type: 'console',
          level: 'log',
          message: 'Test',
          args: []
        } as ConsoleEvent
      ];

      const formatter = new TimelineFormatter(events);
      const timeline = formatter.formatTimeline({ start: 2000, end: 3000 });

      expect(timeline).toEqual([]);
    });

    test('should handle empty filtered timeline in text format', () => {
      const events: MonitoringEvent[] = [
        {
          id: 'event1',
          timestamp: 1000,
          sessionId: 'session-1',
          type: 'console',
          level: 'log',
          message: 'Test',
          args: []
        } as ConsoleEvent
      ];

      const formatter = new TimelineFormatter(events);
      const text = formatter.formatAsText({ start: 2000, end: 3000 });

      expect(text).toBe('No events found in the specified time range.');
    });

    test('should group events within 50ms tolerance', () => {
      const events: MonitoringEvent[] = [
        {
          id: 'event1',
          timestamp: 1000,
          sessionId: 'session-1',
          type: 'console',
          level: 'log',
          message: 'Event 1',
          args: []
        } as ConsoleEvent,
        {
          id: 'event2',
          timestamp: 1049,  // Within 50ms - should group
          sessionId: 'session-1',
          type: 'console',
          level: 'log',
          message: 'Event 2',
          args: []
        } as ConsoleEvent,
        {
          id: 'event3',
          timestamp: 1051,  // Outside 50ms - separate group
          sessionId: 'session-1',
          type: 'console',
          level: 'log',
          message: 'Event 3',
          args: []
        } as ConsoleEvent
      ];

      const formatter = new TimelineFormatter(events);
      const timeline = formatter.formatTimeline();

      // Should create 2 groups, not 3
      expect(timeline.length).toBe(2);
      // First group should have 2 events
      expect(timeline[0]?.events.length).toBe(2);
      // Second group should have 1 event
      expect(timeline[1]?.events.length).toBe(1);
    });

    test('should handle events with missing optional fields', () => {
      const event: NetworkEvent = {
        id: 'minimal-net-event',
        timestamp: 1640995203400,
        sessionId: 'session-1',
        type: 'network',
        method: 'GET',
        url: 'https://example.com'
        // Missing: status, statusText, headers, duration, etc.
      };

      const formatter = new TimelineFormatter([event]);
      const summary = formatter.formatTimeline()[0]?.summary;

      // Should not crash and should produce a summary
      expect(summary).toBeTruthy();
      expect(summary).toContain('GET');
      expect(summary).toContain('https://example.com');
    });

    test('should handle encoding event with missing message field in worker', () => {
      const workerEvent: WorkerEvent = {
        id: 'worker-no-msg',
        timestamp: 1640995203500,
        sessionId: 'session-1',
        type: 'worker',
        eventType: 'worker_postmessage',
        workerType: 'Worker',
        scriptURL: '/worker.js',
        direction: 'to_worker'
        // message field is missing
      };

      const formatter = new TimelineFormatter([workerEvent]);
      const summary = formatter.formatTimeline()[0]?.summary;

      // Should handle missing message gracefully
      expect(summary).toBeTruthy();
      expect(summary).toContain('Worker PostMessage');
    });

    test('should handle module event without content', () => {
      const moduleEvent: ModuleEvent = {
        id: 'module-no-content',
        timestamp: 1640995203600,
        sessionId: 'session-1',
        type: 'module',
        eventType: 'module_script_inject',
        isInline: true
        // content field is missing
      };

      const formatter = new TimelineFormatter([moduleEvent]);
      const summary = formatter.formatTimeline()[0]?.summary;

      // Should handle missing content gracefully
      expect(summary).toBeTruthy();
      expect(summary).toContain('Module Script Inject: inline');
    });

    test('should handle iframe create without src (inline srcdoc)', () => {
      const iframeEvent: IframeEvent = {
        id: 'iframe-no-src',
        timestamp: 1640995203700,
        sessionId: 'session-1',
        type: 'iframe',
        eventType: 'iframe_create',
        element: 'iframe#inline',
        scriptCount: 1
        // src field is missing
      };

      const formatter = new TimelineFormatter([iframeEvent]);
      const summary = formatter.formatTimeline()[0]?.summary;

      // Should show 'inline srcdoc' when src is missing
      expect(summary).toBeTruthy();
      expect(summary).toContain('inline srcdoc');
    });

    test('should handle time grouping at exact 50ms boundary', () => {
      const events: MonitoringEvent[] = [
        {
          id: 'event1',
          timestamp: 1000,
          sessionId: 'session-1',
          type: 'console',
          level: 'log',
          message: 'Event 1',
          args: []
        } as ConsoleEvent,
        {
          id: 'event2',
          timestamp: 1050,  // Exactly 50ms - should still group
          sessionId: 'session-1',
          type: 'console',
          level: 'log',
          message: 'Event 2',
          args: []
        } as ConsoleEvent
      ];

      const formatter = new TimelineFormatter(events);
      const timeline = formatter.formatTimeline();

      // Should group events at exactly 50ms boundary
      expect(timeline.length).toBe(1);
      expect(timeline[0]?.events.length).toBe(2);
    });
  });

  // Phase 4: CorrelationEngine Testing (Focus: Complex matching logic)

  describe('CorrelationEngine', () => {
    let tempFilePath: string;
    let correlationEngine: CorrelationEngine;

    // Load default rules from correlation_rules.json for testing
    const loadDefaultRules = (): CorrelationRule[] => {
      const rulesPath = resolve(process.cwd(), 'correlation_rules.json');
      const content = readFileSync(rulesPath, 'utf-8');
      const parsed = JSON.parse(content) as { rules: CorrelationRule[] };
      return parsed.rules;
    };

    beforeEach(() => {
      // Create temp file with correlation test data
      tempFilePath = `/tmp/correlation-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jsonl`;
    });

    afterEach(() => {
      try {
        unlinkSync(tempFilePath);
      } catch {
        // ignore if file doesn't exist
      }
    });

    test('should initialize with correlation rules', () => {
      const queryEngine = new QueryEngine();
      const rules = loadDefaultRules();
      correlationEngine = new CorrelationEngine(queryEngine, rules);
      expect(correlationEngine).toBeDefined();
      expect(correlationEngine.getAvailableRules()).toHaveLength(rules.length);
    });

    test('should find storage-to-network correlations', async () => {
      const correlationData = [
        {
          id: 'storage-1',
          timestamp: 1640995200000,
          sessionId: 'session-1',
          type: 'storage',
          storageType: 'localStorage',
          operation: 'set',
          key: 'token'
        } as StorageEvent,
        {
          id: 'network-1',
          timestamp: 1640995200500,
          sessionId: 'session-1',
          type: 'network',
          method: 'GET',
          url: 'https://api.example.com/data'
        } as NetworkEvent,
        {
          id: 'storage-2',
          timestamp: 1640995201000,
          sessionId: 'session-2',
          type: 'storage',
          storageType: 'localStorage',
          operation: 'set',
          key: 'data'
        } as StorageEvent,
        {
          id: 'network-2',
          timestamp: 1640995201500,
          sessionId: 'session-2',
          type: 'network',
          method: 'POST',
          url: 'https://api.example.com/save'
        } as NetworkEvent
      ];

      writeFileSync(tempFilePath, correlationData.map(event => JSON.stringify(event)).join('\n'));

      correlationEngine = new CorrelationEngine(new QueryEngine(), loadDefaultRules());
      const correlations = await correlationEngine.findCorrelations(tempFilePath, 'storage-to-network');

      expect(correlations).toHaveLength(2);
      expect(correlations[0]?.chainType).toBe('storage-to-network');
      expect(correlations[0]?.events).toHaveLength(2);
      expect(correlations[0]?.correlationId).toBe('session-1');
    });

    test('should find network request-response pairs', async () => {
      const correlationData = [
        {
          id: 'network-1',
          timestamp: 1640995200000,
          sessionId: 'session-1',
          type: 'network',
          method: 'POST',
          url: 'https://api.example.com/login',
          correlationId: 'req-1'
        } as NetworkEvent,
        {
          id: 'network-2',
          timestamp: 1640995200100,
          sessionId: 'session-1',
          type: 'network',
          method: 'GET',
          url: 'https://api.example.com/data',
          correlationId: 'req-1'
        } as NetworkEvent
      ];

      writeFileSync(tempFilePath, correlationData.map(event => JSON.stringify(event)).join('\n'));

      correlationEngine = new CorrelationEngine(new QueryEngine(), loadDefaultRules());
      const correlations = await correlationEngine.findCorrelations(tempFilePath, 'network-request-response');

      expect(correlations).toHaveLength(1);
      expect(correlations[0]?.chainType).toBe('network-request-response');
      expect(correlations[0]?.events).toHaveLength(2);
      expect(correlations[0]?.correlationId).toBe('req-1');
    });

    test('should find error chains', async () => {
      const correlationData = [
        {
          id: 'network-1',
          timestamp: 1640995200000,
          sessionId: 'session-1',
          type: 'network',
          method: 'GET',
          url: 'https://api.example.com/fail',
          status: 500,
          correlationId: 'req-1'
        } as NetworkEvent,
        {
          id: 'error-1',
          timestamp: 1640995200100,
          sessionId: 'session-1',
          type: 'error',
          message: 'Network request failed',
          correlationId: 'req-1'
        } as ErrorEvent
      ];

      writeFileSync(tempFilePath, correlationData.map(event => JSON.stringify(event)).join('\n'));

      correlationEngine = new CorrelationEngine(new QueryEngine(), loadDefaultRules());
      const correlations = await correlationEngine.findCorrelations(tempFilePath, 'error-chains');

      expect(correlations).toHaveLength(1);
      expect(correlations[0]?.chainType).toBe('error-chains');
      expect(correlations[0]?.events).toHaveLength(2);
      expect(correlations[0]?.correlationId).toBe('req-1');
    });

    test('should find timer-to-network sequences', async () => {
      const correlationData = [
        {
          id: 'timer-1',
          timestamp: 1640995200000,
          sessionId: 'session-1',
          type: 'timer',
          timerType: 'setTimeout',
          operation: 'create'
        } as TimerEvent,
        {
          id: 'network-1',
          timestamp: 1640995200500,
          sessionId: 'session-1',
          type: 'network',
          method: 'GET',
          url: 'https://api.example.com/poll',
          correlationId: 'timer-1'
        } as NetworkEvent
      ];

      writeFileSync(tempFilePath, correlationData.map(event => JSON.stringify(event)).join('\n'));

      correlationEngine = new CorrelationEngine(new QueryEngine(), loadDefaultRules());
      const correlations = await correlationEngine.findCorrelations(tempFilePath, 'timer-to-network');

      expect(correlations).toHaveLength(1);
      expect(correlations[0]?.chainType).toBe('timer-to-network');
      expect(correlations[0]?.events).toHaveLength(2);
      expect(correlations[0]?.correlationId).toBe('session-1');
    });

    test('should return all correlations when no rule specified', async () => {
      const correlationData = [
        {
          id: 'storage-1',
          timestamp: 1640995200000,
          sessionId: 'session-1',
          type: 'storage',
          storageType: 'localStorage',
          operation: 'set',
          key: 'token'
        } as StorageEvent,
        {
          id: 'network-1',
          timestamp: 1640995200500,
          sessionId: 'session-1',
          type: 'network',
          method: 'GET',
          url: 'https://api.example.com/data'
        } as NetworkEvent,
        {
          id: 'network-2',
          timestamp: 1640995201000,
          sessionId: 'session-2',
          type: 'network',
          method: 'POST',
          url: 'https://api.example.com/login',
          correlationId: 'req-1'
        } as NetworkEvent,
        {
          id: 'network-3',
          timestamp: 1640995201100,
          sessionId: 'session-2',
          type: 'network',
          method: 'GET',
          url: 'https://api.example.com/status',
          correlationId: 'req-1'
        } as NetworkEvent
      ];

      writeFileSync(tempFilePath, correlationData.map(event => JSON.stringify(event)).join('\n'));

      correlationEngine = new CorrelationEngine(new QueryEngine(), loadDefaultRules());
      const correlations = await correlationEngine.findCorrelations(tempFilePath);

      expect(correlations.length).toBeGreaterThan(0);
      // Should find both storage-to-network and network-request-response correlations
      const ruleNames = correlations.map(c => c.chainType);
      expect(ruleNames).toContain('storage-to-network');
      expect(ruleNames).toContain('network-request-response');
    });

    test('should throw error for non-existent correlation rule', async () => {
      correlationEngine = new CorrelationEngine(new QueryEngine(), loadDefaultRules());
      await expect(correlationEngine.findCorrelations('/tmp/empty.jsonl', 'non-existent-rule'))
        .rejects.toThrow('Correlation rule \'non-existent-rule\' not found');
    });

    test('should handle time gaps in sequence correlations', async () => {
      const correlationData = [
        {
          id: 'storage-1',
          timestamp: 1640995200000,
          sessionId: 'session-1',
          type: 'storage',
          storageType: 'localStorage',
          operation: 'set',
          key: 'data'
        } as StorageEvent,
        // Large gap that exceeds the 5-second maxTimeGap for storage-to-network rule
        {
          id: 'network-1',
          timestamp: 1640995210000, // 10 seconds later
          sessionId: 'session-1',
          type: 'network',
          method: 'GET',
          url: 'https://api.example.com/data'
        } as NetworkEvent
      ];

      writeFileSync(tempFilePath, correlationData.map(event => JSON.stringify(event)).join('\n'));

      correlationEngine = new CorrelationEngine(new QueryEngine(), loadDefaultRules());
      const correlations = await correlationEngine.findCorrelations(tempFilePath, 'storage-to-network');

      expect(correlations).toHaveLength(0); // Should not find correlation due to time gap
    });

    test('should find multiple sequences in the same correlation group', async () => {
      const correlationData = [
        {
          id: 'storage-1',
          timestamp: 1640995200000,
          sessionId: 'session-1',
          type: 'storage',
          storageType: 'localStorage',
          operation: 'set',
          key: 'data1'
        } as StorageEvent,
        {
          id: 'network-1',
          timestamp: 1640995200500,
          sessionId: 'session-1',
          type: 'network',
          method: 'GET',
          url: 'https://api.example.com/data1'
        } as NetworkEvent,
        {
          id: 'storage-2',
          timestamp: 1640995201000,
          sessionId: 'session-1',
          type: 'storage',
          storageType: 'localStorage',
          operation: 'set',
          key: 'data2'
        } as StorageEvent,
        {
          id: 'network-2',
          timestamp: 1640995201500,
          sessionId: 'session-1',
          type: 'network',
          method: 'GET',
          url: 'https://api.example.com/data2'
        } as NetworkEvent
      ];

      writeFileSync(tempFilePath, correlationData.map(event => JSON.stringify(event)).join('\n'));

      correlationEngine = new CorrelationEngine(new QueryEngine(), loadDefaultRules());
      const correlations = await correlationEngine.findCorrelations(tempFilePath, 'storage-to-network');

      expect(correlations).toHaveLength(2);
      expect(correlations.every(c => c.chainType === 'storage-to-network')).toBe(true);
    });

    test('should sort correlations by start time', async () => {
      const correlationData = [
        // Sequence 2 - starts later
        {
          id: 'storage-2',
          timestamp: 1640995201000,
          sessionId: 'session-1',
          type: 'storage',
          storageType: 'localStorage',
          operation: 'set',
          key: 'data2'
        } as StorageEvent,
        {
          id: 'network-2',
          timestamp: 1640995201500,
          sessionId: 'session-1',
          type: 'network',
          method: 'GET',
          url: 'https://api.example.com/data2'
        } as NetworkEvent,
        // Sequence 1 - starts earlier
        {
          id: 'storage-1',
          timestamp: 1640995200000,
          sessionId: 'session-1',
          type: 'storage',
          storageType: 'localStorage',
          operation: 'set',
          key: 'data1'
        } as StorageEvent,
        {
          id: 'network-1',
          timestamp: 1640995200500,
          sessionId: 'session-1',
          type: 'network',
          method: 'GET',
          url: 'https://api.example.com/data1'
        } as NetworkEvent
      ];

      writeFileSync(tempFilePath, correlationData.map(event => JSON.stringify(event)).join('\n'));

      correlationEngine = new CorrelationEngine(new QueryEngine(), loadDefaultRules());
      const correlations = await correlationEngine.findCorrelations(tempFilePath, 'storage-to-network');

      expect(correlations).toHaveLength(2);
      expect(correlations[0]?.timeSpan.start).toBe(1640995200000); // First sequence
      expect(correlations[1]?.timeSpan.start).toBe(1640995201000); // Second sequence
    });

    test('should calculate correct time spans for correlations', async () => {
      const correlationData = [
        {
          id: 'storage-1',
          timestamp: 1640995200000,
          sessionId: 'session-1',
          type: 'storage',
          storageType: 'localStorage',
          operation: 'set',
          key: 'data'
        } as StorageEvent,
        {
          id: 'network-1',
          timestamp: 1640995200500,
          sessionId: 'session-1',
          type: 'network',
          method: 'GET',
          url: 'https://api.example.com/data'
        } as NetworkEvent
      ];

      writeFileSync(tempFilePath, correlationData.map(event => JSON.stringify(event)).join('\n'));

      correlationEngine = new CorrelationEngine(new QueryEngine(), loadDefaultRules());
      const correlations = await correlationEngine.findCorrelations(tempFilePath, 'storage-to-network');

      expect(correlations).toHaveLength(1);
      const correlation = correlations[0]!;
      expect(correlation.timeSpan.start).toBe(1640995200000);
      expect(correlation.timeSpan.end).toBe(1640995200500);
      expect(correlation.timeSpan.duration).toBe(500);
    });

    test('should handle correlationId field as correlation key', async () => {
      const correlationData = [
        {
          id: 'network-1',
          timestamp: 1640995200000,
          sessionId: 'session-1',
          type: 'network',
          method: 'POST',
          url: 'https://api.example.com/start',
          correlationId: 'request-1'
        } as NetworkEvent,
        {
          id: 'network-2',
          timestamp: 1640995200100,
          sessionId: 'session-2', // Different session, but same correlationId
          type: 'network',
          method: 'GET',
          url: 'https://api.example.com/status',
          correlationId: 'request-1'
        } as NetworkEvent
      ];

      writeFileSync(tempFilePath, correlationData.map(event => JSON.stringify(event)).join('\n'));

      correlationEngine = new CorrelationEngine(new QueryEngine(), loadDefaultRules());
      const correlations = await correlationEngine.findCorrelations(tempFilePath, 'network-request-response');

      expect(correlations).toHaveLength(1);
      expect(correlations[0]?.correlationId).toBe('request-1');
    });

    test('should handle URL field as correlation key', async () => {
      // This tests the fallback to sessionId when correlationId is missing
      const correlationData = [
        {
          id: 'storage-1',
          timestamp: 1640995200000,
          sessionId: 'session-1',
          type: 'storage',
          storageType: 'localStorage',
          operation: 'set',
          key: 'data'
        } as StorageEvent,
        {
          id: 'network-1',
          timestamp: 1640995200500,
          sessionId: 'session-1', // Same sessionId (fallback correlation key)
          type: 'network',
          method: 'GET',
          url: 'https://api.example.com/data'
          // No correlationId
        } as NetworkEvent
      ];

      writeFileSync(tempFilePath, correlationData.map(event => JSON.stringify(event)).join('\n'));

      correlationEngine = new CorrelationEngine(new QueryEngine(), loadDefaultRules());
      const correlations = await correlationEngine.findCorrelations(tempFilePath, 'storage-to-network');

      expect(correlations).toHaveLength(1);
      expect(correlations[0]?.correlationId).toBe('session-1');
    });

    test('should not find groups with fewer than 2 events', async () => {
      const correlationData = [
        {
          id: 'network-1',
          timestamp: 1640995200000,
          sessionId: 'session-1',
          type: 'network',
          method: 'POST',
          url: 'https://api.example.com/single',
          correlationId: 'single-req'
        } as NetworkEvent
        // Only one network event, should not form a group
      ];

      writeFileSync(tempFilePath, correlationData.map(event => JSON.stringify(event)).join('\n'));

      correlationEngine = new CorrelationEngine(new QueryEngine(), loadDefaultRules());
      const correlations = await correlationEngine.findCorrelations(tempFilePath, 'network-request-response');

      expect(correlations).toHaveLength(0);
    });

    test('should restart sequence when time gap resets and new valid sequence starts', async () => {
      const correlationData = [
        {
          id: 'storage-1',
          timestamp: 1640995200000,
          sessionId: 'session-1',
          type: 'storage',
          storageType: 'localStorage',
          operation: 'set',
          key: 'data1'
        } as StorageEvent,
        {
          id: 'network-1',
          timestamp: 1640995201000,
          sessionId: 'session-1',
          type: 'network',
          method: 'GET',
          url: 'https://api.example.com/data1'
        } as NetworkEvent,
        // Long gap - exceeds 5 second maxTimeGap, then another sequence
        {
          id: 'storage-2',
          timestamp: 1640995210000, // 9 seconds after network-1
          sessionId: 'session-1',
          type: 'storage',
          storageType: 'localStorage',
          operation: 'set',
          key: 'data2'
        } as StorageEvent,
        {
          id: 'network-2',
          timestamp: 1640995211000,
          sessionId: 'session-1',
          type: 'network',
          method: 'POST',
          url: 'https://api.example.com/data2'
        } as NetworkEvent
      ];

      writeFileSync(tempFilePath, correlationData.map(event => JSON.stringify(event)).join('\n'));

      correlationEngine = new CorrelationEngine(new QueryEngine(), loadDefaultRules());
      const correlations = await correlationEngine.findCorrelations(tempFilePath, 'storage-to-network');

      // Should find two separate correlations (time gap caused chain restart)
      expect(correlations).toHaveLength(2);
      expect(correlations[0]?.events[0]?.id).toBe('storage-1');
      expect(correlations[1]?.events[0]?.id).toBe('storage-2');
    });

    test('should handle out-of-order event types in sequences', async () => {
      const correlationData = [
        {
          id: 'network-1',
          timestamp: 1640995200000,
          sessionId: 'session-1',
          type: 'network',
          method: 'GET',
          url: 'https://api.example.com/data'
        } as NetworkEvent,
        {
          id: 'storage-1',
          timestamp: 1640995200100,
          sessionId: 'session-1',
          type: 'storage',
          storageType: 'localStorage',
          operation: 'set',
          key: 'data'
        } as StorageEvent,
        {
          id: 'network-2',
          timestamp: 1640995200200,
          sessionId: 'session-1',
          type: 'network',
          method: 'POST',
          url: 'https://api.example.com/save'
        } as NetworkEvent
      ];

      writeFileSync(tempFilePath, correlationData.map(event => JSON.stringify(event)).join('\n'));

      correlationEngine = new CorrelationEngine(new QueryEngine(), loadDefaultRules());
      const correlations = await correlationEngine.findCorrelations(tempFilePath, 'storage-to-network');

      // Should find one correlation starting from storage-1 to network-2
      expect(correlations).toHaveLength(1);
      expect(correlations[0]?.events[0]?.id).toBe('storage-1');
      expect(correlations[0]?.events[1]?.id).toBe('network-2');
    });

    test('should handle groups with time gaps exceeding threshold', async () => {
      const correlationData = [
        {
          id: 'network-1',
          timestamp: 1640995200000,
          sessionId: 'session-1',
          type: 'network',
          method: 'POST',
          url: 'https://api.example.com/start',
          correlationId: 'req-1'
        } as NetworkEvent,
        {
          id: 'network-2',
          timestamp: 1640995200100,
          sessionId: 'session-1',
          type: 'network',
          method: 'GET',
          url: 'https://api.example.com/status',
          correlationId: 'req-1'
        } as NetworkEvent,
        // Large time gap exceeding 10 second maxTimeGap
        {
          id: 'network-3',
          timestamp: 1640995220000, // 20 seconds later
          sessionId: 'session-1',
          type: 'network',
          method: 'GET',
          url: 'https://api.example.com/final',
          correlationId: 'req-1'
        } as NetworkEvent
      ];

      writeFileSync(tempFilePath, correlationData.map(event => JSON.stringify(event)).join('\n'));

      correlationEngine = new CorrelationEngine(new QueryEngine(), loadDefaultRules());
      const correlations = await correlationEngine.findCorrelations(tempFilePath, 'network-request-response');

      // Should find one group with first two events (third is separated by time gap)
      expect(correlations).toHaveLength(1);
      expect(correlations[0]?.events).toHaveLength(2);
      expect(correlations[0]?.events[0]?.id).toBe('network-1');
      expect(correlations[0]?.events[1]?.id).toBe('network-2');
    });

    test('should process final group when stream ends', async () => {
      const correlationData = [
        {
          id: 'network-1',
          timestamp: 1640995200000,
          sessionId: 'session-1',
          type: 'network',
          method: 'POST',
          url: 'https://api.example.com/start',
          correlationId: 'req-1'
        } as NetworkEvent,
        {
          id: 'network-2',
          timestamp: 1640995200100,
          sessionId: 'session-1',
          type: 'network',
          method: 'GET',
          url: 'https://api.example.com/status',
          correlationId: 'req-1'
        } as NetworkEvent,
        {
          id: 'network-3',
          timestamp: 1640995200200,
          sessionId: 'session-1',
          type: 'network',
          method: 'GET',
          url: 'https://api.example.com/final',
          correlationId: 'req-1'
        } as NetworkEvent
      ];

      writeFileSync(tempFilePath, correlationData.map(event => JSON.stringify(event)).join('\n'));

      correlationEngine = new CorrelationEngine(new QueryEngine(), loadDefaultRules());
      const correlations = await correlationEngine.findCorrelations(tempFilePath, 'network-request-response');

      // Should find one group with all three events processed at stream end
      expect(correlations).toHaveLength(1);
      expect(correlations[0]?.events).toHaveLength(3);
    });

    test('should handle events without correlation field fallback to sessionId', async () => {
      const correlationData = [
        {
          id: 'storage-1',
          timestamp: 1640995200000,
          sessionId: 'session-1',
          type: 'storage',
          storageType: 'localStorage',
          operation: 'set',
          key: 'data'
          // No correlationId, should use sessionId
        } as StorageEvent,
        {
          id: 'network-1',
          timestamp: 1640995200500,
          sessionId: 'session-1',
          type: 'network',
          method: 'GET',
          url: 'https://api.example.com/data'
          // No correlationId, should use sessionId
        } as NetworkEvent
      ];

      writeFileSync(tempFilePath, correlationData.map(event => JSON.stringify(event)).join('\n'));

      correlationEngine = new CorrelationEngine(new QueryEngine(), loadDefaultRules());
      const correlations = await correlationEngine.findCorrelations(tempFilePath, 'storage-to-network');

      // Should find correlation based on sessionId as fallback
      expect(correlations).toHaveLength(1);
      expect(correlations[0]?.correlationId).toBe('session-1');
    });
  });
});
