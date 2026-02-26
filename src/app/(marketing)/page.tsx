import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="max-w-2xl text-center space-y-8">
        <h1 className="text-5xl font-bold tracking-tight">
          Thread<span className="text-primary">Brain</span>
        </h1>
        <p className="text-xl text-muted-foreground leading-relaxed">
          Don&apos;t skip the reading. Thread through it.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          AI-powered reading companion that breaks dense text into manageable
          chunks, highlights what matters for <em>your</em> purpose, and keeps
          your attention threaded through the whole thing.
        </p>

        <div className="flex gap-4 justify-center pt-4">
          <SignedOut>
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Get Started
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Go to Dashboard
            </Link>
          </SignedIn>
        </div>
      </div>
    </main>
  );
}
