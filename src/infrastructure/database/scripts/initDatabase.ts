#!/usr/bin/env node

/**
 * Database Initialization Script
 * Initializes database with security configurations and runs migrations
 */

import { DatabaseConfig } from '../config/DatabaseConfig';
import { PostgreSQLAdapter } from '../adapters/PostgreSQLAdapter';
import { WinstonLogger } from '../../logging/WinstonLogger';
import { SSLConfig } from '../config/SSLConfig';

interface InitOptions {
  runMigrations: boolean;
  validateMigrations: boolean;
  createDatabase: boolean;
  setupSecurity: boolean;
  generateDevCerts: boolean;
  force: boolean;
}

class DatabaseInitializer {
  private logger: WinstonLogger;
  private sslConfig: SSLConfig;

  constructor() {
    // Initialize logger
    this.logger = new WinstonLogger({
      level: 'info',
      enableConsole: true,
      enableFile: false,
      logDirectory: './logs',
      maxFiles: '7d',
      maxSize: '10m',
      enableRotation: true,
      enableElastic: false,
      environment: process.env.NODE_ENV || 'development',
      serviceName: 'database-init'
    });

    this.sslConfig = SSLConfig.getInstance(this.logger);
  }

  /**
   * Initialize database with all configurations
   */
  public async initialize(options: InitOptions): Promise<void> {
    try {
      this.logger.info('Starting database initialization', options);

      // Generate development certificates if requested
      if (options.generateDevCerts) {
        await this.generateDevCertificates();
      }

      // Test SSL connection if enabled
      await this.testSSLConnection();

      // Create database if requested
      if (options.createDatabase) {
        await this.createDatabase();
      }

      // Initialize database adapter
      const dbConfig = DatabaseConfig.getInstance(this.logger);
      const dbAdapter = new PostgreSQLAdapter(dbConfig, this.logger);
      
      await dbAdapter.initialize();

      // Set up security configurations
      if (options.setupSecurity) {
        await this.setupSecurity(dbAdapter);
      }

      // Run migrations
      if (options.runMigrations) {
        await dbAdapter.migrate();
      }

      // Validate migrations
      if (options.validateMigrations) {
        const validation = await dbAdapter.validateMigrations();
        if (!validation.valid) {
          this.logger.error('Migration validation failed', new Error('Invalid migrations'), {
            issues: validation.issues
          });
          throw new Error('Migration validation failed');
        }
        this.logger.info('Migration validation passed');
      }

      // Perform health check
      const healthCheck = await dbAdapter.healthCheck();
      if (healthCheck.status !== 'healthy') {
        throw new Error(`Database health check failed: ${JSON.stringify(healthCheck.details)}`);
      }

      this.logger.info('Database initialization completed successfully', {
        status: healthCheck.status,
        metrics: healthCheck.details.metrics
      });

      await dbAdapter.close();

    } catch (error) {
      this.logger.error('Database initialization failed', error as Error);
      process.exit(1);
    }
  }

  /**
   * Generate development SSL certificates
   */
  private async generateDevCertificates(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      this.logger.warn('Skipping certificate generation in production');
      return;
    }

    const certDir = process.env.DB_SSL_CERT_DIR || './certs/postgresql';
    await this.sslConfig.generateDevCertificates(certDir);
  }

  /**
   * Test SSL connection
   */
  private async testSSLConnection(): Promise<void> {
    const host = process.env.DB_HOST || 'localhost';
    const port = parseInt(process.env.DB_PORT || '5432');

    const sslWorking = await this.sslConfig.testSSLConnection(host, port);
    
    if (!sslWorking && process.env.NODE_ENV === 'production') {
      throw new Error('SSL connection test failed in production environment');
    }

    this.logger.info('SSL connection test completed', {
      host,
      port,
      sslWorking,
      sslConfig: this.sslConfig.getConfigSummary()
    });
  }

  /**
   * Create database if it doesn't exist
   */
  private async createDatabase(): Promise<void> {
    const { Pool } = require('pg');
    
    // Connect to postgres database to create our application database
    const adminPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: 'postgres', // Connect to default postgres database
      user: process.env.DB_ADMIN_USER || process.env.DB_USER || 'postgres',
      password: process.env.DB_ADMIN_PASSWORD || process.env.DB_PASSWORD,
      ssl: this.sslConfig.getSSLConfig()
    });

    try {
      const dbName = process.env.DB_NAME || 'spotify_api';
      const dbUser = process.env.DB_USER || 'spotify_user';
      const dbPassword = process.env.DB_PASSWORD || 'spotify_password';

      // Check if database exists
      const dbCheckResult = await adminPool.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [dbName]
      );

      if (dbCheckResult.rows.length === 0) {
        this.logger.info('Creating database', { dbName });
        await adminPool.query(`CREATE DATABASE "${dbName}"`);
      } else {
        this.logger.info('Database already exists', { dbName });
      }

      // Check if user exists
      const userCheckResult = await adminPool.query(
        'SELECT 1 FROM pg_roles WHERE rolname = $1',
        [dbUser]
      );

      if (userCheckResult.rows.length === 0) {
        this.logger.info('Creating database user', { dbUser });
        await adminPool.query(
          `CREATE USER "${dbUser}" WITH PASSWORD '${dbPassword}'`
        );
        
        // Grant necessary permissions
        await adminPool.query(`GRANT CONNECT ON DATABASE "${dbName}" TO "${dbUser}"`);
        await adminPool.query(`GRANT USAGE ON SCHEMA public TO "${dbUser}"`);
        await adminPool.query(`GRANT CREATE ON SCHEMA public TO "${dbUser}"`);
      } else {
        this.logger.info('Database user already exists', { dbUser });
      }

    } catch (error) {
      this.logger.error('Failed to create database', error as Error);
      throw error;
    } finally {
      await adminPool.end();
    }
  }

  /**
   * Set up database security configurations
   */
  private async setupSecurity(dbAdapter: PostgreSQLAdapter): Promise<void> {
    this.logger.info('Setting up database security configurations');

    const securityQueries = [
      // Enable row level security
      "ALTER DATABASE current SET row_security = on;",
      
      // Set secure connection parameters
      "ALTER SYSTEM SET ssl = on;",
      "ALTER SYSTEM SET ssl_cert_file = 'server.crt';",
      "ALTER SYSTEM SET ssl_key_file = 'server.key';",
      "ALTER SYSTEM SET ssl_ca_file = 'ca.crt';",
      
      // Set secure authentication
      "ALTER SYSTEM SET password_encryption = 'scram-sha-256';",
      
      // Set connection limits
      "ALTER SYSTEM SET max_connections = 100;",
      "ALTER SYSTEM SET superuser_reserved_connections = 3;",
      
      // Set logging for security
      "ALTER SYSTEM SET log_connections = on;",
      "ALTER SYSTEM SET log_disconnections = on;",
      "ALTER SYSTEM SET log_checkpoints = on;",
      "ALTER SYSTEM SET log_lock_waits = on;",
      "ALTER SYSTEM SET log_statement = 'mod';",
      "ALTER SYSTEM SET log_min_duration_statement = 1000;",
      
      // Set timeouts
      "ALTER SYSTEM SET statement_timeout = '30s';",
      "ALTER SYSTEM SET idle_in_transaction_session_timeout = '10min';",
      
      // Disable dangerous functions in production
      ...(process.env.NODE_ENV === 'production' ? [
        "ALTER SYSTEM SET shared_preload_libraries = '';",
        "ALTER SYSTEM SET local_preload_libraries = '';",
      ] : [])
    ];

    for (const query of securityQueries) {
      try {
        await dbAdapter.query(query);
        this.logger.debug('Executed security query', { query: query.substring(0, 50) + '...' });
      } catch (error) {
        // Some queries might fail if already set or insufficient permissions
        this.logger.warn('Security query failed (may be expected)', {
          query: query.substring(0, 50) + '...',
          error: (error as Error).message
        });
      }
    }

    // Create security functions
    await this.createSecurityFunctions(dbAdapter);
    
    this.logger.info('Database security setup completed');
  }

  /**
   * Create security-related database functions
   */
  private async createSecurityFunctions(dbAdapter: PostgreSQLAdapter): Promise<void> {
    const securityFunctions = [
      // Function to log security events
      `
      CREATE OR REPLACE FUNCTION log_security_event(
        event_type TEXT,
        user_id UUID DEFAULT NULL,
        details JSONB DEFAULT '{}'::jsonb
      ) RETURNS VOID AS $$
      BEGIN
        INSERT INTO security_events (event_type, user_id, details, created_at)
        VALUES (event_type, user_id, details, NOW());
      EXCEPTION WHEN OTHERS THEN
        -- Ignore errors to prevent breaking application flow
        NULL;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
      `,

      // Function to check password strength
      `
      CREATE OR REPLACE FUNCTION check_password_strength(password TEXT)
      RETURNS BOOLEAN AS $$
      BEGIN
        RETURN validate_password_strength(password);
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
      `,

      // Function to audit table changes
      `
      CREATE OR REPLACE FUNCTION audit_table_changes()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          PERFORM log_security_event('table_insert', 
            COALESCE(NEW.created_by, NEW.user_id), 
            jsonb_build_object('table', TG_TABLE_NAME, 'record_id', NEW.id)
          );
          RETURN NEW;
        ELSIF TG_OP = 'UPDATE' THEN
          PERFORM log_security_event('table_update', 
            COALESCE(NEW.updated_by, NEW.user_id), 
            jsonb_build_object('table', TG_TABLE_NAME, 'record_id', NEW.id)
          );
          RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
          PERFORM log_security_event('table_delete', 
            COALESCE(OLD.updated_by, OLD.user_id), 
            jsonb_build_object('table', TG_TABLE_NAME, 'record_id', OLD.id)
          );
          RETURN OLD;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
      `
    ];

    // Create security events table first
    await dbAdapter.query(`
      CREATE TABLE IF NOT EXISTS security_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        event_type VARCHAR(100) NOT NULL,
        user_id UUID,
        details JSONB DEFAULT '{}'::jsonb,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);
    `);

    // Create security functions
    for (const func of securityFunctions) {
      try {
        await dbAdapter.query(func);
      } catch (error) {
        this.logger.warn('Failed to create security function', {
          error: (error as Error).message
        });
      }
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  const options: InitOptions = {
    runMigrations: args.includes('--migrate') || args.includes('--all'),
    validateMigrations: args.includes('--validate') || args.includes('--all'),
    createDatabase: args.includes('--create-db') || args.includes('--all'),
    setupSecurity: args.includes('--security') || args.includes('--all'),
    generateDevCerts: args.includes('--dev-certs'),
    force: args.includes('--force')
  };

  // Show help
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Database Initialization Script

Usage: node initDatabase.js [options]

Options:
  --all           Run all initialization steps
  --create-db     Create database and user
  --migrate       Run database migrations
  --validate      Validate migration checksums
  --security      Set up security configurations
  --dev-certs     Generate development SSL certificates
  --force         Force initialization even if database exists
  --help, -h      Show this help message

Environment Variables:
  DB_HOST         Database host (default: localhost)
  DB_PORT         Database port (default: 5432)
  DB_NAME         Database name (default: spotify_api)
  DB_USER         Database user (default: spotify_user)
  DB_PASSWORD     Database password
  DB_ADMIN_USER   Admin user for database creation
  DB_ADMIN_PASSWORD Admin password for database creation
  DB_SSL_ENABLED  Enable SSL (default: true in production)
  DB_SSL_CERT_DIR SSL certificate directory
  NODE_ENV        Environment (development/staging/production)

Examples:
  node initDatabase.js --all
  node initDatabase.js --create-db --migrate
  node initDatabase.js --dev-certs --migrate
    `);
    process.exit(0);
  }

  // Require at least one option
  if (!Object.values(options).some(Boolean)) {
    console.error('Error: At least one option is required. Use --help for usage information.');
    process.exit(1);
  }

  const initializer = new DatabaseInitializer();
  await initializer.initialize(options);
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Database initialization failed:', error);
    process.exit(1);
  });
}

export { DatabaseInitializer };