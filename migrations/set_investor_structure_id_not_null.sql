-- Set investors.structure_id to NOT NULL
-- This migration enforces that all investors must be associated with a structure

-- Step 1: Verify there are no NULL structure_id values
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count
    FROM investors
    WHERE structure_id IS NULL;

    IF null_count > 0 THEN
        RAISE EXCEPTION '❌ Cannot set structure_id to NOT NULL: Found % investors with NULL structure_id. Please fix these records first.', null_count;
    ELSE
        RAISE NOTICE '✅ All investors have valid structure_id values';
    END IF;
END $$;

-- Step 2: Update the foreign key constraint to NOT NULL
ALTER TABLE investors
ALTER COLUMN structure_id SET NOT NULL;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Successfully set investors.structure_id to NOT NULL';
    RAISE NOTICE '🔒 All investors now require a valid structure_id';
END $$;
