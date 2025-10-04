/**
 * UserRepository Interface
 * Defines the contract for user data persistence
 */

import { User } from '../entities/User';
import { UserId } from '../entities/value-objects/UserId';
import { Email } from '../entities/value-objects/Email';
import { Username } from '../entities/value-objects/Username';
import { PaginatedResult, PaginationOptions } from './types/PaginatedResult';
import { UserFilters, SortOptions } from './types/FilterOptions';

export interface UserRepository {
  /**
   * Save a user (create or update)
   */
  save(user: User): Promise<User>;

  /**
   * Find user by ID
   */
  findById(id: UserId): Promise<User | null>;

  /**
   * Find user by email
   */
  findByEmail(email: Email): Promise<User | null>;

  /**
   * Find user by username
   */
  findByUsername(username: Username): Promise<User | null>;

  /**
   * Find users with pagination and filtering
   */
  findMany(
    filters?: UserFilters,
    pagination?: PaginationOptions,
    sort?: SortOptions
  ): Promise<PaginatedResult<User>>;

  /**
   * Check if email exists
   */
  existsByEmail(email: Email): Promise<boolean>;

  /**
   * Check if username exists
   */
  existsByUsername(username: Username): Promise<boolean>;

  /**
   * Count total users
   */
  count(filters?: UserFilters): Promise<number>;

  /**
   * Count active users
   */
  countActive(): Promise<number>;

  /**
   * Count users by role
   */
  countByRole(): Promise<Record<string, number>>;

  /**
   * Find users created in date range
   */
  findByCreatedDateRange(from: Date, to: Date): Promise<User[]>;

  /**
   * Find users who haven't logged in since date
   */
  findInactiveUsers(since: Date): Promise<User[]>;

  /**
   * Soft delete user
   */
  softDelete(id: UserId): Promise<boolean>;

  /**
   * Permanently delete user (use with caution)
   */
  hardDelete(id: UserId): Promise<boolean>;

  /**
   * Restore soft deleted user
   */
  restore(id: UserId): Promise<boolean>;

  /**
   * Bulk operations
   */
  bulkSave(users: User[]): Promise<User[]>;
  bulkSoftDelete(ids: UserId[]): Promise<number>;

  /**
   * Search users by term (username, email, display name)
   */
  search(
    term: string,
    pagination?: PaginationOptions,
    filters?: UserFilters
  ): Promise<PaginatedResult<User>>;
}