import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "ThreadBrain — AI Reading Companion for ADHD",
  description:
    "Don't skip the reading. Thread through it. AI-powered reading companion that makes dense text accessible for ADHD brains.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider appearance={{ baseTheme: dark }}>
      <html lang="en" className="dark">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
