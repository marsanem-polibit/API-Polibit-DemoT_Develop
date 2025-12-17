-- Add income flow, VAT, tax, and fund configuration fields to structures table
-- This migration adds income flow targets, VAT rates, tax rates, tier calculations, and fund type

-- Add income flow target
ALTER TABLE structures
ADD COLUMN IF NOT EXISTS income_flow_target VARCHAR(255);

-- Add VAT rate fields
ALTER TABLE structures
ADD COLUMN IF NOT EXISTS vat_rate VARCHAR(100);

ALTER TABLE structures
ADD COLUMN IF NOT EXISTS vat_rate_natural_persons VARCHAR(100);

ALTER TABLE structures
ADD COLUMN IF NOT EXISTS vat_rate_legal_entities VARCHAR(100);

-- Add default tax rate
ALTER TABLE structures
ADD COLUMN IF NOT EXISTS default_tax_rate VARCHAR(100);

-- Add tier and issuance calculation fields
ALTER TABLE structures
ADD COLUMN IF NOT EXISTS determined_tier VARCHAR(100);

ALTER TABLE structures
ADD COLUMN IF NOT EXISTS calculated_issuances VARCHAR(255);

-- Add capital call default percentage
ALTER TABLE structures
ADD COLUMN IF NOT EXISTS capital_call_default_percentage VARCHAR(100);

-- Add fund type
ALTER TABLE structures
ADD COLUMN IF NOT EXISTS fund_type VARCHAR(100);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_structures_income_flow_target ON structures(income_flow_target);
CREATE INDEX IF NOT EXISTS idx_structures_fund_type ON structures(fund_type);
CREATE INDEX IF NOT EXISTS idx_structures_determined_tier ON structures(determined_tier);

-- Add comments to document the schema
COMMENT ON COLUMN structures.income_flow_target IS 'Target income flow for the structure';
COMMENT ON COLUMN structures.vat_rate IS 'General VAT (Value Added Tax) rate';
COMMENT ON COLUMN structures.vat_rate_natural_persons IS 'VAT rate for natural persons';
COMMENT ON COLUMN structures.vat_rate_legal_entities IS 'VAT rate for legal entities';
COMMENT ON COLUMN structures.default_tax_rate IS 'Default tax rate for the structure';
COMMENT ON COLUMN structures.determined_tier IS 'Calculated or determined tier level';
COMMENT ON COLUMN structures.calculated_issuances IS 'Calculated issuance amounts or schedule';
COMMENT ON COLUMN structures.capital_call_default_percentage IS 'Default percentage for capital calls';
COMMENT ON COLUMN structures.fund_type IS 'Type or category of fund';
