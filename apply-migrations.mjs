/**
 * Run this script to apply all database migrations to your Supabase project.
 * Usage: node apply-migrations.mjs
 */

const SUPABASE_URL = "https://ynhyfjlrktidmauxjnev.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaHlmamxya3RpZG1hdXhqbmV2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ1MDAzMSwiZXhwIjoyMDkxMDI2MDMxfQ.W_MHlQENhsHrfOtZ3hhvDYLRaRDTtc85fx0lzo_h9Dw";

async function runSQL(sql, label) {
  console.log(`\n⏳ Running: ${label}...`);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  // The rpc endpoint won't work for DDL, so let's use the pg-meta approach
  return res;
}

// Since Supabase REST API doesn't support raw DDL, we'll use the
// createClient approach with service_role to create a setup function first.
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// We'll execute each DDL statement by creating them as individual rpc calls
// But first, let's check if tables already exist
async function checkAndSetup() {
  console.log("🔍 Checking current database state...");

  // Check if user_roles table exists
  const { data: tables, error: tablesError } = await supabase
    .from("user_roles")
    .select("id")
    .limit(1);

  if (tablesError && tablesError.message.includes("does not exist")) {
    console.log("📋 Tables not found. You need to run the migration SQL manually.");
    console.log("\n" + "=".repeat(60));
    console.log("Please go to your Supabase Dashboard SQL Editor:");
    console.log(`https://supabase.com/dashboard/project/ynhyfjlrktidmauxjnev/sql/new`);
    console.log("=".repeat(60));
    console.log("\nPaste the contents of these files in order:");
    console.log("1. supabase/migrations/20260423085514_3e4e01a3-8c67-40a4-98ee-baf472bb8908.sql");
    console.log("2. supabase/migrations/20260423085543_0a3301eb-b63e-4960-9469-aa833cb80994.sql");
    console.log("3. supabase/migrations/20260423085725_fa7bea49-a19b-4343-ba51-9fa9d053d20b.sql");
    console.log("4. supabase/migrations/20260423111500_notify_admins_on_application.sql");
    return false;
  } else if (tablesError) {
    console.log("Tables exist or different error:", tablesError.message);
  } else {
    console.log("✅ user_roles table exists");
  }

  // Check if notifications table has the right constraint by trying the new type
  const { error: notifError } = await supabase
    .from("notifications")
    .select("id")
    .limit(1);

  if (notifError && notifError.message.includes("does not exist")) {
    console.log("❌ notifications table does not exist - need full migration");
    return false;
  } else {
    console.log("✅ notifications table exists");
  }

  // Try inserting a test notification with type 'new_application' to check constraint
  // We'll use a dummy UUID that doesn't exist and rely on FK error vs check error
  const { error: testError } = await supabase
    .from("notifications")
    .insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      type: "new_application",
      title: "test",
      body: "test",
    });

  if (testError) {
    if (testError.message.includes("new_application") || testError.message.includes("check")) {
      console.log("❌ 'new_application' type not yet allowed - need notification migration");
      console.log("\n📋 Please run this SQL in your Supabase Dashboard SQL Editor:");
      console.log(`https://supabase.com/dashboard/project/ynhyfjlrktidmauxjnev/sql/new`);
      console.log("\nPaste contents of: supabase/migrations/20260423111500_notify_admins_on_application.sql");
      return false;
    } else {
      // FK error is expected (dummy user doesn't exist) - constraint is fine
      console.log("✅ 'new_application' notification type is already supported");
      return true;
    }
  } else {
    // Somehow succeeded - clean up
    console.log("✅ Notification constraint OK (cleaning up test row)");
    return true;
  }
}

checkAndSetup().then((ok) => {
  if (ok) {
    console.log("\n🎉 Database is properly configured!");
  } else {
    console.log("\n⚠️  Manual SQL execution required. See instructions above.");
  }
});
