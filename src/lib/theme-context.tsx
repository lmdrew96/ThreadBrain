"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "dark" | "light";
export type AppFont = "geist" | "dm-sans" | "lora" | "playfair" | "jetbrains";

const DEFAULT_CHUNK_SIZES: Record<number, number> = {
  1: 150,
  2: 200,
  3: 300,
  4: 450,
  5: 550,
};

interface ThemeContextValue {
  theme: Theme;
  font: AppFont;
  chunkSizes: Record<number, number>;
  setTheme: (t: Theme) => void;
  setFont: (f: AppFont) => void;
  setChunkSize: (level: number, size: number) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [font, setFontState] = useState<AppFont>("geist");
  const [chunkSizes, setChunkSizesState] =
    useState<Record<number, number>>(DEFAULT_CHUNK_SIZES);
  const [mounted, setMounted] = useState(false);

  // Sync initial state from localStorage (already applied to DOM by inline script)
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("tb-theme") as Theme | null;
      const savedFont = localStorage.getItem("tb-font") as AppFont | null;
      const savedChunkSizes = localStorage.getItem("tb-chunk-sizes");
      if (savedTheme) setThemeState(savedTheme);
      if (savedFont) setFontState(savedFont);
      if (savedChunkSizes) {
        try {
          setChunkSizesState(JSON.parse(savedChunkSizes));
        } catch {}
      }
    } catch {}
    setMounted(true);
  }, []);

  // Apply theme class to <html> when it changes
  useEffect(() => {
    if (!mounted) return;
    const html = document.documentElement;
    html.classList.remove("dark", "light");
    html.classList.add(theme);
    try {
      localStorage.setItem("tb-theme", theme);
    } catch {}
  }, [theme, mounted]);

  // Apply font data attribute to <html> when it changes
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("data-font", font);
    try {
      localStorage.setItem("tb-font", font);
    } catch {}
  }, [font, mounted]);

  function setTheme(t: Theme) {
    setThemeState(t);
  }

  function setFont(f: AppFont) {
    setFontState(f);
  }

  function setChunkSize(level: number, size: number) {
    setChunkSizesState((prev) => {
      const next = { ...prev, [level]: size };
      try {
        localStorage.setItem("tb-chunk-sizes", JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  return (
    <ThemeContext.Provider
      value={{ theme, font, chunkSizes, setTheme, setFont, setChunkSize }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
