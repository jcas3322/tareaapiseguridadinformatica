/**
 * Username Value Object
 * Represents a validated username with security constraints
 */

export class Username {
  private readonly _value: string;
  private static readonly MIN_LENGTH = 3;
  private static readonly MAX_LENGTH = 30;
  private static readonly USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;

  private constructor(value: string) {
    this._value = value.toLowerCase().trim();
  }

  public static create(value: string): Username {
    if (!this.isValid(value)) {
      throw new Error(`Invalid username format: ${value}`);
    }
    
    return new Username(value);
  }

  private static isValid(value: string): boolean {
    if (!value || typeof value !== 'string') {
      return false;
    }

    const trimmedValue = value.trim();
    
    // Check length
    if (trimmedValue.length < this.MIN_LENGTH || trimmedValue.length > this.MAX_LENGTH) {
      return false;
    }

    // Check format - only alphanumeric, underscore, and hyphen
    if (!this.USERNAME_REGEX.test(trimmedValue)) {
      return false;
    }

    // Security checks
    if (this.isReservedUsername(trimmedValue)) {
      return false;
    }

    if (this.containsSuspiciousPatterns(trimmedValue)) {
      return false;
    }

    return true;
  }

  private static isReservedUsername(username: string): boolean {
    const reservedUsernames = [
      'admin', 'administrator', 'root', 'system', 'api', 'www',
      'mail', 'email', 'support', 'help', 'info', 'contact',
      'security', 'abuse', 'noreply', 'no-reply', 'postmaster',
      'webmaster', 'hostmaster', 'test', 'demo', 'guest',
      'anonymous', 'null', 'undefined', 'void', 'delete'
    ];

    return reservedUsernames.includes(username.toLowerCase());
  }

  private static containsSuspiciousPatterns(username: string): boolean {
    const suspiciousPatterns = [
      /^[-_]|[-_]$/,    // Starting or ending with special chars
      /[-_]{2,}/,       // Multiple consecutive special chars
      /^\d+$/,          // Only numbers
    ];

    return suspiciousPatterns.some(pattern => pattern.test(username));
  }

  public get value(): string {
    return this._value;
  }

  public equals(other: Username): boolean {
    return this._value === other._value;
  }

  public toString(): string {
    return this._value;
  }
}