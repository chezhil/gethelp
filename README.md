# GetHelp!

A mobile app (Expo / React Native) that helps an injured person, or someone
helping them, quickly:

1. Describe an injury — by text, voice, or optionally a photo
2. Get an AI-assessed urgency tier and a recommended next step
3. See nearby hospitals/ERs, sorted by ETA, with one tap to directions

**This is a triage-and-routing tool, not a diagnostic tool.** It never
outputs a diagnosis — only urgency and routing language — and always keeps
the "not a diagnosis" disclaimer on screen.

Built for PromptWars x Community (Build with AI / Google for Developers /
H2S), 11 Sep 2026. Full problem statement: [docs/spec.md](docs/spec.md).

## Running it

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go, or press `i`/`a` for a simulator.

The app works with no build-time secrets — every API key is entered by the
user at runtime in **Settings** and stored only on-device (`expo-secure-store`
for keys, `AsyncStorage` for the plain provider choice). Nothing is bundled,
nothing is sent anywhere but straight to the provider the key belongs to.

## Architecture

### Screens (`app/`, expo-router)
- `index.tsx` — describe the injury (text/voice/photo) + location
- `processing.tsx` — runs the assessment; handles the clarify-and-retry loop
  when the model says it needs more detail, without restarting the flow
- `result.tsx` — severity, recommended action, red flags, nearby facilities
- `settings.tsx` — per-function provider choice + BYOK key entry

### Provider adapters (`lib/providers/`)
Every one of the five pluggable functions — reasoning, voice, geocoding,
directions, nearby search — is a thin adapter that takes normalized input and
returns a normalized shape from `lib/types.ts`. The UI only ever imports the
normalized types; swapping a provider in Settings never touches a screen.

| Function | Default (no key) | Alternate (BYOK) |
|---|---|---|
| AI Reasoning | Groq · GPT-OSS 120B | Gemini 2.5 Flash |
| Voice Input | Device native speech recognition | Google Speech-to-Text |
| Geocoding | OSM Nominatim | Google Geocoding |
| Directions/ETA | OSRM (public, free) | Mapbox Directions · Google Routes |
| Nearby Search | OSM Overpass | Google Places |

Only one key is required to run the app at all: **AI Reasoning** has no
free/no-key option (a severity assessment has to come from somewhere), so add
a Groq key to get started. Everything else — geocoding, directions, nearby
search — defaults to a free, no-key OSM/OSRM backend. Mapbox and Google
require billing set up on their end even for free-tier usage, which is why
they're BYOK alternates rather than the default.

GPT-OSS 120B is text-only. When it's the selected reasoning provider, the
photo-attach control is hidden entirely rather than accepting a photo that
would be silently dropped — see `photoSupported` in `app/index.tsx`. Switching
to Gemini in Settings re-enables it immediately.

### Session state (`lib/store/`)
- `settings.ts` — provider choice (AsyncStorage) + API keys (SecureStore),
  exposed via `useProviderSettings()`
- `triage.tsx` — one in-memory session (description, photo, location, result,
  facilities) shared across the three flow screens via React context

## Safety behavior implemented

- Empty/near-empty description blocks submission client-side — no AI call
- `needsMoreInfo: true` from the model shows one clarifying question and
  re-submits with the answer appended, rather than guessing a tier or
  restarting the flow
- Ambiguous cases are instructed to resolve to the *higher* urgency tier
- Severe/critical results show a "Call emergency services" CTA above
  everything else on the result screen
- The "not a diagnosis" disclaimer is always visible on the result screen
- Facility search prioritizes hospitals/ERs for severe/critical, and
  clinics/urgent care are only mixed in for minor/moderate
- An empty nearby-search result shows an explicit empty state and, for the
  OSM default, suggests switching to Google Places rather than failing silently

## Design system

Swiss minimalist grid, one accent color, pastel severity tiers whose *weight*
(not saturation) carries urgency — see `constants/theme.ts` for every token.
