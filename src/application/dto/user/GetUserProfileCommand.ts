/**
 * GetUserProfileCommand DTO
 * Command for retrieving user profile
 */

export interface GetUserProfileCommand {
  readonly userId: string;
  readonly requesterId: string;
  readonly includePrivateData?: boolean;
}

export class GetUserProfileCommandValidator {
  public static validate(command: GetUserProfileCommand): void {
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

    if (command.includePrivateData !== undefined && typeof command.includePrivateData !== 'boolean') {
      throw new Error('Include private data must be a boolean if provided');
    }
  }
}