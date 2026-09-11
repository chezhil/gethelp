import { Linking, StyleSheet, Text, View } from "react-native";
import { directionsUrl } from "../lib/providers/directions";
import type { NearbyFacility } from "../lib/types";
import { colors, radius, spacing, type } from "../constants/theme";
import { PrimaryButton } from "./PrimaryButton";

function formatEta(seconds?: number): string {
  if (seconds == null) return "—";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

function formatDistance(meters?: number): string {
  if (meters == null) return "";
  const km = meters / 1000;
  return km < 1 ? `${Math.round(meters)} m` : `${km.toFixed(1)} km`;
}

export function FacilityCard({ facility }: { facility: NearbyFacility }) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.name} numberOfLines={2}>
          {facility.name}
        </Text>
        <Text style={styles.eta}>{formatEta(facility.etaSeconds)}</Text>
      </View>
      {!!facility.address && <Text style={styles.address}>{facility.address}</Text>}
      <Text style={styles.distance}>{formatDistance(facility.distanceMeters)} away</Text>
      <PrimaryButton
        label="Directions"
        variant="outline"
        style={styles.directionsButton}
        onPress={() =>
          Linking.openURL(directionsUrl({ lat: facility.lat, lng: facility.lng }, facility.name))
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  name: { ...type.subtitle, color: colors.text, flex: 1 },
  eta: { ...type.bodyStrong, color: colors.accent },
  address: { ...type.small, color: colors.textMuted, marginTop: 2 },
  distance: { ...type.small, color: colors.textMuted, marginTop: 2 },
  directionsButton: { marginTop: spacing.sm, minHeight: 40, paddingVertical: spacing.sm },
});
