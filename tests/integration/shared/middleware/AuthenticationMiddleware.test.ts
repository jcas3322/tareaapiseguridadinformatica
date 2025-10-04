/**
 * AuthenticationMiddleware Integration Tests
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticationMiddleware, AuthenticatedRequest } from '../../../../src/shared/middleware/AuthenticationMiddleware';
import { JwtService, JwtPayload } from '../../../../src/application/ports/JwtService';
import { Logger } from '../../../../src/application/ports/Logger';

// Mock implementations
class MockJwtService implements JwtService {
  private validToken = 'valid.jwt.token';
  private expiredToken = 'expired.jwt.token';
  private revokedToken = 'revoked.jwt.token';
  private revokedTokens = new Set<string>();

  async generateTokens(): Promise<any> { throw new Error('Not implemented'); }
  async generateAccessToken(): Promise<string> { throw new Error('Not implemented'); }
  async generateRefreshToken(): Promise<string> { throw new Error('Not implemented'); }
  
  async verifyToken(token: string): Promise<JwtPayload> {
    return this.verifyAccessToken(token);
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    if (token === this.expiredToken) {
      throw new Error('Token has expired');
    }
    
    if (token === this.revokedToken || this.revokedTokens.has(token)) {
      throw new Error('Token has been revoked');
    }
    
    if (token !== this.validToken) {
      throw new Error('Invalid token');
    }

    return {
      sub: 'user-123',
      email: 'test@example.com',
      username: 'testuser',
      role: 'user',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      iss: 'test-issuer',
      aud: 'test-audience',
      type: 'access'
    };
  }

  async verifyRefreshToken(): Promise<JwtPayload> { throw new Error('Not implemented'); }
  async refreshAccessToken(): Promise<string> { throw new Error('Not implemented'); }
  decodeToken(): JwtPayload | null { throw new Error('Not implemented'); }
  getTokenExpiration(): Date | null { throw new Error('Not implemented'); }
  isTokenExpired(): boolean { throw new Error('Not implemented'); }
  
  async revokeToken(token: string): Promise<void> {
    this.revokedTokens.add(token);
  }
  
  async isTokenRevoked(token: string): Promise<boolean> {
    return this.revokedTokens.has(token);
  }

  // Test helper methods
  setValidToken(token: string) {
    this.validToken = token;
  }

  setExpiredToken(token: string) {
    this.expiredToken = token;
  }

  setRevokedToken(token: string) {
    this.revokedToken = token;
  }
}

class MockLogger implements Logger {
  public logs: Array<{ level: string; message: string; context?: any }> = [];

  error(message: string, error?: Error, context?: any): void {
    this.logs.push({ level: 'error', message, context: { error, ...context } });
  }

  warn(message: string, context?: any): void {
    this.logs.push({ level: 'warn', message, context });
  }

  info(message: string, context?: any): void {
    this.logs.push({ level: 'info', message, context });
  }

  debug(message: string, context?: any): void {
    this.logs.push({ level: 'debug', message, context });
  }

  log(): void { throw new Error('Not implemented'); }
  child(): Logger { throw new Error('Not implemented'); }
  security(event: string, context: any): void {
    this.logs.push({ level: 'security', message: event, context });
  }
  audit(): void { throw new Error('Not implemented'); }
  performance(): void { throw new Error('Not implemented'); }

  // Test helper
  clear() {
    this.logs = [];
  }

  getLastLog() {
    return this.logs[this.logs.length - 1];
  }
}

describe('AuthenticationMiddleware Integration Tests', () => {
  let authMiddleware: AuthenticationMiddleware;
  let mockJwtService: MockJwtService;
  let mockLogger: MockLogger;
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockJwtService = new MockJwtService();
    mockLogger = new MockLogger();
    authMiddleware = new AuthenticationMiddleware(mockJwtService, mockLogger);

    mockRequest = {
      headers: {},
      path: '/api/test',
      method: 'GET',
      ip: '127.0.0.1',
      get: jest.fn((header: string) => {
        if (header === 'User-Agent') return 'test-agent';
        return undefined;
      })
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();
  });

  describe('authenticate', () => {
    it('should authenticate valid token successfully', async () => {
      mockRequest.headers!.authorization = 'Bearer valid.jwt.token';

      const middleware = authMiddleware.authenticate();
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user!.sub).toBe('user-123');
      expect(mockRequest.token).toBe('valid.jwt.token');
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject request without authorization header', async () => {
      const middleware = authMiddleware.authenticate();
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authorization header is required'
        }
      });
    });

    it('should reject invalid authorization header format', async () => {
      mockRequest.headers!.authorization = 'Invalid format';

      const middleware = authMiddleware.authenticate();
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INVALID_TOKEN_FORMAT',
          message: 'Authorization header must be in format: Bearer <token>'
        }
      });
    });

    it('should reject expired token', async () => {
      mockRequest.headers!.authorization = 'Bearer expired.jwt.token';

      const middleware = authMiddleware.authenticate();
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Invalid or expired token'
        }
      });
    });

    it('should reject revoked token', async () => {
      mockRequest.headers!.authorization = 'Bearer revoked.jwt.token';

      const middleware = authMiddleware.authenticate();
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'TOKEN_REVOKED',
          message: 'Invalid or expired token'
        }
      });
    });

    it('should skip authentication for optional middleware without token', async () => {
      const middleware = authMiddleware.authenticate({ optional: true });
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should skip authentication for specified paths', async () => {
      mockRequest.path = '/api/public';
      const middleware = authMiddleware.authenticate({ skipPaths: ['/api/public'] });
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should require verified users when configured', async () => {
      // Mock JWT service to return unverified user
      const unverifiedPayload: JwtPayload = {
        sub: 'user-123',
        email: '', // Empty email indicates unverified
        username: 'testuser',
        role: 'user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'test-issuer',
        aud: 'test-audience',
        type: 'access'
      };

      mockJwtService.verifyAccessToken = jest.fn().mockResolvedValue(unverifiedPayload);
      mockRequest.headers!.authorization = 'Bearer valid.jwt.token';

      const middleware = authMiddleware.authenticate({ requireVerified: true });
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Email verification is required to access this resource'
        }
      });
    });

    it('should log authentication attempts', async () => {
      mockRequest.headers!.authorization = 'Bearer valid.jwt.token';

      const middleware = authMiddleware.authenticate();
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      const debugLog = mockLogger.logs.find(log => log.level === 'debug');
      expect(debugLog).toBeDefined();
      expect(debugLog!.message).toBe('User authenticated successfully');
      expect(debugLog!.context.userId).toBe('user-123');
    });

    it('should log failed authentication attempts', async () => {
      const middleware = authMiddleware.authenticate();
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      const warnLog = mockLogger.logs.find(log => log.level === 'warn');
      expect(warnLog).toBeDefined();
      expect(warnLog!.message).toBe('Missing authorization header');
    });

    it('should handle JWT service errors gracefully', async () => {
      mockJwtService.verifyAccessToken = jest.fn().mockRejectedValue(new Error('Service unavailable'));
      mockRequest.headers!.authorization = 'Bearer valid.jwt.token';

      const middleware = authMiddleware.authenticate();
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication service temporarily unavailable'
        }
      });
    });
  });

  describe('convenience methods', () => {
    it('should create requireAuth middleware', async () => {
      const middleware = authMiddleware.requireAuth();
      
      // Should reject without token
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should create optionalAuth middleware', async () => {
      const middleware = authMiddleware.optionalAuth();
      
      // Should pass without token
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should create requireVerified middleware', async () => {
      const middleware = authMiddleware.requireVerified();
      
      // Should reject without token
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });
  });

  describe('static helper methods', () => {
    beforeEach(() => {
      mockRequest.user = {
        sub: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'admin',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'test-issuer',
        aud: 'test-audience',
        type: 'access'
      };
    });

    it('should extract user ID', () => {
      const userId = AuthenticationMiddleware.getUserId(mockRequest as AuthenticatedRequest);
      expect(userId).toBe('user-123');
    });

    it('should extract user role', () => {
      const userRole = AuthenticationMiddleware.getUserRole(mockRequest as AuthenticatedRequest);
      expect(userRole).toBe('admin');
    });

    it('should check if user is authenticated', () => {
      const isAuthenticated = AuthenticationMiddleware.isAuthenticated(mockRequest as AuthenticatedRequest);
      expect(isAuthenticated).toBe(true);
    });

    it('should get full user payload', () => {
      const user = AuthenticationMiddleware.getUser(mockRequest as AuthenticatedRequest);
      expect(user).toBeDefined();
      expect(user!.sub).toBe('user-123');
      expect(user!.role).toBe('admin');
    });

    it('should return null for unauthenticated request', () => {
      delete mockRequest.user;
      
      const userId = AuthenticationMiddleware.getUserId(mockRequest as AuthenticatedRequest);
      const userRole = AuthenticationMiddleware.getUserRole(mockRequest as AuthenticatedRequest);
      const isAuthenticated = AuthenticationMiddleware.isAuthenticated(mockRequest as AuthenticatedRequest);
      const user = AuthenticationMiddleware.getUser(mockRequest as AuthenticatedRequest);
      
      expect(userId).toBeNull();
      expect(userRole).toBeNull();
      expect(isAuthenticated).toBe(false);
      expect(user).toBeNull();
    });
  });

  describe('security logging', () => {
    it('should log security events for suspicious activity', async () => {
      mockRequest.headers!.authorization = 'Bearer invalid.token';
      mockRequest.ip = '192.168.1.100';

      const middleware = authMiddleware.authenticate();
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      const warnLog = mockLogger.logs.find(log => log.level === 'warn' && log.message === 'JWT verification failed');
      expect(warnLog).toBeDefined();
      expect(warnLog!.context.ip).toBe('192.168.1.100');
      expect(warnLog!.context.userAgent).toBe('test-agent');
    });

    it('should include request context in logs', async () => {
      mockRequest.path = '/api/sensitive';
      mockRequest.method = 'POST';

      const middleware = authMiddleware.authenticate();
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      const warnLog = mockLogger.getLastLog();
      expect(warnLog.context.path).toBe('/api/sensitive');
      expect(warnLog.context.method).toBe('POST');
    });
  });
});