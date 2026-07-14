import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  parseAnalyzeArgs,
  validateArgs,
  analyzeEvents
} from '../src/cli/analyze.ts';
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

describe('Analyze Command Argument Parsing', () => {
  test('should parse required --input argument', () => {
    const testPath = join(tmpdir(), 'events.jsonl');
    process.argv = ['node', 'runner.ts', 'analyze', '--input', testPath];
    const args = parseAnalyzeArgs();

    expect(args.input).toBe(testPath);
    expect(args.format).toBeUndefined();
    expect(args.output).toBeUndefined();
  });

  test('should parse optional --format argument', () => {
    const testPath = join(tmpdir(), 'events.jsonl');
    process.argv = ['node', 'runner.ts', 'analyze', '--input', testPath, '--format', 'json'];
    const args = parseAnalyzeArgs();

    expect(args.input).toBe(testPath);
    expect(args.format).toBe('json');
  });

  test('should parse optional --output argument', () => {
    const inputPath = join(tmpdir(), 'events.jsonl');
    const outputPath = join(tmpdir(), 'timeline.txt');
    process.argv = ['node', 'runner.ts', 'analyze', '--input', inputPath, '--output', outputPath];
    const args = parseAnalyzeArgs();

    expect(args.input).toBe(inputPath);
    expect(args.output).toBe(outputPath);
  });

  test('should parse all arguments together', () => {
    const inputPath = join(tmpdir(), 'events.jsonl');
    const outputPath = join(tmpdir(), 'stats.txt');
    process.argv = ['node', 'runner.ts', 'analyze', '--input', inputPath, '--format', 'stats', '--output', outputPath];
    const args = parseAnalyzeArgs();

    expect(args.input).toBe(inputPath);
    expect(args.format).toBe('stats');
    expect(args.output).toBe(outputPath);
  });

  test('should default format to undefined when not specified', () => {
    const testPath = join(tmpdir(), 'events.jsonl');
    process.argv = ['node', 'runner.ts', 'analyze', '--input', testPath];
    const args = parseAnalyzeArgs();

    expect(args.format).toBeUndefined();
  });

  test('should exit with error when --input is missing', () => {
    process.argv = ['node', 'runner.ts', 'analyze'];

    const mockExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Process exit: ${code}`);
    });
    const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => parseAnalyzeArgs()).toThrow('Process exit');
    expect(mockConsoleError).toHaveBeenCalledWith('Error: --input is required');

    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });
});

describe('Analyze Command Validation', () => {
  let tempFilePath: string;

  beforeEach(() => {
    tempFilePath = join(tmpdir(), `test-analyze-events-${Date.now()}.jsonl`);
    writeFileSync(tempFilePath, '{"id":"1","timestamp":1000,"sessionId":"session-1","type":"console","level":"log","message":"test"}\n');
  });

  afterEach(() => {
    if (existsSync(tempFilePath)) {
      unlinkSync(tempFilePath);
    }
  });

  test('should validate existing file', () => {
    const args = { input: tempFilePath };
    expect(() => validateArgs(args)).not.toThrow();
  });

  test('should exit with error for non-existent file', () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Process exit: ${code}`);
    });
    const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const args = { input: join(tmpdir(), 'nonexistent-file.jsonl') };
    expect(() => validateArgs(args)).toThrow('Process exit');
    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Input file not found'));

    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });

  test('should exit with error for invalid format', () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Process exit: ${code}`);
    });
    const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const args = { input: tempFilePath, format: 'xml' as any };
    expect(() => validateArgs(args)).toThrow('Process exit');
    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("Invalid format 'xml'"));

    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });

  test('should accept valid formats: text, json, stats', () => {
    expect(() => validateArgs({ input: tempFilePath, format: 'text' })).not.toThrow();
    expect(() => validateArgs({ input: tempFilePath, format: 'json' })).not.toThrow();
    expect(() => validateArgs({ input: tempFilePath, format: 'stats' })).not.toThrow();
  });
});

describe('Analyze Command Execution', () => {
  let tempFilePath: string;
  let sampleEvents: MonitoringEvent[];

  beforeEach(() => {
    tempFilePath = join(tmpdir(), `test-analyze-execution-${Date.now()}.jsonl`);

    // Create sample events
    sampleEvents = [
      {
        id: 'evt-1',
        timestamp: 1640995200000,
        sessionId: 'session-1',
        type: 'console',
        level: 'log',
        message: 'Test message'
      } as ConsoleEvent,
      {
        id: 'evt-2',
        timestamp: 1640995201000,
        sessionId: 'session-1',
        type: 'network',
        method: 'GET',
        url: 'https://example.com'
      } as NetworkEvent,
      {
        id: 'evt-3',
        timestamp: 1640995202000,
        sessionId: 'session-1',
        type: 'storage',
        storageType: 'localStorage',
        operation: 'set',
        key: 'test',
        value: 'value'
      } as StorageEvent
    ];

    writeFileSync(tempFilePath, sampleEvents.map(e => JSON.stringify(e)).join('\n'));
  });

  afterEach(() => {
    if (existsSync(tempFilePath)) {
      unlinkSync(tempFilePath);
    }
  });

  test('should load events and generate text timeline', async () => {
    const args = { input: tempFilePath, format: 'text' as const };
    const output = await analyzeEvents(args);

    expect(output).toContain('Timeline');
    expect(output).toContain('console.log');
    expect(output).toContain('GET https://example.com');
    expect(output).toContain('localStorage.set');
  });

  test('should generate JSON output format', async () => {
    const args = { input: tempFilePath, format: 'json' as const };
    const output = await analyzeEvents(args);

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('timeline');
    expect(parsed.timeline).toBeInstanceOf(Array);
    expect(parsed).toHaveProperty('totalEntries');
    expect(parsed.totalEntries).toBe(3);
  });

  test('should generate statistics summary', async () => {
    const args = { input: tempFilePath, format: 'stats' as const };
    const output = await analyzeEvents(args);

    expect(output).toContain('Event Statistics');
    expect(output).toContain('Total Events: 3');
    expect(output).toContain('console: 1');
    expect(output).toContain('network: 1');
    expect(output).toContain('storage: 1');
  });

  test('should handle empty input file gracefully', async () => {
    const emptyFile = join(tmpdir(), `test-empty-${Date.now()}.jsonl`);
    writeFileSync(emptyFile, '');

    const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const args = { input: emptyFile, format: 'text' as const };
    const output = await analyzeEvents(args);

    expect(mockConsoleWarn).toHaveBeenCalledWith('Warning: No events found in input file');
    expect(output).toContain('No events found');

    mockConsoleWarn.mockRestore();
    unlinkSync(emptyFile);
  });

  test('should handle malformed JSONL lines gracefully', async () => {
    const malformedFile = join(tmpdir(), `test-malformed-${Date.now()}.jsonl`);
    writeFileSync(malformedFile,
      JSON.stringify(sampleEvents[0]) + '\n' +
      '{incomplete json\n' +
      JSON.stringify(sampleEvents[1]) + '\n'
    );

    const args = { input: malformedFile, format: 'text' as const };
    const output = await analyzeEvents(args);

    // Should process valid events and skip malformed ones
    expect(output).toContain('console.log');
    expect(output).toContain('GET https://example.com');

    unlinkSync(malformedFile);
  });

  test('should default to text format when format not specified', async () => {
    const args = { input: tempFilePath };
    const output = await analyzeEvents(args);

    expect(output).toContain('Timeline');
    expect(output).toContain('console.log');
  });
});

describe('Statistics Formatting', () => {
  let tempFilePath: string;

  beforeEach(() => {
    tempFilePath = join(tmpdir(), `test-stats-${Date.now()}.jsonl`);

    const events: MonitoringEvent[] = [
      { id: '1', timestamp: 1000, sessionId: 's1', type: 'console', level: 'log', message: 'msg1' } as ConsoleEvent,
      { id: '2', timestamp: 2000, sessionId: 's1', type: 'console', level: 'log', message: 'msg2' } as ConsoleEvent,
      { id: '3', timestamp: 3000, sessionId: 's1', type: 'network', method: 'GET', url: 'https://example.com' } as NetworkEvent,
      { id: '4', timestamp: 4000, sessionId: 's1', type: 'network', method: 'POST', url: 'https://example.com' } as NetworkEvent,
      { id: '5', timestamp: 5000, sessionId: 's1', type: 'network', method: 'GET', url: 'https://example.com/api' } as NetworkEvent,
      { id: '6', timestamp: 6000, sessionId: 's1', type: 'storage', storageType: 'localStorage', operation: 'set', key: 'k', value: 'v' } as StorageEvent
    ];

    writeFileSync(tempFilePath, events.map(e => JSON.stringify(e)).join('\n'));
  });

  afterEach(() => {
    if (existsSync(tempFilePath)) {
      unlinkSync(tempFilePath);
    }
  });

  test('should calculate total event count', async () => {
    const args = { input: tempFilePath, format: 'stats' as const };
    const output = await analyzeEvents(args);

    expect(output).toContain('Total Events: 6');
  });

  test('should calculate event type breakdown with counts', async () => {
    const args = { input: tempFilePath, format: 'stats' as const };
    const output = await analyzeEvents(args);

    expect(output).toContain('console: 2');
    expect(output).toContain('network: 3');
    expect(output).toContain('storage: 1');
  });

  test('should calculate percentages correctly', async () => {
    const args = { input: tempFilePath, format: 'stats' as const };
    const output = await analyzeEvents(args);

    expect(output).toContain('33.3%)'); // console: 2/6
    expect(output).toContain('50.0%)'); // network: 3/6
    expect(output).toContain('16.7%)'); // storage: 1/6
  });

  test('should sort event types by count descending', async () => {
    const args = { input: tempFilePath, format: 'stats' as const };
    const output = await analyzeEvents(args);

    const lines = output.split('\n');
    const breakdownStart = lines.findIndex(l => l.includes('Event Type Breakdown:'));
    const eventLines = lines.slice(breakdownStart + 1).filter(l => l.trim());

    // network (3) should come before console (2) should come before storage (1)
    const networkIdx = eventLines.findIndex(l => l.includes('network:'));
    const consoleIdx = eventLines.findIndex(l => l.includes('console:'));
    const storageIdx = eventLines.findIndex(l => l.includes('storage:'));

    expect(networkIdx).toBeLessThan(consoleIdx);
    expect(consoleIdx).toBeLessThan(storageIdx);
  });

  test('should calculate time span and duration', async () => {
    const args = { input: tempFilePath, format: 'stats' as const };
    const output = await analyzeEvents(args);

    expect(output).toContain('Time Span:');
    expect(output).toContain('Duration: 5000ms');
  });
});

describe('All Event Types Coverage', () => {
  let tempFilePath: string;

  beforeEach(() => {
    tempFilePath = join(tmpdir(), `test-all-event-types-${Date.now()}.jsonl`);
  });

  afterEach(() => {
    if (existsSync(tempFilePath)) {
      unlinkSync(tempFilePath);
    }
  });

  test('should format all 22 major event types correctly', async () => {
    const allEventTypes: MonitoringEvent[] = [
      { id: '1', timestamp: 1000, sessionId: 's1', type: 'console', level: 'log', message: 'test' } as ConsoleEvent,
      { id: '2', timestamp: 2000, sessionId: 's1', type: 'network', method: 'GET', url: 'https://example.com' } as NetworkEvent,
      { id: '3', timestamp: 3000, sessionId: 's1', type: 'storage', storageType: 'localStorage', operation: 'set', key: 'k', value: 'v' } as StorageEvent,
      { id: '4', timestamp: 4000, sessionId: 's1', type: 'websocket', url: 'wss://example.com', event: 'open' } as WebSocketEvent,
      { id: '5', timestamp: 5000, sessionId: 's1', type: 'timer', timerType: 'setTimeout', operation: 'create' } as TimerEvent,
      { id: '6', timestamp: 6000, sessionId: 's1', type: 'error', message: 'Error occurred' } as ErrorEvent,
      { id: '7', timestamp: 7000, sessionId: 's1', type: 'dom', eventType: 'click', eventPhase: 'target', bubbles: true, cancelable: true, defaultPrevented: false, composed: false } as DomEvent,
      { id: '8', timestamp: 8000, sessionId: 's1', type: 'fingerprinting', method: 'canvas', operation: 'toDataURL' } as FingerprintingEvent,
      { id: '9', timestamp: 9000, sessionId: 's1', type: 'headless_mitigation', method: 'navigator', operation: 'webdriver_check' } as HeadlessMitigationEvent,
      { id: '11', timestamp: 11000, sessionId: 's1', type: 'performance_warning', method: 'setTimeout', operation: 'short_timeout_detected', delay: 1, warning: 'Short timeout detected' } as PerformanceWarningEvent,
      { id: '12', timestamp: 12000, sessionId: 's1', type: 'service_worker', eventType: 'register', scriptUrl: '/sw.js' } as ServiceWorkerEvent,
      { id: '13', timestamp: 13000, sessionId: 's1', type: 'code_execution', method: 'eval', operation: 'execute', code: 'console.log("test")', codeLength: 20 } as CodeExecutionEvent,
      { id: '14', timestamp: 14000, sessionId: 's1', type: 'encoding', method: 'atob', operation: 'decode', output: 'decoded', outputLength: 7, success: true } as EncodingEvent,
      { id: '15', timestamp: 15000, sessionId: 's1', type: 'cryptojs', method: 'AES.decrypt', operation: 'decrypt', algorithm: 'AES', output: 'decrypted', outputLength: 9, success: true } as CryptoJSEvent,
      { id: '16', timestamp: 16000, sessionId: 's1', type: 'script_injection', method: 'innerHTML', htmlContent: '<script>alert(1)</script>', htmlLength: 25, containsScriptTag: true, scriptTagCount: 1 } as ScriptInjectionEvent,
      { id: '17', timestamp: 17000, sessionId: 's1', type: 'event_handler', eventType: 'property_set', handlerName: 'onclick', handlerCode: 'alert(1)', element: 'button', method: 'property_assignment' } as EventHandlerEvent,
      { id: '18', timestamp: 18000, sessionId: 's1', type: 'blob', eventType: 'blob_create', blobType: 'text/javascript', blobSize: 100 } as BlobEvent,
      { id: '19', timestamp: 19000, sessionId: 's1', type: 'url_execution', eventType: 'location_href_set', url: 'javascript:alert(1)', code: 'alert(1)' } as URLExecutionEvent,
      { id: '20', timestamp: 20000, sessionId: 's1', type: 'worker', eventType: 'worker_create', workerType: 'Worker', scriptURL: '/worker.js' } as WorkerEvent,
      { id: '21', timestamp: 21000, sessionId: 's1', type: 'module', eventType: 'module_script_inject', isInline: true, content: 'import foo from "bar"' } as ModuleEvent,
      { id: '22', timestamp: 22000, sessionId: 's1', type: 'iframe', eventType: 'iframe_create', src: 'https://example.com', scriptCount: 0, element: 'iframe' } as IframeEvent
    ];

    writeFileSync(tempFilePath, allEventTypes.map(e => JSON.stringify(e)).join('\n'));

    const args = { input: tempFilePath, format: 'text' as const };
    const output = await analyzeEvents(args);

    // Verify all event types appear in output
    expect(output).toContain('console.log');
    expect(output).toContain('GET https://example.com');
    expect(output).toContain('localStorage.set');
    expect(output).toContain('WebSocket:');
    expect(output).toContain('Timer:');
    expect(output).toContain('Error:');
    expect(output).toContain('DOM:');
    expect(output).toContain('Fingerprinting:');
    expect(output).toContain('Headless Mitigation:');
    expect(output).toContain('Performance Warning:');
    expect(output).toContain('Service Worker:');
    expect(output).toContain('Code Execution:');
    expect(output).toContain('Encoding:');
    expect(output).toContain('CryptoJS:');
    expect(output).toContain('Script Injection:');
    expect(output).toContain('Event Handler:');
    expect(output).toContain('Blob');
    expect(output).toContain('JavaScript URL:');
    expect(output).toContain('Worker');
    expect(output).toContain('Module Script Inject:');
    expect(output).toContain('Iframe');
  });
});
