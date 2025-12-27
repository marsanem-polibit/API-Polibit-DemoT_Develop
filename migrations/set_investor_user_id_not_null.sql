-- Set investors.user_id to NOT NULL
-- This migration enforces that all investors must have an associated user account

-- Step 1: Verify there are no NULL user_id values
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count
    FROM investors
    WHERE user_id IS NULL;

    IF null_count > 0 THEN
        RAISE EXCEPTION '❌ Cannot set user_id to NOT NULL: Found % investors with NULL user_id. Please fix these records first.', null_count;
    ELSE
        RAISE NOTICE '✅ All investors have valid user_id values';
    END IF;
END $$;

-- Step 2: Update the foreign key constraint to NOT NULL
ALTER TABLE investors
ALTER COLUMN user_id SET NOT NULL;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Successfully set investors.user_id to NOT NULL';
    RAISE NOTICE '🔒 All investors now require a valid user_id';
END $$;
