import { extractPagesFromPdf } from "@/src/lib/ingest/extract";
import { chunkPageText, chunkText } from "@/src/lib/ingest/chunk";
import { generateEmbeddings } from "@/src/lib/ingest/embed";
import { extractDocumentMetadata } from "@/src/lib/ingest/extract-metadata";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_DOCUMENT_PROJECT } from "@/src/lib/documents/default-project";

interface ProcessDocumentInput {
  supabase: SupabaseClient;
  userId: string;
  storagePath: string;
  projectName?: string;
  tags?: string[];
}

export async function processDocumentIngestion({
  supabase,
  userId,
  storagePath,
  projectName,
  tags = [],
}: ProcessDocumentInput) {
  const pages = await extractPagesFromPdf(storagePath, supabase);
  const chunks = chunkPageText(pages);

  if (chunks.length === 0) {
    throw new Error("PDF produced no text chunks after splitting");
  }

  const fullText = pages.map((page) => page.text).join("\n\n");

  const [embeddings, metadata] = await Promise.all([
    generateEmbeddings(chunks.map((chunk) => chunk.content)),
    extractDocumentMetadata(fullText),
  ]);

  const normalizedProjectName =
    typeof projectName === "string" && projectName.trim().length > 0
      ? projectName.trim()
      : DEFAULT_DOCUMENT_PROJECT;
  const normalizedTags = Array.isArray(tags)
    ? tags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean)
    : [];

  const { error: deleteError } = await supabase
    .from("document_chunks")
    .delete()
    .eq("document_path", storagePath)
    .eq("user_id", userId);

  if (deleteError) {
    throw new Error(`Failed to clear old chunks: ${deleteError.message}`);
  }

  const rows = chunks.map((chunk, index) => ({
    user_id: userId,
    document_path: storagePath,
    chunk_index: chunk.index,
    content: chunk.content,
    embedding: JSON.stringify(embeddings[index]),
    metadata: { page: chunk.page },
  }));

  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error: insertError } = await supabase.from("document_chunks").insert(batch);
    if (insertError) {
      throw new Error(`Failed to insert chunks (batch starting at ${i}): ${insertError.message}`);
    }
  }

  const filename = storagePath.split("/").pop() ?? storagePath;
  const { error: docError } = await supabase.from("documents").upsert(
    {
      user_id: userId,
      storage_path: storagePath,
      filename,
      category: metadata.category,
      operating_voltage: metadata.operating_voltage,
      interface: metadata.interface,
      power_consumption: metadata.power_consumption,
      project_name: normalizedProjectName,
      tags: Array.from(new Set([...normalizedTags, ...(metadata.category ? [metadata.category] : [])])),
      hidden: false,
      hidden_at: null,
      status: "completed",
      chunk_count: chunks.length,
      markdown_content: null,
      error_message: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,storage_path" }
  );

  if (docError) {
    throw new Error(`Failed to upsert document metadata: ${docError.message}`);
  }

  return {
    chunkCount: chunks.length,
    metadata,
  };
}

/**
 * Build vector index + datasheet metadata from Unstructured markdown (no PDF re-parse).
 */
export async function processMarkdownIngestion({
  supabase,
  userId,
  storagePath,
  markdown,
  projectName,
  tags = [],
}: ProcessDocumentInput & { markdown: string }) {
  const trimmed = markdown.trim();
  if (!trimmed) {
    throw new Error("Markdown content is empty — cannot index");
  }

  const plainChunks = chunkText(trimmed);
  const chunks = plainChunks.map((c) => ({
    content: c.content,
    index: c.index,
    page: 1,
  }));

  if (chunks.length === 0) {
    throw new Error("Markdown produced no chunks after splitting");
  }

  const [embeddings, metadata] = await Promise.all([
    generateEmbeddings(chunks.map((chunk) => chunk.content)),
    extractDocumentMetadata(trimmed),
  ]);

  const normalizedProjectName =
    typeof projectName === "string" && projectName.trim().length > 0
      ? projectName.trim()
      : DEFAULT_DOCUMENT_PROJECT;
  const normalizedTags = Array.isArray(tags)
    ? tags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean)
    : [];

  const { error: deleteError } = await supabase
    .from("document_chunks")
    .delete()
    .eq("document_path", storagePath)
    .eq("user_id", userId);

  if (deleteError) {
    throw new Error(`Failed to clear old chunks: ${deleteError.message}`);
  }

  const rows = chunks.map((chunk, index) => ({
    user_id: userId,
    document_path: storagePath,
    chunk_index: chunk.index,
    content: chunk.content,
    embedding: JSON.stringify(embeddings[index]),
    metadata: { page: chunk.page },
  }));

  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error: insertError } = await supabase.from("document_chunks").insert(batch);
    if (insertError) {
      throw new Error(`Failed to insert chunks (batch starting at ${i}): ${insertError.message}`);
    }
  }

  const filename = storagePath.split("/").pop() ?? storagePath;
  const { error: docError } = await supabase.from("documents").upsert(
    {
      user_id: userId,
      storage_path: storagePath,
      filename,
      category: metadata.category,
      operating_voltage: metadata.operating_voltage,
      interface: metadata.interface,
      power_consumption: metadata.power_consumption,
      project_name: normalizedProjectName,
      tags: Array.from(new Set([...normalizedTags, ...(metadata.category ? [metadata.category] : [])])),
      hidden: false,
      hidden_at: null,
      status: "completed",
      chunk_count: chunks.length,
      markdown_content: trimmed,
      error_message: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,storage_path" },
  );

  if (docError) {
    throw new Error(`Failed to upsert document metadata: ${docError.message}`);
  }

  return {
    chunkCount: chunks.length,
    metadata,
  };
}
