import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { border, colors, radius, shadow, spacing, type } from "../constants/theme";

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "outline" | "danger";
  style?: ViewStyle;
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = "primary",
  style,
}: Props) {
  const isOutline = variant === "outline";
  const isDanger = variant === "danger";
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        isOutline && styles.outline,
        isDanger && styles.danger,
        !isOutline && !isDanger && styles.primary,
        // The press "pushes" the button into its own shadow — the shadow
        // shrinks and the button shifts down-right by the same amount, so the
        // whole shape stays put while the depth collapses.
        pressed && !inactive && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Text style={[styles.label, isDanger && styles.dangerLabel]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: border.width,
    borderColor: colors.border,
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    ...shadow.md,
  },
  primary: { backgroundColor: colors.accent },
  outline: { backgroundColor: colors.surface },
  danger: { backgroundColor: colors.danger },
  pressed: {
    transform: [{ translateX: 3 }, { translateY: 3 }],
    ...shadow.sm,
  },
  disabled: {
    opacity: 0.45,
    ...shadow.none,
    transform: [{ translateX: 3 }, { translateY: 3 }],
  },
  label: { ...type.bodyStrong, color: colors.text, textAlign: "center" },
  dangerLabel: { color: colors.dangerText },
});
