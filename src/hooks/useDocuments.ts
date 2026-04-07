"use client";

import { createBrowserSupabase } from "@/src/lib/supabase/client";
import { normalizeProjectName } from "@/src/lib/documents/default-project";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  status: string;
  error_message: string | null;
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

export function useDocuments(userId: string | undefined): UseDocumentsReturn {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => createBrowserSupabase(), []);

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
      const normalized = ((data as Partial<DocumentRecord>[]) ?? []).map((row) => ({
        ...row,
        project_name: normalizeProjectName(row.project_name),
        archived: row.archived ?? false,
        favorited: row.favorited ?? false,
        tags: Array.isArray(row.tags) ? row.tags : [],
        hidden: row.hidden ?? false,
        hidden_at: row.hidden_at ?? null,
      })) as DocumentRecord[];
      setDocuments(normalized);
    }

    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

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
