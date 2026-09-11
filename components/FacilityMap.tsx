import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { border, radius, spacing, type, type Colors } from "../constants/theme";
import { useTheme, useThemedStyles } from "../lib/store/theme";
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
  const { scheme } = useTheme();
  const styles = useThemedStyles(makeStyles);
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

  const dark = scheme === "dark";

  // Marker fills are chosen against the map tile, not the app background —
  // the "you" pin has to stay legible on whichever basemap is under it.
  const youColor = dark ? "0x9FC4E8" : "0x3E5C76";
  const youMarker = `markers=color:${youColor}%7Clabel:Y%7C${origin.lat},${origin.lng}`;
  const facilityMarkers = facilities
    .slice(0, 5)
    .map((f, i) => `markers=color:0xE07A3F%7Clabel:${i + 1}%7C${f.lat},${f.lng}`)
    .join("&");

  // An unstyled map tile is a bright white rectangle, which is exactly the
  // thing dark mode exists to avoid on a screen someone is looking at in the
  // dark. Static Maps takes the same style rules as the JS SDK.
  const darkMapStyle = dark
    ? "&style=element:geometry%7Ccolor:0x1F2226" +
      "&style=element:labels.text.stroke%7Ccolor:0x1F2226" +
      "&style=element:labels.text.fill%7Ccolor:0x9A9DA4" +
      "&style=feature:road%7Celement:geometry%7Ccolor:0x33373D" +
      "&style=feature:road%7Celement:labels.text.fill%7Ccolor:0xB8BBC1" +
      "&style=feature:poi%7Cvisibility:off" +
      "&style=feature:water%7Celement:geometry%7Ccolor:0x14222E"
    : "";

  const url =
    `https://maps.googleapis.com/maps/api/staticmap?size=${WIDTH}x${HEIGHT}&scale=2` +
    `&${youMarker}&${facilityMarkers}${darkMapStyle}&key=${apiKey}`;

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

const makeStyles = (colors: Colors) => StyleSheet.create({
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
