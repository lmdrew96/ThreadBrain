"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Chunk } from "@/types";

export default function ReadingPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSession() {
      try {
        // Load session to get currentChunkIdx
        const sessionRes = await fetch(`/api/sessions/${sessionId}`);
        if (!sessionRes.ok) throw new Error("Session not found");
        const session = await sessionRes.json();
        setCurrentIdx(session.currentChunkIdx);

        // Load chunks
        const chunksRes = await fetch(`/api/sessions/${sessionId}/chunks`);
        if (!chunksRes.ok) throw new Error("Chunks not found");
        const data = await chunksRes.json();

        if (data.length === 0) {
          // No chunks yet — redirect to map to generate them
          router.push(`/read/${sessionId}/map`);
          return;
        }

        setChunks(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, [sessionId, router]);

  const saveProgress = useCallback(
    async (idx: number) => {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentChunkIdx: idx }),
      });
    },
    [sessionId]
  );

  async function goNext() {
    if (currentIdx < chunks.length - 1) {
      const nextIdx = currentIdx + 1;
      setCurrentIdx(nextIdx);
      await saveProgress(nextIdx);
    } else {
      // Complete the session
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          completedAt: new Date().toISOString(),
          currentChunkIdx: currentIdx,
        }),
      });
      router.push(`/read/${sessionId}/export`);
    }
  }

  async function goPrev() {
    if (currentIdx > 0) {
      const prevIdx = currentIdx - 1;
      setCurrentIdx(prevIdx);
      await saveProgress(prevIdx);
    }
  }

  if (loading) {
    return (
      <div className="px-6 py-8 max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-6 bg-muted rounded w-2/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (chunks.length === 0) return null;

  const chunk = chunks[currentIdx];
  const progress = ((currentIdx + 1) / chunks.length) * 100;

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Library
        </button>
        <span className="text-sm text-muted-foreground">
          Chunk {currentIdx + 1} of {chunks.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted rounded-full mb-8 overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Micro-header */}
      <p className="text-sm font-medium text-primary mb-4">
        {chunk.microHeader}
      </p>

      {/* Chunk content with highlights */}
      <div className="rounded-xl border bg-card p-6 mb-6">
        <div className="reading-content text-card-foreground">
          <HighlightedContent
            content={chunk.content}
            highlights={chunk.highlights}
          />
        </div>
      </div>

      {/* Highlight reasons */}
      {chunk.highlights.length > 0 && (
        <div className="space-y-2 mb-8">
          {chunk.highlights.map((h, i) => (
            <div
              key={i}
              className="flex gap-3 text-sm text-muted-foreground"
            >
              <span className="shrink-0 text-accent">&#9679;</span>
              <span>
                &ldquo;{h.text}&rdquo; &mdash; {h.reason}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={goPrev}
          disabled={currentIdx === 0}
          className="flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
        >
          &larr; Previous
        </button>
        <button
          onClick={goNext}
          className="flex-1 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {currentIdx === chunks.length - 1 ? "Finish & Export" : "Next \u2192"}
        </button>
      </div>
    </div>
  );
}

function HighlightedContent({
  content,
  highlights,
}: {
  content: string;
  highlights: Array<{ text: string; reason: string }>;
}) {
  if (!highlights || highlights.length === 0) {
    return <>{content}</>;
  }

  // Build a highlighted version of the content
  let result = content;
  const parts: Array<{ text: string; highlighted: boolean }> = [];

  // Sort highlights by their position in the content (longest first to avoid partial matches)
  const sortedHighlights = [...highlights].sort(
    (a, b) => b.text.length - a.text.length
  );

  // Create a set of ranges to highlight
  const ranges: Array<[number, number]> = [];
  for (const h of sortedHighlights) {
    const idx = result.indexOf(h.text);
    if (idx !== -1) {
      ranges.push([idx, idx + h.text.length]);
    }
  }

  // Sort ranges by start position
  ranges.sort((a, b) => a[0] - b[0]);

  // Build parts
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start < cursor) continue; // Skip overlapping ranges
    if (start > cursor) {
      parts.push({ text: result.slice(cursor, start), highlighted: false });
    }
    parts.push({ text: result.slice(start, end), highlighted: true });
    cursor = end;
  }
  if (cursor < result.length) {
    parts.push({ text: result.slice(cursor), highlighted: false });
  }

  return (
    <>
      {parts.map((part, i) =>
        part.highlighted ? (
          <mark key={i} className="highlight">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  );
}
