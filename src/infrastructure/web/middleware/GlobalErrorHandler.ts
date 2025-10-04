/**
 * Global Error Handler
 * Centralized error handling and process management
 */

import { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from 'express';
import { Logger } from '../../logging/WinstonLogger';

export interface ErrorHandlerConfig {
  enableStackTrace: boolean;
  enableErrorDetails: boolean;
  enableErrorReporting: boolean;
  sanitizeErrors: boolean;
  logErrors: boolean;
  environment: string;
}

export class GlobalErrorHandler {
  private logger: Logger;
  private config: ErrorHandlerConfig;

  constructor(logger: Logger, config: ErrorHandlerConfig) {
    this.logger = logger;
    this.config = config;
  }

  public handleErrors(): ErrorRequestHandler {
    return (error: Error, req: Request, res: Response, next: NextFunction) => {
      // Log the error
      if (this.config.logErrors) {
        this.logger.error('Unhandled error', {
          error: error.message,
          stack: error.stack,
          url: req.url,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          requestId: (req as any).requestId
        });
      }

      // Don't send response if headers already sent
      if (res.headersSent) {
        return next(error);
      }

      // Determine status code
      const statusCode = (error as any).statusCode || (error as any).status || 500;

      // Build error response
      const errorResponse: any = {
        error: this.config.sanitizeErrors ? 'Internal Server Error' : error.message,
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method
      };

      // Add details in development
      if (this.config.enableErrorDetails) {
        errorResponse.details = error.message;
      }

      // Add stack trace in development
      if (this.config.enableStackTrace) {
        errorResponse.stack = error.stack;
      }

      res.status(statusCode).json(errorResponse);
    };
  }

  public handleNotFound(): RequestHandler {
    return (req: Request, res: Response) => {
      const error = {
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method
      };

      this.logger.warn('Route not found', {
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(404).json(error);
    };
  }

  public handleTimeout(timeoutMs: number): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      const timeout = setTimeout(() => {
        if (!res.headersSent) {
          this.logger.warn('Request timeout', {
            url: req.url,
            method: req.method,
            timeout: timeoutMs,
            ip: req.ip
          });

          res.status(408).json({
            error: 'Request Timeout',
            message: 'Request took too long to process',
            timeout: `${timeoutMs}ms`,
            timestamp: new Date().toISOString()
          });
        }
      }, timeoutMs);

      // Clear timeout when response is sent
      res.on('finish', () => {
        clearTimeout(timeout);
      });

      next();
    };
  }

  public handleUnhandledRejection(): void {
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      this.logger.error('Unhandled Promise Rejection', {
        reason: reason?.message || reason,
        stack: reason?.stack,
        promise: promise.toString()
      });

      // In production, exit gracefully
      if (this.config.environment === 'production') {
        process.exit(1);
      }
    });
  }

  public handleUncaughtException(): void {
    process.on('uncaughtException', (error: Error) => {
      this.logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack
      });

      // Always exit on uncaught exception
      process.exit(1);
    });
  }

  public handleGracefulShutdown(): void {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

    signals.forEach(signal => {
      process.on(signal, () => {
        this.logger.info(`Received ${signal}, initiating graceful shutdown...`);
        
        // Give some time for cleanup
        setTimeout(() => {
          process.exit(0);
        }, 5000);
      });
    });
  }
}