/**
 * SongRepository Interface
 * Defines the contract for song data persistence
 */

import { Song } from '../entities/Song';
import { SongId } from '../entities/value-objects/SongId';
import { ArtistId } from '../entities/value-objects/ArtistId';
import { AlbumId } from '../entities/value-objects/AlbumId';
import { Genre } from '../entities/enums/Genre';
import { PaginatedResult, PaginationOptions } from './types/PaginatedResult';
import { SongFilters, SortOptions } from './types/FilterOptions';

export interface SongRepository {
  /**
   * Save a song (create or update)
   */
  save(song: Song): Promise<Song>;

  /**
   * Find song by ID
   */
  findById(id: SongId): Promise<Song | null>;

  /**
   * Find songs with pagination and filtering
   */
  findMany(
    filters?: SongFilters,
    pagination?: PaginationOptions,
    sort?: SortOptions
  ): Promise<PaginatedResult<Song>>;

  /**
   * Find songs by artist
   */
  findByArtist(
    artistId: ArtistId,
    pagination?: PaginationOptions,
    includePrivate?: boolean
  ): Promise<PaginatedResult<Song>>;

  /**
   * Find songs by album
   */
  findByAlbum(
    albumId: AlbumId,
    includePrivate?: boolean
  ): Promise<Song[]>;

  /**
   * Find public songs
   */
  findPublic(
    filters?: SongFilters,
    pagination?: PaginationOptions,
    sort?: SortOptions
  ): Promise<PaginatedResult<Song>>;

  /**
   * Find songs by genre
   */
  findByGenre(
    genre: Genre,
    pagination?: PaginationOptions,
    includePrivate?: boolean
  ): Promise<PaginatedResult<Song>>;

  /**
   * Find popular songs (by play count)
   */
  findPopular(
    limit?: number,
    genre?: Genre,
    timeRange?: 'day' | 'week' | 'month' | 'year' | 'all'
  ): Promise<Song[]>;

  /**
   * Find trending songs (by recent play count increase)
   */
  findTrending(
    limit?: number,
    genre?: Genre
  ): Promise<Song[]>;

  /**
   * Find recently added songs
   */
  findRecent(
    limit?: number,
    genre?: Genre,
    includePrivate?: boolean
  ): Promise<Song[]>;

  /**
   * Find songs by tags
   */
  findByTags(
    tags: string[],
    pagination?: PaginationOptions,
    includePrivate?: boolean
  ): Promise<PaginatedResult<Song>>;

  /**
   * Find songs by duration range
   */
  findByDurationRange(
    minDuration: number,
    maxDuration: number,
    pagination?: PaginationOptions,
    includePrivate?: boolean
  ): Promise<PaginatedResult<Song>>;

  /**
   * Find songs by year
   */
  findByYear(
    year: number,
    pagination?: PaginationOptions,
    includePrivate?: boolean
  ): Promise<PaginatedResult<Song>>;

  /**
   * Check if song title exists for artist
   */
  existsByTitleForArtist(title: string, artistId: ArtistId, excludeSongId?: SongId): Promise<boolean>;

  /**
   * Count total songs
   */
  count(filters?: SongFilters): Promise<number>;

  /**
   * Count public songs
   */
  countPublic(): Promise<number>;

  /**
   * Count songs by artist
   */
  countByArtist(artistId: ArtistId, includePrivate?: boolean): Promise<number>;

  /**
   * Count songs by genre
   */
  countByGenre(): Promise<Record<string, number>>;

  /**
   * Count songs by year
   */
  countByYear(): Promise<Record<number, number>>;

  /**
   * Update play count
   */
  incrementPlayCount(id: SongId): Promise<boolean>;

  /**
   * Update like count
   */
  incrementLikeCount(id: SongId): Promise<boolean>;
  decrementLikeCount(id: SongId): Promise<boolean>;

  /**
   * Get total play time for artist
   */
  getTotalPlayTimeByArtist(artistId: ArtistId): Promise<number>;

  /**
   * Get most played songs by artist
   */
  getMostPlayedByArtist(
    artistId: ArtistId,
    limit?: number
  ): Promise<Song[]>;

  /**
   * Find songs created in date range
   */
  findByCreatedDateRange(from: Date, to: Date): Promise<Song[]>;

  /**
   * Soft delete song
   */
  softDelete(id: SongId): Promise<boolean>;

  /**
   * Permanently delete song (use with caution)
   */
  hardDelete(id: SongId): Promise<boolean>;

  /**
   * Restore soft deleted song
   */
  restore(id: SongId): Promise<boolean>;

  /**
   * Bulk operations
   */
  bulkSave(songs: Song[]): Promise<Song[]>;
  bulkUpdatePlayCounts(updates: Array<{ id: SongId; increment: number }>): Promise<number>;
  bulkSoftDelete(ids: SongId[]): Promise<number>;
  bulkAssignToAlbum(songIds: SongId[], albumId: AlbumId): Promise<number>;
  bulkRemoveFromAlbum(songIds: SongId[]): Promise<number>;

  /**
   * Search songs by term (title, tags)
   */
  search(
    term: string,
    pagination?: PaginationOptions,
    filters?: SongFilters
  ): Promise<PaginatedResult<Song>>;

  /**
   * Find similar songs (by genre, tags, artist)
   */
  findSimilar(
    songId: SongId,
    limit?: number
  ): Promise<Song[]>;

  /**
   * Get song statistics
   */
  getStatistics(id: SongId): Promise<{
    totalPlays: number;
    totalLikes: number;
    averageRating?: number;
    playsByDate: Array<{ date: Date; plays: number }>;
  } | null>;

  /**
   * Find songs without album
   */
  findWithoutAlbum(
    artistId?: ArtistId,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Song>>;

  /**
   * Get random songs
   */
  findRandom(
    limit?: number,
    genre?: Genre,
    includePrivate?: boolean
  ): Promise<Song[]>;
}