"use client";

import { useMemo, useState } from "react";
import { supabase } from "../lib/supabase/client";

const BUCKET_NAME = "Spec-sheets";

interface UploadPdfProps {
  onUploadComplete?: () => void;
}

export default function UploadPdf({ onUploadComplete }: UploadPdfProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [ingestResult, setIngestResult] = useState<{ chunkCount: number } | null>(null);
  const fileInputId = "pdf-file-input";

  const suggestedPathPrefix = useMemo(() => {
    // Keep uploaded PDFs organized under a predictable prefix.
    return `uploads/`;
  }, []);

  async function onUpload() {
    setErrorMessage(null);
    setUploadedUrl(null);
    setUploadedPath(null);
    setIngestResult(null);

    if (!file) {
      setErrorMessage("Choose a PDF file first.");
      return;
    }

    const isLikelyPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isLikelyPdf) {
      setErrorMessage("That file does not look like a PDF.");
      return;
    }

    setUploading(true);
    try {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const path = `${suggestedPathPrefix}${id}-${file.name}`;

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, file, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      const publicUrl = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(path).data.publicUrl;

      setUploadedPath(path);
      setUploadedUrl(publicUrl);
      setUploading(false);

      // Trigger ingestion pipeline
      setIngesting(true);
      try {
        const res = await fetch("/api/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storagePath: path }),
        });

        const result = await res.json();

        if (!res.ok) {
          setErrorMessage(result.error ?? "Ingestion failed");
          return;
        }

        setIngestResult({ chunkCount: result.chunkCount });
        onUploadComplete?.();
      } catch (ingestErr) {
        setErrorMessage(
          ingestErr instanceof Error ? ingestErr.message : "Ingestion request failed",
        );
      } finally {
        setIngesting(false);
      }

      void data;
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Upload failed",
      );
    } finally {
      setUploading(false);
      setIngesting(false);
    }
  }

  return (
    <section className="w-full max-w-xl">
      <h2 className="text-lg font-semibold text-zinc-900">
        Upload a PDF (Storage)
      </h2>

      <p className="mt-2 text-sm leading-6 text-zinc-600">
        Select a PDF and upload it to the `Spec-sheets` bucket. No login required
        if Storage policies are configured correctly.
      </p>

      <div className="mt-4 flex flex-col gap-3 rounded-lg border-2 border-blue-500/70 bg-transparent p-4">
        <label className="text-sm font-medium text-zinc-900">
          PDF file
        </label>

        <input
          id={fileInputId}
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setUploadedUrl(null);
            setUploadedPath(null);
            setErrorMessage(null);
            setIngestResult(null);
          }}
          className="sr-only"
        />

        <label
          htmlFor={fileInputId}
          className="inline-flex cursor-pointer items-center justify-center rounded-full border border-blue-500/80 bg-transparent px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:opacity-60"
        >
          {file ? "Change PDF" : "Browse PDF"}
        </label>

        {file ? (
          <p className="text-sm text-black">
            Selected: {file.name}
          </p>
        ) : (
          <p className="text-sm text-zinc-600">
            No file selected
          </p>
        )}

        <button
          type="button"
          onClick={onUpload}
          disabled={uploading || ingesting}
          className="mt-1 inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60 disabled:bg-blue-500"
        >
          {uploading
            ? "Uploading..."
            : ingesting
              ? "Processing..."
              : "Upload PDF"}
        </button>

        {ingesting ? (
          <p className="text-sm font-medium text-blue-600 animate-pulse">
            Extracting text and generating embeddings — this may take a moment…
          </p>
        ) : null}

        {ingestResult ? (
          <p className="text-sm font-medium text-green-600">
            Ingestion complete — {ingestResult.chunkCount} chunk
            {ingestResult.chunkCount === 1 ? "" : "s"} stored.
          </p>
        ) : null}

        {errorMessage ? (
          <p className="text-sm font-medium text-red-600">
            {errorMessage}
          </p>
        ) : null}

        {uploadedPath ? (
          <div>
            <p className="text-sm font-medium text-black dark:text-black">
              Uploaded to:
            </p>
            <pre className="mt-1 overflow-auto rounded-lg border border-blue-500/50 bg-transparent p-3 text-xs text-black">
              {uploadedPath}
            </pre>
          </div>
        ) : null}

        {uploadedUrl ? (
          <div>
            <p className="text-sm font-medium text-black dark:text-black">
              Public URL:
            </p>
            <a
              href={uploadedUrl}
              target="_blank"
              rel="noreferrer"
              className="break-all text-sm text-black underline hover:text-black"
            >
              {uploadedUrl}
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}

