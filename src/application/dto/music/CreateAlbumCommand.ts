/**
 * CreateAlbumCommand DTO
 * Command for creating albums
 */

export interface CreateAlbumCommand {
  readonly title: string;
  readonly artistId: string;
  readonly description?: string;
  readonly genre: string;
  readonly releaseDate: Date;
  readonly coverImageUrl?: string;
  readonly isPublic: boolean;
  readonly creatorId: string;
}

export class CreateAlbumCommandValidator {
  public static validate(command: CreateAlbumCommand): void {
    // Basic field validation
    if (!command.title || typeof command.title !== 'string') {
      throw new Error('Title is required');
    }

    if (command.title.trim().length === 0) {
      throw new Error('Title cannot be empty');
    }

    if (command.title.length > 200) {
      throw new Error('Title cannot exceed 200 characters');
    }

    if (!command.artistId || typeof command.artistId !== 'string') {
      throw new Error('Artist ID is required');
    }

    if (!command.creatorId || typeof command.creatorId !== 'string') {
      throw new Error('Creator ID is required');
    }

    if (!command.genre || typeof command.genre !== 'string') {
      throw new Error('Genre is required');
    }

    if (!(command.releaseDate instanceof Date)) {
      throw new Error('Release date must be a Date object');
    }

    if (isNaN(command.releaseDate.getTime())) {
      throw new Error('Release date must be a valid date');
    }

    if (typeof command.isPublic !== 'boolean') {
      throw new Error('Is public flag is required');
    }

    // Validate UUID format for IDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(command.artistId)) {
      throw new Error('Invalid artist ID format');
    }

    if (!uuidRegex.test(command.creatorId)) {
      throw new Error('Invalid creator ID format');
    }

    // Validate release date range
    const now = new Date();
    const maxFutureDate = new Date();
    maxFutureDate.setFullYear(now.getFullYear() + 2); // Allow up to 2 years in the future

    if (command.releaseDate > maxFutureDate) {
      throw new Error('Release date cannot be more than 2 years in the future');
    }

    const minDate = new Date('1900-01-01');
    if (command.releaseDate < minDate) {
      throw new Error('Release date cannot be before 1900');
    }

    // Optional field validation
    if (command.description !== undefined) {
      if (typeof command.description !== 'string') {
        throw new Error('Description must be a string');
      }
      if (command.description.length > 1000) {
        throw new Error('Description cannot exceed 1000 characters');
      }
    }

    if (command.coverImageUrl !== undefined) {
      if (typeof command.coverImageUrl !== 'string') {
        throw new Error('Cover image URL must be a string');
      }
      
      if (command.coverImageUrl.trim().length === 0) {
        throw new Error('Cover image URL cannot be empty if provided');
      }

      // Basic URL validation
      try {
        const url = new URL(command.coverImageUrl);
        if (url.protocol !== 'https:') {
          throw new Error('Cover image URL must use HTTPS');
        }
      } catch {
        throw new Error('Cover image URL must be a valid HTTPS URL');
      }
    }

    // Validate genre (basic validation - could be enhanced with enum)
    const validGenres = [
      'rock', 'pop', 'jazz', 'classical', 'electronic', 'hip_hop', 'country', 
      'blues', 'reggae', 'folk', 'metal', 'punk', 'indie', 'alternative', 
      'r_and_b', 'soul', 'funk', 'disco', 'house', 'techno', 'ambient', 
      'world', 'latin', 'reggaeton', 'other'
    ];

    if (!validGenres.includes(command.genre.toLowerCase())) {
      throw new Error('Invalid genre');
    }
  }
}