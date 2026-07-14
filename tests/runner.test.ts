import { describe, test, expect } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { EventLogger } from '../src/orchestrator/EventLogger.ts';
import { createEvent, validateEvent, serializeEvent, generateEventId } from '../src/schema/events.ts';

// v4 UUID: 8-4-4-4-12 hex, version nibble 4, variant nibble 8/9/a/b
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
import type { ConsoleEvent, NetworkEvent, StorageEvent, SessionConfig, MonitoringEvent } from '../src/schema/types.ts';

describe('EventLogger', () => {
  test('should initialize and log session start', () => {
    const config: SessionConfig = {
      id: 'test-session-init',
      url: 'http://example.com',
      startTime: Date.now(),
      outputPath: join(tmpdir(), 'test_init.jsonl')
    };

    const logger = new EventLogger(config);
    expect(logger.getEventCount()).toBe(0);
  });

  test('should validate and log events', async () => {
    const config: SessionConfig = {
      id: 'test-session-validate',
      url: 'http://example.com',
      startTime: Date.now(),
      outputPath: join(tmpdir(), 'test_validate.jsonl')
    };

    const logger = new EventLogger(config);

    const consoleEvent = createEvent<ConsoleEvent>(
      'test-session-validate',
      undefined,
      {
        type: 'console',
        level: 'log',
        message: 'Test message',
        args: ['test']
      }
    );

    await logger.logEvent(consoleEvent);
    expect(logger.getEventCount()).toBe(1);

    const networkEvent = createEvent<NetworkEvent>(
      'test-session-validate',
      undefined,
      {
        type: 'network',
        method: 'GET',
        url: 'http://example.com/api'
      }
    );

    await logger.logEvent(networkEvent);
    expect(logger.getEventCount()).toBe(2);
  });

  test('should log multiple events efficiently', async () => {
    const config: SessionConfig = {
      id: 'test-session-multi',
      url: 'http://example.com',
      startTime: Date.now(),
      outputPath: join(tmpdir(), 'test_multi.jsonl')
    };

    const logger = new EventLogger(config);

    const events = [
      createEvent<ConsoleEvent>('test-session-multi', undefined, {
        type: 'console',
        level: 'info',
        message: 'Info message',
        args: []
      }),
      createEvent<NetworkEvent>('test-session-multi', undefined, {
        type: 'network',
        method: 'POST',
        url: 'http://api.example.com/data'
      }),
      createEvent<StorageEvent>('test-session-multi', undefined, {
        type: 'storage',
        storageType: 'localStorage',
        operation: 'set',
        key: 'userData',
        value: 'testValue'
      })
    ];

    await logger.logEvents(events);
    expect(logger.getEventCount()).toBe(3);
  });

  test('should reject invalid events', () => {
    const config: SessionConfig = {
      id: 'test-session-reject',
      url: 'http://example.com',
      startTime: Date.now(),
      outputPath: join(tmpdir(), 'test_reject.jsonl')
    };

    const logger = new EventLogger(config);

    // Invalid event missing required fields
    const invalidEvent = {
      type: 'invalid',
      message: 'missing id, timestamp, sessionId'
    };

    logger.logEvent(invalidEvent as unknown as MonitoringEvent);
    expect(logger.getEventCount()).toBe(0); // Should not count invalid events
  });

  test('should close properly', async () => {
    const config: SessionConfig = {
      id: 'test-session-close',
      url: 'http://example.com',
      startTime: Date.now(),
      outputPath: join(tmpdir(), 'test_close.jsonl')
    };

    const logger = new EventLogger(config);

    // Add some events
    logger.logEvent(createEvent<ConsoleEvent>('test-session-close', undefined, {
      type: 'console',
      level: 'log',
      message: 'Test before close',
      args: []
    }));

    // Close the logger
    await logger.close();

    // Should be able to get final count
    expect(logger.getEventCount()).toBe(1);
  });

  test('should flush pending writes successfully', async () => {
    const config: SessionConfig = {
      id: 'test-session-flush',
      url: 'http://example.com',
      startTime: Date.now(),
      outputPath: join(tmpdir(), `test-flush-${Date.now()}.jsonl`)
    };

    const logger = new EventLogger(config);

    // Log an event
    const event = createEvent<ConsoleEvent>('test-session-flush', undefined, {
      type: 'console',
      level: 'log',
      message: 'Test message',
      args: []
    });
    await logger.logEvent(event);

    // Flush should complete without error
    await logger.flush();

    // Close the logger
    await logger.close();

    expect(logger.getEventCount()).toBe(1);
  });

  test('should handle flush on closed logger safely', async () => {
    const config: SessionConfig = {
      id: 'test-session-closed-flush',
      url: 'http://example.com',
      startTime: Date.now(),
      outputPath: join(tmpdir(), `test-closed-flush-${Date.now()}.jsonl`)
    };

    const logger = new EventLogger(config);

    // Close the logger first
    await logger.close();

    // Flush on closed logger should be a no-op (no error)
    await logger.flush();

    // Should succeed without throwing
    expect(logger.getEventCount()).toBe(0);
  });
});

describe('Schema validation', () => {
  test('should validate event structure', () => {
    const validEvent: ConsoleEvent = {
      id: 'test-id',
      timestamp: Date.now(),
      sessionId: 'session-1',
      type: 'console',
      level: 'log',
      message: 'test',
      args: []
    };

    expect(validateEvent(validEvent)).toBe(true);

    const invalidEvent = {
      type: 'invalid',
      message: 'missing required fields'
    };

    expect(validateEvent(invalidEvent)).toBe(false);
  });

  test('should serialize events correctly', () => {
    const event: ConsoleEvent = {
      id: 'test-id',
      timestamp: 1234567890,
      sessionId: 'session-1',
      type: 'console',
      level: 'log',
      message: 'test message',
      args: ['arg1', 'arg2']
    };

    const serialized = serializeEvent(event);
    const parsed = JSON.parse(serialized) as Record<string, unknown>;

    expect(parsed['id']).toBe('test-id');
    expect(parsed['type']).toBe('console');
    expect(parsed['level']).toBe('log');
  });

  test('should handle circular references in serialization', () => {
    // Create circular reference for testing serialization error handling
    const circularObj: Record<string, unknown> = { prop: 'value' };
    circularObj['self'] = circularObj;

    const event: ConsoleEvent = {
      id: 'test-id',
      timestamp: Date.now(),
      sessionId: 'session-1',
      type: 'console',
      level: 'log',
      message: 'test message',
      args: [circularObj]
    };

    const serialized = serializeEvent(event);
    expect(serialized).toContain('Event contained unserializable data');
  });
});

describe('Event creation utilities', () => {
  test('should create events with unique IDs', () => {
    const event1 = createEvent<ConsoleEvent>(
      'session-1',
      'frame-1',
      {
        type: 'console',
        level: 'log',
        message: 'message 1',
        args: []
      }
    );

    const event2 = createEvent<ConsoleEvent>(
      'session-1',
      'frame-1',
      {
        type: 'console',
        level: 'log',
        message: 'message 2',
        args: []
      }
    );

    expect(event1.id).not.toBe(event2.id);
    // M5: IDs are v4 UUIDs (previously a collision-prone 32-bit MD5 prefix).
    expect(event1.id).toMatch(UUID_V4);
    expect(event2.id).toMatch(UUID_V4);
    expect(event1.sessionId).toBe('session-1');
    expect(event1.frameId).toBe('frame-1');
    expect(event2.type).toBe('console');
  });

  test('generateEventId returns a v4 UUID and is unique', () => {
    const a = generateEventId();
    const b = generateEventId();
    expect(a).toMatch(UUID_V4);
    expect(b).toMatch(UUID_V4);
    expect(a).not.toBe(b);
  });

  test('should create different event types', () => {
    const consoleEvent = createEvent<ConsoleEvent>(
      'session-1',
      undefined,
      {
        type: 'console',
        level: 'warn',
        message: 'Warning message',
        args: ['warn']
      }
    );

    const networkEvent = createEvent<NetworkEvent>(
      'session-1',
      'frame-1',
      {
        type: 'network',
        method: 'POST',
        url: 'http://api.example.com',
        requestPayload: { data: 'test' }
      }
    );

    const storageEvent = createEvent<StorageEvent>(
      'session-1',
      undefined,
      {
        type: 'storage',
        storageType: 'localStorage',
        operation: 'set',
        key: 'testKey',
        value: 'testValue'
      }
    );

    expect(consoleEvent.level).toBe('warn');
    expect(networkEvent.method).toBe('POST');
    expect(storageEvent.storageType).toBe('localStorage');
  });
});
