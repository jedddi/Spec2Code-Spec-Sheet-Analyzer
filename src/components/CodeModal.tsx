"use client";

import { useCallback, useEffect, useState } from "react";

interface CodeModalProps {
  code: string;
  fileName: string;
  onClose: () => void;
}

export default function CodeModal({ code, fileName, onClose }: CodeModalProps) {
  const [copied, setCopied] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be unavailable */
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-blue-300 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-zinc-900">
              Generated C++ Header
            </h3>
            <p className="truncate text-xs text-zinc-500">{fileName}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyToClipboard}
              className="rounded-full border border-blue-400 px-3 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
            >
              {copied ? "Copied!" : "Copy"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
              aria-label="Close"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Code block */}
        <div className="flex-1 overflow-auto bg-zinc-950 p-5">
          <pre className="text-sm leading-6 text-zinc-100">
            <code>{code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
