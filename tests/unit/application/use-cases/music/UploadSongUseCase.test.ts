/**
 * UploadSongUseCase Unit Tests
 */

import { UploadSongUseCase, FileStorageService } from '../../../../../src/application/use-cases/music/UploadSongUseCase';
import { Song } from '../../../../../src/domain/entities/Song';
import { Artist } from '../../../../../src/domain/entities/Artist';
import { User } from '../../../../../src/domain/entities/User';
import { UserRole } from '../../../../../src/domain/entities/enums/UserRole';
import { SongRepository } from '../../../../../src/domain/repositories/SongRepository';
import { ArtistRepository } from '../../../../../src/domain/repositories/ArtistRepository';
import { AlbumRepository } from '../../../../../src/domain/repositories/AlbumRepository';
import { UserRepository } from '../../../../../src/domain/repositories/UserRepository';
import { MusicDomainService } from '../../../../../src/domain/services/MusicDomainService';
import { SecurityDomainService } from '../../../../../src/domain/services/SecurityDomainService';
import { EventPublisher } from '../../../../../src/application/ports/EventPublisher';
import { Logger } from '../../../../../src/application/ports/Logger';
import { UploadSongCommand } from '../../../../../src/application/dto/music/UploadSongCommand';

describe('UploadSongUseCase', () => {
  let useCase: UploadSongUseCase;
  let mockSongRepository: jest.Mocked<SongRepository>;
  let mockArtistRepository: jest.Mocked<ArtistRepository>;
  let mockAlbumRepository: jest.Mocked<AlbumRepository>;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockMusicDomainService: jest.Mocked<MusicDomainService>;
  let mockSecurityDomainService: jest.Mocked<SecurityDomainService>;
  let mockFileStorageService: jest.Mocked<FileStorageService>;
  let mockEventPublisher: jest.Mocked<EventPublisher>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockSongRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findMany: jest.fn(),
      findByArtist: jest.fn(),
      findByAlbum: jest.fn(),
      findPublic: jest.fn(),
      findByGenre: jest.fn(),
      findPopular: jest.fn(),
      findTrending: jest.fn(),
      findRecent: jest.fn(),
      findByTags: jest.fn(),
      findByDurationRange: jest.fn(),
      findByYear: jest.fn(),
      existsByTitleForArtist: jest.fn(),
      count: jest.fn(),
      countPublic: jest.fn(),
      countByArtist: jest.fn(),
      countByGenre: jest.fn(),
      countByYear: jest.fn(),
      incrementPlayCount: jest.fn(),
      incrementLikeCount: jest.fn(),
      decrementLikeCount: jest.fn(),
      getTotalPlayTimeByArtist: jest.fn(),
      getMostPlayedByArtist: jest.fn(),
      findByCreatedDateRange: jest.fn(),
      softDelete: jest.fn(),
      hardDelete: jest.fn(),
      restore: jest.fn(),
      bulkSave: jest.fn(),
      bulkUpdatePlayCounts: jest.fn(),
      bulkSoftDelete: jest.fn(),
      bulkAssignToAlbum: jest.fn(),
      bulkRemoveFromAlbum: jest.fn(),
      search: jest.fn(),
      findSimilar: jest.fn(),
      getStatistics: jest.fn(),
      findWithoutAlbum: jest.fn(),
      findRandom: jest.fn()
    };

    mockArtistRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      findMany: jest.fn(),
      findByGenre: jest.fn(),
      findVerified: jest.fn(),
      findPopular: jest.fn(),
      findTrending: jest.fn(),
      existsByNameForDifferentUser: jest.fn(),
      count: jest.fn(),
      countVerified: jest.fn(),
      countByGenre: jest.fn(),
      findTopInGenre: jest.fn(),
      findByCreatedDateRange: jest.fn(),
      updateFollowerCount: jest.fn(),
      updateMonthlyListeners: jest.fn(),
      incrementFollowers: jest.fn(),
      decrementFollowers: jest.fn(),
      softDelete: jest.fn(),
      hardDelete: jest.fn(),
      restore: jest.fn(),
      bulkSave: jest.fn(),
      bulkUpdateFollowerCounts: jest.fn(),
      bulkSoftDelete: jest.fn(),
      search: jest.fn(),
      findSimilar: jest.fn(),
      getStatistics: jest.fn()
    };

    mockAlbumRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findMany: jest.fn(),
      findByArtist: jest.fn(),
      findPublic: jest.fn(),
      findByGenre: jest.fn(),
      findByReleaseYear: jest.fn(),
      findPopular: jest.fn(),
      findTrending: jest.fn(),
      findRecentlyReleased: jest.fn(),
      findRecentlyAdded: jest.fn(),
      findContainingSong: jest.fn(),
      existsByTitleForArtist: jest.fn(),
      count: jest.fn(),
      countPublic: jest.fn(),
      countByArtist: jest.fn(),
      countByGenre: jest.fn(),
      countByReleaseYear: jest.fn(),
      incrementPlayCount: jest.fn(),
      incrementLikeCount: jest.fn(),
      decrementLikeCount: jest.fn(),
      updateTotalDuration: jest.fn(),
      addSong: jest.fn(),
      removeSong: jest.fn(),
      reorderSongs: jest.fn(),
      findWithMostSongs: jest.fn(),
      findEmpty: jest.fn(),
      findByCreatedDateRange: jest.fn(),
      findByReleaseDateRange: jest.fn(),
      softDelete: jest.fn(),
      hardDelete: jest.fn(),
      restore: jest.fn(),
      bulkSave: jest.fn(),
      bulkUpdatePlayCounts: jest.fn(),
      bulkSoftDelete: jest.fn(),
      bulkAddSongs: jest.fn(),
      bulkRemoveSongs: jest.fn(),
      search: jest.fn(),
      findSimilar: jest.fn(),
      getStatistics: jest.fn(),
      findByArtistWithSongCounts: jest.fn(),
      findRandom: jest.fn(),
      findCompilations: jest.fn()
    };

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

    mockMusicDomainService = {
      validateSongAlbumAssignment: jest.fn(),
      validateArtistContentCreation: jest.fn(),
      calculateSongSimilarity: jest.fn(),
      shouldFlagForReview: jest.fn(),
      calculateArtistPopularityScore: jest.fn(),
      validateContentMetadata: jest.fn(),
      generateContentRecommendations: jest.fn(),
      validateSongFile: jest.fn()
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

    mockFileStorageService = {
      saveFile: jest.fn(),
      deleteFile: jest.fn(),
      getFileUrl: jest.fn()
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

    useCase = new UploadSongUseCase(
      mockSongRepository,
      mockArtistRepository,
      mockAlbumRepository,
      mockUserRepository,
      mockMusicDomainService,
      mockSecurityDomainService,
      mockFileStorageService,
      mockEventPublisher,
      mockLogger
    );
  });

  describe('execute', () => {
    const validCommand: UploadSongCommand = {
      title: 'Test Song',
      duration: 180,
      artistId: '123e4567-e89b-12d3-a456-426614174000',
      genre: 'rock',
      explicit: false,
      tags: ['rock', 'indie'],
      isPublic: true,
      file: {
        originalname: 'test-song.mp3',
        mimetype: 'audio/mpeg',
        size: 5000000,
        buffer: Buffer.from('fake audio data')
      },
      uploaderId: '123e4567-e89b-12d3-a456-426614174001'
    };

    let mockUser: User;
    let mockArtist: Artist;

    beforeEach(() => {
      mockUser = User.create({
        email: 'artist@example.com',
        username: 'artist',
        hashedPassword: '$2b$12$hashedpassword',
        role: UserRole.USER
      });

      mockArtist = Artist.create({
        userId: mockUser.id,
        artistName: 'Test Artist',
        biography: 'Test biography',
        genres: ['rock']
      });
    });

    it('should successfully upload a song', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockMusicDomainService.validateArtistContentCreation.mockResolvedValue(mockArtist);
      mockSecurityDomainService.validateFileUpload.mockReturnValue({
        safe: true,
        issues: []
      });
      mockMusicDomainService.validateSongFile.mockReturnValue({
        isValid: true,
        issues: []
      });
      mockSongRepository.existsByTitleForArtist.mockResolvedValue(false);
      mockMusicDomainService.validateContentMetadata.mockReturnValue({
        isValid: true,
        issues: []
      });
      mockFileStorageService.saveFile.mockResolvedValue('/uploads/test-song-123.mp3');
      mockMusicDomainService.shouldFlagForReview.mockReturnValue(false);
      
      const mockSong = Song.create({
        title: validCommand.title,
        duration: validCommand.duration,
        artistId: mockArtist.id,
        filePath: '/uploads/test-song-123.mp3',
        metadata: {
          genre: 'rock' as any,
          explicit: false,
          tags: ['rock', 'indie'],
          fileSize: 5000000,
          format: 'mpeg'
        },
        isPublic: true
      });
      
      mockSongRepository.save.mockResolvedValue(mockSong);
      mockSecurityDomainService.createSecurityEvent.mockReturnValue({
        eventId: 'event-id',
        eventType: 'FILE_UPLOAD',
        aggregateId: mockSong.id.value,
        aggregateType: 'Song',
        eventData: {},
        occurredAt: new Date(),
        version: 1
      });

      // Act
      const result = await useCase.execute(validCommand);

      // Assert
      expect(result).toBeDefined();
      expect(result.title).toBe(validCommand.title);
      expect(result.duration).toBe(validCommand.duration);
      expect(result.isPublic).toBe(true);
      expect(mockFileStorageService.saveFile).toHaveBeenCalledTimes(1);
      expect(mockSongRepository.save).toHaveBeenCalledTimes(1);
      expect(mockEventPublisher.publish).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Song uploaded successfully',
        expect.objectContaining({
          title: validCommand.title
        })
      );
    });

    it('should throw error for non-existent uploader', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(useCase.execute(validCommand)).rejects.toThrow('Uploader not found');
      expect(mockFileStorageService.saveFile).not.toHaveBeenCalled();
      expect(mockSongRepository.save).not.toHaveBeenCalled();
    });

    it('should throw error for inactive uploader', async () => {
      // Arrange
      const inactiveUser = mockUser.deactivate();
      mockUserRepository.findById.mockResolvedValue(inactiveUser);

      // Act & Assert
      await expect(useCase.execute(validCommand)).rejects.toThrow('Uploader account is not active');
      expect(mockFileStorageService.saveFile).not.toHaveBeenCalled();
      expect(mockSongRepository.save).not.toHaveBeenCalled();
    });

    it('should throw error for unsafe file', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockMusicDomainService.validateArtistContentCreation.mockResolvedValue(mockArtist);
      mockSecurityDomainService.validateFileUpload.mockReturnValue({
        safe: false,
        issues: ['File contains malicious content']
      });

      // Act & Assert
      await expect(useCase.execute(validCommand)).rejects.toThrow('File validation failed: File contains malicious content');
      expect(mockFileStorageService.saveFile).not.toHaveBeenCalled();
      expect(mockSongRepository.save).not.toHaveBeenCalled();
    });

    it('should throw error for duplicate song title', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockMusicDomainService.validateArtistContentCreation.mockResolvedValue(mockArtist);
      mockSecurityDomainService.validateFileUpload.mockReturnValue({
        safe: true,
        issues: []
      });
      mockMusicDomainService.validateSongFile.mockReturnValue({
        isValid: true,
        issues: []
      });
      mockSongRepository.existsByTitleForArtist.mockResolvedValue(true);

      // Act & Assert
      await expect(useCase.execute(validCommand)).rejects.toThrow('A song with this title already exists for this artist');
      expect(mockFileStorageService.saveFile).not.toHaveBeenCalled();
      expect(mockSongRepository.save).not.toHaveBeenCalled();
    });

    it('should flag content for review when appropriate', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockMusicDomainService.validateArtistContentCreation.mockResolvedValue(mockArtist);
      mockSecurityDomainService.validateFileUpload.mockReturnValue({
        safe: true,
        issues: []
      });
      mockMusicDomainService.validateSongFile.mockReturnValue({
        isValid: true,
        issues: []
      });
      mockSongRepository.existsByTitleForArtist.mockResolvedValue(false);
      mockMusicDomainService.validateContentMetadata.mockReturnValue({
        isValid: true,
        issues: []
      });
      mockFileStorageService.saveFile.mockResolvedValue('/uploads/test-song-123.mp3');
      mockMusicDomainService.shouldFlagForReview.mockReturnValue(true);
      
      const mockSong = Song.create({
        title: validCommand.title,
        duration: validCommand.duration,
        artistId: mockArtist.id,
        filePath: '/uploads/test-song-123.mp3',
        metadata: {
          genre: 'rock' as any,
          explicit: false,
          tags: ['rock', 'indie'],
          fileSize: 5000000,
          format: 'mpeg'
        },
        isPublic: true
      });
      
      mockSongRepository.save.mockResolvedValue(mockSong);
      mockSecurityDomainService.createSecurityEvent.mockReturnValue({
        eventId: 'event-id',
        eventType: 'CONTENT_FLAGGED',
        aggregateId: mockSong.id.value,
        aggregateType: 'Song',
        eventData: {},
        occurredAt: new Date(),
        version: 1
      });

      // Act
      await useCase.execute(validCommand);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Song flagged for review',
        expect.objectContaining({
          songId: mockSong.id.value
        })
      );
      expect(mockLogger.security).toHaveBeenCalledWith(
        'Content flagged for review',
        expect.any(Object)
      );
    });

    it('should cleanup file on error', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockMusicDomainService.validateArtistContentCreation.mockResolvedValue(mockArtist);
      mockSecurityDomainService.validateFileUpload.mockReturnValue({
        safe: true,
        issues: []
      });
      mockMusicDomainService.validateSongFile.mockReturnValue({
        isValid: true,
        issues: []
      });
      mockSongRepository.existsByTitleForArtist.mockResolvedValue(false);
      mockMusicDomainService.validateContentMetadata.mockReturnValue({
        isValid: true,
        issues: []
      });
      mockFileStorageService.saveFile.mockResolvedValue('/uploads/test-song-123.mp3');
      mockSongRepository.save.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(useCase.execute(validCommand)).rejects.toThrow('Database error');
      expect(mockFileStorageService.deleteFile).toHaveBeenCalledWith('/uploads/test-song-123.mp3');
    });
  });
});