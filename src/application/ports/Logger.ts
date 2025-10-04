/**
 * Logger Port
 * Interface for logging operations
 */

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

export interface LogContext {
  readonly userId?: string;
  readonly requestId?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly operation?: string;
  readonly duration?: number;
  readonly [key: string]: unknown;
}

export interface Logger {
  /**
   * Log an error message
   */
  error(message: string, error?: Error, context?: LogContext): void;

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void;

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void;

  /**
   * Log a debug message
   */
  debug(message: string, context?: LogContext): void;

  /**
   * Log with specific level
   */
  log(level: LogLevel, message: string, context?: LogContext): void;

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger;

  /**
   * Log security event
   */
  security(event: string, context: LogContext): void;

  /**
   * Log audit event
   */
  audit(event: string, context: LogContext): void;

  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, context?: LogContext): void;
}