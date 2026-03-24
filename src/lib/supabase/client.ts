import { createClient } from "@supabase/supabase-js";

// Supabase client for browser-side usage.
// Uses `NEXT_PUBLIC_*` env vars, so the anon key is safe to expose publicly.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env var NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseAnonKey) {
  throw new Error("Missing env var NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

