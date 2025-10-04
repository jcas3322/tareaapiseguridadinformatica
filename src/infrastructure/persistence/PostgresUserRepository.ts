/**
 * PostgresUserRepository
 * PostgreSQL implementation of UserRepository
 */

import { User, UserProps } from '../../domain/entities/User';
import { UserId } from '../../domain/entities/value-objects/UserId';
import { Email } from '../../domain/entities/value-objects/Email';
import { Username } from '../../domain/entities/value-objects/Username';
import { HashedPassword } from '../../domain/entities/value-objects/HashedPassword';
import { UserRole, UserRoleValidator } from '../../domain/entities/enums/UserRole';
import { UserRepository } from '../../domain/repositories/UserRepository';
import { PaginatedResult, PaginationOptions } from '../../domain/repositories/types/PaginatedResult';
import { UserFilters, SortOptions, FilterValidator } from '../../domain/repositories/types/FilterOptions';
import { BaseRepository, DatabaseConnection } from './BaseRepository';

interface UserRow {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  role: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  country?: string;
  date_of_birth?: Date;
  is_public: boolean;
  is_active: boolean;
  is_verified: boolean;
  created_at: Date;
  updated_at: Date;
  last_login_at?: Date;
  deleted_at?: Date;
}

export class PostgresUserRepository extends BaseRepository implements UserRepository {
  constructor(db: DatabaseConnection) {
    super(db, 'users');
  }

  public async save(user: User): Promise<User> {
    const row = this.mapEntityToRow(user) as Record<string, unknown>;
    
    try {
      // Check if user exists
      const existingUser = await this.findById(user.id);
      
      if (existingUser) {
        // Update existing user
        const { sql, params } = this.buildUpdateQuery(user.id.value, {
          ...row,
          updated_at: this.getCurrentTimestamp()
        });
        
        const result = await this.executeQueryOne(sql, params) as UserRow;
        return this.mapRowToEntity(result) as User;
      } else {
        // Insert new user
        const { sql, params } = this.buildInsertQuery(row);
        const result = await this.executeQueryOne(sql, params) as UserRow;
        return this.mapRowToEntity(result) as User;
      }
    } catch (error) {
      console.error('Failed to save user:', error);
      throw new Error('Failed to save user');
    }
  }

  public async findById(id: UserId): Promise<User | null> {
    if (!this.isValidUuid(id.value)) {
      return null;
    }

    const sql = `
      SELECT * FROM ${this.tableName} 
      WHERE id = $1 AND deleted_at IS NULL
    `;
    
    const row = await this.executeQueryOne(sql, [id.value]) as UserRow | null;
    return row ? this.mapRowToEntity(row) as User : null;
  }

  public async findByEmail(email: Email): Promise<User | null> {
    const sql = `
      SELECT * FROM ${this.tableName} 
      WHERE email = $1 AND deleted_at IS NULL
    `;
    
    const row = await this.executeQueryOne(sql, [email.value]) as UserRow | null;
    return row ? this.mapRowToEntity(row) as User : null;
  }

  public async findByUsername(username: Username): Promise<User | null> {
    const sql = `
      SELECT * FROM ${this.tableName} 
      WHERE username = $1 AND deleted_at IS NULL
    `;
    
    const row = await this.executeQueryOne(sql, [username.value]) as UserRow | null;
    return row ? this.mapRowToEntity(row) as User : null;
  }

  public async findMany(
    filters?: UserFilters,
    pagination?: PaginationOptions,
    sort?: SortOptions
  ): Promise<PaginatedResult<User>> {
    const validatedFilters = filters ? FilterValidator.validateUserFilters(filters) : {};
    
    const baseQuery = `SELECT * FROM ${this.tableName}`;
    const countQuery = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    
    // Convert filters to database format
    const dbFilters = this.convertFiltersToDb(validatedFilters);
    
    return this.executePaginatedQuery(
      baseQuery,
      countQuery,
      dbFilters,
      pagination,
      sort,
      (row) => this.mapRowToEntity(row) as User
    );
  }

  public async existsByEmail(email: Email): Promise<boolean> {
    const sql = `
      SELECT 1 FROM ${this.tableName} 
      WHERE email = $1 AND deleted_at IS NULL 
      LIMIT 1
    `;
    
    const result = await this.executeQueryOne(sql, [email.value]);
    return result !== null;
  }

  public async existsByUsername(username: Username): Promise<boolean> {
    const sql = `
      SELECT 1 FROM ${this.tableName} 
      WHERE username = $1 AND deleted_at IS NULL 
      LIMIT 1
    `;
    
    const result = await this.executeQueryOne(sql, [username.value]);
    return result !== null;
  }

  public async count(filters?: UserFilters): Promise<number> {
    const validatedFilters = filters ? FilterValidator.validateUserFilters(filters) : {};
    const dbFilters = this.convertFiltersToDb(validatedFilters);
    
    const { where, params } = this.buildWhereClause(dbFilters);
    const sql = `SELECT COUNT(*) as count FROM ${this.tableName} ${where}`;
    
    const result = await this.executeQueryOne(sql, params) as { count: string } | null;
    return parseInt(result?.count || '0', 10);
  }

  public async countActive(): Promise<number> {
    const sql = `
      SELECT COUNT(*) as count FROM ${this.tableName} 
      WHERE is_active = true AND deleted_at IS NULL
    `;
    
    const result = await this.executeQueryOne(sql) as { count: string } | null;
    return parseInt(result?.count || '0', 10);
  }

  public async countByRole(): Promise<Record<string, number>> {
    const sql = `
      SELECT role, COUNT(*) as count FROM ${this.tableName} 
      WHERE deleted_at IS NULL 
      GROUP BY role
    `;
    
    const rows = await this.executeQuery(sql) as Array<{ role: string; count: string }>;
    
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.role] = parseInt(row.count, 10);
    }
    
    return result;
  }

  public async findByCreatedDateRange(from: Date, to: Date): Promise<User[]> {
    const sql = `
      SELECT * FROM ${this.tableName} 
      WHERE created_at >= $1 AND created_at <= $2 AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;
    
    const rows = await this.executeQuery(sql, [from, to]) as UserRow[];
    return rows.map(row => this.mapRowToEntity(row) as User);
  }

  public async findInactiveUsers(since: Date): Promise<User[]> {
    const sql = `
      SELECT * FROM ${this.tableName} 
      WHERE (last_login_at IS NULL OR last_login_at < $1) 
        AND created_at < $1 
        AND deleted_at IS NULL
      ORDER BY created_at ASC
    `;
    
    const rows = await this.executeQuery(sql, [since]) as UserRow[];
    return rows.map(row => this.mapRowToEntity(row) as User);
  }

  public async softDelete(id: UserId): Promise<boolean> {
    if (!this.isValidUuid(id.value)) {
      return false;
    }

    const { sql, params } = this.buildSoftDeleteQuery(id.value);
    const result = await this.db.execute(sql, params);
    return result.affectedRows > 0;
  }

  public async hardDelete(id: UserId): Promise<boolean> {
    if (!this.isValidUuid(id.value)) {
      return false;
    }

    const sql = `DELETE FROM ${this.tableName} WHERE id = $1`;
    const result = await this.db.execute(sql, [id.value]);
    return result.affectedRows > 0;
  }

  public async restore(id: UserId): Promise<boolean> {
    if (!this.isValidUuid(id.value)) {
      return false;
    }

    const { sql, params } = this.buildRestoreQuery(id.value);
    const result = await this.db.execute(sql, params);
    return result.affectedRows > 0;
  }

  public async bulkSave(users: User[]): Promise<User[]> {
    if (users.length === 0) {
      return [];
    }

    return this.db.transaction(async (connection) => {
      const savedUsers: User[] = [];
      
      for (const user of users) {
        const tempRepo = new PostgresUserRepository(connection);
        const savedUser = await tempRepo.save(user);
        savedUsers.push(savedUser);
      }
      
      return savedUsers;
    });
  }

  public async bulkSoftDelete(ids: UserId[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const validIds = ids.filter(id => this.isValidUuid(id.value));
    if (validIds.length === 0) {
      return 0;
    }

    const placeholders = validIds.map((_, index) => `$${index + 1}`).join(', ');
    const sql = `
      UPDATE ${this.tableName} 
      SET deleted_at = CURRENT_TIMESTAMP 
      WHERE id IN (${placeholders}) AND deleted_at IS NULL
    `;
    
    const params = validIds.map(id => id.value);
    const result = await this.db.execute(sql, params);
    return result.affectedRows;
  }

  public async search(
    term: string,
    pagination?: PaginationOptions,
    filters?: UserFilters
  ): Promise<PaginatedResult<User>> {
    const validatedFilters = filters ? FilterValidator.validateUserFilters(filters) : {};
    const searchTerm = `%${this.escapeLikeString(term)}%`;
    
    const baseQuery = `
      SELECT * FROM ${this.tableName} 
      WHERE (
        username ILIKE $1 OR 
        email ILIKE $1 OR 
        display_name ILIKE $1 OR
        first_name ILIKE $1 OR
        last_name ILIKE $1
      )
    `;
    
    const countQuery = `
      SELECT COUNT(*) as count FROM ${this.tableName} 
      WHERE (
        username ILIKE $1 OR 
        email ILIKE $1 OR 
        display_name ILIKE $1 OR
        first_name ILIKE $1 OR
        last_name ILIKE $1
      )
    `;
    
    // Add additional filters
    const dbFilters = this.convertFiltersToDb(validatedFilters);
    const { where: additionalWhere, params: additionalParams } = this.buildWhereClause(dbFilters);
    
    const finalBaseQuery = additionalWhere 
      ? `${baseQuery} AND ${additionalWhere.replace('WHERE ', '')}`
      : baseQuery;
    const finalCountQuery = additionalWhere 
      ? `${countQuery} AND ${additionalWhere.replace('WHERE ', '')}`
      : countQuery;
    
    const allParams = [searchTerm, ...additionalParams];
    
    return this.executePaginatedQuery(
      finalBaseQuery,
      finalCountQuery,
      {},
      pagination,
      undefined,
      (row) => this.mapRowToEntity(row) as User
    );
  }

  protected mapRowToEntity(row: unknown): User {
    const userRow = row as UserRow;
    
    const userProps: UserProps = {
      id: UserId.fromString(userRow.id),
      email: Email.create(userRow.email),
      username: Username.create(userRow.username),
      password: HashedPassword.create(userRow.password_hash),
      role: UserRoleValidator.fromString(userRow.role),
      profile: {
        firstName: userRow.first_name,
        lastName: userRow.last_name,
        displayName: userRow.display_name,
        bio: userRow.bio,
        avatarUrl: userRow.avatar_url,
        country: userRow.country,
        dateOfBirth: userRow.date_of_birth,
        isPublic: userRow.is_public
      },
      isActive: userRow.is_active,
      isVerified: userRow.is_verified,
      createdAt: userRow.created_at,
      updatedAt: userRow.updated_at,
      lastLoginAt: userRow.last_login_at,
      deletedAt: userRow.deleted_at
    };
    
    return User.fromPersistence(userProps);
  }

  protected mapEntityToRow(entity: unknown): Record<string, unknown> {
    const user = entity as User;
    
    return {
      id: user.id.value,
      email: user.email.value,
      username: user.username.value,
      password_hash: user.password.value,
      role: user.role,
      first_name: user.profile.firstName,
      last_name: user.profile.lastName,
      display_name: user.profile.displayName,
      bio: user.profile.bio,
      avatar_url: user.profile.avatarUrl,
      country: user.profile.country,
      date_of_birth: user.profile.dateOfBirth,
      is_public: user.profile.isPublic,
      is_active: user.isActive,
      is_verified: user.isVerified,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
      last_login_at: user.lastLoginAt,
      deleted_at: user.deletedAt
    };
  }

  private convertFiltersToDb(filters: UserFilters): Record<string, unknown> {
    const dbFilters: Record<string, unknown> = {};
    
    if (filters.role) {
      dbFilters.role = filters.role;
    }
    
    if (filters.isActive !== undefined) {
      dbFilters.is_active = filters.isActive;
    }
    
    if (filters.isVerified !== undefined) {
      dbFilters.is_verified = filters.isVerified;
    }
    
    if (filters.createdAt) {
      dbFilters.created_at = filters.createdAt;
    }
    
    // Always exclude deleted users unless explicitly requested
    dbFilters.deleted_at = null;
    
    return dbFilters;
  }
}