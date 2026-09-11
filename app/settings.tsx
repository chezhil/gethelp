import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { border, CONTENT_MAX_WIDTH, radius, shadow, spacing, type, type Colors } from "../constants/theme";
import { useTheme, useThemedStyles, type ThemeMode } from "../lib/store/theme";
import {
  API_KEY_SLOTS,
  getMedicalProfile,
  setMedicalProfile,
  DirectionsProvider,
  GeocodingProvider,
  ReasoningProvider,
  VoiceProvider,
  getApiKey,
  setApiKey,
  useProviderSettings,
} from "../lib/store/settings";

function SegmentedRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.segmentRow}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            hitSlop={6}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function AppearanceRow() {
  const { mode, scheme, setMode } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <>
      <SegmentedRow<ThemeMode>
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

  useEffect(() => {
    getMedicalProfile().then((v) => {
      setValue(v);
      setLoaded(true);
    });
  }, []);

  return (
    <TextInput
      value={value}
      onChangeText={(v) => {
        setValue(v);
        setMedicalProfile(v);
      }}
      placeholder={
        loaded ? "e.g. type 2 diabetes, on blood thinners, allergic to penicillin" : "Loading…"
      }
      placeholderTextColor={colors.textMuted}
      multiline
      style={styles.profileInput}
    />
  );
}

function ApiKeyField({
  slot,
  label,
  placeholder,
}: {
  slot: keyof typeof API_KEY_SLOTS;
  label: string;
  placeholder: string;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [value, setValue] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getApiKey(slot).then((v) => {
      setValue(v ?? "");
      setLoaded(true);
    });
  }, [slot]);

  return (
    <View style={styles.keyField}>
      <Text style={styles.keyLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(v) => {
          setValue(v);
          setApiKey(slot, v);
        }}
        placeholder={loaded ? placeholder : "Loading…"}
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.keyInput}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { settings, update, loaded } = useProviderSettings();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Settings</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
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
  const { colors } = useTheme();
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
  segmentRow: { flexDirection: "row", gap: spacing.xs },
  segment: {
    flex: 1,
    borderWidth: border.width,
    borderColor: colors.border,
    borderRadius: radius.sm,
    minHeight: 48,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: { backgroundColor: colors.yellow, ...shadow.sm },
  segmentText: { ...type.small, color: colors.textMuted, fontWeight: "600", textAlign: "center" },
  segmentTextActive: { color: colors.text },
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
  keyField: { marginTop: spacing.sm },
  keyLabel: { ...type.small, color: colors.textMuted, marginBottom: spacing.xs },
  keyInput: {
    ...type.body,
    color: colors.text,
    borderWidth: border.width,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    backgroundColor: colors.bg,
  },
});
