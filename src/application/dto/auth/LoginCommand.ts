/**
 * LoginCommand DTO
 * Command for user login
 */

export interface LoginCommand {
  readonly emailOrUsername: string;
  readonly password: string;
  readonly rememberMe?: boolean;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

export class LoginCommandValidator {
  public static validate(command: LoginCommand): void {
    if (!command.emailOrUsername || typeof command.emailOrUsername !== 'string') {
      throw new Error('Email or username is required');
    }

    if (command.emailOrUsername.trim().length === 0) {
      throw new Error('Email or username cannot be empty');
    }

    if (!command.password || typeof command.password !== 'string') {
      throw new Error('Password is required');
    }

    if (command.password.trim().length === 0) {
      throw new Error('Password cannot be empty');
    }

    // Optional fields validation
    if (command.rememberMe !== undefined && typeof command.rememberMe !== 'boolean') {
      throw new Error('Remember me must be a boolean if provided');
    }

    if (command.ipAddress !== undefined && (typeof command.ipAddress !== 'string' || command.ipAddress.trim().length === 0)) {
      throw new Error('IP address must be a non-empty string if provided');
    }

    if (command.userAgent !== undefined && (typeof command.userAgent !== 'string' || command.userAgent.trim().length === 0)) {
      throw new Error('User agent must be a non-empty string if provided');
    }
  }
}