import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useState } from "react";
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
import { colors, radius, spacing, type } from "../constants/theme";
import { useProviderSettings } from "../lib/store/settings";
import { useTriage } from "../lib/store/triage";
import { useVoiceInput } from "../lib/providers/voice";

export default function InputScreen() {
  const router = useRouter();
  const { settings } = useProviderSettings();
  const triage = useTriage();
  const [usingGps, setUsingGps] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);

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
      triage.setPhoto(result.assets[0].uri, result.assets[0].base64 ?? undefined);
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
          <Pressable onPress={() => router.push("/settings")} hitSlop={12}>
            <Text style={styles.settingsLink}>Settings</Text>
          </Pressable>
        </View>
        <Text style={styles.subtitle}>
          Describe the injury in your own words. We'll help you figure out how urgently to get
          care.
        </Text>

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
              <Pressable onPress={() => pickPhoto(true)} style={styles.iconButton}>
                <Text style={styles.iconButtonText}>📷 Camera</Text>
              </Pressable>
              <Pressable onPress={() => pickPhoto(false)} style={styles.iconButton}>
                <Text style={styles.iconButtonText}>🖼 Gallery</Text>
              </Pressable>
            </>
          )}
        </View>
        {voice.error && <Text style={styles.errorText}>{voice.error}</Text>}
        {!voice.isAvailable && !voice.error && (
          <Text style={styles.helperText}>
            Voice input needs a development build — it isn't available in Expo Go.
          </Text>
        )}

        {photoSupported && triage.photoUri && (
          <View style={styles.photoPreviewWrap}>
            <Image source={{ uri: triage.photoUri }} style={styles.photoPreview} />
            <Pressable onPress={() => triage.setPhoto(undefined, undefined)}>
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
  },
  brand: { ...type.label, color: colors.accent, marginBottom: spacing.xs },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { ...type.display, color: colors.text },
  settingsLink: { ...type.small, color: colors.accent, fontWeight: "600" },
  subtitle: { ...type.body, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },
  textArea: {
    ...type.body,
    color: colors.text,
    minHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    textAlignVertical: "top",
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  iconButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  iconButtonActive: { backgroundColor: colors.powder, borderColor: colors.powderText },
  iconButtonDisabled: { opacity: 0.5 },
  iconButtonText: { ...type.small, color: colors.text, fontWeight: "600" },
  errorText: { ...type.small, color: colors.danger, marginTop: spacing.xs },
  helperText: { ...type.small, color: colors.textMuted, marginTop: spacing.sm },
  photoPreviewWrap: { marginTop: spacing.sm },
  photoPreview: { width: "100%", height: 160, borderRadius: radius.md, backgroundColor: colors.border },
  removePhoto: { ...type.small, color: colors.danger, marginTop: spacing.xs },
  label: { ...type.label, color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.xs },
  input: {
    ...type.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  locationButton: { marginTop: spacing.sm, alignSelf: "flex-start" },
  submit: { marginTop: spacing.xl },
});
