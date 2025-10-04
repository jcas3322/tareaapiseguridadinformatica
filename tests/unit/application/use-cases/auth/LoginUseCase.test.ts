/**
 * LoginUseCase Unit Tests
 */

import { LoginUseCase } from '../../../../../src/application/use-cases/auth/LoginUseCase';
import { User } from '../../../../../src/domain/entities/User';
import { Email } from '../../../../../src/domain/entities/value-objects/Email';
import { Username } from '../../../../../src/domain/entities/value-objects/Username';
import { HashedPassword } from '../../../../../src/domain/entities/value-objects/HashedPassword';
import { UserRole } from '../../../../../src/domain/entities/enums/UserRole';
import { UserRepository } from '../../../../../src/domain/repositories/UserRepository';
import { SecurityDomainService } from '../../../../../src/domain/services/SecurityDomainService';
import { PasswordHasher } from '../../../../../src/application/ports/PasswordHasher';
import { JwtService } from '../../../../../src/application/ports/JwtService';
import { EventPublisher } from '../../../../../src/application/ports/EventPublisher';
import { Logger } from '../../../../../src/application/ports/Logger';
import { LoginCommand } from '../../../../../src/application/dto/auth/LoginCommand';

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockSecurityDomainService: jest.Mocked<SecurityDomainService>;
  let mockPasswordHasher: jest.Mocked<PasswordHasher>;
  let mockJwtService: jest.Mocked<JwtService>;
  let mockEventPublisher: jest.Mocked<EventPublisher>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockUserRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      existsByEmail: jest.fn(),
      existsByUsername: jest.fn(),
      count: jest.fn(),
      countActive: jest.fn(),
      countByRole: jest.fn(),
      findByCreatedDateRange: jest.fn(),
      findInactiveUsers: jest.fn(),
      softDelete: jest.fn(),
      hardDelete: jest.fn(),
      restore: jest.fn(),
      bulkSave: jest.fn(),
      bulkSoftDelete: jest.fn(),
      search: jest.fn(),
      findMany: jest.fn()
    };

    mockSecurityDomainService = {
      validateResourceAccess: jest.fn(),
      createSecurityEvent: jest.fn(),
      validateJwtPayload: jest.fn(),
      detectSuspiciousLogin: jest.fn(),
      validateFileUpload: jest.fn(),
      validateApiRequest: jest.fn(),
      generateSessionConfig: jest.fn()
    };

    mockPasswordHasher = {
      hash: jest.fn(),
      verify: jest.fn(),
      getSaltRounds: jest.fn(),
      needsRehash: jest.fn()
    };

    mockJwtService = {
      generateTokens: jest.fn(),
      generateAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
      verifyToken: jest.fn(),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
      refreshAccessToken: jest.fn(),
      decodeToken: jest.fn(),
      getTokenExpiration: jest.fn(),
      isTokenExpired: jest.fn(),
      revokeToken: jest.fn(),
      isTokenRevoked: jest.fn()
    };

    mockEventPublisher = {
      publish: jest.fn(),
      publishMany: jest.fn(),
      publishWithRetry: jest.fn()
    };

    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
      child: jest.fn(),
      security: jest.fn(),
      audit: jest.fn(),
      performance: jest.fn()
    };

    useCase = new LoginUseCase(
      mockUserRepository,
      mockSecurityDomainService,
      mockPasswordHasher,
      mockJwtService,
      mockEventPublisher,
      mockLogger
    );
  });

  describe('execute', () => {
    const validCommand: LoginCommand = {
      emailOrUsername: 'test@example.com',
      password: 'SecurePass123!',
      rememberMe: false,
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0'
    };

    let mockUser: User;

    beforeEach(() => {
      mockUser = User.create({
        email: 'test@example.com',
        username: 'testuser',
        hashedPassword: '$2b$12$hashedpassword',
        role: UserRole.USER
      });
    });

    it('should successfully login with valid credentials', async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockPasswordHasher.verify.mockResolvedValue(true);
      mockSecurityDomainService.detectSuspiciousLogin.mockReturnValue({
        suspicious: false,
        reasons: []
      });
      mockUserRepository.save.mockResolvedValue(mockUser.recordLogin());
      mockJwtService.generateTokens.mockResolvedValue({
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        accessExpiresIn: 900,
        refreshExpiresIn: 604800
      });
      mockSecurityDomainService.createSecurityEvent.mockReturnValue({
        eventId: 'event-id',
        eventType: 'LOGIN_SUCCESS',
        aggregateId: mockUser.id.value,
        aggregateType: 'User',
        eventData: {},
        occurredAt: new Date(),
        version: 1
      });

      // Act
      const result = await useCase.execute(validCommand);

      // Assert
      expect(result).toBeDefined();
      expect(result.accessToken).toBe('access_token');
      expect(result.refreshToken).toBe('refresh_token');
      expect(result.user.email).toBe(mockUser.email.value);
      expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
      expect(mockEventPublisher.publish).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User logged in successfully',
        expect.objectContaining({
          userId: mockUser.id.value
        })
      );
    });

    it('should throw error for non-existent user', async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByUsername.mockResolvedValue(null);

      // Act & Assert
      await expect(useCase.execute(validCommand)).rejects.toThrow('Invalid credentials');
      expect(mockPasswordHasher.verify).not.toHaveBeenCalled();
      expect(mockJwtService.generateTokens).not.toHaveBeenCalled();
    });

    it('should throw error for inactive user', async () => {
      // Arrange
      const inactiveUser = mockUser.deactivate();
      mockUserRepository.findByEmail.mockResolvedValue(inactiveUser);

      // Act & Assert
      await expect(useCase.execute(validCommand)).rejects.toThrow('Account is inactive');
      expect(mockPasswordHasher.verify).not.toHaveBeenCalled();
      expect(mockJwtService.generateTokens).not.toHaveBeenCalled();
    });

    it('should throw error for invalid password', async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockPasswordHasher.verify.mockResolvedValue(false);

      // Act & Assert
      await expect(useCase.execute(validCommand)).rejects.toThrow('Invalid credentials');
      expect(mockJwtService.generateTokens).not.toHaveBeenCalled();
    });

    it('should log suspicious login activity', async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockPasswordHasher.verify.mockResolvedValue(true);
      mockSecurityDomainService.detectSuspiciousLogin.mockReturnValue({
        suspicious: true,
        reasons: ['Multiple IP addresses', 'High failure rate']
      });
      mockUserRepository.save.mockResolvedValue(mockUser.recordLogin());
      mockJwtService.generateTokens.mockResolvedValue({
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        accessExpiresIn: 900,
        refreshExpiresIn: 604800
      });
      mockSecurityDomainService.createSecurityEvent.mockReturnValue({
        eventId: 'event-id',
        eventType: 'SUSPICIOUS_ACTIVITY',
        aggregateId: mockUser.id.value,
        aggregateType: 'User',
        eventData: {},
        occurredAt: new Date(),
        version: 1
      });

      // Act
      await useCase.execute(validCommand);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Suspicious login detected',
        expect.objectContaining({
          userId: mockUser.id.value,
          reasons: ['Multiple IP addresses', 'High failure rate']
        })
      );
      expect(mockLogger.security).toHaveBeenCalledWith(
        'Suspicious login attempt',
        expect.any(Object)
      );
    });

    it('should handle rate limiting', async () => {
      // Arrange - simulate multiple failed attempts
      const command = { ...validCommand, emailOrUsername: 'ratelimited@example.com' };
      
      // Simulate 5 failed attempts
      for (let i = 0; i < 5; i++) {
        mockUserRepository.findByEmail.mockResolvedValue(null);
        try {
          await useCase.execute(command);
        } catch {
          // Expected to fail
        }
      }

      // Act & Assert - 6th attempt should be rate limited
      await expect(useCase.execute(command)).rejects.toThrow(/Too many failed attempts/);
    });

    it('should find user by username when email format is invalid', async () => {
      // Arrange
      const usernameCommand = { ...validCommand, emailOrUsername: 'testuser' };
      mockUserRepository.findByUsername.mockResolvedValue(mockUser);
      mockPasswordHasher.verify.mockResolvedValue(true);
      mockSecurityDomainService.detectSuspiciousLogin.mockReturnValue({
        suspicious: false,
        reasons: []
      });
      mockUserRepository.save.mockResolvedValue(mockUser.recordLogin());
      mockJwtService.generateTokens.mockResolvedValue({
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        accessExpiresIn: 900,
        refreshExpiresIn: 604800
      });

      // Act
      const result = await useCase.execute(usernameCommand);

      // Assert
      expect(result).toBeDefined();
      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith(
        expect.objectContaining({ value: 'testuser' })
      );
    });
  });
});