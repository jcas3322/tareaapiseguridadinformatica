-- @id: 003
-- @name: create_albums_table
-- @version: 1.0.0
-- @description: Create albums table with metadata and relationship management

-- UP
-- Create enum types for albums
CREATE TYPE album_type AS ENUM ('album', 'ep', 'single', 'compilation', 'live', 'remix', 'soundtrack');
CREATE TYPE album_status AS ENUM ('draft', 'published', 'archived', 'deleted');

-- Create albums table
CREATE TABLE albums (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artist_id UUID NOT NULL,
    
    -- Album basic information
    title VARCHAR(200) NOT NULL,
    description TEXT,
    album_type album_type NOT NULL DEFAULT 'album',
    status album_status NOT NULL DEFAULT 'draft',
    
    -- Release information
    release_date DATE,
    original_release_date DATE, -- For reissues
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Album metadata
    genre artist_genre,
    secondary_genres artist_genre[],
    record_label VARCHAR(100),
    producer VARCHAR(100),
    total_tracks INTEGER NOT NULL DEFAULT 0,
    total_duration INTEGER, -- in seconds
    
    -- Album artwork
    cover_image_url VARCHAR(500),
    cover_image_thumbnail_url VARCHAR(500),
    
    -- Copyright and licensing
    copyright_notice TEXT,
    license_type VARCHAR(50) DEFAULT 'all_rights_reserved',
    
    -- Statistics (denormalized for performance)
    total_plays BIGINT NOT NULL DEFAULT 0,
    total_likes INTEGER NOT NULL DEFAULT 0,
    total_shares INTEGER NOT NULL DEFAULT 0,
    
    -- SEO and discovery
    slug VARCHAR(250) UNIQUE,
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
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Constraints
    CONSTRAINT albums_title_length CHECK (char_length(title) >= 1),
    CONSTRAINT albums_description_length CHECK (char_length(description) <= 2000),
    CONSTRAINT albums_slug_format CHECK (slug ~* '^[a-z0-9-]+$'),
    CONSTRAINT albums_total_tracks_positive CHECK (total_tracks >= 0),
    CONSTRAINT albums_total_duration_positive CHECK (total_duration IS NULL OR total_duration > 0),
    CONSTRAINT albums_release_date_valid CHECK (
        release_date IS NULL OR 
        release_date <= CURRENT_DATE + INTERVAL '1 year'
    ),
    CONSTRAINT albums_stats_positive CHECK (
        total_plays >= 0 AND 
        total_likes >= 0 AND 
        total_shares >= 0
    )
);

-- Create indexes
CREATE INDEX idx_albums_artist_id ON albums(artist_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_albums_title ON albums(title) WHERE deleted_at IS NULL;
CREATE INDEX idx_albums_album_type ON albums(album_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_albums_status ON albums(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_albums_release_date ON albums(release_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_albums_genre ON albums(genre) WHERE deleted_at IS NULL;
CREATE INDEX idx_albums_is_public ON albums(is_public);
CREATE INDEX idx_albums_created_at ON albums(created_at);
CREATE INDEX idx_albums_updated_at ON albums(updated_at);
CREATE INDEX idx_albums_published_at ON albums(published_at);

-- GIN indexes for arrays and full-text search
CREATE INDEX idx_albums_secondary_genres ON albums USING GIN(secondary_genres);
CREATE INDEX idx_albums_tags ON albums USING GIN(tags);
CREATE INDEX idx_albums_search ON albums USING GIN(
    to_tsvector('english', 
        COALESCE(title, '') || ' ' || 
        COALESCE(description, '') || ' ' || 
        COALESCE(record_label, '') || ' ' ||
        COALESCE(producer, '')
    )
) WHERE deleted_at IS NULL;

-- Partial unique index for slug (active albums only)
CREATE UNIQUE INDEX idx_albums_slug_active ON albums(slug) 
WHERE deleted_at IS NULL AND slug IS NOT NULL;

-- Create trigger for updated_at
CREATE TRIGGER trigger_albums_updated_at
    BEFORE UPDATE ON albums
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to generate album slug
CREATE OR REPLACE FUNCTION generate_album_slug(album_title TEXT, artist_name TEXT)
RETURNS TEXT AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Create base slug from title and artist
    base_slug := lower(regexp_replace(
        artist_name || '-' || album_title, 
        '[^a-zA-Z0-9\s-]', '', 'g'
    ));
    base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
    base_slug := regexp_replace(base_slug, '-+', '-', 'g');
    base_slug := trim(both '-' from base_slug);
    
    -- Ensure uniqueness
    final_slug := base_slug;
    WHILE EXISTS (SELECT 1 FROM albums WHERE slug = final_slug AND deleted_at IS NULL) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    
    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Create album collaborators table (for featured artists, producers, etc.)
CREATE TABLE album_collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    album_id UUID NOT NULL,
    collaborator_id UUID NOT NULL, -- Can be artist_id or user_id
    collaborator_type VARCHAR(50) NOT NULL, -- 'featured_artist', 'producer', 'songwriter', etc.
    role_description VARCHAR(200),
    credit_order INTEGER DEFAULT 1,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
    -- Note: collaborator_id can reference either artists or users table
    
    -- Prevent duplicate collaborations
    UNIQUE(album_id, collaborator_id, collaborator_type)
);

-- Create indexes for collaborators
CREATE INDEX idx_album_collaborators_album_id ON album_collaborators(album_id);
CREATE INDEX idx_album_collaborators_collaborator_id ON album_collaborators(collaborator_id);
CREATE INDEX idx_album_collaborators_type ON album_collaborators(collaborator_type);

-- Create album likes table
CREATE TABLE album_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    album_id UUID NOT NULL,
    user_id UUID NOT NULL,
    liked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Prevent duplicate likes
    UNIQUE(album_id, user_id)
);

-- Create indexes for likes
CREATE INDEX idx_album_likes_album_id ON album_likes(album_id);
CREATE INDEX idx_album_likes_user_id ON album_likes(user_id);
CREATE INDEX idx_album_likes_liked_at ON album_likes(liked_at);

-- Create function to update album like count
CREATE OR REPLACE FUNCTION update_album_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE albums 
        SET total_likes = total_likes + 1 
        WHERE id = NEW.album_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE albums 
        SET total_likes = total_likes - 1 
        WHERE id = OLD.album_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for like count updates
CREATE TRIGGER trigger_update_album_like_count
    AFTER INSERT OR DELETE ON album_likes
    FOR EACH ROW
    EXECUTE FUNCTION update_album_like_count();

-- Create function to update artist album count
CREATE OR REPLACE FUNCTION update_artist_album_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status = 'published' THEN
            UPDATE artists 
            SET total_albums = total_albums + 1 
            WHERE id = NEW.artist_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle status changes
        IF OLD.status != 'published' AND NEW.status = 'published' THEN
            UPDATE artists 
            SET total_albums = total_albums + 1 
            WHERE id = NEW.artist_id;
        ELSIF OLD.status = 'published' AND NEW.status != 'published' THEN
            UPDATE artists 
            SET total_albums = total_albums - 1 
            WHERE id = NEW.artist_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.status = 'published' THEN
            UPDATE artists 
            SET total_albums = total_albums - 1 
            WHERE id = OLD.artist_id;
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for artist album count updates
CREATE TRIGGER trigger_update_artist_album_count
    AFTER INSERT OR UPDATE OR DELETE ON albums
    FOR EACH ROW
    EXECUTE FUNCTION update_artist_album_count();

-- Create view for published albums
CREATE VIEW published_albums AS
SELECT 
    a.*,
    ar.stage_name as artist_name,
    ar.avatar_url as artist_avatar_url,
    ar.verification_status as artist_verification_status
FROM albums a
JOIN artists ar ON a.artist_id = ar.id
WHERE a.status = 'published' 
  AND a.deleted_at IS NULL 
  AND ar.deleted_at IS NULL;

-- Create view for public album details with artist info
CREATE VIEW public_album_details AS
SELECT 
    a.id,
    a.title,
    a.description,
    a.album_type,
    a.release_date,
    a.genre,
    a.secondary_genres,
    a.record_label,
    a.producer,
    a.total_tracks,
    a.total_duration,
    a.cover_image_url,
    a.cover_image_thumbnail_url,
    a.total_plays,
    a.total_likes,
    a.total_shares,
    a.slug,
    a.tags,
    a.created_at,
    a.published_at,
    ar.id as artist_id,
    ar.stage_name as artist_name,
    ar.avatar_url as artist_avatar_url,
    ar.verification_status as artist_verification_status,
    u.username as artist_username
FROM albums a
JOIN artists ar ON a.artist_id = ar.id
JOIN users u ON ar.user_id = u.id
WHERE a.is_public = TRUE 
  AND a.status = 'published'
  AND a.deleted_at IS NULL 
  AND ar.deleted_at IS NULL 
  AND u.deleted_at IS NULL 
  AND u.status = 'active';

-- Create function to validate album metadata
CREATE OR REPLACE FUNCTION validate_album_metadata()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate release date is not too far in the future
    IF NEW.release_date IS NOT NULL AND NEW.release_date > CURRENT_DATE + INTERVAL '2 years' THEN
        RAISE EXCEPTION 'Release date cannot be more than 2 years in the future';
    END IF;
    
    -- Validate that published albums have required fields
    IF NEW.status = 'published' THEN
        IF NEW.title IS NULL OR char_length(trim(NEW.title)) = 0 THEN
            RAISE EXCEPTION 'Published albums must have a title';
        END IF;
        
        IF NEW.release_date IS NULL THEN
            RAISE EXCEPTION 'Published albums must have a release date';
        END IF;
    END IF;
    
    -- Auto-generate slug if not provided
    IF NEW.slug IS NULL AND NEW.title IS NOT NULL THEN
        SELECT stage_name INTO NEW.slug FROM artists WHERE id = NEW.artist_id;
        NEW.slug := generate_album_slug(NEW.title, COALESCE(NEW.slug, 'unknown'));
    END IF;
    
    -- Set published_at timestamp when status changes to published
    IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published') THEN
        NEW.published_at := NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for album metadata validation
CREATE TRIGGER trigger_validate_album_metadata
    BEFORE INSERT OR UPDATE ON albums
    FOR EACH ROW
    EXECUTE FUNCTION validate_album_metadata();

-- DOWN
DROP VIEW IF EXISTS public_album_details;
DROP VIEW IF EXISTS published_albums;
DROP TRIGGER IF EXISTS trigger_validate_album_metadata ON albums;
DROP TRIGGER IF EXISTS trigger_update_artist_album_count ON albums;
DROP TRIGGER IF EXISTS trigger_update_album_like_count ON album_likes;
DROP TRIGGER IF EXISTS trigger_albums_updated_at ON albums;
DROP FUNCTION IF EXISTS validate_album_metadata();
DROP FUNCTION IF EXISTS update_artist_album_count();
DROP FUNCTION IF EXISTS update_album_like_count();
DROP FUNCTION IF EXISTS generate_album_slug(TEXT, TEXT);
DROP TABLE IF EXISTS album_likes;
DROP TABLE IF EXISTS album_collaborators;
DROP TABLE IF EXISTS albums;
DROP TYPE IF EXISTS album_status;
DROP TYPE IF EXISTS album_type;