/**
 * RegisterUserCommand DTO
 * Command for user registration
 */

export interface RegisterUserCommand {
  readonly email: string;
  readonly username: string;
  readonly password: string;
  readonly confirmPassword: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly acceptTerms: boolean;
  readonly acceptPrivacyPolicy: boolean;
}

export class RegisterUserCommandValidator {
  public static validate(command: RegisterUserCommand): void {
    if (!command.email || typeof command.email !== 'string') {
      throw new Error('Email is required');
    }

    if (!command.username || typeof command.username !== 'string') {
      throw new Error('Username is required');
    }

    if (!command.password || typeof command.password !== 'string') {
      throw new Error('Password is required');
    }

    if (!command.confirmPassword || typeof command.confirmPassword !== 'string') {
      throw new Error('Password confirmation is required');
    }

    if (command.password !== command.confirmPassword) {
      throw new Error('Passwords do not match');
    }

    if (!command.acceptTerms) {
      throw new Error('You must accept the terms of service');
    }

    if (!command.acceptPrivacyPolicy) {
      throw new Error('You must accept the privacy policy');
    }

    // Optional fields validation
    if (command.firstName !== undefined && (typeof command.firstName !== 'string' || command.firstName.trim().length === 0)) {
      throw new Error('First name must be a non-empty string if provided');
    }

    if (command.lastName !== undefined && (typeof command.lastName !== 'string' || command.lastName.trim().length === 0)) {
      throw new Error('Last name must be a non-empty string if provided');
    }
  }
}