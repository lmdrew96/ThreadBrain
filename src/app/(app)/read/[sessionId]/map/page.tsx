"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Markdown from "react-markdown";

export default function MapPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [map, setMap] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function generateMap() {
      try {
        const res = await fetch("/api/ai/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        if (!res.ok) throw new Error("Failed to generate map");

        const data = await res.json();
        setMap(data.map);
      } catch (err) {
        console.error(err);
        setError("Failed to generate document map. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    generateMap();
  }, [sessionId]);

  function handleStartReading() {
    // Navigate immediately — reading page handles chunk generation
    router.push(`/read/${sessionId}`);
  }

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto">
      <p className="text-sm text-muted-foreground mb-2">The Map</p>
      <h1 className="text-2xl font-bold mb-8">Before you dive in...</h1>

      {loading && !map && (
        <div className="rounded-xl border bg-card p-8 text-center">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4 mx-auto" />
            <div className="h-4 bg-muted rounded w-5/6 mx-auto" />
            <div className="h-4 bg-muted rounded w-2/3 mx-auto" />
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Mapping your document...
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              fetch("/api/ai/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId }),
              })
                .then((res) => {
                  if (!res.ok) throw new Error("Failed to generate map");
                  return res.json();
                })
                .then((data) => setMap(data.map))
                .catch((err) => {
                  console.error(err);
                  setError(
                    "Failed to generate document map. Please try again."
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

      {map && (
        <div className="space-y-8">
          <div className="rounded-xl border bg-card p-6 prose prose-invert prose-lg max-w-none">
            <Markdown>{map}</Markdown>
          </div>

          <button
            onClick={handleStartReading}
            className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Start Reading
          </button>
        </div>
      )}
    </div>
  );
}
