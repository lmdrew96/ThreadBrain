"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Markdown from "react-markdown";

export default function ExportPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
      } catch (err) {
        console.error(err);
        setError("Failed to generate your reading export. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    generateExport();
  }, [sessionId]);

  async function handleCopy() {
    if (!summary) return;
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    if (!summary) return;
    const blob = new Blob([summary], { type: "text/markdown" });
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
                .then((data) => setSummary(data.summaryMd))
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
        </div>
      )}
    </div>
  );
}
