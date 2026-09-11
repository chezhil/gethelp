# GetHelp!

A web and mobile app (Expo / React Native) that helps an injured person, or
someone helping them, quickly:

1. Describe an injury — by text, voice, or optionally a photo
2. Get an AI-assessed urgency tier and a recommended next step
3. See nearby hospitals/ERs, sorted by ETA, with one tap to directions

**This is a triage-and-routing tool, not a diagnostic tool.** It never
outputs a diagnosis — only urgency and routing language — and always keeps
the "not a diagnosis" disclaimer on screen.

Built for PromptWars x Community (Build with AI / Google for Developers /
H2S), 11 Sep 2026. Full problem statement: [docs/spec.md](docs/spec.md).

## Live app

**https://chezhil.github.io/gethelp/** — works on phone and desktop.

### Try it (about a minute)

The app ships with **no API keys**, by design: it never holds anyone's
credentials, and each visitor uses their own. To run the full flow:

1. Open the app and tap **Settings**
2. Under **AI Reasoning**, paste a free Groq key from
   [console.groq.com/keys](https://console.groq.com/keys) (no card required)
3. Optional — under **Nearby Search**, add a Google API key with the Places
   API enabled, to see nearby hospitals with ETAs
4. Tap **Done**, describe an injury, and continue

Severity assessment needs step 2. Everything else — geocoding and
directions/ETA — runs on free, keyless OSM/OSRM services.

## Running it locally

```bash
npm install
npx expo start          # phone, via Expo Go
npx expo start --web    # browser
```

One codebase targets web, iOS and Android. Every API key is entered at
runtime in **Settings** and stored only on the user's own device — the
keychain/keystore on native, `localStorage` on web (see `keyStore` in
`lib/store/settings.tsx`). Nothing is bundled into the build, and a key is
only ever sent to the provider it belongs to.

Every provider is called directly from the client; all five allow
cross-origin requests, so there is no backend and nothing to operate.

## Deploying

The site is a static export deployed to GitHub Pages from the `gh-pages`
branch:

```bash
npx expo export --platform web
cp dist/index.html dist/404.html && touch dist/.nojekyll
# then publish dist/ to the gh-pages branch
```

`experiments.baseUrl` in `app.json` sets the `/gethelp` path prefix that
Pages serves a project site from — asset URLs break without it.

## Architecture

### Screens (`app/`, expo-router)
- `index.tsx` — describe the injury (text/voice/photo) + location
- `processing.tsx` — runs the assessment; handles the clarify-and-retry loop
  when the model says it needs more detail, without restarting the flow
- `result.tsx` — severity, recommended action, red flags, nearby facilities
- `history.tsx` — past assessments, stored in this browser
- `settings.tsx` — per-function provider choice + BYOK key entry

### History

Every assessment is saved to a **History** tab: severity, what it was, the
recommendation, and the nearest facility with its ETA. Entries can be deleted
individually or cleared all at once.

There is no login and no account. History lives in the browser's own storage
(`localStorage` via AsyncStorage) and never leaves the device — so it is
specific to that browser, clearing site data clears it, and another device
starts empty. `lib/store/history.ts` is a small seam a real backend could sit
behind if cross-device sync were ever wanted.

## Safety behavior implemented

- Empty/near-empty description blocks submission client-side — no AI call
- `needsMoreInfo: true` from the model shows one clarifying question and
  re-submits with the answer appended, rather than guessing a tier or
  restarting the flow
- Ambiguous cases are instructed to resolve to the *higher* urgency tier
- Severe/critical results show a "Call emergency services" CTA above
  everything else on the result screen
- The "not a diagnosis" disclaimer is always visible on the result screen
- Facility search restricts to hospitals for severe/critical, and only widens
  to include doctors/clinics for minor/moderate
- An empty nearby-search result shows an explicit empty state rather than
  failing silently

## Design system

Neobrutalist: flat saturated colour, 3–4px black borders, hard offset shadows
with no blur, heavy type and uppercase labels. Buttons press down into their
own shadow. Every token lives in `constants/theme.ts`.

Urgency is carried by weight and size as well as colour — the severity badge
grows and thickens at severe/critical, and the emergency CTA keeps the
thickest border and deepest shadow in the system — so the tiers stay legible
without depending on colour alone.

The layout is one centred column capped at 640px: it fills a phone screen and
stops stretching across a desktop monitor.
