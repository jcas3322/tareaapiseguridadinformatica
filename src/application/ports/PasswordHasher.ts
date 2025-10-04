/**
 * PasswordHasher Port
 * Interface for password hashing operations
 */

export interface PasswordHasher {
  /**
   * Hash a plain text password
   */
  hash(password: string): Promise<string>;

  /**
   * Verify a plain text password against a hash
   */
  verify(password: string, hash: string): Promise<boolean>;

  /**
   * Get the salt rounds used for hashing
   */
  getSaltRounds(): number;

  /**
   * Check if a hash needs to be rehashed (e.g., salt rounds changed)
   */
  needsRehash(hash: string): boolean;
}