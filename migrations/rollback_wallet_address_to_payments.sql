-- Rollback script for add_wallet_address_to_payments.sql
-- This script removes wallet_address field from payments table

-- Drop index
DROP INDEX IF EXISTS idx_payments_wallet_address;

-- Remove wallet_address field
ALTER TABLE payments
DROP COLUMN IF EXISTS wallet_address;
