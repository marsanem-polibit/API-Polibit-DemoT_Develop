// config/database.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

let supabase = null;

const connectDB = async () => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials. Please check your .env file.');
    }

    // Create Supabase client
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false // Set to true if you need session persistence
      }
    });

    // Test connection by querying the users table
    // This will work once the schema is created
    const { error } = await supabase.from('users').select('count').limit(0);

    // If the error is about the table not existing, user needs to run the schema
    if (error && error.message.includes('does not exist')) {
      console.log(`⚠️  Supabase connected, but tables not found.`);
      console.log(`📋 Please run the SQL schema from docs/supabase-schema.sql in your Supabase dashboard.`);
      console.log(`✅ Supabase client initialized: ${supabaseUrl}`);
      return supabase;
    }

    if (error) {
      throw error;
    }

    console.log(`✅ Supabase Connected: ${supabaseUrl}`);
    return supabase;

  } catch (error) {
    console.error('❌ Supabase connection failed:', error.message);
    process.exit(1);
  }
};

// Get the Supabase client instance
// Auto-initialize for serverless environments (Vercel)
const getSupabase = () => {
  if (!supabase) {
    // Auto-initialize for serverless environments
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials. Please check SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
    }

    console.log('🔄 Auto-initializing Supabase client for serverless environment...');

    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false
      }
    });

    console.log(`✅ Supabase client initialized: ${supabaseUrl}`);
  }
  return supabase;
};

module.exports = { connectDB, getSupabase };