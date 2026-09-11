import { Linking, StyleSheet, Text, View } from "react-native";
import { directionsUrl } from "../lib/providers/directions";
import type { NearbyFacility } from "../lib/types";
import { border, colors, radius, shadow, spacing, type } from "../constants/theme";
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
      <View style={styles.actions}>
        <PrimaryButton
          label="Directions"
          variant="outline"
          style={styles.actionButton}
          onPress={() =>
            Linking.openURL(directionsUrl({ lat: facility.lat, lng: facility.lng }, facility.name))
          }
        />
        {!!facility.phone && (
          <PrimaryButton
            label="Call"
            variant="outline"
            style={styles.actionButton}
            onPress={() => Linking.openURL(`tel:${facility.phone!.replace(/\s+/g, "")}`)}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: border.width,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  name: { ...type.subtitle, color: colors.text, flex: 1 },
  eta: {
    ...type.bodyStrong,
    color: colors.text,
    backgroundColor: colors.lime,
    borderWidth: border.width,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    overflow: "hidden",
  },
  address: { ...type.small, color: colors.textMuted, marginTop: 2 },
  distance: { ...type.small, color: colors.textMuted, marginTop: 2 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  actionButton: { flex: 1, minHeight: 44, paddingVertical: spacing.sm },
});
