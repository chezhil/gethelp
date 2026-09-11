import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "../constants/theme";
import { TriageProvider } from "../lib/store/triage";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
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
        </Stack>
      </TriageProvider>
    </SafeAreaProvider>
  );
}
