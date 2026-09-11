import { Pressable, StyleSheet, Text, View } from "react-native";
import { border, radius, shadow, spacing, type, type Colors } from "../constants/theme";
import { useThemedStyles } from "../lib/store/theme";

/**
 * A row of mutually exclusive choices. Shared by Settings and first-run setup.
 *
 * Each option is a radio rather than a button: these are one choice with
 * several answers, and `radio` inside a `radiogroup` is what makes a screen
 * reader say "2 of 3, selected" instead of reading three unrelated buttons.
 * The visible label is a child <Text>, which leaves the control itself
 * nameless — so it is repeated as an accessibilityLabel.
 */
export function SegmentedRow<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  /** Names the choice as a whole, e.g. "Which AI should assess injuries?". */
  label?: string;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.segmentRow} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            hitSlop={6}
            accessibilityRole="radio"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: active, checked: active }}
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
