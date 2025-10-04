/**
 * UserDomainService
 * Encapsulates complex business logic related to users
 */

import { User } from '../entities/User';
import { UserId } from '../entities/value-objects/UserId';
import { Email } from '../entities/value-objects/Email';
import { Username } from '../entities/value-objects/Username';
import { UserRole } from '../entities/enums/UserRole';
import { UserRepository } from '../repositories/UserRepository';

export class UserDomainService {
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * Validates if a user can be created with the given email and username
   */
  async validateUserCreation(email: string, username: string): Promise<void> {
    const emailObj = Email.create(email);
    const usernameObj = Username.create(username);

    const [emailExists, usernameExists] = await Promise.all([
      this.userRepository.existsByEmail(emailObj),
      this.userRepository.existsByUsername(usernameObj)
    ]);

    if (emailExists) {
      throw new Error('Email is already registered');
    }

    if (usernameExists) {
      throw new Error('Username is already taken');
    }
  }

  /**
   * Validates if a user can update their email
   */
  async validateEmailUpdate(userId: UserId, newEmail: string): Promise<void> {
    const emailObj = Email.create(newEmail);
    
    const existingUser = await this.userRepository.findByEmail(emailObj);
    
    if (existingUser && !existingUser.id.equals(userId)) {
      throw new Error('Email is already registered by another user');
    }
  }

  /**
   * Validates if a user can update their username
   */
  async validateUsernameUpdate(userId: UserId, newUsername: string): Promise<void> {
    const usernameObj = Username.create(newUsername);
    
    const existingUser = await this.userRepository.findByUsername(usernameObj);
    
    if (existingUser && !existingUser.id.equals(userId)) {
      throw new Error('Username is already taken by another user');
    }
  }

  /**
   * Determines if a user can be promoted to a specific role
   */
  canPromoteToRole(currentUser: User, targetUser: User, newRole: UserRole): boolean {
    // Only admins can promote users
    if (!currentUser.canAccess(UserRole.ADMIN)) {
      return false;
    }

    // Cannot promote yourself
    if (currentUser.id.equals(targetUser.id)) {
      return false;
    }

    // Cannot promote to admin role (security measure)
    if (newRole === UserRole.ADMIN) {
      return false;
    }

    // Cannot promote users who are already at or above the target role
    const currentLevel = UserRoleValidator.getPermissionLevel(targetUser.role);
    const newLevel = UserRoleValidator.getPermissionLevel(newRole);
    
    return newLevel > currentLevel;
  }

  /**
   * Determines if a user can be demoted from their current role
   */
  canDemoteFromRole(currentUser: User, targetUser: User): boolean {
    // Only admins can demote users
    if (!currentUser.canAccess(UserRole.ADMIN)) {
      return false;
    }

    // Cannot demote yourself
    if (currentUser.id.equals(targetUser.id)) {
      return false;
    }

    // Cannot demote other admins
    if (targetUser.role === UserRole.ADMIN) {
      return false;
    }

    // Can only demote users with roles above USER
    return targetUser.role !== UserRole.USER;
  }

  /**
   * Checks if a user account should be considered suspicious
   */
  isSuspiciousAccount(user: User): boolean {
    const now = new Date();
    const accountAge = now.getTime() - user.createdAt.getTime();
    const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24);

    // Account created very recently but not verified
    if (daysSinceCreation < 1 && !user.isVerified) {
      return true;
    }

    // Account inactive for a long time
    if (!user.isActive) {
      return true;
    }

    // Account has suspicious email patterns
    const emailDomain = user.email.getDomain();
    const suspiciousDomains = [
      'tempmail.org',
      '10minutemail.com',
      'guerrillamail.com',
      'mailinator.com'
    ];
    
    if (suspiciousDomains.includes(emailDomain)) {
      return true;
    }

    // Username contains suspicious patterns
    const username = user.username.value;
    const suspiciousPatterns = [
      /^user\d+$/i,      // Generic usernames like "user123"
      /^test/i,          // Test accounts
      /admin/i,          // Admin impersonation attempts
      /bot/i,            // Bot accounts
      /spam/i            // Spam accounts
    ];

    return suspiciousPatterns.some(pattern => pattern.test(username));
  }

  /**
   * Determines if a user should be automatically verified
   */
  shouldAutoVerify(user: User): boolean {
    // Auto-verify users with trusted email domains
    const trustedDomains = [
      'gmail.com',
      'outlook.com',
      'yahoo.com',
      'hotmail.com',
      'icloud.com'
    ];

    const emailDomain = user.email.getDomain();
    return trustedDomains.includes(emailDomain);
  }

  /**
   * Calculates user engagement score based on activity
   */
  calculateEngagementScore(user: User, additionalData?: {
    loginCount?: number;
    lastLoginDays?: number;
    contentCreated?: number;
    contentShared?: number;
  }): number {
    let score = 0;

    // Base score for verified users
    if (user.isVerified) {
      score += 20;
    }

    // Score for account age (max 30 points)
    const now = new Date();
    const accountAge = now.getTime() - user.createdAt.getTime();
    const daysSinceCreation = Math.min(accountAge / (1000 * 60 * 60 * 24), 365);
    score += Math.min(daysSinceCreation / 365 * 30, 30);

    // Score for profile completeness (max 25 points)
    const profile = user.profile;
    let profileCompleteness = 0;
    
    if (profile.firstName) profileCompleteness += 5;
    if (profile.lastName) profileCompleteness += 5;
    if (profile.bio && profile.bio.length > 10) profileCompleteness += 5;
    if (profile.avatarUrl) profileCompleteness += 5;
    if (profile.country) profileCompleteness += 5;
    
    score += profileCompleteness;

    // Additional data scoring (max 25 points)
    if (additionalData) {
      if (additionalData.loginCount) {
        score += Math.min(additionalData.loginCount / 10, 10);
      }
      
      if (additionalData.lastLoginDays !== undefined) {
        const recencyScore = Math.max(10 - additionalData.lastLoginDays, 0);
        score += Math.min(recencyScore, 5);
      }
      
      if (additionalData.contentCreated) {
        score += Math.min(additionalData.contentCreated / 5, 5);
      }
      
      if (additionalData.contentShared) {
        score += Math.min(additionalData.contentShared / 10, 5);
      }
    }

    return Math.min(Math.round(score), 100);
  }

  /**
   * Validates password strength
   */
  validatePasswordStrength(password: string): {
    isValid: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (password.length < 8) {
      feedback.push('Password must be at least 8 characters long');
    } else if (password.length >= 12) {
      score += 25;
    } else {
      score += 15;
    }

    // Character variety checks
    if (!/[a-z]/.test(password)) {
      feedback.push('Password must contain at least one lowercase letter');
    } else {
      score += 15;
    }

    if (!/[A-Z]/.test(password)) {
      feedback.push('Password must contain at least one uppercase letter');
    } else {
      score += 15;
    }

    if (!/\d/.test(password)) {
      feedback.push('Password must contain at least one number');
    } else {
      score += 15;
    }

    if (!/[@$!%*?&]/.test(password)) {
      feedback.push('Password must contain at least one special character (@$!%*?&)');
    } else {
      score += 15;
    }

    // Common password checks
    const commonPasswords = [
      'password', '123456', 'password123', 'admin', 'qwerty',
      'letmein', 'welcome', 'monkey', '1234567890'
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
      feedback.push('Password is too common');
      score = Math.max(score - 30, 0);
    }

    // Sequential characters check
    if (/123|abc|qwe/i.test(password)) {
      feedback.push('Avoid sequential characters');
      score = Math.max(score - 10, 0);
    }

    // Repeated characters check
    if (/(.)\1{2,}/.test(password)) {
      feedback.push('Avoid repeated characters');
      score = Math.max(score - 10, 0);
    }

    const isValid = feedback.length === 0 && score >= 60;

    return {
      isValid,
      score: Math.min(score, 100),
      feedback
    };
  }

  /**
   * Generates username suggestions based on email or name
   */
  generateUsernameSuggestions(email: string, firstName?: string, lastName?: string): string[] {
    const suggestions: string[] = [];
    
    // Extract base from email
    const emailBase = email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (emailBase && emailBase.length >= 3) {
      suggestions.push(emailBase);
      suggestions.push(`${emailBase}${Math.floor(Math.random() * 1000)}`);
    }

    // Generate from name
    if (firstName && lastName) {
      const firstInitial = firstName.charAt(0).toLowerCase();
      const lastNameClean = lastName.toLowerCase().replace(/[^a-z]/g, '');
      
      if (lastNameClean.length >= 2) {
        suggestions.push(`${firstInitial}${lastNameClean}`);
        suggestions.push(`${firstName.toLowerCase()}${lastNameClean.charAt(0)}`);
      }
    }

    if (firstName) {
      const firstNameClean = firstName.toLowerCase().replace(/[^a-z]/g, '');
      if (firstNameClean.length >= 3) {
        suggestions.push(firstNameClean);
        suggestions.push(`${firstNameClean}${Math.floor(Math.random() * 1000)}`);
      }
    }

    // Remove duplicates and invalid suggestions
    return [...new Set(suggestions)]
      .filter(suggestion => {
        try {
          Username.create(suggestion);
          return true;
        } catch {
          return false;
        }
      })
      .slice(0, 5); // Return max 5 suggestions
  }
}