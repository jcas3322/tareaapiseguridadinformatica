/**
 * LoginUseCase
 * Handles user login with security validations and rate limiting
 */

import { User } from '../../../domain/entities/User';
import { Email } from '../../../domain/entities/value-objects/Email';
import { Username } from '../../../domain/entities/value-objects/Username';
import { UserRepository } from '../../../domain/repositories/UserRepository';
import { SecurityDomainService, SecurityEventType } from '../../../domain/services/SecurityDomainService';
import { PasswordHasher } from '../../ports/PasswordHasher';
import { JwtService } from '../../ports/JwtService';
import { EventPublisher, DomainEventBuilder } from '../../ports/EventPublisher';
import { Logger } from '../../ports/Logger';
import { LoginCommand, LoginCommandValidator } from '../../dto/auth/LoginCommand';
import { AuthTokenDto, AuthTokenDtoBuilder, UserAuthDto } from '../../dto/auth/AuthTokenDto';
import { UserDtoMapper } from '../../dto/auth/UserDto';
import { v4 as uuidv4 } from 'uuid';

export interface LoginAttempt {
  readonly timestamp: Date;
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly success: boolean;
}

export class LoginUseCase {
  private readonly loginAttempts = new Map<string, LoginAttempt[]>();
  private readonly maxAttempts = 5;
  private readonly windowMs = 15 * 60 * 1000; // 15 minutes
  private readonly blockDurationMs = 30 * 60 * 1000; // 30 minutes

  constructor(
    private readonly userRepository: UserRepository,
    private readonly securityDomainService: SecurityDomainService,
    private readonly passwordHasher: PasswordHasher,
    private readonly jwtService: JwtService,
    private readonly eventPublisher: EventPublisher,
    private readonly logger: Logger
  ) {}

  public async execute(command: LoginCommand): Promise<AuthTokenDto> {
    const startTime = Date.now();
    const identifier = command.emailOrUsername.toLowerCase();
    
    try {
      // Validate command
      LoginCommandValidator.validate(command);

      // Check rate limiting
      this.checkRateLimit(identifier, command.ipAddress || 'unknown');

      // Log login attempt
      this.logger.info('Login attempt', {
        identifier,
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
        operation: 'user_login'
      });

      // Find user by email or username
      const user = await this.findUserByIdentifier(identifier);
      
      if (!user) {
        await this.handleFailedLogin(identifier, 'User not found', command);
        throw new Error('Invalid credentials');
      }

      // Check if user account is active
      if (!user.isActive) {
        await this.handleFailedLogin(identifier, 'Account inactive', command, user);
        throw new Error('Account is inactive');
      }

      // Check if user account is deleted
      if (user.deletedAt) {
        await this.handleFailedLogin(identifier, 'Account deleted', command, user);
        throw new Error('Account not found');
      }

      // Verify password
      const isPasswordValid = await this.passwordHasher.verify(command.password, user.password.value);
      
      if (!isPasswordValid) {
        await this.handleFailedLogin(identifier, 'Invalid password', command, user);
        throw new Error('Invalid credentials');
      }

      // Check for suspicious login patterns
      const recentAttempts = this.getRecentAttempts(identifier);
      const suspiciousLogin = this.securityDomainService.detectSuspiciousLogin(recentAttempts);
      
      if (suspiciousLogin.suspicious) {
        this.logger.warn('Suspicious login detected', {
          userId: user.id.value,
          identifier,
          reasons: suspiciousLogin.reasons,
          ipAddress: command.ipAddress,
          operation: 'user_login'
        });

        // Create security event
        const securityEvent = this.securityDomainService.createSecurityEvent(
          SecurityEventType.SUSPICIOUS_ACTIVITY,
          {
            action: 'suspicious_login',
            reasons: suspiciousLogin.reasons,
            identifier,
            ipAddress: command.ipAddress,
            userAgent: command.userAgent
          },
          user.id,
          command.ipAddress,
          command.userAgent
        );

        this.logger.security('Suspicious login attempt', {
          userId: user.id.value,
          event: securityEvent
        });
      }

      // Update user last login
      const updatedUser = user.recordLogin();
      await this.userRepository.save(updatedUser);

      // Generate JWT tokens
      const tokens = await this.jwtService.generateTokens({
        sub: updatedUser.id.value,
        email: updatedUser.email.value,
        username: updatedUser.username.value,
        role: updatedUser.role
      });

      // Record successful login attempt
      this.recordLoginAttempt(identifier, command, true);

      // Create domain event
      const domainEvent = new DomainEventBuilder()
        .setEventId(uuidv4())
        .setEventType('UserLoggedIn')
        .setAggregateId(updatedUser.id.value)
        .setAggregateType('User')
        .setEventData({
          email: updatedUser.email.value,
          username: updatedUser.username.value,
          ipAddress: command.ipAddress,
          userAgent: command.userAgent,
          rememberMe: command.rememberMe || false,
          suspicious: suspiciousLogin.suspicious,
          suspiciousReasons: suspiciousLogin.reasons
        })
        .setOccurredAt(new Date())
        .setVersion(1)
        .build();

      // Publish event
      await this.eventPublisher.publish(domainEvent);

      // Log successful login
      const duration = Date.now() - startTime;
      this.logger.info('User logged in successfully', {
        userId: updatedUser.id.value,
        identifier,
        ipAddress: command.ipAddress,
        operation: 'user_login'
      });

      this.logger.performance('user_login', duration, {
        userId: updatedUser.id.value
      });

      // Create security event for successful login
      const successEvent = this.securityDomainService.createSecurityEvent(
        SecurityEventType.LOGIN_SUCCESS,
        {
          action: 'user_login',
          userId: updatedUser.id.value,
          identifier,
          ipAddress: command.ipAddress,
          userAgent: command.userAgent
        },
        updatedUser.id,
        command.ipAddress,
        command.userAgent
      );

      this.logger.audit('User login completed', {
        userId: updatedUser.id.value,
        event: successEvent
      });

      // Build response DTO
      const userAuthDto: UserAuthDto = UserDtoMapper.toAuthDto(updatedUser);
      
      return new AuthTokenDtoBuilder()
        .setAccessToken(tokens.accessToken)
        .setRefreshToken(tokens.refreshToken)
        .setExpiresIn(tokens.accessExpiresIn)
        .setRefreshExpiresIn(tokens.refreshExpiresIn)
        .setUser(userAuthDto)
        .build();

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error('User login failed', error as Error, {
        identifier,
        ipAddress: command.ipAddress,
        operation: 'user_login'
      });

      this.logger.performance('user_login_failed', duration, {
        identifier,
        ipAddress: command.ipAddress
      });

      throw error;
    }
  }

  private async findUserByIdentifier(identifier: string): Promise<User | null> {
    // Try to find by email first
    if (identifier.includes('@')) {
      try {
        const email = Email.create(identifier);
        return await this.userRepository.findByEmail(email);
      } catch {
        // If email format is invalid, try username
      }
    }

    // Try to find by username
    try {
      const username = Username.create(identifier);
      return await this.userRepository.findByUsername(username);
    } catch {
      return null;
    }
  }

  private checkRateLimit(identifier: string, ipAddress: string): void {
    const attempts = this.loginAttempts.get(identifier) || [];
    const now = new Date();
    
    // Clean old attempts
    const recentAttempts = attempts.filter(attempt => 
      now.getTime() - attempt.timestamp.getTime() < this.windowMs
    );

    // Check if blocked
    const failedAttempts = recentAttempts.filter(attempt => !attempt.success);
    if (failedAttempts.length >= this.maxAttempts) {
      const lastFailure = failedAttempts[failedAttempts.length - 1];
      const timeSinceLastFailure = now.getTime() - lastFailure.timestamp.getTime();
      
      if (timeSinceLastFailure < this.blockDurationMs) {
        const remainingTime = Math.ceil((this.blockDurationMs - timeSinceLastFailure) / 1000 / 60);
        
        this.logger.warn('Rate limit exceeded', {
          identifier,
          ipAddress,
          remainingTime,
          operation: 'rate_limit'
        });

        throw new Error(`Too many failed attempts. Try again in ${remainingTime} minutes.`);
      }
    }

    // Update attempts
    this.loginAttempts.set(identifier, recentAttempts);
  }

  private recordLoginAttempt(identifier: string, command: LoginCommand, success: boolean): void {
    const attempts = this.loginAttempts.get(identifier) || [];
    
    attempts.push({
      timestamp: new Date(),
      ipAddress: command.ipAddress || 'unknown',
      userAgent: command.userAgent || 'unknown',
      success
    });

    this.loginAttempts.set(identifier, attempts);
  }

  private getRecentAttempts(identifier: string): LoginAttempt[] {
    const attempts = this.loginAttempts.get(identifier) || [];
    const now = new Date();
    
    return attempts.filter(attempt => 
      now.getTime() - attempt.timestamp.getTime() < this.windowMs
    );
  }

  private async handleFailedLogin(
    identifier: string, 
    reason: string, 
    command: LoginCommand, 
    user?: User
  ): Promise<void> {
    // Record failed attempt
    this.recordLoginAttempt(identifier, command, false);

    // Log failed login
    this.logger.warn('Login failed', {
      identifier,
      reason,
      userId: user?.id.value,
      ipAddress: command.ipAddress,
      operation: 'user_login'
    });

    // Create security event
    const securityEvent = this.securityDomainService.createSecurityEvent(
      SecurityEventType.LOGIN_FAILURE,
      {
        action: 'user_login_failed',
        reason,
        identifier,
        ipAddress: command.ipAddress,
        userAgent: command.userAgent
      },
      user?.id,
      command.ipAddress,
      command.userAgent
    );

    this.logger.security('Login failure', {
      userId: user?.id.value,
      event: securityEvent
    });

    // Check if this should trigger brute force detection
    const recentAttempts = this.getRecentAttempts(identifier);
    const failedAttempts = recentAttempts.filter(attempt => !attempt.success);
    
    if (failedAttempts.length >= this.maxAttempts - 1) {
      const bruteForceEvent = this.securityDomainService.createSecurityEvent(
        SecurityEventType.LOGIN_BRUTE_FORCE,
        {
          action: 'brute_force_detected',
          identifier,
          attemptCount: failedAttempts.length,
          ipAddress: command.ipAddress,
          userAgent: command.userAgent
        },
        user?.id,
        command.ipAddress,
        command.userAgent
      );

      this.logger.security('Brute force attack detected', {
        userId: user?.id.value,
        event: bruteForceEvent
      });
    }
  }
}