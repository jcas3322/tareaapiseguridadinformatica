/**
 * UploadSongUseCase
 * Handles song uploads with security validations and file processing
 */

import { Song } from '../../../domain/entities/Song';
import { SongId } from '../../../domain/entities/value-objects/SongId';
import { ArtistId } from '../../../domain/entities/value-objects/ArtistId';
import { AlbumId } from '../../../domain/entities/value-objects/AlbumId';
import { UserId } from '../../../domain/entities/value-objects/UserId';
import { SongRepository } from '../../../domain/repositories/SongRepository';
import { ArtistRepository } from '../../../domain/repositories/ArtistRepository';
import { AlbumRepository } from '../../../domain/repositories/AlbumRepository';
import { UserRepository } from '../../../domain/repositories/UserRepository';
import { MusicDomainService } from '../../../domain/services/MusicDomainService';
import { SecurityDomainService, SecurityEventType } from '../../../domain/services/SecurityDomainService';
import { EventPublisher, DomainEventBuilder } from '../../ports/EventPublisher';
import { Logger } from '../../ports/Logger';
import { UploadSongCommand, UploadSongCommandValidator } from '../../dto/music/UploadSongCommand';
import { SongDto, SongDtoMapper } from '../../dto/music/SongDto';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as crypto from 'crypto';

export interface FileStorageService {
  saveFile(buffer: Buffer, filename: string, metadata: Record<string, unknown>): Promise<string>;
  deleteFile(filePath: string): Promise<void>;
  getFileUrl(filePath: string): string;
}

export class UploadSongUseCase {
  constructor(
    private readonly songRepository: SongRepository,
    private readonly artistRepository: ArtistRepository,
    private readonly albumRepository: AlbumRepository,
    private readonly userRepository: UserRepository,
    private readonly musicDomainService: MusicDomainService,
    private readonly securityDomainService: SecurityDomainService,
    private readonly fileStorageService: FileStorageService,
    private readonly eventPublisher: EventPublisher,
    private readonly logger: Logger
  ) {}

  public async execute(command: UploadSongCommand): Promise<SongDto> {
    const startTime = Date.now();
    let savedFilePath: string | undefined;
    
    try {
      // Validate command
      UploadSongCommandValidator.validate(command);

      // Log upload attempt
      this.logger.info('Song upload attempt', {
        title: command.title,
        artistId: command.artistId,
        uploaderId: command.uploaderId,
        fileSize: command.file.size,
        operation: 'upload_song'
      });

      // Find uploader
      const uploaderId = UserId.fromString(command.uploaderId);
      const uploader = await this.userRepository.findById(uploaderId);

      if (!uploader) {
        throw new Error('Uploader not found');
      }

      if (!uploader.isActive || uploader.deletedAt) {
        throw new Error('Uploader account is not active');
      }

      // Validate artist and ownership
      const artistId = ArtistId.fromString(command.artistId);
      const artist = await this.musicDomainService.validateArtistContentCreation(artistId, uploaderId);

      // Validate album if provided
      let album = null;
      if (command.albumId) {
        const albumId = AlbumId.fromString(command.albumId);
        album = await this.albumRepository.findById(albumId);
        
        if (!album) {
          throw new Error('Album not found');
        }

        if (!album.isOwnedBy(artistId)) {
          throw new Error('Album does not belong to the specified artist');
        }
      }

      // Validate file security
      const fileValidation = this.securityDomainService.validateFileUpload(command.file);
      if (!fileValidation.safe) {
        this.logger.warn('Unsafe file upload attempt', {
          uploaderId: command.uploaderId,
          artistId: command.artistId,
          issues: fileValidation.issues,
          operation: 'upload_song'
        });

        throw new Error(`File validation failed: ${fileValidation.issues.join(', ')}`);
      }

      // Additional music file validation
      const musicFileValidation = this.musicDomainService.validateSongFile(command.file);
      if (!musicFileValidation.isValid) {
        throw new Error(`Invalid music file: ${musicFileValidation.issues.join(', ')}`);
      }

      // Check for duplicate song titles by artist
      const existingTitle = await this.songRepository.existsByTitleForArtist(
        command.title, 
        artistId
      );

      if (existingTitle) {
        throw new Error('A song with this title already exists for this artist');
      }

      // Validate content metadata
      const metadataValidation = this.musicDomainService.validateContentMetadata({
        title: command.title,
        tags: command.tags,
        genre: command.genre as any
      });

      if (!metadataValidation.isValid) {
        throw new Error(`Content validation failed: ${metadataValidation.issues.join(', ')}`);
      }

      // Generate secure filename
      const fileExtension = path.extname(command.file.originalname);
      const secureFilename = this.generateSecureFilename(command.title, fileExtension);

      // Save file to storage
      savedFilePath = await this.fileStorageService.saveFile(
        command.file.buffer!,
        secureFilename,
        {
          uploaderId: command.uploaderId,
          artistId: command.artistId,
          title: command.title,
          originalName: command.file.originalname,
          mimeType: command.file.mimetype,
          size: command.file.size
        }
      );

      // Create song metadata
      const songMetadata = {
        genre: command.genre as any,
        year: command.year,
        bpm: command.bpm,
        key: command.key,
        explicit: command.explicit,
        language: command.language,
        tags: command.tags,
        fileSize: command.file.size,
        format: command.file.mimetype.split('/')[1] || 'unknown'
      };

      // Create song entity
      const song = Song.create({
        title: command.title,
        duration: command.duration,
        artistId,
        filePath: savedFilePath,
        metadata: songMetadata,
        albumId: album ? AlbumId.fromString(command.albumId!) : undefined,
        isPublic: command.isPublic
      });

      // Check if content should be flagged for review
      const shouldFlag = this.musicDomainService.shouldFlagForReview(song, artist);
      if (shouldFlag) {
        this.logger.warn('Song flagged for review', {
          songId: song.id.value,
          uploaderId: command.uploaderId,
          artistId: command.artistId,
          operation: 'upload_song'
        });

        // Create security event
        const flagEvent = this.securityDomainService.createSecurityEvent(
          SecurityEventType.CONTENT_FLAGGED,
          {
            action: 'song_upload_flagged',
            songId: song.id.value,
            title: command.title,
            artistId: command.artistId,
            uploaderId: command.uploaderId,
            reason: 'automatic_review_required'
          },
          uploaderId
        );

        this.logger.security('Content flagged for review', {
          songId: song.id.value,
          event: flagEvent
        });
      }

      // Save song to repository
      const savedSong = await this.songRepository.save(song);

      // Add song to album if specified
      if (album && savedSong.albumId) {
        const updatedAlbum = album.addSong(savedSong.id, savedSong.duration);
        await this.albumRepository.save(updatedAlbum);
      }

      // Create domain event
      const domainEvent = new DomainEventBuilder()
        .setEventId(uuidv4())
        .setEventType('SongUploaded')
        .setAggregateId(savedSong.id.value)
        .setAggregateType('Song')
        .setEventData({
          songId: savedSong.id.value,
          title: savedSong.title,
          artistId: savedSong.artistId.value,
          albumId: savedSong.albumId?.value,
          uploaderId: command.uploaderId,
          isPublic: savedSong.isPublic,
          flaggedForReview: shouldFlag,
          fileSize: command.file.size,
          duration: savedSong.duration
        })
        .setOccurredAt(new Date())
        .setVersion(1)
        .build();

      // Publish event
      await this.eventPublisher.publish(domainEvent);

      // Log successful upload
      const duration = Date.now() - startTime;
      this.logger.info('Song uploaded successfully', {
        songId: savedSong.id.value,
        title: savedSong.title,
        artistId: command.artistId,
        uploaderId: command.uploaderId,
        operation: 'upload_song'
      });

      this.logger.performance('upload_song', duration, {
        songId: savedSong.id.value,
        uploaderId: command.uploaderId
      });

      // Create security event for successful upload
      const successEvent = this.securityDomainService.createSecurityEvent(
        SecurityEventType.FILE_UPLOAD,
        {
          action: 'song_upload_success',
          songId: savedSong.id.value,
          title: savedSong.title,
          artistId: command.artistId,
          uploaderId: command.uploaderId,
          fileSize: command.file.size,
          filePath: savedFilePath
        },
        uploaderId
      );

      this.logger.audit('Song upload completed', {
        songId: savedSong.id.value,
        uploaderId: command.uploaderId,
        event: successEvent
      });

      // Convert to DTO and return
      return SongDtoMapper.toDto(savedSong);

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Clean up uploaded file if it exists
      if (savedFilePath) {
        try {
          await this.fileStorageService.deleteFile(savedFilePath);
        } catch (cleanupError) {
          this.logger.error('Failed to cleanup uploaded file', cleanupError as Error, {
            filePath: savedFilePath,
            operation: 'upload_song_cleanup'
          });
        }
      }

      this.logger.error('Song upload failed', error as Error, {
        title: command.title,
        artistId: command.artistId,
        uploaderId: command.uploaderId,
        operation: 'upload_song'
      });

      this.logger.performance('upload_song_failed', duration, {
        uploaderId: command.uploaderId,
        artistId: command.artistId
      });

      // Create security event for failed upload
      const failureEvent = this.securityDomainService.createSecurityEvent(
        SecurityEventType.FILE_UPLOAD,
        {
          action: 'song_upload_failed',
          error: (error as Error).message,
          title: command.title,
          artistId: command.artistId,
          uploaderId: command.uploaderId,
          fileSize: command.file.size
        },
        UserId.fromString(command.uploaderId)
      );

      this.logger.security('Song upload failure', {
        uploaderId: command.uploaderId,
        event: failureEvent,
        error: (error as Error).message
      });

      throw error;
    }
  }

  private generateSecureFilename(title: string, extension: string): string {
    // Create a secure filename based on title and random hash
    const sanitizedTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);

    const randomHash = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();

    return `${sanitizedTitle}-${timestamp}-${randomHash}${extension}`;
  }
}