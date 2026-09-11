import { StyleSheet, Text, View } from "react-native";
import {
  border,
  colors,
  radius,
  severityLabel,
  shadow,
  spacing,
  type SeverityTier,
} from "../constants/theme";

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
        {severityLabel[tier].toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: border.width,
  },
  // Urgency is signalled by size and weight too, not colour alone.
  badgeUrgent: {
    paddingVertical: spacing.md - 4,
    paddingHorizontal: spacing.lg,
    borderWidth: border.thick,
  },
  text: { fontSize: 14, fontWeight: "700", letterSpacing: 0.8 },
  textUrgent: { fontSize: 18, fontWeight: "700", letterSpacing: 1 },
});
