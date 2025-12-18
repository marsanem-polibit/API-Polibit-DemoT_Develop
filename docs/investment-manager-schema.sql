-- Investment Manager Database Schema
-- Supabase PostgreSQL Schema for Investment Management Platform
-- Run this in Supabase SQL Editor to create all required tables

-- =============================================
-- STRUCTURES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic Info
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('Fund', 'SA/LLC', 'Fideicomiso', 'Private Debt')),
  subtype VARCHAR(100),
  jurisdiction VARCHAR(100) NOT NULL,
  us_state VARCHAR(50), -- If jurisdiction is US
  status VARCHAR(50) DEFAULT 'Setup' CHECK (status IN ('Setup', 'Fundraising', 'Active', 'Closed')),

  -- Financial
  total_commitment DECIMAL(20, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'USD',
  inception_date DATE NOT NULL,
  tax_rate DECIMAL(5, 2) DEFAULT 0,

  -- Economic Terms
  management_fee_percent DECIMAL(5, 2) DEFAULT 0,
  performance_fee_percent DECIMAL(5, 2) DEFAULT 0,
  hurdle_rate_percent DECIMAL(5, 2) DEFAULT 0,
  preferred_return_percent DECIMAL(5, 2) DEFAULT 0,
  waterfall_type VARCHAR(20) DEFAULT 'American' CHECK (waterfall_type IN ('American', 'European')),
  distribution_frequency VARCHAR(20),

  -- Metrics
  current_stage VARCHAR(50),
  planned_investments INTEGER DEFAULT 0,

  -- Hierarchy
  hierarchy_level INTEGER DEFAULT 1 CHECK (hierarchy_level BETWEEN 1 AND 5),
  parent_structure_id UUID REFERENCES structures(id) ON DELETE CASCADE,
  apply_waterfall BOOLEAN DEFAULT true,
  apply_economic_terms BOOLEAN DEFAULT true,
  income_flow_target VARCHAR(20) DEFAULT 'Parent',

  -- Calculated fields (updated via triggers/functions)
  total_called_capital DECIMAL(20, 2) DEFAULT 0,
  total_distributed DECIMAL(20, 2) DEFAULT 0,
  investor_count INTEGER DEFAULT 0,
  investment_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for Structures
CREATE INDEX IF NOT EXISTS idx_structures_slug ON structures(slug);
CREATE INDEX IF NOT EXISTS idx_structures_type ON structures(type);
CREATE INDEX IF NOT EXISTS idx_structures_status ON structures(status);
CREATE INDEX IF NOT EXISTS idx_structures_parent ON structures(parent_structure_id);
CREATE INDEX IF NOT EXISTS idx_structures_hierarchy ON structures(hierarchy_level);

-- =============================================
-- INVESTORS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Type
  investor_type VARCHAR(50) NOT NULL CHECK (investor_type IN ('Individual', 'Institution', 'Fund of Funds', 'Family Office')),

  -- Individual Fields
  first_name VARCHAR(100),
  last_name VARCHAR(100),

  -- Entity Fields
  entity_name VARCHAR(255),
  entity_type VARCHAR(50),
  contact_first_name VARCHAR(100),
  contact_last_name VARCHAR(100),

  -- Contact Info
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50),
  address TEXT,
  country VARCHAR(100),

  -- Tax & Status
  tax_id VARCHAR(100),
  status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'KYC/KYB', 'Contracts', 'Payments', 'Active', 'Inactive')),
  investor_since DATE,

  -- Calculated fields
  total_commitment DECIMAL(20, 2) DEFAULT 0,
  total_called_capital DECIMAL(20, 2) DEFAULT 0,
  total_distributed DECIMAL(20, 2) DEFAULT 0,
  current_value DECIMAL(20, 2) DEFAULT 0,
  weighted_irr DECIMAL(5, 2) DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for Investors
CREATE INDEX IF NOT EXISTS idx_investors_email ON investors(email);
CREATE INDEX IF NOT EXISTS idx_investors_type ON investors(investor_type);
CREATE INDEX IF NOT EXISTS idx_investors_status ON investors(status);

-- =============================================
-- STRUCTURE_INVESTORS (Junction Table)
-- =============================================
CREATE TABLE IF NOT EXISTS structure_investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,

  -- Allocation
  commitment_amount DECIMAL(20, 2) NOT NULL,
  called_capital DECIMAL(20, 2) DEFAULT 0,
  uncalled_capital DECIMAL(20, 2) DEFAULT 0,
  current_value DECIMAL(20, 2) DEFAULT 0,
  ownership_percent DECIMAL(5, 2) DEFAULT 0,

  -- Custom Terms (override structure defaults)
  custom_management_fee DECIMAL(5, 2),
  custom_performance_fee DECIMAL(5, 2),
  custom_hurdle_rate DECIMAL(5, 2),
  custom_preferred_return DECIMAL(5, 2),
  has_custom_terms BOOLEAN DEFAULT false,

  -- Metadata
  invested_at DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(structure_id, investor_id)
);

-- Indexes for Structure_Investors
CREATE INDEX IF NOT EXISTS idx_structure_investors_structure ON structure_investors(structure_id);
CREATE INDEX IF NOT EXISTS idx_structure_investors_investor ON structure_investors(investor_id);

-- =============================================
-- INVESTMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,

  -- Basic Info
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  asset_type VARCHAR(50) NOT NULL,
  sector VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Under Construction', 'Stabilized', 'Exited')),
  description TEXT,

  -- Location
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100),
  country VARCHAR(100) NOT NULL,
  zip_code VARCHAR(20),

  -- Investment Type
  investment_type VARCHAR(20) NOT NULL CHECK (investment_type IN ('EQUITY', 'DEBT', 'MIXED')),

  -- Equity Position (if EQUITY or MIXED)
  acquisition_date DATE,
  acquisition_price DECIMAL(20, 2),
  equity_invested DECIMAL(20, 2),
  current_value DECIMAL(20, 2),
  unrealized_gain DECIMAL(20, 2),
  ownership_percent DECIMAL(5, 2),
  fund_commitment DECIMAL(20, 2),

  -- Debt Position (if DEBT or MIXED)
  principal_provided DECIMAL(20, 2),
  interest_rate_percent DECIMAL(5, 2),
  origination_date DATE,
  maturity_date DATE,
  current_debt_value DECIMAL(20, 2),
  accrued_interest DECIMAL(20, 2),

  -- Performance
  irr_percent DECIMAL(5, 2),
  moic DECIMAL(5, 2), -- Multiple of Invested Capital
  last_valuation_date DATE,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,

  UNIQUE(structure_id, slug)
);

-- Indexes for Investments
CREATE INDEX IF NOT EXISTS idx_investments_structure ON investments(structure_id);
CREATE INDEX IF NOT EXISTS idx_investments_type ON investments(investment_type);
CREATE INDEX IF NOT EXISTS idx_investments_asset_type ON investments(asset_type);
CREATE INDEX IF NOT EXISTS idx_investments_status ON investments(status);

-- =============================================
-- CAPITAL_CALLS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS capital_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  related_investment_id UUID REFERENCES investments(id) ON DELETE SET NULL,

  -- Call Info
  call_number VARCHAR(50) NOT NULL,
  total_call_amount DECIMAL(20, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',

  -- Dates
  call_date DATE NOT NULL,
  due_date DATE NOT NULL,
  notice_period_days INTEGER NOT NULL DEFAULT 15,
  sent_date DATE,

  -- Purpose
  purpose VARCHAR(255) NOT NULL,
  use_of_proceeds TEXT,
  description TEXT,

  -- Fees
  management_fee_included BOOLEAN DEFAULT false,
  management_fee_amount DECIMAL(20, 2),

  -- Status
  status VARCHAR(50) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Partially Paid', 'Fully Paid', 'Overdue', 'Cancelled')),

  -- Calculated
  total_paid DECIMAL(20, 2) DEFAULT 0,
  total_outstanding DECIMAL(20, 2) DEFAULT 0,
  collection_rate_percent DECIMAL(5, 2) DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Composite unique constraint: each structure can have its own sequence of call numbers
  UNIQUE(structure_id, call_number)
);

-- Indexes for Capital_Calls
CREATE INDEX IF NOT EXISTS idx_capital_calls_structure ON capital_calls(structure_id);
CREATE INDEX IF NOT EXISTS idx_capital_calls_investment ON capital_calls(related_investment_id);
CREATE INDEX IF NOT EXISTS idx_capital_calls_status ON capital_calls(status);
CREATE INDEX IF NOT EXISTS idx_capital_calls_call_date ON capital_calls(call_date);

-- =============================================
-- CAPITAL_CALL_ALLOCATIONS (Junction Table)
-- =============================================
CREATE TABLE IF NOT EXISTS capital_call_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  capital_call_id UUID NOT NULL REFERENCES capital_calls(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,

  -- Allocation
  ownership_percent DECIMAL(5, 2) NOT NULL,
  call_amount DECIMAL(20, 2) NOT NULL,
  amount_paid DECIMAL(20, 2) DEFAULT 0,
  amount_outstanding DECIMAL(20, 2) DEFAULT 0,

  -- Status
  payment_status VARCHAR(50) DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Partial', 'Paid', 'Overdue')),
  payment_date DATE,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(capital_call_id, investor_id)
);

-- Indexes for Capital_Call_Allocations
CREATE INDEX IF NOT EXISTS idx_capital_call_allocations_call ON capital_call_allocations(capital_call_id);
CREATE INDEX IF NOT EXISTS idx_capital_call_allocations_investor ON capital_call_allocations(investor_id);

-- =============================================
-- DISTRIBUTIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,

  -- Distribution Info
  distribution_number VARCHAR(50) NOT NULL UNIQUE,
  total_distribution_amount DECIMAL(20, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',

  -- Dates
  distribution_date DATE NOT NULL,
  record_date DATE NOT NULL,
  payment_date DATE NOT NULL,

  -- Source Breakdown
  source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('Operating Income', 'Exit Proceeds', 'Preferred Return', 'Carried Interest', 'Other')),
  return_of_capital_amount DECIMAL(20, 2) DEFAULT 0,
  investment_income_amount DECIMAL(20, 2) DEFAULT 0,
  capital_gain_amount DECIMAL(20, 2) DEFAULT 0,

  -- Status
  status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Processing', 'Completed', 'Failed')),
  completion_date DATE,

  -- Waterfall Calculation
  waterfall_applied BOOLEAN DEFAULT false,
  tier1_amount DECIMAL(20, 2) DEFAULT 0, -- Return of Capital
  tier2_amount DECIMAL(20, 2) DEFAULT 0, -- Preferred Return
  tier3_amount DECIMAL(20, 2) DEFAULT 0, -- GP Catch-Up
  tier4_amount DECIMAL(20, 2) DEFAULT 0, -- Carried Interest
  lp_total_amount DECIMAL(20, 2) DEFAULT 0,
  gp_total_amount DECIMAL(20, 2) DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for Distributions
CREATE INDEX IF NOT EXISTS idx_distributions_structure ON distributions(structure_id);
CREATE INDEX IF NOT EXISTS idx_distributions_status ON distributions(status);
CREATE INDEX IF NOT EXISTS idx_distributions_distribution_date ON distributions(distribution_date);

-- =============================================
-- DISTRIBUTION_ALLOCATIONS (Junction Table)
-- =============================================
CREATE TABLE IF NOT EXISTS distribution_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  distribution_id UUID NOT NULL REFERENCES distributions(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,

  -- Allocation
  ownership_percent DECIMAL(5, 2) NOT NULL,
  distribution_amount DECIMAL(20, 2) NOT NULL,

  -- Waterfall Breakdown
  tier1_share DECIMAL(20, 2) DEFAULT 0,
  tier2_share DECIMAL(20, 2) DEFAULT 0,
  tier3_share DECIMAL(20, 2) DEFAULT 0,
  tier4_share DECIMAL(20, 2) DEFAULT 0,

  -- Status
  payment_status VARCHAR(50) DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Processing', 'Paid', 'Failed')),
  payment_date DATE,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(distribution_id, investor_id)
);

-- Indexes for Distribution_Allocations
CREATE INDEX IF NOT EXISTS idx_distribution_allocations_distribution ON distribution_allocations(distribution_id);
CREATE INDEX IF NOT EXISTS idx_distribution_allocations_investor ON distribution_allocations(investor_id);

-- =============================================
-- WATERFALL_TIERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS waterfall_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,

  -- Tier Info
  tier_number INTEGER NOT NULL CHECK (tier_number BETWEEN 1 AND 4),
  tier_name VARCHAR(100) NOT NULL,
  tier_description TEXT,

  -- Allocation
  lp_share_percent DECIMAL(5, 2) NOT NULL DEFAULT 0,
  gp_share_percent DECIMAL(5, 2) NOT NULL DEFAULT 0,

  -- Calculation
  target_amount DECIMAL(20, 2),
  target_rate_percent DECIMAL(5, 2),
  calculation_type VARCHAR(50), -- 'FIXED', 'PERCENTAGE', 'CATCH_UP', 'SPLIT'

  -- Order
  sort_order INTEGER NOT NULL,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(structure_id, tier_number)
);

-- Indexes for Waterfall_Tiers
CREATE INDEX IF NOT EXISTS idx_waterfall_tiers_structure ON waterfall_tiers(structure_id);
CREATE INDEX IF NOT EXISTS idx_waterfall_tiers_tier_number ON waterfall_tiers(tier_number);

-- =============================================
-- DOCUMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Entity Reference (polymorphic)
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('Structure', 'Investor', 'Investment', 'CapitalCall', 'Distribution')),
  entity_id UUID NOT NULL,

  -- Document Info
  document_type VARCHAR(100) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(100),

  -- Metadata
  description TEXT,
  upload_date TIMESTAMP DEFAULT NOW(),
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Tags
  tags TEXT[], -- Array of tags

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for Documents
CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

CREATE TRIGGER update_structures_updated_at BEFORE UPDATE ON structures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_investors_updated_at BEFORE UPDATE ON investors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_structure_investors_updated_at BEFORE UPDATE ON structure_investors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_investments_updated_at BEFORE UPDATE ON investments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_capital_calls_updated_at BEFORE UPDATE ON capital_calls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_capital_call_allocations_updated_at BEFORE UPDATE ON capital_call_allocations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_distributions_updated_at BEFORE UPDATE ON distributions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_distribution_allocations_updated_at BEFORE UPDATE ON distribution_allocations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_waterfall_tiers_updated_at BEFORE UPDATE ON waterfall_tiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE structures IS 'Fund/SPV/Trust structures with hierarchy support';
COMMENT ON TABLE investors IS 'Limited Partners (LPs) - individuals, institutions, FOFs, family offices';
COMMENT ON TABLE structure_investors IS 'Junction table for investor allocations to structures with custom terms';
COMMENT ON TABLE investments IS 'Portfolio investments with equity and/or debt positions';
COMMENT ON TABLE capital_calls IS 'Capital call notices to investors';
COMMENT ON TABLE capital_call_allocations IS 'Per-investor allocations for capital calls';
COMMENT ON TABLE distributions IS 'Distributions to investors with waterfall calculations';
COMMENT ON TABLE distribution_allocations IS 'Per-investor allocations for distributions';
COMMENT ON TABLE waterfall_tiers IS 'Waterfall distribution tiers (American/European)';
COMMENT ON TABLE documents IS 'Document storage with polymorphic entity references';
