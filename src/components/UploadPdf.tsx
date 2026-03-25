"use client";

import { useCallback, useRef, useState } from "react";

const BUCKET_NAME = "Spec-sheets";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface FileEntry {
  id: string;
  file: File;
  status: "uploading" | "uploaded" | "ingesting" | "done" | "error";
  progress: number;
  loaded: number;
  storagePath: string;
  error?: string;
  chunkCount?: number;
}

interface UploadPdfProps {
  onUploadComplete?: () => void;
}

function generateId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function UploadPdf({ onUploadComplete }: UploadPdfProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const updateFile = useCallback(
    (id: string, patch: Partial<FileEntry>) =>
      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      ),
    [],
  );

  const uploadFileXhr = useCallback(
    (entry: FileEntry) => {
      const xhr = new XMLHttpRequest();
      const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${entry.storagePath}`;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          updateFile(entry.id, { progress, loaded: e.loaded });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          updateFile(entry.id, {
            status: "uploaded",
            progress: 100,
            loaded: entry.file.size,
          });
        } else {
          let msg = "Upload failed";
          try {
            const body = JSON.parse(xhr.responseText);
            msg = body.message || body.error || msg;
          } catch {
            /* keep default */
          }
          updateFile(entry.id, { status: "error", error: msg });
        }
      };

      xhr.onerror = () => {
        updateFile(entry.id, { status: "error", error: "Network error" });
      };

      xhr.open("POST", url);
      xhr.setRequestHeader("Authorization", `Bearer ${SUPABASE_ANON_KEY}`);
      xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);
      xhr.setRequestHeader("Content-Type", entry.file.type || "application/pdf");
      xhr.setRequestHeader("x-upsert", "false");
      xhr.send(entry.file);
    },
    [updateFile],
  );

  const addFiles = useCallback(
    (fileList: FileList) => {
      const newEntries: FileEntry[] = [];

      Array.from(fileList).forEach((file) => {
        const isPdf =
          file.type === "application/pdf" ||
          file.name.toLowerCase().endsWith(".pdf");
        if (!isPdf) return;

        const entry: FileEntry = {
          id: generateId(),
          file,
          status: "uploading",
          progress: 0,
          loaded: 0,
          storagePath: `uploads/${generateId()}-${file.name}`,
        };
        newEntries.push(entry);
      });

      if (newEntries.length === 0) return;

      setFiles((prev) => [...prev, ...newEntries]);
      newEntries.forEach((entry) => uploadFileXhr(entry));
    },
    [uploadFileXhr],
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (dragCounter.current === 1) setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setDragging(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const handleBrowse = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
        e.target.value = "";
      }
    },
    [addFiles],
  );

  const allUploaded =
    files.length > 0 && files.every((f) => f.status !== "uploading");
  const hasUploading = files.some((f) => f.status === "uploading");
  const allDone =
    files.length > 0 && files.every((f) => f.status === "done");

  const doneDisabled =
    files.length === 0 ||
    hasUploading ||
    allDone ||
    files.every((f) => f.status === "ingesting");

  async function handleDone() {
    const toIngest = files.filter((f) => f.status === "uploaded");
    if (toIngest.length === 0) return;

    toIngest.forEach((f) => updateFile(f.id, { status: "ingesting" }));

    await Promise.all(
      toIngest.map(async (entry) => {
        try {
          const res = await fetch("/api/ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ storagePath: entry.storagePath }),
          });
          const result = await res.json();
          if (!res.ok) {
            updateFile(entry.id, {
              status: "error",
              error: result.error ?? "Ingestion failed",
            });
          } else {
            updateFile(entry.id, {
              status: "done",
              chunkCount: result.chunkCount,
            });
          }
        } catch (err) {
          updateFile(entry.id, {
            status: "error",
            error:
              err instanceof Error ? err.message : "Ingestion request failed",
          });
        }
      }),
    );

    onUploadComplete?.();
  }

  return (
    <section className="w-full max-w-xl">
      <div className="overflow-hidden rounded-2xl border-2 border-blue-500 bg-white shadow-lg">
        {/* Title */}
        <div className="px-8 pt-8 pb-4">
          <h2 className="text-center text-2xl font-bold italic text-zinc-800">
            File Upload
          </h2>
        </div>

        {/* Drop zone */}
        <div className="px-8">
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-colors ${
              dragging
                ? "border-blue-500 bg-blue-50"
                : "border-zinc-300 bg-white"
            }`}
          >
            {/* Cloud icon */}
            <svg
              className="mb-3 h-12 w-12 text-blue-500"
              fill="none"
              viewBox="0 0 48 48"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14 36c-4.42 0-8-3.58-8-8a7.96 7.96 0 0 1 5.04-7.43A12 12 0 0 1 34.1 18.2 10 10 0 0 1 38 38H14Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M24 26v-14m-5 5 5-5 5 5"
              />
            </svg>

            <p className="text-sm text-zinc-500">
              Drag files here or{" "}
              <button
                type="button"
                onClick={handleBrowse}
                className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              >
                Browse
              </button>
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            onChange={handleInputChange}
            className="sr-only"
          />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="mt-4 flex flex-col gap-3 px-8">
            {files.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3">
                {/* PDF icon */}
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-zinc-100 text-[10px] font-bold uppercase text-zinc-400">
                  PDF
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-800">
                    {entry.file.name}
                  </p>

                  {/* Progress bar */}
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-200">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        entry.status === "error"
                          ? "bg-red-400"
                          : entry.status === "done"
                            ? "bg-green-400"
                            : "bg-blue-500"
                      }`}
                      style={{ width: `${entry.progress}%` }}
                    />
                  </div>

                  {/* Size + status */}
                  <div className="mt-1 flex items-center justify-between text-xs text-zinc-400">
                    <span>
                      {formatBytes(entry.loaded)} of{" "}
                      {formatBytes(entry.file.size)}
                    </span>
                    <span>
                      {entry.status === "uploading" &&
                        `Uploading...... ${entry.progress}%`}
                      {entry.status === "uploaded" && "Ready"}
                      {entry.status === "ingesting" && (
                        <span className="animate-pulse text-blue-600">
                          Processing...
                        </span>
                      )}
                      {entry.status === "done" && (
                        <span className="text-green-500">
                          Done{entry.chunkCount != null && ` — ${entry.chunkCount} chunks`}
                        </span>
                      )}
                      {entry.status === "error" && (
                        <span className="text-red-500">
                          {entry.error ?? "Error"}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Done button */}
        <div className="px-8 pt-6 pb-8">
          <button
            type="button"
            onClick={handleDone}
            disabled={doneDisabled}
            className="w-full rounded-full bg-blue-600 py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {files.some((f) => f.status === "ingesting")
              ? "Processing..."
              : allDone
                ? "All Done"
                : "Done"}
          </button>
        </div>
      </div>
    </section>
  );
}
