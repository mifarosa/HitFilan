# HitFilan for iPhone and Android (Expo)

The native app. It shares the web app's plain JavaScript with the website: `../js` (programs, step
builder, timer, storage layer, YouTube link parsing) is bundled as it is (see `metro.config.js`, the
`@shared/*` alias). The screens are React Native (TypeScript, `expo-router`).

```bash
cd app
npm install
npm run typecheck && npm test      # types and the shared-logic tests
npx expo start                     # then scan the QR code with Expo Go on the phone
```

Expo Go is enough for the screens, timer, sounds and YouTube. Locked-screen notifications with custom
sounds and some native modules need a development build: `npx eas-cli build -p ios --profile development`.

## How it works

- **Storage:** the shared `js/store.js` uses `globalThis.__hitfilanStorage ?? localStorage`. `src/storage.ts`
  plugs in SQLite key-value storage (synchronous), so the shared code runs unchanged.
- **Workout:** `src/engine/useWorkout.ts` runs the shared `SequenceTimer`. Cues while the app is on screen
  (`cueLogic.ts`, `cues.ts`: beeps from `assets/sounds`, Turkish speech, vibration).
- **Locked screen:** iOS freezes a background app, so when a workout runs the cues are also scheduled as
  local notifications with their sounds (`cuePlan.ts`, `notifications.ts`); they play with the screen locked.
  The plan is made again after pause, resume and skip.
- **YouTube:** `react-native-youtube-iframe`; a pasted link is checked first (exists, may be embedded).
  With a video the page is used edge to edge: video on top (portrait) or on the left (landscape), and a rounded-square
  card with a soft gradient and a progress frame (`src/ui/SquareCard.tsx`) fills the rest, with totals and buttons.
  Sideways, only the card is shown. The 1 2 3 4 buttons (bottom centre of the card) or a tap on it pick the size
  (`src/ui/sideLayout.ts`): card beside the video full, half or quarter, or 4 = no card, the info sits on the video like a
  subtitle (`src/ui/Subtitle.tsx`). The video takes the room the card gives up. A rep step shows a check button.
  The YouTube page keeps the size it was created with, so when the video width changes `VideoDock` builds the player again
  at the new size and starts it where the old one was; YouTube's own full screen button is off (it would cover the app).
  In development builds a small line shows the mode, video, card and screen sizes.
- `tools/make-sounds.mjs` writes the cue sounds (same notes as the web app).

## Ported so far

Programs and the workout screen (A1). Coming in order: history, goals and plans; free counter and moves;
calories and share images; Firebase backup; release.
