/**
 * Script to verify Supabase setup
 * Run with: node scripts/verify-supabase.js
 */

async function verifySupabase() {
  // Load environment variables
  require('dotenv').config({ path: '.env.local' });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('🔍 Verifying Supabase Setup...\n');

  // Check environment variables
  console.log('1. Checking environment variables...');
  if (!supabaseUrl || supabaseUrl === 'your_supabase_url_here') {
    console.log('   ❌ NEXT_PUBLIC_SUPABASE_URL not set');
    return false;
  }
  console.log('   ✅ NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl);

  if (!anonKey || anonKey === 'your_supabase_anon_key_here') {
    console.log('   ❌ NEXT_PUBLIC_SUPABASE_ANON_KEY not set');
    return false;
  }
  console.log('   ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY: ey...' + anonKey.slice(-10));

  if (!serviceRoleKey || serviceRoleKey === 'your_supabase_service_role_key_here') {
    console.log('   ❌ SUPABASE_SERVICE_ROLE_KEY not set');
    return false;
  }
  console.log('   ✅ SUPABASE_SERVICE_ROLE_KEY: ey...' + serviceRoleKey.slice(-10));

  // Check if tables exist
  console.log('\n2. Checking database tables...');
  const tables = ['users', 'contexts', 'person_cards', 'sessions', 'debriefs', 'pinecone_deletion_queue'];
  
  try {
    for (const table of tables) {
      const response = await fetch(`${supabaseUrl}/rest/v1/${table}?limit=0`, {
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
        }
      });

      if (response.ok) {
        console.log(`   ✅ Table '${table}' exists`);
      } else if (response.status === 404) {
        console.log(`   ❌ Table '${table}' not found - migration not applied`);
        return false;
      } else {
        console.log(`   ⚠️  Table '${table}' - unexpected status: ${response.status}`);
      }
    }
  } catch (error) {
    console.log('   ❌ Error connecting to Supabase:', error.message);
    return false;
  }

  console.log('\n✅ Supabase setup verified successfully!');
  console.log('\nYou can now:');
  console.log('  - Run the app: npm run dev');
  console.log('  - Proceed to Task 3: Authentication');
  return true;
}

verifySupabase().catch(console.error);
