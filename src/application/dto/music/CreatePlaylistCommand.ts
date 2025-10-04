/**
 * CreatePlaylistCommand DTO
 * Command for creating playlists
 */

export interface CreatePlaylistCommand {
  readonly name: string;
  readonly description?: string;
  readonly isPublic: boolean;
  readonly isCollaborative?: boolean;
  readonly coverImageUrl?: string;
  readonly tags?: string[];
  readonly creatorId: string;
}

export class CreatePlaylistCommandValidator {
  public static validate(command: CreatePlaylistCommand): void {
    // Basic field validation
    if (!command.name || typeof command.name !== 'string') {
      throw new Error('Playlist name is required');
    }

    if (command.name.trim().length === 0) {
      throw new Error('Playlist name cannot be empty');
    }

    if (command.name.length > 100) {
      throw new Error('Playlist name cannot exceed 100 characters');
    }

    if (!command.creatorId || typeof command.creatorId !== 'string') {
      throw new Error('Creator ID is required');
    }

    if (typeof command.isPublic !== 'boolean') {
      throw new Error('Is public flag is required');
    }

    // Validate UUID format for creator ID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(command.creatorId)) {
      throw new Error('Invalid creator ID format');
    }

    // Optional field validation
    if (command.description !== undefined) {
      if (typeof command.description !== 'string') {
        throw new Error('Description must be a string');
      }
      if (command.description.length > 500) {
        throw new Error('Description cannot exceed 500 characters');
      }
    }

    if (command.isCollaborative !== undefined && typeof command.isCollaborative !== 'boolean') {
      throw new Error('Is collaborative must be a boolean if provided');
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

    if (command.tags !== undefined) {
      if (!Array.isArray(command.tags)) {
        throw new Error('Tags must be an array');
      }

      if (command.tags.length > 10) {
        throw new Error('Maximum 10 tags allowed');
      }

      for (const tag of command.tags) {
        if (typeof tag !== 'string') {
          throw new Error('All tags must be strings');
        }
        if (tag.trim().length === 0) {
          throw new Error('Tags cannot be empty');
        }
        if (tag.length > 30) {
          throw new Error('Tags cannot exceed 30 characters');
        }
      }
    }

    // Business rule validation
    if (command.isCollaborative && !command.isPublic) {
      throw new Error('Collaborative playlists must be public');
    }
  }
}