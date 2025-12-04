# Database Migration: Merge Investor Model to User Model

This migration merges the investor model into the user model by updating all database references from `investor_id` to `user_id`.

## Overview

The investor data has been consolidated into the `users` table. This migration updates all related tables to reference `users` instead of `investors`.

## Tables Affected

1. `structure_investors` - Links structures to investor users
2. `capital_call_allocations` - Tracks capital call allocations for investors
3. `distribution_allocations` - Tracks distribution allocations for investors
4. `investment_subscriptions` - Tracks investment subscriptions by investors

## Changes Made

For each table:
- ✅ Rename `investor_id` column to `user_id`
- ✅ Drop old foreign key constraint to `investors` table
- ✅ Create new foreign key constraint to `users` table
- ✅ Add index on `user_id` for query performance
- ✅ Update database functions to use `user_id`

## Prerequisites

Before running this migration:

1. **Backup your database** - Always create a backup before running migrations
2. **Verify data integrity** - Ensure all investor records exist in the `users` table
3. **Stop application** - Consider stopping the application to prevent conflicts during migration

## How to Execute

### Step 1: Pre-Migration Checks

First, run the pre-migration check to identify any issues:

```bash
psql "postgresql://[connection-string]" -f migrations/pre_migration_check.sql
```

### Step 2: Fix Orphaned Records (if needed)

If the pre-migration check found orphaned records or missing user mappings, run:

```bash
psql "postgresql://[connection-string]" -f migrations/fix_orphaned_records.sql
```

This will:
- Identify all `investor_id` values that don't exist in `users` table
- Create user records from the `investors` table data
- Preserve the same IDs to maintain referential integrity

**Alternative:** If you need more control over the data migration:

```bash
psql "postgresql://[connection-string]" -f migrations/migrate_investor_data.sql
```

### Step 3: Run the Main Migration

Once all data integrity issues are resolved:

#### Option 1: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `merge_investor_to_user.sql`
4. Paste into the SQL Editor
5. Click **Run** to execute

#### Option 2: Using psql CLI

```bash
# Connect to your database
psql "postgresql://[user]:[password]@[host]:[port]/[database]"

# Run the migration
\i migrations/merge_investor_to_user.sql
```

#### Option 3: Using Supabase CLI

```bash
# Make sure you're in the project root directory
supabase db push

# Or execute the SQL file directly
supabase db execute --file migrations/merge_investor_to_user.sql
```

## Verification

After running the migration, verify the changes:

```sql
-- Check that user_id column exists in all tables
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('structure_investors', 'capital_call_allocations', 'distribution_allocations', 'investment_subscriptions')
  AND column_name = 'user_id';

-- Verify foreign key constraints point to users table
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('structure_investors', 'capital_call_allocations', 'distribution_allocations', 'investment_subscriptions')
  AND kcu.column_name = 'user_id';
```

## Rollback

If you need to rollback this migration:

```bash
# Execute the rollback script
psql "postgresql://[user]:[password]@[host]:[port]/[database]" -f migrations/rollback_merge_investor_to_user.sql
```

⚠️ **Warning:** Rollback will only work if:
- The `investors` table still exists
- No data has been deleted or modified in a way that breaks the original foreign key relationships

## Post-Migration Steps

1. **Restart application** - Restart your application to pick up the changes
2. **Test thoroughly** - Test all investor-related functionality
3. **Monitor for errors** - Watch logs for any database-related errors
4. **Update documentation** - Update any documentation that references `investor_id`

## Database Functions Updated

The following database functions have been updated to use `user_id`:

- `get_investor_portfolio_summary(p_user_id)` - Previously used `investor_id`
- `get_investor_distribution_total(p_user_id, p_structure_id)` - Previously used `p_investor_id`

## Code Changes

The application code has already been updated to use `user_id`. See the git commit history for details on the code changes.

## Troubleshooting

### Error: Foreign Key Constraint Violation

If you get an error like:
```
ERROR: insert or update on table "structure_investors" violates foreign key constraint
DETAIL: Key (user_id)=(xxx-xxx-xxx) is not present in table "users"
```

**Solution:** Run `fix_orphaned_records.sql` to create the missing user records:

```bash
psql -f migrations/fix_orphaned_records.sql
```

### Migration Scripts Order

1. `pre_migration_check.sql` - Check for issues (optional but recommended)
2. `fix_orphaned_records.sql` or `migrate_investor_data.sql` - Fix data issues (run if needed)
3. `merge_investor_to_user.sql` - Main migration (run after fixing issues)
4. `rollback_merge_investor_to_user.sql` - Rollback (only if needed)

## Support

If you encounter any issues during migration:

1. Check the verification queries above
2. Review the error messages in the database logs
3. Run `fix_orphaned_records.sql` if you have foreign key constraint errors
4. Consult the rollback script if needed
5. Contact the development team for assistance
