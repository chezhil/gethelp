import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { border, colors, radius, spacing, type } from "../constants/theme";
import { getApiKey } from "../lib/store/settings";
import type { Coords, NearbyFacility } from "../lib/types";

const WIDTH = 640;
const HEIGHT = 300;

/**
 * Static map of where you are and the facilities we found.
 *
 * Google Static Maps takes its key in the query string — that's the API's
 * only auth mechanism. In a BYOK app the key already lives in the browser, so
 * this exposes nothing that wasn't client-side already; it does mean the key
 * should be restricted by HTTP referrer in the Google console, which is worth
 * doing regardless.
 *
 * Renders nothing without a key, so the free/keyless path is unaffected.
 */
export function FacilityMap({
  origin,
  facilities,
}: {
  origin: Coords;
  facilities: NearbyFacility[];
}) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getApiKey("google").then((key) => {
      if (active) setApiKey(key);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!apiKey || failed || facilities.length === 0) return null;

  // Blue dot for you, numbered orange pins for facilities in ETA order — the
  // same order as the cards below, so pin 1 is the first card.
  const youMarker = `markers=color:0x3E5C76%7Clabel:Y%7C${origin.lat},${origin.lng}`;
  const facilityMarkers = facilities
    .slice(0, 5)
    .map((f, i) => `markers=color:0xE07A3F%7Clabel:${i + 1}%7C${f.lat},${f.lng}`)
    .join("&");

  const url =
    `https://maps.googleapis.com/maps/api/staticmap?size=${WIDTH}x${HEIGHT}&scale=2` +
    `&${youMarker}&${facilityMarkers}&key=${apiKey}`;

  return (
    <View style={styles.wrap}>
      <Image
        source={{ uri: url }}
        style={styles.map}
        resizeMode="cover"
        onError={() => setFailed(true)}
        accessibilityLabel={`Map showing your location and ${Math.min(
          facilities.length,
          5
        )} nearby facilities`}
      />
      <Text style={styles.caption}>Y is you · numbers match the list below</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  map: {
    width: "100%",
    aspectRatio: WIDTH / HEIGHT,
    borderRadius: radius.md,
    borderWidth: border.width,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  caption: { ...type.small, color: colors.textMuted, marginTop: spacing.xs },
});
