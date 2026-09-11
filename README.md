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

**https://gethelp-220323505123.asia-south1.run.app** — Cloud Run (primary)

Also on GitHub Pages at **https://chezhil.github.io/gethelp/** — same build,
different host.

### Try it (about a minute)

The app ships with **no API keys**, by design: it never holds anyone's
credentials, and each visitor uses their own. To run the full flow:

1. Open the app — the first visit walks you through setup
2. Pick the model and paste a free Gemini key from
   [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Gemini is
   the default because it is the vision-capable path, so photos work. Don't
   want a Google account? Switch that row to **Groq** and use a free key from
   [console.groq.com/keys](https://console.groq.com/keys) instead — no card
   either way, and the app says so on the setup banner.
3. Optional — add a Google API key with the **Places API (New)** enabled, to
   see nearby hospitals with ETAs and a map
4. Start, describe an injury, and continue

Severity assessment needs step 2. Everything else — geocoding and
directions/ETA — runs on free, keyless OSM/OSRM services. All of this is also
in **Settings**, any time.

### First-run setup

The app ships with no API keys by design — it never holds anyone's
credentials, and each visitor brings their own. That is a good principle and
a bad first impression if the first thing someone meets is a text box that
fails when they press Continue. So `app/welcome.tsx` asks the questions up
front, once: which model should assess injuries (with the trade-off stated —
Gemini reads photos, Groq needs no Google account), the key for whichever
they pick, and then, separately and marked optional, the Google key that the
nearby-hospital search and the map both need. Saying that second part plainly
here is the point: it is otherwise discovered as an error message later.

A third step covers voice input, place-name lookup and driving-time ETAs.
Those are presented as changeable rather than as a decision, since each has a
working free default — the point is that someone learns these switches exist
and what the Google upgrade buys (traffic-aware ETAs, a recognizer that works
in Safari), not that they have to answer. Choosing a Google option without a
key says so inline rather than failing later.

It is skippable — "Continue without a key" is a real path, and the Input
screen's SETUP NEEDED banner stays as the gentler reminder. Completion is a
stored flag rather than an inference from "is a key present", so someone who
deliberately skips isn't asked again on every launch.

The screen drives the same `SegmentedRow` and `ApiKeyField` components as
Settings, so the two can't drift apart.

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

Two hosts, one source. They differ in exactly one thing: GitHub Pages serves
this repo from a `/gethelp` path prefix that every asset URL must carry,
while Cloud Run serves from the root of its own domain, where that prefix
404s every file. `app.config.js` switches `experiments.baseUrl` on an env
var so neither build is a special case.

**Cloud Run** (primary):

```bash
npm run build:cloudrun
gcloud run deploy gethelp --source . --region asia-south1 --allow-unauthenticated
```

The image is `nginx:alpine` with the static export copied in — no Node in the
runtime image. `nginx.conf` does three things worth noting: listens on
`$PORT` because Cloud Run assigns it, falls back to `index.html` so a refresh
on `/result` isn't a 404, and caches hashed bundles for a year while sending
`no-cache` on `index.html` — without that split, a deploy takes hours to
reach anyone who has already visited.

**GitHub Pages**:

```bash
npm run build:pages
npx gh-pages -d dist -t
```

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

### Voice input

The recognizer streams interim results — each one a longer version of the same
utterance ("my", "my arm", "my arm is") — and only the result flagged
`isFinal` is written into the description. Interim text is shown live in its
own box under the button instead, so a pause looks like listening rather than
a hang.

Recognition is continuous: someone describing an injury stops to think, and a
non-continuous recognizer treats the first pause as the end of the sentence.
It listens until you press Stop, and each completed sentence appends. If the
recognizer ends or errors without a final result, whatever it had already
heard is flushed rather than dropped.

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

## Tests

```bash
npm test        # 37 tests, no dependencies — Node's own runner
npm run typecheck
```

The suite covers the logic where a bug is silent and costly rather than
loud: the severity normalizer, the transcript reducer, and the HTTP error
messages.

The severity tests pin the safety rules. The load-bearing one is that an
unrecognized tier from the model resolves to **severe**, not minor — failing
toward more urgent is the whole posture of the app, and it is exactly the
kind of default a later refactor could flip without anyone noticing. Others
cover declining to clarify answering "moderate" rather than "minor", a
`needsMoreInfo` with no question being rejected instead of hanging the flow,
and the field coercion that keeps a malformed reply from reaching the screen.

`lib/providers/transcript.ts` exists because of a shipped bug: interim speech
results were each appended, turning one spoken sentence into "my my arm my
arm is my arm is bleeding". The reducer is now pure and the regression is a
test.

Checked by mutation rather than by assuming: re-introducing the tier bug and
the interim-append bug fails five tests between them.

`reasoning-core.ts` holds the provider-independent half of the severity logic
so it can be exercised without pulling react-native in through the settings
store.

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

### Dark mode

Two palettes share one set of token names, so no screen knows which theme it
is on. It follows the OS by default and can be pinned to Light or Dark under
**Settings → Appearance**; the choice is remembered on the device.

`StyleSheet.create` runs once when a module is first evaluated, so a
stylesheet that closes over a palette can never change theme. Each component
exports a `makeStyles(colors)` factory instead, and `useThemedStyles` re-runs
it only when the palette actually changes. The factory parameter is named
`colors`, so the style bodies read exactly as they did when the palette was a
fixed import.

The dark palette is not an inversion: the pastels become deep tints of the
same hues, so a section that reads "calm green" in daylight still reads calm
at night. Text sits at `#F2F1EE` rather than pure white, which glares on
near-black — worth caring about in an app someone opens on a phone in the
dark. Every piece of text on every screen clears WCAG AA against its own
background (worst case 5.08:1, the emergency CTA at 5.62:1).

Three things outside the React tree also have to follow: the page background
the browser paints outside the root, React Navigation's own container (its
default `#f2f2f2` shows through in overscroll and during the cross-fade
between screens), and the Static Maps tile, which is styled dark so the map
isn't a bright white rectangle in the middle of a dark page.
