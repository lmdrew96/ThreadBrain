"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Settings, Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/theme-context";

export function AppHeader() {
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 glass border-b">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          Thread<span className="text-primary">Brain</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/upload"
            className="inline-flex items-center justify-center rounded-md bg-primary px-3 sm:px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <span className="sm:hidden">+</span>
            <span className="hidden sm:inline">+ New Read</span>
          </Link>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="inline-flex items-center justify-center rounded-md w-9 h-9 border transition-colors hover:bg-muted"
          >
            {theme === "light" ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4" />
            )}
          </button>
          <Link
            href="/settings"
            className="inline-flex items-center justify-center rounded-md w-9 h-9 border transition-colors hover:bg-muted"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </header>
  );
}
