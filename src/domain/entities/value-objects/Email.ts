/**
 * Email Value Object
 * Represents a validated email address
 */

export class Email {
  private readonly _value: string;
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private static readonly MAX_LENGTH = 254; // RFC 5321 limit

  private constructor(value: string) {
    this._value = value.toLowerCase().trim();
  }

  public static create(value: string): Email {
    if (!this.isValid(value)) {
      throw new Error(`Invalid email format: ${value}`);
    }
    
    return new Email(value);
  }

  private static isValid(value: string): boolean {
    if (!value || typeof value !== 'string') {
      return false;
    }

    const trimmedValue = value.trim();
    
    // Check length
    if (trimmedValue.length === 0 || trimmedValue.length > this.MAX_LENGTH) {
      return false;
    }

    // Check format
    if (!this.EMAIL_REGEX.test(trimmedValue)) {
      return false;
    }

    // Additional security checks
    if (this.containsSuspiciousPatterns(trimmedValue)) {
      return false;
    }

    return true;
  }

  private static containsSuspiciousPatterns(email: string): boolean {
    const suspiciousPatterns = [
      /\.\./,           // Double dots
      /^\.|\.$/, // Starting or ending with dot
      /@\./,            // @ followed by dot
      /\.@/,            // Dot followed by @
    ];

    return suspiciousPatterns.some(pattern => pattern.test(email));
  }

  public get value(): string {
    return this._value;
  }

  public getDomain(): string {
    return this._value.split('@')[1] || '';
  }

  public getLocalPart(): string {
    return this._value.split('@')[0] || '';
  }

  public equals(other: Email): boolean {
    return this._value === other._value;
  }

  public toString(): string {
    return this._value;
  }
}