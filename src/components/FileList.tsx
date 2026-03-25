"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase/client";
import CodeModal from "./CodeModal";
import SpecsDrawer from "./SpecsDrawer";

const BUCKET_NAME = "Spec-sheets";
const FOLDER = "uploads";

interface FileEntry {
  name: string;
  created_at: string;
}

interface FileListProps {
  refreshKey: number;
}

export default function FileList({ refreshKey }: FileListProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [generatingName, setGeneratingName] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [modalFileName, setModalFileName] = useState<string>("");
  const [specsName, setSpecsName] = useState<string | null>(null);
  const [specsContent, setSpecsContent] = useState<string | null>(null);
  const [specsFileName, setSpecsFileName] = useState<string>("");

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(FOLDER, { sortBy: { column: "created_at", order: "desc" } });

    if (listError) {
      setError(listError.message);
    } else {
      const pdfs = (data ?? []).filter(
        (f) => f.name && !f.name.startsWith("."),
      );
      setFiles(
        pdfs.map((f) => ({ name: f.name, created_at: f.created_at ?? "" })),
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles, refreshKey]);

  async function onDelete(fileName: string) {
    const confirmed = window.confirm(
      `Delete "${fileName}" from storage? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingName(fileName);
    const path = `${FOLDER}/${fileName}`;

    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (deleteError) {
      alert(`Delete failed: ${deleteError.message}`);
    } else {
      setFiles((prev) => prev.filter((f) => f.name !== fileName));
    }

    setDeletingName(null);
  }

  async function onGenerateCode(fileName: string) {
    setGeneratingName(fileName);
    const storagePath = `${FOLDER}/${fileName}`;

    try {
      const res = await fetch("/api/generate-header", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath }),
      });

      const text = await res.text();
      let result: Record<string, unknown>;
      try {
        result = JSON.parse(text);
      } catch {
        const msg = res.status === 504
          ? "Function timed out — try a smaller file"
          : `Server error (${res.status})`;
        alert(`Code generation failed: ${msg}`);
        return;
      }

      if (!res.ok) {
        alert(`Code generation failed: ${result.error ?? "Unknown error"}`);
        return;
      }

      setGeneratedCode(result.code as string);
      setModalFileName(displayName(fileName));
    } catch (err) {
      alert(
        `Code generation failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setGeneratingName(null);
    }
  }

  async function onQuickSpecs(fileName: string) {
    setSpecsName(fileName);
    const storagePath = `${FOLDER}/${fileName}`;

    try {
      const res = await fetch("/api/quick-specs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath }),
      });

      const text = await res.text();
      let result: Record<string, unknown>;
      try {
        result = JSON.parse(text);
      } catch {
        const msg = res.status === 504
          ? "Function timed out — try a smaller file"
          : `Server error (${res.status})`;
        alert(`Quick Specs failed: ${msg}`);
        return;
      }

      if (!res.ok) {
        alert(`Quick Specs failed: ${result.error ?? "Unknown error"}`);
        return;
      }

      setSpecsContent(result.specs as string);
      setSpecsFileName(displayName(fileName));
    } catch (err) {
      alert(
        `Quick Specs failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setSpecsName(null);
    }
  }

  function displayName(raw: string) {
    // Upload path is created as: `${uuid}-${originalFilename}`
    // UUID contains hyphens too, so we must strip the UUID prefix reliably.
    const uuidPrefix =
      /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(.+)$/i;
    const match = raw.match(uuidPrefix);
    if (match) return match[2];

    // Fallback: if it doesn't match UUID format, show the raw name.
    return raw;
  }

  return (
    <section className="w-full max-w-xl">
      <h2 className="text-lg font-semibold text-zinc-900">Uploaded Files</h2>

      {loading ? (
        <p className="mt-3 text-sm text-zinc-500">Loading files...</p>
      ) : error ? (
        <p className="mt-3 text-sm font-medium text-red-600">{error}</p>
      ) : files.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">
          No files uploaded yet.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-200 rounded-lg border-2 border-blue-500/70">
          {files.map((file) => (
            <li
              key={file.name}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900">
                  {displayName(file.name)}
                </p>
                {file.created_at ? (
                  <p className="text-xs text-zinc-500">
                    {new Date(file.created_at).toLocaleString()}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => onGenerateCode(file.name)}
                  disabled={generatingName === file.name}
                  className="shrink-0 rounded-full border border-blue-400 px-3 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50"
                >
                  {generatingName === file.name
                    ? "Generating..."
                    : "Generate Code"}
                </button>

                <button
                  type="button"
                  onClick={() => onQuickSpecs(file.name)}
                  disabled={specsName === file.name}
                  className="shrink-0 rounded-full border border-emerald-400 px-3 py-1 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-50"
                >
                  {specsName === file.name
                    ? "Loading..."
                    : "Quick Specs"}
                </button>

                <button
                  type="button"
                  onClick={() => onDelete(file.name)}
                  disabled={deletingName === file.name}
                  className="shrink-0 rounded-full border border-red-400 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  {deletingName === file.name ? "Deleting..." : "Delete"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {generatedCode !== null && (
        <CodeModal
          code={generatedCode}
          fileName={modalFileName}
          onClose={() => {
            setGeneratedCode(null);
            setModalFileName("");
          }}
        />
      )}

      {specsContent !== null && (
        <SpecsDrawer
          specs={specsContent}
          fileName={specsFileName}
          onClose={() => {
            setSpecsContent(null);
            setSpecsFileName("");
          }}
        />
      )}
    </section>
  );
}
