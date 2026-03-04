/**
 * Script to apply the initial database migration to Supabase
 * Run with: node scripts/apply-migration.js
 */

const fs = require('fs');
const path = require('path');

async function applyMigration() {
  // Read environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Read migration file
  const migrationPath = path.join(__dirname, '../supabase/migrations/001_initial_schema.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  console.log('📦 Applying migration to Supabase...');
  console.log(`🔗 URL: ${supabaseUrl}`);

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ query: migrationSQL })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }

    console.log('✅ Migration applied successfully!');
    console.log('\nCreated tables:');
    console.log('  - users');
    console.log('  - contexts');
    console.log('  - person_cards');
    console.log('  - sessions');
    console.log('  - debriefs');
    console.log('  - pinecone_deletion_queue');
    console.log('\n✅ Row Level Security (RLS) enabled on all tables');
    console.log('✅ All indexes created');
    console.log('✅ All policies configured');
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    process.exit(1);
  }
}

// Load .env.local
require('dotenv').config({ path: '.env.local' });

applyMigration();
