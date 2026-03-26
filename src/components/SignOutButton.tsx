"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/src/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const supabase = createBrowserSupabase();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="rounded-full border border-input px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      Sign Out
    </button>
  );
}
