-- Fix: Ambiguous column reference in get_investor_portfolio_summary function
-- This updates the function parameter name to avoid conflict with the column name

CREATE OR REPLACE FUNCTION get_investor_portfolio_summary(p_user_id UUID)
RETURNS TABLE (
  total_structures INTEGER,
  total_commitment NUMERIC,
  total_invested NUMERIC,
  total_distributions NUMERIC,
  active_structures INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT si.structure_id)::INTEGER AS total_structures,
    COALESCE(SUM(si.commitment_amount), 0) AS total_commitment,
    COALESCE(SUM(s.total_invested), 0) AS total_invested,
    COALESCE(SUM(s.total_distributed), 0) AS total_distributions,
    COUNT(DISTINCT CASE WHEN s.status = 'Active' THEN si.structure_id END)::INTEGER AS active_structures
  FROM structure_investors si
  JOIN structures s ON s.id = si.structure_id
  WHERE si.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;
