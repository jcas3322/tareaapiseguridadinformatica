/**
 * UserProfile Type
 * Represents user profile information
 */

export interface UserProfile {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly displayName?: string;
  readonly bio?: string;
  readonly avatarUrl?: string;
  readonly country?: string;
  readonly dateOfBirth?: Date;
  readonly isPublic: boolean;
}

export class UserProfileValidator {
  private static readonly MAX_NAME_LENGTH = 50;
  private static readonly MAX_BIO_LENGTH = 500;
  private static readonly MIN_AGE = 13; // COPPA compliance

  public static validate(profile: Partial<UserProfile>): UserProfile {
    const validatedProfile: UserProfile = {
      isPublic: profile.isPublic ?? false
    };

    if (profile.firstName !== undefined) {
      validatedProfile.firstName = this.validateName(profile.firstName, 'firstName');
    }

    if (profile.lastName !== undefined) {
      validatedProfile.lastName = this.validateName(profile.lastName, 'lastName');
    }

    if (profile.displayName !== undefined) {
      validatedProfile.displayName = this.validateDisplayName(profile.displayName);
    }

    if (profile.bio !== undefined) {
      validatedProfile.bio = this.validateBio(profile.bio);
    }

    if (profile.avatarUrl !== undefined) {
      validatedProfile.avatarUrl = this.validateUrl(profile.avatarUrl);
    }

    if (profile.country !== undefined) {
      validatedProfile.country = this.validateCountry(profile.country);
    }

    if (profile.dateOfBirth !== undefined) {
      validatedProfile.dateOfBirth = this.validateDateOfBirth(profile.dateOfBirth);
    }

    return validatedProfile;
  }

  private static validateName(name: string, fieldName: string): string {
    if (!name || typeof name !== 'string') {
      throw new Error(`${fieldName} must be a non-empty string`);
    }

    const trimmedName = name.trim();
    
    if (trimmedName.length === 0 || trimmedName.length > this.MAX_NAME_LENGTH) {
      throw new Error(`${fieldName} must be between 1 and ${this.MAX_NAME_LENGTH} characters`);
    }

    // Check for suspicious patterns
    if (this.containsSuspiciousPatterns(trimmedName)) {
      throw new Error(`${fieldName} contains invalid characters`);
    }

    return trimmedName;
  }

  private static validateDisplayName(displayName: string): string {
    if (!displayName || typeof displayName !== 'string') {
      throw new Error('Display name must be a non-empty string');
    }

    const trimmedName = displayName.trim();
    
    if (trimmedName.length === 0 || trimmedName.length > this.MAX_NAME_LENGTH) {
      throw new Error(`Display name must be between 1 and ${this.MAX_NAME_LENGTH} characters`);
    }

    return trimmedName;
  }

  private static validateBio(bio: string): string {
    if (typeof bio !== 'string') {
      throw new Error('Bio must be a string');
    }

    const trimmedBio = bio.trim();
    
    if (trimmedBio.length > this.MAX_BIO_LENGTH) {
      throw new Error(`Bio must be less than ${this.MAX_BIO_LENGTH} characters`);
    }

    return trimmedBio;
  }

  private static validateUrl(url: string): string {
    if (!url || typeof url !== 'string') {
      throw new Error('URL must be a non-empty string');
    }

    try {
      const urlObj = new URL(url);
      
      // Only allow HTTPS URLs for security
      if (urlObj.protocol !== 'https:') {
        throw new Error('Only HTTPS URLs are allowed');
      }

      return url;
    } catch {
      throw new Error('Invalid URL format');
    }
  }

  private static validateCountry(country: string): string {
    if (!country || typeof country !== 'string') {
      throw new Error('Country must be a non-empty string');
    }

    const trimmedCountry = country.trim();
    
    if (trimmedCountry.length < 2 || trimmedCountry.length > 3) {
      throw new Error('Country must be a valid ISO country code');
    }

    return trimmedCountry.toUpperCase();
  }

  private static validateDateOfBirth(dateOfBirth: Date): Date {
    if (!(dateOfBirth instanceof Date) || isNaN(dateOfBirth.getTime())) {
      throw new Error('Date of birth must be a valid date');
    }

    const now = new Date();
    const age = now.getFullYear() - dateOfBirth.getFullYear();
    
    if (age < this.MIN_AGE) {
      throw new Error(`User must be at least ${this.MIN_AGE} years old`);
    }

    if (dateOfBirth > now) {
      throw new Error('Date of birth cannot be in the future');
    }

    return dateOfBirth;
  }

  private static containsSuspiciousPatterns(text: string): boolean {
    const suspiciousPatterns = [
      /<script/i,        // Script tags
      /javascript:/i,    // JavaScript URLs
      /on\w+\s*=/i,     // Event handlers
      /[<>]/,           // HTML tags
      /\0/,             // Null bytes
    ];

    return suspiciousPatterns.some(pattern => pattern.test(text));
  }
}