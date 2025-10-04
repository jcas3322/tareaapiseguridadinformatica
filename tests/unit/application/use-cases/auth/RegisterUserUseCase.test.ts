/**
 * RegisterUserUseCase Unit Tests
 */

import { RegisterUserUseCase } from '../../../../../src/application/use-cases/auth/RegisterUserUseCase';
import { User } from '../../../../../src/domain/entities/User';
import { UserRole } from '../../../../../src/domain/entities/enums/UserRole';
import { UserRepository } from '../../../../../src/domain/repositories/UserRepository';
import { UserDomainService } from '../../../../../src/domain/services/UserDomainService';
import { SecurityDomainService } from '../../../../../src/domain/services/SecurityDomainService';
import { PasswordHasher } from '../../../../../src/application/ports/PasswordHasher';
import { EventPublisher } from '../../../../../src/application/ports/EventPublisher';
import { Logger } from '../../../../../src/application/ports/Logger';
import { RegisterUserCommand } from '../../../../../src/application/dto/auth/RegisterUserCommand';

describe('RegisterUserUseCase', () => {
  let useCase: RegisterUserUseCase;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockUserDomainService: jest.Mocked<UserDomainService>;
  let mockSecurityDomainService: jest.Mocked<SecurityDomainService>;
  let mockPasswordHasher: jest.Mocked<PasswordHasher>;
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

    mockUserDomainService = {
      validateUserCreation: jest.fn(),
      validateEmailUpdate: jest.fn(),
      validateUsernameUpdate: jest.fn(),
      canPromoteToRole: jest.fn(),
      canDemoteFromRole: jest.fn(),
      isSuspiciousAccount: jest.fn(),
      shouldAutoVerify: jest.fn(),
      calculateEngagementScore: jest.fn(),
      validatePasswordStrength: jest.fn(),
      generateUsernameSuggestions: jest.fn()
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

    useCase = new RegisterUserUseCase(
      mockUserRepository,
      mockUserDomainService,
      mockSecurityDomainService,
      mockPasswordHasher,
      mockEventPublisher,
      mockLogger
    );
  });

  describe('execute', () => {
    const validCommand: RegisterUserCommand = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
      firstName: 'Test',
      lastName: 'User',
      acceptTerms: true,
      acceptPrivacyPolicy: true
    };

    it('should successfully register a new user', async () => {
      // Arrange
      const hashedPassword = 'hashed_password';
      const mockUser = User.create({
        email: validCommand.email,
        username: validCommand.username,
        hashedPassword,
        role: UserRole.USER,
        profile: {
          firstName: validCommand.firstName,
          lastName: validCommand.lastName,
          displayName: `${validCommand.firstName} ${validCommand.lastName}`,
          isPublic: false
        }
      });

      mockUserDomainService.validatePasswordStrength.mockReturnValue({
        isValid: true,
        score: 85,
        feedback: []
      });
      mockUserDomainService.validateUserCreation.mockResolvedValue(undefined);
      mockPasswordHasher.hash.mockResolvedValue(hashedPassword);
      mockUserDomainService.shouldAutoVerify.mockReturnValue(true);
      mockUserDomainService.isSuspiciousAccount.mockReturnValue(false);
      mockUserRepository.save.mockResolvedValue(mockUser.verify());
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
      expect(result.email).toBe(validCommand.email);
      expect(result.username).toBe(validCommand.username);
      expect(result.isVerified).toBe(true);
      expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
      expect(mockEventPublisher.publish).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User registered successfully',
        expect.objectContaining({
          email: validCommand.email,
          username: validCommand.username
        })
      );
    });

    it('should throw error for weak password', async () => {
      // Arrange
      mockUserDomainService.validatePasswordStrength.mockReturnValue({
        isValid: false,
        score: 30,
        feedback: ['Password is too weak']
      });

      // Act & Assert
      await expect(useCase.execute(validCommand)).rejects.toThrow('Password is too weak: Password is too weak');
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('should throw error for existing email', async () => {
      // Arrange
      mockUserDomainService.validatePasswordStrength.mockReturnValue({
        isValid: true,
        score: 85,
        feedback: []
      });
      mockUserDomainService.validateUserCreation.mockRejectedValue(new Error('Email is already registered'));

      // Act & Assert
      await expect(useCase.execute(validCommand)).rejects.toThrow('Email is already registered');
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('should throw error for mismatched passwords', async () => {
      // Arrange
      const invalidCommand = {
        ...validCommand,
        confirmPassword: 'DifferentPassword123!'
      };

      // Act & Assert
      await expect(useCase.execute(invalidCommand)).rejects.toThrow('Passwords do not match');
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('should throw error when terms not accepted', async () => {
      // Arrange
      const invalidCommand = {
        ...validCommand,
        acceptTerms: false
      };

      // Act & Assert
      await expect(useCase.execute(invalidCommand)).rejects.toThrow('You must accept the terms of service');
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('should log security event for suspicious account', async () => {
      // Arrange
      const hashedPassword = 'hashed_password';
      const mockUser = User.create({
        email: validCommand.email,
        username: validCommand.username,
        hashedPassword,
        role: UserRole.USER
      });

      mockUserDomainService.validatePasswordStrength.mockReturnValue({
        isValid: true,
        score: 85,
        feedback: []
      });
      mockUserDomainService.validateUserCreation.mockResolvedValue(undefined);
      mockPasswordHasher.hash.mockResolvedValue(hashedPassword);
      mockUserDomainService.shouldAutoVerify.mockReturnValue(false);
      mockUserDomainService.isSuspiciousAccount.mockReturnValue(true);
      mockUserRepository.save.mockResolvedValue(mockUser);
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
        'Suspicious account registration detected',
        expect.objectContaining({
          email: validCommand.email,
          username: validCommand.username
        })
      );
      expect(mockLogger.security).toHaveBeenCalledWith(
        'Suspicious registration',
        expect.any(Object)
      );
    });
  });
});