-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 0. Cleanup (Reverse Dependency Order)
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS activities;
DROP TABLE IF EXISTS deals;
DROP TABLE IF EXISTS contacts;
DROP TABLE IF EXISTS companies;
DROP TABLE IF EXISTS users;

-- Users Table (Simulating Auth Provider Sync)
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    phone VARCHAR(50),
    department VARCHAR(100),
    role VARCHAR(50) DEFAULT 'rep', -- admin, manager, rep, intern
    is_active BOOLEAN DEFAULT TRUE,
    last_assigned_at TIMESTAMP WITH TIME ZONE, -- For Round Robin
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Companies Table
CREATE TABLE companies (
    comp_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    industry VARCHAR(100),
    revenue NUMERIC(15, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Contacts Table
CREATE TABLE contacts (
    cont_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comp_id UUID REFERENCES companies(comp_id) ON DELETE SET NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    job_title VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Deals Table
CREATE TABLE deals (
    deal_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comp_id UUID REFERENCES companies(comp_id) ON DELETE CASCADE,
    owner_id UUID REFERENCES users(user_id), -- Linked to User
    name VARCHAR(255) NOT NULL,
    value NUMERIC(15, 2) DEFAULT 0,
    stage VARCHAR(50) NOT NULL,
    probability INTEGER DEFAULT 0,
    closing_date DATE,
    version INTEGER DEFAULT 1, -- Optimistic Locking
    is_stale BOOLEAN DEFAULT FALSE, -- FR-C.2
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Activities Table
CREATE TABLE activities (
    act_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID REFERENCES deals(deal_id) ON DELETE CASCADE,
    cont_id UUID REFERENCES contacts(cont_id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('CALL', 'EMAIL', 'NOTE', 'MEETING', 'SYSTEM')),
    content TEXT,
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log Table (Immutable)
CREATE TABLE audit_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID, -- References User
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    old_value JSONB,
    new_value JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Smart Search (FR-A.2)
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_name ON contacts(last_name, first_name);
CREATE INDEX idx_companies_name ON companies(name);
CREATE INDEX idx_users_email ON users(email);

-- Trigger Function: Auto-create user profile on Supabase Auth signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (user_id, email, full_name, role, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'rep'),
        true
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, users.full_name),
        updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Execute function when new user signs up via Supabase Auth
-- Note: This trigger should be created in Supabase SQL Editor on auth.users table
-- CREATE TRIGGER on_auth_user_created
-- AFTER INSERT ON auth.users
-- FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Insert sample users for testing (optional - remove in production)
-- These will be used when users sign up via Supabase
INSERT INTO users (email, full_name, role, phone, department) VALUES
('admin@sssi.com', 'Admin User', 'admin', '+1-555-0100', 'Management'),
('manager@sssi.com', 'Manager User', 'manager', '+1-555-0101', 'Sales'),
('rep@sssi.com', 'Sales Representative', 'rep', '+1-555-0102', 'Sales')
ON CONFLICT (email) DO NOTHING;

