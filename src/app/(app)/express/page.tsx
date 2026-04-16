"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap } from "lucide-react";
import type { Document } from "@/types";
import type { ExpressPurpose } from "@/types";

const PURPOSE_OPTIONS: Array<{
  value: ExpressPurpose;
  label: string;
  description: string;
  emoji: string;
}> = [
  {
    value: "discussion",
    label: "Discussion",
    description: "Hold your own in a conversation",
    emoji: "💬",
  },
  {
    value: "quiz",
    label: "Quiz / Exam",
    description: "Recall facts and key terms",
    emoji: "📝",
  },
  {
    value: "essay",
    label: "Essay / Paper",
    description: "Cite, quote, and analyze",
    emoji: "✍️",
  },
  {
    value: "conversation",
    label: "Casual Chat",
    description: "Sound like you know what it's about",
    emoji: "☕",
  },
];

export default function ExpressSetupPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [purpose, setPurpose] = useState("");
  const [expressPurpose, setExpressPurpose] = useState<ExpressPurpose | null>(
    null
  );
  const [deadline, setDeadline] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDocs() {
      try {
        const res = await fetch("/api/documents");
        if (!res.ok) throw new Error("Failed to load documents");
        const docs = await res.json();
        setDocuments(docs);
      } catch {
        setError("Couldn't load your documents.");
      } finally {
        setLoadingDocs(false);
      }
    }
    loadDocs();
  }, []);

  async function handleGenerate() {
    if (!selectedDocId || !purpose.trim() || !expressPurpose) return;
    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/express-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: selectedDocId,
          purpose,
          expressPurpose,
          deadline: deadline || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to create session");
      const session = await res.json();
      router.push(`/express/${session.id}`);
    } catch {
      setError("Something went wrong. Try again.");
      setCreating(false);
    }
  }

  const selectedDoc = documents.find((d) => d.id === selectedDocId);
  const canSubmit = selectedDocId && purpose.trim() && expressPurpose;

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-5 h-5 text-primary" />
        <p className="text-sm font-medium text-primary">ExpressBrain</p>
      </div>
      <h1 className="text-2xl font-bold mb-2">Need it fast?</h1>
      <p className="text-muted-foreground mb-8">
        Get a scannable cram sheet from any document in your library. No
        judgment, just the essentials.
      </p>

      <div className="space-y-8">
        {/* Document picker */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Pick a document
          </label>
          {loadingDocs ? (
            <div className="animate-pulse h-10 bg-muted rounded-lg" />
          ) : documents.length === 0 ? (
            <div className="rounded-lg border bg-card p-4 text-center text-sm text-muted-foreground">
              <p className="mb-2">No documents yet.</p>
              <Link
                href="/upload"
                className="text-primary hover:underline"
              >
                Upload one first
              </Link>
            </div>
          ) : (
            <select
              value={selectedDocId ?? ""}
              onChange={(e) => setSelectedDocId(e.target.value || null)}
              className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
            >
              <option value="">Select a document...</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title} ({doc.wordCount.toLocaleString()} words)
                </option>
              ))}
            </select>
          )}
          {selectedDoc && (
            <p className="text-xs text-muted-foreground mt-1.5">
              {selectedDoc.wordCount.toLocaleString()} words ·{" "}
              {selectedDoc.sourceType}
            </p>
          )}
        </div>

        {/* Purpose */}
        <div>
          <label htmlFor="purpose" className="block text-sm font-medium mb-2">
            What do you need to know it for?
          </label>
          <input
            id="purpose"
            type="text"
            placeholder="e.g., Class discussion on postcolonial theory"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Express purpose type */}
        <div>
          <label className="block text-sm font-medium mb-2">
            What kind of thing is it for?
          </label>
          <p className="text-xs text-muted-foreground mb-3">
            This shapes what we prioritize in your cram sheet.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {PURPOSE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setExpressPurpose(opt.value)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  expressPurpose === opt.value
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <span className="text-lg">{opt.emoji}</span>
                <p className="text-sm font-medium mt-1">{opt.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {opt.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Deadline (optional) */}
        <div>
          <label htmlFor="deadline" className="block text-sm font-medium mb-2">
            When do you need it by?{" "}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <p className="text-xs text-muted-foreground mb-3">
            Helps us calibrate how deep to go.
          </p>
          <input
            id="deadline"
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        <button
          onClick={handleGenerate}
          disabled={!canSubmit || creating}
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Zap className="w-4 h-4" />
          {creating ? "Generating your cram sheet..." : "Generate Cram Sheet"}
        </button>
      </div>
    </div>
  );
}
