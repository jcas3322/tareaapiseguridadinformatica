/**
 * Request Logging Middleware
 * Logs HTTP requests and responses
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Logger } from '../../logging/WinstonLogger';

export interface RequestLoggingConfig {
  enableRequestLogging: boolean;
  enableResponseLogging: boolean;
  enableBodyLogging: boolean;
  enableHeaderLogging: boolean;
  maxBodySize: number;
  excludePaths: string[];
  excludeHeaders: string[];
  logLevel: 'info' | 'debug' | 'warn';
  enablePerformanceLogging: boolean;
}

export class RequestLoggingMiddleware {
  private logger: Logger;
  private config: RequestLoggingConfig;

  constructor(logger: Logger, config: RequestLoggingConfig) {
    this.logger = logger;
    this.config = config;
  }

  public logRequests(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip excluded paths
      if (this.config.excludePaths.some(path => req.path.includes(path))) {
        return next();
      }

      const startTime = Date.now();
      const requestId = this.generateRequestId();

      // Add request ID to request object
      (req as any).requestId = requestId;

      // Log incoming request
      if (this.config.enableRequestLogging) {
        this.logIncomingRequest(req, requestId);
      }

      // Use res.on('finish') instead of overriding res.end
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        
        if (this.config.enableResponseLogging) {
          this.logOutgoingResponse(req, res, duration, requestId);
        }

        if (this.config.enablePerformanceLogging && duration > 1000) {
          this.logger.warn('Slow request detected', {
            requestId,
            method: req.method,
            url: req.url,
            duration: `${duration}ms`,
            statusCode: res.statusCode
          });
        }
      });

      next();
    };
  }

  private logIncomingRequest(req: Request, requestId: string): void {
    const logData: any = {
      requestId,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    };

    if (this.config.enableHeaderLogging) {
      const headers = { ...req.headers };
      // Remove sensitive headers
      this.config.excludeHeaders.forEach(header => {
        delete headers[header];
      });
      logData.headers = headers;
    }

    if (this.config.enableBodyLogging && req.body) {
      const bodyStr = JSON.stringify(req.body);
      if (bodyStr.length <= this.config.maxBodySize) {
        logData.body = req.body;
      } else {
        logData.bodySize = bodyStr.length;
        logData.bodyTruncated = true;
      }
    }

    this.logger[this.config.logLevel]('Incoming request', logData);
  }

  private logOutgoingResponse(req: Request, res: Response, duration: number, requestId: string): void {
    const logData: any = {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    };

    // Determine log level based on status code
    let logLevel: 'info' | 'warn' | 'error' = 'info';
    if (res.statusCode >= 400 && res.statusCode < 500) {
      logLevel = 'warn';
    } else if (res.statusCode >= 500) {
      logLevel = 'error';
    }

    this.logger[logLevel]('Outgoing response', logData);
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
}