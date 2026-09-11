import { Linking, StyleSheet, Text, View } from "react-native";
import { directionsUrl, formatDistance, formatEta } from "../lib/format";
import type { NearbyFacility } from "../lib/types";
import { border, radius, shadow, spacing, type, type Colors } from "../constants/theme";
import { useThemedStyles } from "../lib/store/theme";
import { PrimaryButton } from "./PrimaryButton";

export function FacilityCard({ facility }: { facility: NearbyFacility }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.name} numberOfLines={2}>
          {facility.name}
        </Text>
        <Text style={styles.eta}>{formatEta(facility.etaSeconds) ?? "—"}</Text>
      </View>
      {!!facility.address && <Text style={styles.address}>{facility.address}</Text>}
      <Text style={styles.distance}>{formatDistance(facility.distanceMeters)} away</Text>
      <View style={styles.actions}>
        <PrimaryButton
          label="Directions"
          variant="outline"
          style={styles.actionButton}
          onPress={() =>
            Linking.openURL(directionsUrl({ lat: facility.lat, lng: facility.lng }))
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

const makeStyles = (colors: Colors) => StyleSheet.create({
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
