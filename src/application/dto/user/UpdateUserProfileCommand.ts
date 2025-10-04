/**
 * UpdateUserProfileCommand DTO
 * Command for updating user profile
 */

export interface UpdateUserProfileCommand {
  readonly userId: string;
  readonly requesterId: string;
  readonly profileUpdates: {
    readonly firstName?: string;
    readonly lastName?: string;
    readonly displayName?: string;
    readonly bio?: string;
    readonly avatarUrl?: string;
    readonly country?: string;
    readonly dateOfBirth?: Date;
    readonly isPublic?: boolean;
  };
}

export class UpdateUserProfileCommandValidator {
  public static validate(command: UpdateUserProfileCommand): void {
    if (!command.userId || typeof command.userId !== 'string') {
      throw new Error('User ID is required');
    }

    if (command.userId.trim().length === 0) {
      throw new Error('User ID cannot be empty');
    }

    if (!command.requesterId || typeof command.requesterId !== 'string') {
      throw new Error('Requester ID is required');
    }

    if (command.requesterId.trim().length === 0) {
      throw new Error('Requester ID cannot be empty');
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(command.userId)) {
      throw new Error('Invalid user ID format');
    }

    if (!uuidRegex.test(command.requesterId)) {
      throw new Error('Invalid requester ID format');
    }

    if (!command.profileUpdates || typeof command.profileUpdates !== 'object') {
      throw new Error('Profile updates are required');
    }

    // Validate profile update fields
    const updates = command.profileUpdates;

    if (updates.firstName !== undefined) {
      if (typeof updates.firstName !== 'string') {
        throw new Error('First name must be a string');
      }
      if (updates.firstName.trim().length === 0) {
        throw new Error('First name cannot be empty if provided');
      }
      if (updates.firstName.length > 50) {
        throw new Error('First name cannot exceed 50 characters');
      }
    }

    if (updates.lastName !== undefined) {
      if (typeof updates.lastName !== 'string') {
        throw new Error('Last name must be a string');
      }
      if (updates.lastName.trim().length === 0) {
        throw new Error('Last name cannot be empty if provided');
      }
      if (updates.lastName.length > 50) {
        throw new Error('Last name cannot exceed 50 characters');
      }
    }

    if (updates.displayName !== undefined) {
      if (typeof updates.displayName !== 'string') {
        throw new Error('Display name must be a string');
      }
      if (updates.displayName.trim().length === 0) {
        throw new Error('Display name cannot be empty if provided');
      }
      if (updates.displayName.length > 50) {
        throw new Error('Display name cannot exceed 50 characters');
      }
    }

    if (updates.bio !== undefined) {
      if (typeof updates.bio !== 'string') {
        throw new Error('Bio must be a string');
      }
      if (updates.bio.length > 500) {
        throw new Error('Bio cannot exceed 500 characters');
      }
    }

    if (updates.avatarUrl !== undefined) {
      if (typeof updates.avatarUrl !== 'string') {
        throw new Error('Avatar URL must be a string');
      }
      if (updates.avatarUrl.trim().length === 0) {
        throw new Error('Avatar URL cannot be empty if provided');
      }
      
      // Basic URL validation
      try {
        new URL(updates.avatarUrl);
      } catch {
        throw new Error('Avatar URL must be a valid URL');
      }
    }

    if (updates.country !== undefined) {
      if (typeof updates.country !== 'string') {
        throw new Error('Country must be a string');
      }
      if (updates.country.trim().length < 2 || updates.country.trim().length > 3) {
        throw new Error('Country must be a valid ISO country code');
      }
    }

    if (updates.dateOfBirth !== undefined) {
      if (!(updates.dateOfBirth instanceof Date)) {
        throw new Error('Date of birth must be a Date object');
      }
      if (isNaN(updates.dateOfBirth.getTime())) {
        throw new Error('Date of birth must be a valid date');
      }
      
      const now = new Date();
      const age = now.getFullYear() - updates.dateOfBirth.getFullYear();
      if (age < 13) {
        throw new Error('User must be at least 13 years old');
      }
      if (updates.dateOfBirth > now) {
        throw new Error('Date of birth cannot be in the future');
      }
    }

    if (updates.isPublic !== undefined && typeof updates.isPublic !== 'boolean') {
      throw new Error('Is public must be a boolean if provided');
    }

    // Check if at least one field is being updated
    const hasUpdates = Object.keys(updates).some(key => 
      updates[key as keyof typeof updates] !== undefined
    );

    if (!hasUpdates) {
      throw new Error('At least one profile field must be updated');
    }
  }
}