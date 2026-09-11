import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Disclaimer } from "../components/Disclaimer";
import { localEmergencyNumber } from "../lib/emergency";
import { FacilityCard } from "../components/FacilityCard";
import { FacilityMap } from "../components/FacilityMap";
import { PrimaryButton } from "../components/PrimaryButton";
import { SeverityBadge } from "../components/SeverityBadge";
import { border, CONTENT_MAX_WIDTH, radius, severityAction, shadow, spacing, type, type Colors } from "../constants/theme";
import { useTheme, useThemedStyles } from "../lib/store/theme";
import { geocode } from "../lib/providers/geocoding";
import { nearbyFacilities } from "../lib/providers/nearby";
import { route as fetchRoute } from "../lib/providers/directions";
import { addHistoryEntry } from "../lib/store/history";
import { useProviderSettings } from "../lib/store/settings";
import { useTriage } from "../lib/store/triage";
import type { Coords, NearbyFacility, SeverityTier } from "../lib/types";

export default function ResultScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const triage = useTriage();
  const result = triage.result;
  const saved = useRef(false);

  // Record the assessment in this browser's history. Runs once per result, and
  // waits a beat for the facility search so the saved entry can include the
  // nearest one — but saves regardless if that search never lands, since the
  // assessment itself is the thing worth keeping.
  useEffect(() => {
    if (!result || saved.current) return;

    const save = () => {
      if (saved.current) return;
      saved.current = true;
      const nearest = triage.facilities?.[0];
      addHistoryEntry({
        description: triage.description,
        result,
        locationLabel: triage.resolvedLocationLabel,
        nearestFacility: nearest
          ? { name: nearest.name, etaSeconds: nearest.etaSeconds }
          : undefined,
      });
    };

    if (triage.facilities !== undefined || triage.facilitiesError) {
      save();
      return;
    }

    // With no location given the facility search never runs, so waiting on it
    // would mean never saving at all. Save the assessment on its own instead.
    const timer = setTimeout(save, 6000);
    return () => clearTimeout(timer);
  }, [
    result,
    triage.facilities,
    triage.facilitiesError,
    triage.description,
    triage.resolvedLocationLabel,
  ]);

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
  // Resolved once per screen, and shown on the button rather than hidden
  // behind it — if region detection got this wrong, the person dialling is
  // the only one who can catch it, and only if they can see the number.
  const emergencyNumber = localEmergencyNumber();

  function startOver() {
    triage.reset();
    router.replace("/");
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {isUrgent && (
        <Pressable
          onPress={() => Linking.openURL(`tel:${emergencyNumber}`)}
          accessibilityRole="button"
          accessibilityLabel={`Call emergency services on ${emergencyNumber}`}
          style={styles.emergencyCta}
        >
          <Text style={styles.emergencyCtaText}>🚨 Call emergency services</Text>
          <Text style={styles.emergencyCtaNumber}>{emergencyNumber}</Text>
        </Pressable>
      )}

      <SeverityBadge tier={result.severityTier} />
      <Text style={styles.nature}>{result.likelyNature}</Text>

      <Text style={styles.sectionLabel}>Recommended</Text>
      <Text style={styles.action}>{result.recommendedAction || severityAction[result.severityTier]}</Text>

      {!!result.summary && (
        <View style={styles.summaryBox}>
          <Text style={styles.sectionLabel}>What this might mean</Text>
          <Text style={styles.summaryText}>{result.summary}</Text>
        </View>
      )}

      {result.firstAidSteps.length > 0 && (
        <View style={styles.firstAidBox}>
          <Text style={styles.sectionLabel}>While you get help</Text>
          {result.firstAidSteps.map((step, i) => (
            <Text key={i} style={styles.firstAidStep}>
              {i + 1}. {step}
            </Text>
          ))}
        </View>
      )}

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

      <FacilitiesSection tier={result.severityTier} mentioned={result.locationMentioned} />

      <PrimaryButton label="Start over" variant="outline" onPress={startOver} style={styles.startOver} />
      <Disclaimer />
    </ScrollView>
  );
}

function FacilitiesSection({ tier, mentioned }: { tier: SeverityTier; mentioned?: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { settings } = useProviderSettings();
  const triage = useTriage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Pre-fill with whatever the user already typed on the input screen —
  // don't make them retype a location they already gave us.
  const [manualLocation, setManualLocation] = useState(mentioned ?? "");
  const [gpsBusy, setGpsBusy] = useState(false);
  const started = useRef(false);

  const runSearch = useCallback(
    async (coords: Coords) => {
      setLoading(true);
      setError(null);
      try {
        const facilities = await nearbyFacilities(settings.nearby, coords, tier);
        if (facilities.length === 0) {
          setError("No facilities found nearby.");
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
        const msg =
          err instanceof Error && err.message
            ? err.message
            : "Could not load nearby facilities.";
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
        setError(
          err instanceof Error && err.message ? err.message : "Could not resolve that location."
        );
        setLoading(false);
      }
    },
    [settings.geocoding, runSearch]
  );

  useEffect(() => {
    if (started.current) return;
    // A place named in the description wins: if someone says where they are,
    // believe them over the phone's idea of where they are. GPS, picked up in
    // the background on the input screen, is the fallback.
    const named = (mentioned ?? "").trim();
    if (named) {
      started.current = true;
      resolveAndSearch(named);
    } else if (triage.coords) {
      started.current = true;
      runSearch(triage.coords);
    }
  }, [mentioned, triage.coords, runSearch, resolveAndSearch]);

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
      setError("Couldn't get your location from GPS. Try typing an address instead.");
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
            accessibilityLabel="Your location: an address or area"
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

      {/* A failed search with a location already resolved otherwise hides the
          prompt above and leaves no way back — and the most common cause here
          is a provider having a bad minute, which a second press fixes. */}
      {!!error && !loading && !!triage.coords && (
        <PrimaryButton
          label="Try the search again"
          variant="outline"
          onPress={() => runSearch(triage.coords!)}
          style={styles.retrySearch}
        />
      )}

      {!!triage.coords && !!triage.facilities?.length && (
        <FacilityMap origin={triage.coords} facilities={triage.facilities} />
      )}

      {triage.facilities?.map((f) => (
        <FacilityCard key={f.id} facility={f} />
      ))}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  // The loudest thing on the screen by construction: full-bleed red, the
  // thickest border and the deepest shadow in the system.
  emergencyCta: {
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    borderWidth: border.thick,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.lg,
    ...shadow.lg,
  },
  emergencyCtaText: {
    color: colors.dangerText,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  // The dialled number, legible at a glance and without competing with the
  // instruction above it.
  emergencyCtaNumber: {
    color: colors.dangerText,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 1.5,
    textAlign: "center",
    marginTop: spacing.xs,
    opacity: 0.9,
  },
  nature: { ...type.display, color: colors.text, marginTop: spacing.md },
  sectionLabel: { ...type.label, color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.xs },
  action: { ...type.bodyStrong, color: colors.text },
  firstAidBox: {
    marginTop: spacing.md,
    backgroundColor: colors.lime,
    borderWidth: border.width,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  firstAidStep: { ...type.body, color: colors.text, marginBottom: spacing.xs },
  summaryBox: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: border.width,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.sm,
  },
  summaryText: { ...type.body, color: colors.text },
  flagsBox: {
    marginTop: spacing.md,
    backgroundColor: colors.pink,
    borderWidth: border.width,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.sm,
  },
  flag: { ...type.body, color: colors.text },
  facilitiesWrap: { marginTop: spacing.sm },
  helperText: { ...type.small, color: colors.textMuted, marginBottom: spacing.xs },
  errorText: {
    ...type.small,
    color: colors.text,
    backgroundColor: colors.orange,
    borderWidth: border.width,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  locationPrompt: {
    borderWidth: border.width,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  locationInput: {
    ...type.body,
    color: colors.text,
    borderWidth: border.width,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.xs,
    backgroundColor: colors.bg,
  },
  locationButtonsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  retrySearch: { marginBottom: spacing.md },
  locationBtn: { flex: 1, minHeight: 48, paddingVertical: spacing.sm },
  startOver: { marginTop: spacing.xl },
});
