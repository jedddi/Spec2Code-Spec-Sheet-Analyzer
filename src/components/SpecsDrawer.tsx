"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface SpecsDrawerProps {
  specs: string;
  fileName: string;
  onClose: () => void;
}

export default function SpecsDrawer({ specs, fileName, onClose }: SpecsDrawerProps) {
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
      await navigator.clipboard.writeText(specs);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be unavailable */
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        key="specs-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          key="specs-modal"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-foreground">
                Component Overview
              </h3>
              <p className="truncate text-xs text-muted-foreground">{fileName}</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
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
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm" {...props}>
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children, ...props }) => (
                  <thead className="bg-muted" {...props}>
                    {children}
                  </thead>
                ),
                th: ({ children, ...props }) => (
                  <th
                    className="border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    {...props}
                  >
                    {children}
                  </th>
                ),
                td: ({ children, ...props }) => (
                  <td
                    className="border-b border-border/60 px-3 py-2 text-foreground"
                    {...props}
                  >
                    {children}
                  </td>
                ),
                tr: ({ children, ...props }) => (
                  <tr className="transition-colors hover:bg-muted/60" {...props}>
                    {children}
                  </tr>
                ),
                p: ({ children, ...props }) => (
                  <p className="mb-3 leading-relaxed text-foreground/90" {...props}>
                    {children}
                  </p>
                ),
                h1: ({ children, ...props }) => (
                  <h1 className="mb-3 text-lg font-bold text-foreground" {...props}>
                    {children}
                  </h1>
                ),
                h2: ({ children, ...props }) => (
                  <h2 className="mb-2 text-base font-semibold text-foreground" {...props}>
                    {children}
                  </h2>
                ),
                h3: ({ children, ...props }) => (
                  <h3 className="mb-2 text-sm font-semibold text-foreground" {...props}>
                    {children}
                  </h3>
                ),
              }}
            >
              {specs}
            </ReactMarkdown>
          </div>

          {/* Footer */}
          <div className="border-t border-border px-5 py-3">
            <button
              type="button"
              onClick={copyToClipboard}
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {copied ? "Copied to Clipboard!" : "Copy to Clipboard"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
