-- @id: 001
-- @name: create_users_table
-- @version: 1.0.0
-- @description: Create users table with security features and audit fields

-- UP
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types
CREATE TYPE user_role AS ENUM ('user', 'artist', 'admin', 'moderator');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'deleted');

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(254) NOT NULL UNIQUE,
    username VARCHAR(30) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'user',
    status user_status NOT NULL DEFAULT 'active',
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    
    -- Profile information
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    display_name VARCHAR(50),
    bio TEXT,
    avatar_url VARCHAR(500),
    country CHAR(2), -- ISO 3166-1 alpha-2
    date_of_birth DATE,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Security fields
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_login_ip INET,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_username_format CHECK (username ~* '^[a-zA-Z0-9_]{3,30}$'),
    CONSTRAINT users_display_name_length CHECK (char_length(display_name) >= 2),
    CONSTRAINT users_bio_length CHECK (char_length(bio) <= 500),
    CONSTRAINT users_country_format CHECK (country ~* '^[A-Z]{2}$'),
    CONSTRAINT users_date_of_birth_valid CHECK (date_of_birth <= CURRENT_DATE - INTERVAL '13 years'),
    CONSTRAINT users_failed_attempts_positive CHECK (failed_login_attempts >= 0)
);

-- Create indexes for performance and security
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_username ON users(username) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON users(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_is_verified ON users(is_verified) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_updated_at ON users(updated_at);
CREATE INDEX idx_users_last_login_at ON users(last_login_at);
CREATE INDEX idx_users_locked_until ON users(locked_until) WHERE locked_until IS NOT NULL;
CREATE INDEX idx_users_country ON users(country) WHERE country IS NOT NULL;
CREATE INDEX idx_users_is_public ON users(is_public);

-- Partial indexes for soft delete
CREATE UNIQUE INDEX idx_users_email_active ON users(email) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_users_username_active ON users(username) WHERE deleted_at IS NULL;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function for password validation
CREATE OR REPLACE FUNCTION validate_password_strength(password TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Password must be at least 8 characters
    IF char_length(password) < 8 THEN
        RETURN FALSE;
    END IF;
    
    -- Must contain at least one lowercase letter
    IF password !~ '[a-z]' THEN
        RETURN FALSE;
    END IF;
    
    -- Must contain at least one uppercase letter
    IF password !~ '[A-Z]' THEN
        RETURN FALSE;
    END IF;
    
    -- Must contain at least one digit
    IF password !~ '[0-9]' THEN
        RETURN FALSE;
    END IF;
    
    -- Must contain at least one special character
    IF password !~ '[^a-zA-Z0-9]' THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create audit log table for user changes
CREATE TABLE user_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_by UUID,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for audit log
CREATE INDEX idx_user_audit_log_user_id ON user_audit_log(user_id);
CREATE INDEX idx_user_audit_log_action ON user_audit_log(action);
CREATE INDEX idx_user_audit_log_created_at ON user_audit_log(created_at);

-- Create function to log user changes
CREATE OR REPLACE FUNCTION log_user_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO user_audit_log (user_id, action, new_values)
        VALUES (NEW.id, 'INSERT', to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO user_audit_log (user_id, action, old_values, new_values)
        VALUES (NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO user_audit_log (user_id, action, old_values)
        VALUES (OLD.id, 'DELETE', to_jsonb(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for audit logging
CREATE TRIGGER trigger_user_audit_log
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW
    EXECUTE FUNCTION log_user_changes();

-- Create view for active users (excluding soft deleted)
CREATE VIEW active_users AS
SELECT 
    id,
    email,
    username,
    role,
    status,
    is_verified,
    first_name,
    last_name,
    display_name,
    bio,
    avatar_url,
    country,
    date_of_birth,
    is_public,
    last_login_at,
    created_at,
    updated_at
FROM users
WHERE deleted_at IS NULL;

-- Grant permissions (adjust as needed for your application user)
-- GRANT SELECT, INSERT, UPDATE ON users TO spotify_app_user;
-- GRANT SELECT, INSERT ON user_audit_log TO spotify_app_user;
-- GRANT SELECT ON active_users TO spotify_app_user;

-- DOWN
DROP VIEW IF EXISTS active_users;
DROP TRIGGER IF EXISTS trigger_user_audit_log ON users;
DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
DROP FUNCTION IF EXISTS log_user_changes();
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS validate_password_strength(TEXT);
DROP TABLE IF EXISTS user_audit_log;
DROP TABLE IF EXISTS users;
DROP TYPE IF EXISTS user_status;
DROP TYPE IF EXISTS user_role;