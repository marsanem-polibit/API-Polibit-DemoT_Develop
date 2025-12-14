-- Synchronize users table with User model
-- This migration ensures all fields from the User model exist in the database

-- Core user fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS password VARCHAR(255);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS first_name VARCHAR(255);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS app_language VARCHAR(10) DEFAULT 'en';

ALTER TABLE users
ADD COLUMN IF NOT EXISTS profile_image TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS role INTEGER NOT NULL DEFAULT 3;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT false;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- Password reset fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP WITH TIME ZONE;

-- Email verification fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP WITH TIME ZONE;

-- KYC fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS kyc_id VARCHAR(255);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(50);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS kyc_url TEXT;

-- Address fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS address_line2 TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS city VARCHAR(255);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS state VARCHAR(255);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS country VARCHAR(255);

-- Common investor fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS investor_type VARCHAR(50);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS tax_id VARCHAR(255);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS accredited_investor BOOLEAN DEFAULT false;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS risk_tolerance VARCHAR(50);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS investment_preferences JSONB;

-- Individual investor fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS date_of_birth DATE;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS nationality VARCHAR(255);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS passport_number VARCHAR(255);

-- Institution investor fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS institution_name VARCHAR(255);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS institution_type VARCHAR(255);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS registration_number VARCHAR(255);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS legal_representative VARCHAR(255);

-- Fund of Funds investor fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS fund_name VARCHAR(255);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS fund_manager VARCHAR(255);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS aum DECIMAL(20, 2);

-- Family Office investor fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS office_name VARCHAR(255);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS family_name VARCHAR(255);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS principal_contact VARCHAR(255);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS assets_under_management DECIMAL(20, 2);

-- Timestamps
ALTER TABLE users
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE users
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_investor_type ON users(investor_type);
CREATE INDEX IF NOT EXISTS idx_users_kyc_status ON users(kyc_status);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Add check constraint for role values (0=Root, 1=Admin, 2=Support, 3=Investor)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_role_check'
    ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_role_check CHECK (role IN (0, 1, 2, 3));
    END IF;
END $$;

-- Add check constraint for investor_type values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_investor_type_check'
    ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_investor_type_check
        CHECK (investor_type IS NULL OR investor_type IN ('Individual', 'Institution', 'Fund of Funds', 'Family Office'));
    END IF;
END $$;

-- Create or replace updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments to document the schema
COMMENT ON TABLE users IS 'User accounts supporting multiple roles: Root(0), Admin(1), Support(2), Investor(3)';
COMMENT ON COLUMN users.role IS '0=Root, 1=Admin, 2=Support, 3=Investor';
COMMENT ON COLUMN users.investor_type IS 'Type of investor: Individual, Institution, Fund of Funds, or Family Office';
COMMENT ON COLUMN users.accredited_investor IS 'Whether the investor is accredited';
COMMENT ON COLUMN users.kyc_status IS 'KYC verification status';
COMMENT ON COLUMN users.investment_preferences IS 'JSON object storing investor preferences';
