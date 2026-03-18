"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, BookMarked, Plus, Check, ChevronDown } from "lucide-react";
import type { Document, ReadingSession, Shelf } from "@/types";

interface DocumentWithSession extends Document {
  latestSession: (ReadingSession & { totalChunks: number }) | null;
}

type Filter = "all" | "unshelved" | string; // string = shelfId

const EMOJI_OPTIONS = ["📚", "🎓", "🔬", "📝", "💼", "🧠", "📖", "🗂️", "⭐", "🔖"];

export default function DashboardPage() {
  const [documents, setDocuments] = useState<DocumentWithSession[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [docsRes, shelvesRes] = await Promise.all([
          fetch("/api/documents"),
          fetch("/api/shelves"),
        ]);
        if (!docsRes.ok) throw new Error("Failed to fetch documents");
        setDocuments(await docsRes.json());
        if (shelvesRes.ok) setShelves(await shelvesRes.json());
      } catch (err) {
        console.error(err);
        setError("Failed to load your library. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function handleDocumentDeleted(id: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  function handleShelfAssigned(docId: string, shelfId: string | null) {
    setDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, shelfId } : d))
    );
  }

  function handleShelfCreated(shelf: Shelf) {
    setShelves((prev) => [...prev, shelf]);
  }

  function handleShelfDeleted(id: string) {
    setShelves((prev) => prev.filter((s) => s.id !== id));
    setDocuments((prev) =>
      prev.map((d) => (d.shelfId === id ? { ...d, shelfId: null } : d))
    );
    if (filter === id) setFilter("all");
  }

  const filtered =
    filter === "all"
      ? documents
      : filter === "unshelved"
        ? documents.filter((d) => !d.shelfId)
        : documents.filter((d) => d.shelfId === filter);

  const unshelvedCount = documents.filter((d) => !d.shelfId).length;

  return (
    <div className="flex min-h-[calc(100vh-56px)]">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="w-56 shrink-0 border-r p-4 space-y-1 hidden sm:block">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-3">
          Library
        </p>

        <FilterButton
          active={filter === "all"}
          onClick={() => setFilter("all")}
          emoji="📋"
          label="All Readings"
          count={documents.length}
        />

        {unshelvedCount > 0 && (
          <FilterButton
            active={filter === "unshelved"}
            onClick={() => setFilter("unshelved")}
            emoji="📄"
            label="Unshelved"
            count={unshelvedCount}
          />
        )}

        {shelves.length > 0 && (
          <div className="pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
              Shelves
            </p>
            {shelves.map((shelf) => (
              <ShelfButton
                key={shelf.id}
                shelf={shelf}
                active={filter === shelf.id}
                count={documents.filter((d) => d.shelfId === shelf.id).length}
                onClick={() => setFilter(shelf.id)}
                onDelete={() => handleShelfDeleted(shelf.id)}
              />
            ))}
          </div>
        )}

        <div className="pt-2">
          <CreateShelfForm onCreated={handleShelfCreated} />
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="flex-1 px-4 sm:px-6 py-6 sm:py-8 max-w-3xl">
        {/* Mobile filter row */}
        <div className="flex gap-2 overflow-x-auto pb-2 sm:hidden mb-6">
          {[
            { id: "all" as Filter, label: "All", emoji: "📋" },
            ...(unshelvedCount > 0
              ? [{ id: "unshelved" as Filter, label: "Unshelved", emoji: "📄" }]
              : []),
            ...shelves.map((s) => ({ id: s.id, label: s.name, emoji: s.emoji })),
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                filter === f.id
                  ? "bg-primary text-primary-foreground"
                  : "border hover:bg-muted"
              }`}
            >
              <span>{f.emoji}</span>
              <span>{f.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">
            {filter === "all"
              ? "Your Library"
              : filter === "unshelved"
                ? "Unshelved"
                : (shelves.find((s) => s.id === filter)?.emoji ?? "") +
                  " " +
                  (shelves.find((s) => s.id === filter)?.name ?? "")}
          </h1>
          <Link
            href="/upload"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="w-3.5 h-3.5" />
            New Read
          </Link>
        </div>

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border bg-card p-5"
              >
                <div className="h-5 bg-muted rounded w-2/3 mb-3" />
                <div className="h-4 bg-muted rounded w-1/3" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
            {filter === "all" ? (
              <>
                <p className="mb-4">
                  No documents yet. Upload a PDF or paste text to get started.
                </p>
                <Link
                  href="/upload"
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  + New Read
                </Link>
              </>
            ) : (
              <p>No readings on this shelf yet.</p>
            )}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                shelves={shelves}
                onDeleted={() => handleDocumentDeleted(doc.id)}
                onShelfAssigned={(shelfId) =>
                  handleShelfAssigned(doc.id, shelfId)
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sidebar filter button ─────────────────────────────────────────────────

function FilterButton({
  active,
  onClick,
  emoji,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  emoji: string;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      <span className="flex items-center gap-2">
        <span>{emoji}</span>
        <span className="truncate">{label}</span>
      </span>
      <span className="text-xs opacity-60">{count}</span>
    </button>
  );
}

// ─── Shelf button (with delete) ────────────────────────────────────────────

function ShelfButton({
  shelf,
  active,
  count,
  onClick,
  onDelete,
}: {
  shelf: Shelf;
  active: boolean;
  count: number;
  onClick: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      return;
    }
    await fetch(`/api/shelves/${shelf.id}`, { method: "DELETE" });
    onDelete();
  }

  return (
    <button
      onClick={onClick}
      onMouseLeave={() => setConfirming(false)}
      className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors group ${
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      <span className="flex items-center gap-2 truncate">
        <span>{shelf.emoji}</span>
        <span className="truncate">{shelf.name}</span>
      </span>
      <span className="flex items-center gap-1 shrink-0">
        <span className="text-xs opacity-60">{count}</span>
        <span
          role="button"
          onClick={handleDelete}
          className={`inline-flex items-center justify-center w-5 h-5 rounded transition-colors opacity-0 group-hover:opacity-100 ${
            confirming
              ? "text-destructive opacity-100"
              : "text-muted-foreground hover:text-destructive"
          }`}
          title={confirming ? "Click again to delete" : "Delete shelf"}
        >
          <Trash2 className="w-3 h-3" />
        </span>
      </span>
    </button>
  );
}

// ─── Create shelf form ─────────────────────────────────────────────────────

function CreateShelfForm({ onCreated }: { onCreated: (shelf: Shelf) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📚");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/shelves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), emoji }),
      });
      if (!res.ok) throw new Error();
      const shelf = await res.json();
      onCreated(shelf);
      setName("");
      setEmoji("📚");
      setOpen(false);
    } catch {
      // silent — keep form open
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        New Shelf
      </button>
    );
  }

  return (
    <div className="space-y-2 px-1">
      <div className="flex gap-1">
        {EMOJI_OPTIONS.map((e) => (
          <button
            key={e}
            onClick={() => setEmoji(e)}
            className={`text-sm rounded p-0.5 transition-colors ${
              emoji === e ? "bg-primary/20" : "hover:bg-muted"
            }`}
          >
            {e}
          </button>
        ))}
      </div>
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleCreate();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Shelf name..."
        className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <div className="flex gap-1">
        <button
          onClick={handleCreate}
          disabled={!name.trim() || saving}
          className="flex-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50 transition-colors hover:bg-primary/90"
        >
          {saving ? "..." : "Create"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-md border px-2.5 py-1.5 text-xs transition-colors hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Document card ─────────────────────────────────────────────────────────

function DocumentCard({
  doc,
  shelves,
  onDeleted,
  onShelfAssigned,
}: {
  doc: DocumentWithSession;
  shelves: Shelf[];
  onDeleted: () => void;
  onShelfAssigned: (shelfId: string | null) => void;
}) {
  const router = useRouter();
  const session = doc.latestSession;
  const [deleteState, setDeleteState] = useState<"idle" | "confirm" | "deleting">("idle");
  const [shelfOpen, setShelfOpen] = useState(false);
  const shelfRef = useRef<HTMLDivElement>(null);

  const currentShelf = shelves.find((s) => s.id === doc.shelfId);

  // Close shelf dropdown on outside click
  useEffect(() => {
    if (!shelfOpen) return;
    function handler(e: MouseEvent) {
      if (shelfRef.current && !shelfRef.current.contains(e.target as Node)) {
        setShelfOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [shelfOpen]);

  function handleCardClick() {
    if (!session) {
      router.push(`/upload?documentId=${doc.id}`);
      return;
    }
    if (session.status === "completed") {
      router.push(`/read/${session.id}/export`);
      return;
    }
    if (session.totalChunks > 0) {
      router.push(`/read/${session.id}`);
    } else {
      router.push(`/read/${session.id}/map`);
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (deleteState === "idle") {
      setDeleteState("confirm");
      return;
    }
    setDeleteState("deleting");
    await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    onDeleted();
  }

  async function handleAssignShelf(shelfId: string | null) {
    setShelfOpen(false);
    await fetch(`/api/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shelfId }),
    });
    onShelfAssigned(shelfId);
  }

  return (
    <div
      className="group rounded-xl border bg-card transition-colors hover:border-primary/30"
      onMouseLeave={() => setDeleteState("idle")}
    >
      <div className="flex items-center">
        {/* Clickable reading area */}
        <button
          onClick={handleCardClick}
          aria-label={`Open ${doc.title}`}
          className="flex-1 text-left p-4 sm:p-5 min-w-0"
        >
          <div className="flex items-start gap-2">
            <span className="text-sm mt-0.5 shrink-0">
              {doc.sourceType === "pdf" ? "📄" : doc.sourceType === "url" ? "🔗" : "📝"}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold truncate">{doc.title}</h2>

              {session ? (
                <SessionStatus session={session} />
              ) : (
                <p className="text-sm text-muted-foreground mt-0.5">
                  No session yet ·{" "}
                  <span className="text-primary">Start Reading</span>
                </p>
              )}

              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-muted-foreground">
                  {doc.wordCount.toLocaleString()} words
                </span>
                {currentShelf && (
                  <span className="text-xs text-muted-foreground">
                    · {currentShelf.emoji} {currentShelf.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </button>

        {/* Action buttons — always visible on mobile, hover-only on desktop */}
        <div className="flex items-center gap-1.5 px-2 sm:px-3 sm:opacity-0 sm:group-hover:opacity-100 sm:transition-opacity shrink-0">
          {/* Shelf picker */}
          <div className="relative" ref={shelfRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShelfOpen((o) => !o);
              }}
              className="flex items-center gap-1 rounded-md border px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Assign to shelf"
            >
              <BookMarked className="w-3.5 h-3.5" />
              <ChevronDown className="w-3 h-3" />
            </button>

            {shelfOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 w-44 max-w-[calc(100vw-2rem)] rounded-lg border bg-card shadow-lg py-1 text-sm">
                <button
                  onClick={() => handleAssignShelf(null)}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-muted transition-colors text-left"
                >
                  <span className="text-muted-foreground">No shelf</span>
                  {!doc.shelfId && <Check className="w-3.5 h-3.5 text-primary" />}
                </button>
                {shelves.length > 0 && (
                  <div className="border-t my-1" />
                )}
                {shelves.map((shelf) => (
                  <button
                    key={shelf.id}
                    onClick={() => handleAssignShelf(shelf.id)}
                    className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-muted transition-colors text-left"
                  >
                    <span>
                      {shelf.emoji} {shelf.name}
                    </span>
                    {doc.shelfId === shelf.id && (
                      <Check className="w-3.5 h-3.5 text-primary" />
                    )}
                  </button>
                ))}
                {shelves.length === 0 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    No shelves yet — create one in the sidebar.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Delete */}
          <button
            onClick={handleDelete}
            disabled={deleteState === "deleting"}
            className={`flex items-center gap-1 rounded-md border px-2.5 py-2 text-xs transition-colors ${
              deleteState === "confirm"
                ? "border-destructive/50 bg-destructive/10 text-destructive"
                : "text-muted-foreground hover:border-destructive/40 hover:text-destructive"
            }`}
            title={deleteState === "confirm" ? "Click again to confirm" : "Delete"}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleteState === "confirm" && <span className="hidden sm:inline">Sure?</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Session status ────────────────────────────────────────────────────────

function SessionStatus({
  session,
}: {
  session: ReadingSession & { totalChunks: number };
}) {
  if (session.status === "completed") {
    return (
      <p className="text-sm text-muted-foreground mt-0.5">
        Complete · <span className="text-primary">View Export</span>
      </p>
    );
  }

  const chunkProgress =
    session.totalChunks > 0
      ? `Chunk ${session.currentChunkIdx + 1} of ${session.totalChunks}`
      : "Getting started";

  return (
    <p className="text-sm text-muted-foreground mt-0.5">
      {chunkProgress} · <span className="text-primary">Resume</span>
    </p>
  );
}
