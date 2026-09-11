import { StyleSheet, Text, View } from "react-native";
import { border, colors, radius, shadow, spacing, type } from "../constants/theme";

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
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.cyan,
    borderWidth: border.width,
    borderColor: colors.border,
    borderRadius: radius.md,
    ...shadow.sm,
  },
  text: {
    ...type.small,
    color: colors.text,
    textAlign: "center",
  },
});
