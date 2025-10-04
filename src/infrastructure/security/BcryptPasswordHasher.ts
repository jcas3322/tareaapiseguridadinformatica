/**
 * BcryptPasswordHasher
 * Secure password hashing implementation using bcrypt
 */

import * as bcrypt from 'bcrypt';
import { PasswordHasher } from '../../application/ports/PasswordHasher';

export class BcryptPasswordHasher implements PasswordHasher {
  private readonly saltRounds: number;
  private readonly minSaltRounds = 10;
  private readonly maxSaltRounds = 15;

  constructor(saltRounds?: number) {
    // Default to 12 rounds for good security/performance balance
    this.saltRounds = saltRounds || 12;
    
    if (this.saltRounds < this.minSaltRounds) {
      throw new Error(`Salt rounds must be at least ${this.minSaltRounds} for security`);
    }
    
    if (this.saltRounds > this.maxSaltRounds) {
      throw new Error(`Salt rounds cannot exceed ${this.maxSaltRounds} for performance`);
    }
  }

  public async hash(password: string): Promise<string> {
    if (!password || typeof password !== 'string') {
      throw new Error('Password must be a non-empty string');
    }

    if (password.length === 0) {
      throw new Error('Password cannot be empty');
    }

    if (password.length > 128) {
      throw new Error('Password is too long (max 128 characters)');
    }

    try {
      const hash = await bcrypt.hash(password, this.saltRounds);
      
      // Validate the generated hash format
      if (!this.isValidBcryptHash(hash)) {
        throw new Error('Generated hash is invalid');
      }

      return hash;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Generated hash is invalid')) {
        throw error;
      }
      throw new Error('Failed to hash password');
    }
  }

  public async verify(password: string, hash: string): Promise<boolean> {
    if (!password || typeof password !== 'string') {
      throw new Error('Password must be a non-empty string');
    }

    if (!hash || typeof hash !== 'string') {
      throw new Error('Hash must be a non-empty string');
    }

    if (!this.isValidBcryptHash(hash)) {
      throw new Error('Invalid hash format');
    }

    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      // Log error but don't expose internal details
      console.error('Password verification failed:', error);
      return false;
    }
  }

  public getSaltRounds(): number {
    return this.saltRounds;
  }

  public needsRehash(hash: string): boolean {
    if (!hash || typeof hash !== 'string') {
      return true;
    }

    if (!this.isValidBcryptHash(hash)) {
      return true;
    }

    try {
      // Extract salt rounds from hash
      const hashSaltRounds = this.extractSaltRounds(hash);
      
      // Rehash if current salt rounds are higher (more secure)
      return hashSaltRounds < this.saltRounds;
    } catch {
      // If we can't parse the hash, it needs rehashing
      return true;
    }
  }

  private isValidBcryptHash(hash: string): boolean {
    // Bcrypt hash format: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
    // $2a$ or $2b$ or $2y$ + rounds + 22 char salt + 31 char hash
    const bcryptRegex = /^\$2[aby]?\$\d{1,2}\$[./A-Za-z0-9]{53}$/;
    return bcryptRegex.test(hash);
  }

  private extractSaltRounds(hash: string): number {
    const match = hash.match(/^\$2[aby]?\$(\d{1,2})\$/);
    if (!match) {
      throw new Error('Cannot extract salt rounds from hash');
    }
    
    return parseInt(match[1], 10);
  }

  /**
   * Generate a secure random salt (for advanced use cases)
   */
  public async generateSalt(): Promise<string> {
    try {
      return await bcrypt.genSalt(this.saltRounds);
    } catch (error) {
      throw new Error('Failed to generate salt');
    }
  }

  /**
   * Hash password with provided salt (for advanced use cases)
   */
  public async hashWithSalt(password: string, salt: string): Promise<string> {
    if (!password || typeof password !== 'string') {
      throw new Error('Password must be a non-empty string');
    }

    if (!salt || typeof salt !== 'string') {
      throw new Error('Salt must be a non-empty string');
    }

    try {
      return await bcrypt.hash(password, salt);
    } catch (error) {
      throw new Error('Failed to hash password with salt');
    }
  }

  /**
   * Get timing-safe hash comparison (constant time)
   */
  public async timingSafeVerify(password: string, hash: string): Promise<boolean> {
    // bcrypt.compare is already timing-safe, but we can add extra measures
    const startTime = process.hrtime.bigint();
    
    try {
      const result = await this.verify(password, hash);
      
      // Add minimum processing time to prevent timing attacks
      const minProcessingTime = 10; // milliseconds
      const elapsed = Number(process.hrtime.bigint() - startTime) / 1000000;
      
      if (elapsed < minProcessingTime) {
        await new Promise(resolve => setTimeout(resolve, minProcessingTime - elapsed));
      }
      
      return result;
    } catch (error) {
      // Ensure consistent timing even on errors
      const minProcessingTime = 10;
      const elapsed = Number(process.hrtime.bigint() - startTime) / 1000000;
      
      if (elapsed < minProcessingTime) {
        await new Promise(resolve => setTimeout(resolve, minProcessingTime - elapsed));
      }
      
      throw error;
    }
  }
}