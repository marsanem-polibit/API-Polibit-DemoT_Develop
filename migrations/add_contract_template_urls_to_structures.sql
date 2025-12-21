-- Add contract template URL fields to structures table
-- This migration adds fields for storing national and international contract template URLs

-- Add contract template URL fields
ALTER TABLE structures
ADD COLUMN IF NOT EXISTS contract_template_url_national TEXT;

ALTER TABLE structures
ADD COLUMN IF NOT EXISTS contract_template_url_international TEXT;

-- Create indexes for performance (optional, if these fields will be queried frequently)
CREATE INDEX IF NOT EXISTS idx_structures_contract_template_url_national ON structures(contract_template_url_national);
CREATE INDEX IF NOT EXISTS idx_structures_contract_template_url_international ON structures(contract_template_url_international);

-- Add comments to document the schema
COMMENT ON COLUMN structures.contract_template_url_national IS 'URL to contract template for national investors';
COMMENT ON COLUMN structures.contract_template_url_international IS 'URL to contract template for international investors';
