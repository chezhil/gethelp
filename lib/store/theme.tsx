// App-wide colour scheme: follows the OS by default, overridable to a fixed
// Light or Dark and remembered across launches.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { StyleSheet, useColorScheme } from "react-native";
import { darkColors, lightColors, type Colors } from "../../constants/theme";

export type ThemeMode = "system" | "light" | "dark";

const THEME_KEY = "gethelp.theme.v1";

interface ThemeState {
  /** What the user picked. */
  mode: ThemeMode;
  /** What that actually resolves to right now — "system" is never returned. */
  scheme: "light" | "dark";
  colors: Colors;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // On web this tracks prefers-color-scheme and updates live when the OS
  // flips, so "System" keeps meaning something after the app has loaded.
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((saved) => {
        if (saved === "light" || saved === "dark" || saved === "system") setModeState(saved);
      })
      .catch(() => {
        // Storage unavailable (private browsing). Follow the OS this session.
      });
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
  }, []);

  const scheme: "light" | "dark" =
    mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;

  const value = useMemo<ThemeState>(
    () => ({ mode, scheme, colors: scheme === "dark" ? darkColors : lightColors, setMode }),
    [mode, scheme, setMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

/**
 * Build a component's stylesheet from the active palette.
 *
 * StyleSheet.create runs once when a module is first evaluated, so a
 * stylesheet that closes over a palette can never change theme. Each
 * component instead exports a factory taking the palette as an argument,
 * and this hook re-runs it — only when the palette actually changes, so a
 * re-render for any other reason keeps the same style objects and the same
 * cheap identity comparisons downstream.
 *
 * The factory's parameter is named `colors` by convention, which is what
 * lets the style bodies read exactly as they did when they imported a fixed
 * palette.
 */
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (colors: Colors) => T
): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}
