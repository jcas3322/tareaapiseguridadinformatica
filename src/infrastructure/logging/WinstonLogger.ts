/**
 * Winston Logger Implementation
 * Structured logging with multiple transports
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import * as path from 'path';
import * as fs from 'fs';

export interface LoggerConfig {
  level: string;
  enableConsole: boolean;
  enableFile: boolean;
  logDirectory?: string;
  maxFiles?: string;
  maxSize?: string;
  enableRotation?: boolean;
  enableElastic?: boolean;
  environment: string;
  serviceName: string;
}

export interface Logger {
  info(message: string, meta?: any): void;
  error(message: string, error?: Error | any): void;
  warn(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
  log(level: string, message: string, meta?: any): void;
  child(meta: any): Logger;
  security(message: string, meta?: any): void;
  audit(message: string, meta?: any): void;
}

export class WinstonLogger implements Logger {
  private winston: winston.Logger;
  private config: LoggerConfig;

  constructor(config: LoggerConfig) {
    this.config = config;
    this.winston = this.createLogger();
  }

  private createLogger(): winston.Logger {
    const transports: winston.transport[] = [];

    // Console transport
    if (this.config.enableConsole) {
      transports.push(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
            return `${timestamp} [${level}]: ${message} ${metaStr}`;
          })
        )
      }));
    }

    // File transport
    if (this.config.enableFile && this.config.logDirectory) {
      // Ensure log directory exists
      if (!fs.existsSync(this.config.logDirectory)) {
        fs.mkdirSync(this.config.logDirectory, { recursive: true });
      }

      if (this.config.enableRotation) {
        // Rotating file transport
        transports.push(new DailyRotateFile({
          filename: path.join(this.config.logDirectory, 'application-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxFiles: this.config.maxFiles || '30d',
          maxSize: this.config.maxSize || '100m',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        }));

        // Error log file
        transports.push(new DailyRotateFile({
          filename: path.join(this.config.logDirectory, 'error-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxFiles: this.config.maxFiles || '30d',
          maxSize: this.config.maxSize || '100m',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        }));
      } else {
        // Simple file transport
        transports.push(new winston.transports.File({
          filename: path.join(this.config.logDirectory, 'application.log'),
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        }));
      }
    }

    return winston.createLogger({
      level: this.config.level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: {
        service: this.config.serviceName,
        environment: this.config.environment
      },
      transports
    });
  }

  public info(message: string, meta?: any): void {
    this.winston.info(message, meta);
  }

  public error(message: string, error?: Error | any): void {
    if (error instanceof Error) {
      this.winston.error(message, {
        error: error.message,
        stack: error.stack,
        ...error
      });
    } else {
      this.winston.error(message, error);
    }
  }

  public warn(message: string, meta?: any): void {
    this.winston.warn(message, meta);
  }

  public debug(message: string, meta?: any): void {
    this.winston.debug(message, meta);
  }

  public log(level: string, message: string, meta?: any): void {
    this.winston.log(level, message, meta);
  }

  public child(meta: any): Logger {
    const childLogger = this.winston.child(meta);
    return {
      info: (message: string, childMeta?: any) => childLogger.info(message, childMeta),
      error: (message: string, error?: Error | any) => {
        if (error instanceof Error) {
          childLogger.error(message, {
            error: error.message,
            stack: error.stack,
            ...error
          });
        } else {
          childLogger.error(message, error);
        }
      },
      warn: (message: string, childMeta?: any) => childLogger.warn(message, childMeta),
      debug: (message: string, childMeta?: any) => childLogger.debug(message, childMeta),
      log: (level: string, message: string, childMeta?: any) => childLogger.log(level, message, childMeta),
      child: (childChildMeta: any) => this.child({ ...meta, ...childChildMeta }),
      security: (message: string, childMeta?: any) => this.security(message, { ...meta, ...childMeta }),
      audit: (message: string, childMeta?: any) => this.audit(message, { ...meta, ...childMeta })
    };
  }

  public security(message: string, meta?: any): void {
    this.winston.warn(`[SECURITY] ${message}`, {
      ...meta,
      eventType: 'security',
      severity: 'high'
    });
  }

  public audit(message: string, meta?: any): void {
    this.winston.info(`[AUDIT] ${message}`, {
      ...meta,
      eventType: 'audit'
    });
  }

  public async flush(): Promise<void> {
    return new Promise((resolve) => {
      // Winston doesn't have a direct flush method, but we can end all transports
      const transports = this.winston.transports;
      let pending = transports.length;
      
      if (pending === 0) {
        resolve();
        return;
      }

      transports.forEach((transport) => {
        if (typeof (transport as any).flush === 'function') {
          (transport as any).flush(() => {
            pending--;
            if (pending === 0) resolve();
          });
        } else {
          pending--;
          if (pending === 0) resolve();
        }
      });
    });
  }

  public close(): void {
    this.winston.close();
  }
}