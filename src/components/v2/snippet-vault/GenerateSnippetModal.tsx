"use client";

import { useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { DocumentRecord } from "@/src/hooks/useDocuments";
import { displayDocumentFilename } from "@/src/lib/documents/display-filename";
import type { SnippetLanguage, SnippetPlatform } from "@/src/types/snippets";

interface GenerateSnippetModalProps {
  open: boolean;
  documents: DocumentRecord[];
  preselectedSourcePdfId: string | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: {
    sourcePdfId: string;
    language: SnippetLanguage;
    platform: SnippetPlatform;
    snippetName?: string;
  }) => Promise<void>;
}

export default function GenerateSnippetModal({
  open,
  documents,
  preselectedSourcePdfId,
  loading,
  error,
  onClose,
  onSubmit,
}: GenerateSnippetModalProps) {
  const readyDocs = useMemo(
    () => documents.filter((doc) => doc.status === "ready"),
    [documents],
  );
  const [sourcePdfId, setSourcePdfId] = useState<string>(preselectedSourcePdfId ?? "");
  const [language, setLanguage] = useState<SnippetLanguage>("cpp");
  const [platform, setPlatform] = useState<SnippetPlatform>("esp32");
  const [snippetName, setSnippetName] = useState("");
  const effectiveSourcePdfId =
    preselectedSourcePdfId ?? sourcePdfId ?? readyDocs[0]?.id ?? "";

  if (!open) return null;

  async function handleSubmit() {
    if (!effectiveSourcePdfId || loading) return;
    await onSubmit({
      sourcePdfId: effectiveSourcePdfId,
      language,
      platform,
      snippetName: snippetName.trim() || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-xl rounded-2xl border border-black/[0.08] bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-lg font-semibold text-[#4f5059] hover:text-[#111]"
        >
          &times;
        </button>
        <div className="mb-5 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[var(--v2-primary)]" />
          <h3 className="font-[family-name:var(--font-plus-jakarta)] text-xl font-bold text-[#111]">
            Generate Snippet
          </h3>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-semibold text-[#111]">
            Source Datasheet
            <select
              value={effectiveSourcePdfId}
              onChange={(event) => setSourcePdfId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-sm text-[#111]"
            >
              {readyDocs.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {displayDocumentFilename(doc.filename)}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-[#111]">
              Language
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as SnippetLanguage)}
                className="mt-1 w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-sm text-[#111]"
              >
                <option value="cpp">C++</option>
                <option value="micropython">MicroPython</option>
              </select>
            </label>

            <label className="block text-sm font-semibold text-[#111]">
              Platform
              <select
                value={platform}
                onChange={(event) => setPlatform(event.target.value as SnippetPlatform)}
                className="mt-1 w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-sm text-[#111]"
              >
                <option value="esp32">ESP32</option>
                <option value="arduino">Arduino</option>
              </select>
            </label>
          </div>

          <label className="block text-sm font-semibold text-[#111]">
            Snippet Name (optional)
            <input
              value={snippetName}
              onChange={(event) => setSnippetName(event.target.value)}
              placeholder="bme280_init"
              className="mt-1 w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-sm text-[#111]"
            />
          </label>

          {loading && (
            <div className="rounded-lg border border-black/[0.06] bg-gray-50 px-3 py-2 text-xs text-[#4f5059]">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-[var(--v2-primary)]" />
                Synthesizing snippet from indexed context...
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm font-medium text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-black/[0.08] px-4 py-2 text-sm font-semibold text-[#111] hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !effectiveSourcePdfId}
              className="flex items-center gap-2 rounded-lg bg-[var(--v2-primary)] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Generate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
