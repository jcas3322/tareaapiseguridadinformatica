/**
 * JoseJwtService Integration Tests
 */

import { JoseJwtService, JwtConfig } from '../../../../src/infrastructure/security/JoseJwtService';
import { JwtPayload } from '../../../../src/application/ports/JwtService';

describe('JoseJwtService Integration Tests', () => {
  let jwtService: JoseJwtService;
  let config: JwtConfig;

  beforeEach(() => {
    config = {
      accessTokenSecret: 'test-access-secret-key-minimum-32-chars-long',
      refreshTokenSecret: 'test-refresh-secret-key-minimum-32-chars-long-different',
      accessTokenExpiresIn: '15m',
      refreshTokenExpiresIn: '7d',
      issuer: 'test-issuer',
      audience: 'test-audience',
      algorithm: 'HS256'
    };
    
    jwtService = new JoseJwtService(config);
  });

  describe('generateTokens', () => {
    it('should generate both access and refresh tokens', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user'
      };

      const tokens = await jwtService.generateTokens(payload);

      expect(tokens).toBeDefined();
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.accessExpiresIn).toBe(15 * 60); // 15 minutes in seconds
      expect(tokens.refreshExpiresIn).toBe(7 * 24 * 60 * 60); // 7 days in seconds
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');
    });

    it('should generate different tokens each time', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user'
      };

      const [tokens1, tokens2] = await Promise.all([
        jwtService.generateTokens(payload),
        jwtService.generateTokens(payload)
      ]);

      expect(tokens1.accessToken).not.toBe(tokens2.accessToken);
      expect(tokens1.refreshToken).not.toBe(tokens2.refreshToken);
    });
  });

  describe('generateAccessToken', () => {
    it('should generate valid access token', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user'
      };

      const token = await jwtService.generateAccessToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
    });

    it('should include all required claims', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user'
      };

      const token = await jwtService.generateAccessToken(payload);
      const decoded = jwtService.decodeToken(token);

      expect(decoded).toBeDefined();
      expect(decoded!.sub).toBe(payload.sub);
      expect(decoded!.email).toBe(payload.email);
      expect(decoded!.username).toBe(payload.username);
      expect(decoded!.role).toBe(payload.role);
      expect(decoded!.type).toBe('access');
      expect(decoded!.iss).toBe(config.issuer);
      expect(decoded!.aud).toBe(config.audience);
      expect(decoded!.iat).toBeDefined();
      expect(decoded!.exp).toBeDefined();
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate valid refresh token', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user'
      };

      const token = await jwtService.generateRefreshToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should mark token as refresh type', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user'
      };

      const token = await jwtService.generateRefreshToken(payload);
      const decoded = jwtService.decodeToken(token);

      expect(decoded!.type).toBe('refresh');
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user'
      };

      const token = await jwtService.generateAccessToken(payload);
      const verified = await jwtService.verifyAccessToken(token);

      expect(verified).toBeDefined();
      expect(verified.sub).toBe(payload.sub);
      expect(verified.email).toBe(payload.email);
      expect(verified.username).toBe(payload.username);
      expect(verified.role).toBe(payload.role);
      expect(verified.type).toBe('access');
    });

    it('should reject refresh token', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user'
      };

      const refreshToken = await jwtService.generateRefreshToken(payload);

      await expect(jwtService.verifyAccessToken(refreshToken))
        .rejects.toThrow('Token is not an access token');
    });

    it('should reject invalid token', async () => {
      const invalidToken = 'invalid.token.here';

      await expect(jwtService.verifyAccessToken(invalidToken))
        .rejects.toThrow('Invalid or expired access token');
    });

    it('should reject revoked token', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user'
      };

      const token = await jwtService.generateAccessToken(payload);
      await jwtService.revokeToken(token);

      await expect(jwtService.verifyAccessToken(token))
        .rejects.toThrow('Access token has been revoked');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user'
      };

      const token = await jwtService.generateRefreshToken(payload);
      const verified = await jwtService.verifyRefreshToken(token);

      expect(verified).toBeDefined();
      expect(verified.sub).toBe(payload.sub);
      expect(verified.type).toBe('refresh');
    });

    it('should reject access token', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user'
      };

      const accessToken = await jwtService.generateAccessToken(payload);

      await expect(jwtService.verifyRefreshToken(accessToken))
        .rejects.toThrow('Token is not a refresh token');
    });
  });

  describe('refreshAccessToken', () => {
    it('should generate new access token from refresh token', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user'
      };

      const refreshToken = await jwtService.generateRefreshToken(payload);
      const newAccessToken = await jwtService.refreshAccessToken(refreshToken);

      expect(newAccessToken).toBeDefined();
      expect(typeof newAccessToken).toBe('string');

      const verified = await jwtService.verifyAccessToken(newAccessToken);
      expect(verified.sub).toBe(payload.sub);
      expect(verified.type).toBe('access');
    });

    it('should reject invalid refresh token', async () => {
      const invalidToken = 'invalid.refresh.token';

      await expect(jwtService.refreshAccessToken(invalidToken))
        .rejects.toThrow('Invalid or expired refresh token');
    });
  });

  describe('decodeToken', () => {
    it('should decode token without verification', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user'
      };

      const token = await jwtService.generateAccessToken(payload);
      const decoded = jwtService.decodeToken(token);

      expect(decoded).toBeDefined();
      expect(decoded!.sub).toBe(payload.sub);
      expect(decoded!.email).toBe(payload.email);
    });

    it('should return null for invalid token', () => {
      const invalidToken = 'invalid.token.format';
      const decoded = jwtService.decodeToken(invalidToken);

      expect(decoded).toBeNull();
    });
  });

  describe('getTokenExpiration', () => {
    it('should return expiration date', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user'
      };

      const token = await jwtService.generateAccessToken(payload);
      const expiration = jwtService.getTokenExpiration(token);

      expect(expiration).toBeDefined();
      expect(expiration).toBeInstanceOf(Date);
      expect(expiration!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return null for invalid token', () => {
      const invalidToken = 'invalid.token.format';
      const expiration = jwtService.getTokenExpiration(invalidToken);

      expect(expiration).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid token', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user'
      };

      const token = await jwtService.generateAccessToken(payload);
      const isExpired = jwtService.isTokenExpired(token);

      expect(isExpired).toBe(false);
    });

    it('should return true for invalid token', () => {
      const invalidToken = 'invalid.token.format';
      const isExpired = jwtService.isTokenExpired(invalidToken);

      expect(isExpired).toBe(true);
    });
  });

  describe('revokeToken and isTokenRevoked', () => {
    it('should revoke and detect revoked token', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user'
      };

      const token = await jwtService.generateAccessToken(payload);
      
      // Initially not revoked
      expect(await jwtService.isTokenRevoked(token)).toBe(false);
      
      // Revoke token
      await jwtService.revokeToken(token);
      
      // Now should be revoked
      expect(await jwtService.isTokenRevoked(token)).toBe(true);
    });

    it('should return true for invalid token', async () => {
      const invalidToken = 'invalid.token.format';
      const isRevoked = await jwtService.isTokenRevoked(invalidToken);

      expect(isRevoked).toBe(true);
    });
  });

  describe('getTokenStats', () => {
    it('should return token statistics', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user'
      };

      const token = await jwtService.generateAccessToken(payload);
      await jwtService.revokeToken(token);

      const stats = jwtService.getTokenStats();

      expect(stats).toBeDefined();
      expect(stats.revokedCount).toBeGreaterThan(0);
      expect(typeof stats.revokedCount).toBe('number');
    });
  });

  describe('config validation', () => {
    it('should throw error for short access token secret', () => {
      const invalidConfig = { ...config, accessTokenSecret: 'short' };
      
      expect(() => new JoseJwtService(invalidConfig))
        .toThrow('Access token secret must be at least 32 characters');
    });

    it('should throw error for short refresh token secret', () => {
      const invalidConfig = { ...config, refreshTokenSecret: 'short' };
      
      expect(() => new JoseJwtService(invalidConfig))
        .toThrow('Refresh token secret must be at least 32 characters');
    });

    it('should throw error for same secrets', () => {
      const invalidConfig = { 
        ...config, 
        refreshTokenSecret: config.accessTokenSecret 
      };
      
      expect(() => new JoseJwtService(invalidConfig))
        .toThrow('Access and refresh token secrets must be different');
    });

    it('should throw error for invalid algorithm', () => {
      const invalidConfig = { ...config, algorithm: 'INVALID' };
      
      expect(() => new JoseJwtService(invalidConfig))
        .toThrow('Algorithm must be one of: HS256, HS384, HS512');
    });

    it('should throw error for invalid expiration format', () => {
      const invalidConfig = { ...config, accessTokenExpiresIn: 'invalid' };
      
      expect(() => new JoseJwtService(invalidConfig))
        .toThrow('Invalid access token expiration format');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string token', async () => {
      await expect(jwtService.verifyAccessToken(''))
        .rejects.toThrow('Access token must be a non-empty string');
    });

    it('should handle null token', async () => {
      await expect(jwtService.verifyAccessToken(null as any))
        .rejects.toThrow('Access token must be a non-empty string');
    });

    it('should handle malformed JWT', async () => {
      const malformedToken = 'header.payload'; // Missing signature
      
      await expect(jwtService.verifyAccessToken(malformedToken))
        .rejects.toThrow('Invalid or expired access token');
    });
  });
});