/**
 * MusicDomainService
 * Encapsulates complex business logic related to music content (songs, albums, artists)
 */

import { Song } from '../entities/Song';
import { Album } from '../entities/Album';
import { Artist } from '../entities/Artist';
import { SongId } from '../entities/value-objects/SongId';
import { AlbumId } from '../entities/value-objects/AlbumId';
import { ArtistId } from '../entities/value-objects/ArtistId';
import { UserId } from '../entities/value-objects/UserId';
import { Genre } from '../entities/enums/Genre';
import { SongRepository } from '../repositories/SongRepository';
import { AlbumRepository } from '../repositories/AlbumRepository';
import { ArtistRepository } from '../repositories/ArtistRepository';

export class MusicDomainService {
  constructor(
    private readonly songRepository: SongRepository,
    private readonly albumRepository: AlbumRepository,
    private readonly artistRepository: ArtistRepository
  ) {}

  /**
   * Validates if a song can be added to an album
   */
  async validateSongAlbumAssignment(songId: SongId, albumId: AlbumId): Promise<void> {
    const [song, album] = await Promise.all([
      this.songRepository.findById(songId),
      this.albumRepository.findById(albumId)
    ]);

    if (!song) {
      throw new Error('Song not found');
    }

    if (!album) {
      throw new Error('Album not found');
    }

    // Check if song belongs to the same artist as the album
    if (!song.artistId.equals(album.artistId)) {
      throw new Error('Song and album must belong to the same artist');
    }

    // Check if song is already in another album
    if (song.albumId && !song.albumId.equals(albumId)) {
      throw new Error('Song is already assigned to another album');
    }

    // Check if album already has this song
    if (album.hasSong(songId)) {
      throw new Error('Song is already in this album');
    }

    // Check album capacity
    if (album.getSongCount() >= 50) { // Max songs per album
      throw new Error('Album has reached maximum song capacity');
    }
  }

  /**
   * Validates if an artist can create content
   */
  async validateArtistContentCreation(artistId: ArtistId, userId: UserId): Promise<Artist> {
    const artist = await this.artistRepository.findById(artistId);
    
    if (!artist) {
      throw new Error('Artist not found');
    }

    if (!artist.isOwnedBy(userId)) {
      throw new Error('User does not own this artist profile');
    }

    if (artist.deletedAt) {
      throw new Error('Cannot create content for deleted artist');
    }

    return artist;
  }

  /**
   * Calculates content similarity score between two songs
   */
  calculateSongSimilarity(song1: Song, song2: Song): number {
    let score = 0;

    // Genre match (40% weight)
    if (song1.metadata.genre === song2.metadata.genre) {
      score += 40;
    }

    // Same artist (30% weight)
    if (song1.artistId.equals(song2.artistId)) {
      score += 30;
    }

    // Duration similarity (10% weight)
    const durationDiff = Math.abs(song1.duration - song2.duration);
    const maxDuration = Math.max(song1.duration, song2.duration);
    const durationSimilarity = 1 - (durationDiff / maxDuration);
    score += durationSimilarity * 10;

    // Year similarity (10% weight)
    if (song1.metadata.year && song2.metadata.year) {
      const yearDiff = Math.abs(song1.metadata.year - song2.metadata.year);
      const yearSimilarity = Math.max(1 - (yearDiff / 10), 0); // 10-year range
      score += yearSimilarity * 10;
    }

    // Tag overlap (10% weight)
    const tags1 = new Set(song1.metadata.tags);
    const tags2 = new Set(song2.metadata.tags);
    const commonTags = [...tags1].filter(tag => tags2.has(tag));
    const totalTags = new Set([...tags1, ...tags2]).size;
    
    if (totalTags > 0) {
      const tagSimilarity = commonTags.length / totalTags;
      score += tagSimilarity * 10;
    }

    return Math.min(Math.round(score), 100);
  }

  /**
   * Determines if content should be automatically flagged for review
   */
  shouldFlagForReview(content: Song | Album, artist: Artist): boolean {
    // Flag content from unverified artists
    if (!artist.isVerified) {
      return true;
    }

    // Flag explicit content
    if (content instanceof Song && content.metadata.explicit) {
      return true;
    }

    // Flag content with suspicious titles
    const title = content.title.toLowerCase();
    const suspiciousKeywords = [
      'hate', 'violence', 'illegal', 'pirated', 'stolen',
      'copyright', 'dmca', 'takedown'
    ];

    if (suspiciousKeywords.some(keyword => title.includes(keyword))) {
      return true;
    }

    // Flag content from new artists (less than 30 days)
    const now = new Date();
    const artistAge = now.getTime() - artist.createdAt.getTime();
    const daysSinceCreation = artistAge / (1000 * 60 * 60 * 24);

    if (daysSinceCreation < 30) {
      return true;
    }

    return false;
  }

  /**
   * Calculates artist popularity score
   */
  calculateArtistPopularityScore(artist: Artist, additionalData?: {
    totalSongs?: number;
    totalAlbums?: number;
    totalPlays?: number;
    totalLikes?: number;
    recentActivity?: number; // days since last content
  }): number {
    let score = 0;

    // Verification bonus (20 points)
    if (artist.isVerified) {
      score += 20;
    }

    // Follower count (max 30 points)
    const followerScore = Math.min(artist.followerCount / 10000 * 30, 30);
    score += followerScore;

    // Monthly listeners (max 25 points)
    const listenerScore = Math.min(artist.monthlyListeners / 50000 * 25, 25);
    score += listenerScore;

    // Account age (max 10 points)
    const now = new Date();
    const accountAge = now.getTime() - artist.createdAt.getTime();
    const daysSinceCreation = Math.min(accountAge / (1000 * 60 * 60 * 24), 365);
    const ageScore = Math.min(daysSinceCreation / 365 * 10, 10);
    score += ageScore;

    // Additional data scoring (max 15 points)
    if (additionalData) {
      if (additionalData.totalSongs) {
        score += Math.min(additionalData.totalSongs / 20 * 5, 5);
      }
      
      if (additionalData.totalAlbums) {
        score += Math.min(additionalData.totalAlbums / 5 * 3, 3);
      }
      
      if (additionalData.totalPlays) {
        score += Math.min(additionalData.totalPlays / 100000 * 4, 4);
      }
      
      if (additionalData.totalLikes) {
        score += Math.min(additionalData.totalLikes / 10000 * 2, 2);
      }
      
      if (additionalData.recentActivity !== undefined) {
        const activityScore = Math.max(1 - (additionalData.recentActivity / 90), 0);
        score += activityScore * 1;
      }
    }

    return Math.min(Math.round(score), 100);
  }

  /**
   * Validates content metadata for security and quality
   */
  validateContentMetadata(metadata: {
    title?: string;
    description?: string;
    tags?: string[];
    genre?: Genre;
  }): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Title validation
    if (metadata.title) {
      if (metadata.title.length > 200) {
        issues.push('Title is too long (max 200 characters)');
      }

      if (this.containsProfanity(metadata.title)) {
        issues.push('Title contains inappropriate language');
      }

      if (this.containsCopyrightClaims(metadata.title)) {
        issues.push('Title may contain copyrighted content');
      }
    }

    // Description validation
    if (metadata.description) {
      if (metadata.description.length > 1000) {
        issues.push('Description is too long (max 1000 characters)');
      }

      if (this.containsProfanity(metadata.description)) {
        issues.push('Description contains inappropriate language');
      }
    }

    // Tags validation
    if (metadata.tags) {
      if (metadata.tags.length > 10) {
        issues.push('Too many tags (max 10)');
      }

      const inappropriateTags = metadata.tags.filter(tag => 
        this.containsProfanity(tag) || this.isSpamTag(tag)
      );

      if (inappropriateTags.length > 0) {
        issues.push(`Inappropriate tags: ${inappropriateTags.join(', ')}`);
      }
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Generates content recommendations based on user preferences
   */
  generateContentRecommendations(
    userPreferences: {
      favoriteGenres: Genre[];
      recentlyPlayed: SongId[];
      likedArtists: ArtistId[];
    },
    contentPool: Song[]
  ): Song[] {
    const scoredContent = contentPool.map(song => {
      let score = 0;

      // Genre preference match (40% weight)
      if (userPreferences.favoriteGenres.includes(song.metadata.genre)) {
        score += 40;
      }

      // Artist preference match (30% weight)
      if (userPreferences.likedArtists.some(artistId => artistId.equals(song.artistId))) {
        score += 30;
      }

      // Popularity boost (20% weight)
      const popularityScore = Math.min(song.playCount / 10000 * 20, 20);
      score += popularityScore;

      // Recency boost (10% weight)
      const now = new Date();
      const daysSinceCreation = (now.getTime() - song.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.max(10 - (daysSinceCreation / 30), 0);
      score += recencyScore;

      // Penalty for recently played content
      if (userPreferences.recentlyPlayed.some(songId => songId.equals(song.id))) {
        score *= 0.5;
      }

      return { song, score };
    });

    return scoredContent
      .sort((a, b) => b.score - a.score)
      .slice(0, 50) // Return top 50 recommendations
      .map(item => item.song);
  }

  /**
   * Validates file upload for songs
   */
  validateSongFile(file: {
    size: number;
    mimetype: string;
    originalname: string;
  }): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    // File size validation (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      issues.push('File size exceeds 50MB limit');
    }

    // MIME type validation
    const allowedMimeTypes = [
      'audio/mpeg',
      'audio/wav',
      'audio/flac',
      'audio/aac',
      'audio/mp4'
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      issues.push('Invalid file type. Allowed: MP3, WAV, FLAC, AAC, M4A');
    }

    // File extension validation
    const allowedExtensions = ['.mp3', '.wav', '.flac', '.aac', '.m4a'];
    const fileExtension = file.originalname.toLowerCase().split('.').pop();
    
    if (!fileExtension || !allowedExtensions.includes(`.${fileExtension}`)) {
      issues.push('Invalid file extension');
    }

    // Filename validation
    if (file.originalname.length > 255) {
      issues.push('Filename is too long');
    }

    if (this.containsSuspiciousPatterns(file.originalname)) {
      issues.push('Filename contains invalid characters');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  // Private helper methods
  private containsProfanity(text: string): boolean {
    const profanityWords = [
      // Add profanity filter words here
      'badword1', 'badword2' // Placeholder
    ];

    const lowerText = text.toLowerCase();
    return profanityWords.some(word => lowerText.includes(word));
  }

  private containsCopyrightClaims(text: string): boolean {
    const copyrightIndicators = [
      'official', 'original', 'cover version', 'remix of',
      'feat.', 'featuring', '(c)', 'copyright', '©'
    ];

    const lowerText = text.toLowerCase();
    return copyrightIndicators.some(indicator => lowerText.includes(indicator));
  }

  private isSpamTag(tag: string): boolean {
    const spamPatterns = [
      /^.{1,2}$/, // Too short
      /(.)\1{3,}/, // Repeated characters
      /^\d+$/, // Only numbers
      /free|download|click|visit|www\./i // Spam keywords
    ];

    return spamPatterns.some(pattern => pattern.test(tag));
  }

  private containsSuspiciousPatterns(text: string): boolean {
    const suspiciousPatterns = [
      /\.\./,           // Directory traversal
      /[<>|]/,          // Invalid filename characters
      /\0/,             // Null bytes
      /script/i,        // Script injection attempts
    ];

    return suspiciousPatterns.some(pattern => pattern.test(text));
  }
}