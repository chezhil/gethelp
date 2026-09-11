import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { border, radius, spacing, type, type Colors } from "../constants/theme";
import { API_KEY_SLOTS, getApiKey, setApiKey } from "../lib/store/settings";
import { useTheme, useThemedStyles } from "../lib/store/theme";

/**
 * One BYOK key input, saving on every keystroke.
 *
 * Saving as you type rather than behind a Save button means a key is never
 * lost to someone closing the screen — and since the value goes straight to
 * device storage and nowhere else, there is nothing to submit.
 */
export function ApiKeyField({
  slot,
  label,
  placeholder,
  onHasKeyChange,
}: {
  slot: keyof typeof API_KEY_SLOTS;
  label: string;
  placeholder: string;
  /** Lets a parent react to the key appearing or being cleared. */
  onHasKeyChange?: (hasKey: boolean) => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [value, setValue] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getApiKey(slot).then((v) => {
      setValue(v ?? "");
      setLoaded(true);
      onHasKeyChange?.(!!v);
    });
    // onHasKeyChange is a render-scoped callback; re-running on its identity
    // would re-read storage on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot]);

  return (
    <View style={styles.keyField}>
      <Text style={styles.keyLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(v) => {
          setValue(v);
          setApiKey(slot, v);
          onHasKeyChange?.(!!v.trim());
        }}
        placeholder={loaded ? placeholder : "Loading…"}
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={label}
        style={styles.keyInput}
      />
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  keyField: { marginTop: spacing.sm },
  keyLabel: { ...type.small, color: colors.textMuted, marginBottom: spacing.xs },
  keyInput: {
    ...type.body,
    color: colors.text,
    borderWidth: border.width,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    minHeight: 48,
    backgroundColor: colors.bg,
  },
});
