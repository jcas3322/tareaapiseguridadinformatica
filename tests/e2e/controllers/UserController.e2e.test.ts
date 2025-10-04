/**
 * UserController E2E Tests
 * End-to-end tests for user management endpoints
 */

import request from 'supertest';
import { Express } from 'express';
import { UserController } from '../../../src/infrastructure/web/controllers/UserController';
import { GetUserProfileUseCase } from '../../../src/application/use-cases/user/GetUserProfileUseCase';
import { UpdateUserProfileUseCase } from '../../../src/application/use-cases/user/UpdateUserProfileUseCase';
import { Logger } from '../../../src/application/ports/Logger';
import { User } from '../../../src/domain/entities/User';
import { UserProfile } from '../../../src/domain/value-objects/UserProfile';
import { Email } from '../../../src/domain/value-objects/Email';
import { UserId } from '../../../src/domain/value-objects/UserId';

// Mock implementations
class MockLogger implements Logger {
  info(message: string, context?: any): void {}
  error(message: string, error: Error, context?: any): void {}
  warn(message: string, context?: any): void {}
  debug(message: string, context?: any): void {}
  performance(operation: string, duration: number, context?: any): void {}
  audit(event: string, context?: any): void {}
}

class MockGetUserProfileUseCase implements GetUserProfileUseCase {
  async execute(command: any): Promise<any> {
    if (command.userId === 'non-existent-id') {
      throw new Error('User not found');
    }
    if (command.userId === 'private-user-id' && command.requesterId !== 'private-user-id') {
      throw new Error('Access denied. This profile is private.');
    }

    const isOwnProfile = command.userId === command.requesterId;
    const includePrivateData = command.includePrivateData && isOwnProfile;

    const baseProfile = {
      id: command.userId,
      email: includePrivateData ? 'user@example.com' : undefined,
      username: 'testuser',
      role: 'user',
      isVerified: true,
      profile: {
        displayName: 'Test User',
        firstName: includePrivateData ? 'John' : undefined,
        lastName: includePrivateData ? 'Doe' : undefined,
        bio: 'Test bio',
        avatarUrl: 'https://example.com/avatar.jpg',
        country: includePrivateData ? 'US' : undefined,
        dateOfBirth: includePrivateData ? '1990-01-01' : undefined,
        isPublic: true
      },
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z'
    };

    return baseProfile;
  }
}

class MockUpdateUserProfileUseCase implements UpdateUserProfileUseCase {
  async execute(command: any): Promise<any> {
    if (command.userId === 'non-existent-id') {
      throw new Error('User not found');
    }
    if (command.userId !== command.requesterId) {
      throw new Error('You can only update your own profile');
    }

    return {
      id: command.userId,
      email: 'user@example.com',
      username: 'testuser',
      role: 'user',
      isVerified: true,
      profile: {
        displayName: command.profileUpdates.displayName || 'Test User',
        firstName: command.profileUpdates.firstName || 'John',
        lastName: command.profileUpdates.lastName || 'Doe',
        bio: command.profileUpdates.bio || 'Updated bio',
        avatarUrl: command.profileUpdates.avatarUrl || 'https://example.com/avatar.jpg',
        country: command.profileUpdates.country || 'US',
        dateOfBirth: command.profileUpdates.dateOfBirth || '1990-01-01',
        isPublic: command.profileUpdates.isPublic !== undefined ? command.profileUpdates.isPublic : true
      },
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: new Date().toISOString()
    };
  }
}

// Mock authentication middleware
function mockAuthMiddleware(userId?: string, role: string = 'user') {
  return (req: any, res: any, next: any) => {
    if (userId) {
      req.user = {
        sub: userId,
        email: 'user@example.com',
        username: 'testuser',
        role: role
      };
    }
    next();
  };
}

// Test setup
function createTestApp(): Express {
  const express = require('express');
  const app = express();
  
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Create controller with mocks
  const userController = new UserController(
    new MockGetUserProfileUseCase(),
    new MockUpdateUserProfileUseCase(),
    new MockLogger()
  );

  // Setup routes with different auth scenarios
  app.get('/api/users/me', mockAuthMiddleware('user-123'), userController.getMyProfile);
  app.put('/api/users/me', mockAuthMiddleware('user-123'), userController.updateMyProfile);
  app.get('/api/users/search', mockAuthMiddleware('user-123'), userController.searchUsers);
  app.get('/api/users/:userId', mockAuthMiddleware('user-123'), userController.getProfile);
  app.put('/api/users/:userId', mockAuthMiddleware('user-123'), userController.updateProfile);
  app.delete('/api/users/:userId', mockAuthMiddleware('user-123'), userController.deleteAccount);

  // Unauthenticated routes for testing
  app.get('/api/users/me/unauth', mockAuthMiddleware(), userController.getMyProfile);
  app.get('/api/users/:userId/unauth', mockAuthMiddleware(), userController.getProfile);

  return app;
}

describe('UserController E2E Tests', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('GET /api/users/me', () => {
    it('should get current user profile successfully', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            id: 'user-123',
            email: 'user@example.com',
            username: 'testuser',
            role: 'user',
            isVerified: true,
            profile: {
              displayName: 'Test User',
              firstName: 'John',
              lastName: 'Doe',
              bio: 'Test bio',
              avatarUrl: 'https://example.com/avatar.jpg',
              country: 'US',
              dateOfBirth: '1990-01-01',
              isPublic: true
            },
            createdAt: expect.any(String),
            updatedAt: expect.any(String)
          }
        }
      });
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/users/me/unauth')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    });
  });

  describe('PUT /api/users/me', () => {
    it('should update current user profile successfully', async () => {
      const updateData = {
        displayName: 'Updated Name',
        bio: 'Updated bio',
        isPublic: false
      };

      const response = await request(app)
        .put('/api/users/me')
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: {
            id: 'user-123',
            profile: {
              displayName: 'Updated Name',
              bio: 'Updated bio',
              isPublic: false
            },
            updatedAt: expect.any(String)
          }
        }
      });
    });
  });

  describe('GET /api/users/:userId', () => {
    it('should get user profile by ID successfully', async () => {
      const response = await request(app)
        .get('/api/users/user-123')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            id: 'user-123',
            username: 'testuser',
            role: 'user',
            isVerified: true,
            profile: {
              displayName: 'Test User',
              bio: 'Test bio',
              avatarUrl: 'https://example.com/avatar.jpg',
              isPublic: true
            }
          }
        }
      });
    });

    it('should get own profile with private data when includePrivate=true', async () => {
      const response = await request(app)
        .get('/api/users/user-123?includePrivate=true')
        .expect(200);

      expect(response.body.data.user.email).toBe('user@example.com');
      expect(response.body.data.user.profile.firstName).toBe('John');
      expect(response.body.data.user.profile.lastName).toBe('Doe');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/api/users/non-existent-id')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'GET_PROFILE_FAILED',
          message: 'User not found'
        }
      });
    });

    it('should return 403 for private profile access', async () => {
      const response = await request(app)
        .get('/api/users/private-user-id')
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'GET_PROFILE_FAILED',
          message: 'Access denied. This profile is private.'
        }
      });
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/users/user-123/unauth')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    });
  });

  describe('PUT /api/users/:userId', () => {
    it('should update own profile successfully', async () => {
      const updateData = {
        displayName: 'New Display Name',
        bio: 'New bio content',
        country: 'CA'
      };

      const response = await request(app)
        .put('/api/users/user-123')
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: {
            id: 'user-123',
            profile: {
              displayName: 'New Display Name',
              bio: 'New bio content',
              country: 'CA'
            },
            updatedAt: expect.any(String)
          }
        }
      });
    });

    it('should return 403 when trying to update another user profile', async () => {
      const updateData = {
        displayName: 'Hacker Name'
      };

      const response = await request(app)
        .put('/api/users/other-user-id')
        .send(updateData)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'UPDATE_PROFILE_FAILED',
          message: 'You can only update your own profile'
        }
      });
    });

    it('should return 404 for non-existent user', async () => {
      const updateData = {
        displayName: 'New Name'
      };

      const response = await request(app)
        .put('/api/users/non-existent-id')
        .send(updateData)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'UPDATE_PROFILE_FAILED',
          message: 'User not found'
        }
      });
    });
  });

  describe('DELETE /api/users/:userId', () => {
    it('should delete own account successfully', async () => {
      const response = await request(app)
        .delete('/api/users/user-123')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Account deleted successfully'
      });
    });

    it('should return 403 when trying to delete another user account', async () => {
      const response = await request(app)
        .delete('/api/users/other-user-id')
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You can only delete your own account'
        }
      });
    });
  });

  describe('GET /api/users/search', () => {
    it('should search users successfully', async () => {
      const response = await request(app)
        .get('/api/users/search?q=test')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          users: [],
          pagination: {
            page: 1,
            pageSize: 20,
            totalCount: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false
          }
        }
      });
    });

    it('should return 400 for missing search term', async () => {
      const response = await request(app)
        .get('/api/users/search')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'MISSING_SEARCH_TERM',
          message: 'Search term is required'
        }
      });
    });

    it('should return 400 for search term too short', async () => {
      const response = await request(app)
        .get('/api/users/search?q=a')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'SEARCH_TERM_TOO_SHORT',
          message: 'Search term must be at least 2 characters'
        }
      });
    });

    it('should handle pagination parameters', async () => {
      const response = await request(app)
        .get('/api/users/search?q=test&page=2&pageSize=10')
        .expect(200);

      expect(response.body.data.pagination.page).toBe(2);
      expect(response.body.data.pagination.pageSize).toBe(10);
    });
  });

  describe('Security Tests', () => {
    it('should sanitize malicious input in profile updates', async () => {
      const maliciousData = {
        displayName: '<script>alert("xss")</script>',
        bio: 'javascript:alert("xss")',
        avatarUrl: 'javascript:void(0)'
      };

      const response = await request(app)
        .put('/api/users/user-123')
        .send(maliciousData);

      // Should be handled by validation middleware
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject extremely long input values', async () => {
      const longData = {
        displayName: 'a'.repeat(1000),
        bio: 'b'.repeat(10000)
      };

      const response = await request(app)
        .put('/api/users/user-123')
        .send(longData);

      // Should be rejected by validation
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle SQL injection attempts in search', async () => {
      const sqlInjection = "'; DROP TABLE users; --";
      
      const response = await request(app)
        .get(`/api/users/search?q=${encodeURIComponent(sqlInjection)}`);

      // Should not cause server error
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('Performance Tests', () => {
    it('should handle profile retrieval quickly', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/users/user-123')
        .expect(200);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(200); // Should respond within 200ms
    });

    it('should handle concurrent profile updates', async () => {
      const updateData = {
        bio: 'Concurrent update test'
      };

      const promises = Array(5).fill(null).map(() =>
        request(app)
          .put('/api/users/user-123')
          .send(updateData)
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty profile update gracefully', async () => {
      const response = await request(app)
        .put('/api/users/user-123')
        .send({})
        .expect(400);

      // Should require at least one field to update
    });

    it('should handle invalid date format in dateOfBirth', async () => {
      const invalidData = {
        dateOfBirth: 'invalid-date'
      };

      const response = await request(app)
        .put('/api/users/user-123')
        .send(invalidData);

      // Should be handled by validation
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle invalid country code', async () => {
      const invalidData = {
        country: 'INVALID'
      };

      const response = await request(app)
        .put('/api/users/user-123')
        .send(invalidData);

      // Should be handled by validation
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});