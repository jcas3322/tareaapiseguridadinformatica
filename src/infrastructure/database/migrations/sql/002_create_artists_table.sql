-- @id: 002
-- @name: create_artists_table
-- @version: 1.0.0
-- @description: Create artists table with profile and verification features

-- UP
-- Create enum types for artists
CREATE TYPE artist_verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
CREATE TYPE artist_genre AS ENUM (
    'rock', 'pop', 'hip_hop', 'jazz', 'classical', 'electronic', 'country', 
    'blues', 'reggae', 'folk', 'metal', 'punk', 'indie', 'alternative', 
    'r_and_b', 'soul', 'funk', 'disco', 'house', 'techno', 'dubstep', 
    'ambient', 'world', 'latin', 'gospel', 'other'
);

-- Create artists table
CREATE TABLE artists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    
    -- Artist profile
    stage_name VARCHAR(100) NOT NULL,
    real_name VARCHAR(100),
    bio TEXT,
    website_url VARCHAR(500),
    social_media_links JSONB DEFAULT '{}',
    
    -- Artist details
    primary_genre artist_genre,
    secondary_genres artist_genre[],
    formed_year INTEGER,
    origin_country CHAR(2), -- ISO 3166-1 alpha-2
    origin_city VARCHAR(100),
    
    -- Verification and status
    verification_status artist_verification_status NOT NULL DEFAULT 'unverified',
    verification_requested_at TIMESTAMP WITH TIME ZONE,
    verification_completed_at TIMESTAMP WITH TIME ZONE,
    verification_notes TEXT,
    
    -- Statistics (denormalized for performance)
    total_songs INTEGER NOT NULL DEFAULT 0,
    total_albums INTEGER NOT NULL DEFAULT 0,
    total_plays BIGINT NOT NULL DEFAULT 0,
    total_followers INTEGER NOT NULL DEFAULT 0,
    
    -- Profile images
    avatar_url VARCHAR(500),
    banner_url VARCHAR(500),
    
    -- Settings
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    allow_collaborations BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Foreign key constraints
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Constraints
    CONSTRAINT artists_stage_name_length CHECK (char_length(stage_name) >= 2),
    CONSTRAINT artists_bio_length CHECK (char_length(bio) <= 2000),
    CONSTRAINT artists_website_url_format CHECK (website_url ~* '^https?://'),
    CONSTRAINT artists_formed_year_valid CHECK (formed_year >= 1800 AND formed_year <= EXTRACT(YEAR FROM CURRENT_DATE)),
    CONSTRAINT artists_origin_country_format CHECK (origin_country ~* '^[A-Z]{2}$'),
    CONSTRAINT artists_stats_positive CHECK (
        total_songs >= 0 AND 
        total_albums >= 0 AND 
        total_plays >= 0 AND 
        total_followers >= 0
    )
);

-- Create indexes
CREATE INDEX idx_artists_user_id ON artists(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_artists_stage_name ON artists(stage_name) WHERE deleted_at IS NULL;
CREATE INDEX idx_artists_primary_genre ON artists(primary_genre) WHERE deleted_at IS NULL;
CREATE INDEX idx_artists_verification_status ON artists(verification_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_artists_origin_country ON artists(origin_country) WHERE origin_country IS NOT NULL;
CREATE INDEX idx_artists_formed_year ON artists(formed_year) WHERE formed_year IS NOT NULL;
CREATE INDEX idx_artists_is_public ON artists(is_public);
CREATE INDEX idx_artists_created_at ON artists(created_at);
CREATE INDEX idx_artists_updated_at ON artists(updated_at);

-- GIN index for secondary genres array
CREATE INDEX idx_artists_secondary_genres ON artists USING GIN(secondary_genres);

-- GIN index for social media links JSONB
CREATE INDEX idx_artists_social_media ON artists USING GIN(social_media_links);

-- Full text search index for stage name and bio
CREATE INDEX idx_artists_search ON artists USING GIN(
    to_tsvector('english', COALESCE(stage_name, '') || ' ' || COALESCE(bio, ''))
) WHERE deleted_at IS NULL;

-- Partial unique index for stage name (active artists only)
CREATE UNIQUE INDEX idx_artists_stage_name_active ON artists(stage_name) 
WHERE deleted_at IS NULL;

-- Create trigger for updated_at
CREATE TRIGGER trigger_artists_updated_at
    BEFORE UPDATE ON artists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create artist followers table (many-to-many relationship)
CREATE TABLE artist_followers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artist_id UUID NOT NULL,
    follower_user_id UUID NOT NULL,
    followed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
    FOREIGN KEY (follower_user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Prevent duplicate follows
    UNIQUE(artist_id, follower_user_id)
);

-- Create indexes for followers
CREATE INDEX idx_artist_followers_artist_id ON artist_followers(artist_id);
CREATE INDEX idx_artist_followers_user_id ON artist_followers(follower_user_id);
CREATE INDEX idx_artist_followers_followed_at ON artist_followers(followed_at);

-- Create function to update follower count
CREATE OR REPLACE FUNCTION update_artist_follower_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE artists 
        SET total_followers = total_followers + 1 
        WHERE id = NEW.artist_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE artists 
        SET total_followers = total_followers - 1 
        WHERE id = OLD.artist_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for follower count updates
CREATE TRIGGER trigger_update_artist_follower_count
    AFTER INSERT OR DELETE ON artist_followers
    FOR EACH ROW
    EXECUTE FUNCTION update_artist_follower_count();

-- Create artist verification requests table
CREATE TABLE artist_verification_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artist_id UUID NOT NULL,
    
    -- Verification documents
    identity_document_url VARCHAR(500),
    proof_of_work_urls TEXT[], -- Array of URLs to proof of work
    social_media_proof JSONB DEFAULT '{}',
    additional_info TEXT,
    
    -- Request status
    status artist_verification_status NOT NULL DEFAULT 'pending',
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID,
    reviewer_notes TEXT,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for verification requests
CREATE INDEX idx_verification_requests_artist_id ON artist_verification_requests(artist_id);
CREATE INDEX idx_verification_requests_status ON artist_verification_requests(status);
CREATE INDEX idx_verification_requests_submitted_at ON artist_verification_requests(submitted_at);
CREATE INDEX idx_verification_requests_reviewed_at ON artist_verification_requests(reviewed_at);

-- Create trigger for verification requests updated_at
CREATE TRIGGER trigger_verification_requests_updated_at
    BEFORE UPDATE ON artist_verification_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create view for verified artists
CREATE VIEW verified_artists AS
SELECT 
    a.*,
    u.username,
    u.email,
    u.is_verified as user_verified
FROM artists a
JOIN users u ON a.user_id = u.id
WHERE a.verification_status = 'verified' 
  AND a.deleted_at IS NULL 
  AND u.deleted_at IS NULL;

-- Create view for public artist profiles
CREATE VIEW public_artist_profiles AS
SELECT 
    a.id,
    a.stage_name,
    a.bio,
    a.website_url,
    a.social_media_links,
    a.primary_genre,
    a.secondary_genres,
    a.formed_year,
    a.origin_country,
    a.origin_city,
    a.verification_status,
    a.total_songs,
    a.total_albums,
    a.total_plays,
    a.total_followers,
    a.avatar_url,
    a.banner_url,
    a.created_at,
    u.username
FROM artists a
JOIN users u ON a.user_id = u.id
WHERE a.is_public = TRUE 
  AND a.deleted_at IS NULL 
  AND u.deleted_at IS NULL 
  AND u.status = 'active';

-- Create function to validate social media links
CREATE OR REPLACE FUNCTION validate_social_media_links(links JSONB)
RETURNS BOOLEAN AS $$
DECLARE
    key TEXT;
    url TEXT;
BEGIN
    -- Check each social media link
    FOR key, url IN SELECT * FROM jsonb_each_text(links)
    LOOP
        -- Validate URL format
        IF url !~* '^https?://' THEN
            RETURN FALSE;
        END IF;
        
        -- Validate known social media platforms
        CASE key
            WHEN 'twitter' THEN
                IF url !~* '^https?://(www\.)?twitter\.com/' THEN
                    RETURN FALSE;
                END IF;
            WHEN 'instagram' THEN
                IF url !~* '^https?://(www\.)?instagram\.com/' THEN
                    RETURN FALSE;
                END IF;
            WHEN 'facebook' THEN
                IF url !~* '^https?://(www\.)?facebook\.com/' THEN
                    RETURN FALSE;
                END IF;
            WHEN 'youtube' THEN
                IF url !~* '^https?://(www\.)?youtube\.com/' THEN
                    RETURN FALSE;
                END IF;
            WHEN 'spotify' THEN
                IF url !~* '^https?://open\.spotify\.com/' THEN
                    RETURN FALSE;
                END IF;
            WHEN 'soundcloud' THEN
                IF url !~* '^https?://(www\.)?soundcloud\.com/' THEN
                    RETURN FALSE;
                END IF;
        END CASE;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add constraint for social media links validation
ALTER TABLE artists ADD CONSTRAINT artists_social_media_valid 
CHECK (validate_social_media_links(social_media_links));

-- DOWN
DROP VIEW IF EXISTS public_artist_profiles;
DROP VIEW IF EXISTS verified_artists;
DROP FUNCTION IF EXISTS validate_social_media_links(JSONB);
DROP TRIGGER IF EXISTS trigger_verification_requests_updated_at ON artist_verification_requests;
DROP TRIGGER IF EXISTS trigger_update_artist_follower_count ON artist_followers;
DROP TRIGGER IF EXISTS trigger_artists_updated_at ON artists;
DROP FUNCTION IF EXISTS update_artist_follower_count();
DROP TABLE IF EXISTS artist_verification_requests;
DROP TABLE IF EXISTS artist_followers;
DROP TABLE IF EXISTS artists;
DROP TYPE IF EXISTS artist_genre;
DROP TYPE IF EXISTS artist_verification_status;