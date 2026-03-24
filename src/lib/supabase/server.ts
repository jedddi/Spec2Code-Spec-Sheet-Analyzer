import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env var NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseServiceRoleKey) {
  throw new Error("Missing env var SUPABASE_SERVICE_ROLE_KEY");
}

// Server-only Supabase client that bypasses RLS.
// NEVER import this in client components or expose the service role key.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
