"use client";

import { useState } from "react";

import type { Citation } from "@/hooks/use-document-chat";

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
  const [isOpen, setIsOpen] = useState(false);

  if (citations.length === 0) return null;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-card px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
      >
        <svg
          className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {citations.length} source{citations.length !== 1 ? "s" : ""}
      </button>

      {isOpen && (
        <ul className="absolute left-0 top-full z-50 mt-1 max-h-48 w-72 overflow-y-auto space-y-2 rounded-lg border border-border bg-popover p-2 shadow-md">
          {citations.map((citation, idx) => (
            <li
              key={`${messageId}-cit-${idx}`}
              className="rounded-lg border border-primary/25 bg-card px-3 py-2"
            >
              <p className="text-xs font-semibold text-primary">
                {cleanFilename(citation.document_path)}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {citation.preview}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Similarity: {citation.similarity}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
