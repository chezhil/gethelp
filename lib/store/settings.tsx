// Per-function provider selection + BYOK API keys.
// Provider choice lives in AsyncStorage (not secret); keys live in the
// device keychain on native and localStorage on web (see keyStore below).
// Nothing here ever leaves the device except direct calls to the chosen provider's own API.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

export type ReasoningProvider = "groq" | "gemini";
export type VoiceProvider = "device" | "google";
export type GeocodingProvider = "nominatim" | "google";
export type DirectionsProvider = "osrm" | "google";
export type NearbyProvider = "google";

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
  directions: "osrm",
  nearby: "google",
};

const SETTINGS_KEY = "triage.providerSettings.v1";

// Which SecureStore key holds which provider's API key.
export const API_KEY_SLOTS = {
  groq: "triage.key.groq",
  gemini: "triage.key.gemini",
  google: "triage.key.google", // shared across Google Speech/Geocoding/Directions/Places
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

/**
 * Where API keys are kept.
 *
 * expo-secure-store has no web implementation at all — its web module is
 * literally `export default {}` — so on web every read and write would throw
 * and no key would ever persist. Web falls back to localStorage instead.
 * That's less protected than the iOS keychain / Android keystore (any script
 * on the same origin can read it), which is the honest trade for running in a
 * browser; the key still never leaves the device except to its own provider.
 */
const keyStore =
  Platform.OS === "web"
    ? {
        async get(key: string) {
          try {
            return globalThis.localStorage?.getItem(key) ?? null;
          } catch {
            return null; // private mode / storage disabled
          }
        },
        async set(key: string, value: string) {
          try {
            globalThis.localStorage?.setItem(key, value);
          } catch {}
        },
        async remove(key: string) {
          try {
            globalThis.localStorage?.removeItem(key);
          } catch {}
        },
      }
    : {
        get: (key: string) => SecureStore.getItemAsync(key),
        set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
        remove: (key: string) => SecureStore.deleteItemAsync(key),
      };

export async function getApiKey(slot: ApiKeySlot): Promise<string | null> {
  try {
    return await keyStore.get(API_KEY_SLOTS[slot]);
  } catch {
    return null;
  }
}

export async function setApiKey(slot: ApiKeySlot, value: string): Promise<void> {
  try {
    if (!value) {
      await keyStore.remove(API_KEY_SLOTS[slot]);
      return;
    }
    await keyStore.set(API_KEY_SLOTS[slot], value);
  } catch {
    // Storage unavailable (private browsing, blocked cookies). The key still
    // works for this session — it just won't be remembered.
  }
}

interface ProviderSettingsState {
  settings: ProviderSettings;
  update: (patch: Partial<ProviderSettings>) => void;
  loaded: boolean;
}

// One shared source of truth for the whole app. This has to be a context, not
// per-component state: expo-router keeps a screen mounted when you push
// another on top of it, so the Input screen never re-reads storage after you
// change a provider on the Settings screen. With per-component state, picking
// Gemini in Settings left the Input screen still believing it was on Groq,
// and the photo-attach button — gated on the reasoning provider — never
// appeared.
const ProviderSettingsContext = createContext<ProviderSettingsState | null>(null);

export function ProviderSettingsProvider({ children }: { children: React.ReactNode }) {
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

  const value = useMemo<ProviderSettingsState>(
    () => ({ settings, update, loaded }),
    [settings, update, loaded]
  );

  return (
    <ProviderSettingsContext.Provider value={value}>{children}</ProviderSettingsContext.Provider>
  );
}

/** Current settings + a setter that persists on every change, shared app-wide. */
export function useProviderSettings(): ProviderSettingsState {
  const ctx = useContext(ProviderSettingsContext);
  if (!ctx) throw new Error("useProviderSettings must be used within a ProviderSettingsProvider");
  return ctx;
}
