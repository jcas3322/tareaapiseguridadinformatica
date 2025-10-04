/**
 * Security Middleware
 * Implements comprehensive security measures
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { SecurityMiddlewareConfig } from '../config/SecurityConfig';
import { Logger } from '../../logging/WinstonLogger';

export class SecurityMiddleware {
  private config: SecurityMiddlewareConfig;
  private logger: Logger;

  constructor(config: SecurityMiddlewareConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  public getAllMiddleware(): RequestHandler[] {
    return [
      this.requestSizeLimiter(),
      this.validateSecurityHeaders(),
      this.configureCORS(),
      this.configureHelmet(),
      this.additionalSecurityHeaders()
    ];
  }

  public requestSizeLimiter(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      const contentLength = req.get('content-length');
      const maxSize = 10 * 1024 * 1024; // 10MB

      if (contentLength && parseInt(contentLength) > maxSize) {
        this.logger.warn('Request size limit exceeded', {
          contentLength,
          maxSize,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        return res.status(413).json({
          error: 'Request entity too large',
          maxSize: '10MB'
        });
      }

      next();
    };
  }

  public validateSecurityHeaders(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      // Log suspicious headers
      const suspiciousHeaders = [
        'x-forwarded-host',
        'x-original-url',
        'x-rewrite-url'
      ];

      suspiciousHeaders.forEach(header => {
        if (req.get(header)) {
          this.logger.warn('Suspicious header detected', {
            header,
            value: req.get(header),
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });
        }
      });

      next();
    };
  }

  public configureCORS(): RequestHandler {
    return cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);

        if (this.config.corsOrigins.includes(origin)) {
          callback(null, true);
        } else {
          this.logger.warn('CORS origin blocked', {
            origin,
            allowedOrigins: this.config.corsOrigins
          });
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      optionsSuccessStatus: 200,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization'
      ]
    });
  }

  public configureHelmet(): RequestHandler {
    const helmetConfig: any = {
      contentSecurityPolicy: this.config.enableCSP ? {
        directives: this.config.cspPolicy?.directives || {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      } : false,
      
      hsts: this.config.enableHSTS ? {
        maxAge: this.config.hstsMaxAge || 31536000,
        includeSubDomains: true,
        preload: true
      } : false,

      xssFilter: this.config.enableXSSProtection,
      frameguard: this.config.enableFrameGuard ? { action: 'deny' } : false,
      noSniff: this.config.enableContentTypeNoSniff,
      
      referrerPolicy: this.config.enableReferrerPolicy ? {
        policy: 'strict-origin-when-cross-origin'
      } : false
    };

    return helmet(helmetConfig);
  }

  public additionalSecurityHeaders(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      // Remove server identification
      res.removeHeader('X-Powered-By');
      
      // Additional security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      
      if (this.config.enableReferrerPolicy) {
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      }

      // Permissions Policy (formerly Feature Policy)
      res.setHeader('Permissions-Policy', 
        'camera=(), microphone=(), geolocation=(), payment=()'
      );

      next();
    };
  }

  public createRateLimit(windowMs: number, max: number, message?: string): RequestHandler {
    return rateLimit({
      windowMs,
      max,
      message: message || {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req: Request, res: Response) => {
        this.logger.warn('Rate limit exceeded', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method
        });

        res.status(429).json({
          error: 'Too many requests from this IP, please try again later.',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }
    });
  }
}