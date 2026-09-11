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
  const [manualLocation, setManualLocation] = useState("");
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

  useEffect(() => {
    if (started.current) return;
    if (triage.coords) {
      started.current = true;
      runSearch(triage.coords);
    }
  }, [triage.coords, runSearch]);

  async function useGps() {
    setError(null);
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) {
      setError("Location permission was not granted.");
      return;
    }
    const pos = await Location.getCurrentPositionAsync({});
    const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    triage.setCoords(coords, "Current location");
    started.current = true;
    runSearch(coords);
  }

  async function useTypedLocation() {
    if (!manualLocation.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const geo = await geocode(settings.geocoding, manualLocation.trim());
      const coords = { lat: geo.lat, lng: geo.lng };
      triage.setCoords(coords, geo.displayName);
      started.current = true;
      await runSearch(coords);
    } catch (err) {
      setError(err instanceof GeocodingError ? err.message : "Could not resolve that location.");
      setLoading(false);
    }
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
          />
          <View style={styles.locationButtonsRow}>
            <PrimaryButton label="Use this" variant="outline" onPress={useTypedLocation} style={styles.locationBtn} />
            <PrimaryButton label="Use current location" onPress={useGps} style={styles.locationBtn} />
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
