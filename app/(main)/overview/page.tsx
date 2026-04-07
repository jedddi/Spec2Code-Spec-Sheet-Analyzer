"use client";

import { useCallback, useRef, useState } from "react";
import NavbarV2 from "@/src/components/v2/NavbarV2";
import UploadPdf from "@/src/components/UploadPdf";
import { useDocumentsContext } from "@/src/contexts/documents-context";
import { useSnippets } from "@/src/hooks/useSnippets";
import { useGenerateSnippet } from "@/src/hooks/useGenerateSnippet";
import type { SnippetFilterState } from "@/src/types/snippets";
import GenerateSnippetModal from "@/src/components/v2/snippet-vault/GenerateSnippetModal";
import SnippetCard from "@/src/components/v2/snippet-vault/SnippetCard";
import SnippetFilterBar from "@/src/components/v2/snippet-vault/SnippetFilterBar";
import ExportCenter from "@/src/components/v2/snippet-vault/ExportCenter";
import DatasheetManagerDialog from "@/src/components/v2/datasheet-manager/DatasheetManagerDialog";
import {
  Package,
  Zap,
  Terminal,
  TrendingUp,
  FileText,
  Filter,
  Brain,
  Upload,
  Trash2,
  Loader2,
  Sparkles,
  FolderOpen,
} from "lucide-react";

// ─── Category → color mapping ─────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  MCU: "bg-blue-100 text-blue-700",
  Sensor: "bg-green-100 text-green-700",
  Radio: "bg-orange-100 text-orange-700",
  Display: "bg-purple-100 text-purple-700",
  Power: "bg-yellow-100 text-yellow-700",
  Memory: "bg-cyan-100 text-cyan-700",
  Connector: "bg-rose-100 text-rose-700",
  Other: "bg-gray-100 text-gray-700",
};

function categoryClass(category: string | null): string {
  if (!category) return CATEGORY_COLORS.Other;
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.Other;
}

function stripUuidPrefix(raw: string): string {
  const re =
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(.+)$/i;
  const m = raw.match(re);
  return m ? m[2] : raw;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const DEFAULT_SNIPPET_FILTERS: SnippetFilterState = {
  dependency: "",
  interface: "ALL",
  targetHw: "ALL",
  minConfidence: 0,
};

export default function OverviewPage() {
  const { documents, loading, refetch, deleteDocument } =
    useDocumentsContext();
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[] | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showDatasheetManager, setShowDatasheetManager] = useState(false);
  const [showSnippetFilters, setShowSnippetFilters] = useState(false);
  const [preselectedSourcePdfId, setPreselectedSourcePdfId] = useState<string | null>(null);
  const [snippetFilters, setSnippetFilters] = useState<SnippetFilterState>(
    DEFAULT_SNIPPET_FILTERS,
  );

  // Global drag-and-drop overlay
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

  const snippets = useSnippets(snippetFilters);
  const snippetGenerator = useGenerateSnippet((createdSnippet) => {
    snippets.setSnippets((prev) => [createdSnippet, ...prev]);
  });

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (dragCounter.current === 1) setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setDroppedFiles(Array.from(e.dataTransfer.files));
    }
    setShowUpload(true);
  }, []);

  const readyDocs = documents.filter((d) => d.status === "ready");
  const totalChunks = readyDocs.reduce((acc, d) => acc + (d.chunk_count ?? 0), 0);

  function openGeneratorFor(sourcePdfId?: string) {
    setPreselectedSourcePdfId(sourcePdfId ?? null);
    setShowGenerateModal(true);
  }

  async function handleDelete(storagePath: string) {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    setDeletingPath(storagePath);
    try {
      await deleteDocument(storagePath);
    } catch {
      // Error already handled in context
    }
    setDeletingPath(null);
  }

  async function handleGenerateSnippet(payload: {
    sourcePdfId: string;
    language: "cpp" | "micropython";
    platform: "esp32" | "arduino";
    snippetName?: string;
  }) {
    const created = await snippetGenerator.generate(payload);
    if (created) {
      setShowGenerateModal(false);
    }
  }

  async function handleDeleteSnippet(snippetId: string) {
    const previous = snippets.snippets;
    snippets.setSnippets((current) => current.filter((item) => item.id !== snippetId));
    try {
      const res = await fetch(`/api/snippets/${snippetId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error((payload as { error?: string }).error ?? "Failed to delete snippet");
      }
    } catch (err) {
      snippets.setSnippets(previous);
      throw err;
    }
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative flex min-h-0 flex-1 flex-col"
    >
      <NavbarV2 />

      {/* Drag overlay */}
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-[24px] border-2 border-dashed border-[var(--v2-primary)] bg-[var(--v2-primary)]/5 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Upload className="h-12 w-12 text-[var(--v2-primary)]" />
            <p className="text-lg font-semibold text-[var(--v2-primary)]">
              Drop PDF datasheets here
            </p>
          </div>
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="relative w-full max-w-lg">
            <button
              type="button"
              onClick={() => {
                setShowUpload(false);
                setDroppedFiles(null);
              }}
              className="absolute -right-2 -top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#111] shadow-md hover:bg-gray-100"
            >
              &times;
            </button>
            <UploadPdf
              autoIngest
              initialFiles={droppedFiles}
              onUploadComplete={() => {
                refetch();
                setShowUpload(false);
                setDroppedFiles(null);
              }}
            />
          </div>
        </div>
      )}

      <GenerateSnippetModal
        open={showGenerateModal}
        documents={readyDocs}
        preselectedSourcePdfId={preselectedSourcePdfId}
        loading={snippetGenerator.loading}
        error={snippetGenerator.error}
        onClose={() => setShowGenerateModal(false)}
        onSubmit={handleGenerateSnippet}
      />
      <DatasheetManagerDialog
        open={showDatasheetManager}
        onOpenChange={setShowDatasheetManager}
        documents={documents}
        onDelete={async (storagePath) => {
          await handleDelete(storagePath);
        }}
        onRefetch={refetch}
      />

      {/* ── Page scroll wrapper ─────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-12">

        {/* ── Page header ─────────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-plus-jakarta)] text-3xl font-extrabold tracking-tight text-[#111]">
            Overview
          </h1>
          <p className="mt-1.5 text-sm text-[#4f5059]">
            {readyDocs.length > 0 ? (
              <>
                Synthetix is currently monitoring{" "}
                <strong className="text-[#111]">
                  {readyDocs.length} indexed datasheet{readyDocs.length !== 1 ? "s" : ""}
                </strong>{" "}
                with{" "}
                <strong className="text-[#111]">
                  {totalChunks.toLocaleString()} chunks
                </strong>{" "}
                indexed for RAG context.
              </>
            ) : (
              <>Upload datasheets to begin analyzing specs and generating code.</>
            )}
          </p>
        </div>

        {/* ── Main grid ───────────────────────────────────────────── */}
        <div className="flex flex-col gap-6">

          <section className="flex flex-col gap-6">

            {/* Quick Specs card */}
            <div className="rounded-2xl border border-black/[0.06] bg-white/70 backdrop-blur-sm p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--v2-primary)]/10">
                    <Package className="h-4 w-4 text-[var(--v2-primary)]" />
                  </div>
                  <h3 className="font-[family-name:var(--font-plus-jakarta)] text-lg font-bold text-[#111]">
                    Quick Specs
                  </h3>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold text-[#4f5059]">
                  {readyDocs.length} document{readyDocs.length !== 1 ? "s" : ""}
                </span>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--v2-primary)]" />
                </div>
              ) : readyDocs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Package className="mb-3 h-8 w-8 text-[#4f5059]/40" />
                  <p className="text-sm text-[#4f5059]">
                    No specs yet. Upload a datasheet to get started.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowUpload(true)}
                    className="mt-3 rounded-lg bg-[var(--v2-primary)] px-4 py-2 text-sm font-bold text-white shadow-md shadow-[var(--v2-primary)]/20 hover:bg-[#0278e0]"
                  >
                    Upload Datasheet
                  </button>
                </div>
              ) : (
                <div className="max-h-[236px] overflow-y-auto rounded-xl border border-black/[0.05] relative custom-scrollbar">
                  <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 bg-gray-50/95 backdrop-blur z-10 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                      <tr className="bg-gray-50/80">
                        {["Module Name", "Operating Voltage", "Interface", "Power Cons.", "Actions"].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#4f5059]"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04]">
                      {readyDocs.map((doc) => (
                        <tr
                          key={doc.id}
                          className="transition-colors hover:bg-[var(--v2-primary)]/[0.03]"
                        >
                          <td className="px-4 py-3.5 font-semibold text-[#111]">
                            {stripUuidPrefix(doc.filename)}
                          </td>
                          <td className="px-4 py-3.5 text-[#4f5059]">
                            {doc.operating_voltage ?? "Not Specified"}
                          </td>
                          <td className="px-4 py-3.5 text-[#4f5059]">
                            {doc.interface ?? "Not Specified"}
                          </td>
                          <td className="px-4 py-3.5 text-[#4f5059]">
                            {doc.power_consumption ?? "Not Specified"}
                          </td>
                          <td className="px-4 py-3.5">
                            <button
                              type="button"
                              onClick={() => openGeneratorFor(doc.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-black/[0.08] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#111] hover:bg-gray-50"
                            >
                              <Sparkles className="h-3.5 w-3.5 text-[var(--v2-primary)]" />
                              Generate
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Two-col sub-row: Datasheets + AI Performance */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

              {/* Uploaded Datasheets */}
              <div className="flex h-full flex-col rounded-2xl border border-black/[0.06] bg-white/70 backdrop-blur-sm p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#4f5059]">
                    Uploaded Datasheets
                  </h4>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowDatasheetManager(true)}
                      title="Manage library"
                      className="inline-flex items-center gap-1 rounded-md border border-black/[0.08] bg-white px-2 py-1 text-[10px] font-semibold text-[#111] transition-colors hover:bg-gray-50"
                    >
                      <FolderOpen className="h-3.5 w-3.5 text-[var(--v2-primary)]" />
                      Manage Library
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowUpload(true)}
                      title="Upload datasheet"
                      className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--v2-primary)] transition-colors hover:bg-[var(--v2-primary)]/10"
                    >
                      <Upload className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                  {loading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-4 w-4 animate-spin text-[var(--v2-primary)]" />
                    </div>
                  ) : documents.length === 0 ? (
                    <p className="py-4 text-center text-xs text-[#4f5059]">
                      No datasheets uploaded yet.
                    </p>
                  ) : (
                    documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="group flex items-center gap-3 rounded-xl bg-gray-50/80 px-3 py-2.5 transition-colors hover:bg-gray-100/70"
                      >
                        <FileText className="h-5 w-5 shrink-0 text-red-500" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[#111]">
                            {stripUuidPrefix(doc.filename)}
                          </p>
                          <p className="text-[10px] text-[#4f5059]">
                            {doc.chunk_count} chunks &bull; Added{" "}
                            {relativeTime(doc.created_at)}
                          </p>
                        </div>
                        {doc.category && (
                          <span
                            className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase ${categoryClass(doc.category)}`}
                          >
                            {doc.category}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(doc.storage_path)}
                          disabled={deletingPath === doc.storage_path}
                          title="Delete document"
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#4f5059]/50 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-100 hover:text-red-600"
                        >
                          {deletingPath === doc.storage_path ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* ════════════ AI PERFORMANCE ════════════ */}
              <div className="flex h-full flex-col rounded-2xl border border-black/[0.06] bg-white/70 backdrop-blur-sm p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--v2-primary)]/10">
                  <Zap className="h-4 w-4 text-[var(--v2-primary)]" />
                </div>
                <h3 className="font-[family-name:var(--font-plus-jakarta)] text-lg font-bold text-[#111]">
                  AI Performance
                </h3>
              </div>

              <div className="space-y-6">

                {/* Token usage stat */}
                <div className="rounded-xl border-l-4 border-[var(--v2-primary)] bg-[var(--v2-primary)]/[0.04] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#4f5059]">
                    Total Indexed Chunks
                  </p>
                  <h4 className="mt-1 font-[family-name:var(--font-plus-jakarta)] text-3xl font-black text-[#111]">
                    {totalChunks.toLocaleString()}
                  </h4>
                  <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-green-600">
                    <TrendingUp className="h-3.5 w-3.5" />
                    {readyDocs.length} document{readyDocs.length !== 1 ? "s" : ""} indexed
                  </p>
                </div>

                {/* RAG health bar */}
                <div>
                  <div className="mb-2 flex items-end justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#4f5059]">
                      RAG Context Health
                    </p>
                    <span className="text-xs font-bold text-[var(--v2-primary)]">
                      {readyDocs.length > 0 ? "Active" : "Idle"}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-[var(--v2-primary)] transition-all duration-700"
                      style={{
                        width: readyDocs.length > 0 ? "100%" : "0%",
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-[#4f5059]">
                    {readyDocs.length > 0
                      ? `Indexing ${totalChunks.toLocaleString()} vectors across ${readyDocs.length} document${readyDocs.length !== 1 ? "s" : ""}.`
                      : "No documents indexed yet."}
                  </p>
                </div>

                {/* Category breakdown */}
                {readyDocs.length > 0 && (
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#4f5059]">
                      Category Breakdown
                    </p>
                    {Array.from(
                      readyDocs.reduce((map, d) => {
                        const cat = d.category ?? "Other";
                        map.set(cat, (map.get(cat) ?? 0) + 1);
                        return map;
                      }, new Map<string, number>()),
                    ).map(([cat, count]) => (
                      <div
                        key={cat}
                        className="flex items-center justify-between border-b border-black/[0.05] py-2 text-sm"
                      >
                        <span className="font-medium text-[#111]">{cat}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${categoryClass(cat)}`}
                        >
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            </div>
          </section>

          {/* ════════════ CODE SNIPPET VAULT (full width) ════════════ */}
          <section className="col-span-12">
            <div className="rounded-2xl border border-black/[0.06] bg-white/70 backdrop-blur-sm p-6 shadow-sm">

              {/* Section header */}
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111]">
                    <Terminal className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-[family-name:var(--font-plus-jakarta)] text-xl font-bold text-[#111]">
                      Integrated Code Snippet Vault
                    </h3>
                    <p className="text-sm text-[#4f5059]">Recently synthesized firmware modules</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSnippetFilters((prev) => !prev)}
                    className="flex items-center gap-2 rounded-lg border border-black/[0.08] bg-gray-50 px-4 py-2 text-sm font-semibold text-[#111] transition-colors hover:bg-gray-100"
                  >
                    <Filter className="h-4 w-4" />
                    Filter
                  </button>
                  <button
                    type="button"
                    onClick={() => openGeneratorFor()}
                    className="flex items-center gap-2 rounded-lg bg-[var(--v2-primary)] px-4 py-2 text-sm font-bold text-white shadow-md shadow-[var(--v2-primary)]/20 transition-colors hover:bg-[#0278e0]"
                  >
                    <Sparkles className="h-4 w-4" />
                    Generate Snippet
                  </button>
                </div>
              </div>

              {showSnippetFilters ? (
                <SnippetFilterBar value={snippetFilters} onChange={setSnippetFilters} />
              ) : null}

              <div className="mb-5">
                <ExportCenter snippets={snippets.snippets} />
              </div>

              {/* Code blocks grid */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {snippets.loading ? (
                  <div className="col-span-full flex items-center justify-center rounded-xl border border-black/[0.06] bg-white p-10">
                    <Loader2 className="h-5 w-5 animate-spin text-[var(--v2-primary)]" />
                  </div>
                ) : snippets.snippets.length === 0 ? (
                  <div className="col-span-full rounded-xl border border-black/[0.06] bg-white p-8 text-center text-sm text-[#4f5059]">
                    No snippets yet. Generate your first snippet from Quick Specs.
                  </div>
                ) : (
                  snippets.snippets.map((snippet) => (
                    <SnippetCard
                      key={snippet.id}
                      snippet={snippet}
                      onDelete={handleDeleteSnippet}
                    />
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ── FAB ────────────────────────────────────────────────────── */}
      <div className="fixed bottom-8 right-8 z-50">
        <button
          type="button"
          onClick={() => openGeneratorFor()}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--v2-primary)] text-white shadow-2xl shadow-[var(--v2-primary)]/40 transition-transform hover:scale-105 active:scale-95"
        >
          <Brain className="h-7 w-7" />
        </button>
      </div>
    </div>
  );
}
