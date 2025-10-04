/**
 * Authentication Routes
 * Real implementation with validation and rate limiting
 */

import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { AuthenticationMiddleware } from '../../../shared/middleware/AuthenticationMiddleware';
import { ValidationMiddleware } from '../../../shared/middleware/ValidationMiddleware';
import { RateLimitingMiddleware } from '../../../shared/middleware/RateLimitingMiddleware';

export function createAuthRoutes(
  authController: AuthController,
  authMiddleware: AuthenticationMiddleware,
  rateLimitMiddleware: RateLimitingMiddleware,
  validationMiddleware: ValidationMiddleware
): Router {
  const router = Router();

  // Auth routes info
  router.get('/', (req, res) => {
    res.json({
      message: 'Authentication endpoints',
      endpoints: {
        register: 'POST /register',
        login: 'POST /login',
        logout: 'POST /logout',
        refresh: 'POST /refresh'
      },
      documentation: '/api/docs'
    });
  });

  // Register user
  router.post(
    '/register',
    rateLimitMiddleware.authRateLimit(),
    validationMiddleware.validate(ValidationMiddleware.registerSchema),
    authController.register
  );

  // Login user
  router.post(
    '/login',
    rateLimitMiddleware.authRateLimit(),
    validationMiddleware.validate(ValidationMiddleware.loginSchema),
    authController.login
  );

  // Logout user
  router.post('/logout', authMiddleware.authenticate, authController.logout);

  // Refresh token
  router.post(
    '/refresh',
    rateLimitMiddleware.authRateLimit(),
    validationMiddleware.validate(ValidationMiddleware.refreshSchema),
    authController.refresh
  );

  return router;
}
