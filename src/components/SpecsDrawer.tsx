"use client";

import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface SpecsDrawerProps {
  specs: string;
  fileName: string;
  onClose: () => void;
}

export default function SpecsDrawer({ specs, fileName, onClose }: SpecsDrawerProps) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

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
      await navigator.clipboard.writeText(specs);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be unavailable */
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 transition-opacity duration-200"
      style={{ opacity: visible ? 1 : 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl transition-transform duration-300 ease-out"
        style={{ transform: visible ? "translateX(0)" : "translateX(100%)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-zinc-900">
              Component Overview
            </h3>
            <p className="truncate text-xs text-zinc-500">{fileName}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
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

        {/* Markdown body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              table: ({ children, ...props }) => (
                <div className="overflow-x-auto rounded-lg border border-zinc-200">
                  <table className="w-full text-sm" {...props}>
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children, ...props }) => (
                <thead className="bg-zinc-50" {...props}>
                  {children}
                </thead>
              ),
              th: ({ children, ...props }) => (
                <th
                  className="border-b border-zinc-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-600"
                  {...props}
                >
                  {children}
                </th>
              ),
              td: ({ children, ...props }) => (
                <td
                  className="border-b border-zinc-100 px-3 py-2 text-zinc-800"
                  {...props}
                >
                  {children}
                </td>
              ),
              tr: ({ children, ...props }) => (
                <tr className="transition-colors hover:bg-zinc-50/60" {...props}>
                  {children}
                </tr>
              ),
              p: ({ children, ...props }) => (
                <p className="mb-3 leading-relaxed text-zinc-700" {...props}>
                  {children}
                </p>
              ),
              h1: ({ children, ...props }) => (
                <h1 className="mb-3 text-lg font-bold text-zinc-900" {...props}>
                  {children}
                </h1>
              ),
              h2: ({ children, ...props }) => (
                <h2 className="mb-2 text-base font-semibold text-zinc-900" {...props}>
                  {children}
                </h2>
              ),
              h3: ({ children, ...props }) => (
                <h3 className="mb-2 text-sm font-semibold text-zinc-900" {...props}>
                  {children}
                </h3>
              ),
            }}
          >
            {specs}
          </ReactMarkdown>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-200 px-5 py-3">
          <button
            type="button"
            onClick={copyToClipboard}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            {copied ? "Copied to Clipboard!" : "Copy to Clipboard"}
          </button>
        </div>
      </div>
    </div>
  );
}
