import { StyleSheet, Text, View } from "react-native";
import { border, radius, shadow, spacing, type, type Colors } from "../constants/theme";
import { useTheme, useThemedStyles } from "../lib/store/theme";

export function Disclaimer() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>
        This is an urgency estimate to help you get help faster. It is not a diagnosis.
      </Text>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
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
