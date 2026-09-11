import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { PrimaryButton } from "../components/PrimaryButton";
import { border, CONTENT_MAX_WIDTH, radius, shadow, spacing, type, type Colors } from "../constants/theme";
import { useTheme, useThemedStyles } from "../lib/store/theme";
import { assessSeverity } from "../lib/providers/reasoning";
import { getMedicalProfile, useProviderSettings } from "../lib/store/settings";
import { useTriage } from "../lib/store/triage";

const LOADING_MESSAGES = ["Analyzing your description…", "Thinking this through…"];

type Phase = "loading" | "clarify" | "error";

export default function ProcessingScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { settings, loaded } = useProviderSettings();
  const triage = useTriage();

  const [phase, setPhase] = useState<Phase>("loading");
  const [messageIndex, setMessageIndex] = useState(0);
  const [clarifyingQuestion, setClarifyingQuestion] = useState("");
  const [clarifyAnswer, setClarifyAnswer] = useState("");
  const [errorText, setErrorText] = useState("");
  const attempted = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setMessageIndex((i) => (i + 1) % LOADING_MESSAGES.length), 2200);
    return () => clearInterval(id);
  }, []);

  async function runAssessment(skipClarification = false) {
    setPhase("loading");
    setErrorText("");
    try {
      const medicalProfile = await getMedicalProfile();
      const result = await assessSeverity(settings.reasoning, {
        description: triage.description,
        medicalProfile,
        photoBase64: settings.reasoning === "gemini" ? triage.photoBase64 : undefined,
        photoMimeType: settings.reasoning === "gemini" ? triage.photoMimeType : undefined,
        skipClarification,
      });
      if (result.needsMoreInfo) {
        setClarifyingQuestion(result.clarifyingQuestion ?? "Can you share a bit more detail?");
        setPhase("clarify");
        return;
      }
      triage.setResult(result);
      router.replace("/result");
    } catch (err) {
      // Every provider error already carries a written-for-humans message
      // (see lib/providers/http.ts), including network drops — so show it
      // rather than replacing it with something vaguer.
      setErrorText(
        err instanceof Error && err.message
          ? err.message
          : "Something went wrong. Please try again."
      );
      setPhase("error");
    }
  }

  useEffect(() => {
    if (!loaded || attempted.current) return;
    attempted.current = true;
    runAssessment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  function submitClarification() {
    if (!clarifyAnswer.trim()) return;
    triage.appendClarification(clarifyAnswer.trim());
    setClarifyAnswer("");
    runAssessment();
  }

  function skipClarification() {
    runAssessment(true);
  }

  if (phase === "clarify") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>One more thing</Text>
        <Text style={styles.question}>{clarifyingQuestion}</Text>
        <TextInput
          value={clarifyAnswer}
          onChangeText={setClarifyAnswer}
          placeholder="Type your answer…"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          multiline
          autoFocus
        />
        <PrimaryButton
          label="Continue"
          onPress={submitClarification}
          disabled={!clarifyAnswer.trim()}
          style={styles.button}
        />
        <PrimaryButton
          label="Skip — use what I've already given"
          variant="outline"
          onPress={skipClarification}
          style={styles.button}
        />
      </View>
    );
  }

  if (phase === "error") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Couldn't complete the assessment</Text>
        <View style={styles.errorBox}>
          <Text style={styles.errorBoxText}>{errorText}</Text>
        </View>
        <PrimaryButton label="Try again" onPress={() => runAssessment()} style={styles.button} />
        <PrimaryButton
          label="Back"
          variant="outline"
          onPress={() => router.back()}
          style={styles.button}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={styles.loadingText}>{LOADING_MESSAGES[messageIndex]}</Text>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    backgroundColor: colors.bg,
    gap: spacing.md,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
  title: { ...type.title, color: colors.text, textAlign: "center" },
  errorBox: {
    width: "100%",
    backgroundColor: colors.orange,
    borderWidth: border.width,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.sm,
  },
  question: { ...type.body, color: colors.textMuted, textAlign: "center" },
  errorBoxText: { ...type.body, color: colors.text, textAlign: "center" },
  loadingText: { ...type.body, color: colors.textMuted },
  input: {
    ...type.body,
    color: colors.text,
    width: "100%",
    minHeight: 90,
    borderWidth: border.width,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    textAlignVertical: "top",
    ...shadow.sm,
  },
  button: { width: "100%", marginTop: spacing.sm },
});
