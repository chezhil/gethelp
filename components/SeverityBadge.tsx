import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, severityLabel, type SeverityTier } from "../constants/theme";

export function SeverityBadge({ tier }: { tier: SeverityTier }) {
  const palette = colors[tier];
  const urgent = tier === "severe" || tier === "critical";
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: palette.bg, borderColor: palette.border },
        urgent && styles.badgeUrgent,
      ]}
    >
      <Text style={[styles.text, { color: palette.fg }, urgent && styles.textUrgent]}>
        {severityLabel[tier]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  badgeUrgent: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
  },
  text: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  textUrgent: {
    fontSize: 18,
  },
});
