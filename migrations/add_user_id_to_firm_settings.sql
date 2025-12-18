-- Add user_id and created_at columns to firm_settings table
-- This allows tracking which user owns/created the firm settings

-- Step 1: Add user_id column (nullable initially to handle existing records)
ALTER TABLE firm_settings
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Step 2: Add created_at column with default value
ALTER TABLE firm_settings
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Step 3: Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_firm_settings_user_id ON firm_settings(user_id);

-- Step 4: Add comment to document the column
COMMENT ON COLUMN firm_settings.user_id IS 'ID of the user who owns/created these firm settings';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Added user_id and created_at columns to firm_settings table';
    RAISE NOTICE '📊 user_id references users(id) and is nullable';
    RAISE NOTICE '🔧 Index created on user_id for performance';
END $$;
