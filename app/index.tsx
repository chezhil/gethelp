import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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
import { PhotoDropZone } from "../components/PhotoDropZone";
import { PrimaryButton } from "../components/PrimaryButton";
import { border, CONTENT_MAX_WIDTH, radius, shadow, spacing, type, type Colors } from "../constants/theme";
import { useTheme, useThemedStyles } from "../lib/store/theme";
import { hasOnboarded } from "../lib/store/onboarding";
import { getApiKey, useProviderSettings } from "../lib/store/settings";
import { useTriage } from "../lib/store/triage";
import { useVoiceInput, VOICE_UNAVAILABLE_REASON } from "../lib/providers/voice";

export default function InputScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { settings } = useProviderSettings();
  const triage = useTriage();
  const [needsKey, setNeedsKey] = useState(false);
  // Drag-and-drop only earns its space where there's something to drag with.
  // Ask about the pointer rather than the window width: a narrow desktop
  // window is still a PC, and a big tablet still has no mouse. On touch
  // devices the Camera and Gallery buttons are the right affordance.
  const [showDropZone] = useState(
    () =>
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches
  );
  const [locationStatus, setLocationStatus] = useState<"pending" | "ready" | "unavailable">(
    "pending"
  );
  // undefined until storage answers — rendering the input screen first and
  // then yanking it away would flash the wrong screen on every cold start.
  const [onboarded, setOnboarded] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let active = true;
    hasOnboarded().then((done) => {
      if (!active) return;
      setOnboarded(done);
      if (!done) router.replace("/welcome");
    });
    return () => {
      active = false;
    };
  }, [router]);

  // Location is handled for you: we ask for it once on open and keep it in
  // the background. There's no location field — if you'd rather say where you
  // are, just write it into the description and that takes precedence (the
  // model returns it as locationMentioned, and the result screen prefers it).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) {
          if (active) setLocationStatus("unavailable");
          return;
        }
        const pos = await Location.getCurrentPositionAsync({});
        if (!active) return;
        triage.setCoords(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          "Current location"
        );
        setLocationStatus("ready");
      } catch {
        if (active) setLocationStatus("unavailable");
      }
    })();
    return () => {
      active = false;
    };
    // Runs once on open; triage.setCoords is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Functional update: two sentences can finalize in the same tick, and
  // reading triage.description from the closure would lose the first one.
  const voice = useVoiceInput(settings.voice, (text) => {
    triage.setDescription((prev) => (prev ? `${prev} ${text}` : text));
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

  function handleSubmit() {
    if (!canSubmit) return;
    router.push("/processing");
  }

  // Blank rather than a spinner: this resolves in a frame or two, and a
  // spinner that appears and vanishes reads as jank.
  if (onboarded === undefined || !onboarded) return <View style={styles.blank} />;

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
              {settings.reasoning === "gemini"
                ? "Add a Gemini API key in Settings to start — free from Google AI Studio. No Google account? Switch to Groq in Settings instead."
                : "Add a free Groq API key in Settings to start — no card needed."}{" "}
              Your key stays on this device.
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
              {voice.isListening
                ? "◼ Stop listening"
                : voice.isAvailable
                  ? "🎤 Voice"
                  : "🎤 Voice (unavailable)"}
            </Text>
          </Pressable>

          {photoSupported && !showDropZone && (
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
        {voice.isListening && (
          <View style={styles.listeningBox}>
            <Text style={styles.listeningLabel}>Listening — press Stop when you're done</Text>
            {!!voice.partialTranscript && (
              <Text style={styles.listeningText}>{voice.partialTranscript}</Text>
            )}
          </View>
        )}
        {voice.error && <Text style={styles.errorText}>{voice.error}</Text>}
        {!voice.isAvailable && !voice.error && (
          <Text style={styles.helperText}>{VOICE_UNAVAILABLE_REASON}</Text>
        )}

        {photoSupported && showDropZone && !triage.photoUri && (
          <PhotoDropZone
            onPhoto={(uri, base64, mimeType) => triage.setPhoto(uri, base64, mimeType)}
          />
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

        <Text style={styles.locationStatus}>
          {locationStatus === "ready"
            ? "📍 Using your current location. Mention a place in the description to use that instead."
            : locationStatus === "pending"
              ? "📍 Getting your location…"
              : "📍 Location unavailable — mention where you are in the description."}
        </Text>

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

const makeStyles = (colors: Colors) => StyleSheet.create({
  blank: { flex: 1, backgroundColor: colors.bg },
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
    borderWidth: border.width,
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
    borderWidth: border.width,
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
  iconButtonText: { ...type.small, color: colors.text, fontWeight: "600" },
  errorText: { ...type.small, color: colors.danger, marginTop: spacing.xs },
  // Live view of what the recognizer is hearing, so a long pause doesn't look
  // like a hang. Tinted rather than bordered — it comes and goes, and a box
  // that appears mid-form shouldn't shove the layout around.
  listeningBox: {
    marginTop: spacing.sm,
    backgroundColor: colors.cyan,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  listeningLabel: { ...type.label, color: colors.textMuted },
  listeningText: { ...type.body, color: colors.text, marginTop: spacing.xs },
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
  locationStatus: { ...type.small, color: colors.textMuted, marginTop: spacing.md },
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
