"use client";

import { useToasts } from "@/hooks/use-toast";

export function Toaster() {
  const toasts = useToasts();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-lg text-sm font-medium shadow-lg border backdrop-blur-sm pointer-events-auto animate-fade-up ${
            t.type === "success"
              ? "bg-card border-primary/30 text-foreground"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          }`}
        >
          {t.type === "success" && (
            <span className="text-primary mr-2">✓</span>
          )}
          {t.message}
        </div>
      ))}
    </div>
  );
}
