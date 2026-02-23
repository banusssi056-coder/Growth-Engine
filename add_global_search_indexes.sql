-- ============================================================
-- GLOBAL SEARCH INDEXES  (FR-A.2)
-- Run once in Supabase SQL Editor
-- ============================================================

-- ── Enable pg_trgm for ILIKE-style trigram matching ────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── CONTACTS ───────────────────────────────────────────────
-- B-Tree (exact / prefix lookups)
CREATE INDEX IF NOT EXISTS idx_contacts_email_btree
    ON contacts (email);

CREATE INDEX IF NOT EXISTS idx_contacts_phone_btree
    ON contacts (phone);

CREATE INDEX IF NOT EXISTS idx_contacts_last_first_btree
    ON contacts (last_name, first_name);

-- GIN trigram (substring / ILIKE lookups)
CREATE INDEX IF NOT EXISTS idx_contacts_first_name_trgm
    ON contacts USING GIN (first_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contacts_last_name_trgm
    ON contacts USING GIN (last_name  gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contacts_email_trgm
    ON contacts USING GIN (email      gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contacts_phone_trgm
    ON contacts USING GIN (phone      gin_trgm_ops);

-- GIN full-text search on a combined tsvector
CREATE INDEX IF NOT EXISTS idx_contacts_fts
    ON contacts USING GIN (
        to_tsvector('english',
            coalesce(first_name,'') || ' ' ||
            coalesce(last_name, '') || ' ' ||
            coalesce(email,     '') || ' ' ||
            coalesce(phone,     '') || ' ' ||
            coalesce(job_title, '')
        )
    );

-- ── COMPANIES ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_companies_name_btree
    ON companies (name);

CREATE INDEX IF NOT EXISTS idx_companies_name_trgm
    ON companies USING GIN (name    gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_companies_domain_trgm
    ON companies USING GIN (domain  gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_companies_fts
    ON companies USING GIN (
        to_tsvector('english',
            coalesce(name,     '') || ' ' ||
            coalesce(domain,   '') || ' ' ||
            coalesce(industry, '')
        )
    );

-- ── USERS (internal team) ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email_btree
    ON users (email);

CREATE INDEX IF NOT EXISTS idx_users_phone_btree
    ON users (phone);

CREATE INDEX IF NOT EXISTS idx_users_email_trgm
    ON users USING GIN (email     gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_fullname_trgm
    ON users USING GIN (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_phone_trgm
    ON users USING GIN (phone     gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_fts
    ON users USING GIN (
        to_tsvector('english',
            coalesce(full_name, '') || ' ' ||
            coalesce(email,     '') || ' ' ||
            coalesce(phone,     '')
        )
    );

-- ── DEALS ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_deals_name_btree
    ON deals (name);

CREATE INDEX IF NOT EXISTS idx_deals_name_trgm
    ON deals USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_deals_fts
    ON deals USING GIN (
        to_tsvector('english',
            coalesce(name,     '') || ' ' ||
            coalesce(stage,    '') || ' ' ||
            coalesce(offering, '') || ' ' ||
            coalesce(remark,   '')
        )
    );

-- Done!
-- Verify with: \d contacts  (then check Indexes section)
