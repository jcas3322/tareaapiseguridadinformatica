/**
 * AuthController E2E Tests
 * End-to-end tests for authentication endpoints
 */

import request from 'supertest';
import { Express } from 'express';
import { AuthController } from '../../../src/infrastructure/web/controllers/AuthController';
import { RegisterUserUseCase } from '../../../src/application/use-cases/auth/RegisterUserUseCase';
import { LoginUseCase } from '../../../src/application/use-cases/auth/LoginUseCase';
import { RefreshTokenUseCase } from '../../../src/application/use-cases/auth/RefreshTokenUseCase';
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

class MockRegisterUserUseCase implements RegisterUserUseCase {
  async execute(command: any): Promise<User> {
    if (command.email === 'existing@example.com') {
      throw new Error('User with this email is already registered');
    }
    if (command.password !== command.confirmPassword) {
      throw new Error('Passwords must match');
    }
    if (!command.acceptTerms || !command.acceptPrivacyPolicy) {
      throw new Error('You must accept the terms of service and privacy policy');
    }

    return new User(
      new UserId('123e4567-e89b-12d3-a456-426614174000'),
      new Email(command.email),
      command.username,
      'hashedPassword',
      'user',
      true,
      new UserProfile(
        command.displayName || command.username,
        command.firstName,
        command.lastName,
        undefined,
        undefined,
        undefined,
        undefined,
        true
      ),
      new Date(),
      new Date()
    );
  }
}

class MockLoginUseCase implements LoginUseCase {
  async execute(command: any): Promise<any> {
    if (command.emailOrUsername === 'invalid@example.com' || command.password === 'wrongpassword') {
      throw new Error('Invalid credentials');
    }
    if (command.emailOrUsername === 'blocked@example.com') {
      throw new Error('Too many failed login attempts. Please try again later.');
    }

    return {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      refreshExpiresIn: 86400,
      user: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: command.emailOrUsername,
        username: 'testuser',
        role: 'user',
        isVerified: true,
        profile: {
          displayName: 'Test User',
          isPublic: true
        }
      }
    };
  }
}

class MockRefreshTokenUseCase implements RefreshTokenUseCase {
  async execute(command: any): Promise<any> {
    if (command.refreshToken === 'invalid-token') {
      throw new Error('Invalid refresh token');
    }
    if (command.refreshToken === 'expired-token') {
      throw new Error('Refresh token has expired');
    }
    if (command.refreshToken === 'revoked-token') {
      throw new Error('Refresh token has been revoked');
    }

    return {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      refreshExpiresIn: 86400,
      user: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user',
        isVerified: true,
        profile: {
          displayName: 'Test User',
          isPublic: true
        }
      }
    };
  }
}

// Test setup
function createTestApp(): Express {
  const express = require('express');
  const app = express();
  
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Create controller with mocks
  const authController = new AuthController(
    new MockRegisterUserUseCase(),
    new MockLoginUseCase(),
    new MockRefreshTokenUseCase(),
    new MockLogger()
  );

  // Setup routes
  app.post('/api/auth/register', authController.register);
  app.post('/api/auth/login', authController.login);
  app.post('/api/auth/refresh', authController.refresh);
  app.post('/api/auth/logout', authController.logout);
  app.get('/api/auth/me', authController.me);
  app.get('/api/auth/health', authController.health);

  return app;
}

describe('AuthController E2E Tests', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        username: 'newuser',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        acceptTerms: true,
        acceptPrivacyPolicy: true
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            id: expect.any(String),
            email: userData.email,
            username: userData.username,
            role: 'user',
            isVerified: true,
            profile: {
              displayName: userData.username,
              isPublic: true
            },
            createdAt: expect.any(String)
          }
        }
      });
    });

    it('should return 409 for existing email', async () => {
      const userData = {
        email: 'existing@example.com',
        username: 'testuser',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        acceptTerms: true,
        acceptPrivacyPolicy: true
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'User with this email is already registered'
        }
      });
    });

    it('should return 400 for password mismatch', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'SecurePass123!',
        confirmPassword: 'DifferentPass123!',
        acceptTerms: true,
        acceptPrivacyPolicy: true
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Passwords must match'
        }
      });
    });

    it('should return 400 for missing terms acceptance', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        acceptTerms: false,
        acceptPrivacyPolicy: true
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'TERMS_NOT_ACCEPTED',
          message: 'You must accept the terms of service and privacy policy'
        }
      });
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const loginData = {
        emailOrUsername: 'test@example.com',
        password: 'correctpassword',
        rememberMe: false
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Login successful',
        data: {
          accessToken: 'mock-access-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          user: {
            id: expect.any(String),
            email: loginData.emailOrUsername,
            username: 'testuser',
            role: 'user',
            isVerified: true,
            profile: {
              displayName: 'Test User',
              isPublic: true
            }
          }
        }
      });
    });

    it('should set refresh token cookie when rememberMe is true', async () => {
      const loginData = {
        emailOrUsername: 'test@example.com',
        password: 'correctpassword',
        rememberMe: true
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.headers['set-cookie']).toBeDefined();
      const cookieHeader = response.headers['set-cookie'][0];
      expect(cookieHeader).toContain('refreshToken=mock-refresh-token');
      expect(cookieHeader).toContain('HttpOnly');
      expect(cookieHeader).toContain('Path=/api/auth/refresh');
    });

    it('should return 401 for invalid credentials', async () => {
      const loginData = {
        emailOrUsername: 'invalid@example.com',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid credentials'
        }
      });
    });

    it('should return 429 for rate limited user', async () => {
      const loginData = {
        emailOrUsername: 'blocked@example.com',
        password: 'anypassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(429);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many failed login attempts. Please try again later.'
        }
      });
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh token successfully with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: 'new-access-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          user: {
            id: expect.any(String),
            email: 'test@example.com',
            username: 'testuser',
            role: 'user',
            isVerified: true
          }
        }
      });
    });

    it('should refresh token from cookie', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'refreshToken=valid-refresh-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'MISSING_REFRESH_TOKEN',
          message: 'Refresh token is required'
        }
      });
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid refresh token'
        }
      });
    });

    it('should return 401 for expired refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'expired-token' })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Refresh token has expired'
        }
      });
    });

    it('should return 401 for revoked refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'revoked-token' })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'TOKEN_REVOKED',
          message: 'Refresh token has been revoked'
        }
      });
    });

    it('should clear refresh token cookie on error', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'refreshToken=invalid-token')
        .expect(401);

      expect(response.headers['set-cookie']).toBeDefined();
      const cookieHeader = response.headers['set-cookie'][0];
      expect(cookieHeader).toContain('refreshToken=;');
      expect(cookieHeader).toContain('Path=/api/auth/refresh');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Logout successful'
      });
    });

    it('should clear refresh token cookie on logout', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', 'refreshToken=some-token')
        .expect(200);

      expect(response.headers['set-cookie']).toBeDefined();
      const cookieHeader = response.headers['set-cookie'][0];
      expect(cookieHeader).toContain('refreshToken=;');
      expect(cookieHeader).toContain('Path=/api/auth/refresh');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    });

    // Note: Testing authenticated requests would require setting up proper JWT middleware
    // This is a simplified test that shows the structure
  });

  describe('GET /api/auth/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/auth/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Authentication service is healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number)
      });
    });
  });

  describe('Security Tests', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      // Express should handle malformed JSON and return 400
    });

    it('should reject requests with suspicious payloads', async () => {
      const maliciousPayload = {
        email: 'test@example.com',
        username: '<script>alert("xss")</script>',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        acceptTerms: true,
        acceptPrivacyPolicy: true
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(maliciousPayload);

      // Should be handled by validation middleware
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle very large payloads', async () => {
      const largePayload = {
        email: 'test@example.com',
        username: 'a'.repeat(10000), // Very long username
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        acceptTerms: true,
        acceptPrivacyPolicy: true
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(largePayload);

      // Should be rejected by validation
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Performance Tests', () => {
    it('should respond to health check quickly', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/auth/health')
        .expect(200);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should respond within 100ms
    });

    it('should handle concurrent login requests', async () => {
      const loginData = {
        emailOrUsername: 'test@example.com',
        password: 'correctpassword'
      };

      const promises = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send(loginData)
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });
});