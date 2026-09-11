import { Pressable, StyleSheet, Text, View } from "react-native";
import { border, radius, shadow, spacing, type, type Colors } from "../constants/theme";
import { useThemedStyles } from "../lib/store/theme";

/** A row of mutually exclusive choices. Shared by Settings and first-run setup. */
export function SegmentedRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.segmentRow}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  segmentRow: { flexDirection: "row", gap: spacing.xs },
  segment: {
    flex: 1,
    borderWidth: border.width,
    borderColor: colors.border,
    borderRadius: radius.sm,
    // 48dp minimum touch target.
    minHeight: 48,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: { backgroundColor: colors.yellow, ...shadow.sm },
  segmentText: { ...type.small, color: colors.textMuted, fontWeight: "600", textAlign: "center" },
  segmentTextActive: { color: colors.text },
});
