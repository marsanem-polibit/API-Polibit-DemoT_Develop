-- Add financial, banking, and blockchain fields to structures table
-- This migration adds ticket limits, strategy type, banking details, and blockchain information

-- Add minimum and maximum ticket fields
ALTER TABLE structures
ADD COLUMN IF NOT EXISTS minimum_ticket DOUBLE PRECISION;

ALTER TABLE structures
ADD COLUMN IF NOT EXISTS maximum_ticket DOUBLE PRECISION;

-- Add strategy instrument type
ALTER TABLE structures
ADD COLUMN IF NOT EXISTS strategy_instrument_type VARCHAR(255);

-- Add local bank account fields
ALTER TABLE structures
ADD COLUMN IF NOT EXISTS local_bank_name VARCHAR(255);

ALTER TABLE structures
ADD COLUMN IF NOT EXISTS local_account_bank VARCHAR(255);

ALTER TABLE structures
ADD COLUMN IF NOT EXISTS local_routing_bank VARCHAR(255);

ALTER TABLE structures
ADD COLUMN IF NOT EXISTS local_account_holder VARCHAR(255);

ALTER TABLE structures
ADD COLUMN IF NOT EXISTS local_bank_address TEXT;

-- Add international bank account fields
ALTER TABLE structures
ADD COLUMN IF NOT EXISTS international_bank_name VARCHAR(255);

ALTER TABLE structures
ADD COLUMN IF NOT EXISTS international_account_bank VARCHAR(255);

ALTER TABLE structures
ADD COLUMN IF NOT EXISTS international_swift VARCHAR(255);

ALTER TABLE structures
ADD COLUMN IF NOT EXISTS international_holder_name VARCHAR(255);

ALTER TABLE structures
ADD COLUMN IF NOT EXISTS international_bank_address TEXT;

-- Add blockchain fields
ALTER TABLE structures
ADD COLUMN IF NOT EXISTS blockchain_network VARCHAR(100);

ALTER TABLE structures
ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(255);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_structures_minimum_ticket ON structures(minimum_ticket);
CREATE INDEX IF NOT EXISTS idx_structures_maximum_ticket ON structures(maximum_ticket);
CREATE INDEX IF NOT EXISTS idx_structures_strategy_instrument_type ON structures(strategy_instrument_type);
CREATE INDEX IF NOT EXISTS idx_structures_blockchain_network ON structures(blockchain_network);
CREATE INDEX IF NOT EXISTS idx_structures_wallet_address ON structures(wallet_address);

-- Add comments to document the schema
COMMENT ON COLUMN structures.minimum_ticket IS 'Minimum investment ticket amount';
COMMENT ON COLUMN structures.maximum_ticket IS 'Maximum investment ticket amount';
COMMENT ON COLUMN structures.strategy_instrument_type IS 'Type of investment strategy instrument';
COMMENT ON COLUMN structures.local_bank_name IS 'Name of local banking institution';
COMMENT ON COLUMN structures.local_account_bank IS 'Local bank account number';
COMMENT ON COLUMN structures.local_routing_bank IS 'Local bank routing number';
COMMENT ON COLUMN structures.local_account_holder IS 'Local bank account holder name';
COMMENT ON COLUMN structures.local_bank_address IS 'Local bank physical address';
COMMENT ON COLUMN structures.international_bank_name IS 'Name of international banking institution';
COMMENT ON COLUMN structures.international_account_bank IS 'International bank account number';
COMMENT ON COLUMN structures.international_swift IS 'SWIFT/BIC code for international transfers';
COMMENT ON COLUMN structures.international_holder_name IS 'International bank account holder name';
COMMENT ON COLUMN structures.international_bank_address IS 'International bank physical address';
COMMENT ON COLUMN structures.blockchain_network IS 'Blockchain network for digital assets (e.g., ethereum, polygon)';
COMMENT ON COLUMN structures.wallet_address IS 'Blockchain wallet address for receiving/sending digital assets';
