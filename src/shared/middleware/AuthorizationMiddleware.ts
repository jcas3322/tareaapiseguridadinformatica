/**
 * AuthorizationMiddleware
 * Express middleware for role-based authorization
 */

import { Response, NextFunction } from 'express';
import { UserRole, UserRoleValidator } from '../../domain/entities/enums/UserRole';
import { Logger } from '../../application/ports/Logger';
import { AuthenticatedRequest } from './AuthenticationMiddleware';

export interface AuthorizationOptions {
  readonly roles?: UserRole[];
  readonly requireOwnership?: boolean;
  readonly ownershipParam?: string; // URL parameter name for resource owner ID
  readonly allowSelf?: boolean; // Allow users to access their own resources
}

export class AuthorizationMiddleware {
  constructor(private readonly logger: Logger) {}

  /**
   * Require specific roles
   */
  public requireRoles(roles: UserRole[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      try {
        if (!req.user) {
          this.logger.warn('Authorization attempted without authentication', {
            path: req.path,
            method: req.method,
            ip: req.ip
          });

          return res.status(401).json({
            error: {
              code: 'AUTHENTICATION_REQUIRED',
              message: 'Authentication is required for this resource'
            }
          });
        }

        const userRole = UserRoleValidator.fromString(req.user.role);
        const hasRequiredRole = roles.some(role => UserRoleValidator.canAccess(userRole, role));

        if (!hasRequiredRole) {
          this.logger.warn('Insufficient permissions', {
            userId: req.user.sub,
            userRole: req.user.role,
            requiredRoles: roles,
            path: req.path,
            method: req.method,
            ip: req.ip
          });

          return res.status(403).json({
            error: {
              code: 'INSUFFICIENT_PERMISSIONS',
              message: 'You do not have permission to access this resource'
            }
          });
        }

        this.logger.debug('Authorization successful', {
          userId: req.user.sub,
          userRole: req.user.role,
          requiredRoles: roles,
          path: req.path,
          method: req.method
        });

        next();
      } catch (error) {
        this.logger.error('Authorization middleware error', error as Error, {
          path: req.path,
          method: req.method,
          ip: req.ip
        });

        return res.status(500).json({
          error: {
            code: 'AUTHORIZATION_ERROR',
            message: 'Authorization service temporarily unavailable'
          }
        });
      }
    };
  }

  /**
   * Require admin role
   */
  public requireAdmin() {
    return this.requireRoles([UserRole.ADMIN]);
  }

  /**
   * Require moderator or admin role
   */
  public requireModerator() {
    return this.requireRoles([UserRole.MODERATOR, UserRole.ADMIN]);
  }

  /**
   * Require artist, moderator, or admin role
   */
  public requireArtist() {
    return this.requireRoles([UserRole.ARTIST, UserRole.MODERATOR, UserRole.ADMIN]);
  }

  /**
   * Check resource ownership or admin privileges
   */
  public requireOwnershipOrAdmin(ownershipParam: string = 'userId') {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      try {
        if (!req.user) {
          return res.status(401).json({
            error: {
              code: 'AUTHENTICATION_REQUIRED',
              message: 'Authentication is required for this resource'
            }
          });
        }

        const userRole = UserRoleValidator.fromString(req.user.role);
        const isAdmin = UserRoleValidator.canAccess(userRole, UserRole.ADMIN);
        const isModerator = UserRoleValidator.canAccess(userRole, UserRole.MODERATOR);

        // Admin and moderators can access any resource
        if (isAdmin || isModerator) {
          this.logger.debug('Admin/Moderator access granted', {
            userId: req.user.sub,
            userRole: req.user.role,
            path: req.path,
            method: req.method
          });
          return next();
        }

        // Check ownership
        const resourceOwnerId = req.params[ownershipParam] || req.body[ownershipParam];
        if (!resourceOwnerId) {
          this.logger.warn('Resource owner ID not found', {
            userId: req.user.sub,
            ownershipParam,
            path: req.path,
            method: req.method
          });

          return res.status(400).json({
            error: {
              code: 'MISSING_RESOURCE_ID',
              message: 'Resource identifier is required'
            }
          });
        }

        if (req.user.sub !== resourceOwnerId) {
          this.logger.warn('Resource access denied - not owner', {
            userId: req.user.sub,
            resourceOwnerId,
            path: req.path,
            method: req.method,
            ip: req.ip
          });

          return res.status(403).json({
            error: {
              code: 'ACCESS_DENIED',
              message: 'You can only access your own resources'
            }
          });
        }

        this.logger.debug('Resource ownership verified', {
          userId: req.user.sub,
          resourceOwnerId,
          path: req.path,
          method: req.method
        });

        next();
      } catch (error) {
        this.logger.error('Ownership authorization error', error as Error, {
          path: req.path,
          method: req.method,
          ip: req.ip
        });

        return res.status(500).json({
          error: {
            code: 'AUTHORIZATION_ERROR',
            message: 'Authorization service temporarily unavailable'
          }
        });
      }
    };
  }

  /**
   * Flexible authorization with multiple options
   */
  public authorize(options: AuthorizationOptions) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      try {
        if (!req.user) {
          return res.status(401).json({
            error: {
              code: 'AUTHENTICATION_REQUIRED',
              message: 'Authentication is required for this resource'
            }
          });
        }

        const userRole = UserRoleValidator.fromString(req.user.role);
        let authorized = false;

        // Check role-based access
        if (options.roles && options.roles.length > 0) {
          authorized = options.roles.some(role => UserRoleValidator.canAccess(userRole, role));
        }

        // Check ownership if required
        if (options.requireOwnership && options.ownershipParam) {
          const resourceOwnerId = req.params[options.ownershipParam] || req.body[options.ownershipParam];
          const isOwner = req.user.sub === resourceOwnerId;
          
          if (options.allowSelf && isOwner) {
            authorized = true;
          } else if (!authorized) {
            // Only check ownership if role-based access failed
            authorized = isOwner;
          }
        }

        // Allow self-access for user resources
        if (options.allowSelf) {
          const userId = req.params.userId || req.params.id;
          if (userId === req.user.sub) {
            authorized = true;
          }
        }

        if (!authorized) {
          this.logger.warn('Authorization failed', {
            userId: req.user.sub,
            userRole: req.user.role,
            requiredRoles: options.roles,
            requireOwnership: options.requireOwnership,
            path: req.path,
            method: req.method,
            ip: req.ip
          });

          return res.status(403).json({
            error: {
              code: 'ACCESS_DENIED',
              message: 'You do not have permission to access this resource'
            }
          });
        }

        this.logger.debug('Authorization successful', {
          userId: req.user.sub,
          userRole: req.user.role,
          path: req.path,
          method: req.method
        });

        next();
      } catch (error) {
        this.logger.error('Authorization middleware error', error as Error, {
          path: req.path,
          method: req.method,
          ip: req.ip
        });

        return res.status(500).json({
          error: {
            code: 'AUTHORIZATION_ERROR',
            message: 'Authorization service temporarily unavailable'
          }
        });
      }
    };
  }

  /**
   * Check if user has specific permission level
   */
  public static hasPermission(req: AuthenticatedRequest, requiredRole: UserRole): boolean {
    if (!req.user) {
      return false;
    }

    try {
      const userRole = UserRoleValidator.fromString(req.user.role);
      return UserRoleValidator.canAccess(userRole, requiredRole);
    } catch {
      return false;
    }
  }

  /**
   * Check if user is admin
   */
  public static isAdmin(req: AuthenticatedRequest): boolean {
    return this.hasPermission(req, UserRole.ADMIN);
  }

  /**
   * Check if user is moderator or admin
   */
  public static isModerator(req: AuthenticatedRequest): boolean {
    return this.hasPermission(req, UserRole.MODERATOR);
  }

  /**
   * Check if user owns the resource
   */
  public static isOwner(req: AuthenticatedRequest, resourceOwnerId: string): boolean {
    return req.user?.sub === resourceOwnerId;
  }
}