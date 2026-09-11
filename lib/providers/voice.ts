// Voice-to-text adapters. "device" uses the platform's native speech recognizer
// (expo-speech-recognition) and needs no key. "google" is a placeholder hook for
// Google Speech-to-Text, wired through the same event-based interface.

import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useCallback, useState } from "react";
import type { VoiceProvider } from "../store/settings";

interface UseVoiceInputResult {
  isListening: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

/**
 * Starts/stops recognition and calls onTranscript with the running transcript
 * as it updates. Currently backs both "device" and "google" the same way —
 * expo-speech-recognition uses the platform recognizer either way on-device;
 * swapping in a real server-side Google STT call only touches this file.
 */
export function useVoiceInput(
  _provider: VoiceProvider,
  onTranscript: (text: string) => void
): UseVoiceInputResult {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results?.[0]?.transcript;
    if (text) onTranscript(text);
  });

  useSpeechRecognitionEvent("end", () => setIsListening(false));

  useSpeechRecognitionEvent("error", (event) => {
    setIsListening(false);
    setError(event.message ?? "Speech recognition failed.");
  });

  const start = useCallback(async () => {
    setError(null);
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      setError("Microphone/speech permission was not granted.");
      return;
    }
    setIsListening(true);
    ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      interimResults: true,
      continuous: false,
    });
  }, []);

  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
    setIsListening(false);
  }, []);

  return { isListening, error, start, stop };
}
