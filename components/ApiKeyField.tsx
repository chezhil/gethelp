import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { border, radius, spacing, type, type Colors } from "../constants/theme";
import { useDebouncedPersist } from "../lib/store/persist";
import { API_KEY_SLOTS, getApiKey, setApiKey } from "../lib/store/settings";
import { useTheme, useThemedStyles } from "../lib/store/theme";

/**
 * One BYOK key input, saving as you type.
 *
 * Saving as you type rather than behind a Save button means a key is never
 * lost to someone closing the screen — and since the value goes straight to
 * device storage and nowhere else, there is nothing to submit. The write is
 * debounced so a 40-character key is one storage write rather than 40.
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
  /** Only a value the user typed is worth writing back. */
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let active = true;
    // Reset both gates first: until the new slot's key has been read back,
    // `value` still holds the previous slot's key, and persisting that would
    // copy one provider's key over another's.
    setLoaded(false);
    setDirty(false);
    getApiKey(slot).then((v) => {
      if (!active) return;
      setValue(v ?? "");
      setLoaded(true);
      onHasKeyChange?.(!!v);
    });
    return () => {
      active = false;
    };
    // onHasKeyChange is a render-scoped callback; re-running on its identity
    // would re-read storage on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot]);

  const persist = useCallback((v: string) => setApiKey(slot, v), [slot]);
  useDebouncedPersist(value, loaded && dirty, persist);

  return (
    <View style={styles.keyField}>
      <Text style={styles.keyLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(v) => {
          setDirty(true);
          setValue(v);
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
