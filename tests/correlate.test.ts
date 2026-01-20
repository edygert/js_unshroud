import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { parseCorrelateArgs, validateArgs, loadCustomRules, correlateEvents } from '../src/cli/correlate.ts';
import type { MonitoringEvent, NetworkEvent, StorageEvent, ErrorEvent } from '../src/schema/types.ts';
import { writeFileSync, unlinkSync } from 'fs';

describe('Correlate Command Tests', () => {
  let originalArgv: string[];
  let tempFilePath: string;
  let tempRulesPath: string;

  beforeEach(() => {
    originalArgv = [...process.argv];
    tempFilePath = `/tmp/correlate-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jsonl`;
    tempRulesPath = `/tmp/rules-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`;
  });

  afterEach(() => {
    process.argv = originalArgv;
    try {
      unlinkSync(tempFilePath);
    } catch {
      // ignore if file doesn't exist
    }
    try {
      unlinkSync(tempRulesPath);
    } catch {
      // ignore if file doesn't exist
    }
  });

  describe('parseCorrelateArgs', () => {
    test('should parse --input flag', () => {
      process.argv = ['node', 'runner.ts', 'correlate', '--input', '/path/to/events.jsonl'];
      const args = parseCorrelateArgs();
      expect(args.input).toBe('/path/to/events.jsonl');
    });

    test('should parse --rules-file flag', () => {
      process.argv = ['node', 'runner.ts', 'correlate', '--input', 'events.jsonl', '--rules-file', 'my_rules.json'];
      const args = parseCorrelateArgs();
      expect(args.rulesFile).toBe('my_rules.json');
    });

    test('should parse --rules flag', () => {
      process.argv = ['node', 'runner.ts', 'correlate', '--input', 'events.jsonl', '--rules', 'storage-to-network'];
      const args = parseCorrelateArgs();
      expect(args.rules).toBe('storage-to-network');
    });

    test('should parse comma-delimited --rules flag', () => {
      process.argv = ['node', 'runner.ts', 'correlate', '--input', 'events.jsonl', '--rules', 'storage-to-network,timer-to-network'];
      const args = parseCorrelateArgs();
      expect(args.rules).toBe('storage-to-network,timer-to-network');
    });

    test('should parse --format flag', () => {
      process.argv = ['node', 'runner.ts', 'correlate', '--input', 'events.jsonl', '--format', 'json'];
      const args = parseCorrelateArgs();
      expect(args.format).toBe('json');
    });

    test('should parse --output flag', () => {
      process.argv = ['node', 'runner.ts', 'correlate', '--input', 'events.jsonl', '--output', 'results.txt'];
      const args = parseCorrelateArgs();
      expect(args.output).toBe('results.txt');
    });

    test('should handle all flags together', () => {
      process.argv = [
        'node', 'runner.ts', 'correlate',
        '--input', 'events.jsonl',
        '--rules-file', 'rules.json',
        '--rules', 'test-rule',
        '--format', 'text',
        '--output', 'out.txt'
      ];
      const args = parseCorrelateArgs();
      expect(args.input).toBe('events.jsonl');
      expect(args.rulesFile).toBe('rules.json');
      expect(args.rules).toBe('test-rule');
      expect(args.format).toBe('text');
      expect(args.output).toBe('out.txt');
    });
  });

  describe('validateArgs', () => {
    test('should validate input file exists', () => {
      // Create temp file
      writeFileSync(tempFilePath, '', 'utf-8');
      writeFileSync(tempRulesPath, '{"rules":[]}', 'utf-8');

      const args = {
        input: tempFilePath,
        rulesFile: tempRulesPath
      };

      expect(() => validateArgs(args)).not.toThrow();
    });

    test('should validate format enum (text/json)', () => {
      writeFileSync(tempFilePath, '', 'utf-8');
      writeFileSync(tempRulesPath, '{"rules":[]}', 'utf-8');

      const argsText = {
        input: tempFilePath,
        rulesFile: tempRulesPath,
        format: 'text' as const
      };

      const argsJson = {
        input: tempFilePath,
        rulesFile: tempRulesPath,
        format: 'json' as const
      };

      expect(() => validateArgs(argsText)).not.toThrow();
      expect(() => validateArgs(argsJson)).not.toThrow();
    });
  });

  describe('loadCustomRules', () => {
    test('should load valid rules file', () => {
      const validRules = {
        rules: [
          {
            name: 'test-rule',
            description: 'Test rule',
            patterns: {
              type: 'sequence',
              events: ['network', 'storage'],
              maxTimeGap: 5000,
              correlationField: 'sessionId'
            }
          }
        ]
      };

      writeFileSync(tempRulesPath, JSON.stringify(validRules), 'utf-8');
      const rules = loadCustomRules(tempRulesPath);

      expect(rules).toHaveLength(1);
      expect(rules[0]?.name).toBe('test-rule');
    });

    test('should parse JSON correctly', () => {
      const validRules = {
        rules: [
          {
            name: 'rule1',
            description: 'Description 1',
            patterns: {
              type: 'group',
              events: ['network']
            }
          }
        ]
      };

      writeFileSync(tempRulesPath, JSON.stringify(validRules), 'utf-8');
      const rules = loadCustomRules(tempRulesPath);

      expect(rules[0]?.patterns.type).toBe('group');
      expect(rules[0]?.patterns.events).toEqual(['network']);
    });

    test('should error on malformed JSON', () => {
      writeFileSync(tempRulesPath, '{invalid json}', 'utf-8');

      expect(() => loadCustomRules(tempRulesPath)).toThrow('Invalid JSON');
    });

    test('should error on missing "rules" array', () => {
      writeFileSync(tempRulesPath, '{"wrongKey": []}', 'utf-8');

      expect(() => loadCustomRules(tempRulesPath)).toThrow('must contain a "rules" array');
    });

    test('should error on invalid rule: missing name', () => {
      const invalidRules = {
        rules: [
          {
            description: 'Test',
            patterns: {
              type: 'sequence',
              events: ['network']
            }
          }
        ]
      };

      writeFileSync(tempRulesPath, JSON.stringify(invalidRules), 'utf-8');

      expect(() => loadCustomRules(tempRulesPath)).toThrow('non-empty "name" field');
    });

    test('should error on invalid rule: missing description', () => {
      const invalidRules = {
        rules: [
          {
            name: 'test',
            patterns: {
              type: 'sequence',
              events: ['network']
            }
          }
        ]
      };

      writeFileSync(tempRulesPath, JSON.stringify(invalidRules), 'utf-8');

      expect(() => loadCustomRules(tempRulesPath)).toThrow('"description" field');
    });

    test('should error on invalid rule: missing patterns', () => {
      const invalidRules = {
        rules: [
          {
            name: 'test',
            description: 'Test'
          }
        ]
      };

      writeFileSync(tempRulesPath, JSON.stringify(invalidRules), 'utf-8');

      expect(() => loadCustomRules(tempRulesPath)).toThrow('"patterns" object');
    });

    test('should error on invalid patterns.type', () => {
      const invalidRules = {
        rules: [
          {
            name: 'test',
            description: 'Test',
            patterns: {
              type: 'invalid',
              events: ['network']
            }
          }
        ]
      };

      writeFileSync(tempRulesPath, JSON.stringify(invalidRules), 'utf-8');

      expect(() => loadCustomRules(tempRulesPath)).toThrow('must be "sequence" or "group"');
    });

    test('should error on empty events array', () => {
      const invalidRules = {
        rules: [
          {
            name: 'test',
            description: 'Test',
            patterns: {
              type: 'sequence',
              events: []
            }
          }
        ]
      };

      writeFileSync(tempRulesPath, JSON.stringify(invalidRules), 'utf-8');

      expect(() => loadCustomRules(tempRulesPath)).toThrow('non-empty array');
    });

    test('should error on negative maxTimeGap', () => {
      const invalidRules = {
        rules: [
          {
            name: 'test',
            description: 'Test',
            patterns: {
              type: 'sequence',
              events: ['network'],
              maxTimeGap: -100
            }
          }
        ]
      };

      writeFileSync(tempRulesPath, JSON.stringify(invalidRules), 'utf-8');

      expect(() => loadCustomRules(tempRulesPath)).toThrow('positive number');
    });

    test('should accept valid correlationField', () => {
      const validRules = {
        rules: [
          {
            name: 'test',
            description: 'Test',
            patterns: {
              type: 'sequence',
              events: ['network'],
              correlationField: 'sessionId'
            }
          }
        ]
      };

      writeFileSync(tempRulesPath, JSON.stringify(validRules), 'utf-8');
      const rules = loadCustomRules(tempRulesPath);

      expect(rules[0]?.patterns.correlationField).toBe('sessionId');
    });

    test('should error on non-string correlationField', () => {
      const invalidRules = {
        rules: [
          {
            name: 'test',
            description: 'Test',
            patterns: {
              type: 'sequence',
              events: ['network'],
              correlationField: 123
            }
          }
        ]
      };

      writeFileSync(tempRulesPath, JSON.stringify(invalidRules), 'utf-8');

      expect(() => loadCustomRules(tempRulesPath)).toThrow('must be a string');
    });
  });

  describe('correlateEvents', () => {
    const testRules = {
      rules: [
        {
          name: 'storage-to-network',
          description: 'Storage writes followed by network requests',
          patterns: {
            type: 'sequence',
            events: ['storage', 'network'],
            maxTimeGap: 5000,
            correlationField: 'sessionId'
          }
        }
      ]
    };

    test('should find correlations with valid rules', async () => {
      const events: MonitoringEvent[] = [
        {
          id: 'evt-1',
          timestamp: 1640995200000,
          sessionId: 'session-1',
          type: 'storage',
          storageType: 'localStorage',
          operation: 'set',
          key: 'token'
        } as StorageEvent,
        {
          id: 'evt-2',
          timestamp: 1640995201000,
          sessionId: 'session-1',
          type: 'network',
          method: 'POST',
          url: 'https://api.example.com/data'
        } as NetworkEvent
      ];

      writeFileSync(tempFilePath, events.map(e => JSON.stringify(e)).join('\n'), 'utf-8');
      writeFileSync(tempRulesPath, JSON.stringify(testRules), 'utf-8');

      const args = {
        input: tempFilePath,
        rulesFile: tempRulesPath
      };

      const output = await correlateEvents(args);

      expect(output).toContain('Correlation Chains');
      expect(output).toContain('storage-to-network');
    });

    test('should filter by single --rules name', async () => {
      const multiRules = {
        rules: [
          {
            name: 'rule1',
            description: 'Rule 1',
            patterns: {
              type: 'sequence',
              events: ['storage', 'network'],
              maxTimeGap: 5000,
              correlationField: 'sessionId'
            }
          },
          {
            name: 'rule2',
            description: 'Rule 2',
            patterns: {
              type: 'sequence',
              events: ['timer', 'network'],
              maxTimeGap: 5000,
              correlationField: 'sessionId'
            }
          }
        ]
      };

      const events: MonitoringEvent[] = [
        {
          id: 'evt-1',
          timestamp: 1640995200000,
          sessionId: 'session-1',
          type: 'storage',
          storageType: 'localStorage',
          operation: 'set',
          key: 'token'
        } as StorageEvent,
        {
          id: 'evt-2',
          timestamp: 1640995201000,
          sessionId: 'session-1',
          type: 'network',
          method: 'POST',
          url: 'https://api.example.com/data'
        } as NetworkEvent
      ];

      writeFileSync(tempFilePath, events.map(e => JSON.stringify(e)).join('\n'), 'utf-8');
      writeFileSync(tempRulesPath, JSON.stringify(multiRules), 'utf-8');

      const args = {
        input: tempFilePath,
        rulesFile: tempRulesPath,
        rules: 'rule1'
      };

      const output = await correlateEvents(args);

      expect(output).toContain('rule1');
      expect(output).not.toContain('rule2');
    });

    test('should filter by multiple --rules names (comma-delimited)', async () => {
      const multiRules = {
        rules: [
          {
            name: 'storage-to-network',
            description: 'Storage to network',
            patterns: {
              type: 'sequence',
              events: ['storage', 'network'],
              maxTimeGap: 5000,
              correlationField: 'sessionId'
            }
          },
          {
            name: 'error-chains',
            description: 'Error chains',
            patterns: {
              type: 'sequence',
              events: ['network', 'error'],
              maxTimeGap: 2000,
              correlationField: 'correlationId'
            }
          }
        ]
      };

      const events: MonitoringEvent[] = [
        {
          id: 'evt-1',
          timestamp: 1640995200000,
          sessionId: 'session-1',
          type: 'storage',
          storageType: 'localStorage',
          operation: 'set',
          key: 'token'
        } as StorageEvent,
        {
          id: 'evt-2',
          timestamp: 1640995201000,
          sessionId: 'session-1',
          type: 'network',
          method: 'POST',
          url: 'https://api.example.com/data',
          correlationId: 'corr-1'
        } as NetworkEvent,
        {
          id: 'evt-3',
          timestamp: 1640995201500,
          sessionId: 'session-1',
          type: 'error',
          message: 'Request failed',
          correlationId: 'corr-1'
        } as ErrorEvent
      ];

      writeFileSync(tempFilePath, events.map(e => JSON.stringify(e)).join('\n'), 'utf-8');
      writeFileSync(tempRulesPath, JSON.stringify(multiRules), 'utf-8');

      const args = {
        input: tempFilePath,
        rulesFile: tempRulesPath,
        rules: 'storage-to-network,error-chains'
      };

      const output = await correlateEvents(args);

      expect(output).toContain('storage-to-network');
      expect(output).toContain('error-chains');
    });

    test('should handle empty input file', async () => {
      writeFileSync(tempFilePath, '', 'utf-8');
      writeFileSync(tempRulesPath, JSON.stringify(testRules), 'utf-8');

      const args = {
        input: tempFilePath,
        rulesFile: tempRulesPath
      };

      const output = await correlateEvents(args);

      expect(output).toContain('No correlation chains found');
    });

    test('should handle no correlations found', async () => {
      const events: MonitoringEvent[] = [
        {
          id: 'evt-1',
          timestamp: 1640995200000,
          sessionId: 'session-1',
          type: 'network',
          method: 'GET',
          url: 'https://api.example.com/data'
        } as NetworkEvent
      ];

      writeFileSync(tempFilePath, events.map(e => JSON.stringify(e)).join('\n'), 'utf-8');
      writeFileSync(tempRulesPath, JSON.stringify(testRules), 'utf-8');

      const args = {
        input: tempFilePath,
        rulesFile: tempRulesPath
      };

      const output = await correlateEvents(args);

      expect(output).toContain('No correlation chains found');
    });

    test('should error on invalid rule name', async () => {
      writeFileSync(tempFilePath, '', 'utf-8');
      writeFileSync(tempRulesPath, JSON.stringify(testRules), 'utf-8');

      const args = {
        input: tempFilePath,
        rulesFile: tempRulesPath,
        rules: 'nonexistent-rule'
      };

      await expect(correlateEvents(args)).rejects.toThrow();
    });

    test('should output JSON format when specified', async () => {
      const events: MonitoringEvent[] = [
        {
          id: 'evt-1',
          timestamp: 1640995200000,
          sessionId: 'session-1',
          type: 'storage',
          storageType: 'localStorage',
          operation: 'set',
          key: 'token'
        } as StorageEvent,
        {
          id: 'evt-2',
          timestamp: 1640995201000,
          sessionId: 'session-1',
          type: 'network',
          method: 'POST',
          url: 'https://api.example.com/data'
        } as NetworkEvent
      ];

      writeFileSync(tempFilePath, events.map(e => JSON.stringify(e)).join('\n'), 'utf-8');
      writeFileSync(tempRulesPath, JSON.stringify(testRules), 'utf-8');

      const args = {
        input: tempFilePath,
        rulesFile: tempRulesPath,
        format: 'json' as const
      };

      const output = await correlateEvents(args);

      expect(() => JSON.parse(output)).not.toThrow();
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty('totalChains');
      expect(parsed).toHaveProperty('chains');
    });

    test('should output text format by default', async () => {
      const events: MonitoringEvent[] = [
        {
          id: 'evt-1',
          timestamp: 1640995200000,
          sessionId: 'session-1',
          type: 'storage',
          storageType: 'localStorage',
          operation: 'set',
          key: 'token'
        } as StorageEvent,
        {
          id: 'evt-2',
          timestamp: 1640995201000,
          sessionId: 'session-1',
          type: 'network',
          method: 'POST',
          url: 'https://api.example.com/data'
        } as NetworkEvent
      ];

      writeFileSync(tempFilePath, events.map(e => JSON.stringify(e)).join('\n'), 'utf-8');
      writeFileSync(tempRulesPath, JSON.stringify(testRules), 'utf-8');

      const args = {
        input: tempFilePath,
        rulesFile: tempRulesPath
      };

      const output = await correlateEvents(args);

      expect(output).toContain('Correlation Chains');
      expect(output).toContain('================================================================================');
    });
  });

  describe('Output Formatting', () => {
    test('formatTextOutput: should format zero chains', async () => {
      writeFileSync(tempFilePath, '', 'utf-8');
      writeFileSync(tempRulesPath, JSON.stringify({
        rules: [{
          name: 'test',
          description: 'Test',
          patterns: { type: 'sequence', events: ['network'] }
        }]
      }), 'utf-8');

      const args = { input: tempFilePath, rulesFile: tempRulesPath };
      const output = await correlateEvents(args);

      expect(output).toContain('No correlation chains found');
    });

    test('formatTextOutput: should format single chain', async () => {
      const events: MonitoringEvent[] = [
        {
          id: 'evt-1',
          timestamp: 1640995200000,
          sessionId: 'session-1',
          type: 'storage',
          storageType: 'localStorage',
          operation: 'set',
          key: 'token'
        } as StorageEvent,
        {
          id: 'evt-2',
          timestamp: 1640995201000,
          sessionId: 'session-1',
          type: 'network',
          method: 'POST',
          url: 'https://api.example.com/data'
        } as NetworkEvent
      ];

      writeFileSync(tempFilePath, events.map(e => JSON.stringify(e)).join('\n'), 'utf-8');
      writeFileSync(tempRulesPath, JSON.stringify({
        rules: [{
          name: 'storage-to-network',
          description: 'Storage to network',
          patterns: {
            type: 'sequence',
            events: ['storage', 'network'],
            maxTimeGap: 5000,
            correlationField: 'sessionId'
          }
        }]
      }), 'utf-8');

      const args = { input: tempFilePath, rulesFile: tempRulesPath };
      const output = await correlateEvents(args);

      expect(output).toContain('Chain 1: storage-to-network');
      expect(output).toContain('Duration: 1000ms');
      expect(output).toContain('Events (2)');
    });

    test('formatJsonOutput: should format zero chains as JSON', async () => {
      writeFileSync(tempFilePath, '', 'utf-8');
      writeFileSync(tempRulesPath, JSON.stringify({
        rules: [{
          name: 'test',
          description: 'Test',
          patterns: { type: 'sequence', events: ['network'] }
        }]
      }), 'utf-8');

      const args = { input: tempFilePath, rulesFile: tempRulesPath, format: 'json' as const };
      const output = await correlateEvents(args);

      const parsed = JSON.parse(output);
      expect(parsed.totalChains).toBe(0);
      expect(parsed.chains).toHaveLength(0);
    });

    test('formatJsonOutput: should format chains as JSON', async () => {
      const events: MonitoringEvent[] = [
        {
          id: 'evt-1',
          timestamp: 1640995200000,
          sessionId: 'session-1',
          type: 'storage',
          storageType: 'localStorage',
          operation: 'set',
          key: 'token'
        } as StorageEvent,
        {
          id: 'evt-2',
          timestamp: 1640995201000,
          sessionId: 'session-1',
          type: 'network',
          method: 'POST',
          url: 'https://api.example.com/data'
        } as NetworkEvent
      ];

      writeFileSync(tempFilePath, events.map(e => JSON.stringify(e)).join('\n'), 'utf-8');
      writeFileSync(tempRulesPath, JSON.stringify({
        rules: [{
          name: 'storage-to-network',
          description: 'Storage to network',
          patterns: {
            type: 'sequence',
            events: ['storage', 'network'],
            maxTimeGap: 5000,
            correlationField: 'sessionId'
          }
        }]
      }), 'utf-8');

      const args = { input: tempFilePath, rulesFile: tempRulesPath, format: 'json' as const };
      const output = await correlateEvents(args);

      const parsed = JSON.parse(output);
      expect(parsed.totalChains).toBeGreaterThan(0);
      expect(parsed.chains[0]).toHaveProperty('chainType');
      expect(parsed.chains[0]).toHaveProperty('description');
      expect(parsed.chains[0]).toHaveProperty('timeSpan');
      expect(parsed.chains[0]).toHaveProperty('eventCount');
      expect(parsed.chains[0]).toHaveProperty('events');
    });
  });
});
