import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/src/lib/supabase/server";

export const runtime = "nodejs";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing snippet id" }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from("snippets")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      throw new Error(`Failed to delete snippet: ${error.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown delete error";
    console.error("[/api/snippets/[id]]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
