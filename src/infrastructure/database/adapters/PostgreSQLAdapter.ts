/**
 * PostgreSQL Database Adapter
 * Handles database connections and operations
 */

import { Pool, PoolClient } from 'pg';
import { DatabaseConfig } from '../config/DatabaseConfig';
import { Logger } from '../../logging/WinstonLogger';

export class PostgreSQLAdapter {
  private pool!: Pool;
  private config: DatabaseConfig;
  private logger: Logger;
  private isInitialized = false;

  constructor(config: DatabaseConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('PostgreSQL adapter already initialized');
      return;
    }

    try {
      this.logger.info('Initializing PostgreSQL connection pool...');
      
      const poolConfig = this.config.getPoolConfig();
      this.pool = new Pool(poolConfig);

      // Test connection
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW() as current_time, version() as version');
      client.release();

      this.logger.info('PostgreSQL connection established', {
        currentTime: result.rows[0].current_time,
        version: result.rows[0].version.split(' ')[0],
        poolSize: poolConfig.max
      });

      // Setup pool event handlers
      this.setupPoolEventHandlers();

      this.isInitialized = true;

    } catch (error) {
      this.logger.error('Failed to initialize PostgreSQL adapter', error);
      throw error;
    }
  }

  private setupPoolEventHandlers(): void {
    this.pool.on('connect', (client) => {
      this.logger.debug('New client connected to PostgreSQL', {
        processID: (client as any).processID
      });
    });

    this.pool.on('acquire', (client) => {
      this.logger.debug('Client acquired from pool', {
        processID: (client as any).processID
      });
    });

    this.pool.on('error', (error, client) => {
      this.logger.error('PostgreSQL pool error', {
        error: error.message,
        processID: client ? (client as any).processID : 'unknown'
      });
    });

    this.pool.on('remove', (client) => {
      this.logger.debug('Client removed from pool', {
        processID: (client as any).processID
      });
    });
  }

  public async query(text: string, params?: any[]): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('PostgreSQL adapter not initialized');
    }

    const start = Date.now();
    
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;

      this.logger.debug('Query executed', {
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: `${duration}ms`,
        rowCount: result.rowCount
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      
      this.logger.error('Query failed', {
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  public async getClient(): Promise<PoolClient> {
    if (!this.isInitialized) {
      throw new Error('PostgreSQL adapter not initialized');
    }

    return await this.pool.connect();
  }

  public async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async migrate(): Promise<void> {
    this.logger.info('Running database migrations...');
    
    try {
      // Check if migrations table exists
      const migrationTableExists = await this.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'migrations'
        );
      `);

      if (!migrationTableExists.rows[0].exists) {
        this.logger.info('Creating migrations table...');
        await this.query(`
          CREATE TABLE migrations (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
      }

      // Check if main tables exist
      const tablesExist = await this.query(`
        SELECT COUNT(*) as table_count
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('users', 'artists', 'albums', 'songs')
      `);

      const tableCount = parseInt(tablesExist.rows[0].table_count);
      
      if (tableCount < 4) {
        this.logger.info('Main tables missing, migrations may be needed');
        this.logger.info('Run: npm run migrate to execute database migrations');
      } else {
        this.logger.info('Database schema appears to be up to date');
      }

    } catch (error) {
      this.logger.error('Migration check failed', error);
      // Don't throw here, let the application continue
    }
  }

  public async healthCheck(): Promise<{ status: string; details?: any }> {
    try {
      const start = Date.now();
      const result = await this.query('SELECT 1 as health_check');
      const duration = Date.now() - start;

      return {
        status: 'healthy',
        details: {
          responseTime: `${duration}ms`,
          totalConnections: this.pool.totalCount,
          idleConnections: this.pool.idleCount,
          waitingConnections: this.pool.waitingCount
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  public async close(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    this.logger.info('Closing PostgreSQL connection pool...');
    
    try {
      await this.pool.end();
      this.isInitialized = false;
      this.logger.info('PostgreSQL connection pool closed');
    } catch (error) {
      this.logger.error('Error closing PostgreSQL connection pool', error);
      throw error;
    }
  }

  public getPool(): Pool {
    return this.pool;
  }

  public isReady(): boolean {
    return this.isInitialized;
  }
}