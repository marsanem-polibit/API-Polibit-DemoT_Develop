#!/usr/bin/env node
/**
 * Migration Runner Script
 * Runs SQL migrations against the Supabase database
 */

const { getSupabase } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function runMigration(migrationFile) {
  try {
    console.log(`\n🔄 Running migration: ${migrationFile}`);

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', migrationFile);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Get Supabase client
    const supabase = getSupabase();

    // Run the SQL migration using Supabase RPC
    // Note: This requires the SQL to be split into individual statements
    // For complex migrations, it's better to run directly in Supabase dashboard
    const { data, error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      // If exec_sql RPC doesn't exist, provide instructions
      if (error.message.includes('exec_sql')) {
        console.log('\n⚠️  Direct SQL execution not available via Supabase client.');
        console.log('\n📋 Please run this migration manually in your Supabase dashboard:');
        console.log(`   1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT/sql`);
        console.log(`   2. Copy the contents of: ${migrationPath}`);
        console.log(`   3. Paste and execute in the SQL editor\n`);
        console.log('Migration SQL:');
        console.log('═'.repeat(80));
        console.log(sql);
        console.log('═'.repeat(80));
        return false;
      }
      throw error;
    }

    console.log(`✅ Migration completed successfully!`);
    return true;

  } catch (error) {
    console.error(`❌ Migration failed:`, error.message);
    return false;
  }
}

// Get migration file from command line args
const migrationFile = process.argv[2] || 'fix_capital_calls_unique_constraint.sql';

runMigration(migrationFile)
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
