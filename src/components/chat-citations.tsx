"use client";

import { useMemo } from "react";
import type { Citation } from "@/hooks/use-document-chat";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const UUID_PREFIX_RE =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(.+)$/i;

function cleanFilename(documentPath: string): string {
  const parts = documentPath.split("/");
  const raw = parts[parts.length - 1] || documentPath;
  const match = raw.match(UUID_PREFIX_RE);
  return match ? match[2] : raw;
}

export function CitationsDropdown({
  citations,
  messageId,
}: {
  citations: Citation[];
  messageId: string;
}) {
  if (citations.length === 0) return null;

  const groupedSources = useMemo(() => {
    const map = new Map<
      string,
      { label: string; documentPath: string; citations: Citation[] }
    >();

    for (const citation of citations) {
      const label = cleanFilename(citation.document_path);
      const existing = map.get(label);
      if (!existing) {
        map.set(label, {
          label,
          documentPath: citation.document_path,
          citations: [citation],
        });
        continue;
      }
      existing.citations.push(citation);
    }

    return Array.from(map.values()).map((group) => ({
      ...group,
      citations: [...group.citations].sort(
        (a, b) => a.chunk_index - b.chunk_index,
      ),
    }));
  }, [citations]);

  return (
    <div className="w-full">
      <TooltipProvider delayDuration={100}>
        <ul className="flex max-w-full gap-1.5 overflow-x-auto pb-1">
          {groupedSources.map((group, idx) => {
            const chunkCount = group.citations.length;
            return (
              <li key={`${messageId}-cit-${idx}`} className="shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="max-w-36 truncate rounded-md border border-primary/35 bg-card px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                      aria-label={`Source: ${group.label} (${chunkCount} chunks)`}
                    >
                      {group.label} ({chunkCount})
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    sideOffset={6}
                    className="max-w-sm items-start rounded-lg px-3 py-2"
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-semibold">{group.label}</p>
                      <p className="text-[11px]">{chunkCount} matching chunk(s)</p>
                      <ul className="max-h-44 space-y-1 overflow-y-auto pr-1">
                        {group.citations.map((citation, citationIdx) => (
                          <li
                            key={`${messageId}-cit-${idx}-chunk-${citationIdx}`}
                            className="rounded border border-border/60 px-2 py-1"
                          >
                            <p className="text-[11px]">
                              Page: {citation.page ?? "—"} · Chunk:{" "}
                              {citation.chunk_index + 1}
                            </p>
                            <p className="line-clamp-2 text-[11px] leading-4 opacity-90">
                              {citation.preview}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      </TooltipProvider>
    </div>
  );
}
