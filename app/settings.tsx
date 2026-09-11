import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { border, CONTENT_MAX_WIDTH, radius, shadow, spacing, type, type Colors } from "../constants/theme";
import { ApiKeyField } from "../components/ApiKeyField";
import { SegmentedRow } from "../components/SegmentedRow";
import { useDebouncedPersist } from "../lib/store/persist";
import { useTheme, useThemedStyles, type ThemeMode } from "../lib/store/theme";
import {
  getMedicalProfile,
  setMedicalProfile,
  DirectionsProvider,
  GeocodingProvider,
  ReasoningProvider,
  VoiceProvider,
  useProviderSettings,
} from "../lib/store/settings";

function AppearanceRow() {
  const { mode, scheme, setMode } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <>
      <SegmentedRow<ThemeMode>
        label="Appearance"
        value={mode}
        onChange={setMode}
        options={[
          { value: "system", label: "System" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
      />
      <Text style={styles.hint}>
        {mode === "system"
          ? `Following your device — currently ${scheme}.`
          : `Always ${mode}, whatever the device is set to.`}
      </Text>
    </>
  );
}

function MedicalProfileField() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [value, setValue] = useState("");
  const [loaded, setLoaded] = useState(false);
  /** Only a value the user typed is worth writing back — see the gate below. */
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let active = true;
    getMedicalProfile().then((v) => {
      if (!active) return;
      setValue(v);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // Gated on `loaded` as well as `dirty`: this box starts empty and fills in
  // asynchronously, and an empty value is stored as "delete the profile" —
  // so persisting before the read lands would erase what it was about to show.
  const persist = useCallback((v: string) => setMedicalProfile(v), []);
  useDebouncedPersist(value, loaded && dirty, persist);

  return (
    <TextInput
      value={value}
      onChangeText={(v) => {
        setDirty(true);
        setValue(v);
      }}
      placeholder={
        loaded ? "e.g. type 2 diabetes, on blood thinners, allergic to penicillin" : "Loading…"
      }
      placeholderTextColor={colors.textMuted}
      accessibilityLabel="Medical background: conditions, medications or allergies"
      multiline
      style={styles.profileInput}
    />
  );
}

export default function SettingsScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { settings, update, loaded } = useProviderSettings();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Settings</Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close settings"
        >
          <Text style={styles.done}>Done</Text>
        </Pressable>
      </View>
      <Text style={styles.subtitle}>
        Bring your own API keys. Each key is stored only on this device and is sent directly to
        that provider — never anywhere else.
      </Text>

      {!loaded ? null : (
        <>
          <Section title="Appearance">
            <AppearanceRow />
          </Section>

          <Section title="Medical background">
            <Text style={styles.hint}>
              Optional. Conditions, medications or allergies that should change how an injury is
              judged — being on blood thinners makes a head knock more urgent, for instance. Saved
              on this device only, and sent no further than the injury description itself.
            </Text>
            <MedicalProfileField />
          </Section>

          <Section title="AI Reasoning">
            <SegmentedRow<ReasoningProvider>
              label="AI reasoning provider"
              value={settings.reasoning}
              onChange={(v) => update({ reasoning: v })}
              options={[
                { value: "gemini", label: "Gemini 3.6 Flash" },
                { value: "groq", label: "GPT-OSS 120B (Groq)" },
              ]}
            />
            {settings.reasoning === "gemini" && (
              <Text style={styles.hint}>Photo attachment is available with Gemini.</Text>
            )}
            {settings.reasoning === "groq" && (
              <Text style={styles.hint}>
                Text-only — photo attachment is hidden while selected. Free key, no card needed.
              </Text>
            )}
            {settings.reasoning === "groq" ? (
              <ApiKeyField slot="groq" label="Groq API key" placeholder="gsk_…" />
            ) : (
              <ApiKeyField slot="gemini" label="Gemini API key" placeholder="AIza…" />
            )}
          </Section>

          <Section title="Voice Input">
            <SegmentedRow<VoiceProvider>
              label="Voice input provider"
              value={settings.voice}
              onChange={(v) => update({ voice: v })}
              options={[
                { value: "device", label: "Device native" },
                { value: "google", label: "Google Speech-to-Text" },
              ]}
            />
            {settings.voice === "google" && (
              <ApiKeyField slot="google" label="Google API key" placeholder="AIza…" />
            )}
          </Section>

          <Section title="Geocoding">
            <SegmentedRow<GeocodingProvider>
              label="Geocoding provider"
              value={settings.geocoding}
              onChange={(v) => update({ geocoding: v })}
              options={[
                { value: "nominatim", label: "OSM Nominatim" },
                { value: "google", label: "Google Geocoding" },
              ]}
            />
            {settings.geocoding === "google" && (
              <ApiKeyField slot="google" label="Google API key" placeholder="AIza…" />
            )}
          </Section>

          <Section title="Directions / ETA">
            <SegmentedRow<DirectionsProvider>
              label="Directions and ETA provider"
              value={settings.directions}
              onChange={(v) => update({ directions: v })}
              options={[
                { value: "osrm", label: "OSRM (free)" },
                { value: "google", label: "Google Routes" },
              ]}
            />
            {settings.directions === "osrm" && (
              <Text style={styles.hint}>No key needed — uses OSRM's public routing server.</Text>
            )}
            {settings.directions === "google" && (
              <ApiKeyField slot="google" label="Google API key" placeholder="AIza…" />
            )}
          </Section>

          <Section title="Nearby Search">
            <Text style={styles.hint}>Google Places.</Text>
            <ApiKeyField slot="google" label="Google API key" placeholder="AIza…" />
          </Section>
        </>
      )}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingTop: spacing.xxl,
    backgroundColor: colors.bg,
    flexGrow: 1,
    // Centred column: fills a phone screen, stops stretching on a desktop.
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { ...type.title, color: colors.text },
  done: {
    ...type.bodyStrong,
    color: colors.text,
    backgroundColor: colors.yellow,
    borderWidth: border.width,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    overflow: "hidden",
  },
  subtitle: { ...type.small, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },
  section: {
    borderWidth: border.width,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadow.md,
  },
  sectionTitle: { ...type.bodyStrong, color: colors.text, marginBottom: spacing.sm },
  hint: { ...type.small, color: colors.textMuted, marginTop: spacing.sm },
  profileInput: {
    ...type.body,
    color: colors.text,
    minHeight: 80,
    borderWidth: border.width,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
    backgroundColor: colors.bg,
    textAlignVertical: "top",
  },
});
