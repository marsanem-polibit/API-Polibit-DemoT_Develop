-- Add unique constraint to investors table for (user_id, structure_id) combination
-- This ensures one investor profile per user-structure combination

-- Step 1: Remove any duplicate records (keep the most recent one)
DELETE FROM investors a USING investors b
WHERE a.id < b.id
AND a.user_id = b.user_id
AND a.structure_id = b.structure_id
AND a.user_id IS NOT NULL
AND a.structure_id IS NOT NULL;

-- Step 2: Add unique constraint
ALTER TABLE investors
ADD CONSTRAINT unique_investor_user_structure
UNIQUE (user_id, structure_id);

-- Step 3: Add comment to document the constraint
COMMENT ON CONSTRAINT unique_investor_user_structure ON investors IS 'Ensures one investor profile per user-structure combination';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Added unique constraint to investors table';
    RAISE NOTICE '🔒 Constraint: unique_investor_user_structure (user_id, structure_id)';
    RAISE NOTICE '📋 Prevents duplicate investor profiles for the same user-structure pair';
END $$;
