/**
 * Custom error types for js_unshroud
 * Provides structured error handling throughout the application
 */

/**
 * Base error class for all js_unshroud errors
 */
export class JSUnshroudError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'JSUnshroudError';
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when event validation fails
 */
export class EventValidationError extends JSUnshroudError {
  constructor(message: string, public readonly event: unknown) {
    super(message, 'EVENT_VALIDATION_ERROR');
    this.name = 'EventValidationError';
  }
}

/**
 * Error thrown when CDP (Chrome DevTools Protocol) operations fail
 */
export class CDPError extends JSUnshroudError {
  constructor(message: string, public readonly cdpMethod?: string) {
    super(message, 'CDP_ERROR');
    this.name = 'CDPError';
  }
}

/**
 * Error thrown when configuration is invalid or missing
 */
export class ConfigError extends JSUnshroudError {
  constructor(message: string, public readonly configPath?: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigError';
  }
}

/**
 * Error thrown when correlation rule operations fail
 */
export class CorrelationRuleError extends JSUnshroudError {
  constructor(
    message: string,
    public readonly ruleName?: string,
    public readonly availableRules?: string[]
  ) {
    super(message, 'CORRELATION_RULE_ERROR');
    this.name = 'CorrelationRuleError';
  }
}

/**
 * Error thrown when file operations fail
 */
export class FileError extends JSUnshroudError {
  constructor(message: string, public readonly filePath?: string) {
    super(message, 'FILE_ERROR');
    this.name = 'FileError';
  }
}
