import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import {
  Lora,
  Playfair_Display,
  DM_Sans,
  JetBrains_Mono,
} from "next/font/google";
import { ThemeProvider } from "@/lib/theme-context";
import "@/app/globals.css";

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

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
      <html
        lang="en"
        className="dark"
        suppressHydrationWarning
        data-font="geist"
      >
        <head>
          {/* Synchronously apply persisted theme + font before first paint to prevent flash */}
          <script
            dangerouslySetInnerHTML={{
              __html: `try{var t=localStorage.getItem('tb-theme'),f=localStorage.getItem('tb-font'),h=document.documentElement;if(t){h.classList.remove('dark','light');h.classList.add(t);}if(f)h.setAttribute('data-font',f);}catch(e){}`,
            }}
          />
        </head>
        <body
          className={`${lora.variable} ${playfair.variable} ${dmSans.variable} ${jetbrains.variable}`}
        >
          <ThemeProvider>{children}</ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
