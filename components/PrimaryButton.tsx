import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { colors, radius, spacing, type } from "../constants/theme";

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
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isOutline && styles.outline,
        isDanger && styles.danger,
        !isOutline && !isDanger && styles.primary,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? colors.text : colors.accentText} />
      ) : (
        <Text
          style={[
            styles.label,
            isOutline && styles.outlineLabel,
            isDanger && styles.dangerLabel,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    paddingVertical: spacing.md - 2,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  primary: { backgroundColor: colors.accent },
  outline: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border },
  danger: { backgroundColor: colors.danger },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
  label: { ...type.bodyStrong, color: colors.accentText },
  outlineLabel: { color: colors.text },
  dangerLabel: { color: "#FFF" },
});
