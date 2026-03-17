import { AppHeader } from "./app-header";
import { Toaster } from "@/components/ui/toaster";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">{children}</main>
      <Toaster />
    </div>
  );
}
