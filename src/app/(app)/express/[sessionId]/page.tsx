"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Zap,
  ChevronDown,
  ChevronRight,
  Copy,
  ArrowLeft,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { CramOutput, ExpressSession } from "@/types";

export default function ExpressCramPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<ExpressSession | null>(null);
  const [cramOutput, setCramOutput] = useState<CramOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Section expand state — one-liner always visible, rest collapsed by default
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );

  // Quiz mode
  const [quizActive, setQuizActive] = useState(false);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState("");
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);
  const [quizFeedbackLoading, setQuizFeedbackLoading] = useState(false);
  const [quizFeedbackError, setQuizFeedbackError] = useState<string | null>(
    null
  );

  useEffect(() => {
    async function load() {
      try {
        // Load session metadata
        const sessionRes = await fetch(`/api/express-sessions/${sessionId}`);
        if (!sessionRes.ok) throw new Error("Session not found");
        const sessionData = await sessionRes.json();
        setSession(sessionData);

        // If cram output is already cached on the session, use it directly.
        // Only hit the AI endpoint when generation is actually needed.
        if (sessionData.cramOutput) {
          setCramOutput(sessionData.cramOutput);
          return;
        }

        const aiRes = await fetch("/api/ai/express", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        if (!aiRes.ok) throw new Error("Failed to generate cram sheet");
        const { cramOutput: output } = await aiRes.json();
        setCramOutput(output);
      } catch (err) {
        console.error(err);
        setError("Couldn't generate your cram sheet. Try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sessionId]);

  function toggleSection(key: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function isExpanded(key: string): boolean {
    return expandedSections.has(key);
  }

  async function copyAll() {
    if (!cramOutput) return;
    const text = [
      `# ${cramOutput.oneLiner}`,
      "",
      "## Structure",
      ...cramOutput.skeleton.map((s, i) => `${i + 1}. ${s}`),
      "",
      "## Themes",
      cramOutput.themes.map((t) => `- ${t}`).join("\n"),
      "",
      "## Key Terms",
      ...cramOutput.keyTerms.map((t) => `**${t.term}**: ${t.definition}`),
      "",
      "## Key Quotes",
      ...cramOutput.keyQuotes.map((q) => `> "${q.quote}"\n> — ${q.context}`),
    ].join("\n");

    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard");
  }

  // Loading state
  if (loading) {
    return (
      <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Zap className="w-5 h-5 text-primary" />
          <p className="text-sm font-medium text-primary">ExpressBrain</p>
        </div>
        <div className="rounded-xl border bg-card p-8 text-center">
          <div className="animate-pulse space-y-3">
            <div className="h-5 bg-muted rounded w-3/4 mx-auto" />
            <div className="h-4 bg-muted rounded w-5/6 mx-auto" />
            <div className="h-4 bg-muted rounded w-2/3 mx-auto" />
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Building your cram sheet...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !cramOutput) {
    return (
      <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-2xl mx-auto">
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive mb-4">
            {error ?? "Something went wrong."}
          </p>
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

  const deadlineDisplay = session?.deadline
    ? new Date(session.deadline).toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const purposeLabels: Record<string, string> = {
    discussion: "discussion",
    quiz: "quiz",
    essay: "essay",
    conversation: "conversation",
  };

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Library
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary">ExpressBrain</span>
        </div>
      </div>

      {/* Context bar — informational, not anxiety-inducing */}
      {deadlineDisplay && (
        <p className="text-xs text-muted-foreground mb-4">
          Your {purposeLabels[session?.expressPurpose ?? ""] ?? "thing"} is{" "}
          {deadlineDisplay}
        </p>
      )}

      {/* ─── The One-Liner (hero) ─── */}
      <div className="rounded-xl border bg-card p-5 sm:p-6 mb-4">
        <p className="text-lg sm:text-xl font-semibold leading-relaxed">
          {cramOutput.oneLiner}
        </p>
      </div>

      {/* ─── Skeleton (structure) ─── */}
      <CollapsibleSection
        title="Structure"
        subtitle="The argument/plot skeleton"
        expanded={isExpanded("skeleton")}
        onToggle={() => toggleSection("skeleton")}
      >
        <ol className="space-y-2">
          {cramOutput.skeleton.map((item, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span className="pt-0.5">{item}</span>
            </li>
          ))}
        </ol>
      </CollapsibleSection>

      {/* ─── Themes (pills) ─── */}
      <CollapsibleSection
        title="Themes"
        subtitle="Big ideas to circle back to"
        expanded={isExpanded("themes")}
        onToggle={() => toggleSection("themes")}
      >
        <div className="flex flex-wrap gap-2">
          {cramOutput.themes.map((theme, i) => (
            <span
              key={i}
              className="inline-block rounded-full border bg-primary/5 px-3 py-1.5 text-sm font-medium"
            >
              {theme}
            </span>
          ))}
        </div>
      </CollapsibleSection>

      {/* ─── Key Terms ─── */}
      {cramOutput.keyTerms.length > 0 && (
        <CollapsibleSection
          title="Key Terms"
          subtitle="What you need to know"
          expanded={isExpanded("terms")}
          onToggle={() => toggleSection("terms")}
        >
          <dl className="space-y-3">
            {cramOutput.keyTerms.map((t, i) => (
              <div key={i}>
                <dt className="text-sm font-semibold">{t.term}</dt>
                <dd className="text-sm text-muted-foreground mt-0.5">
                  {t.definition}
                </dd>
              </div>
            ))}
          </dl>
        </CollapsibleSection>
      )}

      {/* ─── Key Quotes ─── */}
      {cramOutput.keyQuotes.length > 0 && (
        <CollapsibleSection
          title="Key Quotes"
          subtitle="Worth remembering"
          expanded={isExpanded("quotes")}
          onToggle={() => toggleSection("quotes")}
        >
          <div className="space-y-3">
            {cramOutput.keyQuotes.map((q, i) => (
              <div
                key={i}
                className="border-l-2 border-primary/30 pl-3 group/q"
              >
                <p className="text-sm italic">&ldquo;{q.quote}&rdquo;</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {q.context}
                </p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* ─── Active Recall ─── */}
      {cramOutput.recallPrompts.length > 0 && !quizActive && (
        <button
          onClick={() => {
            setQuizActive(true);
            setQuizIdx(0);
            setQuizAnswer("");
            setQuizFeedback(null);
            setQuizFeedbackError(null);
          }}
          className="w-full rounded-xl border border-dashed border-primary/30 p-4 text-center text-sm font-medium text-primary hover:bg-primary/5 transition-colors mt-4"
        >
          Quiz me
        </button>
      )}

      {quizActive && cramOutput.recallPrompts.length > 0 && (
        <div className="rounded-xl border bg-primary/5 p-5 mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {quizIdx + 1} of {cramOutput.recallPrompts.length}
            </span>
            <button
              onClick={() => {
                setQuizActive(false);
                setQuizAnswer("");
                setQuizFeedback(null);
                setQuizFeedbackError(null);
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Done
            </button>
          </div>

          <p className="text-sm font-medium">
            {cramOutput.recallPrompts[quizIdx]}
          </p>

          <textarea
            value={quizAnswer}
            onChange={(e) => setQuizAnswer(e.target.value)}
            placeholder="Type a short answer (optional)..."
            rows={3}
            disabled={quizFeedbackLoading || !!quizFeedback}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none disabled:opacity-70"
          />

          {quizFeedbackError && (
            <p className="text-xs text-destructive">{quizFeedbackError}</p>
          )}

          {quizFeedback && (
            <div className="rounded-lg border bg-card p-3 text-sm leading-relaxed whitespace-pre-wrap">
              {quizFeedback}
            </div>
          )}

          {!quizFeedback ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={async () => {
                  if (!quizAnswer.trim() || quizFeedbackLoading) return;
                  setQuizFeedbackLoading(true);
                  setQuizFeedbackError(null);
                  try {
                    const res = await fetch("/api/ai/express/feedback", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        sessionId,
                        prompt: cramOutput.recallPrompts[quizIdx],
                        userAnswer: quizAnswer,
                      }),
                    });
                    if (!res.ok) throw new Error("Feedback failed");
                    const { feedback } = await res.json();
                    setQuizFeedback(feedback);
                  } catch {
                    setQuizFeedbackError(
                      "Couldn't get feedback right now. You can move on."
                    );
                  } finally {
                    setQuizFeedbackLoading(false);
                  }
                }}
                disabled={!quizAnswer.trim() || quizFeedbackLoading}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {quizFeedbackLoading ? "Checking..." : "Get feedback"}
              </button>
              <button
                onClick={() => {
                  if (quizIdx < cramOutput.recallPrompts.length - 1) {
                    setQuizIdx((i) => i + 1);
                    setQuizAnswer("");
                    setQuizFeedback(null);
                    setQuizFeedbackError(null);
                  } else {
                    setQuizActive(false);
                    setQuizAnswer("");
                    setQuizFeedback(null);
                    setQuizFeedbackError(null);
                  }
                }}
                disabled={quizFeedbackLoading}
                className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
              >
                {quizIdx < cramOutput.recallPrompts.length - 1
                  ? "Just thinking — next"
                  : "Just thinking — done"}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              {quizIdx < cramOutput.recallPrompts.length - 1 ? (
                <button
                  onClick={() => {
                    setQuizIdx((i) => i + 1);
                    setQuizAnswer("");
                    setQuizFeedback(null);
                    setQuizFeedbackError(null);
                  }}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Next prompt
                </button>
              ) : (
                <button
                  onClick={() => {
                    setQuizActive(false);
                    setQuizAnswer("");
                    setQuizFeedback(null);
                    setQuizFeedbackError(null);
                  }}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Done — you got this
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Actions ─── */}
      <div className="flex flex-col sm:flex-row gap-3 mt-8">
        <button
          onClick={copyAll}
          className="flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors hover:bg-muted flex items-center justify-center gap-2"
        >
          <Copy className="w-3.5 h-3.5" />
          Copy All
        </button>
        <button
          onClick={() => router.push("/dashboard")}
          className="flex-1 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          I&apos;m ready
        </button>
      </div>
    </div>
  );
}

// ─── Collapsible Section ──────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  subtitle,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card mb-3 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
