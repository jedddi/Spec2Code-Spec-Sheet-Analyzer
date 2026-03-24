import { supabaseAdmin } from "../supabase/server";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

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
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
  } as Parameters<typeof pdfjs.getDocument>[0]);

  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .trim();

      if (pageText.length > 0) {
        pageTexts.push(pageText);
      }

      page.cleanup();
    }
  } finally {
    await pdf.destroy();
  }

  const text = pageTexts.join("\n\n");
  if (text.trim().length === 0) {
    throw new Error(
      `No extractable text found in "${storagePath}". The PDF may be image-only.`,
    );
  }

  return text;
}
