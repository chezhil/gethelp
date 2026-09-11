import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ProviderSettingsProvider } from "../lib/store/settings";
import { ThemeProvider, useTheme } from "../lib/store/theme";
import { TriageProvider } from "../lib/store/triage";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <ProviderSettingsProvider>
          <TriageProvider>
            <ThemedShell />
          </TriageProvider>
        </ProviderSettingsProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

/** Split out so it sits inside ThemeProvider and can read the active palette. */
function ThemedShell() {
  const { colors, scheme } = useTheme();

  // The browser paints its own ground behind the app: the page background
  // outside the React root, the overscroll area past the end of a screen, and
  // the scrollbars and form controls it draws itself. Without this a dark
  // page sits in a white frame and bounces to white when you scroll past the
  // bottom. No-ops off web.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    document.documentElement.style.backgroundColor = colors.bg;
    document.body.style.backgroundColor = colors.bg;
    document.documentElement.style.colorScheme = scheme;
  }, [colors.bg, scheme]);

  // React Navigation paints its own container behind every screen, and its
  // default is a light #f2f2f2 that shows through in the overscroll area and
  // during the cross-fade between screens. Hand it our palette so the seam
  // never appears.
  const navBase = scheme === "dark" ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...navBase,
    colors: {
      ...navBase.colors,
      background: colors.bg,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.accent,
    },
  };

  return (
    <NavThemeProvider value={navTheme}>
      {/* Inverted: light icons on a dark bar, dark icons on a light one. */}
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: "fade",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="processing" />
        <Stack.Screen name="result" />
        <Stack.Screen name="settings" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="history" options={{ animation: "slide_from_bottom" }} />
      </Stack>
    </NavThemeProvider>
  );
}
