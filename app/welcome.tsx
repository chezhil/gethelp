import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ApiKeyField } from "../components/ApiKeyField";
import { PrimaryButton } from "../components/PrimaryButton";
import { SegmentedRow } from "../components/SegmentedRow";
import {
  border,
  CONTENT_MAX_WIDTH,
  radius,
  shadow,
  spacing,
  type,
  type Colors,
} from "../constants/theme";
import { setOnboarded } from "../lib/store/onboarding";
import { ReasoningProvider, useProviderSettings } from "../lib/store/settings";
import { useTheme, useThemedStyles } from "../lib/store/theme";

const GEMINI_KEYS_URL = "https://aistudio.google.com/apikey";
const GROQ_KEYS_URL = "https://console.groq.com/keys";
const GOOGLE_KEYS_URL = "https://console.cloud.google.com/apis/credentials";

/**
 * First-run setup.
 *
 * The app ships with no API keys by design — it never holds anyone's
 * credentials, and each visitor brings their own. That is a fine principle
 * and a terrible first impression if the first thing someone sees is a text
 * box that fails when they press Continue. So the choice and the keys are
 * asked for up front, once, with the links to get them.
 *
 * Everything here is also in Settings; this screen is a guided path through
 * the same switches, not a separate source of truth.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { settings, update } = useProviderSettings();
  const [hasReasoningKey, setHasReasoningKey] = useState(false);

  const isGemini = settings.reasoning === "gemini";

  function finish() {
    setOnboarded();
    router.replace("/");
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.brand}>GetHelp!</Text>
      <Text style={styles.title}>Let's set this up</Text>
      <Text style={styles.subtitle}>
        GetHelp! assesses how urgently an injury needs care and finds the nearest place to get it.
        It runs entirely in your browser on the AI service you choose, so it needs a key of your
        own. Takes about a minute, and you only do it once.
      </Text>

      <View style={styles.privacyNote}>
        <Text style={styles.privacyText}>
          Every key you enter is stored only on this device and sent only to the service it belongs
          to. Nothing goes to us — there is no server.
        </Text>
      </View>

      {/* 1 — the one choice that actually gates the app working at all. */}
      <View style={styles.card}>
        <Text style={styles.step}>Step 1 · Required</Text>
        <Text style={styles.cardTitle}>Which AI should assess injuries?</Text>

        <SegmentedRow<ReasoningProvider>
          value={settings.reasoning}
          onChange={(v) => update({ reasoning: v })}
          options={[
            { value: "gemini", label: "Gemini 3.6 Flash" },
            { value: "groq", label: "GPT-OSS 120B (Groq)" },
          ]}
        />

        <Text style={styles.cardBody}>
          {isGemini
            ? "Google's model. It can read photos, so you can attach a picture of the injury. Free key, no card — you'll need a Google account."
            : "Runs on Groq, and it's fast. Text only, so the photo option is hidden while it's selected. Free key, no card, no Google account."}
        </Text>

        <ApiKeyField
          slot={isGemini ? "gemini" : "groq"}
          label={isGemini ? "Gemini API key" : "Groq API key"}
          placeholder={isGemini ? "AIza…" : "gsk_…"}
          onHasKeyChange={setHasReasoningKey}
        />

        <Pressable
          onPress={() => Linking.openURL(isGemini ? GEMINI_KEYS_URL : GROQ_KEYS_URL)}
          hitSlop={8}
          accessibilityRole="link"
          style={styles.linkButton}
        >
          <Text style={styles.link}>
            {isGemini ? "Get a free key at aistudio.google.com ↗" : "Get a free key at console.groq.com ↗"}
          </Text>
        </Pressable>
      </View>

      {/* 2 — the part people are most likely to be confused by later, so it
          is stated here rather than discovered as an error message. */}
      <View style={styles.card}>
        <Text style={styles.step}>Step 2 · Optional</Text>
        <Text style={styles.cardTitle}>Maps and nearby hospitals</Text>
        <Text style={styles.cardBody}>
          Finding hospitals near you, and the map showing where they are, both need a Google API
          key with the <Text style={styles.mono}>Places API (New)</Text> enabled. Without one you
          still get the full injury assessment, first-aid steps and red flags — just no facility
          list and no map.
        </Text>

        <ApiKeyField slot="google" label="Google API key" placeholder="AIza…" />

        <Pressable
          onPress={() => Linking.openURL(GOOGLE_KEYS_URL)}
          hitSlop={8}
          accessibilityRole="link"
          style={styles.linkButton}
        >
          <Text style={styles.link}>Get a key in Google Cloud Console ↗</Text>
        </Pressable>

        <Text style={styles.cardFootnote}>
          The same key also enables optional Google Speech-to-Text, Geocoding and Routes in
          Settings. Those are off by default — the free, keyless OpenStreetMap and OSRM services
          handle addresses and driving times, and your device handles voice.
        </Text>
      </View>

      <PrimaryButton
        label={hasReasoningKey ? "Start using GetHelp!" : "Continue without a key"}
        onPress={finish}
        style={styles.cta}
      />
      {!hasReasoningKey && (
        <Text style={styles.skipNote}>
          You can add keys any time under Settings — but the assessment won't run until you do.
        </Text>
      )}

      <Text style={styles.disclaimer}>
        GetHelp! gives urgency and routing guidance, never a diagnosis. In a life-threatening
        emergency, call your local emergency number first.
      </Text>
    </ScrollView>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.bg,
    flexGrow: 1,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
  brand: {
    ...type.label,
    color: colors.text,
    alignSelf: "flex-start",
    backgroundColor: colors.yellow,
    borderWidth: border.width,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  title: { ...type.display, color: colors.text },
  subtitle: {
    ...type.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  privacyNote: {
    backgroundColor: colors.cyan,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  privacyText: { ...type.small, color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderWidth: border.width,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  step: { ...type.label, color: colors.textMuted, marginBottom: spacing.xs },
  cardTitle: { ...type.subtitle, color: colors.text, marginBottom: spacing.sm },
  cardBody: { ...type.small, color: colors.textMuted, marginTop: spacing.sm },
  cardFootnote: {
    ...type.small,
    color: colors.textMuted,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: border.width,
    borderTopColor: colors.border,
  },
  mono: { color: colors.text, fontWeight: "600" },
  linkButton: { marginTop: spacing.sm, paddingVertical: spacing.xs, minHeight: 44, justifyContent: "center" },
  link: { ...type.small, color: colors.accent, fontWeight: "600" },
  cta: { marginTop: spacing.md },
  skipNote: { ...type.small, color: colors.textMuted, marginTop: spacing.sm, textAlign: "center" },
  disclaimer: {
    ...type.small,
    color: colors.textMuted,
    marginTop: spacing.xl,
    textAlign: "center",
  },
});
