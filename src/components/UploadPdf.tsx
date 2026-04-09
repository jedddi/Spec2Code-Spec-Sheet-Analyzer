"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createBrowserSupabase } from "../lib/supabase/client";
import { CloudUpload } from "lucide-react";

const BUCKET_NAME = "Spec-sheets";
const FOLDER = "uploads";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface FileEntry {
  id: string;
  file: File;
  status: "uploading" | "uploaded" | "queued" | "error";
  progress: number;
  loaded: number;
  storagePath: string;
  error?: string;
  chunkCount?: number;
}

interface UploadPdfProps {
  onUploadComplete?: () => void;
  /** When true, ingestion starts automatically after upload (no manual button). */
  autoIngest?: boolean;
  /** Tighter layout for narrow sidebar panels. */
  variant?: "default" | "sidebar";
  /** Light-themed drop zone when using `variant="sidebar"` (e.g. datasheet manager). */
  embedLight?: boolean;
  /** Initial files prepopulated (e.g. from a parent drop event). */
  initialFiles?: File[] | null;
  /** Optional project assignment for ingested documents. */
  projectName?: string;
  /** Optional tag hints for ingested documents. */
  tags?: string[];
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
  autoIngest = false,
  variant = "default",
  embedLight = false,
  initialFiles = null,
  projectName,
  tags = [],
}: UploadPdfProps) {
  const isSidebar = variant === "sidebar";
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const supabase = useMemo(() => createBrowserSupabase(), []);

  useEffect(() => {
    let active = true;

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active) return;
      setUserId(user?.id ?? null);
      setAuthReady(true);
    });

    return () => {
      active = false;
    };
  }, [supabase]);

  const updateFile = useCallback(
    (id: string, patch: Partial<FileEntry>) =>
      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      ),
    [],
  );

  const enqueueDocument = useCallback(
    async (entry: FileEntry) => {
      if (!userId) {
        throw new Error("You must be signed in to enqueue ingestion");
      }

      const normalizedTags = Array.isArray(tags)
        ? tags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean)
        : [];
      const fileUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${entry.storagePath}`;

      const { data: upserted, error } = await supabase
        .from("documents")
        .upsert(
          {
            user_id: userId,
            storage_path: entry.storagePath,
            file_url: fileUrl,
            filename: entry.file.name,
            file_size: entry.file.size,
            project_name: projectName?.trim() || undefined,
            tags: normalizedTags,
            status: "pending",
            markdown_content: null,
            error_log: null,
            error_message: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,storage_path" },
        )
        .select("id")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const documentId = upserted?.id;
      if (!documentId) {
        throw new Error("Upsert did not return document id");
      }

      const queueRes = await fetch("/api/documents/queue", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      if (!queueRes.ok) {
        const detail = (await queueRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          detail.error || `Queue failed (${queueRes.status})`,
        );
      }
    },
    [projectName, supabase, tags, userId],
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
    (fileList: FileList | File[]) => {
      if (!userId) return;
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
          storagePath: `${FOLDER}/${userId}/${generateId()}-${file.name}`,
        };
        newEntries.push(entry);
      });

      if (newEntries.length === 0) return;

      setFiles((prev) => [...prev, ...newEntries]);
      newEntries.forEach((entry) => uploadFileXhr(entry));
    },
    [uploadFileXhr, userId],
  );

  const initialFilesAddedRef = useRef(false);

  useEffect(() => {
    if (initialFiles && initialFiles.length > 0 && userId && !initialFilesAddedRef.current) {
      initialFilesAddedRef.current = true;
      const id = window.setTimeout(() => addFiles(initialFiles), 0);
      return () => window.clearTimeout(id);
    }
  }, [initialFiles, userId, addFiles]);

  const uploadDisabled = !authReady || !userId;
  const uploadDisabledAttr = uploadDisabled;
  const uploadInteractionBlocked = uploadDisabled;

  // Auto-ingest: when a file transitions to "uploaded", start ingestion immediately
  const autoIngestTriggeredRef = useRef(new Set<string>());
  useEffect(() => {
    if (!autoIngest) return;
    const ready = files.filter(
      (f) => f.status === "uploaded" && !autoIngestTriggeredRef.current.has(f.id),
    );
    if (ready.length === 0) return;

    ready.forEach((f) => autoIngestTriggeredRef.current.add(f.id));

    void Promise.all(
      ready.map(async (entry) => {
        try {
          await enqueueDocument(entry);
          updateFile(entry.id, { status: "queued" });
        } catch (err) {
          updateFile(entry.id, {
            status: "error",
            error:
              err instanceof Error ? err.message : "Failed to queue ingestion",
          });
        }
      }),
    ).then(() => {
      onUploadComplete?.();
    });
  }, [autoIngest, enqueueDocument, files, onUploadComplete, updateFile]);

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
      if (uploadInteractionBlocked) return;
      dragCounter.current = 0;
      setDragging(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles, uploadInteractionBlocked],
  );

  const handleBrowse = useCallback(() => {
    if (uploadInteractionBlocked) return;
    inputRef.current?.click();
  }, [uploadInteractionBlocked]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (uploadInteractionBlocked) return;
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
        e.target.value = "";
      }
    },
    [addFiles, uploadInteractionBlocked],
  );

  const hasUploading = files.some((f) => f.status === "uploading");
  const hasPendingQueue = files.some((f) => f.status === "uploaded");
  const allDone =
    files.length > 0 && files.every((f) => f.status === "queued");
  const hasWorkToIngest = files.some((f) => f.status === "uploaded");

  const doneDisabled = !hasWorkToIngest || hasUploading || allDone;

  const ingestionButtonDisabled = doneDisabled;

  async function handleDone() {
    const toIngest = files.filter((f) => f.status === "uploaded");
    if (toIngest.length === 0) return;

    await Promise.all(
      toIngest.map(async (entry) => {
        try {
          await enqueueDocument(entry);
          updateFile(entry.id, { status: "queued" });
        } catch (err) {
          updateFile(entry.id, {
            status: "error",
            error:
              err instanceof Error ? err.message : "Failed to queue ingestion",
          });
        }
      }),
    );

    onUploadComplete?.();
  }

  const shellClass = isSidebar
    ? embedLight
      ? "rounded-xl border-0 bg-transparent shadow-none"
      : "rounded-lg border border-sidebar-border bg-sidebar-accent/50 shadow-none"
    : "rounded-[24px] bg-white p-2";

  const dropBase = isSidebar
    ? embedLight
      ? "border-zinc-300/90 bg-zinc-50/40 text-zinc-600"
      : "border-sidebar-border bg-sidebar/40 text-sidebar-foreground"
    : "border-border bg-muted/30 text-muted-foreground";

  const dropActive = isSidebar
    ? embedLight
      ? "border-blue-500 bg-blue-50/80 text-zinc-700"
      : "border-sidebar-primary bg-sidebar-accent"
    : "border-primary bg-primary/5";

  const mutedText = isSidebar
    ? embedLight
      ? "text-zinc-500"
      : "text-sidebar-foreground/70"
    : "text-muted-foreground";

  return (
    <section className={cn("w-full", !isSidebar && "max-w-xl")}>
      <div className={cn("overflow-hidden", shellClass)}>
        {!isSidebar && (
          <div className="border-b border-black/[0.06] px-6 py-4">
            <h2 className="text-center text-lg font-bold tracking-tight text-[#111]">
              File upload
            </h2>
          </div>
        )}

        <div className={cn(isSidebar ? "p-3" : "p-4")}>
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={cn(
              "flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors",
              isSidebar ? "px-3 py-6" : "px-6 py-10",
              dragging ? dropActive : (!isSidebar ? "border-[#4285f4] bg-[#f8faff]" : dropBase),
            )}
          >
            <CloudUpload
              className={cn(
                "mb-3",
                isSidebar ? "h-9 w-9" : "h-14 w-14",
                isSidebar
                  ? embedLight
                    ? "text-blue-600"
                    : "text-sidebar-foreground"
                  : "text-[#4285f4]",
              )}
              strokeWidth={2.5}
            />

            <p
              className={cn(
                "text-center",
                isSidebar && !embedLight ? "text-[17px]" : isSidebar ? "text-[15px]" : "text-[17px]",
                isSidebar ? mutedText : "text-[#111]",
              )}
            >
              Drag and drop PDFs here or{" "}
              <button
                type="button"
                onClick={handleBrowse}
                disabled={uploadDisabledAttr}
                className={cn(
                  "font-medium underline underline-offset-2",
                  uploadInteractionBlocked && "cursor-not-allowed opacity-60",
                  isSidebar
                    ? embedLight
                      ? "text-blue-600 hover:text-blue-700"
                      : "text-sidebar-primary"
                    : "text-[#4285f4] hover:text-[#2b65c2]",
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
            disabled={uploadDisabledAttr}
            className="sr-only"
          />
          {authReady && !userId ? (
            <p className={cn("mt-3 text-center text-xs", isSidebar ? mutedText : "text-gray-500")}>
              Sign in to upload files.
            </p>
          ) : null}
        </div>

        {files.length > 0 && (
          <div
            className={cn(
              "flex flex-col gap-3 pb-2 pt-4 px-2",
            )}
          >
            {files.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 rounded-md px-2"
              >
                <div
                  className={cn(
                    "flex shrink-0 items-center justify-center",
                    isSidebar ? "size-9" : "size-12",
                  )}
                >
                  <svg width="36" height="42" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 8C4 5.79086 5.79086 4 8 4H24L36 16V40C36 42.2091 34.2091 44 32 44H8C5.79086 44 4 42.2091 4 40V8Z" stroke="#4a5568" strokeWidth="3" strokeLinejoin="round" />
                    <path d="M24 4V16H36" stroke="#4a5568" strokeWidth="3" strokeLinejoin="round" />
                    <rect x="0" y="26" width="40" height="14" fill="white" />
                    <text x="20" y="38" fontSize="14" fontWeight="900" fill="#2b6ced" textAnchor="middle" fontFamily="sans-serif">PDF</text>
                  </svg>
                </div>

                <div className="min-w-0 flex-1 flex flex-col justify-center">
                  <p
                    className={cn(
                      "truncate text-[15px] font-medium text-[#111]",
                    )}
                  >
                    {entry.file.name}
                  </p>

                  <div
                    className={cn(
                      "mt-1.5 h-1.5 w-full overflow-hidden rounded-full",
                      isSidebar ? "bg-sidebar-border" : "bg-[#e2e8f0]",
                    )}
                  >
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        entry.status === "error" ? "bg-destructive" : "bg-[#4285f4]",
                      )}
                      style={{ width: `${entry.progress}%` }}
                    />
                  </div>

                  <div
                    className={cn(
                      "mt-1.5 flex items-center justify-between text-[13px] font-medium",
                    )}
                  >
                    <span className="text-gray-500">
                      {formatBytes(entry.loaded)} /{" "}
                      {formatBytes(entry.file.size)}
                    </span>
                    <span className={cn(
                      "shrink-0 tabular-nums text-[#4285f4]",
                      entry.status === "error" && "text-destructive"
                    )}>
                      {entry.status === "uploading" &&
                        `${entry.progress}%`}
                      {entry.status === "uploaded" && "Ready"}
                      {entry.status === "queued" && "Queued"}
                      {entry.status === "error" && (
                        <span>
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

        {!autoIngest && (
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
              {hasPendingQueue
                ? "Queue ingestion"
                : files.some((f) => f.status === "queued")
                  ? "Queued"
                  : "Queue ingestion"}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
