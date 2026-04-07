import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/src/lib/supabase/server";
import type { SnippetMetadata, SnippetRecord } from "@/src/types/snippets";

export const runtime = "nodejs";

function toNumber(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const params = request.nextUrl.searchParams;
    const dependency = (params.get("dependency") ?? "").trim().toLowerCase();
    const interfaceFilter = (params.get("interface") ?? "ALL").trim().toUpperCase();
    const targetFilter = (params.get("targetHw") ?? "ALL").trim().toLowerCase();
    const minConfidence = toNumber(params.get("minConfidence"), 0);
    const sourcePdfId = (params.get("sourcePdfId") ?? "").trim();

    let query = supabase
      .from("snippets")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (sourcePdfId) {
      query = query.eq("source_pdf_id", sourcePdfId);
    }

    const { data, error } = await query;
    if (error) {
      if (error.message.includes("Could not find the table 'public.snippets'")) {
        return NextResponse.json({ snippets: [] });
      }
      throw new Error(`Failed to fetch snippets: ${error.message}`);
    }

    const filtered = ((data ?? []) as SnippetRecord[]).filter((snippet) => {
      const metadata = (snippet.metadata_json ?? {}) as Partial<SnippetMetadata>;
      if (!metadata) return false;
      const dependencyText = (metadata.dependency ?? "").toLowerCase();
      const interfaceText = (metadata.interface ?? "Unknown").toUpperCase();
      const targetText = (metadata.targetHw ?? "esp32").toLowerCase();
      const confidence = Number(metadata.confidenceScore ?? 0);

      if (dependency && !dependencyText.includes(dependency)) {
        return false;
      }
      if (interfaceFilter !== "ALL" && interfaceText !== interfaceFilter) {
        return false;
      }
      if (targetFilter !== "ALL" && targetText !== targetFilter) {
        return false;
      }
      if (confidence < minConfidence) {
        return false;
      }
      return true;
    });

    return NextResponse.json({ snippets: filtered });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown snippets error";
    console.error("[/api/snippets]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
