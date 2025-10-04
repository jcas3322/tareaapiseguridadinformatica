/**
 * MigrationRunner
 * Database migration system with security and audit features
 */

import { Pool } from 'pg';
import { Logger } from '../../../application/ports/Logger';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface Migration {
  id: string;
  name: string;
  version: string;
  description: string;
  up: string;
  down: string;
  checksum: string;
  createdAt: Date;
  executedAt?: Date;
  executionTime?: number;
  status: 'pending' | 'executed' | 'failed' | 'rolled_back';
}

export interface MigrationResult {
  success: boolean;
  migration: Migration;
  executionTime: number;
  error?: Error;
}

export class MigrationRunner {
  private readonly migrationsTable = 'schema_migrations';
  private readonly migrationsDir: string;

  constructor(
    private readonly pool: Pool,
    private readonly logger: Logger,
    migrationsDir?: string
  ) {
    this.migrationsDir = migrationsDir || path.join(__dirname, 'sql');
  }

  /**
   * Initialize migration system
   */
  public async initialize(): Promise<void> {
    await this.createMigrationsTable();
    this.logger.info('Migration system initialized');
  }

  /**
   * Create migrations tracking table
   */
  private async createMigrationsTable(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${this.migrationsTable} (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        version VARCHAR(50) NOT NULL,
        description TEXT,
        checksum VARCHAR(64) NOT NULL,
        up_sql TEXT NOT NULL,
        down_sql TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        executed_at TIMESTAMP WITH TIME ZONE,
        execution_time INTEGER,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        executed_by VARCHAR(255),
        rollback_reason TEXT,
        CONSTRAINT valid_status CHECK (status IN ('pending', 'executed', 'failed', 'rolled_back'))
      );

      CREATE INDEX IF NOT EXISTS idx_schema_migrations_status ON ${this.migrationsTable}(status);
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON ${this.migrationsTable}(version);
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_executed_at ON ${this.migrationsTable}(executed_at);
    `;

    await this.pool.query(createTableSQL);
  }

  /**
   * Load migration files from directory
   */
  public async loadMigrations(): Promise<Migration[]> {
    const migrations: Migration[] = [];

    if (!fs.existsSync(this.migrationsDir)) {
      this.logger.warn('Migrations directory does not exist', {
        directory: this.migrationsDir
      });
      return migrations;
    }

    const files = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      try {
        const migration = await this.loadMigrationFile(file);
        migrations.push(migration);
      } catch (error) {
        this.logger.error('Failed to load migration file', error as Error, {
          file
        });
        throw error;
      }
    }

    this.logger.info('Loaded migration files', {
      count: migrations.length,
      files: files
    });

    return migrations;
  }

  /**
   * Load individual migration file
   */
  private async loadMigrationFile(filename: string): Promise<Migration> {
    const filePath = path.join(this.migrationsDir, filename);
    const content = fs.readFileSync(filePath, 'utf8');

    // Parse migration file format
    const parsed = this.parseMigrationFile(content, filename);
    const checksum = this.calculateChecksum(content);

    return {
      id: parsed.id,
      name: parsed.name,
      version: parsed.version,
      description: parsed.description,
      up: parsed.up,
      down: parsed.down,
      checksum,
      createdAt: new Date(),
      status: 'pending'
    };
  }

  /**
   * Parse migration file content
   */
  private parseMigrationFile(content: string, filename: string): any {
    const lines = content.split('\n');
    let currentSection = '';
    let up = '';
    let down = '';
    let metadata: any = {};

    for (const line of lines) {
      const trimmed = line.trim();

      // Parse metadata comments
      if (trimmed.startsWith('-- @')) {
        const [key, ...valueParts] = trimmed.substring(4).split(':');
        metadata[key.trim()] = valueParts.join(':').trim();
        continue;
      }

      // Section markers
      if (trimmed === '-- UP') {
        currentSection = 'up';
        continue;
      }
      if (trimmed === '-- DOWN') {
        currentSection = 'down';
        continue;
      }

      // Add content to appropriate section
      if (currentSection === 'up') {
        up += line + '\n';
      } else if (currentSection === 'down') {
        down += line + '\n';
      }
    }

    // Extract ID and version from filename if not in metadata
    const filenameParts = filename.replace('.sql', '').split('_');
    const id = metadata.id || filenameParts[0];
    const version = metadata.version || filenameParts[0];
    const name = metadata.name || filenameParts.slice(1).join('_');

    return {
      id,
      name,
      version,
      description: metadata.description || '',
      up: up.trim(),
      down: down.trim()
    };
  }

  /**
   * Calculate checksum for migration content
   */
  private calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get pending migrations
   */
  public async getPendingMigrations(): Promise<Migration[]> {
    const allMigrations = await this.loadMigrations();
    const executedMigrations = await this.getExecutedMigrations();
    const executedIds = new Set(executedMigrations.map(m => m.id));

    return allMigrations.filter(m => !executedIds.has(m.id));
  }

  /**
   * Get executed migrations from database
   */
  public async getExecutedMigrations(): Promise<Migration[]> {
    const result = await this.pool.query(`
      SELECT * FROM ${this.migrationsTable}
      WHERE status = 'executed'
      ORDER BY executed_at ASC
    `);

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      version: row.version,
      description: row.description,
      up: row.up_sql,
      down: row.down_sql,
      checksum: row.checksum,
      createdAt: row.created_at,
      executedAt: row.executed_at,
      executionTime: row.execution_time,
      status: row.status
    }));
  }

  /**
   * Run pending migrations
   */
  public async migrate(): Promise<MigrationResult[]> {
    const pendingMigrations = await this.getPendingMigrations();
    
    if (pendingMigrations.length === 0) {
      this.logger.info('No pending migrations to run');
      return [];
    }

    this.logger.info('Starting migration process', {
      pendingCount: pendingMigrations.length,
      migrations: pendingMigrations.map(m => m.id)
    });

    const results: MigrationResult[] = [];

    for (const migration of pendingMigrations) {
      const result = await this.runMigration(migration);
      results.push(result);

      if (!result.success) {
        this.logger.error('Migration failed, stopping process', result.error!, {
          failedMigration: migration.id,
          executedMigrations: results.filter(r => r.success).map(r => r.migration.id)
        });
        break;
      }
    }

    const successCount = results.filter(r => r.success).length;
    this.logger.info('Migration process completed', {
      total: results.length,
      successful: successCount,
      failed: results.length - successCount
    });

    return results;
  }

  /**
   * Run single migration
   */
  private async runMigration(migration: Migration): Promise<MigrationResult> {
    const startTime = Date.now();

    try {
      // Record migration start
      await this.recordMigrationStart(migration);

      // Execute migration in transaction
      await this.pool.query('BEGIN');
      
      this.logger.info('Executing migration', {
        id: migration.id,
        name: migration.name,
        version: migration.version
      });

      // Execute the UP script
      await this.pool.query(migration.up);

      // Record successful execution
      const executionTime = Date.now() - startTime;
      await this.recordMigrationSuccess(migration, executionTime);

      await this.pool.query('COMMIT');

      this.logger.info('Migration executed successfully', {
        id: migration.id,
        executionTime
      });

      return {
        success: true,
        migration,
        executionTime
      };

    } catch (error) {
      await this.pool.query('ROLLBACK');
      
      const executionTime = Date.now() - startTime;
      await this.recordMigrationFailure(migration, error as Error, executionTime);

      this.logger.error('Migration execution failed', error as Error, {
        id: migration.id,
        name: migration.name,
        executionTime
      });

      return {
        success: false,
        migration,
        executionTime,
        error: error as Error
      };
    }
  }

  /**
   * Record migration start in database
   */
  private async recordMigrationStart(migration: Migration): Promise<void> {
    await this.pool.query(`
      INSERT INTO ${this.migrationsTable} 
      (id, name, version, description, checksum, up_sql, down_sql, status, executed_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
      ON CONFLICT (id) DO UPDATE SET
        status = 'pending',
        executed_at = NULL,
        execution_time = NULL
    `, [
      migration.id,
      migration.name,
      migration.version,
      migration.description,
      migration.checksum,
      migration.up,
      migration.down,
      process.env.USER || 'system'
    ]);
  }

  /**
   * Record successful migration execution
   */
  private async recordMigrationSuccess(migration: Migration, executionTime: number): Promise<void> {
    await this.pool.query(`
      UPDATE ${this.migrationsTable}
      SET status = 'executed',
          executed_at = NOW(),
          execution_time = $2
      WHERE id = $1
    `, [migration.id, executionTime]);
  }

  /**
   * Record failed migration execution
   */
  private async recordMigrationFailure(migration: Migration, error: Error, executionTime: number): Promise<void> {
    await this.pool.query(`
      UPDATE ${this.migrationsTable}
      SET status = 'failed',
          execution_time = $2
      WHERE id = $1
    `, [migration.id, executionTime]);
  }

  /**
   * Rollback last migration
   */
  public async rollback(): Promise<MigrationResult | null> {
    const lastMigration = await this.getLastExecutedMigration();
    
    if (!lastMigration) {
      this.logger.info('No migrations to rollback');
      return null;
    }

    return await this.rollbackMigration(lastMigration);
  }

  /**
   * Get last executed migration
   */
  private async getLastExecutedMigration(): Promise<Migration | null> {
    const result = await this.pool.query(`
      SELECT * FROM ${this.migrationsTable}
      WHERE status = 'executed'
      ORDER BY executed_at DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      version: row.version,
      description: row.description,
      up: row.up_sql,
      down: row.down_sql,
      checksum: row.checksum,
      createdAt: row.created_at,
      executedAt: row.executed_at,
      executionTime: row.execution_time,
      status: row.status
    };
  }

  /**
   * Rollback specific migration
   */
  private async rollbackMigration(migration: Migration): Promise<MigrationResult> {
    const startTime = Date.now();

    try {
      await this.pool.query('BEGIN');

      this.logger.info('Rolling back migration', {
        id: migration.id,
        name: migration.name
      });

      // Execute the DOWN script
      await this.pool.query(migration.down);

      // Record rollback
      const executionTime = Date.now() - startTime;
      await this.pool.query(`
        UPDATE ${this.migrationsTable}
        SET status = 'rolled_back',
            execution_time = $2,
            rollback_reason = 'Manual rollback'
        WHERE id = $1
      `, [migration.id, executionTime]);

      await this.pool.query('COMMIT');

      this.logger.info('Migration rolled back successfully', {
        id: migration.id,
        executionTime
      });

      return {
        success: true,
        migration,
        executionTime
      };

    } catch (error) {
      await this.pool.query('ROLLBACK');
      
      const executionTime = Date.now() - startTime;
      
      this.logger.error('Migration rollback failed', error as Error, {
        id: migration.id,
        name: migration.name,
        executionTime
      });

      return {
        success: false,
        migration,
        executionTime,
        error: error as Error
      };
    }
  }

  /**
   * Get migration status
   */
  public async getStatus(): Promise<any> {
    const allMigrations = await this.loadMigrations();
    const executedMigrations = await this.getExecutedMigrations();
    const pendingMigrations = await this.getPendingMigrations();

    return {
      total: allMigrations.length,
      executed: executedMigrations.length,
      pending: pendingMigrations.length,
      lastExecuted: executedMigrations[executedMigrations.length - 1]?.id || null,
      migrations: allMigrations.map(m => ({
        id: m.id,
        name: m.name,
        version: m.version,
        status: executedMigrations.find(em => em.id === m.id) ? 'executed' : 'pending'
      }))
    };
  }

  /**
   * Validate migration checksums
   */
  public async validateChecksums(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];
    const executedMigrations = await this.getExecutedMigrations();
    const fileMigrations = await this.loadMigrations();

    for (const executed of executedMigrations) {
      const fileMigration = fileMigrations.find(f => f.id === executed.id);
      
      if (!fileMigration) {
        issues.push(`Migration ${executed.id} exists in database but file not found`);
        continue;
      }

      if (executed.checksum !== fileMigration.checksum) {
        issues.push(`Migration ${executed.id} checksum mismatch (file modified after execution)`);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}