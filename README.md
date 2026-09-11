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

1. Open the app — it says up front that a key is needed and links to Settings
2. Under **AI Reasoning**, paste a free Gemini key from
   [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Gemini is
   the default because it is the vision-capable path, so photos work. Don't
   want a Google account? Switch that row to **Groq** and use a free key from
   [console.groq.com/keys](https://console.groq.com/keys) instead — no card
   either way, and the app says so on the setup banner.
3. Optional — under **Nearby Search**, add a Google API key with the Places
   API enabled, to see nearby hospitals with ETAs and a map
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
- `index.tsx` — describe the injury (text/voice/photo); location is picked up
  in the background
- `processing.tsx` — runs the assessment; handles the clarify-and-retry loop
  when the model says it needs more detail, without restarting the flow
- `result.tsx` — severity, recommended action, red flags, nearby facilities
- `history.tsx` — past assessments, stored in this browser
- `settings.tsx` — per-function provider choice, BYOK key entry, and the
  standing medical background

### What a result shows

Severity tier, what it likely is, and the recommended next step, then:

- **What this might mean** — two or three plain sentences on why this warrants
  the urgency it was given. Framing, never a diagnosis.
- **While you get help** — two to four first-aid steps to do right now,
  ordered most urgent first, so the minutes before care aren't wasted
- **Noted in your description** — the red flags the model picked out
- **Nearby care** — a static map of you and the facilities (Google key only),
  then cards in ETA order with **Directions** and, where the provider returned
  a number, **Call**. Numbered pins match the card order.

### Medical background

Settings holds an optional standing note — conditions, medications, allergies.
Every assessment takes it into account: being on blood thinners makes a head
knock more urgent, and the model is told to raise the tier when it matters and
say so in the red flags, rather than silently re-rank.

It is health information, so: stored on this device only, never uploaded
anywhere, and sent exactly as far as the injury description itself — to the
reasoning provider you chose, and nowhere else.

### Photo input

On a PC the photo control is a drag-and-drop box (it also clicks through to a
file picker, since a drop-only target is useless with a keyboard). On touch
devices it stays as Camera and Gallery buttons. The choice is made by asking
the browser `(hover: hover) and (pointer: fine)` rather than measuring the
window — a narrow desktop window is still a PC, and a large tablet still has
no mouse.

Dropped files are checked for type and size (images only, 10MB) and read as a
data URL, from which the raw base64 and the file's real mime type are sent to
the vision model.

### Location

There is no location field. The app asks for GPS once when it opens and keeps
the result in the background, so the common case needs no input at all.

To override it, just say where you are in the description — "twisted my ankle
near MG Road". The model returns that as `locationMentioned` and the result
screen prefers it over GPS: if someone says where they are, believe them over
the phone's idea of where they are. A manual field only appears on the result
screen when neither is available (GPS denied and no place named), since the
facility search can't run without a location at all.

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
- First-aid steps are constrained to safe, non-invasive actions a bystander
  can take, and never replace the recommendation to seek care
- Facility search restricts to hospitals for severe/critical, and only widens
  to include doctors/clinics for minor/moderate
- An empty nearby-search result shows an explicit empty state rather than
  failing silently

## Design system

Swiss minimalism with soft pastels: an off-white ground, hairline borders,
one muted accent for every primary action, and barely-there shadows used only
where depth is functional. The pastel tints (yellow, lime, cyan, pink,
orange) mark sections rather than decorate them. Every token lives in
`constants/theme.ts`.

Urgency is carried by weight and size rather than louder colour — even the
severity tiers stay desaturated. The badge grows and thickens at
severe/critical, and the emergency CTA is the one element with the heavier
2px border and the deepest shadow in the system, so the tiers stay legible
without depending on colour alone.

The layout is one centred column capped at 640px: it fills a phone screen and
stops stretching across a desktop monitor.
