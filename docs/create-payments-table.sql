-- Migration: Create payments table
-- Description: Stores structure investment payment data

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  payment_image TEXT,
  transaction_hash TEXT,
  amount TEXT NOT NULL,
  structure_id TEXT NOT NULL,
  contract_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'processing')),
  token_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payments_email ON payments(email);
CREATE INDEX IF NOT EXISTS idx_payments_submission_id ON payments(submission_id);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_hash ON payments(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_payments_structure_id ON payments(structure_id);
CREATE INDEX IF NOT EXISTS idx_payments_contract_id ON payments(contract_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- Add comments to document the table and columns
COMMENT ON TABLE payments IS 'Stores structure investment payment data';
COMMENT ON COLUMN payments.id IS 'Primary key (UUID)';
COMMENT ON COLUMN payments.email IS 'Email address of the payer';
COMMENT ON COLUMN payments.submission_id IS 'DocuSeal submission ID reference';
COMMENT ON COLUMN payments.payment_image IS 'Public URL of payment proof image stored in Supabase Storage';
COMMENT ON COLUMN payments.transaction_hash IS 'Blockchain transaction hash';
COMMENT ON COLUMN payments.amount IS 'Payment amount';
COMMENT ON COLUMN payments.structure_id IS 'Structure ID reference';
COMMENT ON COLUMN payments.contract_id IS 'Smart contract ID reference';
COMMENT ON COLUMN payments.status IS 'Payment status (pending/completed/failed/processing)';
COMMENT ON COLUMN payments.token_id IS 'Token ID reference';
COMMENT ON COLUMN payments.created_at IS 'Timestamp when the record was created';
COMMENT ON COLUMN payments.updated_at IS 'Timestamp when the record was last updated';

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_updated_at();
