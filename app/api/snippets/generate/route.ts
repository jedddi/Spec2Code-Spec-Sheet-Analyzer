import { NextRequest, NextResponse } from "next/server";
import { chatComplete, type ChatMessage } from "@/src/lib/ai/openrouter";
import { createServerSupabase } from "@/src/lib/supabase/server";
import {
  buildHybridContext,
  buildSnippetMetadata,
} from "@/src/lib/snippets/hybrid-context";
import type {
  GenerateSnippetInput,
  SnippetInterface,
  SnippetLanguage,
  SnippetPlatform,
  SnippetRecord,
} from "@/src/types/snippets";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_CONTEXT_CHUNKS = 20;

const UUID_PREFIX_RE =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(.+)$/i;

function stripUuidPrefix(raw: string): string {
  const match = raw.match(UUID_PREFIX_RE);
  return match ? match[2] : raw;
}

function isLanguage(value: string): value is SnippetLanguage {
  return value === "cpp" || value === "micropython";
}

function isPlatform(value: string): value is SnippetPlatform {
  return value === "esp32" || value === "arduino";
}

function defaultSnippetName(filename: string, language: SnippetLanguage): string {
  const stem = stripUuidPrefix(filename).replace(/\.[^/.]+$/, "");
  return `${stem}_${language === "cpp" ? "driver" : "module"}`;
}

function coerceInterface(value: string | undefined, fallback: SnippetInterface): SnippetInterface {
  const upper = (value ?? "").toUpperCase();
  if (upper === "I2C" || upper === "SPI" || upper === "UART" || upper === "GPIO") {
    return upper;
  }
  return fallback;
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sourcePdfId, language, platform, snippetName } = body as GenerateSnippetInput;
  if (!sourcePdfId || typeof sourcePdfId !== "string") {
    return NextResponse.json({ error: "Missing or invalid `sourcePdfId`" }, { status: 400 });
  }
  if (!language || typeof language !== "string" || !isLanguage(language)) {
    return NextResponse.json({ error: "Missing or invalid `language`" }, { status: 400 });
  }
  if (!platform || typeof platform !== "string" || !isPlatform(platform)) {
    return NextResponse.json({ error: "Missing or invalid `platform`" }, { status: 400 });
  }

  try {
    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("id, user_id, filename, storage_path, interface")
      .eq("id", sourcePdfId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (documentError) {
      throw new Error(`Failed to load source document: ${documentError.message}`);
    }
    if (!document) {
      return NextResponse.json({ error: "Source PDF not found" }, { status: 404 });
    }

    const { data: chunkRows, error: chunkError } = await supabase
      .from("document_chunks")
      .select("content")
      .eq("user_id", user.id)
      .eq("document_path", document.storage_path)
      .order("chunk_index", { ascending: true })
      .limit(MAX_CONTEXT_CHUNKS);

    if (chunkError) {
      throw new Error(`Failed to fetch document chunks: ${chunkError.message}`);
    }
    if (!chunkRows || chunkRows.length === 0) {
      return NextResponse.json(
        { error: "No indexed chunks found for this document. Please ingest it first." },
        { status: 404 },
      );
    }

    const contextText = chunkRows.map((chunk) => chunk.content).join("\n\n");
    const hybrid = buildHybridContext(contextText, language, platform);
    const fileName = stripUuidPrefix(document.filename);
    const finalSnippetName =
      snippetName?.trim() || defaultSnippetName(fileName, language);

    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "You generate embedded firmware snippets. Always return valid JSON with keys codeBody, dependency, and interfaceType. codeBody must compile for the chosen language. Every configuration line must include either `// Found in datasheet` or `// Industry standard default`.",
      },
      {
        role: "user",
        content: `
Create a ${language === "cpp" ? "C++" : "MicroPython"} snippet for platform ${platform}.
Snippet name: ${finalSnippetName}
Source file: ${fileName}

Prefer datasheet facts first:
${JSON.stringify(hybrid.provenance.filter((item) => item.source === "datasheet"), null, 2)}

Fallback defaults:
${JSON.stringify(hybrid.provenance.filter((item) => item.source === "default"), null, 2)}

Additional context from chunks:
${contextText.slice(0, 12000)}

Return only JSON.
`.trim(),
      },
    ];

    const raw = await chatComplete(messages, {
      temperature: 0.2,
      responseFormat: { type: "json_object" },
    });

    let parsed: { codeBody?: string; dependency?: string; interfaceType?: string };
    try {
      parsed = JSON.parse(raw) as { codeBody?: string; dependency?: string; interfaceType?: string };
    } catch {
      throw new Error("Model did not return valid JSON for snippet generation.");
    }

    const codeBody = parsed.codeBody?.trim();
    if (!codeBody) {
      throw new Error("Snippet generation returned an empty code body.");
    }

    const metadata = buildSnippetMetadata({
      dependency: parsed.dependency?.trim() || hybrid.mergedFacts.dependency,
      interfaceType: coerceInterface(parsed.interfaceType, hybrid.mergedFacts.interface),
      platform,
      confidenceScore: hybrid.confidenceScore,
      attributionFileName: fileName,
      provenance: hybrid.provenance,
      language,
    });

    const { data: snippet, error: insertError } = await supabase
      .from("snippets")
      .insert({
        user_id: user.id,
        snippet_name: finalSnippetName,
        code_body: codeBody,
        metadata_json: metadata,
        source_pdf_id: document.id,
      })
      .select("*")
      .single();

    if (insertError) {
      if (insertError.message.includes("Could not find the table 'public.snippets'")) {
        return NextResponse.json(
          {
            error:
              "Snippet Vault is not initialized in your database yet. Apply migration `supabase/migrations/011_create_snippets.sql` and retry.",
          },
          { status: 503 },
        );
      }
      throw new Error(`Failed to save snippet: ${insertError.message}`);
    }

    return NextResponse.json({ snippet: snippet as SnippetRecord });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown snippet generation error";
    console.error("[/api/snippets/generate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
