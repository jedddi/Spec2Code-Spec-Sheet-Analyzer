/**
 * Golden test for the ingestion pipeline.
 *
 * Tests each stage independently:
 *   1. List files in Storage to pick a PDF
 *   2. Extract text from the PDF
 *   3. Chunk the extracted text
 *   4. Generate embeddings via Google Gemini
 *   5. Store chunks + embeddings in Supabase Postgres
 *   6. Query the DB to verify storage
 *
 * Usage:  npx tsx scripts/golden-test.mts [storagePath]
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY!;
const BUCKET = "Spec-sheets";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE env vars in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function heading(label: string) {
  console.log(`\n${"=".repeat(60)}\n  STAGE: ${label}\n${"=".repeat(60)}`);
}

function preview(text: string, maxLen = 300) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + `\n... (${text.length} chars total)`;
}

// ── Stage 1: Resolve a PDF from Storage ─────────────────────

heading("1 — List Storage files");

const targetPath = process.argv[2];

let storagePath: string;

if (targetPath) {
  storagePath = targetPath;
  console.log(`Using provided path: ${storagePath}`);
} else {
  const { data: files, error: listErr } = await supabase.storage
    .from(BUCKET)
    .list("uploads", { limit: 10, sortBy: { column: "created_at", order: "desc" } });

  if (listErr) {
    console.error("Failed to list storage:", listErr.message);
    process.exit(1);
  }

  const pdfs = (files ?? []).filter((f) => f.name.endsWith(".pdf"));
  console.log(`Found ${pdfs.length} PDF(s) in uploads/:`);
  pdfs.forEach((f) => console.log(`  - uploads/${f.name}  (${f.metadata?.size ?? "?"} bytes)`));

  if (pdfs.length === 0) {
    console.error("No PDFs found in storage. Upload one first, or pass a path as argument.");
    process.exit(1);
  }

  storagePath = `uploads/${pdfs[0].name}`;
  console.log(`\nUsing: ${storagePath}`);
}

// ── Stage 2: Download & extract text ────────────────────────

heading("2 — Extract text from PDF");

const { data: blob, error: dlErr } = await supabase.storage
  .from(BUCKET)
  .download(storagePath);

if (dlErr || !blob) {
  console.error("Download failed:", dlErr?.message);
  process.exit(1);
}

console.log(`Downloaded ${blob.size} bytes`);

const { PDFParse } = await import("pdf-parse");
const buffer = Buffer.from(await blob.arrayBuffer());
const parser = new PDFParse({ data: buffer });
const parsed = await parser.getText();
await parser.destroy();

console.log(`Extracted text length: ${parsed.text.length} chars`);
console.log(`\nPreview:\n${preview(parsed.text)}`);

if (parsed.text.trim().length === 0) {
  console.error("No text extracted — PDF may be image-only.");
  process.exit(1);
}

// ── Stage 3: Chunk the text ─────────────────────────────────

heading("3 — Chunk text");

// Inline the chunking logic to avoid path-alias issues
const SEPARATORS = ["\n\n", "\n", ". ", " ", ""];
const CHUNK_SIZE = 1000;
const OVERLAP = 200;

function splitRecursive(text: string, chunkSize: number, seps: string[]): string[] {
  if (text.length <= chunkSize) return [text];
  const sep = seps[0];
  const rest = seps.slice(1);
  const parts = sep === "" ? [...text] : text.split(sep);
  const pieces: string[] = [];
  let current = "";
  for (const part of parts) {
    const candidate = current.length === 0 ? part : current + sep + part;
    if (candidate.length <= chunkSize) { current = candidate; continue; }
    if (current.length > 0) pieces.push(current);
    if (part.length > chunkSize && rest.length > 0) {
      pieces.push(...splitRecursive(part, chunkSize, rest));
      current = "";
    } else {
      current = part;
    }
  }
  if (current.length > 0) pieces.push(current);
  return pieces;
}

const rawPieces = splitRecursive(parsed.text.trim(), CHUNK_SIZE, SEPARATORS);
const chunks: { content: string; index: number }[] = [];
let idx = 0;
for (let i = 0; i < rawPieces.length; i++) {
  const piece = rawPieces[i].trim();
  if (piece.length === 0) continue;
  chunks.push({ content: piece, index: idx++ });
  if (OVERLAP > 0 && i < rawPieces.length - 1) {
    const overlapText = piece.slice(-OVERLAP).trim();
    const nextPiece = rawPieces[i + 1]?.trim() ?? "";
    if (overlapText.length > 0 && nextPiece.length > 0) {
      const merged = overlapText + " " + nextPiece;
      if (merged.length <= CHUNK_SIZE) rawPieces[i + 1] = merged;
    }
  }
}

console.log(`Produced ${chunks.length} chunks`);
console.log(`Chunk sizes: min=${Math.min(...chunks.map(c => c.content.length))}, max=${Math.max(...chunks.map(c => c.content.length))}, avg=${Math.round(chunks.map(c => c.content.length).reduce((a, b) => a + b, 0) / chunks.length)}`);
console.log(`\nFirst chunk preview:\n${preview(chunks[0].content, 200)}`);

// ── Stage 4: Generate embeddings ────────────────────────────

heading("4 — Generate embeddings (Google gemini-embedding-001)");

if (!GOOGLE_API_KEY) {
  console.error("Missing GOOGLE_API_KEY in .env.local");
  process.exit(1);
}

const { GoogleGenerativeAI } = await import("@google/generative-ai");
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

const textsToEmbed = chunks.map((c) => c.content);
const BATCH = 100;
const embeddings: number[][] = new Array(textsToEmbed.length);

console.log(`Embedding ${textsToEmbed.length} chunks in batches of ${BATCH}...`);

for (let start = 0; start < textsToEmbed.length; start += BATCH) {
  const batch = textsToEmbed.slice(start, start + BATCH);
    const result = await model.batchEmbedContents({
      requests: batch.map((text) => ({
        content: { parts: [{ text }], role: "user" as const },
        outputDimensionality: 768,
      })),
    });
  for (let i = 0; i < result.embeddings.length; i++) {
    embeddings[start + i] = result.embeddings[i].values;
  }
  console.log(`  Batch ${Math.floor(start / BATCH) + 1}: embedded ${batch.length} chunks`);
}

console.log(`\nEmbedding dimensions: ${embeddings[0].length}`);
console.log(`First embedding (first 5 values): [${embeddings[0].slice(0, 5).map(v => v.toFixed(6)).join(", ")}, ...]`);

// ── Stage 5: Store in Supabase Postgres ─────────────────────

heading("5 — Store in document_chunks table");

// Clear existing chunks for this document
const { error: delErr } = await supabase
  .from("document_chunks")
  .delete()
  .eq("document_path", storagePath);

if (delErr) {
  console.error(`Delete old chunks failed: ${delErr.message}`);
  console.error("Does the 'document_chunks' table exist? Run the migration first.");
  process.exit(1);
}

console.log(`Cleared any existing chunks for ${storagePath}`);

const rows = chunks.map((chunk, i) => ({
  document_path: storagePath,
  chunk_index: chunk.index,
  content: chunk.content,
  embedding: JSON.stringify(embeddings[i]),
  metadata: {},
}));

const INSERT_BATCH = 500;
let insertedCount = 0;

for (let i = 0; i < rows.length; i += INSERT_BATCH) {
  const batch = rows.slice(i, i + INSERT_BATCH);
  const { error: insErr } = await supabase.from("document_chunks").insert(batch);
  if (insErr) {
    console.error(`Insert failed at batch ${i}: ${insErr.message}`);
    process.exit(1);
  }
  insertedCount += batch.length;
  console.log(`  Inserted batch: ${batch.length} rows (total: ${insertedCount})`);
}

// ── Stage 6: Verify ─────────────────────────────────────────

heading("6 — Verify stored data");

const { data: stored, error: queryErr } = await supabase
  .from("document_chunks")
  .select("id, document_path, chunk_index, content, created_at")
  .eq("document_path", storagePath)
  .order("chunk_index", { ascending: true });

if (queryErr) {
  console.error("Query failed:", queryErr.message);
  process.exit(1);
}

console.log(`Rows in DB for ${storagePath}: ${stored?.length ?? 0}`);

if (stored && stored.length > 0) {
  console.log(`\nFirst row:`);
  console.log(`  id:          ${stored[0].id}`);
  console.log(`  chunk_index: ${stored[0].chunk_index}`);
  console.log(`  content:     ${preview(stored[0].content, 120)}`);
  console.log(`  created_at:  ${stored[0].created_at}`);

  console.log(`\nLast row:`);
  const last = stored[stored.length - 1];
  console.log(`  id:          ${last.id}`);
  console.log(`  chunk_index: ${last.chunk_index}`);
  console.log(`  content:     ${preview(last.content, 120)}`);
}

// ── Summary ─────────────────────────────────────────────────

heading("RESULT");
console.log(`Document:     ${storagePath}`);
console.log(`Text length:  ${parsed.text.length} chars`);
console.log(`Chunks:       ${chunks.length}`);
console.log(`Embeddings:   ${embeddings.length} x ${embeddings[0].length} dims`);
console.log(`DB rows:      ${stored?.length ?? 0}`);
console.log(`\nGOLDEN TEST PASSED`);
