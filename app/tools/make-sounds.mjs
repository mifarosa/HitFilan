// Writes the cue sounds (same notes as the web app's js/audio.js) as small 16-bit mono WAV files.
// Usage: node tools/make-sounds.mjs
import { mkdirSync, writeFileSync } from 'node:fs';

const RATE = 22050;
// [frequency Hz, start s, duration s, volume]
const CUES = {
  tick: [[660, 0, 0.07, 0.18]],
  count: [[880, 0, 0.14, 0.45]],
  warn: [[988, 0, 0.1, 0.4], [1319, 0.12, 0.1, 0.4], [988, 0.24, 0.1, 0.4]],
  up: [[880, 0, 0.15, 0.35], [1175, 0.18, 0.3, 0.45]],
  down: [[880, 0, 0.15, 0.35], [587, 0.18, 0.3, 0.35]],
  finish: [[523, 0, 0.25, 0.4], [659, 0.16, 0.25, 0.4], [784, 0.32, 0.25, 0.4], [1047, 0.48, 0.25, 0.4]],
};

function render(notes) {
  const total = Math.max(...notes.map(([, at, dur]) => at + dur)) + 0.06;
  const samples = new Float64Array(Math.ceil(total * RATE));
  for (const [freq, at, dur, vol] of notes) {
    const from = Math.floor(at * RATE);
    const count = Math.floor(dur * RATE);
    for (let i = 0; i < count; i++) {
      const t = i / RATE;
      const attack = Math.min(1, t / 0.01);
      const fade = Math.exp((-5 * i) / count);
      samples[from + i] += Math.sin(2 * Math.PI * freq * t) * vol * attack * fade;
    }
  }
  const pcm = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), i * 2));
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + pcm.length, 4); head.write('WAVE', 8); head.write('fmt ', 12);
  head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22); head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34); head.write('data', 36);
  head.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([head, pcm]);
}

mkdirSync(new URL('../assets/sounds/', import.meta.url), { recursive: true });
for (const [name, notes] of Object.entries(CUES)) {
  writeFileSync(new URL(`../assets/sounds/${name}.wav`, import.meta.url), render(notes));
}
console.log('wrote', Object.keys(CUES).join(', '));
