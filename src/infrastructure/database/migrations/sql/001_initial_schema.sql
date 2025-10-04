
-- Initial database schema for Spotify API Security
-- Created: 2025-10-04T15:12:23.843Z

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
