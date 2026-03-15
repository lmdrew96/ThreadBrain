"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Chunk } from "@/types";

// Allow <mark> tags through sanitizer for highlights
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), "mark"],
  attributes: {
    ...defaultSchema.attributes,
    mark: ["className"],
  },
};

export default function ReadingPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const streamStarted = useRef(false);

  // Prevent hydration mismatch by waiting for client-side render
  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    async function loadOrGenerateChunks() {
      try {
        // Load session to get currentChunkIdx
        const sessionRes = await fetch(`/api/sessions/${sessionId}`);
        if (!sessionRes.ok) throw new Error("Session not found");
        const session = await sessionRes.json();
        setCurrentIdx(session.currentChunkIdx);

        // Try loading existing chunks
        const chunksRes = await fetch(`/api/sessions/${sessionId}/chunks`);
        if (!chunksRes.ok) throw new Error("Chunks not found");
        const existing = await chunksRes.json();

        if (existing.length > 0) {
          setChunks(existing);
          setLoading(false);
          return;
        }

        // No chunks — start streaming generation
        if (streamStarted.current) return;
        streamStarted.current = true;
        setIsStreaming(true);
        setLoading(false);

        const res = await fetch("/api/ai/chunk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        if (!res.ok || !res.body) {
          setStreamError("Failed to start chunk generation.");
          setIsStreaming(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop()!;

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const msg = JSON.parse(line);

              if (msg.type === "chunk") {
                setChunks((prev) => [...prev, msg.chunk]);
              } else if (msg.type === "done") {
                setIsStreaming(false);
              } else if (msg.type === "error") {
                setStreamError(msg.message);
                setIsStreaming(false);
              }
            } catch {
              console.error("Failed to parse stream message:", line);
            }
          }
        }

        setIsStreaming(false);
      } catch (err) {
        console.error(err);
        setStreamError("Something went wrong loading your reading session.");
        setLoading(false);
      }
    }

    loadOrGenerateChunks();
  }, [sessionId]);

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
    } else if (!isStreaming) {
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

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture if user is in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Loading skeleton
  if (!hydrated || loading) {
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

  // Waiting for first chunk to arrive
  if (chunks.length === 0 && isStreaming) {
    return (
      <div className="px-6 py-8 max-w-2xl mx-auto">
        <div className="rounded-xl border bg-card p-8 text-center">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4 mx-auto" />
            <div className="h-4 bg-muted rounded w-5/6 mx-auto" />
            <div className="h-4 bg-muted rounded w-2/3 mx-auto" />
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Preparing your first chunk...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (streamError && chunks.length === 0) {
    return (
      <div className="px-6 py-8 max-w-2xl mx-auto">
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive mb-4">{streamError}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (chunks.length === 0) return null;

  const chunk = chunks[currentIdx];
  const totalDisplay = isStreaming ? `~${chunks.length}+` : `${chunks.length}`;
  const progress = ((currentIdx + 1) / chunks.length) * 100;

  const isOnLastAvailable = currentIdx === chunks.length - 1;
  const isWaitingForNext = isOnLastAvailable && isStreaming;
  const isSessionEnd = isOnLastAvailable && !isStreaming;

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => router.push("/dashboard")}
          aria-label="Back to library"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Library
        </button>
        <span className="text-sm text-muted-foreground">
          Chunk {currentIdx + 1} of {totalDisplay}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted rounded-full mb-8 overflow-hidden" role="progressbar" aria-valuenow={currentIdx + 1} aria-valuemin={1} aria-valuemax={chunks.length} aria-label={`Reading progress: chunk ${currentIdx + 1} of ${chunks.length}`}>
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Micro-header */}
      <p className="text-sm font-medium text-primary mb-4">
        {chunk.microHeader}
      </p>

      {/* Chunk content with markdown + highlights */}
      <div className="rounded-xl border bg-card p-6 mb-6">
        <div className="reading-content prose prose-invert prose-lg max-w-none">
          <Markdown
            rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
          >
            {injectHighlightMarks(chunk.content, chunk.highlights)}
          </Markdown>
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

      {/* Streaming indicator */}
      {isStreaming && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
          Generating more chunks...
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={goPrev}
          disabled={currentIdx === 0}
          aria-label="Previous chunk"
          className="flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
        >
          &larr; Previous
        </button>
        <button
          onClick={goNext}
          disabled={isWaitingForNext}
          aria-label={isSessionEnd ? "Finish reading and export" : "Next chunk"}
          className="flex-1 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isWaitingForNext
            ? "Next chunk generating..."
            : isSessionEnd
              ? "Finish & Export"
              : "Next \u2192"}
        </button>
      </div>
    </div>
  );
}

/** Inject <mark> tags into content string for highlighted phrases. */
function injectHighlightMarks(
  content: string,
  highlights: Array<{ text: string; reason: string }>
): string {
  if (!highlights || highlights.length === 0) return content;

  let result = content;

  // Sort by length descending to match longest phrases first, avoiding partial matches
  const sorted = [...highlights].sort((a, b) => b.text.length - a.text.length);

  for (const h of sorted) {
    // Escape regex special chars in the highlight text
    const escaped = h.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Replace first occurrence only
    result = result.replace(
      new RegExp(escaped),
      `<mark class="highlight">${h.text}</mark>`
    );
  }

  return result;
}
