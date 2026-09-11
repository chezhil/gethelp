import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { PrimaryButton } from "../components/PrimaryButton";
import { border, CONTENT_MAX_WIDTH, colors, radius, shadow, spacing, type } from "../constants/theme";
import { getApiKey, useProviderSettings } from "../lib/store/settings";
import { useTriage } from "../lib/store/triage";
import { useVoiceInput, VOICE_UNAVAILABLE_REASON } from "../lib/providers/voice";

export default function InputScreen() {
  const router = useRouter();
  const { settings } = useProviderSettings();
  const triage = useTriage();
  const [usingGps, setUsingGps] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);

  // Nothing works without a reasoning key, and this app ships with none by
  // design — so say so up front rather than letting the first attempt fail.
  // Re-checked on focus so it clears as soon as a key is added in Settings.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getApiKey(settings.reasoning).then((key) => {
        if (active) setNeedsKey(!key);
      });
      return () => {
        active = false;
      };
    }, [settings.reasoning])
  );

  // GPT-OSS 120B (Groq) is text-only — hide the photo option entirely rather
  // than accept a photo that silently gets dropped.
  const photoSupported = settings.reasoning === "gemini";

  const voice = useVoiceInput(settings.voice, (text) => {
    triage.setDescription(triage.description ? `${triage.description} ${text}` : text);
  });

  const canSubmit = triage.description.trim().length > 0;

  async function pickPhoto(fromCamera: boolean) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.6 });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      triage.setPhoto(asset.uri, asset.base64 ?? undefined, asset.mimeType ?? undefined);
    }
  }

  async function useCurrentLocation() {
    setLocationBusy(true);
    setLocationNote(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setLocationNote("Location permission was not granted.");
        setUsingGps(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      triage.setCoords(
        { lat: pos.coords.latitude, lng: pos.coords.longitude },
        "Current location"
      );
      triage.setLocationText("");
      setUsingGps(true);
    } catch {
      setLocationNote("Could not get your location. You can type it instead.");
      setUsingGps(false);
    } finally {
      setLocationBusy(false);
    }
  }

  function handleSubmit() {
    if (!canSubmit) return;
    router.push("/processing");
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>GetHelp!</Text>
        <View style={styles.headerRow}>
          <Text style={styles.title}>What happened?</Text>
          <View style={styles.headerActions}>
            <Pressable onPress={() => router.push("/history")} hitSlop={12}>
              <Text style={styles.historyLink}>History</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/settings")} hitSlop={12}>
              <Text style={styles.settingsLink}>Settings</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.subtitle}>
          Describe the injury in your own words. We'll help you figure out how urgently to get
          care.
        </Text>

        {needsKey && (
          <Pressable onPress={() => router.push("/settings")} style={styles.setupBanner}>
            <Text style={styles.setupBannerTitle}>Setup needed</Text>
            <Text style={styles.setupBannerText}>
              Add a free {settings.reasoning === "gemini" ? "Gemini" : "Groq"} API key in Settings
              to start. Your key stays on this device.
            </Text>
          </Pressable>
        )}

        <TextInput
          value={triage.description}
          onChangeText={triage.setDescription}
          placeholder="Describe what happened…"
          placeholderTextColor={colors.textMuted}
          multiline
          style={styles.textArea}
        />

        <View style={styles.row}>
          <Pressable
            onPress={voice.isListening ? voice.stop : voice.start}
            hitSlop={8}
            style={[
              styles.iconButton,
              voice.isListening && styles.iconButtonActive,
              !voice.isAvailable && styles.iconButtonDisabled,
            ]}
          >
            <Text style={styles.iconButtonText}>
              {voice.isListening ? "◼ Stop" : voice.isAvailable ? "🎤 Voice" : "🎤 Voice (unavailable)"}
            </Text>
          </Pressable>

          {photoSupported && (
            <>
              <Pressable onPress={() => pickPhoto(true)} hitSlop={8} style={styles.iconButton}>
                <Text style={styles.iconButtonText}>📷 Camera</Text>
              </Pressable>
              <Pressable onPress={() => pickPhoto(false)} hitSlop={8} style={styles.iconButton}>
                <Text style={styles.iconButtonText}>🖼 Gallery</Text>
              </Pressable>
            </>
          )}
        </View>
        {voice.error && <Text style={styles.errorText}>{voice.error}</Text>}
        {!voice.isAvailable && !voice.error && (
          <Text style={styles.helperText}>{VOICE_UNAVAILABLE_REASON}</Text>
        )}

        {photoSupported && triage.photoUri && (
          <View style={styles.photoPreviewWrap}>
            <Image source={{ uri: triage.photoUri }} style={styles.photoPreview} />
            <Pressable
              onPress={() => triage.setPhoto(undefined, undefined, undefined)}
              hitSlop={12}
              style={styles.removePhotoButton}
            >
              <Text style={styles.removePhoto}>Remove photo</Text>
            </Pressable>
          </View>
        )}
        {!photoSupported && (
          <Text style={styles.helperText}>
            Photo attachment needs a vision-capable model — switch to Gemini in Settings to enable
            it.
          </Text>
        )}

        <Text style={styles.label}>Where are you?</Text>
        <TextInput
          value={triage.locationText}
          onChangeText={(t) => {
            triage.setLocationText(t);
            setUsingGps(false);
            triage.setCoords(undefined);
          }}
          placeholder="Type an address or area"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          editable={!usingGps}
        />
        <Pressable
          onPress={useCurrentLocation}
          hitSlop={8}
          style={[styles.iconButton, usingGps && styles.iconButtonActive, styles.locationButton]}
        >
          <Text style={styles.iconButtonText}>
            {locationBusy ? "Locating…" : usingGps ? "✓ Using current location" : "📍 Use current location"}
          </Text>
        </Pressable>
        {locationNote && <Text style={styles.errorText}>{locationNote}</Text>}

        <PrimaryButton
          label="Continue"
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={styles.submit}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
    ...shadow.sm,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  // flexShrink lets the headline wrap instead of shoving the Settings chip
  // off the edge on a narrow phone.
  title: { ...type.display, color: colors.text, flexShrink: 1 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  historyLink: {
    ...type.small,
    color: colors.text,
    backgroundColor: colors.lime,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    overflow: "hidden",
  },
  settingsLink: {
    ...type.small,
    color: colors.text,
    backgroundColor: colors.cyan,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    overflow: "hidden",
  },
  subtitle: { ...type.body, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },
  setupBanner: {
    backgroundColor: colors.orange,
    borderWidth: border.width,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  setupBannerTitle: { ...type.label, color: colors.text, marginBottom: spacing.xs },
  setupBannerText: { ...type.small, color: colors.text },
  textArea: {
    ...type.body,
    color: colors.text,
    minHeight: 120,
    borderWidth: border.width,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    textAlignVertical: "top",
    ...shadow.sm,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  iconButton: {
    borderWidth: border.width,
    borderColor: colors.border,
    borderRadius: radius.md,
    // 48dp minimum touch target (Android accessibility guidance). These used
    // to hug the label so tightly that only a direct hit on the text
    // registered.
    minHeight: 48,
    justifyContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    ...shadow.sm,
  },
  iconButtonActive: { backgroundColor: colors.lime },
  iconButtonDisabled: { opacity: 0.5 },
  iconButtonText: { ...type.small, color: colors.text, fontWeight: "800" },
  errorText: { ...type.small, color: colors.danger, marginTop: spacing.xs },
  helperText: { ...type.small, color: colors.textMuted, marginTop: spacing.sm },
  photoPreviewWrap: { marginTop: spacing.sm },
  photoPreview: {
    width: "100%",
    height: 160,
    borderRadius: radius.md,
    borderWidth: border.width,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  removePhotoButton: { alignSelf: "flex-start", paddingVertical: spacing.sm, minHeight: 44, justifyContent: "center" },
  removePhoto: { ...type.small, color: colors.danger },
  label: { ...type.label, color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.xs },
  input: {
    ...type.body,
    color: colors.text,
    borderWidth: border.width,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    ...shadow.sm,
  },
  locationButton: { marginTop: spacing.sm, alignSelf: "flex-start" },
  submit: { marginTop: spacing.xl },
});
