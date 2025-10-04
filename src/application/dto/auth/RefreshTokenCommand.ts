/**
 * RefreshTokenCommand DTO
 * Command for token refresh
 */

export interface RefreshTokenCommand {
  readonly refreshToken: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

export class RefreshTokenCommandValidator {
  public static validate(command: RefreshTokenCommand): void {
    if (!command.refreshToken || typeof command.refreshToken !== 'string') {
      throw new Error('Refresh token is required');
    }

    if (command.refreshToken.trim().length === 0) {
      throw new Error('Refresh token cannot be empty');
    }

    // Basic JWT format validation
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    if (!jwtRegex.test(command.refreshToken)) {
      throw new Error('Invalid refresh token format');
    }

    // Optional fields validation
    if (command.ipAddress !== undefined && (typeof command.ipAddress !== 'string' || command.ipAddress.trim().length === 0)) {
      throw new Error('IP address must be a non-empty string if provided');
    }

    if (command.userAgent !== undefined && (typeof command.userAgent !== 'string' || command.userAgent.trim().length === 0)) {
      throw new Error('User agent must be a non-empty string if provided');
    }
  }
}