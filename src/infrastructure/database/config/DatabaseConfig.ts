/**
 * Database Configuration Manager
 * Handles database connection configuration and validation
 */

import { DatabaseConfig as DatabaseConfigInterface } from '../../config/EnvironmentConfig';
import { Logger } from '../../logging/WinstonLogger';

export class DatabaseConfig {
  private static instance: DatabaseConfig;
  private config: DatabaseConfigInterface;
  private logger: Logger;

  private constructor(logger: Logger) {
    this.logger = logger;
    this.config = this.loadConfig();
    this.validateConfig();
  }

  public static getInstance(logger: Logger): DatabaseConfig {
    if (!DatabaseConfig.instance) {
      DatabaseConfig.instance = new DatabaseConfig(logger);
    }
    return DatabaseConfig.instance;
  }

  private loadConfig(): DatabaseConfigInterface {
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'spotify_api',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true',
      poolMin: parseInt(process.env.DB_POOL_MIN || '2'),
      poolMax: parseInt(process.env.DB_POOL_MAX || '20'),
      connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
      statementTimeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'),
      enableLogging: process.env.DB_ENABLE_LOGGING === 'true'
    };
  }

  private validateConfig(): void {
    const requiredFields = ['host', 'database', 'username'];
    const missingFields = requiredFields.filter(field => !this.config[field as keyof DatabaseConfigInterface]);

    if (missingFields.length > 0) {
      throw new Error(`Missing required database configuration: ${missingFields.join(', ')}`);
    }

    if (this.config.port < 1 || this.config.port > 65535) {
      throw new Error('Database port must be between 1 and 65535');
    }

    if (this.config.poolMin < 0 || this.config.poolMax < 1) {
      throw new Error('Invalid database pool configuration');
    }

    if (this.config.poolMin >= this.config.poolMax) {
      throw new Error('Database pool min must be less than max');
    }

    this.logger.debug('Database configuration validated', {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      ssl: this.config.ssl,
      poolMin: this.config.poolMin,
      poolMax: this.config.poolMax
    });
  }

  public getConfig(): DatabaseConfigInterface {
    return { ...this.config };
  }

  public getConnectionString(): string {
    const { host, port, database, username, password } = this.config;
    return `postgresql://${username}:${password}@${host}:${port}/${database}`;
  }

  public getPoolConfig(): any {
    return {
      connectionString: this.getConnectionString(),
      ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
      min: this.config.poolMin,
      max: this.config.poolMax,
      connectionTimeoutMillis: this.config.connectionTimeout,
      idleTimeoutMillis: 30000,
      query_timeout: this.config.statementTimeout
    };
  }
}