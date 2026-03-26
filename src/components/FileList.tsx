"use client";

import { useCallback, useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon, File01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { createBrowserSupabase } from "../lib/supabase/client";
import CodeModal from "./CodeModal";
import SpecsDrawer from "./SpecsDrawer";

const BUCKET_NAME = "Spec-sheets";
const FOLDER = "uploads";

interface FileEntry {
  name: string;
  created_at: string;
}

interface FileListProps {
  refreshKey: number;
  /** When false, hides Generate Code and Quick Specs (default true). */
  showGenerateAndSpecs?: boolean;
  /** Match shadcn sidebar file-tree styling in the sidebar panel. */
  variant?: "default" | "sidebar";
  className?: string;
}

export default function FileList({
  refreshKey,
  showGenerateAndSpecs = true,
  variant = "default",
  className,
}: FileListProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [generatingName, setGeneratingName] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [modalFileName, setModalFileName] = useState<string>("");
  const [specsName, setSpecsName] = useState<string | null>(null);
  const [specsContent, setSpecsContent] = useState<string | null>(null);
  const [specsFileName, setSpecsFileName] = useState<string>("");

  const supabase = createBrowserSupabase();
  const isSidebar = variant === "sidebar";

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(FOLDER, { sortBy: { column: "created_at", order: "desc" } });

    if (listError) {
      setError(listError.message);
    } else {
      const pdfs = (data ?? []).filter(
        (f) => f.name && !f.name.startsWith("."),
      );
      setFiles(
        pdfs.map((f) => ({ name: f.name, created_at: f.created_at ?? "" })),
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles, refreshKey]);

  async function onDelete(fileName: string) {
    const confirmed = window.confirm(
      `Delete "${fileName}" from storage? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingName(fileName);
    const path = `${FOLDER}/${fileName}`;

    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (deleteError) {
      alert(`Delete failed: ${deleteError.message}`);
    } else {
      setFiles((prev) => prev.filter((f) => f.name !== fileName));
    }

    setDeletingName(null);
  }

  async function onGenerateCode(fileName: string) {
    setGeneratingName(fileName);
    const storagePath = `${FOLDER}/${fileName}`;

    try {
      const res = await fetch("/api/generate-header", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath }),
      });

      const text = await res.text();
      let result: Record<string, unknown>;
      try {
        result = JSON.parse(text);
      } catch {
        const msg = res.status === 504
          ? "Function timed out — try a smaller file"
          : `Server error (${res.status})`;
        alert(`Code generation failed: ${msg}`);
        return;
      }

      if (!res.ok) {
        alert(`Code generation failed: ${result.error ?? "Unknown error"}`);
        return;
      }

      setGeneratedCode(result.code as string);
      setModalFileName(displayName(fileName));
    } catch (err) {
      alert(
        `Code generation failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setGeneratingName(null);
    }
  }

  async function onQuickSpecs(fileName: string) {
    setSpecsName(fileName);
    const storagePath = `${FOLDER}/${fileName}`;

    try {
      const res = await fetch("/api/quick-specs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath }),
      });

      const text = await res.text();
      let result: Record<string, unknown>;
      try {
        result = JSON.parse(text);
      } catch {
        const msg = res.status === 504
          ? "Function timed out — try a smaller file"
          : `Server error (${res.status})`;
        alert(`Quick Specs failed: ${msg}`);
        return;
      }

      if (!res.ok) {
        alert(`Quick Specs failed: ${result.error ?? "Unknown error"}`);
        return;
      }

      setSpecsContent(result.specs as string);
      setSpecsFileName(displayName(fileName));
    } catch (err) {
      alert(
        `Quick Specs failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setSpecsName(null);
    }
  }

  function displayName(raw: string) {
    const uuidPrefix =
      /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(.+)$/i;
    const match = raw.match(uuidPrefix);
    if (match) return match[2];

    return raw;
  }

  const statusText = (msg: string) =>
    isSidebar ? (
      <p className="px-2 py-2 text-sm text-sidebar-foreground/70">{msg}</p>
    ) : (
      <p className="mt-3 text-sm text-muted-foreground">{msg}</p>
    );

  if (loading) {
    return (
      <section className={cn(!isSidebar && "w-full max-w-xl", className)}>
        {!isSidebar && (
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Uploaded files
          </h2>
        )}
        {statusText("Loading files…")}
      </section>
    );
  }

  if (error) {
    return (
      <section className={cn(!isSidebar && "w-full max-w-xl", className)}>
        {!isSidebar && (
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Uploaded files
          </h2>
        )}
        {isSidebar ? (
          <p className="px-2 py-2 text-sm text-destructive">{error}</p>
        ) : (
          <p className="mt-3 text-sm font-medium text-destructive">{error}</p>
        )}
      </section>
    );
  }

  if (files.length === 0) {
    return (
      <section className={cn(!isSidebar && "w-full max-w-xl", className)}>
        {!isSidebar && (
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Uploaded files
          </h2>
        )}
        {statusText("No files uploaded yet.")}
      </section>
    );
  }

  if (isSidebar) {
    return (
      <section className={cn("w-full", className)}>
        <SidebarMenu className="gap-0">
          {files.map((file) => (
            <SidebarMenuItem key={file.name}>
              <SidebarMenuButton
                size="sm"
                className="h-auto cursor-default gap-2 py-2 pr-8 hover:bg-sidebar-accent"
              >
                <HugeiconsIcon
                  icon={File01Icon}
                  strokeWidth={2}
                  className="shrink-0 text-sidebar-foreground/70"
                />
                <span className="grid min-w-0 flex-1 text-left leading-tight">
                  <span className="truncate font-medium text-sidebar-foreground">
                    {displayName(file.name)}
                  </span>
                  {file.created_at ? (
                    <span className="truncate text-xs text-sidebar-foreground/60">
                      {new Date(file.created_at).toLocaleString()}
                    </span>
                  ) : null}
                </span>
              </SidebarMenuButton>
              <SidebarMenuAction
                title="Delete file"
                className="text-sidebar-foreground/80 hover:text-destructive"
                disabled={deletingName === file.name}
                onClick={() => onDelete(file.name)}
              >
                <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                <span className="sr-only">Delete</span>
              </SidebarMenuAction>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>

        {showGenerateAndSpecs && generatedCode !== null && (
          <CodeModal
            code={generatedCode}
            fileName={modalFileName}
            onClose={() => {
              setGeneratedCode(null);
              setModalFileName("");
            }}
          />
        )}

        {showGenerateAndSpecs && specsContent !== null && (
          <SpecsDrawer
            specs={specsContent}
            fileName={specsFileName}
            onClose={() => {
              setSpecsContent(null);
              setSpecsFileName("");
            }}
          />
        )}
      </section>
    );
  }

  return (
    <section className={cn("w-full max-w-xl", className)}>
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        Uploaded files
      </h2>

      <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card/40">
        {files.map((file) => (
          <li
            key={file.name}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {displayName(file.name)}
              </p>
              {file.created_at ? (
                <p className="text-xs text-muted-foreground">
                  {new Date(file.created_at).toLocaleString()}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {showGenerateAndSpecs ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => onGenerateCode(file.name)}
                    disabled={generatingName === file.name}
                  >
                    {generatingName === file.name
                      ? "Generating…"
                      : "Generate code"}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => onQuickSpecs(file.name)}
                    disabled={specsName === file.name}
                  >
                    {specsName === file.name ? "Loading…" : "Quick specs"}
                  </Button>
                </>
              ) : null}

              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(file.name)}
                disabled={deletingName === file.name}
              >
                {deletingName === file.name ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {showGenerateAndSpecs && generatedCode !== null && (
        <CodeModal
          code={generatedCode}
          fileName={modalFileName}
          onClose={() => {
            setGeneratedCode(null);
            setModalFileName("");
          }}
        />
      )}

      {showGenerateAndSpecs && specsContent !== null && (
        <SpecsDrawer
          specs={specsContent}
          fileName={specsFileName}
          onClose={() => {
            setSpecsContent(null);
            setSpecsFileName("");
          }}
        />
      )}
    </section>
  );
}
