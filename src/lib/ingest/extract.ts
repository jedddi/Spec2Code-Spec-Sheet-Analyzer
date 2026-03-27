import type { SupabaseClient } from "@supabase/supabase-js";
import "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

const BUCKET_NAME = "Spec-sheets";

export interface ExtractedPdfPage {
  page: number;
  text: string;
}

/**
 * Download a PDF from Supabase Storage and return its extracted text.
 *
 * @param storagePath - Object path inside the bucket (e.g. "uploads/uuid-file.pdf")
 * @param supabase - Server client with the caller's session (so storage RLS policies apply correctly).
 */
export async function extractTextFromPdf(
  storagePath: string,
  supabase: SupabaseClient,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(storagePath);

  if (error || !data) {
    throw new Error(
      `Failed to download "${storagePath}" from Storage: ${error?.message ?? "unknown error"}`,
    );
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    const text = result.text?.trim() ?? "";

    if (text.length === 0) {
      throw new Error(
        `No extractable text found in "${storagePath}". The PDF may be image-only.`,
      );
    }

    return text;
  } finally {
    await parser.destroy();
  }
}

/**
 * Download a PDF from Supabase Storage and return text grouped by page.
 */
export async function extractPagesFromPdf(
  storagePath: string,
  supabase: SupabaseClient,
): Promise<ExtractedPdfPage[]> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(storagePath);

  if (error || !data) {
    throw new Error(
      `Failed to download "${storagePath}" from Storage: ${error?.message ?? "unknown error"}`,
    );
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    const pages = (result.pages ?? [])
      .map((pageResult) => ({
        page: pageResult.num,
        text: pageResult.text?.trim() ?? "",
      }))
      .filter((pageResult) => pageResult.text.length > 0);

    if (pages.length === 0) {
      throw new Error(
        `No extractable text found in "${storagePath}". The PDF may be image-only.`,
      );
    }

    return pages;
  } finally {
    await parser.destroy();
  }
}
