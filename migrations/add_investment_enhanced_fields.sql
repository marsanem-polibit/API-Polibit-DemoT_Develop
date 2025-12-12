-- Migration: Add Enhanced Investment Fields
-- This migration adds comprehensive investment tracking fields including valuation,
-- property-specific data, and performance metrics

-- ============================================================================
-- Add Core Investment Information Fields
-- ============================================================================

-- Add name column if missing (short investment name)
ALTER TABLE investments
ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Add description column if missing (detailed description)
ALTER TABLE investments
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add type column if missing (e.g., "Real Estate", "Technology", etc.)
ALTER TABLE investments
ADD COLUMN IF NOT EXISTS type VARCHAR(100);

-- Add origination_date column if missing
ALTER TABLE investments
ADD COLUMN IF NOT EXISTS origination_date TIMESTAMP;

-- Add fund_id column if missing (reference to fund structure)
ALTER TABLE investments
ADD COLUMN IF NOT EXISTS fund_id UUID;

-- Add fund_commitment column if missing
ALTER TABLE investments
ADD COLUMN IF NOT EXISTS fund_commitment DECIMAL(15, 2) DEFAULT 0;

-- ============================================================================
-- Add Equity Enhancement Fields
-- ============================================================================

-- Add ownership_percentage column if missing
ALTER TABLE investments
ADD COLUMN IF NOT EXISTS ownership_percentage DECIMAL(10, 4) DEFAULT 0;

-- Add current_equity_value column if missing
ALTER TABLE investments
ADD COLUMN IF NOT EXISTS current_equity_value DECIMAL(15, 2) DEFAULT 0;

-- Add unrealized_gain column if missing
ALTER TABLE investments
ADD COLUMN IF NOT EXISTS unrealized_gain DECIMAL(15, 2) DEFAULT 0;

-- ============================================================================
-- Add Debt Enhancement Fields
-- ============================================================================

-- Add accrued_interest column if missing
ALTER TABLE investments
ADD COLUMN IF NOT EXISTS accrued_interest DECIMAL(15, 2) DEFAULT 0;

-- Add current_debt_value column if missing
ALTER TABLE investments
ADD COLUMN IF NOT EXISTS current_debt_value DECIMAL(15, 2) DEFAULT 0;

-- ============================================================================
-- Add Performance Metrics Fields
-- ============================================================================

-- Add irr column if missing (Internal Rate of Return)
ALTER TABLE investments
ADD COLUMN IF NOT EXISTS irr DECIMAL(10, 4) DEFAULT 0;

-- Add multiple column if missing (Investment Multiple)
ALTER TABLE investments
ADD COLUMN IF NOT EXISTS multiple DECIMAL(10, 4) DEFAULT 0;

-- Add current_value column if missing (Total current value)
ALTER TABLE investments
ADD COLUMN IF NOT EXISTS current_value DECIMAL(15, 2) DEFAULT 0;

-- Add total_invested column if missing
ALTER TABLE investments
ADD COLUMN IF NOT EXISTS total_invested DECIMAL(15, 2) DEFAULT 0;

-- Add total_investment_size column if missing
ALTER TABLE investments
ADD COLUMN IF NOT EXISTS total_investment_size DECIMAL(15, 2) DEFAULT 0;

-- Add last_valuation_date column if missing
ALTER TABLE investments
ADD COLUMN IF NOT EXISTS last_valuation_date TIMESTAMP;

-- ============================================================================
-- Add Property-Specific Fields
-- ============================================================================

-- Add total_property_value column if missing
ALTER TABLE investments
ADD COLUMN IF NOT EXISTS total_property_value DECIMAL(15, 2) DEFAULT 0;

-- ============================================================================
-- Add Foreign Key Constraint for fund_id (optional)
-- ============================================================================

-- Add foreign key constraint if it doesn't exist
-- This ensures fund_id references a valid structure
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'investments_fund_id_fkey'
        AND table_name = 'investments'
    ) THEN
        ALTER TABLE investments
        ADD CONSTRAINT investments_fund_id_fkey
        FOREIGN KEY (fund_id) REFERENCES structures(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- Create Index for Better Query Performance
-- ============================================================================

-- Create index on fund_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_investments_fund_id ON investments(fund_id);

-- Create index on origination_date for date-based queries
CREATE INDEX IF NOT EXISTS idx_investments_origination_date ON investments(origination_date);

-- Create index on last_valuation_date for recent valuations
CREATE INDEX IF NOT EXISTS idx_investments_last_valuation_date ON investments(last_valuation_date);

-- ============================================================================
-- Verification
-- ============================================================================

-- Verify all columns were added
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'investments'
AND column_name IN (
    'name',
    'description',
    'type',
    'origination_date',
    'fund_id',
    'fund_commitment',
    'ownership_percentage',
    'current_equity_value',
    'unrealized_gain',
    'accrued_interest',
    'current_debt_value',
    'irr',
    'multiple',
    'current_value',
    'total_invested',
    'total_investment_size',
    'last_valuation_date',
    'total_property_value'
)
ORDER BY column_name;
