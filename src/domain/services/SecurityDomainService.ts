/**
 * SecurityDomainService
 * Encapsulates security-related business logic and validation
 */

import { User } from '../entities/User';
import { UserId } from '../entities/value-objects/UserId';
import { UserRole } from '../entities/enums/UserRole';

export interface SecurityEvent {
  readonly type: SecurityEventType;
  readonly userId?: UserId;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly timestamp: Date;
  readonly details: Record<string, unknown>;
  readonly severity: SecuritySeverity;
}

export enum SecurityEventType {
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGIN_BRUTE_FORCE = 'login_brute_force',
  PASSWORD_CHANGE = 'password_change',
  EMAIL_CHANGE = 'email_change',
  ROLE_CHANGE = 'role_change',
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_UNLOCKED = 'account_unlocked',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  DATA_ACCESS = 'data_access',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  FILE_UPLOAD = 'file_upload',
  CONTENT_FLAGGED = 'content_flagged'
}

export enum SecuritySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface RateLimitConfig {
  readonly windowMs: number;
  readonly maxAttempts: number;
  readonly blockDurationMs: number;
}

export interface SecurityPolicy {
  readonly passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    maxAge: number; // days
  };
  readonly sessionPolicy: {
    maxDuration: number; // minutes
    maxConcurrentSessions: number;
    requireReauth: boolean;
  };
  readonly rateLimits: {
    login: RateLimitConfig;
    api: RateLimitConfig;
    upload: RateLimitConfig;
  };
}

export class SecurityDomainService {
  private readonly defaultSecurityPolicy: SecurityPolicy = {
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      maxAge: 90
    },
    sessionPolicy: {
      maxDuration: 60, // 1 hour
      maxConcurrentSessions: 3,
      requireReauth: true
    },
    rateLimits: {
      login: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxAttempts: 5,
        blockDurationMs: 30 * 60 * 1000 // 30 minutes
      },
      api: {
        windowMs: 60 * 1000, // 1 minute
        maxAttempts: 100,
        blockDurationMs: 5 * 60 * 1000 // 5 minutes
      },
      upload: {
        windowMs: 60 * 1000, // 1 minute
        maxAttempts: 10,
        blockDurationMs: 10 * 60 * 1000 // 10 minutes
      }
    }
  };

  /**
   * Validates if a user can access a specific resource
   */
  validateResourceAccess(
    user: User,
    resourceType: string,
    resourceOwnerId?: UserId,
    requiredRole?: UserRole
  ): { allowed: boolean; reason?: string } {
    // Check if user is active
    if (!user.isActive) {
      return { allowed: false, reason: 'User account is inactive' };
    }

    // Check if user is deleted
    if (user.deletedAt) {
      return { allowed: false, reason: 'User account is deleted' };
    }

    // Check role-based access
    if (requiredRole && !user.canAccess(requiredRole)) {
      return { allowed: false, reason: 'Insufficient permissions' };
    }

    // Check resource ownership
    if (resourceOwnerId && !user.isOwner(resourceOwnerId) && !user.canAccess(UserRole.MODERATOR)) {
      return { allowed: false, reason: 'Access denied: not resource owner' };
    }

    return { allowed: true };
  }

  /**
   * Creates a security event for logging
   */
  createSecurityEvent(
    type: SecurityEventType,
    details: Record<string, unknown>,
    userId?: UserId,
    ipAddress?: string,
    userAgent?: string
  ): SecurityEvent {
    return {
      type,
      userId,
      ipAddress,
      userAgent,
      timestamp: new Date(),
      details,
      severity: this.determineSeverity(type, details)
    };
  }

  /**
   * Validates JWT token payload for security
   */
  validateJwtPayload(payload: Record<string, unknown>): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check required fields
    if (!payload.sub || typeof payload.sub !== 'string') {
      issues.push('Missing or invalid subject (sub)');
    }

    if (!payload.iat || typeof payload.iat !== 'number') {
      issues.push('Missing or invalid issued at (iat)');
    }

    if (!payload.exp || typeof payload.exp !== 'number') {
      issues.push('Missing or invalid expiration (exp)');
    }

    // Check expiration
    if (payload.exp && typeof payload.exp === 'number') {
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp <= now) {
        issues.push('Token has expired');
      }
    }

    // Check issued at time
    if (payload.iat && typeof payload.iat === 'number') {
      const now = Math.floor(Date.now() / 1000);
      const maxAge = 24 * 60 * 60; // 24 hours
      if (payload.iat > now || (now - payload.iat) > maxAge) {
        issues.push('Invalid issued at time');
      }
    }

    // Check issuer
    if (payload.iss && payload.iss !== 'spotify-api-security') {
      issues.push('Invalid issuer');
    }

    // Check audience
    if (payload.aud && payload.aud !== 'spotify-api-users') {
      issues.push('Invalid audience');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Detects suspicious login patterns
   */
  detectSuspiciousLogin(loginAttempts: Array<{
    timestamp: Date;
    ipAddress: string;
    userAgent: string;
    success: boolean;
  }>): { suspicious: boolean; reasons: string[] } {
    const reasons: string[] = [];

    if (loginAttempts.length === 0) {
      return { suspicious: false, reasons: [] };
    }

    // Check for rapid successive attempts
    const recentAttempts = loginAttempts.filter(attempt => {
      const timeDiff = Date.now() - attempt.timestamp.getTime();
      return timeDiff < 5 * 60 * 1000; // Last 5 minutes
    });

    if (recentAttempts.length > 10) {
      reasons.push('Too many login attempts in short time');
    }

    // Check for multiple IP addresses
    const uniqueIPs = new Set(recentAttempts.map(attempt => attempt.ipAddress));
    if (uniqueIPs.size > 3) {
      reasons.push('Login attempts from multiple IP addresses');
    }

    // Check for multiple user agents
    const uniqueUserAgents = new Set(recentAttempts.map(attempt => attempt.userAgent));
    if (uniqueUserAgents.size > 2) {
      reasons.push('Login attempts from multiple devices/browsers');
    }

    // Check for geographic anomalies (simplified)
    const suspiciousIPs = recentAttempts.filter(attempt => 
      this.isSuspiciousIP(attempt.ipAddress)
    );

    if (suspiciousIPs.length > 0) {
      reasons.push('Login attempts from suspicious IP addresses');
    }

    // Check failure rate
    const failureRate = recentAttempts.filter(attempt => !attempt.success).length / recentAttempts.length;
    if (failureRate > 0.8 && recentAttempts.length > 5) {
      reasons.push('High failure rate in login attempts');
    }

    return {
      suspicious: reasons.length > 0,
      reasons
    };
  }

  /**
   * Validates file upload for security
   */
  validateFileUpload(file: {
    originalname: string;
    mimetype: string;
    size: number;
    buffer?: Buffer;
  }): { safe: boolean; issues: string[] } {
    const issues: string[] = [];

    // Filename validation
    if (this.containsMaliciousFilename(file.originalname)) {
      issues.push('Filename contains malicious patterns');
    }

    // MIME type validation
    if (this.isSuspiciousMimeType(file.mimetype)) {
      issues.push('Suspicious or disallowed file type');
    }

    // File size validation
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      issues.push('File size exceeds maximum allowed');
    }

    // Content validation (if buffer is available)
    if (file.buffer && this.containsMaliciousContent(file.buffer)) {
      issues.push('File contains potentially malicious content');
    }

    return {
      safe: issues.length === 0,
      issues
    };
  }

  /**
   * Generates secure session configuration
   */
  generateSessionConfig(user: User): {
    maxAge: number;
    secure: boolean;
    httpOnly: boolean;
    sameSite: 'strict' | 'lax' | 'none';
  } {
    const baseMaxAge = this.defaultSecurityPolicy.sessionPolicy.maxDuration * 60 * 1000;
    
    // Reduce session time for high-privilege users
    const maxAge = user.canAccess(UserRole.ADMIN) ? baseMaxAge / 2 : baseMaxAge;

    return {
      maxAge,
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'strict'
    };
  }

  /**
   * Validates API request for security
   */
  validateApiRequest(request: {
    method: string;
    path: string;
    headers: Record<string, string>;
    body?: unknown;
    query?: Record<string, unknown>;
  }): { safe: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check for SQL injection patterns
    const sqlInjectionPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b)/i,
      /(UNION|OR|AND)\s+\d+\s*=\s*\d+/i,
      /['"]\s*(OR|AND)\s+['"]\d+['"]\s*=\s*['"]\d+['"]]/i
    ];

    const checkForSQLInjection = (value: string) => {
      return sqlInjectionPatterns.some(pattern => pattern.test(value));
    };

    // Check query parameters
    if (request.query) {
      for (const [key, value] of Object.entries(request.query)) {
        if (typeof value === 'string' && checkForSQLInjection(value)) {
          issues.push(`SQL injection attempt in query parameter: ${key}`);
        }
      }
    }

    // Check for XSS patterns
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi
    ];

    const checkForXSS = (value: string) => {
      return xssPatterns.some(pattern => pattern.test(value));
    };

    // Check request body for XSS
    if (request.body && typeof request.body === 'object') {
      const bodyString = JSON.stringify(request.body);
      if (checkForXSS(bodyString)) {
        issues.push('XSS attempt detected in request body');
      }
    }

    // Check headers for suspicious content
    const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'x-originating-ip'];
    for (const header of suspiciousHeaders) {
      const value = request.headers[header];
      if (value && this.isSuspiciousIP(value)) {
        issues.push(`Suspicious IP in header: ${header}`);
      }
    }

    // Check for path traversal
    if (request.path.includes('..') || request.path.includes('%2e%2e')) {
      issues.push('Path traversal attempt detected');
    }

    return {
      safe: issues.length === 0,
      issues
    };
  }

  // Private helper methods
  private determineSeverity(type: SecurityEventType, details: Record<string, unknown>): SecuritySeverity {
    switch (type) {
      case SecurityEventType.LOGIN_BRUTE_FORCE:
      case SecurityEventType.UNAUTHORIZED_ACCESS:
        return SecuritySeverity.HIGH;
      
      case SecurityEventType.ACCOUNT_LOCKED:
      case SecurityEventType.SUSPICIOUS_ACTIVITY:
        return SecuritySeverity.MEDIUM;
      
      case SecurityEventType.LOGIN_FAILURE:
      case SecurityEventType.DATA_ACCESS:
        return SecuritySeverity.LOW;
      
      case SecurityEventType.ROLE_CHANGE:
      case SecurityEventType.PASSWORD_CHANGE:
      case SecurityEventType.EMAIL_CHANGE:
        return SecuritySeverity.MEDIUM;
      
      default:
        return SecuritySeverity.LOW;
    }
  }

  private isSuspiciousIP(ipAddress: string): boolean {
    // Simplified suspicious IP detection
    const suspiciousPatterns = [
      /^10\./, // Private networks (in public context)
      /^192\.168\./, // Private networks (in public context)
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private networks (in public context)
      /^127\./, // Loopback
      /^0\./, // Invalid
      /^255\./ // Broadcast
    ];

    return suspiciousPatterns.some(pattern => pattern.test(ipAddress));
  }

  private containsMaliciousFilename(filename: string): boolean {
    const maliciousPatterns = [
      /\.\./,           // Directory traversal
      /[<>|]/,          // Invalid characters
      /\0/,             // Null bytes
      /\.exe$/i,        // Executable files
      /\.bat$/i,        // Batch files
      /\.cmd$/i,        // Command files
      /\.scr$/i,        // Screen saver files
      /\.pif$/i,        // Program information files
      /\.com$/i,        // Command files
      /\.jar$/i,        // Java archives
      /\.php$/i,        // PHP files
      /\.jsp$/i,        // JSP files
      /\.asp$/i,        // ASP files
    ];

    return maliciousPatterns.some(pattern => pattern.test(filename));
  }

  private isSuspiciousMimeType(mimetype: string): boolean {
    const allowedMimeTypes = [
      'audio/mpeg',
      'audio/wav',
      'audio/flac',
      'audio/aac',
      'audio/mp4',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/json',
      'text/plain'
    ];

    return !allowedMimeTypes.includes(mimetype);
  }

  private containsMaliciousContent(buffer: Buffer): boolean {
    // Simple check for executable signatures
    const maliciousSignatures = [
      Buffer.from([0x4D, 0x5A]), // PE executable (MZ)
      Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF executable
      Buffer.from([0xCA, 0xFE, 0xBA, 0xBE]), // Java class file
      Buffer.from([0x50, 0x4B, 0x03, 0x04]), // ZIP file (could contain malware)
    ];

    return maliciousSignatures.some(signature => 
      buffer.subarray(0, signature.length).equals(signature)
    );
  }
}