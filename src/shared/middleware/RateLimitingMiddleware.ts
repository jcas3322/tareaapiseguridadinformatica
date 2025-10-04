/**
 * Rate Limiting Middleware
 * Handles request rate limiting to prevent abuse
 */

import { Request, Response, NextFunction } from 'express';
import { Logger } from '../../infrastructure/logging/WinstonLogger';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

export class RateLimitingMiddleware {
  private store: RateLimitStore = {};
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const key in this.store) {
      if (this.store[key].resetTime <= now) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      delete this.store[key];
    });

    if (keysToDelete.length > 0) {
      this.logger.debug(`Cleaned up ${keysToDelete.length} expired rate limit entries`);
    }
  }

  private createRateLimit = (
    windowMs: number,
    maxRequests: number,
    message: string,
    keyGenerator?: (req: Request) => string
  ) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const key = keyGenerator ? keyGenerator(req) : this.getClientKey(req);
      const now = Date.now();

      // Initialize or get existing entry
      if (!this.store[key] || this.store[key].resetTime <= now) {
        this.store[key] = {
          count: 0,
          resetTime: now + windowMs
        };
      }

      const entry = this.store[key];
      entry.count++;

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, maxRequests - entry.count).toString(),
        'X-RateLimit-Reset': new Date(entry.resetTime).toISOString()
      });

      if (entry.count > maxRequests) {
        this.logger.warn('Rate limit exceeded', {
          key,
          count: entry.count,
          limit: maxRequests,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path
        });

        res.status(429).json({
          error: message,
          retryAfter: Math.ceil((entry.resetTime - now) / 1000),
          limit: maxRequests,
          remaining: 0,
          resetTime: new Date(entry.resetTime).toISOString()
        });
        return;
      }

      next();
    };
  };

  private getClientKey(req: Request): string {
    // Try to get user ID if authenticated
    const user = (req as any).user;
    if (user && user.userId) {
      return `user:${user.userId}`;
    }

    // Fall back to IP address
    return `ip:${req.ip}`;
  }

  // General API rate limit: 100 requests per 15 minutes
  public generalRateLimit = () => {
    return this.createRateLimit(
      15 * 60 * 1000, // 15 minutes
      100,
      'Too many requests. Please try again later.'
    );
  };

  // API rate limit (alias for generalRateLimit for compatibility)
  public apiRateLimit = () => {
    return this.generalRateLimit();
  };

  // Authentication rate limit: 5 attempts per 15 minutes
  public authRateLimit = () => {
    return this.createRateLimit(
      15 * 60 * 1000, // 15 minutes
      5,
      'Too many authentication attempts. Please try again later.',
      (req: Request) => `auth:${req.ip}` // Always use IP for auth attempts
    );
  };

  // Upload rate limit: 10 uploads per hour
  public uploadRateLimit = () => {
    return this.createRateLimit(
      60 * 60 * 1000, // 1 hour
      10,
      'Too many uploads. Please try again later.'
    );
  };

  // Search rate limit: 30 searches per minute
  public searchRateLimit = () => {
    return this.createRateLimit(
      60 * 1000, // 1 minute
      30,
      'Too many search requests. Please slow down.'
    );
  };

  // Password reset rate limit: 3 attempts per hour
  public passwordResetRateLimit = () => {
    return this.createRateLimit(
      60 * 60 * 1000, // 1 hour
      3,
      'Too many password reset attempts. Please try again later.',
      (req: Request) => `pwd-reset:${req.ip}`
    );
  };

  // Account creation rate limit: 3 accounts per hour per IP
  public accountCreationRateLimit = () => {
    return this.createRateLimit(
      60 * 60 * 1000, // 1 hour
      3,
      'Too many account creation attempts. Please try again later.',
      (req: Request) => `account-creation:${req.ip}`
    );
  };

  // Strict rate limit for sensitive operations: 5 requests per hour
  public strictRateLimit = () => {
    return this.createRateLimit(
      60 * 60 * 1000, // 1 hour
      5,
      'Rate limit exceeded for sensitive operation. Please try again later.'
    );
  };

  // Custom rate limit factory
  public customRateLimit = (windowMs: number, maxRequests: number, message?: string) => {
    return this.createRateLimit(
      windowMs,
      maxRequests,
      message || 'Rate limit exceeded. Please try again later.'
    );
  };

  // Get current rate limit status for a client
  public getRateLimitStatus = (req: Request): {
    key: string;
    count: number;
    resetTime: number;
    remaining: number;
  } | null => {
    const key = this.getClientKey(req);
    const entry = this.store[key];

    if (!entry) {
      return null;
    }

    return {
      key,
      count: entry.count,
      resetTime: entry.resetTime,
      remaining: Math.max(0, 100 - entry.count) // Assuming general limit of 100
    };
  };

  // Reset rate limit for a specific client (admin function)
  public resetRateLimit = (key: string): boolean => {
    if (this.store[key]) {
      delete this.store[key];
      this.logger.info('Rate limit reset for key', { key });
      return true;
    }
    return false;
  };

  // Get all active rate limit entries (admin function)
  public getAllRateLimits = (): { [key: string]: { count: number; resetTime: number } } => {
    const now = Date.now();
    const active: { [key: string]: { count: number; resetTime: number } } = {};

    for (const key in this.store) {
      if (this.store[key].resetTime > now) {
        active[key] = {
          count: this.store[key].count,
          resetTime: this.store[key].resetTime
        };
      }
    }

    return active;
  };
}