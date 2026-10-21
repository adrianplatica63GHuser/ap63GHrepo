"use client";

/**
 * The one theme the two „Mod întunecat" boxes show and change.                                       (Slice 40.19)
 *
 * The root layout passes the theme it read from the cookie, so the first paint and the boxes agree; ticking either
 * box goes through `setTheme`, which stores the cookie, turns <html> and re-renders both boxes — the other one shows
 * the change at once (Ask first 1).
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { applyTheme, type Theme } from "@/lib/ui/theme";

type ThemeState = { theme: Theme; setTheme: (theme: Theme) => void };

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ initial, children }: { initial: Theme; children: ReactNode }) {
  const [theme, setState] = useState<Theme>(initial);
  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    setState(next);
  }, []);
  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The theme and its setter. Outside the provider (a test rendering one piece): light, and a setter that still works. */
export function useTheme(): ThemeState {
  return useContext(ThemeContext) ?? { theme: "light", setTheme: applyTheme };
}
