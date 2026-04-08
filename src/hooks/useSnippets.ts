"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { createBrowserSupabase } from "@/src/lib/supabase/client";
import type { SnippetFilterState, SnippetMetadata, SnippetRecord } from "@/src/types/snippets";

const SNIPPET_CACHE_KEY = "synthetix:snippet-cache:v1";

export function useSnippets(filters: SnippetFilterState, sourcePdfId?: string) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  /** Empty on first paint (server + client) to avoid SSR/client hydration mismatch. */
  const [snippets, setSnippets] = useState<SnippetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    try {
      const raw = window.localStorage.getItem(SNIPPET_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SnippetRecord[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        setSnippets(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchSnippets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) {
        throw new Error(userError.message);
      }

      if (!user) {
        setSnippets([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from("snippets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (sourcePdfId) {
        query = query.eq("source_pdf_id", sourcePdfId);
      }

      const { data, error: queryError } = await query;
      if (queryError) {
        throw new Error(queryError.message);
      }

      const next = ((data ?? []) as SnippetRecord[]).filter((snippet) => {
        const metadata = (snippet.metadata_json ?? {}) as Partial<SnippetMetadata>;
        const dependencyText = (metadata.dependency ?? "").toLowerCase();
        const interfaceText = (metadata.interface ?? "Unknown").toUpperCase();
        const targetText = (metadata.targetHw ?? "esp32").toLowerCase();
        const confidence = Number(metadata.confidenceScore ?? 0);

        if (filters.dependency.trim() && !dependencyText.includes(filters.dependency.trim().toLowerCase())) {
          return false;
        }
        if (filters.interface !== "ALL" && interfaceText !== filters.interface.toUpperCase()) {
          return false;
        }
        if (filters.targetHw !== "ALL" && targetText !== filters.targetHw) {
          return false;
        }
        if (confidence < filters.minConfidence) {
          return false;
        }
        return true;
      });

      setSnippets(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SNIPPET_CACHE_KEY, JSON.stringify(next));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown snippets error");
    } finally {
      setLoading(false);
    }
  }, [filters, sourcePdfId, supabase]);

  useEffect(() => {
    fetchSnippets();
  }, [fetchSnippets]);

  useEffect(() => {
    function onFocus() {
      fetchSnippets();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchSnippets]);

  return {
    snippets,
    loading,
    error,
    refetch: fetchSnippets,
    setSnippets,
  };
}
