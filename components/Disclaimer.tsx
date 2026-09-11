import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, type } from "../constants/theme";

export function Disclaimer() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>
        This is an urgency estimate to help you get help faster. It is not a diagnosis.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  text: {
    ...type.small,
    color: colors.textMuted,
    textAlign: "center",
  },
});
