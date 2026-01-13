import { describe, it, expect } from 'vitest';
import {
  JSUnshroudError,
  EventValidationError,
  CDPError,
  ConfigError,
  CorrelationRuleError,
  FileError
} from '../src/utils/errors';

describe('Error Classes', () => {
  describe('JSUnshroudError', () => {
    it('should create base error with message and code', () => {
      const error = new JSUnshroudError('Test message', 'TEST_CODE');
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('JSUnshroudError');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('EventValidationError', () => {
    it('should create event validation error with event', () => {
      const event = { type: 'click', data: {} };
      const error = new EventValidationError('Invalid event', event);
      expect(error.message).toBe('Invalid event');
      expect(error.code).toBe('EVENT_VALIDATION_ERROR');
      expect(error.name).toBe('EventValidationError');
      expect(error.event).toBe(event);
      expect(error).toBeInstanceOf(JSUnshroudError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('CDPError', () => {
    it('should create CDP error with method', () => {
      const error = new CDPError('CDP operation failed', 'Page.navigate');
      expect(error.message).toBe('CDP operation failed');
      expect(error.code).toBe('CDP_ERROR');
      expect(error.name).toBe('CDPError');
      expect(error.cdpMethod).toBe('Page.navigate');
      expect(error).toBeInstanceOf(JSUnshroudError);
    });

    it('should create CDP error without method', () => {
      const error = new CDPError('CDP operation failed');
      expect(error.message).toBe('CDP operation failed');
      expect(error.code).toBe('CDP_ERROR');
      expect(error.name).toBe('CDPError');
      expect(error.cdpMethod).toBeUndefined();
    });
  });

  describe('ConfigError', () => {
    it('should create config error with path', () => {
      const error = new ConfigError('Invalid config', '/path/to/config.json');
      expect(error.message).toBe('Invalid config');
      expect(error.code).toBe('CONFIG_ERROR');
      expect(error.name).toBe('ConfigError');
      expect(error.configPath).toBe('/path/to/config.json');
      expect(error).toBeInstanceOf(JSUnshroudError);
    });

    it('should create config error without path', () => {
      const error = new ConfigError('Invalid config');
      expect(error.message).toBe('Invalid config');
      expect(error.code).toBe('CONFIG_ERROR');
      expect(error.name).toBe('ConfigError');
      expect(error.configPath).toBeUndefined();
    });
  });

  describe('CorrelationRuleError', () => {
    it('should create correlation rule error with rule name and available rules', () => {
      const rules = ['rule1', 'rule2'];
      const error = new CorrelationRuleError('Rule execution failed', 'rule1', rules);
      expect(error.message).toBe('Rule execution failed');
      expect(error.code).toBe('CORRELATION_RULE_ERROR');
      expect(error.name).toBe('CorrelationRuleError');
      expect(error.ruleName).toBe('rule1');
      expect(error.availableRules).toBe(rules);
      expect(error).toBeInstanceOf(JSUnshroudError);
    });

    it('should create correlation rule error without optional params', () => {
      const error = new CorrelationRuleError('Rule execution failed');
      expect(error.message).toBe('Rule execution failed');
      expect(error.code).toBe('CORRELATION_RULE_ERROR');
      expect(error.name).toBe('CorrelationRuleError');
      expect(error.ruleName).toBeUndefined();
      expect(error.availableRules).toBeUndefined();
    });
  });

  describe('FileError', () => {
    it('should create file error with path', () => {
      const error = new FileError('File not found', '/path/to/file.txt');
      expect(error.message).toBe('File not found');
      expect(error.code).toBe('FILE_ERROR');
      expect(error.name).toBe('FileError');
      expect(error.filePath).toBe('/path/to/file.txt');
      expect(error).toBeInstanceOf(JSUnshroudError);
    });

    it('should create file error without path', () => {
      const error = new FileError('File not found');
      expect(error.message).toBe('File not found');
      expect(error.code).toBe('FILE_ERROR');
      expect(error.name).toBe('FileError');
      expect(error.filePath).toBeUndefined();
    });
  });
});
