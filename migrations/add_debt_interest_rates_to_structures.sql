-- Add debt interest rate fields to structures table
-- This migration adds debt gross interest rate and debt interest rate fields

-- Add debt gross interest rate field
ALTER TABLE structures
ADD COLUMN IF NOT EXISTS debt_gross_interest_rate VARCHAR(255);

-- Add debt interest rate field
ALTER TABLE structures
ADD COLUMN IF NOT EXISTS debt_interest_rate VARCHAR(255);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_structures_debt_gross_interest_rate ON structures(debt_gross_interest_rate);
CREATE INDEX IF NOT EXISTS idx_structures_debt_interest_rate ON structures(debt_interest_rate);

-- Add comments to document the schema
COMMENT ON COLUMN structures.debt_gross_interest_rate IS 'Gross interest rate for debt instruments';
COMMENT ON COLUMN structures.debt_interest_rate IS 'Interest rate for debt instruments';
