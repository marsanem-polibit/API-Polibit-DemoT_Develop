-- Investment Manager Database Tables
-- SQL Schema matching the Supabase models
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- =============================================
-- STRUCTURES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic Info
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('Fund', 'SA/LLC', 'Fideicomiso', 'Private Debt')),
  description TEXT,
  status VARCHAR(50) DEFAULT 'Active',

  -- Hierarchy
  parent_structure_id UUID REFERENCES structures(id) ON DELETE CASCADE,
  hierarchy_level INTEGER DEFAULT 1 CHECK (hierarchy_level BETWEEN 1 AND 5),

  -- Financial Totals
  total_commitment DECIMAL(20, 2) NOT NULL DEFAULT 0,
  total_called DECIMAL(20, 2) DEFAULT 0,
  total_distributed DECIMAL(20, 2) DEFAULT 0,
  total_invested DECIMAL(20, 2) DEFAULT 0,

  -- Economic Terms
  management_fee DECIMAL(5, 2) DEFAULT 2.0,
  carried_interest DECIMAL(5, 2) DEFAULT 20.0,
  hurdle_rate DECIMAL(5, 2) DEFAULT 8.0,
  waterfall_type VARCHAR(20) DEFAULT 'American',

  -- Dates
  inception_date DATE,
  term_years INTEGER DEFAULT 10,
  extension_years INTEGER DEFAULT 2,
  final_date DATE,

  -- Service Providers
  gp TEXT,
  fund_admin TEXT,
  legal_counsel TEXT,
  auditor TEXT,
  tax_advisor TEXT,

  -- Additional Info
  bank_accounts JSONB DEFAULT '{}',
  base_currency VARCHAR(10) DEFAULT 'USD',
  tax_jurisdiction TEXT,
  regulatory_status TEXT,
  investment_strategy TEXT,
  target_returns TEXT,
  risk_profile TEXT,

  -- Metadata
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_structures_user ON structures(user_id);
CREATE INDEX idx_structures_parent ON structures(parent_structure_id);
CREATE INDEX idx_structures_type ON structures(type);
CREATE INDEX idx_structures_status ON structures(status);

-- =============================================
-- INVESTORS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Type
  investor_type VARCHAR(50) NOT NULL CHECK (investor_type IN ('Individual', 'Institution', 'Fund of Funds', 'Family Office')),

  -- Contact Info
  email VARCHAR(255) NOT NULL UNIQUE,
  phone_number VARCHAR(50),
  country VARCHAR(100),

  -- Tax & Compliance
  tax_id VARCHAR(100),
  kyc_status VARCHAR(50) DEFAULT 'Pending',
  accredited_investor BOOLEAN DEFAULT false,

  -- Preferences
  risk_tolerance TEXT,
  investment_preferences JSONB DEFAULT '{}',

  -- Individual Fields
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  date_of_birth DATE,
  nationality VARCHAR(100),
  passport_number VARCHAR(100),
  address_line1 TEXT,
  address_line2 TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),

  -- Institution Fields
  institution_name VARCHAR(255),
  institution_type VARCHAR(100),
  registration_number VARCHAR(100),
  legal_representative VARCHAR(255),

  -- Fund of Funds Fields
  fund_name VARCHAR(255),
  fund_manager VARCHAR(255),
  aum DECIMAL(20, 2),

  -- Family Office Fields
  office_name VARCHAR(255),
  family_name VARCHAR(255),
  principal_contact VARCHAR(255),
  assets_under_management DECIMAL(20, 2),

  -- Metadata
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_investors_user ON investors(user_id);
CREATE INDEX idx_investors_email ON investors(email);
CREATE INDEX idx_investors_type ON investors(investor_type);

-- =============================================
-- STRUCTURE_INVESTORS (Junction Table)
-- =============================================
CREATE TABLE IF NOT EXISTS structure_investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,

  -- Commitment
  commitment_amount DECIMAL(20, 2) NOT NULL,
  called_amount DECIMAL(20, 2) DEFAULT 0,
  distributed_amount DECIMAL(20, 2) DEFAULT 0,

  -- Ownership
  ownership_percent DECIMAL(5, 2),

  -- Custom Terms
  has_custom_terms BOOLEAN DEFAULT false,
  custom_management_fee DECIMAL(5, 2),
  custom_carried_interest DECIMAL(5, 2),

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(structure_id, investor_id)
);

CREATE INDEX idx_structure_investors_structure ON structure_investors(structure_id);
CREATE INDEX idx_structure_investors_investor ON structure_investors(investor_id);

-- =============================================
-- INVESTMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

  -- Basic Info
  investment_name VARCHAR(255) NOT NULL,
  investment_type VARCHAR(20) NOT NULL CHECK (investment_type IN ('EQUITY', 'DEBT', 'MIXED')),
  investment_date DATE,
  exit_date DATE,
  status VARCHAR(50) DEFAULT 'Active',

  -- Equity Fields
  equity_invested DECIMAL(20, 2),
  equity_ownership_percent DECIMAL(5, 2),
  equity_current_value DECIMAL(20, 2),
  equity_exit_value DECIMAL(20, 2),
  equity_realized_gain DECIMAL(20, 2),

  -- Debt Fields
  principal_provided DECIMAL(20, 2),
  interest_rate DECIMAL(5, 2),
  maturity_date DATE,
  principal_repaid DECIMAL(20, 2) DEFAULT 0,
  interest_received DECIMAL(20, 2) DEFAULT 0,
  outstanding_principal DECIMAL(20, 2),

  -- Performance Metrics
  irr_percent DECIMAL(5, 2),
  moic DECIMAL(5, 2),
  total_returns DECIMAL(20, 2) DEFAULT 0,

  -- Additional Info
  sector VARCHAR(100),
  geography VARCHAR(100),
  currency VARCHAR(10) DEFAULT 'USD',
  notes TEXT,

  -- Metadata
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_investments_structure ON investments(structure_id);
CREATE INDEX idx_investments_project ON investments(project_id);
CREATE INDEX idx_investments_user ON investments(user_id);
CREATE INDEX idx_investments_type ON investments(investment_type);

-- =============================================
-- CAPITAL CALLS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS capital_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  investment_id UUID REFERENCES investments(id) ON DELETE SET NULL,

  -- Basic Info
  call_number VARCHAR(50) NOT NULL,
  call_date DATE NOT NULL,
  due_date DATE NOT NULL,
  sent_date DATE,

  -- Amounts
  total_call_amount DECIMAL(20, 2) NOT NULL,
  total_paid_amount DECIMAL(20, 2) DEFAULT 0,
  total_unpaid_amount DECIMAL(20, 2),

  -- Status
  status VARCHAR(50) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Partially Paid', 'Paid')),

  -- Additional Info
  purpose TEXT,
  notes TEXT,

  -- Metadata
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Composite unique constraint: each structure can have its own sequence of call numbers
  UNIQUE(structure_id, call_number)
);

CREATE INDEX idx_capital_calls_structure ON capital_calls(structure_id);
CREATE INDEX idx_capital_calls_user ON capital_calls(user_id);
CREATE INDEX idx_capital_calls_status ON capital_calls(status);

-- =============================================
-- CAPITAL CALL ALLOCATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS capital_call_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  capital_call_id UUID NOT NULL REFERENCES capital_calls(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,

  -- Amounts
  allocated_amount DECIMAL(20, 2) NOT NULL,
  paid_amount DECIMAL(20, 2) DEFAULT 0,
  remaining_amount DECIMAL(20, 2),

  -- Status
  status VARCHAR(50) DEFAULT 'Pending',
  payment_date DATE,
  due_date DATE,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(capital_call_id, investor_id)
);

CREATE INDEX idx_capital_call_allocations_call ON capital_call_allocations(capital_call_id);
CREATE INDEX idx_capital_call_allocations_investor ON capital_call_allocations(investor_id);

-- =============================================
-- DISTRIBUTIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  investment_id UUID REFERENCES investments(id) ON DELETE SET NULL,

  -- Basic Info
  distribution_number VARCHAR(50) NOT NULL,
  distribution_date DATE NOT NULL,
  total_amount DECIMAL(20, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Pending', 'Paid')),

  -- Source
  source TEXT,
  source_equity_gain DECIMAL(20, 2) DEFAULT 0,
  source_debt_interest DECIMAL(20, 2) DEFAULT 0,
  source_debt_principal DECIMAL(20, 2) DEFAULT 0,
  source_other DECIMAL(20, 2) DEFAULT 0,

  -- Waterfall
  waterfall_applied BOOLEAN DEFAULT false,
  tier1_amount DECIMAL(20, 2) DEFAULT 0,
  tier2_amount DECIMAL(20, 2) DEFAULT 0,
  tier3_amount DECIMAL(20, 2) DEFAULT 0,
  tier4_amount DECIMAL(20, 2) DEFAULT 0,

  -- LP/GP Split
  lp_total_amount DECIMAL(20, 2) DEFAULT 0,
  gp_total_amount DECIMAL(20, 2) DEFAULT 0,
  management_fee_amount DECIMAL(20, 2) DEFAULT 0,

  -- Additional Info
  notes TEXT,

  -- Metadata
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_distributions_structure ON distributions(structure_id);
CREATE INDEX idx_distributions_user ON distributions(user_id);
CREATE INDEX idx_distributions_status ON distributions(status);

-- =============================================
-- DISTRIBUTION ALLOCATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS distribution_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  distribution_id UUID NOT NULL REFERENCES distributions(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,

  -- Amounts
  allocated_amount DECIMAL(20, 2) NOT NULL,
  paid_amount DECIMAL(20, 2) DEFAULT 0,

  -- Status
  status VARCHAR(50) DEFAULT 'Pending',
  payment_date DATE,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(distribution_id, investor_id)
);

CREATE INDEX idx_distribution_allocations_dist ON distribution_allocations(distribution_id);
CREATE INDEX idx_distribution_allocations_investor ON distribution_allocations(investor_id);

-- =============================================
-- WATERFALL TIERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS waterfall_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,

  -- Tier Info
  tier_number INTEGER NOT NULL CHECK (tier_number BETWEEN 1 AND 4),
  tier_name VARCHAR(100),

  -- LP/GP Split
  lp_share_percent DECIMAL(5, 2) NOT NULL DEFAULT 0,
  gp_share_percent DECIMAL(5, 2) NOT NULL DEFAULT 0,

  -- Thresholds
  threshold_amount DECIMAL(20, 2),
  threshold_irr DECIMAL(5, 2),

  -- Additional Info
  description TEXT,
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(structure_id, tier_number)
);

CREATE INDEX idx_waterfall_tiers_structure ON waterfall_tiers(structure_id);
CREATE INDEX idx_waterfall_tiers_user ON waterfall_tiers(user_id);

-- =============================================
-- DOCUMENTS TABLE (Polymorphic)
-- =============================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Polymorphic Entity Reference
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('Structure', 'Investor', 'Investment', 'CapitalCall', 'Distribution')),
  entity_id UUID NOT NULL,

  -- Document Info
  document_type VARCHAR(100) NOT NULL,
  document_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(100),

  -- Version Control
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,

  -- Additional Info
  tags JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  notes TEXT,

  -- Metadata
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_documents_entity ON documents(entity_type, entity_id);
CREATE INDEX idx_documents_user ON documents(user_id);
CREATE INDEX idx_documents_type ON documents(document_type);
CREATE INDEX idx_documents_active ON documents(is_active);

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

-- Trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables
CREATE TRIGGER update_structures_updated_at BEFORE UPDATE ON structures FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_investors_updated_at BEFORE UPDATE ON investors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_structure_investors_updated_at BEFORE UPDATE ON structure_investors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_investments_updated_at BEFORE UPDATE ON investments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_capital_calls_updated_at BEFORE UPDATE ON capital_calls FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_capital_call_allocations_updated_at BEFORE UPDATE ON capital_call_allocations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_distributions_updated_at BEFORE UPDATE ON distributions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_distribution_allocations_updated_at BEFORE UPDATE ON distribution_allocations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_waterfall_tiers_updated_at BEFORE UPDATE ON waterfall_tiers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- SUCCESS MESSAGE
-- =============================================
DO $$
BEGIN
    RAISE NOTICE '✅ Investment Manager tables created successfully!';
    RAISE NOTICE '📊 Tables created: structures, investors, structure_investors, investments, capital_calls, capital_call_allocations, distributions, distribution_allocations, waterfall_tiers, documents';
    RAISE NOTICE '🔧 Triggers created for updated_at columns';
END $$;
