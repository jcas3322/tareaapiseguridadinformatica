/**
 * BcryptPasswordHasher Integration Tests
 */

import { BcryptPasswordHasher } from '../../../../src/infrastructure/security/BcryptPasswordHasher';

describe('BcryptPasswordHasher Integration Tests', () => {
  let passwordHasher: BcryptPasswordHasher;

  beforeEach(() => {
    passwordHasher = new BcryptPasswordHasher(10); // Use lower rounds for faster tests
  });

  describe('hash', () => {
    it('should hash password successfully', async () => {
      const password = 'TestPassword123!';
      
      const hash = await passwordHasher.hash(password);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(50);
      expect(hash).toMatch(/^\$2[aby]?\$10\$/); // bcrypt format with 10 rounds
    });

    it('should generate different hashes for same password', async () => {
      const password = 'TestPassword123!';
      
      const [hash1, hash2] = await Promise.all([
        passwordHasher.hash(password),
        passwordHasher.hash(password)
      ]);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle special characters in password', async () => {
      const password = 'P@ssw0rd!@#$%^&*()_+-=[]{}|;:,.<>?';
      
      const hash = await passwordHasher.hash(password);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });

    it('should throw error for empty password', async () => {
      await expect(passwordHasher.hash('')).rejects.toThrow('Password cannot be empty');
    });

    it('should throw error for non-string password', async () => {
      await expect(passwordHasher.hash(null as any)).rejects.toThrow('Password must be a non-empty string');
      await expect(passwordHasher.hash(123 as any)).rejects.toThrow('Password must be a non-empty string');
    });

    it('should throw error for too long password', async () => {
      const longPassword = 'a'.repeat(129);
      
      await expect(passwordHasher.hash(longPassword)).rejects.toThrow('Password is too long');
    });
  });

  describe('verify', () => {
    it('should verify correct password', async () => {
      const password = 'TestPassword123!';
      const hash = await passwordHasher.hash(password);
      
      const isValid = await passwordHasher.verify(password, hash);
      
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hash = await passwordHasher.hash(password);
      
      const isValid = await passwordHasher.verify(wrongPassword, hash);
      
      expect(isValid).toBe(false);
    });

    it('should handle case sensitivity', async () => {
      const password = 'TestPassword123!';
      const wrongCasePassword = 'testpassword123!';
      const hash = await passwordHasher.hash(password);
      
      const isValid = await passwordHasher.verify(wrongCasePassword, hash);
      
      expect(isValid).toBe(false);
    });

    it('should throw error for invalid hash format', async () => {
      const password = 'TestPassword123!';
      const invalidHash = 'invalid-hash-format';
      
      await expect(passwordHasher.verify(password, invalidHash)).rejects.toThrow('Invalid hash format');
    });

    it('should return false for malformed hash without throwing', async () => {
      const password = 'TestPassword123!';
      const malformedHash = '$2a$10$invalidhashformat';
      
      const isValid = await passwordHasher.verify(password, malformedHash);
      
      expect(isValid).toBe(false);
    });
  });

  describe('needsRehash', () => {
    it('should return false for hash with same salt rounds', async () => {
      const password = 'TestPassword123!';
      const hash = await passwordHasher.hash(password);
      
      const needsRehash = passwordHasher.needsRehash(hash);
      
      expect(needsRehash).toBe(false);
    });

    it('should return true for hash with lower salt rounds', () => {
      // Hash generated with 8 rounds (lower than current 10)
      const oldHash = '$2a$08$someoldhashwithfewerrounds123456789012345678901234567890123';
      
      const needsRehash = passwordHasher.needsRehash(oldHash);
      
      expect(needsRehash).toBe(true);
    });

    it('should return true for invalid hash', () => {
      const invalidHash = 'invalid-hash-format';
      
      const needsRehash = passwordHasher.needsRehash(invalidHash);
      
      expect(needsRehash).toBe(true);
    });

    it('should return true for empty hash', () => {
      const needsRehash = passwordHasher.needsRehash('');
      
      expect(needsRehash).toBe(true);
    });
  });

  describe('getSaltRounds', () => {
    it('should return configured salt rounds', () => {
      const saltRounds = passwordHasher.getSaltRounds();
      
      expect(saltRounds).toBe(10);
    });
  });

  describe('timingSafeVerify', () => {
    it('should verify password with consistent timing', async () => {
      const password = 'TestPassword123!';
      const hash = await passwordHasher.hash(password);
      
      const startTime = Date.now();
      const isValid = await passwordHasher.timingSafeVerify(password, hash);
      const endTime = Date.now();
      
      expect(isValid).toBe(true);
      expect(endTime - startTime).toBeGreaterThanOrEqual(10); // Minimum processing time
    });

    it('should maintain consistent timing for invalid passwords', async () => {
      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hash = await passwordHasher.hash(password);
      
      const times: number[] = [];
      
      // Test multiple times to check consistency
      for (let i = 0; i < 3; i++) {
        const startTime = Date.now();
        await passwordHasher.timingSafeVerify(wrongPassword, hash);
        const endTime = Date.now();
        times.push(endTime - startTime);
      }
      
      // All times should be at least the minimum processing time
      times.forEach(time => {
        expect(time).toBeGreaterThanOrEqual(10);
      });
      
      // Times should be relatively consistent (within 50ms of each other)
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      expect(maxTime - minTime).toBeLessThan(50);
    });
  });

  describe('generateSalt', () => {
    it('should generate valid salt', async () => {
      const salt = await passwordHasher.generateSalt();
      
      expect(salt).toBeDefined();
      expect(typeof salt).toBe('string');
      expect(salt).toMatch(/^\$2[aby]?\$10\$/); // bcrypt salt format
    });

    it('should generate different salts', async () => {
      const [salt1, salt2] = await Promise.all([
        passwordHasher.generateSalt(),
        passwordHasher.generateSalt()
      ]);
      
      expect(salt1).not.toBe(salt2);
    });
  });

  describe('hashWithSalt', () => {
    it('should hash password with provided salt', async () => {
      const password = 'TestPassword123!';
      const salt = await passwordHasher.generateSalt();
      
      const hash = await passwordHasher.hashWithSalt(password, salt);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.startsWith(salt)).toBe(true);
    });

    it('should produce same hash with same salt', async () => {
      const password = 'TestPassword123!';
      const salt = await passwordHasher.generateSalt();
      
      const [hash1, hash2] = await Promise.all([
        passwordHasher.hashWithSalt(password, salt),
        passwordHasher.hashWithSalt(password, salt)
      ]);
      
      expect(hash1).toBe(hash2);
    });
  });

  describe('constructor validation', () => {
    it('should throw error for salt rounds below minimum', () => {
      expect(() => new BcryptPasswordHasher(9)).toThrow('Salt rounds must be at least 10 for security');
    });

    it('should throw error for salt rounds above maximum', () => {
      expect(() => new BcryptPasswordHasher(16)).toThrow('Salt rounds cannot exceed 15 for performance');
    });

    it('should use default salt rounds when not specified', () => {
      const hasher = new BcryptPasswordHasher();
      expect(hasher.getSaltRounds()).toBe(12);
    });
  });

  describe('performance', () => {
    it('should hash password within reasonable time', async () => {
      const password = 'TestPassword123!';
      
      const startTime = Date.now();
      await passwordHasher.hash(password);
      const endTime = Date.now();
      
      // Should complete within 1 second for 10 rounds
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should verify password within reasonable time', async () => {
      const password = 'TestPassword123!';
      const hash = await passwordHasher.hash(password);
      
      const startTime = Date.now();
      await passwordHasher.verify(password, hash);
      const endTime = Date.now();
      
      // Should complete within 1 second
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});