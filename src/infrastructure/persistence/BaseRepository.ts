/**
 * BaseRepository
 * Base class for repository implementations with common functionality
 */

import { PaginatedResult, PaginationOptions, PaginationValidator } from '../../domain/repositories/types/PaginatedResult';
import { SortOptions } from '../../domain/repositories/types/FilterOptions';

export interface DatabaseConnection {
  query(sql: string, params?: unknown[]): Promise<unknown[]>;
  queryOne(sql: string, params?: unknown[]): Promise<unknown | null>;
  execute(sql: string, params?: unknown[]): Promise<{ affectedRows: number; insertId?: string }>;
  transaction<T>(callback: (connection: DatabaseConnection) => Promise<T>): Promise<T>;
}

export abstract class BaseRepository {
  protected readonly db: DatabaseConnection;
  protected readonly tableName: string;

  constructor(db: DatabaseConnection, tableName: string) {
    this.db = db;
    this.tableName = tableName;
  }

  /**
   * Build WHERE clause from filters
   */
  protected buildWhereClause(filters: Record<string, unknown>): { where: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null) {
        continue;
      }

      // Validate column name to prevent SQL injection
      if (!this.isValidColumnName(key)) {
        throw new Error(`Invalid column name: ${key}`);
      }

      if (Array.isArray(value)) {
        if (value.length > 0) {
          const placeholders = value.map(() => `$${paramIndex++}`).join(', ');
          conditions.push(`${key} IN (${placeholders})`);
          params.push(...value);
        }
      } else if (typeof value === 'object' && 'from' in value && 'to' in value) {
        // Date range filter
        const range = value as { from?: Date; to?: Date };
        if (range.from) {
          conditions.push(`${key} >= $${paramIndex++}`);
          params.push(range.from);
        }
        if (range.to) {
          conditions.push(`${key} <= $${paramIndex++}`);
          params.push(range.to);
        }
      } else if (typeof value === 'string' && key.endsWith('_search')) {
        // Text search
        const searchColumn = key.replace('_search', '');
        if (this.isValidColumnName(searchColumn)) {
          conditions.push(`${searchColumn} ILIKE $${paramIndex++}`);
          params.push(`%${value}%`);
        }
      } else {
        conditions.push(`${key} = $${paramIndex++}`);
        params.push(value);
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { where, params };
  }

  /**
   * Build ORDER BY clause
   */
  protected buildOrderByClause(sort?: SortOptions): string {
    if (!sort || !sort.field) {
      return '';
    }

    // Validate column name to prevent SQL injection
    if (!this.isValidColumnName(sort.field)) {
      throw new Error(`Invalid sort field: ${sort.field}`);
    }

    const direction = sort.direction === 'desc' ? 'DESC' : 'ASC';
    return `ORDER BY ${sort.field} ${direction}`;
  }

  /**
   * Build LIMIT and OFFSET clause
   */
  protected buildLimitClause(pagination?: PaginationOptions): { limit: string; params: unknown[] } {
    if (!pagination) {
      return { limit: '', params: [] };
    }

    const validatedPagination = PaginationValidator.validate(pagination);
    const offset = (validatedPagination.page - 1) * validatedPagination.pageSize;
    
    return {
      limit: `LIMIT $${1} OFFSET $${2}`,
      params: [validatedPagination.pageSize, offset]
    };
  }

  /**
   * Execute paginated query
   */
  protected async executePaginatedQuery<T>(
    baseQuery: string,
    countQuery: string,
    filters: Record<string, unknown>,
    pagination?: PaginationOptions,
    sort?: SortOptions,
    mapper?: (row: unknown) => T
  ): Promise<PaginatedResult<T>> {
    const validatedPagination = PaginationValidator.validate(pagination || {});
    
    // Build WHERE clause
    const { where, params: whereParams } = this.buildWhereClause(filters);
    
    // Build ORDER BY clause
    const orderBy = this.buildOrderByClause(sort);
    
    // Build LIMIT clause
    const { limit, params: limitParams } = this.buildLimitClause(validatedPagination);
    
    // Execute count query
    const countSql = `${countQuery} ${where}`;
    const countResult = await this.db.queryOne(countSql, whereParams) as { count: string } | null;
    const totalCount = parseInt(countResult?.count || '0', 10);
    
    // Execute data query
    const dataSql = `${baseQuery} ${where} ${orderBy} ${limit}`;
    const dataParams = [...whereParams, ...limitParams];
    const rows = await this.db.query(dataSql, dataParams);
    
    // Map results
    const items = mapper ? rows.map(mapper) : rows as T[];
    
    return PaginationValidator.createResult(items, totalCount, validatedPagination);
  }

  /**
   * Validate column name to prevent SQL injection
   */
  protected isValidColumnName(columnName: string): boolean {
    // Allow alphanumeric characters, underscores, and dots (for table.column)
    const columnRegex = /^[a-zA-Z_][a-zA-Z0-9_.]*$/;
    return columnRegex.test(columnName) && columnName.length <= 64;
  }

  /**
   * Escape string for LIKE queries
   */
  protected escapeLikeString(value: string): string {
    return value.replace(/[%_\\]/g, '\\$&');
  }

  /**
   * Build INSERT query
   */
  protected buildInsertQuery(data: Record<string, unknown>): { sql: string; params: unknown[] } {
    const columns = Object.keys(data).filter(key => data[key] !== undefined);
    const values = columns.map(key => data[key]);
    
    // Validate column names
    for (const column of columns) {
      if (!this.isValidColumnName(column)) {
        throw new Error(`Invalid column name: ${column}`);
      }
    }
    
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    const columnList = columns.join(', ');
    
    const sql = `INSERT INTO ${this.tableName} (${columnList}) VALUES (${placeholders}) RETURNING *`;
    
    return { sql, params: values };
  }

  /**
   * Build UPDATE query
   */
  protected buildUpdateQuery(
    id: string, 
    data: Record<string, unknown>
  ): { sql: string; params: unknown[] } {
    const columns = Object.keys(data).filter(key => data[key] !== undefined);
    const values = columns.map(key => data[key]);
    
    // Validate column names
    for (const column of columns) {
      if (!this.isValidColumnName(column)) {
        throw new Error(`Invalid column name: ${column}`);
      }
    }
    
    const setClause = columns.map((column, index) => `${column} = $${index + 1}`).join(', ');
    const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = $${columns.length + 1} RETURNING *`;
    
    return { sql, params: [...values, id] };
  }

  /**
   * Build soft delete query
   */
  protected buildSoftDeleteQuery(id: string): { sql: string; params: unknown[] } {
    const sql = `UPDATE ${this.tableName} SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL`;
    return { sql, params: [id] };
  }

  /**
   * Build restore query
   */
  protected buildRestoreQuery(id: string): { sql: string; params: unknown[] } {
    const sql = `UPDATE ${this.tableName} SET deleted_at = NULL WHERE id = $1`;
    return { sql, params: [id] };
  }

  /**
   * Convert database row to domain entity
   */
  protected abstract mapRowToEntity(row: unknown): unknown;

  /**
   * Convert domain entity to database row
   */
  protected abstract mapEntityToRow(entity: unknown): Record<string, unknown>;

  /**
   * Get current timestamp
   */
  protected getCurrentTimestamp(): Date {
    return new Date();
  }

  /**
   * Validate UUID format
   */
  protected isValidUuid(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Execute query with error handling
   */
  protected async executeQuery(sql: string, params?: unknown[]): Promise<unknown[]> {
    try {
      return await this.db.query(sql, params);
    } catch (error) {
      console.error('Database query failed:', { sql, params, error });
      throw new Error('Database operation failed');
    }
  }

  /**
   * Execute single query with error handling
   */
  protected async executeQueryOne(sql: string, params?: unknown[]): Promise<unknown | null> {
    try {
      return await this.db.queryOne(sql, params);
    } catch (error) {
      console.error('Database query failed:', { sql, params, error });
      throw new Error('Database operation failed');
    }
  }
}