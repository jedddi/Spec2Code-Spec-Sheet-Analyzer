"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon, File01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useDocumentChatContext } from "@/src/contexts/document-chat-context";
import { createBrowserSupabase } from "../lib/supabase/client";

const BUCKET_NAME = "Spec-sheets";
const ROOT_FOLDER = "uploads";

interface FileEntry {
  name: string;
  created_at: string;
}

interface FileListProps {
  refreshKey: number;
  /** Match shadcn sidebar file-tree styling in the sidebar panel. */
  variant?: "default" | "sidebar";
  className?: string;
}

export default function FileList({
  refreshKey,
  variant = "default",
  className,
}: FileListProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [generatingName, setGeneratingName] = useState<string | null>(null);
  const [specsName, setSpecsName] = useState<string | null>(null);

  const supabase = useMemo(() => createBrowserSupabase(), []);
  const { appendAssistantMessage } = useDocumentChatContext();
  const isSidebar = variant === "sidebar";
  const userFolder = userId ? `${ROOT_FOLDER}/${userId}` : null;

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setUserId(null);
      setFiles([]);
      setLoading(false);
      setError(userError?.message ?? "You must be signed in to view files.");
      return;
    }

    setUserId(user.id);

    const { data, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(`${ROOT_FOLDER}/${user.id}`, {
        sortBy: { column: "created_at", order: "desc" },
      });

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
  }, [supabase]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles, refreshKey]);

  async function onDelete(fileName: string) {
    if (!userFolder) {
      alert("You must be signed in to delete files.");
      return;
    }

    const confirmed = window.confirm(
      `Delete "${fileName}" from storage? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingName(fileName);
    const path = `${userFolder}/${fileName}`;

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
    if (!userFolder) {
      alert("You must be signed in to generate code.");
      return;
    }

    setGeneratingName(fileName);
    const storagePath = `${userFolder}/${fileName}`;

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

      if (typeof result.code !== "string" || !result.code.trim()) {
        alert("Code generation failed: Empty code response");
        return;
      }

      appendAssistantMessage(
        `### Generated C++ Header\n**File:** ${displayName(fileName)}\n\n\`\`\`cpp\n${result.code}\n\`\`\``,
      );
    } catch (err) {
      alert(
        `Code generation failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setGeneratingName(null);
    }
  }

  async function onQuickSpecs(fileName: string) {
    if (!userFolder) {
      alert("You must be signed in to generate quick specs.");
      return;
    }

    setSpecsName(fileName);
    const storagePath = `${userFolder}/${fileName}`;

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

      if (typeof result.specs !== "string" || !result.specs.trim()) {
        alert("Quick Specs failed: Empty specs response");
        return;
      }

      appendAssistantMessage(
        `### Quick specs\n**File:** ${displayName(fileName)}\n\n${result.specs}`,
      );
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="sm"
                    className="h-auto cursor-pointer gap-2 py-2 pr-8 hover:bg-sidebar-accent"
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
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  <DropdownMenuItem
                    disabled={generatingName === file.name}
                    onClick={() => onGenerateCode(file.name)}
                  >
                    {generatingName === file.name ? "Generating…" : "Generate code"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={specsName === file.name}
                    onClick={() => onQuickSpecs(file.name)}
                  >
                    {specsName === file.name ? "Loading…" : "Quick specs"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="min-w-0 flex-1 cursor-pointer rounded-md p-1 text-left transition-colors hover:bg-muted/60"
                >
                  <p className="truncate text-sm font-medium text-foreground">
                    {displayName(file.name)}
                  </p>
                  {file.created_at ? (
                    <p className="text-xs text-muted-foreground">
                      {new Date(file.created_at).toLocaleString()}
                    </p>
                  ) : null}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuItem
                  disabled={generatingName === file.name}
                  onClick={() => onGenerateCode(file.name)}
                >
                  {generatingName === file.name ? "Generating…" : "Generate code"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={specsName === file.name}
                  onClick={() => onQuickSpecs(file.name)}
                >
                  {specsName === file.name ? "Loading…" : "Quick specs"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex shrink-0 items-center">
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
    </section>
  );
}
