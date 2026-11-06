// Notifications to schedule so the cues still reach the user with the screen locked (the app is frozen
// then, so the phone's notification system plays them). Pure: easy to test.
import { nextPhrase, rank, type Beep } from './cueLogic';
import type { Settings, Step } from '@/shared';

export interface PlannedCue {
  at: number; // epoch ms
  title: string;
  body: string;
  sound: Exclude<Beep, 'tick' | 'count'>;
}

/** iOS keeps 64 pending notifications; leave some room. */
export const MAX_CUES = 60;

/**
 * From the current position onward: a heads-up before every change, the change itself, and the end.
 * A rep step has no known end, so planning stops after it (it is planned again when the user moves on).
 */
export function planCues(
  steps: Step[], index: number, stepElapsedMs: number, now: number, s: Settings,
): PlannedCue[] {
  const out: PlannedCue[] = [];
  let endsAt = now - stepElapsedMs + steps[index].dur * 1000;
  for (let i = index; i < steps.length; i++) {
    const step = steps[i];
    if (step.open) break;
    if (i > index) endsAt += step.dur * 1000;
    const next = steps[i + 1];
    if (!next) {
      out.push({ at: endsAt, title: 'Antrenman tamamlandı', body: 'Harika iş!', sound: 'finish' });
      break;
    }
    const warnAt = endsAt - s.warnSeconds * 1000;
    if (s.beeps && step.dur > s.warnSeconds && warnAt > now) {
      out.push({ at: warnAt, title: `${s.warnSeconds} saniye sonra ${nextPhrase(next)}`, body: next.label, sound: 'warn' });
    }
    if (endsAt > now) {
      out.push({ at: endsAt, title: next.label, body: next.tag, sound: rank(next.level) > rank(step.level) ? 'up' : 'down' });
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, MAX_CUES);
}
