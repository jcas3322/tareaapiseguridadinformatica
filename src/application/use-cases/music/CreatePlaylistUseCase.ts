/**
 * CreatePlaylistUseCase
 * Handles playlist creation with privacy configuration
 */

import { UserId } from '../../../domain/entities/value-objects/UserId';
import { UserRepository } from '../../../domain/repositories/UserRepository';
import { SecurityDomainService, SecurityEventType } from '../../../domain/services/SecurityDomainService';
import { EventPublisher, DomainEventBuilder } from '../../ports/EventPublisher';
import { Logger } from '../../ports/Logger';
import { CreatePlaylistCommand, CreatePlaylistCommandValidator } from '../../dto/music/CreatePlaylistCommand';
import { v4 as uuidv4 } from 'uuid';

// Simplified Playlist entity for this use case
export interface PlaylistDto {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly isPublic: boolean;
  readonly isCollaborative: boolean;
  readonly coverImageUrl?: string;
  readonly tags: string[];
  readonly creatorId: string;
  readonly songCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class CreatePlaylistUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly securityDomainService: SecurityDomainService,
    private readonly eventPublisher: EventPublisher,
    private readonly logger: Logger
  ) {}

  public async execute(command: CreatePlaylistCommand): Promise<PlaylistDto> {
    const startTime = Date.now();
    
    try {
      // Validate command
      CreatePlaylistCommandValidator.validate(command);

      // Log playlist creation attempt
      this.logger.info('Playlist creation attempt', {
        name: command.name,
        creatorId: command.creatorId,
        isPublic: command.isPublic,
        operation: 'create_playlist'
      });

      // Find creator
      const creatorId = UserId.fromString(command.creatorId);
      const creator = await this.userRepository.findById(creatorId);

      if (!creator) {
        throw new Error('Creator not found');
      }

      if (!creator.isActive || creator.deletedAt) {
        throw new Error('Creator account is not active');
      }

      // Validate content for suspicious patterns
      if (this.containsSuspiciousContent(command.name)) {
        throw new Error('Playlist name contains invalid content');
      }

      if (command.description && this.containsSuspiciousContent(command.description)) {
        throw new Error('Playlist description contains invalid content');
      }

      // Create playlist (simplified - in real implementation would use proper entity)
      const playlistId = uuidv4();
      const now = new Date();
      
      const playlist: PlaylistDto = {
        id: playlistId,
        name: command.name.trim(),
        description: command.description?.trim(),
        isPublic: command.isPublic,
        isCollaborative: command.isCollaborative || false,
        coverImageUrl: command.coverImageUrl,
        tags: command.tags || [],
        creatorId: command.creatorId,
        songCount: 0,
        createdAt: now,
        updatedAt: now
      };

      // Create domain event
      const domainEvent = new DomainEventBuilder()
        .setEventId(uuidv4())
        .setEventType('PlaylistCreated')
        .setAggregateId(playlist.id)
        .setAggregateType('Playlist')
        .setEventData({
          playlistId: playlist.id,
          name: playlist.name,
          creatorId: command.creatorId,
          isPublic: playlist.isPublic,
          isCollaborative: playlist.isCollaborative,
          tags: playlist.tags
        })
        .setOccurredAt(new Date())
        .setVersion(1)
        .build();

      // Publish event
      await this.eventPublisher.publish(domainEvent);

      // Log successful creation
      const duration = Date.now() - startTime;
      this.logger.info('Playlist created successfully', {
        playlistId: playlist.id,
        name: playlist.name,
        creatorId: command.creatorId,
        operation: 'create_playlist'
      });

      this.logger.performance('create_playlist', duration, {
        playlistId: playlist.id,
        creatorId: command.creatorId
      });

      // Create security event for successful creation
      const successEvent = this.securityDomainService.createSecurityEvent(
        SecurityEventType.DATA_ACCESS,
        {
          action: 'playlist_creation_success',
          playlistId: playlist.id,
          name: playlist.name,
          creatorId: command.creatorId,
          isPublic: playlist.isPublic
        },
        creatorId
      );

      this.logger.audit('Playlist creation completed', {
        playlistId: playlist.id,
        creatorId: command.creatorId,
        event: successEvent
      });

      return playlist;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error('Playlist creation failed', error as Error, {
        name: command.name,
        creatorId: command.creatorId,
        operation: 'create_playlist'
      });

      this.logger.performance('create_playlist_failed', duration, {
        creatorId: command.creatorId
      });

      // Create security event for failed creation
      const failureEvent = this.securityDomainService.createSecurityEvent(
        SecurityEventType.SUSPICIOUS_ACTIVITY,
        {
          action: 'playlist_creation_failed',
          error: (error as Error).message,
          name: command.name,
          creatorId: command.creatorId
        },
        UserId.fromString(command.creatorId)
      );

      this.logger.security('Playlist creation failure', {
        creatorId: command.creatorId,
        event: failureEvent,
        error: (error as Error).message
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
    ];

    return suspiciousPatterns.some(pattern => pattern.test(text));
  }
}