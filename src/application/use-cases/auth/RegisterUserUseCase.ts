/**
 * RegisterUserUseCase
 * Handles user registration with security validations
 */

import { User } from '../../../domain/entities/User';
import { UserRole } from '../../../domain/entities/enums/UserRole';
import { UserRepository } from '../../../domain/repositories/UserRepository';
import { UserDomainService } from '../../../domain/services/UserDomainService';
import { SecurityDomainService, SecurityEventType } from '../../../domain/services/SecurityDomainService';
import { PasswordHasher } from '../../ports/PasswordHasher';
import { EventPublisher, DomainEventBuilder } from '../../ports/EventPublisher';
import { Logger } from '../../ports/Logger';
import { RegisterUserCommand, RegisterUserCommandValidator } from '../../dto/auth/RegisterUserCommand';
import { UserDto, UserDtoMapper } from '../../dto/auth/UserDto';
import { v4 as uuidv4 } from 'uuid';

export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userDomainService: UserDomainService,
    private readonly securityDomainService: SecurityDomainService,
    private readonly passwordHasher: PasswordHasher,
    private readonly eventPublisher: EventPublisher,
    private readonly logger: Logger
  ) {}

  public async execute(command: RegisterUserCommand): Promise<UserDto> {
    const startTime = Date.now();
    
    try {
      // Validate command
      RegisterUserCommandValidator.validate(command);

      // Log registration attempt
      this.logger.info('User registration attempt', {
        email: command.email,
        username: command.username,
        operation: 'user_registration'
      });

      // Validate password strength
      const passwordValidation = this.userDomainService.validatePasswordStrength(command.password);
      if (!passwordValidation.isValid) {
        throw new Error(`Password is too weak: ${passwordValidation.feedback.join(', ')}`);
      }

      // Check if user can be created (email/username availability)
      await this.userDomainService.validateUserCreation(command.email, command.username);

      // Hash password
      const hashedPassword = await this.passwordHasher.hash(command.password);

      // Create user profile
      const profile = {
        firstName: command.firstName,
        lastName: command.lastName,
        displayName: command.firstName && command.lastName 
          ? `${command.firstName} ${command.lastName}` 
          : command.username,
        isPublic: false
      };

      // Create user entity
      const user = User.create({
        email: command.email,
        username: command.username,
        hashedPassword,
        role: UserRole.USER,
        profile
      });

      // Check if user should be auto-verified
      const shouldAutoVerify = this.userDomainService.shouldAutoVerify(user);
      const finalUser = shouldAutoVerify ? user.verify() : user;

      // Check for suspicious account patterns
      const isSuspicious = this.userDomainService.isSuspiciousAccount(finalUser);
      if (isSuspicious) {
        this.logger.warn('Suspicious account registration detected', {
          userId: finalUser.id.value,
          email: command.email,
          username: command.username,
          operation: 'user_registration'
        });

        // Create security event
        const securityEvent = this.securityDomainService.createSecurityEvent(
          SecurityEventType.SUSPICIOUS_ACTIVITY,
          {
            action: 'user_registration',
            reason: 'suspicious_account_patterns',
            email: command.email,
            username: command.username
          },
          finalUser.id
        );

        this.logger.security('Suspicious registration', {
          userId: finalUser.id.value,
          event: securityEvent
        });
      }

      // Save user to repository
      const savedUser = await this.userRepository.save(finalUser);

      // Create domain event
      const domainEvent = new DomainEventBuilder()
        .setEventId(uuidv4())
        .setEventType('UserRegistered')
        .setAggregateId(savedUser.id.value)
        .setAggregateType('User')
        .setEventData({
          email: savedUser.email.value,
          username: savedUser.username.value,
          role: savedUser.role,
          isVerified: savedUser.isVerified,
          autoVerified: shouldAutoVerify,
          suspicious: isSuspicious
        })
        .setOccurredAt(new Date())
        .setVersion(1)
        .build();

      // Publish event
      await this.eventPublisher.publish(domainEvent);

      // Log successful registration
      const duration = Date.now() - startTime;
      this.logger.info('User registered successfully', {
        userId: savedUser.id.value,
        email: command.email,
        username: command.username,
        isVerified: savedUser.isVerified,
        operation: 'user_registration'
      });

      this.logger.performance('user_registration', duration, {
        userId: savedUser.id.value
      });

      // Create security event for successful registration
      const successEvent = this.securityDomainService.createSecurityEvent(
        SecurityEventType.LOGIN_SUCCESS,
        {
          action: 'user_registration',
          userId: savedUser.id.value,
          email: command.email,
          username: command.username
        },
        savedUser.id
      );

      this.logger.audit('User registration completed', {
        userId: savedUser.id.value,
        event: successEvent
      });

      // Convert to DTO and return
      return UserDtoMapper.toDto(savedUser);

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error('User registration failed', error as Error, {
        email: command.email,
        username: command.username,
        operation: 'user_registration'
      });

      this.logger.performance('user_registration_failed', duration, {
        email: command.email,
        username: command.username
      });

      // Create security event for failed registration
      const failureEvent = this.securityDomainService.createSecurityEvent(
        SecurityEventType.SUSPICIOUS_ACTIVITY,
        {
          action: 'user_registration_failed',
          error: (error as Error).message,
          email: command.email,
          username: command.username
        }
      );

      this.logger.security('Registration failure', {
        event: failureEvent,
        error: (error as Error).message
      });

      throw error;
    }
  }
}