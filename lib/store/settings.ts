// Per-function provider selection + BYOK API keys.
// Provider choice lives in AsyncStorage (not secret); keys live in SecureStore.
// Nothing here ever leaves the device except direct calls to the chosen provider's own API.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useState } from "react";

export type ReasoningProvider = "groq" | "gemini";
export type VoiceProvider = "device" | "google";
export type GeocodingProvider = "nominatim" | "google";
export type DirectionsProvider = "mapbox" | "google";
export type NearbyProvider = "overpass" | "google";

export interface ProviderSettings {
  reasoning: ReasoningProvider;
  voice: VoiceProvider;
  geocoding: GeocodingProvider;
  directions: DirectionsProvider;
  nearby: NearbyProvider;
}

export const DEFAULT_SETTINGS: ProviderSettings = {
  reasoning: "groq",
  voice: "device",
  geocoding: "nominatim",
  directions: "mapbox",
  nearby: "overpass",
};

const SETTINGS_KEY = "triage.providerSettings.v1";

// Which SecureStore key holds which provider's API key.
export const API_KEY_SLOTS = {
  groq: "triage.key.groq",
  gemini: "triage.key.gemini",
  google: "triage.key.google", // shared across Google Speech/Geocoding/Directions/Places
  mapbox: "triage.key.mapbox",
} as const;

export type ApiKeySlot = keyof typeof API_KEY_SLOTS;

export async function loadSettings(): Promise<ProviderSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: ProviderSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function getApiKey(slot: ApiKeySlot): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(API_KEY_SLOTS[slot]);
  } catch {
    return null;
  }
}

export async function setApiKey(slot: ApiKeySlot, value: string): Promise<void> {
  if (!value) {
    await SecureStore.deleteItemAsync(API_KEY_SLOTS[slot]).catch(() => {});
    return;
  }
  await SecureStore.setItemAsync(API_KEY_SLOTS[slot], value);
}

/** Hook: current settings + a setter that persists on every change. */
export function useProviderSettings() {
  const [settings, setSettings] = useState<ProviderSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      setLoaded(true);
    });
  }, []);

  const update = useCallback((patch: Partial<ProviderSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  return { settings, update, loaded };
}
