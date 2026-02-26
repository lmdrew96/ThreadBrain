"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Document, ReadingSession } from "@/types";

interface DocumentWithSession extends Document {
  latestSession:
    | (ReadingSession & { totalChunks: number })
    | null;
}

export default function DashboardPage() {
  const [documents, setDocuments] = useState<DocumentWithSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/documents");
        if (res.ok) {
          setDocuments(await res.json());
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="px-6 py-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Your Library</h1>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border bg-card p-5">
              <div className="h-5 bg-muted rounded w-2/3 mb-3" />
              <div className="h-4 bg-muted rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Your Library</h1>

      {documents.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          <p className="mb-4">
            No documents yet. Upload a PDF or paste some text to get started.
          </p>
          <Link
            href="/upload"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            + New Read
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentCard({ doc }: { doc: DocumentWithSession }) {
  const router = useRouter();
  const session = doc.latestSession;

  function handleClick() {
    if (!session) {
      // No session — go to upload flow to set purpose + energy
      router.push(`/upload?documentId=${doc.id}`);
      return;
    }

    if (session.status === "completed") {
      router.push(`/read/${session.id}/export`);
      return;
    }

    // Active or paused — resume reading
    if (session.totalChunks > 0) {
      router.push(`/read/${session.id}`);
    } else {
      router.push(`/read/${session.id}/map`);
    }
  }

  return (
    <button
      onClick={handleClick}
      className="w-full text-left rounded-xl border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-card/80"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">
              {doc.sourceType === "pdf" ? "\u{1F4C4}" : "\u{1F4DD}"}
            </span>
            <h2 className="font-semibold truncate">{doc.title}</h2>
          </div>

          {session ? (
            <SessionStatus session={session} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No session yet &middot;{" "}
              <span className="text-primary">Start Reading</span>
            </p>
          )}
        </div>

        <div className="text-xs text-muted-foreground shrink-0 pt-1">
          {doc.wordCount.toLocaleString()} words
        </div>
      </div>
    </button>
  );
}

function SessionStatus({
  session,
}: {
  session: ReadingSession & { totalChunks: number };
}) {
  if (session.status === "completed") {
    return (
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Complete &middot; <span className="text-primary">View Export</span>
        </p>
        {session.purpose && (
          <p className="text-xs text-muted-foreground truncate">
            Purpose: {session.purpose}
          </p>
        )}
      </div>
    );
  }

  const chunkProgress =
    session.totalChunks > 0
      ? `Chunk ${session.currentChunkIdx + 1} of ${session.totalChunks}`
      : "Getting started";

  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">
        {chunkProgress} &middot;{" "}
        <span className="text-primary">Resume</span>
      </p>
      {session.purpose && (
        <p className="text-xs text-muted-foreground truncate">
          Purpose: {session.purpose}
        </p>
      )}
    </div>
  );
}
