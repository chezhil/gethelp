# Build: Emergency Injury Triage & Locator App

## Overview
A mobile app that helps an injured person (or someone helping them) quickly:
1. Describe an injury via text or voice-to-text, optionally with a photo
2. Get an AI-assessed severity level and recommended action
3. See nearby hospitals/emergency centers with ETA

This is a triage-and-routing tool, NOT a diagnostic tool. Safety framing matters throughout.

## Tech Stack
- React Native (Expo) for cross-platform mobile
- Expo Location for GPS
- Expo AV / expo-speech-recognition (or platform Speech Recognition API) for voice-to-text
- Expo Image Picker for photo capture/upload
- AsyncStorage (or expo-secure-store for API keys specifically) for local persistence
- No backend required initially — all API calls direct from client using user-supplied keys

## Design System — Swiss Minimalist + Pastel
- **Grid**: strict column-based layout, generous whitespace, no clutter
- **Typography**: single clean sans-serif family (Inter or Helvetica Neue equivalent), strong type hierarchy via weight/size — not color or decoration. Large confident headlines, restrained body text.
- **Color palette**: soft pastel base (e.g. pale sage green, powder blue, blush pink) as backgrounds/accents, with a neutral off-white base (#FAFAF8 or similar) — NOT stark white, NOT cream/beige. One muted accent color for primary actions.
- **Severity color coding**: use desaturated/pastel versions of standard semantic colors (soft green → soft amber → soft coral → muted red) so the palette stays cohesive even at "critical" state — avoid harsh saturated red alarm colors that clash with the pastel system; instead increase visual weight (bolder type, larger badge) to signal urgency, not just color.
- **No decorative elements**: no accent stripes, no gradients, no drop-shadow-heavy cards. Flat design, subtle borders or very soft shadows only for depth where functionally needed (e.g. modals).
- **Icons**: simple line icons, consistent stroke width, monochrome or single-tone matching the palette.
- **Motion**: minimal, functional only (e.g. a subtle transition between input and result screens) — no decorative animation.

## Core User Flow

### Screen 1: Input
- Text field: "Describe what happened"
- Microphone button: voice-to-text, transcribes into the same text field (user can edit after transcription)
- Optional photo attachment button — see conditional logic below
- Location: text field "Where are you?" (optional) OR a toggle/button "Use current location" (default, requests device GPS permission)
- Submit button, disabled until minimum required input is present (non-empty description)

### Screen 2: Processing
- Simple, calm loading state (no dramatic language — see loading message guidance below)

### Screen 3: Result
- **If input was too vague/ambiguous to assess** (see Validation Logic below): show a clarifying-question UI instead of a severity result. Do not fall through to a guessed severity.
- **If assessable**: show, in this order:
  1. Severity badge (tier + one-line plain-language summary)
  2. If tier is severe/critical: prominent "Call emergency services" CTA ABOVE everything else, styled with higher visual weight than the rest of the screen
  3. Recommended action (self-care / urgent care / ER / call ambulance)
  4. Brief reasoning / red flags noted (transparency, not just a verdict)
  5. Nearby facility list, sorted by ETA, each showing name, distance, ETA, and a "Directions" action
  6. Persistent, non-intrusive disclaimer: "This is an urgency estimate to help you get help faster. It is not a diagnosis."

## AI Provider Architecture (BYOK)

Build a **settings menu with per-function provider selection**, each with its own API key field (stored locally, never transmitted anywhere except directly to that provider's API). Structure:
Settings
├── AI Reasoning: [Llama 3.3 70B (Groq) — default] [Gemini 2.5 Flash]
├── Voice Input: [Browser/Device native — default] [Google Speech-to-Text]
├── Geocoding: [OpenStreetMap Nominatim — default] [Google Geocoding]
├── Directions/ETA: [Mapbox Directions — default] [Google Directions/Routes]
└── Nearby Search: [OpenStreetMap Overpass — default] [Google Places]

Each provider needs its own adapter function that takes normalized internal input and returns a normalized internal output shape, so swapping providers never changes downstream code. Example interfaces:

```ts
interface SeverityResult {
  severityTier: 'minor' | 'moderate' | 'severe' | 'critical';
  likelyNature: string;
  recommendedAction: string;
  redFlags: string[];
  needsMoreInfo: boolean;
  clarifyingQuestion?: string; // present only if needsMoreInfo is true
}

interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

interface NearbyFacility {
  name: string;
  lat: number;
  lng: number;
  distanceMeters?: number;
  address?: string;
}

interface RouteResult {
  durationSeconds: number;
  distanceMeters: number;
}
```

### Critical conditional logic: image option
**If the user has selected Llama 3.3 70B as their reasoning provider, hide/disable the photo attachment option entirely** (Llama 3.3 70B is text-only — no vision). If they later switch to Gemini in settings, re-enable the photo option. Never let a user attach a photo that gets silently dropped or ignored — either the option is available and used, or it's not shown at all.

## Severity Assessment Prompt Logic (for the reasoning provider)

The system prompt sent to whichever model is selected should:
- Instruct the model to return ONLY structured JSON matching the `SeverityResult` shape above
- Explicitly instruct: **if the description lacks enough detail to assess severity (e.g. "it hurts", "I got hurt"), set `needsMoreInfo: true` and provide one specific clarifying question** (e.g. "Where on your body is the injury, and is there visible bleeding?") — do NOT guess a severity tier from insufficient input
- Instruct: when genuinely ambiguous between two severity levels, default to the HIGHER (more urgent) tier — safer failure mode
- Instruct: never provide a medical diagnosis, only an urgency/routing estimate

## Validation Logic (client-side, before/alongside AI call)
- Empty or near-empty description → block submission, prompt user to add more detail, don't call the AI at all
- If `needsMoreInfo: true` comes back from the AI, show the clarifying question in a follow-up input that appends to the original description, then re-submit — don't restart the flow from scratch
- Location is optional at input time, but if nearby-search is going to run, require either a resolved location (GPS or geocoded text) before showing facility results — if location is missing, show the severity result but prompt separately for location before showing facilities

## Facility Search Logic
- Geocode location (if entered as text) → get coordinates
- Query nearby search for hospitals/clinics/urgent care, filtered by facility type inferred from severity tier (critical/severe → prioritize ERs/hospitals; minor/moderate → can include clinics/urgent care)
- Fetch ETA for top 3-5 results, sort by ETA not raw distance
- If nearby search returns nothing (e.g. sparse OSM data in the area), show a clear empty state — don't fail silently — and suggest switching to Google Places in settings if using the OSM default

## Safety & Disclaimer Requirements
- Persistent disclaimer visible on the result screen at all times (see above)
- For severe/critical tier, the emergency-call CTA must be the most visually prominent element on screen — above the fold, before facility list
- Never phrase output in diagnostic language ("you have X") — always urgency/routing language ("this suggests seeking care at Y level")

## Loading state copy
Keep loading messages calm and functional, not dramatic (e.g. "Analyzing your description…", "Finding nearby help…") — this is a stressful context for the user, tone should stay steady and reassuring throughout, not add urgency through copy.
