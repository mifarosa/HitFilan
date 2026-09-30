// Audio cues designed to play on top of music from another app.
// Short Web Audio beeps mix with other audio; speech is optional because
// some phones duck (lower) the music while speaking.

let ctx = null;

export function unlockAudio() {
  // iOS 17+: ask the OS to mix our sounds with music instead of pausing it.
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'ambient';
  } catch { /* not supported */ }
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  ctx?.resume?.();
}

function tone(freq, startOffset, duration, volume = 0.35) {
  if (!ctx) return;
  const t = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

export const beeps = {
  // Soft tick for the early part of the countdown
  tick() {
    ctx?.resume?.();
    tone(660, 0, 0.07, 0.18);
  },
  // Stronger beep for the last 3 seconds
  count() {
    ctx?.resume?.();
    tone(880, 0, 0.14, 0.45);
  },
  // Heads-up chime when the countdown starts (distinct from the other cues)
  warn() {
    ctx?.resume?.();
    [988, 1319, 988].forEach((f, i) => tone(f, i * 0.12, 0.1, 0.4));
  },
  // Rising double beep: effort goes up
  up() {
    ctx?.resume?.();
    tone(880, 0, 0.15);
    tone(1175, 0.18, 0.3, 0.45);
  },
  // Falling double beep: effort goes down / rest
  down() {
    ctx?.resume?.();
    tone(880, 0, 0.15);
    tone(587, 0.18, 0.3);
  },
  finish() {
    ctx?.resume?.();
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.16, 0.25, 0.4));
  },
};

let trVoice = null;
function pickVoice() {
  const voices = window.speechSynthesis?.getVoices() || [];
  trVoice = voices.find((v) => v.lang?.toLowerCase().startsWith('tr')) || null;
}
if ('speechSynthesis' in window) {
  pickVoice();
  window.speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

export function speak(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'tr-TR';
  if (trVoice) u.voice = trVoice;
  u.rate = 1.05;
  window.speechSynthesis.speak(u);
}

export function vibrate(pattern) {
  navigator.vibrate?.(pattern);
}
