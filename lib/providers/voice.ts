// Voice-to-text adapters. "device" uses the platform's native speech recognizer
// (expo-speech-recognition) and needs no key. "google" is a placeholder hook for
// Google Speech-to-Text, wired through the same event-based interface.
//
// expo-speech-recognition wraps a real native module that only exists in a
// custom dev build or a production build — Expo Go does not ship it. The
// package resolves that module by calling Expo's requireNativeModule(),
// which throws unconditionally (and, in dev, logs before throwing) the
// moment the package is evaluated if the module isn't linked — wrapping the
// `require("expo-speech-recognition")` call itself in try/catch still stops
// it from crashing the app, but doesn't stop the dev error overlay from
// flashing up, which is a bad look for a demo.
//
// So instead we check for the native module first using Expo's own
// requireOptionalNativeModule(), which returns null instead of throwing.
// Only when that confirms the module is actually linked do we pull in the
// full expo-speech-recognition package — meaning the throwing code path
// inside it never runs at all when the module is missing.

import { requireOptionalNativeModule } from "expo-modules-core";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import type { VoiceProvider } from "../store/settings";

type SpeechModule = typeof import("expo-speech-recognition");

let cachedModule: SpeechModule | null | undefined;

function loadSpeechModule(): SpeechModule | null {
  if (cachedModule !== undefined) return cachedModule;
  // On web the package resolves to a registerWebModule() implementation
  // backed by the browser's own Web Speech API, so there's no native module
  // to probe for and the throwing requireNativeModule path never runs —
  // probing there would wrongly report voice as unavailable.
  if (Platform.OS !== "web" && !requireOptionalNativeModule("ExpoSpeechRecognition")) {
    cachedModule = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cachedModule = require("expo-speech-recognition") as SpeechModule;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

/** Web only: the module loads everywhere, but Firefox has no Web Speech API. */
function browserSupportsSpeech(mod: SpeechModule | null): boolean {
  if (!mod) return false;
  if (Platform.OS !== "web") return true;
  try {
    return mod.ExpoSpeechRecognitionModule.isRecognitionAvailable() !== false;
  } catch {
    return false;
  }
}

/** Why voice is unavailable, phrased for wherever the app is running. */
export const VOICE_UNAVAILABLE_REASON =
  Platform.OS === "web"
    ? "Voice input isn't supported in this browser — try Chrome or Edge."
    : "Voice input needs a development build — it isn't available in Expo Go.";

interface UseVoiceInputResult {
  isListening: boolean;
  /** false in Expo Go / any build missing the native module. */
  isAvailable: boolean;
  /**
   * What the recognizer thinks it is hearing right now, before it commits.
   * Shown live under the text box so you can see it working — never written
   * into the description, since it changes on every keystroke of speech.
   */
  partialTranscript: string;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

/** Recognizer error codes, said in words that mean something to the person talking. */
function describeSpeechError(code: string | undefined, message: string | undefined): string {
  switch (code) {
    case "no-speech":
      return "Didn't catch anything — check the mic isn't muted and try again.";
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow it for this site in your browser settings, then try again.";
    case "audio-capture":
      return "No microphone found.";
    case "network":
      return "Speech recognition needs a network connection, and the request didn't get through.";
    case "language-not-supported":
      return "This device's recognizer doesn't support English (US).";
    case "aborted":
      return ""; // we stopped it on purpose — not worth an error message
    default:
      return message || "Speech recognition failed. Try again, or type instead.";
  }
}

export function useVoiceInput(
  _provider: VoiceProvider,
  onTranscript: (text: string) => void
): UseVoiceInputResult {
  const [isListening, setIsListening] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  /** Last interim text, so an utterance that ends without a final isn't lost. */
  const pendingRef = useRef("");

  const mod = loadSpeechModule();
  const isAvailable = browserSupportsSpeech(mod);

  useEffect(() => {
    if (!mod) return;
    const native = mod.ExpoSpeechRecognitionModule;

    const commit = (text: string) => {
      const trimmed = text.trim();
      pendingRef.current = "";
      setPartialTranscript("");
      if (trimmed) onTranscriptRef.current(trimmed);
    };

    const subscriptions = [
      // Interim results arrive continuously, each one a longer version of the
      // same utterance — "my", "my arm", "my arm is". Only the final result
      // is written into the description; the interim text is shown live
      // instead. Appending every interim event (which is what this used to
      // do) produced "my my arm my arm is my arm is bleeding".
      native.addListener("result", (event) => {
        const text = event.results?.[0]?.transcript ?? "";
        if (event.isFinal) {
          commit(text);
        } else {
          pendingRef.current = text;
          setPartialTranscript(text);
        }
      }),
      // A recognizer can stop on its own — a long pause, or the OS deciding
      // the utterance is over — sometimes without a final result. Flush
      // whatever it had heard rather than silently dropping the sentence.
      native.addListener("end", () => {
        setIsListening(false);
        if (pendingRef.current) commit(pendingRef.current);
      }),
      native.addListener("error", (event) => {
        setIsListening(false);
        // Keep the words even if the session ended badly.
        if (pendingRef.current) commit(pendingRef.current);
        const msg = describeSpeechError(event.error, event.message);
        setError(msg || null);
      }),
    ];
    return () => subscriptions.forEach((s) => s.remove());
  }, [mod]);

  const start = useCallback(async () => {
    if (!isAvailable || !mod) {
      setError(VOICE_UNAVAILABLE_REASON);
      return;
    }
    setError(null);
    pendingRef.current = "";
    setPartialTranscript("");
    const perm = await mod.ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      setError(
        "Microphone access was denied. Allow it for this site in your browser settings, then try again."
      );
      return;
    }
    setIsListening(true);
    mod.ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      interimResults: true,
      // Someone describing an injury pauses to think, and a non-continuous
      // recognizer treats the first pause as the end of the sentence. Keep
      // listening until they press Stop; each completed sentence commits as
      // its own final result and appends.
      continuous: true,
    });
  }, [mod, isAvailable]);

  const stop = useCallback(() => {
    // stop() asks for a final result first; the pending flush in the "end"
    // listener covers the case where none arrives.
    mod?.ExpoSpeechRecognitionModule.stop();
    setIsListening(false);
  }, [mod]);

  return { isListening, isAvailable, partialTranscript, error, start, stop };
}
