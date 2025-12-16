-- Create smart_contracts table for ERC3643 and other blockchain contract deployments
-- This table tracks deployed smart contracts and their deployment status

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS smart_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Structure and project references
    structure_id VARCHAR(255),

    -- Contract type and deployment status
    contract_type VARCHAR(50) NOT NULL DEFAULT 'ERC3643',
    deployment_status VARCHAR(50) NOT NULL DEFAULT 'pending',

    -- Blockchain addresses
    compliance_registry_address TEXT,
    contract_address TEXT,
    factory_address TEXT,
    identity_registry_address TEXT,
    transaction_hash TEXT,

    -- Network information
    network VARCHAR(100) DEFAULT 'polygon',

    -- Company and project information
    company VARCHAR(255) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    project_name VARCHAR(255) NOT NULL,

    -- Token information
    token_name VARCHAR(255) NOT NULL,
    token_symbol VARCHAR(50) NOT NULL,
    token_value TEXT NOT NULL,
    max_tokens BIGINT NOT NULL CHECK (max_tokens >= 0),
    minted_tokens TEXT DEFAULT '0',

    -- User reference
    deployed_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Deployment tracking
    deployment_error TEXT,
    deployment_response JSONB,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_smart_contracts_contract_address ON smart_contracts(contract_address);
CREATE INDEX IF NOT EXISTS idx_smart_contracts_deployment_status ON smart_contracts(deployment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_smart_contracts_deployed_by ON smart_contracts(deployed_by, deployment_status);
CREATE INDEX IF NOT EXISTS idx_smart_contracts_contract_type ON smart_contracts(contract_type);
CREATE INDEX IF NOT EXISTS idx_smart_contracts_structure_id ON smart_contracts(structure_id);
CREATE INDEX IF NOT EXISTS idx_smart_contracts_transaction_hash ON smart_contracts(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_smart_contracts_network ON smart_contracts(network);
CREATE INDEX IF NOT EXISTS idx_smart_contracts_company ON smart_contracts(company);
CREATE INDEX IF NOT EXISTS idx_smart_contracts_token_symbol ON smart_contracts(token_symbol);

-- Add check constraint for contract_type values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'smart_contracts_contract_type_check'
    ) THEN
        ALTER TABLE smart_contracts
        ADD CONSTRAINT smart_contracts_contract_type_check
        CHECK (contract_type IN ('ERC3643', 'ERC20', 'ERC721', 'ERC1155', 'OTHER'));
    END IF;
END $$;

-- Add check constraint for deployment_status values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'smart_contracts_deployment_status_check'
    ) THEN
        ALTER TABLE smart_contracts
        ADD CONSTRAINT smart_contracts_deployment_status_check
        CHECK (deployment_status IN ('pending', 'deploying', 'deployed', 'failed'));
    END IF;
END $$;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_smart_contracts_updated_at ON smart_contracts;
CREATE TRIGGER update_smart_contracts_updated_at
    BEFORE UPDATE ON smart_contracts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments to document the schema
COMMENT ON TABLE smart_contracts IS 'Blockchain smart contract deployments tracking';
COMMENT ON COLUMN smart_contracts.contract_type IS 'Type of smart contract: ERC3643, ERC20, ERC721, ERC1155, or OTHER';
COMMENT ON COLUMN smart_contracts.deployment_status IS 'Deployment lifecycle status: pending, deploying, deployed, or failed';
COMMENT ON COLUMN smart_contracts.compliance_registry_address IS 'ERC3643 compliance registry contract address';
COMMENT ON COLUMN smart_contracts.contract_address IS 'Deployed smart contract address on blockchain';
COMMENT ON COLUMN smart_contracts.factory_address IS 'Factory contract address used for deployment';
COMMENT ON COLUMN smart_contracts.identity_registry_address IS 'ERC3643 identity registry contract address';
COMMENT ON COLUMN smart_contracts.transaction_hash IS 'Blockchain transaction hash for the deployment';
COMMENT ON COLUMN smart_contracts.network IS 'Blockchain network (e.g., polygon, ethereum, binance)';
COMMENT ON COLUMN smart_contracts.max_tokens IS 'Maximum number of tokens that can be minted';
COMMENT ON COLUMN smart_contracts.minted_tokens IS 'Current number of minted tokens (stored as string for large numbers)';
COMMENT ON COLUMN smart_contracts.deployed_by IS 'User ID who initiated the deployment';
COMMENT ON COLUMN smart_contracts.deployment_error IS 'Error message if deployment failed';
COMMENT ON COLUMN smart_contracts.deployment_response IS 'Full JSON response from the deployment API';
