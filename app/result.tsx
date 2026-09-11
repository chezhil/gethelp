import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Disclaimer } from "../components/Disclaimer";
import { FacilityCard } from "../components/FacilityCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { SeverityBadge } from "../components/SeverityBadge";
import { colors, radius, severityAction, spacing, type } from "../constants/theme";
import { geocode, GeocodingError } from "../lib/providers/geocoding";
import { nearbyFacilities, NearbyError } from "../lib/providers/nearby";
import { route as fetchRoute } from "../lib/providers/directions";
import { useProviderSettings } from "../lib/store/settings";
import { useTriage } from "../lib/store/triage";
import type { Coords, NearbyFacility } from "../lib/types";

export default function ResultScreen() {
  const router = useRouter();
  const { settings } = useProviderSettings();
  const triage = useTriage();
  const result = triage.result;

  if (!result) {
    // Guards against a direct/refresh navigation with no session in memory.
    return (
      <View style={styles.center}>
        <Text style={type.body}>No assessment in progress.</Text>
        <PrimaryButton label="Start over" onPress={() => router.replace("/")} style={{ marginTop: spacing.md }} />
      </View>
    );
  }

  const isUrgent = result.severityTier === "severe" || result.severityTier === "critical";

  function startOver() {
    triage.reset();
    router.replace("/");
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {isUrgent && (
        <Pressable
          onPress={() => Linking.openURL("tel:112")}
          style={styles.emergencyCta}
        >
          <Text style={styles.emergencyCtaText}>🚨 Call emergency services</Text>
        </Pressable>
      )}

      <SeverityBadge tier={result.severityTier} />
      <Text style={styles.nature}>{result.likelyNature}</Text>

      <Text style={styles.sectionLabel}>Recommended</Text>
      <Text style={styles.action}>{result.recommendedAction || severityAction[result.severityTier]}</Text>

      {result.redFlags.length > 0 && (
        <View style={styles.flagsBox}>
          <Text style={styles.sectionLabel}>Noted in your description</Text>
          {result.redFlags.map((flag, i) => (
            <Text key={i} style={styles.flag}>
              · {flag}
            </Text>
          ))}
        </View>
      )}

      <FacilitiesSection tier={result.severityTier} />

      <PrimaryButton label="Start over" variant="outline" onPress={startOver} style={styles.startOver} />
      <Disclaimer />
    </ScrollView>
  );
}

function FacilitiesSection({ tier }: { tier: string }) {
  const { settings } = useProviderSettings();
  const triage = useTriage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Pre-fill with whatever the user already typed on the input screen —
  // don't make them retype a location they already gave us.
  const [manualLocation, setManualLocation] = useState(triage.locationText);
  const [gpsBusy, setGpsBusy] = useState(false);
  const started = useRef(false);

  const runSearch = useCallback(
    async (coords: Coords) => {
      setLoading(true);
      setError(null);
      try {
        const facilities = await nearbyFacilities(settings.nearby, coords, tier as any);
        if (facilities.length === 0) {
          setError(
            settings.nearby === "overpass"
              ? "No facilities found nearby. Try switching Nearby Search to Google Places in Settings."
              : "No facilities found nearby."
          );
          triage.setFacilities([]);
          return;
        }
        const withEta = await Promise.all(
          facilities.slice(0, 5).map(async (f): Promise<NearbyFacility> => {
            try {
              const r = await fetchRoute(settings.directions, coords, { lat: f.lat, lng: f.lng });
              return { ...f, etaSeconds: r.durationSeconds, etaMeters: r.distanceMeters };
            } catch {
              return f; // keep the facility even if ETA lookup failed for it
            }
          })
        );
        withEta.sort((a, b) => (a.etaSeconds ?? Infinity) - (b.etaSeconds ?? Infinity));
        triage.setFacilities(withEta);
      } catch (err) {
        const msg = err instanceof NearbyError ? err.message : "Could not load nearby facilities.";
        setError(msg);
        triage.setFacilities(undefined, msg);
      } finally {
        setLoading(false);
      }
    },
    [settings.nearby, settings.directions, tier]
  );

  const resolveAndSearch = useCallback(
    async (query: string) => {
      setLoading(true);
      setError(null);
      try {
        const geo = await geocode(settings.geocoding, query);
        const coords = { lat: geo.lat, lng: geo.lng };
        triage.setCoords(coords, geo.displayName);
        await runSearch(coords);
      } catch (err) {
        setError(err instanceof GeocodingError ? err.message : "Could not resolve that location.");
        setLoading(false);
      }
    },
    [settings.geocoding, runSearch]
  );

  useEffect(() => {
    if (started.current) return;
    if (triage.coords) {
      started.current = true;
      runSearch(triage.coords);
    } else if (triage.locationText.trim()) {
      // The user already typed a location on the input screen — resolve it
      // automatically instead of asking them to type it again here.
      started.current = true;
      resolveAndSearch(triage.locationText.trim());
    }
  }, [triage.coords, triage.locationText, runSearch, resolveAndSearch]);

  async function useGps() {
    setError(null);
    setGpsBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setError("Location permission was not granted.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      triage.setCoords(coords, "Current location");
      started.current = true;
      await runSearch(coords);
    } catch {
      setError("Could not get your location. Try typing it instead.");
    } finally {
      setGpsBusy(false);
    }
  }

  function useTypedLocation() {
    if (!manualLocation.trim()) return;
    started.current = true;
    resolveAndSearch(manualLocation.trim());
  }

  return (
    <View style={styles.facilitiesWrap}>
      <Text style={styles.sectionLabel}>Nearby care</Text>

      {!triage.coords && (
        <View style={styles.locationPrompt}>
          <Text style={styles.helperText}>Add a location to see nearby facilities.</Text>
          <TextInput
            value={manualLocation}
            onChangeText={setManualLocation}
            placeholder="Type an address or area"
            placeholderTextColor={colors.textMuted}
            style={styles.locationInput}
            editable={!loading && !gpsBusy}
          />
          <View style={styles.locationButtonsRow}>
            <PrimaryButton
              label="Use this"
              variant="outline"
              onPress={useTypedLocation}
              disabled={!manualLocation.trim() || gpsBusy}
              loading={loading}
              style={styles.locationBtn}
            />
            <PrimaryButton
              label="Use current location"
              onPress={useGps}
              disabled={loading}
              loading={gpsBusy}
              style={styles.locationBtn}
            />
          </View>
        </View>
      )}

      {loading && <Text style={styles.helperText}>Finding nearby help…</Text>}
      {!!error && <Text style={styles.errorText}>{error}</Text>}

      {triage.facilities?.map((f) => (
        <FacilityCard key={f.id} facility={f} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingTop: spacing.xxl, backgroundColor: colors.bg, flexGrow: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  emergencyCta: {
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  emergencyCtaText: { color: "#FFF", fontSize: 18, fontWeight: "700" },
  nature: { ...type.title, color: colors.text, marginTop: spacing.md },
  sectionLabel: { ...type.label, color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.xs },
  action: { ...type.bodyStrong, color: colors.text },
  flagsBox: { marginTop: spacing.xs },
  flag: { ...type.body, color: colors.text },
  facilitiesWrap: { marginTop: spacing.sm },
  helperText: { ...type.small, color: colors.textMuted, marginBottom: spacing.xs },
  errorText: { ...type.small, color: colors.danger, marginBottom: spacing.xs },
  locationPrompt: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  locationInput: {
    ...type.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.xs,
    backgroundColor: colors.bg,
  },
  locationButtonsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  locationBtn: { flex: 1, minHeight: 42, paddingVertical: spacing.sm },
  startOver: { marginTop: spacing.xl },
});
