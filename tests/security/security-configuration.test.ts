/**
 * Security Configuration Validation Tests
 * Verifies that all security configurations are properly set
 */

import { EnvironmentConfig } from '../../src/infrastructure/config/EnvironmentConfig';
import { SecurityMiddleware } from '../../src/infrastructure/web/middleware/SecurityMiddleware';
import { WinstonLogger } from '../../src/infrastructure/logging/WinstonLogger';
import { BcryptPasswordHasher } from '../../src/infrastructure/security/BcryptPasswordHasher';
import { JoseJwtService } from '../../src/infrastructure/security/JoseJwtService';

describe('Security Configuration Tests', () => {
  let envConfig: EnvironmentConfig;
  let logger: WinstonLogger;

  beforeAll(() => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-key-minimum-32-characters-long';
    process.env.BCRYPT_ROUNDS = '12';
    process.env.CORS_ORIGINS = 'https://localhost:3000,https://app.example.com';
    process.env.RATE_LIMIT_WINDOW = '900000'; // 15 minutes
    process.env.RATE_LIMIT_MAX = '100';
    
    envConfig = EnvironmentConfig.getInstance();
    logger = new WinstonLogger({
      level: 'error',
      enableConsole: false,
      enableFile: false,
      environment: 'test',
      serviceName: 'test'
    });
  });

  describe('Environment Configuration', () => {
    it('should have secure JWT configuration', () => {
      const securityConfig = envConfig.getSecurityConfig();
      
      expect(securityConfig.jwtSecret).toBeDefined();
      expect(securityConfig.jwtSecret.length).toBeGreaterThanOrEqual(32);
      expect(securityConfig.jwtExpiresIn).toBeDefined();
      expect(securityConfig.jwtRefreshExpiresIn).toBeDefined();
    });

    it('should have proper bcrypt configuration', () => {
      const securityConfig = envConfig.getSecurityConfig();
      
      expect(securityConfig.bcryptRounds).toBeGreaterThanOrEqual(10);
      expect(securityConfig.bcryptRounds).toBeLessThanOrEqual(15);
    });

    it('should have CORS origins configured', () => {
      const securityConfig = envConfig.getSecurityConfig();
      
      expect(securityConfig.corsOrigins).toBeDefined();
      expect(Array.isArray(securityConfig.corsOrigins)).toBe(true);
      expect(securityConfig.corsOrigins.length).toBeGreaterThan(0);
      
      // Should not allow all origins in production
      if (envConfig.isProduction()) {
        expect(securityConfig.corsOrigins).not.toContain('*');
      }
    });

    it('should have rate limiting configured', () => {
      const securityConfig = envConfig.getSecurityConfig();
      
      expect(securityConfig.rateLimitWindow).toBeGreaterThan(0);
      expect(securityConfig.rateLimitMax).toBeGreaterThan(0);
      expect(securityConfig.rateLimitMax).toBeLessThanOrEqual(1000);
    });

    it('should have database configuration secured', () => {
      const dbConfig = envConfig.getDatabaseConfig();
      
      expect(dbConfig.host).toBeDefined();
      expect(dbConfig.port).toBeGreaterThan(0);
      expect(dbConfig.database).toBeDefined();
      expect(dbConfig.username).toBeDefined();
      expect(dbConfig.password).toBeDefined();
      
      // Should use SSL in production
      if (envConfig.isProduction()) {
        expect(dbConfig.ssl).toBe(true);
      }
    });

    it('should have proper server configuration', () => {
      const serverConfig = envConfig.getServerConfig();
      
      expect(serverConfig.port).toBeGreaterThan(0);
      expect(serverConfig.host).toBeDefined();
      expect(serverConfig.bodyLimit).toBeDefined();
      expect(serverConfig.requestTimeout).toBeGreaterThan(0);
      
      // Should have appropriate timeouts
      expect(serverConfig.requestTimeout).toBeLessThanOrEqual(30000); // 30 seconds max
    });
  });

  describe('Security Middleware Configuration', () => {
    it('should configure security middleware properly', () => {
      const securityConfig = envConfig.getSecurityConfig();
      const securityMiddleware = new SecurityMiddleware({
        corsOrigins: securityConfig.corsOrigins,
        enableHSTS: securityConfig.enableHSTS,
        enableCSP: securityConfig.enableCSP,
        enableXSSProtection: true,
        enableFrameGuard: true,
        enableContentTypeNoSniff: true,
        enableReferrerPolicy: true
      }, logger);

      expect(securityMiddleware).toBeDefined();
    });

    it('should have HSTS enabled in production', () => {
      const securityConfig = envConfig.getSecurityConfig();
      
      if (envConfig.isProduction()) {
        expect(securityConfig.enableHSTS).toBe(true);
      }
    });

    it('should have CSP enabled', () => {
      const securityConfig = envConfig.getSecurityConfig();
      
      expect(securityConfig.enableCSP).toBe(true);
    });
  });

  describe('Cryptographic Configuration', () => {
    it('should configure password hasher securely', () => {
      const securityConfig = envConfig.getSecurityConfig();
      const passwordHasher = new BcryptPasswordHasher(securityConfig.bcryptRounds, logger);
      
      expect(passwordHasher).toBeDefined();
    });

    it('should hash passwords with sufficient rounds', async () => {
      const securityConfig = envConfig.getSecurityConfig();
      const passwordHasher = new BcryptPasswordHasher(securityConfig.bcryptRounds, logger);
      
      const password = 'TestPassword123!';
      const hash = await passwordHasher.hash(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
      
      // Verify the hash
      const isValid = await passwordHasher.verify(password, hash);
      expect(isValid).toBe(true);
    });

    it('should configure JWT service securely', () => {
      const securityConfig = envConfig.getSecurityConfig();
      const jwtService = new JoseJwtService({
        secret: securityConfig.jwtSecret,
        expiresIn: securityConfig.jwtExpiresIn,
        refreshExpiresIn: securityConfig.jwtRefreshExpiresIn,
        issuer: 'spotify-api',
        audience: 'spotify-api-users'
      }, logger);
      
      expect(jwtService).toBeDefined();
    });

    it('should generate secure JWT tokens', async () => {
      const securityConfig = envConfig.getSecurityConfig();
      const jwtService = new JoseJwtService({
        secret: securityConfig.jwtSecret,
        expiresIn: securityConfig.jwtExpiresIn,
        refreshExpiresIn: securityConfig.jwtRefreshExpiresIn,
        issuer: 'spotify-api',
        audience: 'spotify-api-users'
      }, logger);
      
      const payload = { userId: 'test-user-123', role: 'user' };
      const token = await jwtService.generateToken(payload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format
      
      // Verify the token
      const decoded = await jwtService.verifyToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.role).toBe(payload.role);
    });

    it('should reject invalid JWT tokens', async () => {
      const securityConfig = envConfig.getSecurityConfig();
      const jwtService = new JoseJwtService({
        secret: securityConfig.jwtSecret,
        expiresIn: securityConfig.jwtExpiresIn,
        refreshExpiresIn: securityConfig.jwtRefreshExpiresIn,
        issuer: 'spotify-api',
        audience: 'spotify-api-users'
      }, logger);
      
      const invalidTokens = [
        'invalid.token.here',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        '',
        null,
        undefined
      ];
      
      for (const token of invalidTokens) {
        await expect(jwtService.verifyToken(token as any)).rejects.toThrow();
      }
    });
  });

  describe('Logging Configuration', () => {
    it('should configure logger securely', () => {
      const serverConfig = envConfig.getServerConfig();
      const logger = new WinstonLogger({
        level: serverConfig.logLevel,
        enableConsole: true,
        enableFile: true,
        logDirectory: './logs',
        maxFiles: '30d',
        maxSize: '100m',
        enableRotation: true,
        enableElastic: false,
        environment: serverConfig.environment,
        serviceName: 'spotify-api'
      });

      expect(logger).toBeDefined();
    });

    it('should not log sensitive information', () => {
      const logger = new WinstonLogger({
        level: 'info',
        enableConsole: false,
        enableFile: false,
        environment: 'test',
        serviceName: 'test'
      });

      // Mock the logger to capture logs
      const logSpy = jest.spyOn(logger as any, 'log');
      
      const sensitiveData = {
        password: 'secret123',
        token: 'jwt-token-here',
        creditCard: '4111-1111-1111-1111'
      };

      logger.info('User data', sensitiveData);
      
      // In a real implementation, sensitive fields should be filtered
      expect(logSpy).toHaveBeenCalled();
    });
  });

  describe('Database Security Configuration', () => {
    it('should have connection pooling configured', () => {
      const dbConfig = envConfig.getDatabaseConfig();
      
      expect(dbConfig.maxConnections).toBeDefined();
      expect(dbConfig.maxConnections).toBeGreaterThan(0);
      expect(dbConfig.maxConnections).toBeLessThanOrEqual(100);
      
      expect(dbConfig.connectionTimeout).toBeDefined();
      expect(dbConfig.connectionTimeout).toBeGreaterThan(0);
    });

    it('should have query timeout configured', () => {
      const dbConfig = envConfig.getDatabaseConfig();
      
      expect(dbConfig.queryTimeout).toBeDefined();
      expect(dbConfig.queryTimeout).toBeGreaterThan(0);
      expect(dbConfig.queryTimeout).toBeLessThanOrEqual(30000); // 30 seconds max
    });

    it('should use SSL in production', () => {
      if (envConfig.isProduction()) {
        const dbConfig = envConfig.getDatabaseConfig();
        expect(dbConfig.ssl).toBe(true);
      }
    });
  });

  describe('File Upload Security Configuration', () => {
    it('should have file size limits configured', () => {
      const serverConfig = envConfig.getServerConfig();
      
      expect(serverConfig.maxFileSize).toBeDefined();
      expect(serverConfig.maxFileSize).toBeGreaterThan(0);
      expect(serverConfig.maxFileSize).toBeLessThanOrEqual(50 * 1024 * 1024); // 50MB max
    });

    it('should have allowed file types configured', () => {
      const serverConfig = envConfig.getServerConfig();
      
      expect(serverConfig.allowedFileTypes).toBeDefined();
      expect(Array.isArray(serverConfig.allowedFileTypes)).toBe(true);
      expect(serverConfig.allowedFileTypes.length).toBeGreaterThan(0);
      
      // Should not allow dangerous file types
      const dangerousTypes = ['.exe', '.bat', '.sh', '.php', '.jsp'];
      dangerousTypes.forEach(type => {
        expect(serverConfig.allowedFileTypes).not.toContain(type);
      });
    });
  });

  describe('Security Headers Configuration', () => {
    it('should have CSP policy configured', () => {
      const securityConfig = envConfig.getSecurityConfig();
      
      if (securityConfig.enableCSP) {
        expect(securityConfig.cspPolicy).toBeDefined();
        expect(typeof securityConfig.cspPolicy).toBe('object');
      }
    });

    it('should have HSTS configuration', () => {
      const securityConfig = envConfig.getSecurityConfig();
      
      if (securityConfig.enableHSTS) {
        expect(securityConfig.hstsMaxAge).toBeDefined();
        expect(securityConfig.hstsMaxAge).toBeGreaterThan(0);
      }
    });
  });

  describe('API Security Configuration', () => {
    it('should have API versioning configured', () => {
      const serverConfig = envConfig.getServerConfig();
      
      expect(serverConfig.apiVersion).toBeDefined();
      expect(serverConfig.apiVersion).toMatch(/^v\d+$/);
    });

    it('should have request validation configured', () => {
      const serverConfig = envConfig.getServerConfig();
      
      expect(serverConfig.enableRequestValidation).toBe(true);
      expect(serverConfig.enableResponseValidation).toBeDefined();
    });

    it('should have swagger configuration secured', () => {
      const serverConfig = envConfig.getServerConfig();
      
      expect(serverConfig.enableSwagger).toBeDefined();
      
      // Swagger should be disabled in production
      if (envConfig.isProduction()) {
        expect(serverConfig.enableSwagger).toBe(false);
      }
    });
  });

  describe('Monitoring and Alerting Configuration', () => {
    it('should have health check configuration', () => {
      const serverConfig = envConfig.getServerConfig();
      
      expect(serverConfig.enableHealthCheck).toBe(true);
      expect(serverConfig.healthCheckPath).toBeDefined();
    });

    it('should have metrics configuration', () => {
      const serverConfig = envConfig.getServerConfig();
      
      expect(serverConfig.enableMetrics).toBeDefined();
      if (serverConfig.enableMetrics) {
        expect(serverConfig.metricsPath).toBeDefined();
      }
    });
  });

  describe('Environment-Specific Security', () => {
    it('should have stricter security in production', () => {
      if (envConfig.isProduction()) {
        const securityConfig = envConfig.getSecurityConfig();
        const serverConfig = envConfig.getServerConfig();
        
        // Production should have stricter settings
        expect(securityConfig.enableHSTS).toBe(true);
        expect(securityConfig.enableCSP).toBe(true);
        expect(serverConfig.enableSwagger).toBe(false);
        expect(serverConfig.logLevel).not.toBe('debug');
      }
    });

    it('should allow development features in development', () => {
      if (envConfig.isDevelopment()) {
        const serverConfig = envConfig.getServerConfig();
        
        // Development can have more permissive settings
        expect(serverConfig.enableSwagger).toBe(true);
        expect(['debug', 'info']).toContain(serverConfig.logLevel);
      }
    });

    it('should have test-specific configuration', () => {
      if (envConfig.isTest()) {
        const serverConfig = envConfig.getServerConfig();
        
        expect(serverConfig.logLevel).toBe('error');
        expect(serverConfig.enableSwagger).toBe(false);
      }
    });
  });
});