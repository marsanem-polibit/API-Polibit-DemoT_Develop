-- Add GUEST role (4) to users table role constraint
-- Updates the role check constraint to allow role value 4

-- Step 1: Drop existing role check constraint
ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_role_check;

-- Step 2: Add updated constraint with GUEST role (4)
ALTER TABLE users
ADD CONSTRAINT users_role_check CHECK (role IN (0, 1, 2, 3, 4));

-- Step 3: Add comment to document the role values
COMMENT ON COLUMN users.role IS 'User role: 0=Root, 1=Admin, 2=Support, 3=Investor, 4=Guest';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '================================================';
    RAISE NOTICE '✅ Updated users role constraint';
    RAISE NOTICE '📋 Role values now allowed:';
    RAISE NOTICE '   0 = Root (full access)';
    RAISE NOTICE '   1 = Admin (create, edit, delete)';
    RAISE NOTICE '   2 = Support (read-only with edit)';
    RAISE NOTICE '   3 = Investor (own investments)';
    RAISE NOTICE '   4 = Guest (read-only)';
    RAISE NOTICE '================================================';
END $$;
