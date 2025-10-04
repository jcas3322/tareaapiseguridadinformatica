/**
 * CSP Report Middleware
 * Handles Content Security Policy violation reports
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Logger } from '../../logging/WinstonLogger';

export class CSPReportMiddleware {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  public validateCSPReportContentType(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      const contentType = req.get('Content-Type');
      
      if (!contentType || !contentType.includes('application/csp-report')) {
        return res.status(400).json({
          error: 'Invalid Content-Type for CSP report'
        });
      }

      next();
    };
  }

  public handleCSPReport(): RequestHandler {
    return (req: Request, res: Response) => {
      try {
        const report = req.body;
        
        this.logger.warn('CSP Violation Report', {
          report,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        });

        res.status(204).send();
      } catch (error) {
        this.logger.error('Failed to process CSP report', error);
        res.status(500).json({ error: 'Failed to process CSP report' });
      }
    };
  }

  public getCSPStats(): RequestHandler {
    return (req: Request, res: Response) => {
      res.json({
        message: 'CSP statistics endpoint',
        timestamp: new Date().toISOString()
      });
    };
  }
}