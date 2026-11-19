// Draws the app icons from the web app's icons/icon.svg (the bike glyph):
//   assets/icon.png                   1024x1024, square, no transparency (the App Store wants it; iOS rounds the corners)
//   assets/android-icon-foreground.png 1024x1024, transparent, glyph inside the adaptive-icon safe zone
//   assets/splash-icon.png            1024x1024, transparent glyph (the splash colour comes from app.json)
// Usage: node tools/make-icon.mjs   (needs Playwright's Chromium, e.g. the one in this environment)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const svg = readFileSync(new URL('../../icons/icon.svg', import.meta.url), 'utf8');
// The glyph group of the svg (everything inside <g ...>...</g>), drawn on our own canvas.
const glyph = svg.match(/<g[\s\S]*<\/g>/)[0];
const BG = '#101418';

const page = (inner, background) => `<!doctype html><html><body style="margin:0;background:${background}">
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${inner}</svg></body></html>`;

// The glyph was drawn on 512x512 with its content between about x 72..440 and y 140..408.
const centered = (scale) => {
  const cx = 256, cy = 274; // middle of the drawn bike
  return `<g transform="translate(512 512) scale(${scale}) translate(${-cx} ${-cy})">${glyph}</g>`;
};

const jobs = [
  ['icon.png', page(`<rect width="1024" height="1024" fill="${BG}"/>${centered(1.95)}`, BG), false],
  ['android-icon-foreground.png', page(centered(1.55), 'transparent'), true],
  ['splash-icon.png', page(centered(2.0), 'transparent'), true],
];

mkdirSync(new URL('../assets/', import.meta.url), { recursive: true });
const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
for (const [name, html, transparent] of jobs) {
  await tab.setContent(html);
  const png = await tab.screenshot({ omitBackground: transparent });
  writeFileSync(new URL(`../assets/${name}`, import.meta.url), png);
}
await browser.close();
console.log('wrote', jobs.map((j) => j[0]).join(', '));
