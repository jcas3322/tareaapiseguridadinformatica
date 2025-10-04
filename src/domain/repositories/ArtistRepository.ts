/**
 * ArtistRepository Interface
 * Defines the contract for artist data persistence
 */

import { Artist } from '../entities/Artist';
import { ArtistId } from '../entities/value-objects/ArtistId';
import { UserId } from '../entities/value-objects/UserId';
import { Genre } from '../entities/enums/Genre';
import { PaginatedResult, PaginationOptions } from './types/PaginatedResult';
import { ArtistFilters, SortOptions } from './types/FilterOptions';

export interface ArtistRepository {
  /**
   * Save an artist (create or update)
   */
  save(artist: Artist): Promise<Artist>;

  /**
   * Find artist by ID
   */
  findById(id: ArtistId): Promise<Artist | null>;

  /**
   * Find artist by user ID
   */
  findByUserId(userId: UserId): Promise<Artist | null>;

  /**
   * Find artists with pagination and filtering
   */
  findMany(
    filters?: ArtistFilters,
    pagination?: PaginationOptions,
    sort?: SortOptions
  ): Promise<PaginatedResult<Artist>>;

  /**
   * Find artists by genre
   */
  findByGenre(
    genre: Genre,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Artist>>;

  /**
   * Find verified artists
   */
  findVerified(
    pagination?: PaginationOptions,
    sort?: SortOptions
  ): Promise<PaginatedResult<Artist>>;

  /**
   * Find popular artists (by follower count)
   */
  findPopular(
    limit?: number,
    minFollowers?: number
  ): Promise<Artist[]>;

  /**
   * Find trending artists (by monthly listeners)
   */
  findTrending(
    limit?: number,
    minListeners?: number
  ): Promise<Artist[]>;

  /**
   * Check if artist name exists for a different user
   */
  existsByNameForDifferentUser(name: string, excludeUserId: UserId): Promise<boolean>;

  /**
   * Count total artists
   */
  count(filters?: ArtistFilters): Promise<number>;

  /**
   * Count verified artists
   */
  countVerified(): Promise<number>;

  /**
   * Count artists by genre
   */
  countByGenre(): Promise<Record<string, number>>;

  /**
   * Find artists with most followers in genre
   */
  findTopInGenre(
    genre: Genre,
    limit?: number
  ): Promise<Artist[]>;

  /**
   * Find artists created in date range
   */
  findByCreatedDateRange(from: Date, to: Date): Promise<Artist[]>;

  /**
   * Update follower count
   */
  updateFollowerCount(id: ArtistId, count: number): Promise<boolean>;

  /**
   * Update monthly listeners
   */
  updateMonthlyListeners(id: ArtistId, count: number): Promise<boolean>;

  /**
   * Increment follower count
   */
  incrementFollowers(id: ArtistId): Promise<boolean>;

  /**
   * Decrement follower count
   */
  decrementFollowers(id: ArtistId): Promise<boolean>;

  /**
   * Soft delete artist
   */
  softDelete(id: ArtistId): Promise<boolean>;

  /**
   * Permanently delete artist (use with caution)
   */
  hardDelete(id: ArtistId): Promise<boolean>;

  /**
   * Restore soft deleted artist
   */
  restore(id: ArtistId): Promise<boolean>;

  /**
   * Bulk operations
   */
  bulkSave(artists: Artist[]): Promise<Artist[]>;
  bulkUpdateFollowerCounts(updates: Array<{ id: ArtistId; count: number }>): Promise<number>;
  bulkSoftDelete(ids: ArtistId[]): Promise<number>;

  /**
   * Search artists by term (name, biography)
   */
  search(
    term: string,
    pagination?: PaginationOptions,
    filters?: ArtistFilters
  ): Promise<PaginatedResult<Artist>>;

  /**
   * Find similar artists (by genre overlap)
   */
  findSimilar(
    artistId: ArtistId,
    limit?: number
  ): Promise<Artist[]>;

  /**
   * Get artist statistics
   */
  getStatistics(id: ArtistId): Promise<{
    totalSongs: number;
    totalAlbums: number;
    totalPlays: number;
    totalLikes: number;
    averageRating?: number;
  } | null>;
}