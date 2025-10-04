/**
 * Health Check Middleware
 * Provides health check and metrics endpoints
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Logger } from '../../logging/WinstonLogger';
import * as os from 'os';
import * as fs from 'fs';

export interface HealthCheckConfig {
  enableDetailedMetrics: boolean;
  enableDatabaseCheck: boolean;
  enableExternalServiceChecks: boolean;
  enableFileSystemCheck: boolean;
  enableMemoryCheck: boolean;
  memoryThreshold: number; // MB
  diskThreshold: number; // percentage
  responseTimeThreshold: number; // ms
}

export class HealthCheckMiddleware {
  private logger: Logger;
  private config: HealthCheckConfig;
  private requestCount = 0;
  private startTime = Date.now();

  constructor(logger: Logger, config: HealthCheckConfig) {
    this.logger = logger;
    this.config = config;
  }

  public healthCheck(): RequestHandler {
    return async (req: Request, res: Response) => {
      try {
        const health = await this.performHealthCheck();
        const statusCode = health.status === 'healthy' ? 200 : 503;
        
        res.status(statusCode).json(health);
      } catch (error) {
        this.logger.error('Health check failed', error);
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: 'Health check failed'
        });
      }
    };
  }

  public readinessProbe(): RequestHandler {
    return async (req: Request, res: Response) => {
      try {
        // Basic readiness check
        const isReady = await this.checkReadiness();
        
        if (isReady) {
          res.json({ status: 'ready', timestamp: new Date().toISOString() });
        } else {
          res.status(503).json({ status: 'not ready', timestamp: new Date().toISOString() });
        }
      } catch (error) {
        res.status(503).json({ status: 'not ready', error: 'Readiness check failed' });
      }
    };
  }

  public livenessProbe(): RequestHandler {
    return (req: Request, res: Response) => {
      // Simple liveness check
      res.json({ 
        status: 'alive', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    };
  }

  public metricsEndpoint(): RequestHandler {
    return (req: Request, res: Response) => {
      try {
        const metrics = this.collectMetrics();
        res.json(metrics);
      } catch (error) {
        this.logger.error('Metrics collection failed', error);
        res.status(500).json({ error: 'Metrics collection failed' });
      }
    };
  }

  public trackRequests(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      this.requestCount++;
      next();
    };
  }

  private async performHealthCheck(): Promise<any> {
    const checks: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    const issues: string[] = [];

    // Memory check
    if (this.config.enableMemoryCheck) {
      const memoryUsage = process.memoryUsage();
      const memoryUsedMB = memoryUsage.heapUsed / 1024 / 1024;
      
      checks.memory = {
        used: `${Math.round(memoryUsedMB)}MB`,
        total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
      };

      if (memoryUsedMB > this.config.memoryThreshold) {
        issues.push(`High memory usage: ${Math.round(memoryUsedMB)}MB`);
      }
    }

    // File system check
    if (this.config.enableFileSystemCheck) {
      try {
        const stats = fs.statSync('./');
        checks.filesystem = { accessible: true };
      } catch (error) {
        issues.push('File system not accessible');
        checks.filesystem = { accessible: false };
      }
    }

    // Set overall status
    if (issues.length > 0) {
      checks.status = 'degraded';
      checks.issues = issues;
    }

    if (this.config.enableDetailedMetrics) {
      checks.details = this.collectMetrics();
    }

    return checks;
  }

  private async checkReadiness(): Promise<boolean> {
    // Basic readiness checks
    try {
      // Check if process is responsive
      const memoryUsage = process.memoryUsage();
      const memoryUsedMB = memoryUsage.heapUsed / 1024 / 1024;
      
      // If memory usage is too high, not ready
      if (memoryUsedMB > this.config.memoryThreshold * 2) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  private collectMetrics(): any {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        version: process.version,
        platform: process.platform,
        arch: process.arch
      },
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
        arrayBuffers: `${Math.round(memoryUsage.arrayBuffers / 1024 / 1024)}MB`
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      system: {
        loadavg: os.loadavg(),
        totalmem: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`,
        freemem: `${Math.round(os.freemem() / 1024 / 1024 / 1024)}GB`,
        cpus: os.cpus().length
      },
      requests: {
        total: this.requestCount,
        rps: Math.round(this.requestCount / ((Date.now() - this.startTime) / 1000))
      },
      timestamp: new Date().toISOString()
    };
  }
}