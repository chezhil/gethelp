import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { renderGoogleButton, type GoogleUser } from "../lib/auth/google";
import { colors, spacing, type } from "../constants/theme";

/**
 * Google requires its own rendered button to start the sign-in flow — a
 * styled Pressable of ours can't trigger it — so this drops GIS's button into
 * a real DOM node. Web only; renders nothing elsewhere.
 */
export function GoogleSignInButton({
  clientId,
  onUser,
}: {
  clientId: string;
  onUser: (user: GoogleUser) => void;
}) {
  const hostRef = useRef<View | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web" || !clientId) return;
    // On web, a View is a div — but only once it's actually mounted.
    const node = hostRef.current as unknown as HTMLElement | null;
    if (!node) return;

    let cancelled = false;
    renderGoogleButton(
      node,
      clientId,
      (user) => {
        if (!cancelled) onUser(user);
      },
      (message) => {
        if (!cancelled) setError(message);
      }
    ).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Sign-in unavailable.");
    });

    return () => {
      cancelled = true;
    };
  }, [clientId, onUser]);

  if (Platform.OS !== "web") return null;

  return (
    <View>
      <View ref={hostRef} style={styles.host} />
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { minHeight: 44, marginTop: spacing.sm },
  error: { ...type.small, color: colors.text, marginTop: spacing.xs },
});
