-- Migration: Add Individual Investor Fields to Users Table
-- This migration adds address and personal information fields for individual investors

-- ============================================================================
-- Add Individual Investor Fields
-- ============================================================================

-- Add full_name column if missing
ALTER TABLE users
ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);

-- Add date_of_birth column if missing
ALTER TABLE users
ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Add nationality column if missing
ALTER TABLE users
ADD COLUMN IF NOT EXISTS nationality VARCHAR(100);

-- Add passport_number column if missing
ALTER TABLE users
ADD COLUMN IF NOT EXISTS passport_number VARCHAR(50);

-- Add address_line1 column if missing
ALTER TABLE users
ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(255);

-- Add address_line2 column if missing
ALTER TABLE users
ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(255);

-- Add city column if missing
ALTER TABLE users
ADD COLUMN IF NOT EXISTS city VARCHAR(100);

-- Add state column if missing
ALTER TABLE users
ADD COLUMN IF NOT EXISTS state VARCHAR(100);

-- Add postal_code column if missing
ALTER TABLE users
ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);

-- ============================================================================
-- Add Institution Investor Fields
-- ============================================================================

-- Add institution_name column if missing
ALTER TABLE users
ADD COLUMN IF NOT EXISTS institution_name VARCHAR(255);

-- Add institution_type column if missing
ALTER TABLE users
ADD COLUMN IF NOT EXISTS institution_type VARCHAR(100);

-- Add registration_number column if missing
ALTER TABLE users
ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100);

-- Add legal_representative column if missing
ALTER TABLE users
ADD COLUMN IF NOT EXISTS legal_representative VARCHAR(255);

-- ============================================================================
-- Add Fund of Funds Fields
-- ============================================================================

-- Add fund_name column if missing
ALTER TABLE users
ADD COLUMN IF NOT EXISTS fund_name VARCHAR(255);

-- Add fund_manager column if missing
ALTER TABLE users
ADD COLUMN IF NOT EXISTS fund_manager VARCHAR(255);

-- Add aum column if missing
ALTER TABLE users
ADD COLUMN IF NOT EXISTS aum NUMERIC(20, 2);

-- ============================================================================
-- Add Family Office Fields
-- ============================================================================

-- Add office_name column if missing
ALTER TABLE users
ADD COLUMN IF NOT EXISTS office_name VARCHAR(255);

-- Add family_name column if missing
ALTER TABLE users
ADD COLUMN IF NOT EXISTS family_name VARCHAR(255);

-- Add principal_contact column if missing
ALTER TABLE users
ADD COLUMN IF NOT EXISTS principal_contact VARCHAR(255);

-- Add assets_under_management column if missing
ALTER TABLE users
ADD COLUMN IF NOT EXISTS assets_under_management NUMERIC(20, 2);

-- ============================================================================
-- Add comments to document the columns
-- ============================================================================

COMMENT ON COLUMN users.full_name IS
'Full name for Individual investors';

COMMENT ON COLUMN users.date_of_birth IS
'Date of birth for Individual investors';

COMMENT ON COLUMN users.nationality IS
'Nationality for Individual investors';

COMMENT ON COLUMN users.passport_number IS
'Passport number for Individual investors';

COMMENT ON COLUMN users.address_line1 IS
'Address line 1 for Individual investors';

COMMENT ON COLUMN users.address_line2 IS
'Address line 2 for Individual investors';

COMMENT ON COLUMN users.city IS
'City for Individual investors';

COMMENT ON COLUMN users.state IS
'State/Province for Individual investors';

COMMENT ON COLUMN users.postal_code IS
'Postal/ZIP code for Individual investors';

COMMENT ON COLUMN users.institution_name IS
'Institution name for Institution investors';

COMMENT ON COLUMN users.institution_type IS
'Type of institution for Institution investors';

COMMENT ON COLUMN users.registration_number IS
'Registration number for Institution investors';

COMMENT ON COLUMN users.legal_representative IS
'Legal representative for Institution investors';

COMMENT ON COLUMN users.fund_name IS
'Fund name for Fund of Funds investors';

COMMENT ON COLUMN users.fund_manager IS
'Fund manager for Fund of Funds investors';

COMMENT ON COLUMN users.aum IS
'Assets under management for Fund of Funds investors';

COMMENT ON COLUMN users.office_name IS
'Office name for Family Office investors';

COMMENT ON COLUMN users.family_name IS
'Family name for Family Office investors';

COMMENT ON COLUMN users.principal_contact IS
'Principal contact for Family Office investors';

COMMENT ON COLUMN users.assets_under_management IS
'Assets under management for Family Office investors';

-- ============================================================================
-- Verification Query (optional - uncomment to verify changes)
-- ============================================================================

-- SELECT column_name, data_type, character_maximum_length
-- FROM information_schema.columns
-- WHERE table_name = 'users'
--   AND column_name IN (
--     'full_name', 'date_of_birth', 'nationality', 'passport_number',
--     'address_line1', 'address_line2', 'city', 'state', 'postal_code',
--     'institution_name', 'institution_type', 'registration_number', 'legal_representative',
--     'fund_name', 'fund_manager', 'aum',
--     'office_name', 'family_name', 'principal_contact', 'assets_under_management'
--   )
-- ORDER BY ordinal_position;
