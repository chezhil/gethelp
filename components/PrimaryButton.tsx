import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { border, radius, shadow, spacing, type, type Colors } from "../constants/theme";
import { useTheme, useThemedStyles } from "../lib/store/theme";

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
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const isOutline = variant === "outline";
  const isDanger = variant === "danger";
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      // While loading the button renders a spinner and no text, so without an
      // explicit label a screen reader announces nothing at all.
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        isOutline && styles.outline,
        isDanger && styles.danger,
        !isOutline && !isDanger && styles.primary,
        pressed && !inactive && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? colors.text : colors.accentText} />
      ) : (
        <Text
          style={[
            styles.label,
            !isOutline && !isDanger && styles.primaryLabel,
            isDanger && styles.dangerLabel,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: border.width,
    borderColor: colors.border,
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    ...shadow.sm,
  },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  outline: { backgroundColor: colors.surface },
  danger: { backgroundColor: colors.danger, borderColor: colors.danger },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.45, ...shadow.none },
  label: { ...type.bodyStrong, color: colors.text, textAlign: "center" },
  primaryLabel: { color: colors.accentText },
  dangerLabel: { color: colors.dangerText },
});
