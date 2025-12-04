-- Migration: Merge Investor Model to User Model
-- This migration renames investor_id to user_id in all related tables
-- and updates foreign key constraints to reference the users table

-- ============================================================================
-- STEP 1: Update structure_investors table
-- ============================================================================

-- Drop existing foreign key constraint for investor_id
ALTER TABLE structure_investors
DROP CONSTRAINT IF EXISTS structure_investors_investor_id_fkey;

-- Rename investor_id column to user_id
ALTER TABLE structure_investors
RENAME COLUMN investor_id TO user_id;

-- Add new foreign key constraint referencing users table
ALTER TABLE structure_investors
ADD CONSTRAINT structure_investors_user_id_fkey
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Create index on user_id for better query performance
CREATE INDEX IF NOT EXISTS idx_structure_investors_user_id
ON structure_investors(user_id);

-- ============================================================================
-- STEP 2: Update capital_call_allocations table
-- ============================================================================

-- Drop existing foreign key constraint for investor_id
ALTER TABLE capital_call_allocations
DROP CONSTRAINT IF EXISTS capital_call_allocations_investor_id_fkey;

-- Rename investor_id column to user_id
ALTER TABLE capital_call_allocations
RENAME COLUMN investor_id TO user_id;

-- Add new foreign key constraint referencing users table
ALTER TABLE capital_call_allocations
ADD CONSTRAINT capital_call_allocations_user_id_fkey
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Create index on user_id for better query performance
CREATE INDEX IF NOT EXISTS idx_capital_call_allocations_user_id
ON capital_call_allocations(user_id);

-- ============================================================================
-- STEP 3: Update distribution_allocations table
-- ============================================================================

-- Drop existing foreign key constraint for investor_id
ALTER TABLE distribution_allocations
DROP CONSTRAINT IF EXISTS distribution_allocations_investor_id_fkey;

-- Rename investor_id column to user_id
ALTER TABLE distribution_allocations
RENAME COLUMN investor_id TO user_id;

-- Add new foreign key constraint referencing users table
ALTER TABLE distribution_allocations
ADD CONSTRAINT distribution_allocations_user_id_fkey
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Create index on user_id for better query performance
CREATE INDEX IF NOT EXISTS idx_distribution_allocations_user_id
ON distribution_allocations(user_id);

-- ============================================================================
-- STEP 4: Update investment_subscriptions table
-- ============================================================================

-- Drop existing foreign key constraint for investor_id
ALTER TABLE investment_subscriptions
DROP CONSTRAINT IF EXISTS investment_subscriptions_investor_id_fkey;

-- Rename investor_id column to user_id
ALTER TABLE investment_subscriptions
RENAME COLUMN investor_id TO user_id;

-- Add new foreign key constraint referencing users table
ALTER TABLE investment_subscriptions
ADD CONSTRAINT investment_subscriptions_user_id_fkey
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Create index on user_id for better query performance
CREATE INDEX IF NOT EXISTS idx_investment_subscriptions_user_id
ON investment_subscriptions(user_id);

-- ============================================================================
-- STEP 5: Update database functions/stored procedures
-- ============================================================================

-- Update get_investor_portfolio_summary function to use user_id
CREATE OR REPLACE FUNCTION get_investor_portfolio_summary(p_user_id UUID)
RETURNS TABLE (
  total_structures INTEGER,
  total_commitment NUMERIC,
  total_invested NUMERIC,
  total_distributions NUMERIC,
  active_structures INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT si.structure_id)::INTEGER AS total_structures,
    COALESCE(SUM(si.commitment_amount), 0) AS total_commitment,
    COALESCE(SUM(s.total_invested), 0) AS total_invested,
    COALESCE(SUM(s.total_distributed), 0) AS total_distributions,
    COUNT(DISTINCT CASE WHEN s.status = 'Active' THEN si.structure_id END)::INTEGER AS active_structures
  FROM structure_investors si
  JOIN structures s ON s.id = si.structure_id
  WHERE si.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Update get_investor_distribution_total function to use user_id
CREATE OR REPLACE FUNCTION get_investor_distribution_total(p_user_id UUID, p_structure_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  total_amount NUMERIC;
BEGIN
  SELECT COALESCE(SUM(da.allocated_amount), 0)
  INTO total_amount
  FROM distribution_allocations da
  JOIN distributions d ON d.id = da.distribution_id
  WHERE da.user_id = p_user_id
    AND d.structure_id = p_structure_id;

  RETURN total_amount;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 6: Add comments to document the changes
-- ============================================================================

COMMENT ON COLUMN structure_investors.user_id IS 'Foreign key to users table (formerly investor_id from investors table)';
COMMENT ON COLUMN capital_call_allocations.user_id IS 'Foreign key to users table (formerly investor_id from investors table)';
COMMENT ON COLUMN distribution_allocations.user_id IS 'Foreign key to users table (formerly investor_id from investors table)';
COMMENT ON COLUMN investment_subscriptions.user_id IS 'Foreign key to users table (formerly investor_id from investors table)';

-- ============================================================================
-- VERIFICATION QUERIES (commented out - uncomment to verify changes)
-- ============================================================================

-- Verify structure_investors table
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'structure_investors' AND column_name = 'user_id';

-- Verify capital_call_allocations table
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'capital_call_allocations' AND column_name = 'user_id';

-- Verify distribution_allocations table
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'distribution_allocations' AND column_name = 'user_id';

-- Verify investment_subscriptions table
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'investment_subscriptions' AND column_name = 'user_id';

-- Verify foreign key constraints
-- SELECT
--   tc.table_name,
--   kcu.column_name,
--   ccu.table_name AS foreign_table_name,
--   ccu.column_name AS foreign_column_name
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu
--   ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND tc.table_name IN ('structure_investors', 'capital_call_allocations', 'distribution_allocations', 'investment_subscriptions')
--   AND kcu.column_name = 'user_id';
