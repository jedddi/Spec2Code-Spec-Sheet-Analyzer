"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  FileText,
  Heart,
  Loader2,
  RefreshCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { DocumentRecord } from "@/src/hooks/useDocuments";
import { toast } from "sonner";
import UploadPdf from "@/src/components/UploadPdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { displayDocumentFilename } from "@/src/lib/documents/display-filename";
import { DEFAULT_DOCUMENT_PROJECT } from "@/src/lib/documents/default-project";

interface DatasheetManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: DocumentRecord[];
  onDelete: (storagePath: string) => Promise<void>;
  onRefetch: () => void;
}

type LibraryView = "files" | "archive" | "favorites";

const LIBRARY_VIEWS: { id: LibraryView; label: string }[] = [
  { id: "files", label: "Files" },
  { id: "archive", label: "Archive" },
  { id: "favorites", label: "Favorites" },
];

const DEFAULT_TAGS = ["Sensor", "MCU", "Actuator"];

const ROW_GRID =
  "grid grid-cols-[1.75rem_minmax(0,1fr)_5.5rem_6.75rem_6.5rem] items-center gap-3";

/** Outline `Button`s in this dialog: zinc hover wins over `outline` token hovers; `dark:` keeps parity when `html` is `.dark`. */
const TOOLBAR_ACTION_CLASS =
  "rounded-full border-zinc-200 bg-white px-3 text-zinc-700 shadow-sm transition-[background-color,border-color,color,box-shadow] duration-150 [&_svg]:text-zinc-500 hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-900 hover:shadow-md hover:[&_svg]:text-zinc-800 active:bg-zinc-200/90 dark:border-zinc-200 dark:bg-white dark:text-zinc-700 dark:[&_svg]:text-zinc-500 dark:hover:border-zinc-300 dark:hover:bg-zinc-100 dark:hover:text-zinc-900 dark:hover:[&_svg]:text-zinc-800";

const TOOLBAR_DELETE_CLASS =
  "rounded-full border-red-200/90 bg-white px-3 text-red-600 shadow-sm transition-[background-color,border-color,color,box-shadow] duration-150 [&_svg]:text-red-500 hover:border-red-300 hover:bg-red-50 hover:text-red-700 hover:shadow-md hover:[&_svg]:text-red-600 active:bg-red-100/80 dark:border-red-200/90 dark:bg-white dark:text-red-600 dark:hover:border-red-300 dark:hover:bg-red-50 dark:hover:text-red-700";

/** Dialog is always light; html may still be `.dark`, so don't use theme `bg-background` for controls. */
const LIGHT_CHECKBOX_CLASS =
  "!border-zinc-300 !bg-white shadow-sm focus-visible:ring-blue-500/35 data-[state=checked]:!border-blue-600 data-[state=checked]:!bg-blue-600 data-[state=checked]:!text-white";

function prettyBytes(size: number | null): string {
  if (!size || size <= 0) return "Unknown";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function libraryIconFor(view: LibraryView) {
  switch (view) {
    case "files":
      return FileText;
    case "archive":
      return Archive;
    case "favorites":
      return Heart;
  }
}

export default function DatasheetManagerDialog({
  open,
  onOpenChange,
  documents,
  onDelete,
  onRefetch,
}: DatasheetManagerDialogProps) {
  const [query, setQuery] = useState("");
  const [selectedLibraryView, setSelectedLibraryView] =
    useState<LibraryView>("files");
  const [selectedTag, setSelectedTag] = useState<string>("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [patchLoading, setPatchLoading] = useState(false);
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);

  const tags = useMemo(() => {
    const dynamic = new Set<string>(DEFAULT_TAGS);
    documents.forEach((doc) => {
      doc.tags.forEach((tag) => dynamic.add(tag));
      if (doc.category) dynamic.add(doc.category);
    });
    return Array.from(dynamic);
  }, [documents]);

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch =
        query.length === 0 ||
        displayDocumentFilename(doc.filename)
          .toLowerCase()
          .includes(query.toLowerCase());
      const inLibraryView =
        (selectedLibraryView === "files" && !doc.archived) ||
        (selectedLibraryView === "archive" && doc.archived) ||
        (selectedLibraryView === "favorites" && doc.favorited);
      const docTags = new Set([...(doc.tags || []), doc.category || ""]);
      const matchesTag = selectedTag === "ALL" || docTags.has(selectedTag);
      return matchesSearch && inLibraryView && matchesTag;
    });
  }, [documents, query, selectedLibraryView, selectedTag]);

  const selectedDocsForToolbar = useMemo(
    () => documents.filter((doc) => selectedIds.includes(doc.id)),
    [documents, selectedIds],
  );
  const allSelectedFavorited =
    selectedDocsForToolbar.length > 0 &&
    selectedDocsForToolbar.every((doc) => doc.favorited);

  const activeDoc = useMemo(() => {
    if (!activeDocId) return filteredDocs[0] ?? null;
    return (
      filteredDocs.find((doc) => doc.id === activeDocId) ??
      filteredDocs[0] ??
      null
    );
  }, [activeDocId, filteredDocs]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allChecked =
    filteredDocs.length > 0 &&
    filteredDocs.every((doc) => selectedSet.has(doc.id));

  function toggleRow(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  }

  function toggleAllRows() {
    if (allChecked) {
      setSelectedIds((prev) =>
        prev.filter((id) => !filteredDocs.some((doc) => doc.id === id)),
      );
      return;
    }
    setSelectedIds((prev) =>
      Array.from(new Set([...prev, ...filteredDocs.map((doc) => doc.id)])),
    );
  }

  async function patchSelectedDocs(flags: {
    archived?: boolean;
    favorited?: boolean;
  }) {
    if (selectedIds.length === 0 || patchLoading) return;
    setPatchLoading(true);
    try {
      const res = await fetch("/api/documents/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentIds: selectedIds,
          ...flags,
        }),
      });
      const payload = (await res.json()) as {
        success?: boolean;
        updated?: number;
        error?: string;
      };
      if (!res.ok) {
        toast.error(payload.error ?? "Could not update documents");
        return;
      }
      setSelectedIds([]);
      onRefetch();
    } catch {
      toast.error("Network error while updating documents");
    } finally {
      setPatchLoading(false);
    }
  }

  function handleArchiveAction() {
    if (selectedLibraryView === "archive") {
      void patchSelectedDocs({ archived: false });
    } else {
      void patchSelectedDocs({ archived: true });
    }
  }

  function handleFavoritesAction() {
    void patchSelectedDocs({ favorited: !allSelectedFavorited });
  }

  async function handleDeleteSelected() {
    if (selectedIds.length === 0) return;
    const selectedDocs = documents.filter((doc) => selectedSet.has(doc.id));
    for (const doc of selectedDocs) {
      await onDelete(doc.storage_path);
    }
    setSelectedIds([]);
    onRefetch();
  }

  async function handleReindex(doc: DocumentRecord) {
    setReindexingId(doc.id);
    try {
      await fetch("/api/documents/reindex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath: doc.storage_path }),
      });
      onRefetch();
    } finally {
      setReindexingId(null);
    }
  }

  async function handleViewPdf(doc: DocumentRecord) {
    setPdfLoadingId(doc.id);
    try {
      const res = await fetch("/api/documents/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath: doc.storage_path }),
      });
      const payload = (await res.json()) as { signedUrl?: string };
      if (payload.signedUrl) {
        window.open(payload.signedUrl, "_blank", "noopener,noreferrer");
      }
    } finally {
      setPdfLoadingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(88vh,900px)] max-h-[90vh] w-[min(96vw,1200px)] flex-col gap-0 overflow-hidden rounded-2xl border border-zinc-200/90 bg-white p-0 text-zinc-900 shadow-2xl"
      >
        <DialogHeader className="relative shrink-0 border-b border-zinc-200 bg-white px-6 pb-4 pt-5 pr-14">
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute right-4 top-4 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </Button>
          </DialogClose>
          <DialogTitle className="font-[family-name:var(--font-plus-jakarta)] text-lg font-bold tracking-tight text-zinc-900">
            Datasheet Manager
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-zinc-500">
            Manage indexing health, projects, and RAG intelligence for uploaded
            component datasheets.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)_300px] bg-zinc-50/80">
          {/* Left: collections & tags */}
          <aside className="flex min-h-0 flex-col gap-4 border-r border-zinc-200 bg-white px-4 py-4">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Folders
              </p>
              <div className="space-y-0.5 pr-1">
                {LIBRARY_VIEWS.map(({ id, label }) => {
                  const Icon = libraryIconFor(id);
                  const active = selectedLibraryView === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedLibraryView(id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-[background-color,color] duration-150",
                        active
                          ? "bg-blue-50 text-blue-700"
                          : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active ? "text-blue-600" : "text-zinc-500",
                        )}
                        strokeWidth={2}
                      />
                      <span className="truncate">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Tags
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTag("ALL")}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    selectedTag === "ALL"
                      ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                      : "border-zinc-200 bg-white text-zinc-700 transition-[background-color,border-color] duration-150 hover:border-zinc-300 hover:bg-zinc-100",
                  )}
                >
                  All
                </button>
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(tag)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      selectedTag === tag
                        ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                        : "border-zinc-200 bg-white text-zinc-700 transition-[background-color,border-color] duration-150 hover:border-zinc-300 hover:bg-zinc-100",
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Center: list + upload */}
          <section className="flex min-h-0 flex-col border-r border-zinc-200 bg-zinc-50/40 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[140px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search datasheets…"
                  className="h-9 rounded-lg border-zinc-200 bg-white pl-8 text-sm placeholder:text-zinc-400"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-zinc-500">
                  {selectedIds.length} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("h-8 gap-1.5 text-xs font-semibold", TOOLBAR_ACTION_CLASS)}
                  disabled={selectedIds.length === 0 || patchLoading}
                  onClick={handleArchiveAction}
                  title={
                    selectedLibraryView === "archive"
                      ? "Restore to Files"
                      : "Archive without removing from your library"
                  }
                >
                  {patchLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />
                  ) : (
                    <Archive className="h-3.5 w-3.5" />
                  )}
                  {selectedLibraryView === "archive" ? "Restore" : "Archive"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("h-8 gap-1.5 text-xs font-semibold", TOOLBAR_ACTION_CLASS)}
                  disabled={selectedIds.length === 0 || patchLoading}
                  onClick={handleFavoritesAction}
                  title={
                    allSelectedFavorited
                      ? "Remove from Favorites"
                      : "Add to Favorites"
                  }
                >
                  {patchLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />
                  ) : (
                    <Heart className="h-3.5 w-3.5" />
                  )}
                  {allSelectedFavorited ? "Unfavorite" : "Favorites"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("h-8 gap-1.5 text-xs font-semibold", TOOLBAR_DELETE_CLASS)}
                  disabled={selectedIds.length === 0}
                  onClick={handleDeleteSelected}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </div>

            <div className="mb-1 flex min-h-0 flex-1 flex-col rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
              <div
                className={cn(
                  ROW_GRID,
                  "border-b border-zinc-200 pb-2 text-xs font-semibold text-zinc-700",
                )}
              >
                <div className="flex justify-center">
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={toggleAllRows}
                    className={LIGHT_CHECKBOX_CLASS}
                  />
                </div>
                <span>File</span>
                <span>Size</span>
                <span>Uploaded</span>
                <span>Status</span>
              </div>

              <ScrollArea className="min-h-0 flex-1 pr-2">
                <div className="space-y-2 py-3">
                  {filteredDocs.length === 0 ? (
                    <p className="py-8 text-center text-sm text-zinc-500">
                      No datasheets in this folder.
                    </p>
                  ) : (
                    filteredDocs.map((doc) => (
                      <div
                        key={doc.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setActiveDocId(doc.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setActiveDocId(doc.id);
                          }
                        }}
                        className={cn(
                          ROW_GRID,
                          "cursor-pointer rounded-xl border px-2 py-2.5 text-sm transition-colors",
                          activeDoc?.id === doc.id
                            ? "border-blue-200 bg-blue-50/70"
                            : "border-zinc-200 bg-zinc-50/30 hover:border-zinc-300 hover:bg-white",
                        )}
                      >
                        <div
                          className="flex justify-center"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <Checkbox
                            checked={selectedSet.has(doc.id)}
                            onCheckedChange={() => toggleRow(doc.id)}
                            className={LIGHT_CHECKBOX_CLASS}
                          />
                        </div>
                        <div className="flex min-w-0 items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-zinc-400" />
                          <span className="truncate font-medium text-zinc-800">
                            {displayDocumentFilename(doc.filename)}
                          </span>
                        </div>
                        <span className="text-xs text-zinc-600">
                          {prettyBytes(doc.file_size)}
                        </span>
                        <span className="text-xs text-zinc-600">
                          {formatDate(doc.created_at)}
                        </span>
                        <div className="text-xs">
                          {renderStatus(doc.status, doc.chunk_count)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            <div className="mt-3 min-h-0 shrink-0">
              <UploadPdf
                autoIngest
                variant="sidebar"
                embedLight
                projectName={DEFAULT_DOCUMENT_PROJECT}
                tags={selectedTag === "ALL" ? [] : [selectedTag]}
                onUploadComplete={onRefetch}
              />
            </div>
          </section>

          {/* Right: detail */}
          <section className="flex min-h-0 flex-col bg-white px-4 py-4">
            <AnimatePresence mode="wait">
              {activeDoc ? (
                <motion.div
                  key={activeDoc.id}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.2 }}
                  className="flex h-full min-h-0 flex-col gap-3"
                >
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      RAG intelligence
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-snug text-zinc-900">
                      {displayDocumentFilename(activeDoc.filename)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      Extracted specs
                    </p>
                    <Table>
                      <TableBody>
                        <TableRow className="border-zinc-100 hover:bg-transparent">
                          <TableCell className="px-0 py-1.5 text-xs text-zinc-600">
                            I2C Address
                          </TableCell>
                          <TableCell className="px-0 py-1.5 text-right text-xs text-zinc-500">
                            {activeDoc.tags.find((tag) =>
                              tag.startsWith("i2c:"),
                            ) ?? "Not found"}
                          </TableCell>
                        </TableRow>
                        <TableRow className="border-zinc-100 hover:bg-transparent">
                          <TableCell className="px-0 py-1.5 text-xs text-zinc-600">
                            Operating Voltage
                          </TableCell>
                          <TableCell className="px-0 py-1.5 text-right text-xs text-zinc-500">
                            {activeDoc.operating_voltage ?? "Not found"}
                          </TableCell>
                        </TableRow>
                        <TableRow className="border-zinc-100 hover:bg-transparent">
                          <TableCell className="px-0 py-1.5 text-xs text-zinc-600">
                            Interface
                          </TableCell>
                          <TableCell className="px-0 py-1.5 text-right text-xs text-zinc-500">
                            {activeDoc.interface ?? "Not found"}
                          </TableCell>
                        </TableRow>
                        <TableRow className="border-zinc-100 hover:bg-transparent">
                          <TableCell className="px-0 py-1.5 text-xs text-zinc-600">
                            Power Consumption
                          </TableCell>
                          <TableCell className="px-0 py-1.5 text-right text-xs text-zinc-500">
                            {activeDoc.power_consumption ?? "Not found"}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      Chunk count
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900">
                      {activeDoc.chunk_count}
                    </p>
                  </div>

                  <div className="mt-auto grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Button
                      className="h-10 rounded-lg bg-blue-600 font-medium text-white shadow-sm hover:bg-blue-700"
                      onClick={() => handleViewPdf(activeDoc)}
                      disabled={pdfLoadingId === activeDoc.id}
                    >
                      {pdfLoadingId === activeDoc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      View PDF
                    </Button>
                    <Button
                      variant="outline"
                      className="h-10 rounded-lg border-zinc-200 bg-white font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
                      onClick={() => handleReindex(activeDoc)}
                      disabled={reindexingId === activeDoc.id}
                    >
                      {reindexingId === activeDoc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCcw className="h-4 w-4" />
                      )}
                      Re-index
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="empty-preview"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  className="flex h-full min-h-[200px] items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/30 px-4 text-center text-sm text-zinc-500"
                >
                  Select a file to inspect extracted intelligence.
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function renderStatus(status: string, chunkCount: number) {
  if (status === "completed" && chunkCount === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-blue-600">
        <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
        Building index…
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 text-zinc-600">
        <span className="h-2 w-2 rounded-full bg-zinc-400" />
        Queued
      </span>
    );
  }
  if (status === "processing") {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
        Indexing
      </span>
    );
  }
  if (status === "completed" && chunkCount > 0) {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Indexed
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-amber-600">
        <AlertTriangle className="h-3.5 w-3.5" />
        Extraction failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-zinc-500">
      Unknown
    </span>
  );
}
