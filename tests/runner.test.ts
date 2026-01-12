import { describe, test, expect } from 'bun:test';
import { EventLogger } from '../src/orchestrator/EventLogger.ts';
import { createEvent, validateEvent, serializeEvent } from '../src/schema/events.ts';
import type { ConsoleEvent, NetworkEvent, StorageEvent, SessionConfig } from '../src/schema/types.ts';

describe('EventLogger', () => {
  test('should initialize and log session start', () => {
    const config: SessionConfig = {
      id: 'test-session',
      url: 'http://example.com',
      startTime: Date.now(),
      outputPath: '/tmp/test.jsonl'
    };

    const logger = new EventLogger(config);
    expect(logger.getEventCount()).toBe(0);
  });

  test('should validate and log events', () => {
    const config: SessionConfig = {
      id: 'test-session',
      url: 'http://example.com',
      startTime: Date.now(),
      outputPath: '/tmp/test.jsonl'
    };

    const logger = new EventLogger(config);

    const consoleEvent = createEvent<ConsoleEvent>(
      'test-session',
      undefined,
      {
        type: 'console',
        level: 'log',
        message: 'Test message',
        args: ['test']
      }
    );

    logger.logEvent(consoleEvent);
    expect(logger.getEventCount()).toBe(1);

    const networkEvent = createEvent<NetworkEvent>(
      'test-session',
      undefined,
      {
        type: 'network',
        method: 'GET',
        url: 'http://example.com/api'
      }
    );

    logger.logEvent(networkEvent);
    expect(logger.getEventCount()).toBe(2);
  });

  test('should log multiple events efficiently', () => {
    const config: SessionConfig = {
      id: 'test-session',
      url: 'http://example.com',
      startTime: Date.now(),
      outputPath: '/tmp/test.jsonl'
    };

    const logger = new EventLogger(config);

    const events = [
      createEvent<ConsoleEvent>('test-session', undefined, {
        type: 'console',
        level: 'info',
        message: 'Info message',
        args: []
      }),
      createEvent<NetworkEvent>('test-session', undefined, {
        type: 'network',
        method: 'POST',
        url: 'http://api.example.com/data'
      }),
      createEvent<StorageEvent>('test-session', undefined, {
        type: 'storage',
        storageType: 'localStorage',
        operation: 'set',
        key: 'userData',
        value: 'testValue'
      })
    ];

    logger.logEvents(events);
    expect(logger.getEventCount()).toBe(3);
  });

  test('should reject invalid events', () => {
    const config: SessionConfig = {
      id: 'test-session',
      url: 'http://example.com',
      startTime: Date.now(),
      outputPath: '/tmp/test.jsonl'
    };

    const logger = new EventLogger(config);

    // Invalid event missing required fields
    const invalidEvent = {
      type: 'invalid',
      message: 'missing id, timestamp, sessionId'
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    logger.logEvent(invalidEvent as any);
    expect(logger.getEventCount()).toBe(0); // Should not count invalid events
  });

  test('should close properly', async () => {
    const config: SessionConfig = {
      id: 'test-session-close',
      url: 'http://example.com',
      startTime: Date.now(),
      outputPath: '/tmp/close_test.jsonl'
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
    const parsed = JSON.parse(serialized);

    expect(parsed.id).toBe('test-id'); // eslint-disable-line @typescript-eslint/no-unsafe-member-access
    expect(parsed.type).toBe('console'); // eslint-disable-line @typescript-eslint/no-unsafe-member-access
    expect(parsed.level).toBe('log'); // eslint-disable-line @typescript-eslint/no-unsafe-member-access
  });

  test('should handle circular references in serialization', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const circularObj: any = { prop: 'value' };
    circularObj.self = circularObj;

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
    expect(event1.sessionId).toBe('session-1');
    expect(event1.frameId).toBe('frame-1');
    expect(event2.type).toBe('console');
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
