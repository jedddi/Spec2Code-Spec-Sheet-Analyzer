"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createBrowserSupabase } from "../lib/supabase/client";

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
  /** Tighter layout for narrow sidebar panels. */
  variant?: "default" | "sidebar";
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

export default function UploadPdf({
  onUploadComplete,
  variant = "default",
}: UploadPdfProps) {
  const isSidebar = variant === "sidebar";
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  /** Avoid SSR vs client mismatch on `disabled` for the ingest button (e.g. Next hydration warnings). */
  const [hydrated, setHydrated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const supabase = useMemo(() => createBrowserSupabase(), []);

  useLayoutEffect(() => {
    setHydrated(true);
  }, []);

  const updateFile = useCallback(
    (id: string, patch: Partial<FileEntry>) =>
      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      ),
    [],
  );

  const uploadFileXhr = useCallback(
    async (entry: FileEntry) => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? SUPABASE_ANON_KEY;

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
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);
      xhr.setRequestHeader("Content-Type", entry.file.type || "application/pdf");
      xhr.setRequestHeader("x-upsert", "false");
      xhr.send(entry.file);
    },
    [updateFile, supabase],
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

  const hasUploading = files.some((f) => f.status === "uploading");
  const hasIngesting = files.some((f) => f.status === "ingesting");
  const allDone =
    files.length > 0 && files.every((f) => f.status === "done");
  const hasWorkToIngest = files.some((f) => f.status === "uploaded");

  const doneDisabled =
    !hasWorkToIngest ||
    hasUploading ||
    hasIngesting ||
    allDone;

  const ingestionButtonDisabled = !hydrated || doneDisabled;

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

          const text = await res.text();
          let result: Record<string, unknown>;
          try {
            result = JSON.parse(text);
          } catch {
            const isTimeout = res.status === 504;
            updateFile(entry.id, {
              status: "error",
              error: isTimeout
                ? "Function timed out — the PDF may be too large"
                : `Server error (${res.status}): non-JSON response`,
            });
            return;
          }

          if (!res.ok) {
            updateFile(entry.id, {
              status: "error",
              error: (result.error as string) ?? "Ingestion failed",
            });
          } else {
            updateFile(entry.id, {
              status: "done",
              chunkCount: result.chunkCount as number,
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

  const shellClass = isSidebar
    ? "rounded-lg border border-sidebar-border bg-sidebar-accent/50 shadow-none"
    : "rounded-xl border border-border bg-card shadow-sm";

  const dropBase = isSidebar
    ? "border-sidebar-border bg-sidebar/40 text-sidebar-foreground"
    : "border-border bg-muted/30 text-muted-foreground";

  const dropActive = isSidebar
    ? "border-sidebar-primary bg-sidebar-accent"
    : "border-primary bg-primary/5";

  const mutedText = isSidebar
    ? "text-sidebar-foreground/70"
    : "text-muted-foreground";

  const labelStrong = isSidebar
    ? "text-sidebar-foreground"
    : "text-foreground";

  return (
    <section className={cn("w-full", !isSidebar && "max-w-xl")}>
      <div className={cn("overflow-hidden", shellClass)}>
        {!isSidebar && (
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-center text-lg font-semibold tracking-tight text-foreground">
              File upload
            </h2>
          </div>
        )}

        <div className={cn(isSidebar ? "p-3" : "p-6 pt-4")}>
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={cn(
              "flex flex-col items-center justify-center rounded-md border border-dashed transition-colors",
              isSidebar ? "px-3 py-6" : "px-6 py-10",
              dragging ? dropActive : dropBase,
            )}
          >
            <svg
              className={cn(
                "mb-2 opacity-70",
                isSidebar ? "h-9 w-9" : "h-11 w-11",
                isSidebar ? "text-sidebar-foreground" : "text-muted-foreground",
              )}
              fill="none"
              viewBox="0 0 48 48"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden
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

            <p className={cn("text-center text-sm", mutedText)}>
              Drag PDFs here or{" "}
              <button
                type="button"
                onClick={handleBrowse}
                className={cn(
                  "font-medium underline-offset-4 hover:underline",
                  isSidebar
                    ? "text-sidebar-primary"
                    : "text-primary",
                )}
              >
                browse
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

        {files.length > 0 && (
          <div
            className={cn(
              "flex flex-col gap-2 border-t px-3 pb-1",
              isSidebar
                ? "border-sidebar-border px-3"
                : "border-border px-6",
            )}
          >
            {files.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 rounded-md px-1 py-2"
              >
                <div
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold uppercase",
                    isSidebar
                      ? "bg-sidebar-accent text-sidebar-foreground/70"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  PDF
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-sm font-medium",
                      labelStrong,
                    )}
                  >
                    {entry.file.name}
                  </p>

                  <div
                    className={cn(
                      "mt-1.5 h-1.5 w-full overflow-hidden rounded-full",
                      isSidebar ? "bg-sidebar-border" : "bg-muted",
                    )}
                  >
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        entry.status === "error" && "bg-destructive",
                        entry.status === "done" && "bg-primary",
                        entry.status !== "error" &&
                          entry.status !== "done" &&
                          "bg-primary/80",
                      )}
                      style={{ width: `${entry.progress}%` }}
                    />
                  </div>

                  <div
                    className={cn(
                      "mt-1 flex items-center justify-between gap-2 text-xs",
                      mutedText,
                    )}
                  >
                    <span>
                      {formatBytes(entry.loaded)} /{" "}
                      {formatBytes(entry.file.size)}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {entry.status === "uploading" &&
                        `${entry.progress}%`}
                      {entry.status === "uploaded" && "Ready"}
                      {entry.status === "ingesting" && (
                        <span className="animate-pulse text-primary">
                          Processing…
                        </span>
                      )}
                      {entry.status === "done" && (
                        <span className="text-primary">
                          Done
                          {entry.chunkCount != null
                            ? ` · ${entry.chunkCount} chunks`
                            : ""}
                        </span>
                      )}
                      {entry.status === "error" && (
                        <span className="text-destructive">
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

        <div
          className={cn(
            "border-t p-3",
            isSidebar ? "border-sidebar-border" : "border-border p-6",
          )}
        >
          <Button
            type="button"
            onClick={handleDone}
            disabled={ingestionButtonDisabled}
            size={isSidebar ? "sm" : "default"}
            className="w-full"
          >
            {files.some((f) => f.status === "ingesting")
              ? "Processing…"
              : allDone
                ? "All done"
                : "Run ingestion"}
          </Button>
        </div>
      </div>
    </section>
  );
}
