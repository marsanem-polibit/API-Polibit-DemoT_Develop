-- Add wallet address field to payments table
-- This migration adds a field for storing blockchain wallet addresses for payments

-- Add wallet_address field
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(255);

-- Create index for performance (optional, if this field will be queried frequently)
CREATE INDEX IF NOT EXISTS idx_payments_wallet_address ON payments(wallet_address);

-- Add comment to document the schema
COMMENT ON COLUMN payments.wallet_address IS 'Blockchain wallet address used for payment transaction';
