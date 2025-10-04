/**
 * GetUserProfileUseCase
 * Handles retrieving user profiles with authorization checks
 */

import { UserId } from '../../../domain/entities/value-objects/UserId';
import { UserRole } from '../../../domain/entities/enums/UserRole';
import { UserRepository } from '../../../domain/repositories/UserRepository';
import { SecurityDomainService, SecurityEventType } from '../../../domain/services/SecurityDomainService';
import { EventPublisher, DomainEventBuilder } from '../../ports/EventPublisher';
import { Logger } from '../../ports/Logger';
import { GetUserProfileCommand, GetUserProfileCommandValidator } from '../../dto/user/GetUserProfileCommand';
import { UserDto, UserDtoMapper } from '../../dto/auth/UserDto';
import { v4 as uuidv4 } from 'uuid';

export class GetUserProfileUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly securityDomainService: SecurityDomainService,
    private readonly eventPublisher: EventPublisher,
    private readonly logger: Logger
  ) {}

  public async execute(command: GetUserProfileCommand): Promise<UserDto> {
    const startTime = Date.now();
    
    try {
      // Validate command
      GetUserProfileCommandValidator.validate(command);

      // Log profile access attempt
      this.logger.info('User profile access attempt', {
        userId: command.userId,
        requesterId: command.requesterId,
        includePrivateData: command.includePrivateData,
        operation: 'get_user_profile'
      });

      // Find the target user
      const userId = UserId.fromString(command.userId);
      const user = await this.userRepository.findById(userId);

      if (!user) {
        this.logger.warn('User profile not found', {
          userId: command.userId,
          requesterId: command.requesterId,
          operation: 'get_user_profile'
        });

        throw new Error('User not found');
      }

      // Find the requester
      const requesterId = UserId.fromString(command.requesterId);
      const requester = await this.userRepository.findById(requesterId);

      if (!requester) {
        this.logger.warn('Requester not found', {
          userId: command.userId,
          requesterId: command.requesterId,
          operation: 'get_user_profile'
        });

        throw new Error('Requester not found');
      }

      // Check if requester is active
      if (!requester.isActive || requester.deletedAt) {
        this.logger.warn('Inactive requester attempted profile access', {
          userId: command.userId,
          requesterId: command.requesterId,
          operation: 'get_user_profile'
        });

        throw new Error('Access denied');
      }

      // Validate resource access
      const accessValidation = this.securityDomainService.validateResourceAccess(
        requester,
        'user_profile',
        user.id,
        undefined // No specific role required for basic profile access
      );

      if (!accessValidation.allowed) {
        this.logger.warn('Profile access denied', {
          userId: command.userId,
          requesterId: command.requesterId,
          reason: accessValidation.reason,
          operation: 'get_user_profile'
        });

        // Create security event for unauthorized access attempt
        const securityEvent = this.securityDomainService.createSecurityEvent(
          SecurityEventType.UNAUTHORIZED_ACCESS,
          {
            action: 'get_user_profile',
            targetUserId: command.userId,
            requesterId: command.requesterId,
            reason: accessValidation.reason
          },
          requester.id
        );

        this.logger.security('Unauthorized profile access attempt', {
          requesterId: command.requesterId,
          event: securityEvent
        });

        throw new Error('Access denied');
      }

      // Check privacy settings
      const isOwnProfile = user.id.equals(requester.id);
      const isModerator = requester.canAccess(UserRole.MODERATOR);
      const canViewPrivateData = isOwnProfile || isModerator;

      // If profile is private and requester is not owner/moderator
      if (!user.profile.isPublic && !canViewPrivateData) {
        this.logger.info('Private profile access denied', {
          userId: command.userId,
          requesterId: command.requesterId,
          operation: 'get_user_profile'
        });

        throw new Error('Profile is private');
      }

      // Check if requester wants private data but doesn't have permission
      if (command.includePrivateData && !canViewPrivateData) {
        this.logger.warn('Private data access denied', {
          userId: command.userId,
          requesterId: command.requesterId,
          operation: 'get_user_profile'
        });

        throw new Error('Access to private data denied');
      }

      // Create domain event for profile access
      const domainEvent = new DomainEventBuilder()
        .setEventId(uuidv4())
        .setEventType('UserProfileAccessed')
        .setAggregateId(user.id.value)
        .setAggregateType('User')
        .setEventData({
          targetUserId: user.id.value,
          requesterId: requester.id.value,
          requesterRole: requester.role,
          isOwnProfile,
          includePrivateData: command.includePrivateData && canViewPrivateData,
          profileIsPublic: user.profile.isPublic
        })
        .setOccurredAt(new Date())
        .setVersion(1)
        .build();

      // Publish event
      await this.eventPublisher.publish(domainEvent);

      // Log successful profile access
      const duration = Date.now() - startTime;
      this.logger.info('User profile accessed successfully', {
        userId: command.userId,
        requesterId: command.requesterId,
        isOwnProfile,
        operation: 'get_user_profile'
      });

      this.logger.performance('get_user_profile', duration, {
        userId: command.userId,
        requesterId: command.requesterId
      });

      // Create security event for successful access
      const successEvent = this.securityDomainService.createSecurityEvent(
        SecurityEventType.DATA_ACCESS,
        {
          action: 'get_user_profile',
          targetUserId: command.userId,
          requesterId: command.requesterId,
          isOwnProfile,
          includePrivateData: command.includePrivateData && canViewPrivateData
        },
        requester.id
      );

      this.logger.audit('User profile access completed', {
        userId: command.userId,
        requesterId: command.requesterId,
        event: successEvent
      });

      // Convert to DTO
      const userDto = UserDtoMapper.toDto(user);

      // Filter sensitive data if not authorized
      if (!canViewPrivateData || !command.includePrivateData) {
        return this.filterSensitiveData(userDto, canViewPrivateData);
      }

      return userDto;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error('Get user profile failed', error as Error, {
        userId: command.userId,
        requesterId: command.requesterId,
        operation: 'get_user_profile'
      });

      this.logger.performance('get_user_profile_failed', duration, {
        userId: command.userId,
        requesterId: command.requesterId
      });

      throw error;
    }
  }

  private filterSensitiveData(userDto: UserDto, canViewPrivateData: boolean): UserDto {
    // Always filter out sensitive fields for non-authorized users
    if (!canViewPrivateData) {
      return {
        ...userDto,
        email: '[PROTECTED]', // Hide email for privacy
        profile: {
          ...userDto.profile,
          firstName: userDto.profile.isPublic ? userDto.profile.firstName : undefined,
          lastName: userDto.profile.isPublic ? userDto.profile.lastName : undefined,
          bio: userDto.profile.isPublic ? userDto.profile.bio : undefined,
          country: userDto.profile.isPublic ? userDto.profile.country : undefined,
          dateOfBirth: undefined, // Always hide date of birth from others
        },
        lastLoginAt: undefined // Hide last login time
      };
    }

    return userDto;
  }
}