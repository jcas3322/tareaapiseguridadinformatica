/**
 * UpdateUserProfileUseCase
 * Handles updating user profiles with authorization and validation
 */

import { UserId } from '../../../domain/entities/value-objects/UserId';
import { UserRole } from '../../../domain/entities/enums/UserRole';
import { UserRepository } from '../../../domain/repositories/UserRepository';
import { UserDomainService } from '../../../domain/services/UserDomainService';
import { SecurityDomainService, SecurityEventType } from '../../../domain/services/SecurityDomainService';
import { EventPublisher, DomainEventBuilder } from '../../ports/EventPublisher';
import { Logger } from '../../ports/Logger';
import { UpdateUserProfileCommand, UpdateUserProfileCommandValidator } from '../../dto/user/UpdateUserProfileCommand';
import { UserDto, UserDtoMapper } from '../../dto/auth/UserDto';
import { v4 as uuidv4 } from 'uuid';

export class UpdateUserProfileUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userDomainService: UserDomainService,
    private readonly securityDomainService: SecurityDomainService,
    private readonly eventPublisher: EventPublisher,
    private readonly logger: Logger
  ) {}

  public async execute(command: UpdateUserProfileCommand): Promise<UserDto> {
    const startTime = Date.now();
    
    try {
      // Validate command
      UpdateUserProfileCommandValidator.validate(command);

      // Log profile update attempt
      this.logger.info('User profile update attempt', {
        userId: command.userId,
        requesterId: command.requesterId,
        updateFields: Object.keys(command.profileUpdates),
        operation: 'update_user_profile'
      });

      // Find the target user
      const userId = UserId.fromString(command.userId);
      const user = await this.userRepository.findById(userId);

      if (!user) {
        this.logger.warn('User not found for profile update', {
          userId: command.userId,
          requesterId: command.requesterId,
          operation: 'update_user_profile'
        });

        throw new Error('User not found');
      }

      // Find the requester
      const requesterId = UserId.fromString(command.requesterId);
      const requester = await this.userRepository.findById(requesterId);

      if (!requester) {
        this.logger.warn('Requester not found for profile update', {
          userId: command.userId,
          requesterId: command.requesterId,
          operation: 'update_user_profile'
        });

        throw new Error('Requester not found');
      }

      // Check if requester is active
      if (!requester.isActive || requester.deletedAt) {
        this.logger.warn('Inactive requester attempted profile update', {
          userId: command.userId,
          requesterId: command.requesterId,
          operation: 'update_user_profile'
        });

        throw new Error('Access denied');
      }

      // Validate resource access - user can only update their own profile or moderators can update any
      const isOwnProfile = user.id.equals(requester.id);
      const isModerator = requester.canAccess(UserRole.MODERATOR);

      if (!isOwnProfile && !isModerator) {
        this.logger.warn('Unauthorized profile update attempt', {
          userId: command.userId,
          requesterId: command.requesterId,
          operation: 'update_user_profile'
        });

        // Create security event for unauthorized access attempt
        const securityEvent = this.securityDomainService.createSecurityEvent(
          SecurityEventType.UNAUTHORIZED_ACCESS,
          {
            action: 'update_user_profile',
            targetUserId: command.userId,
            requesterId: command.requesterId,
            reason: 'not_owner_or_moderator'
          },
          requester.id
        );

        this.logger.security('Unauthorized profile update attempt', {
          requesterId: command.requesterId,
          event: securityEvent
        });

        throw new Error('You can only update your own profile');
      }

      // Validate profile updates using domain service
      const profileUpdates = command.profileUpdates;
      
      // Additional security validation for sensitive fields
      if (profileUpdates.avatarUrl) {
        // Validate avatar URL for security
        try {
          const url = new URL(profileUpdates.avatarUrl);
          if (url.protocol !== 'https:') {
            throw new Error('Avatar URL must use HTTPS');
          }
        } catch {
          throw new Error('Invalid avatar URL');
        }
      }

      // Check for suspicious content in text fields
      const textFields = {
        firstName: profileUpdates.firstName,
        lastName: profileUpdates.lastName,
        displayName: profileUpdates.displayName,
        bio: profileUpdates.bio
      };

      for (const [fieldName, value] of Object.entries(textFields)) {
        if (value && this.containsSuspiciousContent(value)) {
          this.logger.warn('Suspicious content detected in profile update', {
            userId: command.userId,
            requesterId: command.requesterId,
            field: fieldName,
            operation: 'update_user_profile'
          });

          throw new Error(`Invalid content in ${fieldName}`);
        }
      }

      // Store original profile for comparison
      const originalProfile = user.profile;

      // Update user profile
      const updatedUser = user.updateProfile(profileUpdates);

      // Save updated user
      const savedUser = await this.userRepository.save(updatedUser);

      // Determine what changed
      const changes = this.getProfileChanges(originalProfile, savedUser.profile);

      // Create domain event
      const domainEvent = new DomainEventBuilder()
        .setEventId(uuidv4())
        .setEventType('UserProfileUpdated')
        .setAggregateId(savedUser.id.value)
        .setAggregateType('User')
        .setEventData({
          targetUserId: savedUser.id.value,
          requesterId: requester.id.value,
          requesterRole: requester.role,
          isOwnProfile,
          changes,
          updatedFields: Object.keys(profileUpdates)
        })
        .setOccurredAt(new Date())
        .setVersion(1)
        .build();

      // Publish event
      await this.eventPublisher.publish(domainEvent);

      // Log successful profile update
      const duration = Date.now() - startTime;
      this.logger.info('User profile updated successfully', {
        userId: command.userId,
        requesterId: command.requesterId,
        isOwnProfile,
        updatedFields: Object.keys(profileUpdates),
        operation: 'update_user_profile'
      });

      this.logger.performance('update_user_profile', duration, {
        userId: command.userId,
        requesterId: command.requesterId
      });

      // Create security event for successful update
      const successEvent = this.securityDomainService.createSecurityEvent(
        SecurityEventType.DATA_ACCESS,
        {
          action: 'update_user_profile',
          targetUserId: command.userId,
          requesterId: command.requesterId,
          isOwnProfile,
          updatedFields: Object.keys(profileUpdates),
          changes
        },
        requester.id
      );

      this.logger.audit('User profile update completed', {
        userId: command.userId,
        requesterId: command.requesterId,
        event: successEvent
      });

      // Convert to DTO and return
      return UserDtoMapper.toDto(savedUser);

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error('Update user profile failed', error as Error, {
        userId: command.userId,
        requesterId: command.requesterId,
        operation: 'update_user_profile'
      });

      this.logger.performance('update_user_profile_failed', duration, {
        userId: command.userId,
        requesterId: command.requesterId
      });

      throw error;
    }
  }

  private containsSuspiciousContent(text: string): boolean {
    const suspiciousPatterns = [
      /<script[^>]*>.*?<\/script>/gi,  // Script tags
      /javascript:/gi,                 // JavaScript URLs
      /on\w+\s*=/gi,                  // Event handlers
      /<iframe[^>]*>.*?<\/iframe>/gi, // Iframe tags
      /[<>]/,                         // HTML tags
      /\0/,                           // Null bytes
      /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b/gi, // SQL keywords
    ];

    return suspiciousPatterns.some(pattern => pattern.test(text));
  }

  private getProfileChanges(
    original: any, 
    updated: any
  ): Record<string, { from: any; to: any }> {
    const changes: Record<string, { from: any; to: any }> = {};

    const fieldsToCheck = [
      'firstName', 'lastName', 'displayName', 'bio', 
      'avatarUrl', 'country', 'dateOfBirth', 'isPublic'
    ];

    for (const field of fieldsToCheck) {
      const originalValue = original[field];
      const updatedValue = updated[field];

      // Handle date comparison
      if (field === 'dateOfBirth') {
        const originalDate = originalValue?.getTime();
        const updatedDate = updatedValue?.getTime();
        
        if (originalDate !== updatedDate) {
          changes[field] = {
            from: originalValue,
            to: updatedValue
          };
        }
      } else if (originalValue !== updatedValue) {
        changes[field] = {
          from: originalValue,
          to: updatedValue
        };
      }
    }

    return changes;
  }
}