# PromptWars — GetHelp!

Team Winners' entry for PromptWars x Community (Build with AI / Google for
Developers / H2S), 11 Sep 2026.

## Agenda
- 10:00–10:45 Inauguration
- 11:00–13:00 Hackathon begins
- 13:00–13:30 Lunch
- 13:30–15:30 Hackathon resumes
- 15:30–16:00 AI evaluation (AI-assisted judging)
- 16:15–17:00 Top 10 announced + prep time
- 17:00–18:00 Pitching finale
- 18:00–18:30 Prizes

## Problem statement
Mobile app (Expo/React Native): describe an injury (text/voice/optional
photo) → AI-assessed severity + recommended action → nearby
hospitals/ERs sorted by ETA. Triage-and-routing tool, not a diagnostic
tool — safety framing throughout. BYOK: per-function provider selection
(reasoning, voice, geocoding, directions, nearby search), each adapter
normalized so swapping providers never touches downstream code. Full
spec kept in `docs/spec.md`.

See [README](README.md) for setup and architecture.
