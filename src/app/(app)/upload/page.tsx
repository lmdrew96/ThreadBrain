"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = "upload" | "setup";

export default function UploadPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [activeTab, setActiveTab] = useState<"pdf" | "paste">("pdf");
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState("");

  function handleDocumentCreated(id: string, title: string) {
    setDocumentId(id);
    setDocTitle(title);
    setStep("setup");
  }

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto">
      {step === "upload" && (
        <>
          <h1 className="text-2xl font-bold mb-2">Add a Document</h1>
          <p className="text-muted-foreground mb-8">
            Upload a PDF or paste text you need to read.
          </p>

          {/* Tab switcher */}
          <div className="flex gap-1 rounded-lg bg-muted p-1 mb-8">
            <button
              onClick={() => setActiveTab("pdf")}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "pdf"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Upload PDF
            </button>
            <button
              onClick={() => setActiveTab("paste")}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "paste"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Paste Text
            </button>
          </div>

          {activeTab === "pdf" ? (
            <PdfUpload onSuccess={handleDocumentCreated} />
          ) : (
            <TextPaste onSuccess={handleDocumentCreated} />
          )}
        </>
      )}

      {step === "setup" && documentId && (
        <SessionSetup
          documentId={documentId}
          docTitle={docTitle}
          onSessionCreated={(sessionId) =>
            router.push(`/read/${sessionId}/map`)
          }
        />
      )}
    </div>
  );
}

function PdfUpload({
  onSuccess,
}: {
  onSuccess: (id: string, title: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();
      onSuccess(data.documentId, data.title);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-12 cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/50">
        <input
          type="file"
          accept=".pdf"
          className="sr-only"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <div className="text-center">
            <p className="font-medium">{file.name}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        ) : (
          <div className="text-center text-muted-foreground">
            <p className="font-medium">Drop a PDF here or click to browse</p>
            <p className="text-sm mt-1">Max 25 MB</p>
          </div>
        )}
      </label>

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? "Extracting text..." : "Upload PDF"}
      </button>
    </div>
  );
}

function TextPaste({
  onSuccess,
}: {
  onSuccess: (id: string, title: string) => void;
}) {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!text.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, title: title || "Untitled Document" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Submission failed");
      }

      const data = await res.json();
      onSuccess(data.documentId, data.title);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-2">
          Title (optional)
        </label>
        <input
          id="title"
          type="text"
          placeholder="e.g., Chapter 4: Cell Biology"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div>
        <label htmlFor="text" className="block text-sm font-medium mb-2">
          Paste your text
        </label>
        <textarea
          id="text"
          rows={12}
          placeholder="Paste the text you need to read..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-lg border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
        {text && (
          <p className="text-xs text-muted-foreground mt-1">
            {text.split(/\s+/).filter(Boolean).length} words
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!text.trim() || submitting}
        className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "Processing..." : "Continue"}
      </button>
    </div>
  );
}

function SessionSetup({
  documentId,
  docTitle,
  onSessionCreated,
}: {
  documentId: string;
  docTitle: string;
  onSessionCreated: (sessionId: string) => void;
}) {
  const [purpose, setPurpose] = useState("");
  const [energyLevel, setEnergyLevel] = useState(3);
  const [creating, setCreating] = useState(false);

  const energyLabels = [
    "",
    "Barely functional",
    "Low but trying",
    "Decent",
    "Pretty focused",
    "Locked in",
  ];

  async function handleStart() {
    if (!purpose.trim()) return;
    setCreating(true);

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, purpose, energyLevel }),
      });

      if (!res.ok) throw new Error("Failed to create session");

      const session = await res.json();
      onSessionCreated(session.id);
    } catch (err) {
      console.error(err);
      alert("Failed to start session. Please try again.");
      setCreating(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-bold mb-2">Before you start</h1>
      <p className="text-muted-foreground mb-8">
        Two quick questions to customize your reading of{" "}
        <span className="text-foreground font-medium">{docTitle}</span>.
      </p>

      <div className="space-y-8">
        {/* Purpose */}
        <div>
          <label htmlFor="purpose" className="block text-sm font-medium mb-2">
            Why are you reading this?
          </label>
          <p className="text-xs text-muted-foreground mb-3">
            This helps the AI highlight what matters for <em>your</em> goal.
          </p>
          <input
            id="purpose"
            type="text"
            placeholder="e.g., Research for my linguistics paper on SLA"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Energy Level */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Energy level right now?
          </label>
          <p className="text-xs text-muted-foreground mb-4">
            Lower energy = smaller chunks. No judgment.
          </p>

          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((level) => (
              <button
                key={level}
                onClick={() => setEnergyLevel(level)}
                className={`flex-1 rounded-lg border py-3 text-center transition-colors ${
                  energyLevel === level
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <span className="block text-lg font-bold">{level}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  {energyLabels[level]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleStart}
          disabled={!purpose.trim() || creating}
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creating ? "Setting up your session..." : "Generate My Map"}
        </button>
      </div>
    </>
  );
}
