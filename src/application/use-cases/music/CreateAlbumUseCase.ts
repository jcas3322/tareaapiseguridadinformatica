/**
 * CreateAlbumUseCase
 * Handles album creation with ownership verification
 */

import { Album } from '../../../domain/entities/Album';
import { ArtistId } from '../../../domain/entities/value-objects/ArtistId';
import { UserId } from '../../../domain/entities/value-objects/UserId';
import { AlbumRepository } from '../../../domain/repositories/AlbumRepository';
import { ArtistRepository } from '../../../domain/repositories/ArtistRepository';
import { UserRepository } from '../../../domain/repositories/UserRepository';
import { MusicDomainService } from '../../../domain/services/MusicDomainService';
import { SecurityDomainService, SecurityEventType } from '../../../domain/services/SecurityDomainService';
import { EventPublisher, DomainEventBuilder } from '../../ports/EventPublisher';
import { Logger } from '../../ports/Logger';
import { CreateAlbumCommand, CreateAlbumCommandValidator } from '../../dto/music/CreateAlbumCommand';
import { AlbumDto, AlbumDtoMapper } from '../../dto/music/AlbumDto';
import { v4 as uuidv4 } from 'uuid';

export class CreateAlbumUseCase {
  constructor(
    private readonly albumRepository: AlbumRepository,
    private readonly artistRepository: ArtistRepository,
    private readonly userRepository: UserRepository,
    private readonly musicDomainService: MusicDomainService,
    private readonly securityDomainService: SecurityDomainService,
    private readonly eventPublisher: EventPublisher,
    private readonly logger: Logger
  ) {}

  public async execute(command: CreateAlbumCommand): Promise<AlbumDto> {
    const startTime = Date.now();
    
    try {
      // Validate command
      CreateAlbumCommandValidator.validate(command);

      // Log album creation attempt
      this.logger.info('Album creation attempt', {
        title: command.title,
        artistId: command.artistId,
        creatorId: command.creatorId,
        operation: 'create_album'
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

      // Validate artist and ownership
      const artistId = ArtistId.fromString(command.artistId);
      const artist = await this.musicDomainService.validateArtistContentCreation(artistId, creatorId);

      // Check for duplicate album titles by artist
      const existingTitle = await this.albumRepository.existsByTitleForArtist(
        command.title, 
        artistId
      );

      if (existingTitle) {
        throw new Error('An album with this title already exists for this artist');
      }

      // Validate content metadata
      const metadataValidation = this.musicDomainService.validateContentMetadata({
        title: command.title,
        description: command.description,
        genre: command.genre as any
      });

      if (!metadataValidation.isValid) {
        throw new Error(`Content validation failed: ${metadataValidation.issues.join(', ')}`);
      }

      // Create album entity
      const album = Album.create({
        title: command.title,
        artistId,
        description: command.description || '',
        genre: command.genre,
        releaseDate: command.releaseDate,
        coverImageUrl: command.coverImageUrl,
        isPublic: command.isPublic
      });

      // Check if content should be flagged for review
      const shouldFlag = this.musicDomainService.shouldFlagForReview(album, artist);
      if (shouldFlag) {
        this.logger.warn('Album flagged for review', {
          albumId: album.id.value,
          creatorId: command.creatorId,
          artistId: command.artistId,
          operation: 'create_album'
        });

        // Create security event
        const flagEvent = this.securityDomainService.createSecurityEvent(
          SecurityEventType.CONTENT_FLAGGED,
          {
            action: 'album_creation_flagged',
            albumId: album.id.value,
            title: command.title,
            artistId: command.artistId,
            creatorId: command.creatorId,
            reason: 'automatic_review_required'
          },
          creatorId
        );

        this.logger.security('Content flagged for review', {
          albumId: album.id.value,
          event: flagEvent
        });
      }

      // Save album to repository
      const savedAlbum = await this.albumRepository.save(album);

      // Create domain event
      const domainEvent = new DomainEventBuilder()
        .setEventId(uuidv4())
        .setEventType('AlbumCreated')
        .setAggregateId(savedAlbum.id.value)
        .setAggregateType('Album')
        .setEventData({
          albumId: savedAlbum.id.value,
          title: savedAlbum.title,
          artistId: savedAlbum.artistId.value,
          creatorId: command.creatorId,
          genre: savedAlbum.genre,
          releaseDate: savedAlbum.releaseDate,
          isPublic: savedAlbum.isPublic,
          flaggedForReview: shouldFlag
        })
        .setOccurredAt(new Date())
        .setVersion(1)
        .build();

      // Publish event
      await this.eventPublisher.publish(domainEvent);

      // Log successful creation
      const duration = Date.now() - startTime;
      this.logger.info('Album created successfully', {
        albumId: savedAlbum.id.value,
        title: savedAlbum.title,
        artistId: command.artistId,
        creatorId: command.creatorId,
        operation: 'create_album'
      });

      this.logger.performance('create_album', duration, {
        albumId: savedAlbum.id.value,
        creatorId: command.creatorId
      });

      // Create security event for successful creation
      const successEvent = this.securityDomainService.createSecurityEvent(
        SecurityEventType.DATA_ACCESS,
        {
          action: 'album_creation_success',
          albumId: savedAlbum.id.value,
          title: savedAlbum.title,
          artistId: command.artistId,
          creatorId: command.creatorId
        },
        creatorId
      );

      this.logger.audit('Album creation completed', {
        albumId: savedAlbum.id.value,
        creatorId: command.creatorId,
        event: successEvent
      });

      // Convert to DTO and return
      return AlbumDtoMapper.toDto(savedAlbum);

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error('Album creation failed', error as Error, {
        title: command.title,
        artistId: command.artistId,
        creatorId: command.creatorId,
        operation: 'create_album'
      });

      this.logger.performance('create_album_failed', duration, {
        creatorId: command.creatorId,
        artistId: command.artistId
      });

      // Create security event for failed creation
      const failureEvent = this.securityDomainService.createSecurityEvent(
        SecurityEventType.SUSPICIOUS_ACTIVITY,
        {
          action: 'album_creation_failed',
          error: (error as Error).message,
          title: command.title,
          artistId: command.artistId,
          creatorId: command.creatorId
        },
        UserId.fromString(command.creatorId)
      );

      this.logger.security('Album creation failure', {
        creatorId: command.creatorId,
        event: failureEvent,
        error: (error as Error).message
      });

      throw error;
    }
  }
}