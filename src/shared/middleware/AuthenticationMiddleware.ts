/**
 * Authentication Middleware
 * Handles JWT token validation and user authentication
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Logger } from '../../infrastructure/logging/WinstonLogger';
import { PostgreSQLAdapter } from '../../infrastructure/database/adapters/PostgreSQLAdapter';

export class AuthenticationMiddleware {
  private jwtSecret: string;
  private logger: Logger;
  private dbAdapter: PostgreSQLAdapter;

  constructor(dbAdapter: PostgreSQLAdapter, logger: Logger) {
    this.jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
    this.logger = logger;
    this.dbAdapter = dbAdapter;
  }

  public authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        res.status(401).json({
          error: 'Authorization header is required'
        });
        return;
      }

      if (!authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          error: 'Authorization header must start with "Bearer "'
        });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      if (!token) {
        res.status(401).json({
          error: 'Token is required'
        });
        return;
      }

      // Verify JWT token
      let decoded: any;
      try {
        decoded = jwt.verify(token, this.jwtSecret);
      } catch (jwtError) {
        if (jwtError instanceof jwt.TokenExpiredError) {
          res.status(401).json({
            error: 'Token has expired',
            code: 'TOKEN_EXPIRED'
          });
        } else if (jwtError instanceof jwt.JsonWebTokenError) {
          res.status(401).json({
            error: 'Invalid token',
            code: 'INVALID_TOKEN'
          });
        } else {
          res.status(401).json({
            error: 'Token verification failed'
          });
        }
        return;
      }

      // Validate token payload
      if (!decoded.userId || !decoded.email) {
        res.status(401).json({
          error: 'Invalid token payload'
        });
        return;
      }

      // Check if user still exists and is active
      const userResult = await this.dbAdapter.query(
        'SELECT id, email, name, role, is_active FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (userResult.rows.length === 0) {
        res.status(401).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
        return;
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        res.status(401).json({
          error: 'User account is deactivated',
          code: 'ACCOUNT_DEACTIVATED'
        });
        return;
      }

      // Attach user info to request
      (req as any).user = {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      };

      next();

    } catch (error) {
      this.logger.error('Authentication middleware error', error);
      res.status(500).json({
        error: 'Internal server error during authentication'
      });
    }
  };

  public optionalAuthenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      // If no auth header, continue without authentication
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        next();
        return;
      }

      const token = authHeader.substring(7);

      if (!token) {
        next();
        return;
      }

      try {
        const decoded = jwt.verify(token, this.jwtSecret) as any;

        if (decoded.userId && decoded.email) {
          // Check if user exists and is active
          const userResult = await this.dbAdapter.query(
            'SELECT id, email, name, role, is_active FROM users WHERE id = $1',
            [decoded.userId]
          );

          if (userResult.rows.length > 0 && userResult.rows[0].is_active) {
            const user = userResult.rows[0];
            (req as any).user = {
              userId: user.id,
              email: user.email,
              name: user.name,
              role: user.role
            };
          }
        }
      } catch (jwtError) {
        // Ignore JWT errors in optional authentication
        this.logger.debug('Optional authentication failed', jwtError);
      }

      next();

    } catch (error) {
      this.logger.error('Optional authentication middleware error', error);
      next(); // Continue even if there's an error
    }
  };

  public requireRole = (requiredRole: string) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          error: 'Authentication required'
        });
        return;
      }

      if (user.role !== requiredRole && user.role !== 'admin') {
        res.status(403).json({
          error: `Access denied. Required role: ${requiredRole}`,
          userRole: user.role
        });
        return;
      }

      next();
    };
  };

  public requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({
        error: 'Authentication required'
      });
      return;
    }

    if (user.role !== 'admin') {
      res.status(403).json({
        error: 'Admin access required',
        userRole: user.role
      });
      return;
    }

    next();
  };
}