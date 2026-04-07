"use client";

import { useCallback, useState } from "react";
import type { GenerateSnippetInput, SnippetRecord } from "@/src/types/snippets";

export function useGenerateSnippet(onCreated?: (snippet: SnippetRecord) => void) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (input: GenerateSnippetInput) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/snippets/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error((payload as { error?: string }).error ?? "Failed to generate snippet");
        }
        const payload = (await res.json()) as { snippet: SnippetRecord };
        onCreated?.(payload.snippet);
        return payload.snippet;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown generation error";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [onCreated],
  );

  return { generate, loading, error };
}
