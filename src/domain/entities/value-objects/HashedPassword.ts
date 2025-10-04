/**
 * HashedPassword Value Object
 * Represents a securely hashed password
 */

export class HashedPassword {
  private readonly _value: string;
  private static readonly BCRYPT_REGEX = /^\$2[aby]?\$\d{1,2}\$[./A-Za-z0-9]{53}$/;

  private constructor(value: string) {
    this._value = value;
  }

  public static create(hashedValue: string): HashedPassword {
    if (!this.isValid(hashedValue)) {
      throw new Error('Invalid hashed password format');
    }
    
    return new HashedPassword(hashedValue);
  }

  private static isValid(value: string): boolean {
    if (!value || typeof value !== 'string') {
      return false;
    }

    // Validate bcrypt hash format
    return this.BCRYPT_REGEX.test(value);
  }

  public get value(): string {
    return this._value;
  }

  public getSaltRounds(): number {
    const match = this._value.match(/^\$2[aby]?\$(\d{1,2})\$/);
    return match ? parseInt(match[1], 10) : 0;
  }

  public equals(other: HashedPassword): boolean {
    return this._value === other._value;
  }

  public toString(): string {
    return '[PROTECTED]'; // Never expose the actual hash
  }
}