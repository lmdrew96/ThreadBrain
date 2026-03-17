"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Type, SlidersHorizontal, BookOpen, Eye, EyeOff } from "lucide-react";
import { useTheme, type AppFont } from "@/lib/theme-context";
import { toast } from "@/hooks/use-toast";

interface FontOption {
  id: AppFont;
  label: string;
  category: string;
  preview: string;
  cssVar: string;
}

const FONTS: FontOption[] = [
  {
    id: "geist",
    label: "Geist",
    category: "Sans-serif",
    preview: "Clean, modern, neutral. The default.",
    cssVar: "var(--font-sans)",
  },
  {
    id: "dm-sans",
    label: "DM Sans",
    category: "Sans-serif",
    preview: "Friendly, open, and highly legible at small sizes.",
    cssVar: "var(--font-dm-sans)",
  },
  {
    id: "lora",
    label: "Lora",
    category: "Serif",
    preview: "Warm and literary. Made for long-form reading.",
    cssVar: "var(--font-lora)",
  },
  {
    id: "playfair",
    label: "Playfair Display",
    category: "Serif",
    preview: "Dramatic and editorial. Feels like a good book.",
    cssVar: "var(--font-playfair)",
  },
  {
    id: "jetbrains",
    label: "JetBrains Mono",
    category: "Monospace",
    preview: "Technical and structured. Every character distinct.",
    cssVar: "var(--font-jetbrains)",
  },
];

const ENERGY_LABELS: Record<number, string> = {
  1: "Barely Awake",
  2: "Low Energy",
  3: "Normal",
  4: "Focused",
  5: "In the Zone",
};

const CHUNK_RANGES: Record<number, { min: number; max: number }> = {
  1: { min: 50, max: 250 },
  2: { min: 100, max: 300 },
  3: { min: 150, max: 500 },
  4: { min: 250, max: 700 },
  5: { min: 350, max: 800 },
};

export default function SettingsPage() {
  const { theme, font, chunkSizes, setTheme, setFont, setChunkSize } =
    useTheme();

  return (
    <div className="px-6 py-10 max-w-2xl mx-auto space-y-12">
      <div className="animate-fade-up">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Personalize your reading environment
        </p>
      </div>

      {/* ── Appearance ─────────────────────────────────────────────────── */}
      <section className="space-y-4 animate-fade-up-d1">
        <SectionHeader icon={<Sun className="w-3.5 h-3.5" />} label="Appearance" />

        <div className="glass-card p-5 flex items-center justify-between">
          <div>
            <p className="font-medium">Theme</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {theme === "dark" ? "Dark mode" : "Light mode"}
            </p>
          </div>

          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors duration-300 ${
              theme === "light" ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-full bg-white shadow transition-transform duration-300 ${
                theme === "light" ? "translate-x-7" : "translate-x-1"
              }`}
            >
              {theme === "light" ? (
                <Sun className="w-3 h-3 text-amber-500" />
              ) : (
                <Moon className="w-3 h-3 text-slate-500" />
              )}
            </span>
          </button>
        </div>
      </section>

      {/* ── Font ───────────────────────────────────────────────────────── */}
      <section className="space-y-4 animate-fade-up-d2">
        <SectionHeader icon={<Type className="w-3.5 h-3.5" />} label="Reading Font" />

        <div className="space-y-2">
          {FONTS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFont(f.id)}
              className={`w-full text-left glass-card p-4 transition-all hover:border-primary/30 ${
                font === f.id
                  ? "border-primary/50 ring-1 ring-primary/20"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-medium"
                    style={{ fontFamily: f.cssVar }}
                  >
                    {f.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {f.category}
                  </span>
                </div>
                {font === f.id && (
                  <span className="text-xs font-medium text-primary">
                    Active
                  </span>
                )}
              </div>
              <p
                className="text-sm text-muted-foreground"
                style={{ fontFamily: f.cssVar }}
              >
                {f.preview}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* ── Connections ────────────────────────────────────────────────── */}
      <JournalConnectionSection />

      {/* ── Chunk sizes ────────────────────────────────────────────────── */}
      <section className="space-y-4 animate-fade-up-d3">
        <SectionHeader
          icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
          label="Chunk Size Defaults"
          description="How many words per chunk at each energy level. Saved and used when you start a new reading session."
        />

        <div className="space-y-3">
          {([1, 2, 3, 4, 5] as const).map((level) => {
            const range = CHUNK_RANGES[level];
            const current = chunkSizes[level] ?? range.min;
            const pct =
              ((current - range.min) / (range.max - range.min)) * 100;

            return (
              <div key={level} className="glass-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm leading-none">
                      {"⚡".repeat(level)}
                    </span>
                    <span className="text-sm font-medium">
                      {ENERGY_LABELS[level]}
                    </span>
                  </div>
                  <span className="text-sm font-mono tabular-nums text-primary">
                    {current}w
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="range"
                    min={range.min}
                    max={range.max}
                    step={25}
                    value={current}
                    onChange={(e) =>
                      setChunkSize(level, Number(e.target.value))
                    }
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, var(--color-primary) ${pct}%, var(--color-border) ${pct}%)`,
                    }}
                  />
                </div>

                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{range.min}w — shorter</span>
                  <span>longer — {range.max}w</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ─── Research Journal connection ───────────────────────────────────────────

function JournalConnectionSection() {
  const [rjUrl, setRjUrl] = useState("");
  const [rjApiKey, setRjApiKey] = useState("");
  const [keySet, setKeySet] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/settings")
      .then((r) => r.json())
      .then((d) => {
        setRjUrl(d.rjUrl ?? "");
        setKeySet(d.rjApiKeySet ?? false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, string> = { rjUrl };
      if (rjApiKey) body.rjApiKey = rjApiKey;

      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (rjApiKey) setKeySet(true);
      setRjApiKey("");
      setShowKey(false);
      toast("Research Journal connected ✓");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  }

  const connected = !!rjUrl && keySet;

  return (
    <section className="space-y-4">
      <SectionHeader
        icon={<BookOpen className="w-3.5 h-3.5" />}
        label="Connections"
        description="Connect external tools to save highlights and excerpts."
      />

      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Research Journal</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Save highlights directly to your research library
            </p>
          </div>
          {!loading && (
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full ${
                connected
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {connected ? "Connected" : "Not connected"}
            </span>
          )}
        </div>

        {!loading && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Research Journal URL
              </label>
              <input
                type="url"
                value={rjUrl}
                onChange={(e) => setRjUrl(e.target.value)}
                placeholder="https://your-rj-domain.com"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                API Key{keySet && !rjApiKey && (
                  <span className="ml-2 text-emerald-500">● saved</span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={rjApiKey}
                  onChange={(e) => setRjApiKey(e.target.value)}
                  placeholder={keySet ? "Enter new key to replace" : "Paste your API key"}
                  className="w-full rounded-lg border bg-background px-3 py-2 pr-10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving || (!rjUrl && !rjApiKey)}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : connected ? "Update Connection" : "Save Connection"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function SectionHeader({
  icon,
  label,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </h2>
      </div>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 ml-5">{description}</p>
      )}
    </div>
  );
}
