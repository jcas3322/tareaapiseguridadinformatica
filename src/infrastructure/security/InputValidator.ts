/**
 * InputValidator
 * Comprehensive input validation and sanitization service
 */

import * as joi from 'joi';
import * as DOMPurify from 'isomorphic-dompurify';

export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: string[];
  readonly sanitizedValue?: unknown;
}

export interface ValidationSchema {
  readonly [key: string]: joi.Schema;
}

export class InputValidator {
  private readonly maxStringLength = 10000;
  private readonly maxArrayLength = 1000;
  private readonly maxObjectDepth = 10;

  // Common validation schemas
  public readonly schemas = {
    email: joi.string().email().max(254).required(),
    username: joi.string().alphanum().min(3).max(30).required(),
    password: joi.string().min(8).max(128).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required(),
    uuid: joi.string().uuid().required(),
    url: joi.string().uri({ scheme: ['https'] }).max(2048),
    safeString: joi.string().max(1000).pattern(/^[a-zA-Z0-9\s\-_.,!?()]+$/),
    htmlString: joi.string().max(5000),
    phoneNumber: joi.string().pattern(/^\+?[1-9]\d{1,14}$/),
    ipAddress: joi.alternatives().try(
      joi.string().ip({ version: ['ipv4'] }),
      joi.string().ip({ version: ['ipv6'] })
    ),
    dateString: joi.string().isoDate(),
    positiveInteger: joi.number().integer().positive(),
    nonNegativeInteger: joi.number().integer().min(0),
    percentage: joi.number().min(0).max(100),
    tags: joi.array().items(joi.string().max(30)).max(10),
    sortDirection: joi.string().valid('asc', 'desc'),
    userRole: joi.string().valid('user', 'artist', 'moderator', 'admin'),
    genre: joi.string().valid(
      'rock', 'pop', 'jazz', 'classical', 'electronic', 'hip_hop', 'country',
      'blues', 'reggae', 'folk', 'metal', 'punk', 'indie', 'alternative',
      'r_and_b', 'soul', 'funk', 'disco', 'house', 'techno', 'ambient',
      'world', 'latin', 'reggaeton', 'other'
    )
  };

  /**
   * Validate input against a Joi schema
   */
  public validate(input: unknown, schema: joi.Schema): ValidationResult {
    try {
      const { error, value } = schema.validate(input, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });

      if (error) {
        return {
          isValid: false,
          errors: error.details.map(detail => detail.message)
        };
      }

      return {
        isValid: true,
        errors: [],
        sanitizedValue: value
      };
    } catch (error) {
      return {
        isValid: false,
        errors: ['Validation failed due to internal error']
      };
    }
  }

  /**
   * Validate object against multiple schemas
   */
  public validateObject(input: Record<string, unknown>, schemas: ValidationSchema): ValidationResult {
    const errors: string[] = [];
    const sanitizedObject: Record<string, unknown> = {};

    for (const [key, schema] of Object.entries(schemas)) {
      const value = input[key];
      const result = this.validate(value, schema);

      if (!result.isValid) {
        errors.push(...result.errors.map(error => `${key}: ${error}`));
      } else {
        sanitizedObject[key] = result.sanitizedValue;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: sanitizedObject
    };
  }

  /**
   * Sanitize HTML content
   */
  public sanitizeHtml(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Configure DOMPurify for strict sanitization
    const cleanHtml = DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li'],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
      RETURN_DOM_IMPORT: false
    });

    return cleanHtml;
  }

  /**
   * Sanitize plain text (remove/escape dangerous characters)
   */
  public sanitizeText(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/\0/g, '') // Remove null bytes
      .trim();
  }

  /**
   * Validate and sanitize file upload
   */
  public validateFileUpload(file: {
    originalname: string;
    mimetype: string;
    size: number;
  }, options: {
    allowedMimeTypes: string[];
    maxSize: number;
    allowedExtensions?: string[];
  }): ValidationResult {
    const errors: string[] = [];

    // Validate filename
    if (!file.originalname || typeof file.originalname !== 'string') {
      errors.push('Filename is required');
    } else {
      const sanitizedFilename = this.sanitizeFilename(file.originalname);
      if (sanitizedFilename !== file.originalname) {
        errors.push('Filename contains invalid characters');
      }

      // Check file extension if specified
      if (options.allowedExtensions) {
        const extension = sanitizedFilename.toLowerCase().split('.').pop();
        if (!extension || !options.allowedExtensions.includes(`.${extension}`)) {
          errors.push(`File extension not allowed. Allowed: ${options.allowedExtensions.join(', ')}`);
        }
      }
    }

    // Validate MIME type
    if (!file.mimetype || typeof file.mimetype !== 'string') {
      errors.push('MIME type is required');
    } else if (!options.allowedMimeTypes.includes(file.mimetype)) {
      errors.push(`MIME type not allowed. Allowed: ${options.allowedMimeTypes.join(', ')}`);
    }

    // Validate file size
    if (!Number.isInteger(file.size) || file.size <= 0) {
      errors.push('File size must be a positive integer');
    } else if (file.size > options.maxSize) {
      errors.push(`File size exceeds maximum allowed size of ${options.maxSize} bytes`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: {
        originalname: this.sanitizeFilename(file.originalname),
        mimetype: file.mimetype,
        size: file.size
      }
    };
  }

  /**
   * Sanitize filename
   */
  public sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      return '';
    }

    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace invalid chars with underscore
      .replace(/\.{2,}/g, '.') // Replace multiple dots with single dot
      .replace(/^\.+|\.+$/g, '') // Remove leading/trailing dots
      .substring(0, 255); // Limit length
  }

  /**
   * Validate SQL query parameters to prevent injection
   */
  public validateSqlParams(params: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const sanitizedParams: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      // Check parameter name
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        errors.push(`Invalid parameter name: ${key}`);
        continue;
      }

      // Check for SQL injection patterns in values
      if (typeof value === 'string') {
        if (this.containsSqlInjection(value)) {
          errors.push(`Parameter ${key} contains potential SQL injection`);
          continue;
        }
        sanitizedParams[key] = this.sanitizeText(value);
      } else {
        sanitizedParams[key] = value;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: sanitizedParams
    };
  }

  /**
   * Check for SQL injection patterns
   */
  private containsSqlInjection(input: string): boolean {
    const sqlInjectionPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/gi,
      /(UNION\s+SELECT)/gi,
      /(\bOR\b\s+\d+\s*=\s*\d+)/gi,
      /(\bAND\b\s+\d+\s*=\s*\d+)/gi,
      /('|(\\')|(;)|(--)|(\s)|(\/\*))/gi,
      /(char|nchar|varchar|nvarchar)\s*\(/gi,
      /(waitfor\s+delay)/gi,
      /(benchmark\s*\()/gi
    ];

    return sqlInjectionPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Validate XSS patterns
   */
  public containsXss(input: string): boolean {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /<object[^>]*>.*?<\/object>/gi,
      /<embed[^>]*>/gi,
      /<link[^>]*>/gi,
      /<meta[^>]*>/gi,
      /expression\s*\(/gi,
      /vbscript:/gi,
      /data:text\/html/gi
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Validate CSRF token format
   */
  public validateCsrfToken(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    // CSRF token should be a random string of specific length
    const csrfTokenRegex = /^[a-zA-Z0-9+/]{32,}={0,2}$/;
    return csrfTokenRegex.test(token);
  }

  /**
   * Rate limiting key validation
   */
  public validateRateLimitKey(key: string): boolean {
    if (!key || typeof key !== 'string') {
      return false;
    }

    // Rate limit key should be alphanumeric with colons and dots
    const rateLimitKeyRegex = /^[a-zA-Z0-9.:_-]+$/;
    return rateLimitKeyRegex.test(key) && key.length <= 100;
  }

  /**
   * Validate pagination parameters
   */
  public validatePagination(page?: unknown, pageSize?: unknown): ValidationResult {
    const schema = joi.object({
      page: joi.number().integer().min(1).default(1),
      pageSize: joi.number().integer().min(1).max(100).default(20)
    });

    return this.validate({ page, pageSize }, schema);
  }

  /**
   * Validate sort parameters
   */
  public validateSort(field?: unknown, direction?: unknown): ValidationResult {
    const schema = joi.object({
      field: joi.string().pattern(/^[a-zA-Z_][a-zA-Z0-9_]*$/).max(50),
      direction: this.schemas.sortDirection.default('asc')
    });

    return this.validate({ field, direction }, schema);
  }

  /**
   * Create custom validation schema
   */
  public createSchema(definition: Record<string, joi.Schema>): joi.ObjectSchema {
    return joi.object(definition);
  }

  /**
   * Validate against custom schema with additional security checks
   */
  public secureValidate(input: unknown, schema: joi.Schema): ValidationResult {
    // First, run standard validation
    const result = this.validate(input, schema);

    if (!result.isValid) {
      return result;
    }

    // Additional security checks
    const securityErrors = this.performSecurityChecks(result.sanitizedValue);

    return {
      isValid: securityErrors.length === 0,
      errors: [...result.errors, ...securityErrors],
      sanitizedValue: result.sanitizedValue
    };
  }

  private performSecurityChecks(value: unknown): string[] {
    const errors: string[] = [];

    if (typeof value === 'string') {
      if (this.containsXss(value)) {
        errors.push('Input contains potential XSS content');
      }
      if (this.containsSqlInjection(value)) {
        errors.push('Input contains potential SQL injection');
      }
    } else if (typeof value === 'object' && value !== null) {
      // Recursively check object properties
      for (const [key, val] of Object.entries(value)) {
        if (typeof val === 'string') {
          if (this.containsXss(val)) {
            errors.push(`Property ${key} contains potential XSS content`);
          }
          if (this.containsSqlInjection(val)) {
            errors.push(`Property ${key} contains potential SQL injection`);
          }
        }
      }
    }

    return errors;
  }
}