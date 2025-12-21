-- Rollback script for add_contract_template_urls_to_structures.sql
-- This script removes contract template URL fields from structures table

-- Drop indexes
DROP INDEX IF EXISTS idx_structures_contract_template_url_national;
DROP INDEX IF EXISTS idx_structures_contract_template_url_international;

-- Remove contract template URL fields
ALTER TABLE structures
DROP COLUMN IF EXISTS contract_template_url_national;

ALTER TABLE structures
DROP COLUMN IF EXISTS contract_template_url_international;
