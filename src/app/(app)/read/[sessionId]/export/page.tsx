"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Markdown from "react-markdown";
import { Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { KeyQuote } from "@/types";

export default function ExportPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [summary, setSummary] = useState<string | null>(null);
  const [keyQuotes, setKeyQuotes] = useState<KeyQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savingToJournal, setSavingToJournal] = useState(false);

  useEffect(() => {
    async function generateExport() {
      try {
        const res = await fetch("/api/ai/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        if (!res.ok) throw new Error("Export failed");

        const data = await res.json();
        setSummary(data.summaryMd);
        if (data.keyQuotes?.length > 0) setKeyQuotes(data.keyQuotes);
      } catch (err) {
        console.error(err);
        setError("Failed to generate your reading export. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    generateExport();
  }, [sessionId]);

  function buildFullExport(): string {
    let text = summary ?? "";
    if (keyQuotes.length > 0) {
      text += "\n\n## Key Quotes\n\n";
      text += keyQuotes
        .map((q) => `> "${q.quote}"\n> — *${q.chunkRef}*\n>\n> ${q.context}`)
        .join("\n\n");
    }
    return text;
  }

  async function handleCopy() {
    if (!summary) return;
    await navigator.clipboard.writeText(buildFullExport());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSaveToJournal() {
    setSavingToJournal(true);
    try {
      const res = await fetch("/api/journal/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(
        data.failed > 0
          ? `Saved ${data.saved} of ${data.total} excerpts to ThreadNotes`
          : `${data.saved} excerpt${data.saved !== 1 ? "s" : ""} saved to ThreadNotes ✓`
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save — try again", "error");
    } finally {
      setSavingToJournal(false);
    }
  }

  function handleDownload() {
    if (!summary) return;
    const blob = new Blob([buildFullExport()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "threadbrain-export.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-2xl mx-auto">
      <p className="text-sm text-muted-foreground mb-2">Session Complete</p>
      <h1 className="text-2xl font-bold mb-8">Your Reading Export</h1>

      {loading && (
        <div className="rounded-xl border bg-card p-8 text-center">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4 mx-auto" />
            <div className="h-4 bg-muted rounded w-full mx-auto" />
            <div className="h-4 bg-muted rounded w-5/6 mx-auto" />
            <div className="h-4 bg-muted rounded w-2/3 mx-auto" />
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Generating your summary...
          </p>
        </div>
      )}

      {error && !summary && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              fetch("/api/ai/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId }),
              })
                .then((res) => {
                  if (!res.ok) throw new Error("Export failed");
                  return res.json();
                })
                .then((data) => {
                  setSummary(data.summaryMd);
                  if (data.keyQuotes?.length > 0) setKeyQuotes(data.keyQuotes);
                })
                .catch((err) => {
                  console.error(err);
                  setError(
                    "Failed to generate your reading export. Please try again."
                  );
                })
                .finally(() => setLoading(false));
            }}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            Try Again
          </button>
        </div>
      )}

      {summary && (
        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-6 prose prose-invert prose-sm max-w-none">
            <Markdown>{summary}</Markdown>
          </div>

          {keyQuotes.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Key Quotes
              </h2>
              {keyQuotes.map((q, i) => (
                <div
                  key={i}
                  className="rounded-xl border bg-card p-4 border-l-4 border-l-primary/40 group/quote"
                >
                  <p className="text-sm italic leading-relaxed mb-2">
                    &ldquo;{q.quote}&rdquo;
                  </p>
                  <p className="text-xs text-muted-foreground mb-1">
                    {q.context}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground/60">
                      — {q.chunkRef}
                    </span>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(`"${q.quote}"`);
                        toast("Quote copied");
                      }}
                      title="Copy quote"
                      className="md:opacity-0 md:group-hover/quote:opacity-100 transition-opacity p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleCopy}
              className="flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              {copied ? "Copied!" : "Copy Markdown"}
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              Download .md
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="flex-1 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Back to Library
            </button>
          </div>

          <button
            onClick={handleSaveToJournal}
            disabled={savingToJournal}
            className="w-full rounded-lg border px-4 py-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span>🔖</span>
            {savingToJournal ? "Saving to ThreadNotes..." : "Save all to ThreadNotes"}
          </button>
        </div>
      )}
    </div>
  );
}
