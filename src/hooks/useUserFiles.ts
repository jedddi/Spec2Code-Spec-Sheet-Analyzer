"use client";

import { createBrowserSupabase } from "@/src/lib/supabase/client";
import { useCallback, useEffect, useMemo, useState } from "react";

const BUCKET_NAME = "Spec-sheets";
const ROOT_FOLDER = "uploads";

export interface UserFileEntry {
  name: string;
  created_at: string;
}

interface UseUserFilesReturn {
  files: UserFileEntry[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useUserFiles(userId: string | undefined): UseUserFilesReturn {
  const [files, setFiles] = useState<UserFileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const fetchFiles = useCallback(async () => {
    if (!userId) {
      setFiles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(`${ROOT_FOLDER}/${userId}`, {
        sortBy: { column: "created_at", order: "desc" },
      });

    if (listError) {
      setError(listError.message);
    } else {
      const filtered = (data ?? []).filter(
        (f) => f.name && !f.name.startsWith("."),
      );
      setFiles(
        filtered.map((f) => ({ name: f.name, created_at: f.created_at ?? "" })),
      );
    }

    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  return { files, loading, error, refetch: fetchFiles };
}
