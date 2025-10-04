/**
 * AlbumRepository Interface
 * Defines the contract for album data persistence
 */

import { Album } from '../entities/Album';
import { AlbumId } from '../entities/value-objects/AlbumId';
import { ArtistId } from '../entities/value-objects/ArtistId';
import { SongId } from '../entities/value-objects/SongId';
import { Genre } from '../entities/enums/Genre';
import { PaginatedResult, PaginationOptions } from './types/PaginatedResult';
import { AlbumFilters, SortOptions } from './types/FilterOptions';

export interface AlbumRepository {
  /**
   * Save an album (create or update)
   */
  save(album: Album): Promise<Album>;

  /**
   * Find album by ID
   */
  findById(id: AlbumId): Promise<Album | null>;

  /**
   * Find albums with pagination and filtering
   */
  findMany(
    filters?: AlbumFilters,
    pagination?: PaginationOptions,
    sort?: SortOptions
  ): Promise<PaginatedResult<Album>>;

  /**
   * Find albums by artist
   */
  findByArtist(
    artistId: ArtistId,
    pagination?: PaginationOptions,
    includePrivate?: boolean
  ): Promise<PaginatedResult<Album>>;

  /**
   * Find public albums
   */
  findPublic(
    filters?: AlbumFilters,
    pagination?: PaginationOptions,
    sort?: SortOptions
  ): Promise<PaginatedResult<Album>>;

  /**
   * Find albums by genre
   */
  findByGenre(
    genre: Genre,
    pagination?: PaginationOptions,
    includePrivate?: boolean
  ): Promise<PaginatedResult<Album>>;

  /**
   * Find albums by release year
   */
  findByReleaseYear(
    year: number,
    pagination?: PaginationOptions,
    includePrivate?: boolean
  ): Promise<PaginatedResult<Album>>;

  /**
   * Find popular albums (by play count)
   */
  findPopular(
    limit?: number,
    genre?: Genre,
    timeRange?: 'day' | 'week' | 'month' | 'year' | 'all'
  ): Promise<Album[]>;

  /**
   * Find trending albums (by recent play count increase)
   */
  findTrending(
    limit?: number,
    genre?: Genre
  ): Promise<Album[]>;

  /**
   * Find recently released albums
   */
  findRecentlyReleased(
    limit?: number,
    genre?: Genre,
    includePrivate?: boolean
  ): Promise<Album[]>;

  /**
   * Find recently added albums
   */
  findRecentlyAdded(
    limit?: number,
    genre?: Genre,
    includePrivate?: boolean
  ): Promise<Album[]>;

  /**
   * Find albums containing song
   */
  findContainingSong(songId: SongId): Promise<Album | null>;

  /**
   * Check if album title exists for artist
   */
  existsByTitleForArtist(title: string, artistId: ArtistId, excludeAlbumId?: AlbumId): Promise<boolean>;

  /**
   * Count total albums
   */
  count(filters?: AlbumFilters): Promise<number>;

  /**
   * Count public albums
   */
  countPublic(): Promise<number>;

  /**
   * Count albums by artist
   */
  countByArtist(artistId: ArtistId, includePrivate?: boolean): Promise<number>;

  /**
   * Count albums by genre
   */
  countByGenre(): Promise<Record<string, number>>;

  /**
   * Count albums by release year
   */
  countByReleaseYear(): Promise<Record<number, number>>;

  /**
   * Update play count
   */
  incrementPlayCount(id: AlbumId): Promise<boolean>;

  /**
   * Update like count
   */
  incrementLikeCount(id: AlbumId): Promise<boolean>;
  decrementLikeCount(id: AlbumId): Promise<boolean>;

  /**
   * Update total duration when songs are added/removed
   */
  updateTotalDuration(id: AlbumId, duration: number): Promise<boolean>;

  /**
   * Add song to album
   */
  addSong(albumId: AlbumId, songId: SongId, songDuration: number): Promise<boolean>;

  /**
   * Remove song from album
   */
  removeSong(albumId: AlbumId, songId: SongId, songDuration: number): Promise<boolean>;

  /**
   * Reorder songs in album
   */
  reorderSongs(albumId: AlbumId, songIds: SongId[]): Promise<boolean>;

  /**
   * Get albums with most songs
   */
  findWithMostSongs(
    limit?: number,
    minSongs?: number
  ): Promise<Album[]>;

  /**
   * Find empty albums (no songs)
   */
  findEmpty(
    artistId?: ArtistId,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Album>>;

  /**
   * Find albums created in date range
   */
  findByCreatedDateRange(from: Date, to: Date): Promise<Album[]>;

  /**
   * Find albums released in date range
   */
  findByReleaseDateRange(from: Date, to: Date): Promise<Album[]>;

  /**
   * Soft delete album
   */
  softDelete(id: AlbumId): Promise<boolean>;

  /**
   * Permanently delete album (use with caution)
   */
  hardDelete(id: AlbumId): Promise<boolean>;

  /**
   * Restore soft deleted album
   */
  restore(id: AlbumId): Promise<boolean>;

  /**
   * Bulk operations
   */
  bulkSave(albums: Album[]): Promise<Album[]>;
  bulkUpdatePlayCounts(updates: Array<{ id: AlbumId; increment: number }>): Promise<number>;
  bulkSoftDelete(ids: AlbumId[]): Promise<number>;
  bulkAddSongs(operations: Array<{ albumId: AlbumId; songId: SongId; songDuration: number }>): Promise<number>;
  bulkRemoveSongs(operations: Array<{ albumId: AlbumId; songId: SongId; songDuration: number }>): Promise<number>;

  /**
   * Search albums by term (title, description)
   */
  search(
    term: string,
    pagination?: PaginationOptions,
    filters?: AlbumFilters
  ): Promise<PaginatedResult<Album>>;

  /**
   * Find similar albums (by genre, artist)
   */
  findSimilar(
    albumId: AlbumId,
    limit?: number
  ): Promise<Album[]>;

  /**
   * Get album statistics
   */
  getStatistics(id: AlbumId): Promise<{
    totalPlays: number;
    totalLikes: number;
    averageRating?: number;
    songCount: number;
    totalDuration: number;
    playsByDate: Array<{ date: Date; plays: number }>;
  } | null>;

  /**
   * Find albums by artist with song counts
   */
  findByArtistWithSongCounts(
    artistId: ArtistId,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Album & { songCount: number }>>;

  /**
   * Get random albums
   */
  findRandom(
    limit?: number,
    genre?: Genre,
    includePrivate?: boolean
  ): Promise<Album[]>;

  /**
   * Find compilation albums (albums with songs from multiple artists)
   */
  findCompilations(
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Album>>;
}