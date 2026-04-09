"use client";

import { createBrowserSupabase } from "@/src/lib/supabase/client";
import { normalizeProjectName } from "@/src/lib/documents/default-project";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type DocumentStatus = "pending" | "processing" | "completed" | "failed";

export interface DocumentRecord {
  id: string;
  user_id: string;
  storage_path: string;
  filename: string;
  file_size: number | null;
  category: string | null;
  operating_voltage: string | null;
  interface: string | null;
  power_consumption: string | null;
  status: DocumentStatus;
  error_message: string | null;
  file_url?: string | null;
  markdown_content?: string | null;
  error_log?: string | null;
  chunk_count: number;
  project_name: string;
  archived: boolean;
  favorited: boolean;
  tags: string[];
  hidden: boolean;
  hidden_at: string | null;
  created_at: string;
  updated_at: string;
}

interface UseDocumentsReturn {
  documents: DocumentRecord[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  deleteDocument: (storagePath: string) => Promise<void>;
}

function normalizeDocumentRow(row: Partial<DocumentRecord>): DocumentRecord {
  // Widen to string so legacy DB values ("ready", "error") are accepted.
  const rawStatus: string =
    typeof row.status === "string" ? row.status : "pending";
  const normalizedStatus: DocumentStatus = (() => {
    if (rawStatus === "ready") return "completed";
    if (rawStatus === "error") return "failed";
    if (
      rawStatus === "pending" ||
      rawStatus === "processing" ||
      rawStatus === "completed" ||
      rawStatus === "failed"
    ) {
      return rawStatus;
    }
    return "pending";
  })();

  return {
    ...row,
    status: normalizedStatus,
    project_name: normalizeProjectName(row.project_name),
    archived: row.archived ?? false,
    favorited: row.favorited ?? false,
    tags: Array.isArray(row.tags) ? row.tags : [],
    hidden: row.hidden ?? false,
    hidden_at: row.hidden_at ?? null,
  } as DocumentRecord;
}

export function useDocuments(userId: string | undefined): UseDocumentsReturn {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const finalizeInFlight = useRef(new Set<string>());
  const finalizeFailures = useRef(new Map<string, number>());

  const fetchDocuments = useCallback(async () => {
    if (!userId) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", userId)
      .or("hidden.is.null,hidden.eq.false")
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
    } else {
      const normalized = ((data as Partial<DocumentRecord>[]) ?? []).map(
        normalizeDocumentRow,
      );
      setDocuments(normalized);
    }

    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`documents:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "documents",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const deleted = payload.old as Partial<DocumentRecord>;
            const deletedId = typeof deleted?.id === "string" ? deleted.id : null;
            if (!deletedId) return;
            setDocuments((prev) => prev.filter((doc) => doc.id !== deletedId));
            return;
          }

          const nextRowRaw = payload.new as Partial<DocumentRecord>;
          if (!nextRowRaw || typeof nextRowRaw.id !== "string") return;
          const nextRow = normalizeDocumentRow(nextRowRaw);

          setDocuments((prev) => {
            if (nextRow.hidden) {
              return prev.filter((doc) => doc.id !== nextRow.id);
            }

            const idx = prev.findIndex((doc) => doc.id === nextRow.id);
            if (idx === -1) {
              return [nextRow, ...prev];
            }

            const copy = [...prev];
            copy[idx] = nextRow;
            return copy;
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  // Unstructured marks `completed` before RAG. If Edge→Next finalize was never configured, chunk_count stays 0 — run finalize from the signed-in app (uses cookies, no extra secrets).
  useEffect(() => {
    if (!userId) return;

    // Old 409 "no markdown" stopped retries (failure bucket 99). Finalize now falls back to PDF — allow another attempt.
    for (const doc of documents) {
      if (
        doc.status === "completed" &&
        doc.chunk_count === 0 &&
        finalizeFailures.current.get(doc.id) === 99
      ) {
        finalizeFailures.current.delete(doc.id);
      }
    }

    for (const doc of documents) {
      if (doc.status !== "completed" || doc.chunk_count > 0) continue;
      if (finalizeInFlight.current.has(doc.id)) continue;
      if ((finalizeFailures.current.get(doc.id) ?? 0) >= 3) continue;

      finalizeInFlight.current.add(doc.id);
      void (async () => {
        try {
          const res = await fetch("/api/documents/finalize-ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentId: doc.id }),
          });
          if (!res.ok) {
            const payload = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            finalizeFailures.current.set(
              doc.id,
              (finalizeFailures.current.get(doc.id) ?? 0) + 1,
            );
            if (payload.error) {
              console.warn("[finalize-ingest]", doc.id, payload.error);
            }
          }
        } catch {
          finalizeFailures.current.set(
            doc.id,
            (finalizeFailures.current.get(doc.id) ?? 0) + 1,
          );
        } finally {
          finalizeInFlight.current.delete(doc.id);
        }
      })();
    }
  }, [documents, userId]);

  const deleteDocument = useCallback(
    async (storagePath: string) => {
      // Optimistic removal
      setDocuments((prev) =>
        prev.filter((d) => d.storage_path !== storagePath),
      );

      try {
        const res = await fetch("/api/documents/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storagePath }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error ?? "Delete failed",
          );
        }
      } catch (err) {
        // Revert optimistic removal on failure
        await fetchDocuments();
        throw err;
      }
    },
    [fetchDocuments],
  );

  return {
    documents,
    loading,
    error,
    refetch: fetchDocuments,
    deleteDocument,
  };
}
