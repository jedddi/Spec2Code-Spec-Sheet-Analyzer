import "pdf-parse/worker";
import { PDFParse } from "pdf-parse";
import { supabaseAdmin } from "../supabase/server";

const BUCKET_NAME = "Spec-sheets";

/**
 * Download a PDF from Supabase Storage and return its extracted text.
 *
 * @param storagePath - Object path inside the bucket (e.g. "uploads/uuid-file.pdf")
 */
export async function extractTextFromPdf(storagePath: string): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
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
