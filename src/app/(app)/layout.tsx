import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between px-6">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
            Thread<span className="text-primary">Brain</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/upload"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              + New Read
            </Link>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
