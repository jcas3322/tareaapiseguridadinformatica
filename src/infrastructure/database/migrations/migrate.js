/**
 * Database Migration Runner (JavaScript version)
 * This file can be run directly with Node.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

class MigrationRunner {
  constructor() {
    const connectionString = this.buildConnectionString();
    this.pool = new Pool({
      connectionString,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });
  }

  buildConnectionString() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || '5432';
    const database = process.env.DB_NAME || 'spotify_api';
    const username = process.env.DB_USER || 'postgres';
    const password = process.env.DB_PASSWORD || '';

    return `postgresql://${username}:${password}@${host}:${port}/${database}`;
  }

  async createMigrationsTable() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    try {
      await this.pool.query(createTableSQL);
      console.log('✅ Migrations table created/verified');
    } catch (error) {
      console.error('❌ Error creating migrations table:', error);
      throw error;
    }
  }

  async getExecutedMigrations() {
    try {
      const result = await this.pool.query('SELECT name FROM migrations ORDER BY executed_at');
      return result.rows.map(row => row.name);
    } catch (error) {
      console.error('❌ Error getting executed migrations:', error);
      throw error;
    }
  }

  async executeMigration(migration) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Execute migration SQL
      await client.query(migration.sql);
      
      // Record migration as executed
      await client.query(
        'INSERT INTO migrations (name) VALUES ($1)',
        [migration.name]
      );
      
      await client.query('COMMIT');
      console.log(`✅ Migration executed: ${migration.name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Error executing migration ${migration.name}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async createInitialMigration() {
    const migrationsDir = path.join(__dirname, 'sql');
    
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
    }

    const initialMigrationSQL = `
-- Initial database schema for Spotify API Security
-- Created: ${new Date().toISOString()}

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'artist', 'user', 'moderator')),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Artists table
CREATE TABLE IF NOT EXISTS artists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stage_name VARCHAR(255) NOT NULL,
    bio TEXT,
    website VARCHAR(255),
    social_links JSONB,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Albums table
CREATE TABLE IF NOT EXISTS albums (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artist_id UUID REFERENCES artists(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    cover_image VARCHAR(500),
    release_date DATE,
    genre VARCHAR(100),
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Songs table
CREATE TABLE IF NOT EXISTS songs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artist_id UUID REFERENCES artists(id) ON DELETE CASCADE,
    album_id UUID REFERENCES albums(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    duration INTEGER, -- in seconds
    file_path VARCHAR(500),
    file_size BIGINT,
    mime_type VARCHAR(100),
    is_public BOOLEAN DEFAULT true,
    play_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Playlists table
CREATE TABLE IF NOT EXISTS playlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Playlist songs junction table
CREATE TABLE IF NOT EXISTS playlist_songs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE,
    song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(playlist_id, song_id)
);

-- User sessions table (for JWT token management)
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    refresh_token_hash VARCHAR(255),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Security events table
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    details JSONB,
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

CREATE INDEX IF NOT EXISTS idx_artists_user_id ON artists(user_id);
CREATE INDEX IF NOT EXISTS idx_artists_stage_name ON artists(stage_name);

CREATE INDEX IF NOT EXISTS idx_albums_artist_id ON albums(artist_id);
CREATE INDEX IF NOT EXISTS idx_albums_release_date ON albums(release_date);
CREATE INDEX IF NOT EXISTS idx_albums_genre ON albums(genre);

CREATE INDEX IF NOT EXISTS idx_songs_artist_id ON songs(artist_id);
CREATE INDEX IF NOT EXISTS idx_songs_album_id ON songs(album_id);
CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
CREATE INDEX IF NOT EXISTS idx_songs_created_at ON songs(created_at);

CREATE INDEX IF NOT EXISTS idx_playlists_user_id ON playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist_id ON playlist_songs(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_song_id ON playlist_songs(song_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_artists_updated_at BEFORE UPDATE ON artists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_albums_updated_at BEFORE UPDATE ON albums FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_songs_updated_at BEFORE UPDATE ON songs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_playlists_updated_at BEFORE UPDATE ON playlists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

    const migrationFile = path.join(migrationsDir, '001_initial_schema.sql');
    fs.writeFileSync(migrationFile, initialMigrationSQL);
    
    console.log('📝 Created initial migration file: 001_initial_schema.sql');
    
    // Now run the migration
    const migration = {
      id: '001_initial_schema',
      name: '001_initial_schema',
      sql: initialMigrationSQL,
      timestamp: new Date()
    };
    
    await this.executeMigration(migration);
  }

  async run() {
    try {
      console.log('🚀 Starting database migrations...');
      
      // Test connection
      await this.pool.query('SELECT NOW()');
      console.log('✅ Database connection established');

      // Create migrations table
      await this.createMigrationsTable();

      // Create initial migration
      console.log('⚠️  Creating initial migration...');
      await this.createInitialMigration();

      console.log('🎉 All migrations completed successfully!');

    } catch (error) {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    } finally {
      await this.pool.end();
    }
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  const runner = new MigrationRunner();
  runner.run().catch(console.error);
}

module.exports = { MigrationRunner };