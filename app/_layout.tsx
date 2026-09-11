import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "../constants/theme";
import { AuthProvider } from "../lib/store/auth";
import { ProviderSettingsProvider } from "../lib/store/settings";
import { TriageProvider } from "../lib/store/triage";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ProviderSettingsProvider>
          <TriageProvider>
          <StatusBar style="dark" />
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
          </TriageProvider>
        </ProviderSettingsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
