import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6">
      {/* Atmospheric background */}
      <div className="absolute inset-0 bg-background" />

      {/* Gradient orbs */}
      <div
        className="orb animate-float-slow absolute w-[500px] h-[500px] bg-indigo-600"
        style={{ top: "15%", left: "10%" }}
      />
      <div
        className="orb animate-float-medium absolute w-[400px] h-[400px] bg-amber-500"
        style={{ bottom: "20%", right: "8%", animationDelay: "6s" }}
      />
      <div
        className="orb animate-float-slow absolute w-[300px] h-[300px] bg-violet-700"
        style={{ top: "60%", left: "55%", animationDelay: "12s" }}
      />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
        }}
      />

      {/* Nav */}
      <nav className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 sm:px-8 py-6 z-10">
        <span className="text-lg font-semibold tracking-tight">
          Thread<span className="text-primary">Brain</span>
        </span>
        <SignedOut>
          <Link
            href="/sign-in"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
        </SignedOut>
        <SignedIn>
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Dashboard →
          </Link>
        </SignedIn>
      </nav>

      {/* Hero glass panel */}
      <div className="relative z-10 glass rounded-2xl px-6 sm:px-10 py-10 sm:py-14 max-w-xl w-full text-center space-y-7 animate-fade-up">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border border-primary/25 text-primary bg-primary/5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Built for ADHD brains
        </div>

        {/* Title */}
        <div className="space-y-3">
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-none">
            Thread<span className="text-primary">Brain</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Don&apos;t skip the reading.{" "}
            <span className="text-foreground font-medium">
              Thread through it.
            </span>
          </p>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
          AI-powered reading companion that breaks dense academic text into
          manageable chunks, highlights what matters for{" "}
          <em>your specific purpose</em>, and keeps your attention threaded
          through the whole thing.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-1">
          <SignedOut>
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]"
            >
              Get started free
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center rounded-lg border px-6 py-2.5 text-sm font-medium transition-all hover:bg-muted hover:scale-[1.02] active:scale-[0.98]"
            >
              Sign in
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 hover:scale-[1.02]"
            >
              Go to Dashboard →
            </Link>
          </SignedIn>
        </div>
      </div>

      {/* Feature strip */}
      <div className="relative z-10 mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl w-full animate-fade-up-d3">
        {[
          {
            icon: "🧭",
            title: "The Map",
            desc: "3-sentence orientation before you dive in",
          },
          {
            icon: "🧩",
            title: "Chunked Reading",
            desc: "One digestible section at a time",
          },
          {
            icon: "💡",
            title: "Smart Highlights",
            desc: "Marked for your specific purpose",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="glass-card px-4 py-5 text-center space-y-1.5"
          >
            <div className="text-2xl">{f.icon}</div>
            <div className="text-sm font-semibold">{f.title}</div>
            <div className="text-xs text-muted-foreground leading-snug">
              {f.desc}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
