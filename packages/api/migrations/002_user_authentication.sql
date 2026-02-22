-- Migration: User Authentication System
-- Phase 2: GearShelf.io User Management
-- Date: 2026-02-22

-- Users table - core user accounts
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User sessions table - JWT token management
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    device_info JSONB,
    ip_address INET,
    expires_at TIMESTAMP NOT NULL,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User plugin collections - personal plugin lists
CREATE TABLE user_plugin_collections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    color VARCHAR(7), -- hex color for UI
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

-- Junction table - plugins in user collections
CREATE TABLE user_collection_plugins (
    id SERIAL PRIMARY KEY,
    collection_id INTEGER REFERENCES user_plugin_collections(id) ON DELETE CASCADE,
    plugin_id INTEGER REFERENCES plugins(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    UNIQUE(collection_id, plugin_id)
);

-- User plugin ratings/reviews
CREATE TABLE user_plugin_reviews (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plugin_id INTEGER REFERENCES plugins(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, plugin_id)
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_user_collections_user_id ON user_plugin_collections(user_id);
CREATE INDEX idx_collection_plugins_collection_id ON user_collection_plugins(collection_id);
CREATE INDEX idx_collection_plugins_plugin_id ON user_collection_plugins(plugin_id);
CREATE INDEX idx_user_reviews_user_id ON user_plugin_reviews(user_id);
CREATE INDEX idx_user_reviews_plugin_id ON user_plugin_reviews(plugin_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_collections_updated_at BEFORE UPDATE ON user_plugin_collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_reviews_updated_at BEFORE UPDATE ON user_plugin_reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Default admin user (password: "admin123" - CHANGE IN PRODUCTION!)
INSERT INTO users (email, password_hash, name, role, is_verified, is_active)
VALUES (
    'admin@gearshelf.io',
    '$2b$12$LQv3c1yqBwEHFurhIZnN0eRZGBRNIo.R3A1cUYRuKgm8LqxBrB92u', -- admin123
    'System Administrator',
    'admin',
    TRUE,
    TRUE
);

-- Default user collections
INSERT INTO user_plugin_collections (user_id, name, description, is_public, color)
VALUES (
    1,
    'Favorites',
    'My favorite plugins',
    FALSE,
    '#ff6b6b'
);