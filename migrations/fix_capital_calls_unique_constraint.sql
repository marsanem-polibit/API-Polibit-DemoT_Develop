-- Fix capital_calls unique constraint
-- Change from unique constraint on call_number alone to composite unique on (structure_id, call_number)
-- This allows different structures to have the same call numbers while preventing duplicates within a structure

-- Step 1: Drop the existing unique constraint on call_number
ALTER TABLE capital_calls DROP CONSTRAINT IF EXISTS capital_calls_call_number_key;

-- Step 2: Add composite unique constraint on (structure_id, call_number)
ALTER TABLE capital_calls ADD CONSTRAINT capital_calls_structure_call_number_key
  UNIQUE (structure_id, call_number);

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Fixed capital_calls unique constraint!';
    RAISE NOTICE '📊 Changed from UNIQUE(call_number) to UNIQUE(structure_id, call_number)';
    RAISE NOTICE '🔧 Each structure can now have its own sequence of call numbers';
END $$;
