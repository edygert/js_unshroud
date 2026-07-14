import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { parseQueryArgs, validateArgs, buildQueryFilter, queryEvents } from '../src/cli/query.ts';
import type { MonitoringEvent, NetworkEvent, ConsoleEvent, StorageEvent } from '../src/schema/types.ts';
import { writeFileSync, unlinkSync } from 'fs';

describe('Query Command Tests', () => {
  let tempFilePath: string;
  let originalArgv: string[];

  const testEvents: MonitoringEvent[] = [
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
      type: 'network',
      method: 'POST',
      url: 'https://api.example.com/login',
      status: 200,
      correlationId: 'corr-2'
    } as NetworkEvent,
    {
      id: 'event-4',
      timestamp: 1640995200300,
      sessionId: 'session-1',
      type: 'storage',
      storageType: 'localStorage',
      operation: 'set',
      key: 'testKey'
    } as StorageEvent
  ];

  beforeEach(() => {
    // Save original argv
    originalArgv = [...process.argv];

    // Create temp file with test data
    tempFilePath = join(tmpdir(), `query-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jsonl`);
    const content = testEvents.map(event => JSON.stringify(event)).join('\n');
    writeFileSync(tempFilePath, content);
  });

  afterEach(() => {
    // Restore original argv
    process.argv = originalArgv;

    // Clean up temp file
    try {
      unlinkSync(tempFilePath);
    } catch {
      // ignore if file doesn't exist
    }
  });

  describe('parseQueryArgs', () => {
    test('should parse required --input flag', () => {
      process.argv = ['node', 'runner.ts', 'query', '--input', tempFilePath];
      const args = parseQueryArgs();
      expect(args.input).toBe(tempFilePath);
    });

    test('should parse --type flag', () => {
      process.argv = ['node', 'runner.ts', 'query', '--input', tempFilePath, '--type', 'network'];
      const args = parseQueryArgs();
      expect(args.eventType).toBe('network');
    });

    test('should parse comma-separated types', () => {
      process.argv = ['node', 'runner.ts', 'query', '--input', tempFilePath, '--type', 'network,console'];
      const args = parseQueryArgs();
      expect(args.eventType).toBe('network,console');
    });

    test('should parse --method flag', () => {
      process.argv = ['node', 'runner.ts', 'query', '--input', tempFilePath, '--method', 'POST'];
      const args = parseQueryArgs();
      expect(args.method).toBe('POST');
    });

    test('should parse --url flag', () => {
      process.argv = ['node', 'runner.ts', 'query', '--input', tempFilePath, '--url', 'https://example.com'];
      const args = parseQueryArgs();
      expect(args.url).toBe('https://example.com');
    });

    test('should parse --url-regex flag', () => {
      process.argv = ['node', 'runner.ts', 'query', '--input', tempFilePath, '--url-regex', 'api\\.example\\.com'];
      const args = parseQueryArgs();
      expect(args.urlRegex).toBe('api\\.example\\.com');
    });

    test('should parse --status flag', () => {
      process.argv = ['node', 'runner.ts', 'query', '--input', tempFilePath, '--status', '200'];
      const args = parseQueryArgs();
      expect(args.status).toBe(200);
    });

    test('should parse --level flag', () => {
      process.argv = ['node', 'runner.ts', 'query', '--input', tempFilePath, '--level', 'error'];
      const args = parseQueryArgs();
      expect(args.level).toBe('error');
    });

    test('should parse --storage-type flag', () => {
      process.argv = ['node', 'runner.ts', 'query', '--input', tempFilePath, '--storage-type', 'localStorage'];
      const args = parseQueryArgs();
      expect(args.storageType).toBe('localStorage');
    });

    test('should parse --operation flag', () => {
      process.argv = ['node', 'runner.ts', 'query', '--input', tempFilePath, '--operation', 'set'];
      const args = parseQueryArgs();
      expect(args.operation).toBe('set');
    });

    test('should parse --correlation-id flag', () => {
      process.argv = ['node', 'runner.ts', 'query', '--input', tempFilePath, '--correlation-id', 'corr-123'];
      const args = parseQueryArgs();
      expect(args.correlationId).toBe('corr-123');
    });

    test('should parse --format flag', () => {
      process.argv = ['node', 'runner.ts', 'query', '--input', tempFilePath, '--format', 'count'];
      const args = parseQueryArgs();
      expect(args.format).toBe('count');
    });

    test('should parse --output flag', () => {
      process.argv = ['node', 'runner.ts', 'query', '--input', tempFilePath, '--output', 'output.jsonl'];
      const args = parseQueryArgs();
      expect(args.output).toBe('output.jsonl');
    });

    test('should parse multiple filters combined', () => {
      process.argv = [
        'node', 'runner.ts', 'query',
        '--input', tempFilePath,
        '--type', 'network',
        '--method', 'POST',
        '--status', '200',
        '--format', 'count'
      ];
      const args = parseQueryArgs();
      expect(args.eventType).toBe('network');
      expect(args.method).toBe('POST');
      expect(args.status).toBe(200);
      expect(args.format).toBe('count');
    });

    test('should exit with error if --input is missing', () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      process.argv = ['node', 'runner.ts', 'query'];
      parseQueryArgs();

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockConsoleError).toHaveBeenCalledWith('Error: --input is required');

      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });

    test('should handle --help flag', () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
      const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

      process.argv = ['node', 'runner.ts', 'query', '--help'];
      parseQueryArgs();

      expect(mockExit).toHaveBeenCalledWith(0);
      expect(mockConsoleLog).toHaveBeenCalled();

      mockExit.mockRestore();
      mockConsoleLog.mockRestore();
    });

    test('should handle -h flag', () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
      const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

      process.argv = ['node', 'runner.ts', 'query', '-h'];
      parseQueryArgs();

      expect(mockExit).toHaveBeenCalledWith(0);
      expect(mockConsoleLog).toHaveBeenCalled();

      mockExit.mockRestore();
      mockConsoleLog.mockRestore();
    });
  });

  describe('validateArgs', () => {
    test('should pass validation with valid input file', () => {
      const args = { input: tempFilePath };
      expect(() => validateArgs(args)).not.toThrow();
    });

    test('should exit with error if input file does not exist', () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const args = { input: '/nonexistent/file.jsonl' };
      validateArgs(args);

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Input file not found'));

      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });

    test('should exit with error if format is invalid', () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const args = { input: tempFilePath, format: 'xml' as 'jsonl' };
      validateArgs(args);

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Invalid format'));

      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });

    test('should pass validation with valid jsonl format', () => {
      const args = { input: tempFilePath, format: 'jsonl' as const };
      expect(() => validateArgs(args)).not.toThrow();
    });

    test('should pass validation with valid count format', () => {
      const args = { input: tempFilePath, format: 'count' as const };
      expect(() => validateArgs(args)).not.toThrow();
    });

    test('should exit with error if urlRegex is invalid', () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const args = { input: tempFilePath, urlRegex: '[invalid' };
      validateArgs(args);

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Invalid regex pattern'));

      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });

    test('should pass validation with valid regex', () => {
      const args = { input: tempFilePath, urlRegex: 'api\\.example\\.com' };
      expect(() => validateArgs(args)).not.toThrow();
    });
  });

  describe('buildQueryFilter', () => {
    test('should build filter with type', () => {
      const args = { input: tempFilePath, eventType: 'network' };
      const filter = buildQueryFilter(args);
      expect(filter.eventType).toBe('network');
    });

    test('should build filter with comma-separated types', () => {
      const args = { input: tempFilePath, eventType: 'network,console' };
      const filter = buildQueryFilter(args);
      expect(filter.eventType).toBe('network,console');
    });

    test('should build filter with method', () => {
      const args = { input: tempFilePath, method: 'POST' };
      const filter = buildQueryFilter(args);
      expect(filter.method).toBe('POST');
    });

    test('should build filter with exact url', () => {
      const args = { input: tempFilePath, url: 'https://example.com' };
      const filter = buildQueryFilter(args);
      expect(filter.url).toBe('https://example.com');
    });

    test('should build filter with url regex', () => {
      const args = { input: tempFilePath, urlRegex: 'api\\.example\\.com' };
      const filter = buildQueryFilter(args);
      expect(filter.url).toBeInstanceOf(RegExp);
      expect((filter.url as RegExp).test('https://api.example.com/users')).toBe(true);
    });

    test('should build filter with status', () => {
      const args = { input: tempFilePath, status: 200 };
      const filter = buildQueryFilter(args);
      expect(filter.status).toBe(200);
    });

    test('should build filter with level', () => {
      const args = { input: tempFilePath, level: 'error' };
      const filter = buildQueryFilter(args);
      expect(filter.level).toBe('error');
    });

    test('should build filter with storage type', () => {
      const args = { input: tempFilePath, storageType: 'localStorage' as const };
      const filter = buildQueryFilter(args);
      expect(filter.storageType).toBe('localStorage');
    });

    test('should build filter with operation', () => {
      const args = { input: tempFilePath, operation: 'set' as const };
      const filter = buildQueryFilter(args);
      expect(filter.operation).toBe('set');
    });

    test('should build filter with correlation ID', () => {
      const args = { input: tempFilePath, correlationId: 'corr-123' };
      const filter = buildQueryFilter(args);
      expect(filter.correlationId).toBe('corr-123');
    });

    test('should build filter with multiple criteria', () => {
      const args = {
        input: tempFilePath,
        eventType: 'network',
        method: 'POST',
        status: 200
      };
      const filter = buildQueryFilter(args);
      expect(filter.eventType).toBe('network');
      expect(filter.method).toBe('POST');
      expect(filter.status).toBe(200);
    });

    test('should build empty filter when no filters specified', () => {
      const args = { input: tempFilePath };
      const filter = buildQueryFilter(args);
      expect(Object.keys(filter)).toHaveLength(0);
    });
  });

  describe('queryEvents', () => {
    test('should query all events with no filter', async () => {
      const args = { input: tempFilePath };
      const output = await queryEvents(args);
      const lines = output.split('\n');
      expect(lines).toHaveLength(4);
      expect(lines.every(line => line.trim())).toBe(true);
    });

    test('should query events by type', async () => {
      const args = { input: tempFilePath, eventType:'network' };
      const output = await queryEvents(args);
      const lines = output.split('\n');
      expect(lines).toHaveLength(2);
      const events = lines.map(line => JSON.parse(line));
      expect(events.every(e => e.type === 'network')).toBe(true);
    });

    test('should query events by method', async () => {
      const args = { input: tempFilePath, eventType:'network', method: 'POST' };
      const output = await queryEvents(args);
      const lines = output.split('\n');
      expect(lines).toHaveLength(1);
      const event = JSON.parse(lines[0]!);
      expect(event.method).toBe('POST');
    });

    test('should query events by url regex', async () => {
      const args = { input: tempFilePath, eventType:'network', urlRegex: 'login' };
      const output = await queryEvents(args);
      const lines = output.split('\n');
      expect(lines).toHaveLength(1);
      const event = JSON.parse(lines[0]!);
      expect(event.url).toContain('login');
    });

    test('should query events by status', async () => {
      const args = { input: tempFilePath, eventType:'network', status: 200 };
      const output = await queryEvents(args);
      const lines = output.split('\n');
      expect(lines).toHaveLength(1);
      const event = JSON.parse(lines[0]!);
      expect(event.status).toBe(200);
    });

    test('should return count format', async () => {
      const args = { input: tempFilePath, eventType:'network', format: 'count' as const };
      const output = await queryEvents(args);
      expect(output).toBe('2');
    });

    test('should return 0 count when no events match', async () => {
      const args = { input: tempFilePath, eventType:'nonexistent', format: 'count' as const };
      const output = await queryEvents(args);
      expect(output).toBe('0');
    });

    test('should query events by storage type', async () => {
      const args = { input: tempFilePath, eventType:'storage', storageType: 'localStorage' as const };
      const output = await queryEvents(args);
      const lines = output.split('\n');
      expect(lines).toHaveLength(1);
      const event = JSON.parse(lines[0]!);
      expect(event.storageType).toBe('localStorage');
    });

    // Regression (audit H6): --operation / --storage-type must actually narrow results.
    // Uses a dedicated mixed-storage file so the filters can't pass vacuously.
    test('should filter storage events by operation and storageType end-to-end', async () => {
      const mixed: StorageEvent[] = [
        { id: 'm1', timestamp: 1, sessionId: 'q', type: 'storage', storageType: 'localStorage', operation: 'set', key: 'a' },
        { id: 'm2', timestamp: 2, sessionId: 'q', type: 'storage', storageType: 'localStorage', operation: 'get', key: 'a' },
        { id: 'm3', timestamp: 3, sessionId: 'q', type: 'storage', storageType: 'sessionStorage', operation: 'set', key: 'b' }
      ];
      writeFileSync(tempFilePath, mixed.map(e => JSON.stringify(e)).join('\n'));

      const setOnly = await queryEvents({ input: tempFilePath, eventType: 'storage', operation: 'set' as const });
      const setLines = setOnly.split('\n');
      expect(setLines).toHaveLength(2);
      expect(setLines.map(l => JSON.parse(l).operation).every(op => op === 'set')).toBe(true);

      const sessionGet = await queryEvents({ input: tempFilePath, eventType: 'storage', storageType: 'sessionStorage' as const, operation: 'set' as const });
      const sessionLines = sessionGet.split('\n');
      expect(sessionLines).toHaveLength(1);
      expect(JSON.parse(sessionLines[0]!).id).toBe('m3');

      const noClear = await queryEvents({ input: tempFilePath, eventType: 'storage', operation: 'clear' as const, format: 'count' as const });
      expect(noClear).toBe('0');
    });

    test('should query events by correlation ID', async () => {
      const args = { input: tempFilePath, correlationId: 'corr-1' };
      const output = await queryEvents(args);
      const lines = output.split('\n');
      expect(lines).toHaveLength(1);
      const event = JSON.parse(lines[0]!);
      expect(event.correlationId).toBe('corr-1');
    });

    test('should handle empty result set', async () => {
      const args = { input: tempFilePath, eventType:'error' };
      const output = await queryEvents(args);
      expect(output).toBe('');
    });

    test('should output valid JSONL format', async () => {
      const args = { input: tempFilePath, eventType:'network' };
      const output = await queryEvents(args);
      const lines = output.split('\n');

      // Each line should be valid JSON
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    });

    test('should combine multiple filters correctly', async () => {
      const args = {
        input: tempFilePath,
        eventType: 'network',
        method: 'GET'
      };
      const output = await queryEvents(args);
      const lines = output.split('\n');
      expect(lines).toHaveLength(1);
      const event = JSON.parse(lines[0]!);
      expect(event.type).toBe('network');
      expect(event.method).toBe('GET');
    });
  });

  describe('integration tests', () => {
    test('should handle large result sets efficiently', async () => {
      // Create a larger test file
      const largeEvents = Array.from({ length: 1000 }, (_, i) => ({
        id: `event-${i}`,
        timestamp: 1640995200000 + i,
        sessionId: 'session-1',
        type: 'console',
        level: 'log',
        message: `Message ${i}`,
        args: []
      }));

      const largeTempFile = join(tmpdir(), `large-query-test-${Date.now()}.jsonl`);
      writeFileSync(largeTempFile, largeEvents.map(e => JSON.stringify(e)).join('\n'));

      try {
        const args = { input: largeTempFile, eventType: 'console', format: 'count' as const };
        const output = await queryEvents(args);
        expect(output).toBe('1000');
      } finally {
        unlinkSync(largeTempFile);
      }
    });

    test('should handle malformed JSON gracefully', async () => {
      const malformedFile = join(tmpdir(), `malformed-query-test-${Date.now()}.jsonl`);
      const content = [
        JSON.stringify(testEvents[0]),
        '{"invalid": json',
        JSON.stringify(testEvents[1])
      ].join('\n');
      writeFileSync(malformedFile, content);

      try {
        const args = { input: malformedFile };
        const output = await queryEvents(args);
        const lines = output.split('\n');
        // Should get 2 valid events, skipping malformed line
        expect(lines).toHaveLength(2);
      } finally {
        unlinkSync(malformedFile);
      }
    });
  });
});
