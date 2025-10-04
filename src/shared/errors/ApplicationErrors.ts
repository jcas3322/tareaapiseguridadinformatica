/**
 * ApplicationErrors
 * Custom error classes for the Spotify API application
 */

export abstract class ApplicationError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly timestamp: string;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

// Authentication Errors
export class AuthenticationError extends ApplicationError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class InvalidCredentialsError extends ApplicationError {
  constructor(message: string = 'Invalid credentials provided') {
    super(message, 401, 'INVALID_CREDENTIALS');
  }
}

export class TokenExpiredError extends ApplicationError {
  constructor(message: string = 'Token has expired') {
    super(message, 401, 'TOKEN_EXPIRED');
  }
}

export class TokenInvalidError extends ApplicationError {
  constructor(message: string = 'Invalid token provided') {
    super(message, 401, 'TOKEN_INVALID');
  }
}

// Authorization Errors
export class AuthorizationError extends ApplicationError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class InsufficientPermissionsError extends ApplicationError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'INSUFFICIENT_PERMISSIONS');
  }
}

export class ResourceOwnershipError extends ApplicationError {
  constructor(message: string = 'You can only access your own resources') {
    super(message, 403, 'RESOURCE_OWNERSHIP_ERROR');
  }
}

// Validation Errors
export class ValidationError extends ApplicationError {
  public readonly field?: string;
  public readonly value?: any;

  constructor(message: string, field?: string, value?: any) {
    super(message, 400, 'VALIDATION_ERROR');
    this.field = field;
    this.value = value;
  }
}

export class InvalidInputError extends ApplicationError {
  constructor(message: string = 'Invalid input provided') {
    super(message, 400, 'INVALID_INPUT');
  }
}

export class MissingRequiredFieldError extends ApplicationError {
  public readonly field: string;

  constructor(field: string) {
    super(`Required field '${field}' is missing`, 400, 'MISSING_REQUIRED_FIELD');
    this.field = field;
  }
}

// Resource Errors
export class NotFoundError extends ApplicationError {
  public readonly resource?: string;
  public readonly resourceId?: string;

  constructor(message: string = 'Resource not found', resource?: string, resourceId?: string) {
    super(message, 404, 'NOT_FOUND');
    this.resource = resource;
    this.resourceId = resourceId;
  }
}

export class UserNotFoundError extends NotFoundError {
  constructor(userId?: string) {
    super(`User not found${userId ? ` with ID: ${userId}` : ''}`, 'user', userId);
    this.code = 'USER_NOT_FOUND';
  }
}

export class SongNotFoundError extends NotFoundError {
  constructor(songId?: string) {
    super(`Song not found${songId ? ` with ID: ${songId}` : ''}`, 'song', songId);
    this.code = 'SONG_NOT_FOUND';
  }
}

export class AlbumNotFoundError extends NotFoundError {
  constructor(albumId?: string) {
    super(`Album not found${albumId ? ` with ID: ${albumId}` : ''}`, 'album', albumId);
    this.code = 'ALBUM_NOT_FOUND';
  }
}

// Conflict Errors
export class ConflictError extends ApplicationError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
  }
}

export class DuplicateResourceError extends ConflictError {
  public readonly resource?: string;
  public readonly field?: string;
  public readonly value?: any;

  constructor(message: string, resource?: string, field?: string, value?: any) {
    super(message, 409, 'DUPLICATE_RESOURCE');
    this.resource = resource;
    this.field = field;
    this.value = value;
  }
}

export class UserAlreadyExistsError extends DuplicateResourceError {
  constructor(field: string, value: string) {
    super(`User with ${field} '${value}' already exists`, 'user', field, value);
    this.code = 'USER_ALREADY_EXISTS';
  }
}

// Rate Limiting Errors
export class RateLimitError extends ApplicationError {
  public readonly limit: number;
  public readonly windowMs: number;
  public readonly retryAfter?: number;

  constructor(
    message: string = 'Rate limit exceeded',
    limit: number,
    windowMs: number,
    retryAfter?: number
  ) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.limit = limit;
    this.windowMs = windowMs;
    this.retryAfter = retryAfter;
  }
}

// File Upload Errors
export class FileUploadError extends ApplicationError {
  public readonly fileName?: string;
  public readonly fileSize?: number;
  public readonly mimeType?: string;

  constructor(
    message: string = 'File upload error',
    fileName?: string,
    fileSize?: number,
    mimeType?: string
  ) {
    super(message, 400, 'FILE_UPLOAD_ERROR');
    this.fileName = fileName;
    this.fileSize = fileSize;
    this.mimeType = mimeType;
  }
}

export class UnsupportedFileTypeError extends FileUploadError {
  constructor(mimeType: string, fileName?: string) {
    super(`Unsupported file type: ${mimeType}`, fileName, undefined, mimeType);
    this.code = 'UNSUPPORTED_FILE_TYPE';
  }
}

export class FileTooLargeError extends FileUploadError {
  public readonly maxSize: number;

  constructor(fileSize: number, maxSize: number, fileName?: string) {
    super(`File too large: ${fileSize} bytes (max: ${maxSize} bytes)`, fileName, fileSize);
    this.code = 'FILE_TOO_LARGE';
    this.maxSize = maxSize;
  }
}

// Business Logic Errors
export class BusinessLogicError extends ApplicationError {
  constructor(message: string, code: string = 'BUSINESS_LOGIC_ERROR') {
    super(message, 400, code);
  }
}

export class InvalidOperationError extends BusinessLogicError {
  constructor(message: string = 'Invalid operation') {
    super(message, 'INVALID_OPERATION');
  }
}

export class InsufficientFundsError extends BusinessLogicError {
  constructor(message: string = 'Insufficient funds') {
    super(message, 'INSUFFICIENT_FUNDS');
  }
}

// External Service Errors
export class ExternalServiceError extends ApplicationError {
  public readonly service: string;
  public readonly originalError?: Error;

  constructor(
    message: string,
    service: string,
    statusCode: number = 503,
    originalError?: Error
  ) {
    super(message, statusCode, 'EXTERNAL_SERVICE_ERROR');
    this.service = service;
    this.originalError = originalError;
  }
}

export class DatabaseError extends ExternalServiceError {
  constructor(message: string = 'Database operation failed', originalError?: Error) {
    super(message, 'database', 503, originalError);
    this.code = 'DATABASE_ERROR';
  }
}

export class CacheError extends ExternalServiceError {
  constructor(message: string = 'Cache operation failed', originalError?: Error) {
    super(message, 'cache', 503, originalError);
    this.code = 'CACHE_ERROR';
  }
}

export class StorageError extends ExternalServiceError {
  constructor(message: string = 'Storage operation failed', originalError?: Error) {
    super(message, 'storage', 503, originalError);
    this.code = 'STORAGE_ERROR';
  }
}

// System Errors
export class SystemError extends ApplicationError {
  constructor(
    message: string = 'Internal system error',
    code: string = 'SYSTEM_ERROR',
    isOperational: boolean = false
  ) {
    super(message, 500, code, isOperational);
  }
}

export class ConfigurationError extends SystemError {
  public readonly configKey?: string;

  constructor(message: string, configKey?: string) {
    super(message, 'CONFIGURATION_ERROR', false);
    this.configKey = configKey;
  }
}

export class TimeoutError extends ApplicationError {
  public readonly timeoutMs: number;
  public readonly operation?: string;

  constructor(
    message: string = 'Operation timed out',
    timeoutMs: number,
    operation?: string
  ) {
    super(message, 504, 'TIMEOUT_ERROR');
    this.timeoutMs = timeoutMs;
    this.operation = operation;
  }
}

// Security Errors
export class SecurityError extends ApplicationError {
  public readonly threatLevel: 'low' | 'medium' | 'high' | 'critical';
  public readonly securityEvent: string;

  constructor(
    message: string,
    threatLevel: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    securityEvent: string = 'security_violation'
  ) {
    super(message, 403, 'SECURITY_ERROR');
    this.threatLevel = threatLevel;
    this.securityEvent = securityEvent;
  }
}

export class SuspiciousActivityError extends SecurityError {
  constructor(message: string = 'Suspicious activity detected') {
    super(message, 'high', 'suspicious_activity');
    this.code = 'SUSPICIOUS_ACTIVITY';
  }
}

export class IPBlockedError extends SecurityError {
  public readonly ip: string;

  constructor(ip: string) {
    super(`Access denied from IP: ${ip}`, 'high', 'ip_blocked');
    this.code = 'IP_BLOCKED';
    this.ip = ip;
  }
}

// Utility functions for error handling
export class ErrorUtils {
  /**
   * Check if error is operational (expected) or programming error
   */
  static isOperationalError(error: Error): boolean {
    if (error instanceof ApplicationError) {
      return error.isOperational;
    }
    return false;
  }

  /**
   * Extract error information for logging
   */
  static extractErrorInfo(error: Error): any {
    const info: any = {
      name: error.name,
      message: error.message,
      stack: error.stack
    };

    if (error instanceof ApplicationError) {
      info.statusCode = error.statusCode;
      info.code = error.code;
      info.isOperational = error.isOperational;
      info.timestamp = error.timestamp;
    }

    return info;
  }

  /**
   * Create error from unknown type
   */
  static createError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }

    if (typeof error === 'string') {
      return new Error(error);
    }

    if (typeof error === 'object' && error !== null) {
      return new Error(JSON.stringify(error));
    }

    return new Error('Unknown error occurred');
  }

  /**
   * Wrap external service errors
   */
  static wrapExternalError(error: Error, service: string): ExternalServiceError {
    return new ExternalServiceError(
      `${service} error: ${error.message}`,
      service,
      503,
      error
    );
  }
}