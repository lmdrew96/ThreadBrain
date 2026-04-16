"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Step = "upload" | "setup";
type Tab = "pdf" | "paste" | "url";

export default function UploadPage() {
  return (
    <Suspense>
      <UploadPageContent />
    </Suspense>
  );
}

function UploadPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("upload");
  const [activeTab, setActiveTab] = useState<Tab>("pdf");
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState("");

  // If navigated from dashboard with an existing documentId, skip to setup
  useEffect(() => {
    const existingDocId = searchParams.get("documentId");
    if (existingDocId) {
      fetch(`/api/documents/${existingDocId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((doc) => {
          if (doc) {
            setDocumentId(doc.id);
            setDocTitle(doc.title);
            setStep("setup");
          }
        });
    }
  }, [searchParams]);

  const [pdfWarning, setPdfWarning] = useState<string | null>(null);

  function handleDocumentCreated(id: string, title: string, warning?: string) {
    setDocumentId(id);
    setDocTitle(title);
    if (warning) setPdfWarning(warning);
    setStep("setup");
  }

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-2xl mx-auto">
      {step === "upload" && (
        <>
          <h1 className="text-2xl font-bold mb-2">Add a Document</h1>
          <p className="text-muted-foreground mb-8">
            Upload a PDF or paste text you need to read.
          </p>

          {/* Tab switcher */}
          <div className="flex gap-1 rounded-lg bg-muted p-1 mb-8">
            {(["pdf", "url", "paste"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="sm:hidden">
                  {tab === "pdf" ? "PDF" : tab === "url" ? "URL" : "Paste"}
                </span>
                <span className="hidden sm:inline">
                  {tab === "pdf" ? "Upload PDF" : tab === "url" ? "Import URL" : "Paste Text"}
                </span>
              </button>
            ))}
          </div>

          {activeTab === "pdf" && <PdfUpload onSuccess={handleDocumentCreated} />}
          {activeTab === "url" && <UrlImport onSuccess={handleDocumentCreated} />}
          {activeTab === "paste" && <TextPaste onSuccess={handleDocumentCreated} />}
        </>
      )}

      {step === "setup" && documentId && (
        <>
        {pdfWarning && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <p className="font-medium mb-1">Heads up</p>
            <p className="text-amber-200/80">{pdfWarning}</p>
          </div>
        )}
        <SessionSetup
          documentId={documentId}
          docTitle={docTitle}
          onSessionCreated={(sessionId) =>
            router.push(`/read/${sessionId}/map`)
          }
        />
        </>
      )}
    </div>
  );
}

function PdfUpload({
  onSuccess,
}: {
  onSuccess: (id: string, title: string, warning?: string) => void;
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
      onSuccess(data.documentId, data.title, data.warning);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 sm:p-12 cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/50">
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
            <p className="text-sm mt-1">Max 10 MB</p>
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

function UrlImport({
  onSuccess,
}: {
  onSuccess: (id: string, title: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    if (!url.trim()) return;
    setImporting(true);
    setError(null);

    try {
      const res = await fetch("/api/documents/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");

      onSuccess(data.documentId, data.title);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="url" className="block text-sm font-medium mb-2">
          Article or page URL
        </label>
        <p className="text-xs text-muted-foreground mb-3">
          Works best with articles, blog posts, and academic pages. For PDFs, use the Upload tab.
        </p>
        <input
          id="url"
          type="url"
          placeholder="https://..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleImport()}
          className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <button
        onClick={handleImport}
        disabled={!url.trim() || importing}
        className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {importing ? "Extracting content..." : "Import"}
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
          rows={8}
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
                <span className="block text-xs text-muted-foreground mt-0.5 leading-tight">
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
