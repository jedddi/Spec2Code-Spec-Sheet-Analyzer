import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-only Supabase client that bypasses RLS.
// NEVER import this in client components or expose the service role key.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

// Per-request server client that respects RLS and carries the user's session.
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll can fail when called from a Server Component.
            // Safe to ignore — middleware handles the refresh.
          }
        },
      },
    },
  );
}
