/**
 * Filter Options Types
 * Common filter types for repository queries
 */

import { Genre } from '../../entities/enums/Genre';
import { UserRole } from '../../entities/enums/UserRole';

export interface SortOptions {
  readonly field: string;
  readonly direction: 'asc' | 'desc';
}

export interface DateRangeFilter {
  readonly from?: Date;
  readonly to?: Date;
}

export interface UserFilters {
  readonly role?: UserRole;
  readonly isActive?: boolean;
  readonly isVerified?: boolean;
  readonly createdAt?: DateRangeFilter;
  readonly search?: string; // Search in username, email, or display name
}

export interface ArtistFilters {
  readonly isVerified?: boolean;
  readonly genres?: Genre[];
  readonly minFollowers?: number;
  readonly maxFollowers?: number;
  readonly createdAt?: DateRangeFilter;
  readonly search?: string; // Search in artist name or biography
}

export interface SongFilters {
  readonly artistId?: string;
  readonly albumId?: string;
  readonly genre?: Genre;
  readonly isPublic?: boolean;
  readonly minDuration?: number;
  readonly maxDuration?: number;
  readonly year?: number;
  readonly explicit?: boolean;
  readonly tags?: string[];
  readonly createdAt?: DateRangeFilter;
  readonly search?: string; // Search in title or tags
}

export interface AlbumFilters {
  readonly artistId?: string;
  readonly genre?: Genre;
  readonly isPublic?: boolean;
  readonly releaseYear?: number;
  readonly minSongs?: number;
  readonly maxSongs?: number;
  readonly createdAt?: DateRangeFilter;
  readonly search?: string; // Search in title or description
}

export class FilterValidator {
  public static validateUserFilters(filters: Partial<UserFilters>): UserFilters {
    const validatedFilters: UserFilters = {};

    if (filters.role !== undefined) {
      if (!Object.values(UserRole).includes(filters.role)) {
        throw new Error('Invalid user role filter');
      }
      validatedFilters.role = filters.role;
    }

    if (filters.isActive !== undefined) {
      validatedFilters.isActive = Boolean(filters.isActive);
    }

    if (filters.isVerified !== undefined) {
      validatedFilters.isVerified = Boolean(filters.isVerified);
    }

    if (filters.createdAt !== undefined) {
      validatedFilters.createdAt = this.validateDateRange(filters.createdAt);
    }

    if (filters.search !== undefined) {
      validatedFilters.search = this.validateSearchTerm(filters.search);
    }

    return validatedFilters;
  }

  public static validateArtistFilters(filters: Partial<ArtistFilters>): ArtistFilters {
    const validatedFilters: ArtistFilters = {};

    if (filters.isVerified !== undefined) {
      validatedFilters.isVerified = Boolean(filters.isVerified);
    }

    if (filters.genres !== undefined) {
      validatedFilters.genres = this.validateGenres(filters.genres);
    }

    if (filters.minFollowers !== undefined) {
      validatedFilters.minFollowers = this.validatePositiveInteger(filters.minFollowers, 'minFollowers');
    }

    if (filters.maxFollowers !== undefined) {
      validatedFilters.maxFollowers = this.validatePositiveInteger(filters.maxFollowers, 'maxFollowers');
    }

    if (filters.createdAt !== undefined) {
      validatedFilters.createdAt = this.validateDateRange(filters.createdAt);
    }

    if (filters.search !== undefined) {
      validatedFilters.search = this.validateSearchTerm(filters.search);
    }

    return validatedFilters;
  }

  public static validateSongFilters(filters: Partial<SongFilters>): SongFilters {
    const validatedFilters: SongFilters = {};

    if (filters.artistId !== undefined) {
      validatedFilters.artistId = this.validateUUID(filters.artistId, 'artistId');
    }

    if (filters.albumId !== undefined) {
      validatedFilters.albumId = this.validateUUID(filters.albumId, 'albumId');
    }

    if (filters.genre !== undefined) {
      if (!Object.values(Genre).includes(filters.genre)) {
        throw new Error('Invalid genre filter');
      }
      validatedFilters.genre = filters.genre;
    }

    if (filters.isPublic !== undefined) {
      validatedFilters.isPublic = Boolean(filters.isPublic);
    }

    if (filters.minDuration !== undefined) {
      validatedFilters.minDuration = this.validatePositiveInteger(filters.minDuration, 'minDuration');
    }

    if (filters.maxDuration !== undefined) {
      validatedFilters.maxDuration = this.validatePositiveInteger(filters.maxDuration, 'maxDuration');
    }

    if (filters.year !== undefined) {
      validatedFilters.year = this.validateYear(filters.year);
    }

    if (filters.explicit !== undefined) {
      validatedFilters.explicit = Boolean(filters.explicit);
    }

    if (filters.tags !== undefined) {
      validatedFilters.tags = this.validateTags(filters.tags);
    }

    if (filters.createdAt !== undefined) {
      validatedFilters.createdAt = this.validateDateRange(filters.createdAt);
    }

    if (filters.search !== undefined) {
      validatedFilters.search = this.validateSearchTerm(filters.search);
    }

    return validatedFilters;
  }

  public static validateAlbumFilters(filters: Partial<AlbumFilters>): AlbumFilters {
    const validatedFilters: AlbumFilters = {};

    if (filters.artistId !== undefined) {
      validatedFilters.artistId = this.validateUUID(filters.artistId, 'artistId');
    }

    if (filters.genre !== undefined) {
      if (!Object.values(Genre).includes(filters.genre)) {
        throw new Error('Invalid genre filter');
      }
      validatedFilters.genre = filters.genre;
    }

    if (filters.isPublic !== undefined) {
      validatedFilters.isPublic = Boolean(filters.isPublic);
    }

    if (filters.releaseYear !== undefined) {
      validatedFilters.releaseYear = this.validateYear(filters.releaseYear);
    }

    if (filters.minSongs !== undefined) {
      validatedFilters.minSongs = this.validatePositiveInteger(filters.minSongs, 'minSongs');
    }

    if (filters.maxSongs !== undefined) {
      validatedFilters.maxSongs = this.validatePositiveInteger(filters.maxSongs, 'maxSongs');
    }

    if (filters.createdAt !== undefined) {
      validatedFilters.createdAt = this.validateDateRange(filters.createdAt);
    }

    if (filters.search !== undefined) {
      validatedFilters.search = this.validateSearchTerm(filters.search);
    }

    return validatedFilters;
  }

  public static validateSortOptions(sort?: Partial<SortOptions>): SortOptions | undefined {
    if (!sort) {
      return undefined;
    }

    if (!sort.field || typeof sort.field !== 'string') {
      throw new Error('Sort field is required and must be a string');
    }

    const direction = sort.direction || 'asc';
    if (direction !== 'asc' && direction !== 'desc') {
      throw new Error('Sort direction must be "asc" or "desc"');
    }

    // Validate field name to prevent injection
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(sort.field)) {
      throw new Error('Invalid sort field name');
    }

    return {
      field: sort.field,
      direction
    };
  }

  private static validateDateRange(dateRange: DateRangeFilter): DateRangeFilter {
    const validatedRange: DateRangeFilter = {};

    if (dateRange.from !== undefined) {
      if (!(dateRange.from instanceof Date) || isNaN(dateRange.from.getTime())) {
        throw new Error('Invalid "from" date');
      }
      validatedRange.from = dateRange.from;
    }

    if (dateRange.to !== undefined) {
      if (!(dateRange.to instanceof Date) || isNaN(dateRange.to.getTime())) {
        throw new Error('Invalid "to" date');
      }
      validatedRange.to = dateRange.to;
    }

    if (validatedRange.from && validatedRange.to && validatedRange.from > validatedRange.to) {
      throw new Error('"From" date cannot be after "to" date');
    }

    return validatedRange;
  }

  private static validateSearchTerm(search: string): string {
    if (typeof search !== 'string') {
      throw new Error('Search term must be a string');
    }

    const trimmedSearch = search.trim();
    
    if (trimmedSearch.length === 0) {
      throw new Error('Search term cannot be empty');
    }

    if (trimmedSearch.length > 100) {
      throw new Error('Search term cannot exceed 100 characters');
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /[<>]/,
      /\0/,
    ];

    if (suspiciousPatterns.some(pattern => pattern.test(trimmedSearch))) {
      throw new Error('Search term contains invalid characters');
    }

    return trimmedSearch;
  }

  private static validateGenres(genres: Genre[]): Genre[] {
    if (!Array.isArray(genres)) {
      throw new Error('Genres must be an array');
    }

    const validatedGenres: Genre[] = [];
    
    for (const genre of genres) {
      if (!Object.values(Genre).includes(genre)) {
        throw new Error(`Invalid genre: ${genre}`);
      }
      if (!validatedGenres.includes(genre)) {
        validatedGenres.push(genre);
      }
    }

    return validatedGenres;
  }

  private static validatePositiveInteger(value: number, fieldName: string): number {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${fieldName} must be a non-negative integer`);
    }
    return value;
  }

  private static validateYear(year: number): number {
    const currentYear = new Date().getFullYear();
    if (!Number.isInteger(year) || year < 1900 || year > currentYear + 2) {
      throw new Error(`Year must be between 1900 and ${currentYear + 2}`);
    }
    return year;
  }

  private static validateUUID(uuid: string, fieldName: string): string {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(uuid)) {
      throw new Error(`${fieldName} must be a valid UUID`);
    }
    
    return uuid;
  }

  private static validateTags(tags: string[]): string[] {
    if (!Array.isArray(tags)) {
      throw new Error('Tags must be an array');
    }

    const validatedTags: string[] = [];
    
    for (const tag of tags) {
      if (typeof tag !== 'string') {
        throw new Error('All tags must be strings');
      }

      const trimmedTag = tag.trim().toLowerCase();
      
      if (trimmedTag.length === 0) {
        continue;
      }

      if (trimmedTag.length > 30) {
        throw new Error('Tag cannot exceed 30 characters');
      }

      if (!validatedTags.includes(trimmedTag)) {
        validatedTags.push(trimmedTag);
      }
    }

    return validatedTags;
  }
}