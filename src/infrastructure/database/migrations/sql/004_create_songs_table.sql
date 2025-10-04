-- @id: 004
-- @name: create_songs_table
-- @version: 1.0.0
-- @description: Create songs table with audio file management and metadata

-- UP
-- Create enum types for songs
CREATE TYPE song_status AS ENUM ('draft', 'published', 'archived', 'deleted');
CREATE TYPE audio_quality AS ENUM ('low', 'medium', 'high', 'lossless');

-- Create songs table
CREATE TABLE songs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artist_id UUID NOT NULL,
    album_id UUID, -- Optional, can be a single
    
    -- Song basic information
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status song_status NOT NULL DEFAULT 'draft',
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Song metadata
    duration INTEGER NOT NULL, -- in seconds
    genre artist_genre,
    secondary_genres artist_genre[],
    track_number INTEGER,
    disc_number INTEGER DEFAULT 1,
    
    -- Audio file information
    audio_file_url VARCHAR(500),
    audio_file_size BIGINT, -- in bytes
    audio_format VARCHAR(10), -- mp3, wav, flac, etc.
    audio_quality audio_quality DEFAULT 'medium',
    audio_bitrate INTEGER, -- in kbps
    audio_sample_rate INTEGER, -- in Hz
    
    -- Waveform and analysis data
    waveform_data JSONB, -- Waveform peaks for visualization
    audio_fingerprint VARCHAR(255), -- For duplicate detection
    bpm INTEGER, -- Beats per minute
    key_signature VARCHAR(10), -- Musical key (C, C#, Dm, etc.)
    
    -- Lyrics and content
    lyrics TEXT,
    explicit_content BOOLEAN NOT NULL DEFAULT FALSE,
    language CHAR(2), -- ISO 639-1 language code
    
    -- Copyright and licensing
    copyright_notice TEXT,
    license_type VARCHAR(50) DEFAULT 'all_rights_reserved',
    isrc VARCHAR(12), -- International Standard Recording Code
    
    -- Statistics (denormalized for performance)
    total_plays BIGINT NOT NULL DEFAULT 0,
    total_likes INTEGER NOT NULL DEFAULT 0,
    total_shares INTEGER NOT NULL DEFAULT 0,
    total_downloads INTEGER NOT NULL DEFAULT 0,
    
    -- SEO and discovery
    slug VARCHAR(250),
    tags TEXT[],
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Foreign key constraints
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Constraints
    CONSTRAINT songs_title_length CHECK (char_length(title) >= 1),
    CONSTRAINT songs_description_length CHECK (char_length(description) <= 1000),
    CONSTRAINT songs_duration_positive CHECK (duration > 0),
    CONSTRAINT songs_track_number_positive CHECK (track_number IS NULL OR track_number > 0),
    CONSTRAINT songs_disc_number_positive CHECK (disc_number > 0),
    CONSTRAINT songs_audio_file_size_positive CHECK (audio_file_size IS NULL OR audio_file_size > 0),
    CONSTRAINT songs_audio_bitrate_valid CHECK (audio_bitrate IS NULL OR audio_bitrate BETWEEN 32 AND 320),
    CONSTRAINT songs_bpm_valid CHECK (bpm IS NULL OR bpm BETWEEN 60 AND 200),
    CONSTRAINT songs_isrc_format CHECK (isrc IS NULL OR isrc ~* '^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$'),
    CONSTRAINT songs_language_format CHECK (language IS NULL OR language ~* '^[a-z]{2}$'),
    CONSTRAINT songs_stats_positive CHECK (
        total_plays >= 0 AND 
        total_likes >= 0 AND 
        total_shares >= 0 AND
        total_downloads >= 0
    )
);

-- Create indexes
CREATE INDEX idx_songs_artist_id ON songs(artist_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_songs_album_id ON songs(album_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_songs_title ON songs(title) WHERE deleted_at IS NULL;
CREATE INDEX idx_songs_status ON songs(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_songs_genre ON songs(genre) WHERE deleted_at IS NULL;
CREATE INDEX idx_songs_duration ON songs(duration) WHERE deleted_at IS NULL;
CREATE INDEX idx_songs_track_number ON songs(track_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_songs_is_public ON songs(is_public);
CREATE INDEX idx_songs_explicit_content ON songs(explicit_content);
CREATE INDEX idx_songs_created_at ON songs(created_at);
CREATE INDEX idx_songs_updated_at ON songs(updated_at);
CREATE INDEX idx_songs_published_at ON songs(published_at);
CREATE INDEX idx_songs_total_plays ON songs(total_plays) WHERE deleted_at IS NULL;

-- GIN indexes for arrays and JSONB
CREATE INDEX idx_songs_secondary_genres ON songs USING GIN(secondary_genres);
CREATE INDEX idx_songs_tags ON songs USING GIN(tags);
CREATE INDEX idx_songs_waveform_data ON songs USING GIN(waveform_data);

-- Full-text search index
CREATE INDEX idx_songs_search ON songs USING GIN(
    to_tsvector('english', 
        COALESCE(title, '') || ' ' || 
        COALESCE(description, '') || ' ' || 
        COALESCE(lyrics, '')
    )
) WHERE deleted_at IS NULL;

-- Unique index for audio fingerprint (prevent duplicates)
CREATE UNIQUE INDEX idx_songs_audio_fingerprint ON songs(audio_fingerprint) 
WHERE audio_fingerprint IS NOT NULL AND deleted_at IS NULL;

-- Composite index for album track ordering
CREATE INDEX idx_songs_album_track_order ON songs(album_id, disc_number, track_number) 
WHERE deleted_at IS NULL;

-- Create trigger for updated_at
CREATE TRIGGER trigger_songs_updated_at
    BEFORE UPDATE ON songs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create song collaborators table
CREATE TABLE song_collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    song_id UUID NOT NULL,
    collaborator_id UUID NOT NULL, -- Can be artist_id or user_id
    collaborator_type VARCHAR(50) NOT NULL, -- 'featured_artist', 'songwriter', 'producer', etc.
    role_description VARCHAR(200),
    credit_order INTEGER DEFAULT 1,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
    
    -- Prevent duplicate collaborations
    UNIQUE(song_id, collaborator_id, collaborator_type)
);

-- Create indexes for song collaborators
CREATE INDEX idx_song_collaborators_song_id ON song_collaborators(song_id);
CREATE INDEX idx_song_collaborators_collaborator_id ON song_collaborators(collaborator_id);
CREATE INDEX idx_song_collaborators_type ON song_collaborators(collaborator_type);

-- Create song likes table
CREATE TABLE song_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    song_id UUID NOT NULL,
    user_id UUID NOT NULL,
    liked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Prevent duplicate likes
    UNIQUE(song_id, user_id)
);

-- Create indexes for song likes
CREATE INDEX idx_song_likes_song_id ON song_likes(song_id);
CREATE INDEX idx_song_likes_user_id ON song_likes(user_id);
CREATE INDEX idx_song_likes_liked_at ON song_likes(liked_at);

-- Create song plays table for analytics
CREATE TABLE song_plays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    song_id UUID NOT NULL,
    user_id UUID, -- NULL for anonymous plays
    
    -- Play context
    played_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    play_duration INTEGER, -- How long the song was played (in seconds)
    completion_percentage DECIMAL(5,2), -- Percentage of song completed
    
    -- Context information
    source VARCHAR(50), -- 'web', 'mobile', 'api', etc.
    playlist_id UUID, -- If played from a playlist
    album_id UUID, -- If played from an album
    
    -- User context
    ip_address INET,
    user_agent TEXT,
    country CHAR(2),
    
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for song plays (optimized for analytics)
CREATE INDEX idx_song_plays_song_id ON song_plays(song_id);
CREATE INDEX idx_song_plays_user_id ON song_plays(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_song_plays_played_at ON song_plays(played_at);
CREATE INDEX idx_song_plays_country ON song_plays(country) WHERE country IS NOT NULL;
CREATE INDEX idx_song_plays_source ON song_plays(source);

-- Partitioning for song_plays table (by month)
-- This would be implemented in a production environment for better performance
-- CREATE TABLE song_plays_y2024m01 PARTITION OF song_plays
-- FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Create function to update song like count
CREATE OR REPLACE FUNCTION update_song_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE songs 
        SET total_likes = total_likes + 1 
        WHERE id = NEW.song_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE songs 
        SET total_likes = total_likes - 1 
        WHERE id = OLD.song_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for song like count updates
CREATE TRIGGER trigger_update_song_like_count
    AFTER INSERT OR DELETE ON song_likes
    FOR EACH ROW
    EXECUTE FUNCTION update_song_like_count();

-- Create function to update play counts
CREATE OR REPLACE FUNCTION update_song_play_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Only count as a play if completion percentage is > 30%
    IF NEW.completion_percentage > 30 THEN
        UPDATE songs 
        SET total_plays = total_plays + 1 
        WHERE id = NEW.song_id;
        
        -- Also update artist total plays
        UPDATE artists 
        SET total_plays = total_plays + 1 
        WHERE id = (SELECT artist_id FROM songs WHERE id = NEW.song_id);
        
        -- Update album total plays if song belongs to an album
        UPDATE albums 
        SET total_plays = total_plays + 1 
        WHERE id = (SELECT album_id FROM songs WHERE id = NEW.song_id AND album_id IS NOT NULL);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for play count updates
CREATE TRIGGER trigger_update_song_play_count
    AFTER INSERT ON song_plays
    FOR EACH ROW
    EXECUTE FUNCTION update_song_play_count();

-- Create function to update artist song count
CREATE OR REPLACE FUNCTION update_artist_song_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status = 'published' THEN
            UPDATE artists 
            SET total_songs = total_songs + 1 
            WHERE id = NEW.artist_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle status changes
        IF OLD.status != 'published' AND NEW.status = 'published' THEN
            UPDATE artists 
            SET total_songs = total_songs + 1 
            WHERE id = NEW.artist_id;
        ELSIF OLD.status = 'published' AND NEW.status != 'published' THEN
            UPDATE artists 
            SET total_songs = total_songs - 1 
            WHERE id = NEW.artist_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.status = 'published' THEN
            UPDATE artists 
            SET total_songs = total_songs - 1 
            WHERE id = OLD.artist_id;
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for artist song count updates
CREATE TRIGGER trigger_update_artist_song_count
    AFTER INSERT OR UPDATE OR DELETE ON songs
    FOR EACH ROW
    EXECUTE FUNCTION update_artist_song_count();

-- Create function to update album track count and duration
CREATE OR REPLACE FUNCTION update_album_track_info()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.album_id IS NOT NULL THEN
        UPDATE albums 
        SET total_tracks = (
            SELECT COUNT(*) FROM songs 
            WHERE album_id = NEW.album_id AND deleted_at IS NULL
        ),
        total_duration = (
            SELECT COALESCE(SUM(duration), 0) FROM songs 
            WHERE album_id = NEW.album_id AND deleted_at IS NULL
        )
        WHERE id = NEW.album_id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle album changes
        IF OLD.album_id IS DISTINCT FROM NEW.album_id THEN
            -- Update old album
            IF OLD.album_id IS NOT NULL THEN
                UPDATE albums 
                SET total_tracks = (
                    SELECT COUNT(*) FROM songs 
                    WHERE album_id = OLD.album_id AND deleted_at IS NULL
                ),
                total_duration = (
                    SELECT COALESCE(SUM(duration), 0) FROM songs 
                    WHERE album_id = OLD.album_id AND deleted_at IS NULL
                )
                WHERE id = OLD.album_id;
            END IF;
            
            -- Update new album
            IF NEW.album_id IS NOT NULL THEN
                UPDATE albums 
                SET total_tracks = (
                    SELECT COUNT(*) FROM songs 
                    WHERE album_id = NEW.album_id AND deleted_at IS NULL
                ),
                total_duration = (
                    SELECT COALESCE(SUM(duration), 0) FROM songs 
                    WHERE album_id = NEW.album_id AND deleted_at IS NULL
                )
                WHERE id = NEW.album_id;
            END IF;
        ELSIF NEW.album_id IS NOT NULL AND OLD.duration != NEW.duration THEN
            -- Duration changed, update album total duration
            UPDATE albums 
            SET total_duration = (
                SELECT COALESCE(SUM(duration), 0) FROM songs 
                WHERE album_id = NEW.album_id AND deleted_at IS NULL
            )
            WHERE id = NEW.album_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' AND OLD.album_id IS NOT NULL THEN
        UPDATE albums 
        SET total_tracks = (
            SELECT COUNT(*) FROM songs 
            WHERE album_id = OLD.album_id AND deleted_at IS NULL
        ),
        total_duration = (
            SELECT COALESCE(SUM(duration), 0) FROM songs 
            WHERE album_id = OLD.album_id AND deleted_at IS NULL
        )
        WHERE id = OLD.album_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for album track info updates
CREATE TRIGGER trigger_update_album_track_info
    AFTER INSERT OR UPDATE OR DELETE ON songs
    FOR EACH ROW
    EXECUTE FUNCTION update_album_track_info();

-- Create view for published songs with artist info
CREATE VIEW published_songs AS
SELECT 
    s.*,
    ar.stage_name as artist_name,
    ar.avatar_url as artist_avatar_url,
    ar.verification_status as artist_verification_status,
    al.title as album_title,
    al.cover_image_url as album_cover_url
FROM songs s
JOIN artists ar ON s.artist_id = ar.id
LEFT JOIN albums al ON s.album_id = al.id
WHERE s.status = 'published' 
  AND s.deleted_at IS NULL 
  AND ar.deleted_at IS NULL;

-- Create view for public song details
CREATE VIEW public_song_details AS
SELECT 
    s.id,
    s.title,
    s.description,
    s.duration,
    s.genre,
    s.secondary_genres,
    s.track_number,
    s.disc_number,
    s.audio_file_url,
    s.audio_quality,
    s.explicit_content,
    s.language,
    s.total_plays,
    s.total_likes,
    s.total_shares,
    s.slug,
    s.tags,
    s.created_at,
    s.published_at,
    ar.id as artist_id,
    ar.stage_name as artist_name,
    ar.avatar_url as artist_avatar_url,
    ar.verification_status as artist_verification_status,
    u.username as artist_username,
    al.id as album_id,
    al.title as album_title,
    al.cover_image_url as album_cover_url
FROM songs s
JOIN artists ar ON s.artist_id = ar.id
JOIN users u ON ar.user_id = u.id
LEFT JOIN albums al ON s.album_id = al.id
WHERE s.is_public = TRUE 
  AND s.status = 'published'
  AND s.deleted_at IS NULL 
  AND ar.deleted_at IS NULL 
  AND u.deleted_at IS NULL 
  AND u.status = 'active';

-- Create function to generate song slug
CREATE OR REPLACE FUNCTION generate_song_slug(song_title TEXT, artist_name TEXT)
RETURNS TEXT AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Create base slug from title and artist
    base_slug := lower(regexp_replace(
        artist_name || '-' || song_title, 
        '[^a-zA-Z0-9\s-]', '', 'g'
    ));
    base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
    base_slug := regexp_replace(base_slug, '-+', '-', 'g');
    base_slug := trim(both '-' from base_slug);
    
    -- Ensure uniqueness
    final_slug := base_slug;
    WHILE EXISTS (SELECT 1 FROM songs WHERE slug = final_slug AND deleted_at IS NULL) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    
    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Create function to validate song metadata
CREATE OR REPLACE FUNCTION validate_song_metadata()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate that published songs have required fields
    IF NEW.status = 'published' THEN
        IF NEW.title IS NULL OR char_length(trim(NEW.title)) = 0 THEN
            RAISE EXCEPTION 'Published songs must have a title';
        END IF;
        
        IF NEW.audio_file_url IS NULL THEN
            RAISE EXCEPTION 'Published songs must have an audio file';
        END IF;
        
        IF NEW.duration IS NULL OR NEW.duration <= 0 THEN
            RAISE EXCEPTION 'Published songs must have a valid duration';
        END IF;
    END IF;
    
    -- Auto-generate slug if not provided
    IF NEW.slug IS NULL AND NEW.title IS NOT NULL THEN
        SELECT stage_name INTO NEW.slug FROM artists WHERE id = NEW.artist_id;
        NEW.slug := generate_song_slug(NEW.title, COALESCE(NEW.slug, 'unknown'));
    END IF;
    
    -- Set published_at timestamp when status changes to published
    IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published') THEN
        NEW.published_at := NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for song metadata validation
CREATE TRIGGER trigger_validate_song_metadata
    BEFORE INSERT OR UPDATE ON songs
    FOR EACH ROW
    EXECUTE FUNCTION validate_song_metadata();

-- DOWN
DROP VIEW IF EXISTS public_song_details;
DROP VIEW IF EXISTS published_songs;
DROP TRIGGER IF EXISTS trigger_validate_song_metadata ON songs;
DROP TRIGGER IF EXISTS trigger_update_album_track_info ON songs;
DROP TRIGGER IF EXISTS trigger_update_artist_song_count ON songs;
DROP TRIGGER IF EXISTS trigger_update_song_play_count ON song_plays;
DROP TRIGGER IF EXISTS trigger_update_song_like_count ON song_likes;
DROP TRIGGER IF EXISTS trigger_songs_updated_at ON songs;
DROP FUNCTION IF EXISTS validate_song_metadata();
DROP FUNCTION IF EXISTS generate_song_slug(TEXT, TEXT);
DROP FUNCTION IF EXISTS update_album_track_info();
DROP FUNCTION IF EXISTS update_artist_song_count();
DROP FUNCTION IF EXISTS update_song_play_count();
DROP FUNCTION IF EXISTS update_song_like_count();
DROP TABLE IF EXISTS song_plays;
DROP TABLE IF EXISTS song_likes;
DROP TABLE IF EXISTS song_collaborators;
DROP TABLE IF EXISTS songs;
DROP TYPE IF EXISTS audio_quality;
DROP TYPE IF EXISTS song_status;