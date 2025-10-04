/**
 * User Routes
 * Real implementation with authentication, validation and rate limiting
 */

import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { AuthenticationMiddleware } from '../../../shared/middleware/AuthenticationMiddleware';
import { ValidationMiddleware } from '../../../shared/middleware/ValidationMiddleware';
import { RateLimitingMiddleware } from '../../../shared/middleware/RateLimitingMiddleware';

export function createUserRoutes(
  userController: UserController,
  authMiddleware: AuthenticationMiddleware,
  rateLimitMiddleware: RateLimitingMiddleware,
  validationMiddleware: ValidationMiddleware
): Router {
  const router = Router();

  // User routes info
  router.get('/', authMiddleware.authenticate, (req, res) => {
    res.json({
      message: 'User management endpoints',
      endpoints: {
        profile: 'GET /profile',
        updateProfile: 'PUT /profile',
        deleteAccount: 'DELETE /profile'
      },
      user: (req as any).user
    });
  });

  // Get user profile
  router.get('/profile', 
    authMiddleware.authenticate,
    rateLimitMiddleware.apiRateLimit(),
    userController.getProfile
  );

  // Update user profile
  router.put('/profile', 
    authMiddleware.authenticate,
    rateLimitMiddleware.apiRateLimit(),
    validationMiddleware.validate(ValidationMiddleware.updateProfileSchema),
    userController.updateProfile
  );

  // Delete user account
  router.delete('/profile', 
    authMiddleware.authenticate,
    rateLimitMiddleware.apiRateLimit(),
    validationMiddleware.validate(ValidationMiddleware.deleteProfileSchema),
    userController.deleteProfile
  );

  return router;
}