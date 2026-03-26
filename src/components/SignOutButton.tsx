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
      className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
    >
      Sign Out
    </button>
  );
}
