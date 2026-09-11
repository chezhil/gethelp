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
import type { VoiceProvider } from "../store/settings";

type SpeechModule = typeof import("expo-speech-recognition");

let cachedModule: SpeechModule | null | undefined;

function loadSpeechModule(): SpeechModule | null {
  if (cachedModule !== undefined) return cachedModule;
  if (!requireOptionalNativeModule("ExpoSpeechRecognition")) {
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

interface UseVoiceInputResult {
  isListening: boolean;
  /** false in Expo Go / any build missing the native module. */
  isAvailable: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

export function useVoiceInput(
  _provider: VoiceProvider,
  onTranscript: (text: string) => void
): UseVoiceInputResult {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const mod = loadSpeechModule();
  const isAvailable = mod !== null;

  useEffect(() => {
    if (!mod) return;
    const native = mod.ExpoSpeechRecognitionModule;
    const subscriptions = [
      native.addListener("result", (event) => {
        const text = event.results?.[0]?.transcript;
        if (text) onTranscriptRef.current(text);
      }),
      native.addListener("end", () => setIsListening(false)),
      native.addListener("error", (event) => {
        setIsListening(false);
        setError(event.message ?? "Speech recognition failed.");
      }),
    ];
    return () => subscriptions.forEach((s) => s.remove());
  }, [mod]);

  const start = useCallback(async () => {
    if (!mod) {
      setError("Voice input needs a development build — it isn't available in Expo Go.");
      return;
    }
    setError(null);
    const perm = await mod.ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      setError("Microphone/speech permission was not granted.");
      return;
    }
    setIsListening(true);
    mod.ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      interimResults: true,
      continuous: false,
    });
  }, [mod]);

  const stop = useCallback(() => {
    mod?.ExpoSpeechRecognitionModule.stop();
    setIsListening(false);
  }, [mod]);

  return { isListening, isAvailable, error, start, stop };
}
