// Neobrutalist design tokens: flat saturated colour, hard black borders,
// offset shadows with no blur, heavy type. One place to tune the whole app.

export const colors = {
  bg: "#FFFBEF", // warm paper, not stark white
  surface: "#FFFFFF",
  border: "#000000", // every edge is a hard black line
  text: "#0A0A0A",
  textMuted: "#5A5754",

  // flat accents
  yellow: "#FFD93D",
  lime: "#B8FF4D",
  cyan: "#5BE9E9",
  pink: "#FF8FC8",
  orange: "#FF8A3D",

  // primary action
  accent: "#FFD93D",
  accentText: "#0A0A0A",

  // Severity tiers. Urgency is carried by colour *and* weight — each tier
  // steps up in saturation, and the badge itself grows at severe/critical
  // (see SeverityBadge), so it still reads at a glance without relying on
  // colour alone.
  minor: { bg: "#B8FF4D", fg: "#0A0A0A", border: "#000000" },
  moderate: { bg: "#FFD93D", fg: "#0A0A0A", border: "#000000" },
  severe: { bg: "#FF8A3D", fg: "#0A0A0A", border: "#000000" },
  critical: { bg: "#FF4D4D", fg: "#FFFFFF", border: "#000000" },

  danger: "#FF3B30",
  dangerText: "#FFFFFF",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Neobrutalism keeps corners close to square.
export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
} as const;

/**
 * Max width of the content column. On a phone the screen is narrower than
 * this so it simply fills the width; on a desktop browser it stops the
 * layout stretching across the whole monitor.
 */
export const CONTENT_MAX_WIDTH = 640;

export const border = {
  width: 3,
  thick: 4,
} as const;

/**
 * Hard offset shadow — no blur, no spread, pure black. The signature of the
 * style. `boxShadow` is supported on both native (RN 0.76+) and web, so one
 * token works everywhere.
 */
export const shadow = {
  sm: { boxShadow: "3px 3px 0px #000000" },
  md: { boxShadow: "5px 5px 0px #000000" },
  lg: { boxShadow: "7px 7px 0px #000000" },
  none: { boxShadow: "0px 0px 0px #000000" },
} as const;

export const type = {
  display: { fontSize: 34, fontWeight: "900" as const, letterSpacing: -1 },
  title: { fontSize: 24, fontWeight: "900" as const, letterSpacing: -0.5 },
  subtitle: { fontSize: 17, fontWeight: "800" as const, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: "500" as const, lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: "800" as const, lineHeight: 22 },
  small: { fontSize: 13, fontWeight: "600" as const, lineHeight: 18 },
  label: {
    fontSize: 12,
    fontWeight: "900" as const,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
  },
};

export type SeverityTier = "minor" | "moderate" | "severe" | "critical";

export const severityLabel: Record<SeverityTier, string> = {
  minor: "Minor",
  moderate: "Moderate",
  severe: "Severe",
  critical: "Critical",
};

export const severityAction: Record<SeverityTier, string> = {
  minor: "Self-care at home should be enough",
  moderate: "Seeking urgent care is recommended",
  severe: "Seeking emergency room care is recommended",
  critical: "Calling an ambulance is recommended",
};
