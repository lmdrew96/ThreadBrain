import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Your Library</h1>

      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        <p className="mb-4">No documents yet. Upload a PDF or paste some text to get started.</p>
        <Link
          href="/upload"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          + New Read
        </Link>
      </div>
    </div>
  );
}
