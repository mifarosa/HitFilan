// "Workout done" pictures for sharing (e.g. Instagram), drawn on a canvas and
// exported as PNG. Three styles:
//   card         1080x1920 story with a sporty background
//   transparent  1080x1080, no background (a sticker over the user's own photo)
//   strip        1080x200 one-line slanted pill, transparent around it
// Input: { name, durationSec, date, hiit: { count, secs } | null }
export const SHARE_STYLES = [
  { id: 'card', label: 'Arka planlı' },
  { id: 'transparent', label: 'Saydam' },
  { id: 'strip', label: 'Çizgi' },
];

export const SITE = 'hitfilan.mifarosa.com';

const ACCENT = '#ff7a1a';
const DARK_ACCENT = '#a64a06';
const FONT = '"Arial Black", "Helvetica Neue", Impact, system-ui, sans-serif';
const LEAN = 0; // plain upright text

const upper = (s) => s.toLocaleUpperCase('tr-TR');
const weekdayFmt = new Intl.DateTimeFormat('tr-TR', { weekday: 'long' });
const dayFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' });

let logoPromise = null;
function loadLogo() {
  if (!logoPromise) {
    logoPromise = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null); // the picture still works without the logo
      img.src = 'icons/icon-512.png';
    });
  }
  return logoPromise;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Slanted block: the top edge is shifted by `lean` * height (positive = leans left).
function slantPath(ctx, x, y, w, h, lean) {
  const dx = lean * h;
  ctx.beginPath();
  ctx.moveTo(x - dx, y);
  ctx.lineTo(x + w - dx, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

function shadowOn(ctx, on, blur = 16) {
  if (on) {
    ctx.shadowColor = 'rgba(0,0,0,.7)';
    ctx.shadowBlur = blur;
    ctx.shadowOffsetY = 4;
  } else {
    ctx.shadowColor = 'transparent';
  }
}

// Draws upright (optionally slanted) text with a soft shadow.
function slantText(ctx, text, x, y, { size, color = '#fff', align = 'left', lean = 0, shadow, maxWidth }) {
  let s = size;
  ctx.font = `900 ${s}px ${FONT}`;
  while (maxWidth && ctx.measureText(text).width > maxWidth && s > 18) {
    s -= 2;
    ctx.font = `900 ${s}px ${FONT}`;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.transform(1, 0, lean, 1, 0, 0);
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  shadowOn(ctx, shadow);
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawLogo(ctx, logo, x, y, size, shadow) {
  ctx.save();
  shadowOn(ctx, shadow, 14);
  roundRectPath(ctx, x, y, size, size, size * 0.24);
  if (logo) {
    ctx.clip();
    ctx.drawImage(logo, x, y, size, size);
  } else {
    ctx.fillStyle = ACCENT;
    ctx.fill();
  }
  ctx.restore();
}

function lines(d) {
  const minutes = Math.max(1, Math.round(d.durationSec / 60));
  const when = new Date(d.date);
  return {
    minutes,
    day: upper(weekdayFmt.format(when)),
    date: upper(dayFmt.format(when)),
    hiit: d.hiit ? `HIIT · ${d.hiit.count} TUR` : '',
  };
}

// The main composition, designed on a 1080x1080 box with its top-left at (0, 0).
function drawComposition(ctx, d, logo, { lean, shadow }) {
  const L = lines(d);
  const cx = 540;

  // Brand: logo + name, at the top
  const brandSize = 92;
  ctx.font = `900 ${brandSize}px ${FONT}`;
  const wHit = ctx.measureText('HIT').width;
  const wFilan = ctx.measureText('FILAN').width;
  const logoSize = 128;
  const total = logoSize + 28 + wHit + wFilan;
  const x0 = cx - total / 2;
  drawLogo(ctx, logo, x0, 40, logoSize, shadow);
  slantText(ctx, 'HIT', x0 + logoSize + 28, 40 + logoSize * 0.74, { size: brandSize, lean, shadow });
  slantText(ctx, 'FILAN', x0 + logoSize + 28 + wHit, 40 + logoSize * 0.74, { size: brandSize, color: ACCENT, lean, shadow });

  // Tag
  slantText(ctx, 'ANTRENMAN TAMAM', cx, 290, { size: 50, color: ACCENT, align: 'center', lean, shadow });

  // Minutes: the hero number
  ctx.font = `900 380px ${FONT}`;
  const wNum = ctx.measureText(String(L.minutes)).width;
  ctx.font = `900 120px ${FONT}`;
  const wDk = ctx.measureText('DK').width;
  const gap = 24;
  const nx = cx - (wNum + gap + wDk) / 2;
  slantText(ctx, String(L.minutes), nx, 600, { size: 380, lean, shadow });
  slantText(ctx, 'DK', nx + wNum + gap, 600, { size: 120, color: ACCENT, lean, shadow });

  // Day and date
  slantText(ctx, `${L.day} · ${L.date}`, cx, 700, { size: 56, align: 'center', lean, shadow, maxWidth: 960 });

  // HIIT amount in an accent block
  if (L.hiit) {
    ctx.font = `900 54px ${FONT}`;
    const w = Math.min(960, ctx.measureText(L.hiit).width + 90);
    ctx.save();
    shadowOn(ctx, shadow, 10);
    ctx.fillStyle = DARK_ACCENT;
    slantPath(ctx, cx - w / 2 + 9, 759, w, 96, lean);
    ctx.fill();
    shadowOn(ctx, false);
    ctx.fillStyle = ACCENT;
    slantPath(ctx, cx - w / 2, 750, w, 96, lean);
    ctx.fill();
    ctx.restore();
    slantText(ctx, L.hiit, cx, 819, { size: 54, color: '#16110c', align: 'center', lean, maxWidth: w - 60 });
  }

  // Site
  slantText(ctx, SITE, cx, 960, { size: 40, align: 'center', lean, shadow, color: 'rgba(255,255,255,.92)' });
}

function drawCard(d, logo) {
  const [c, ctx] = makeCanvas(1080, 1920);
  const g = ctx.createLinearGradient(0, 0, 0, 1920);
  g.addColorStop(0, '#0a0e13');
  g.addColorStop(0.55, '#141b23');
  g.addColorStop(1, '#25140a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1080, 1920);

  // Speed lines
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.05)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 16; i++) {
    const y = 120 + i * 46;
    ctx.beginPath();
    ctx.moveTo(1080, y);
    ctx.lineTo(1080 - (260 + (i % 4) * 140), y + 90);
    ctx.stroke();
  }
  ctx.restore();

  // Diagonal accent bands
  ctx.fillStyle = 'rgba(255,122,26,.13)';
  ctx.beginPath();
  ctx.moveTo(0, 1560);
  ctx.lineTo(1080, 1260);
  ctx.lineTo(1080, 1420);
  ctx.lineTo(0, 1720);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.moveTo(0, 1740);
  ctx.lineTo(1080, 1440);
  ctx.lineTo(1080, 1470);
  ctx.lineTo(0, 1770);
  ctx.closePath();
  ctx.fill();
  const glow = ctx.createRadialGradient(540, 1800, 40, 540, 1800, 700);
  glow.addColorStop(0, 'rgba(255,122,26,.35)');
  glow.addColorStop(1, 'rgba(255,122,26,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 900, 1080, 1020);

  ctx.save();
  ctx.translate(0, 420);
  drawComposition(ctx, d, logo, { lean: LEAN, shadow: false });
  ctx.restore();
  return c;
}

// Sticker-style text: thick dark outline so it reads on any photo, soft shadow underneath.
function stickerText(ctx, text, x, y, { size, color = '#fff', align = 'center', lean = 0, maxWidth, outline = '#0d1117' }) {
  let sz = size;
  ctx.font = `900 ${sz}px ${FONT}`;
  while (maxWidth && ctx.measureText(text).width > maxWidth && sz > 18) {
    sz -= 2;
    ctx.font = `900 ${sz}px ${FONT}`;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.transform(1, 0, lean, 1, 0, 0);
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.lineWidth = sz * 0.16;
  ctx.strokeStyle = outline;
  shadowOn(ctx, true, 14);
  ctx.strokeText(text, 0, 0);
  shadowOn(ctx, false);
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawTransparent(d, logo) {
  const [c, ctx] = makeCanvas(1080, 1080);
  const L = lines(d);
  const cx = 540;

  // Brand
  ctx.font = `900 88px ${FONT}`;
  const wHit = ctx.measureText('HIT').width;
  const wFilan = ctx.measureText('FILAN').width;
  const logoSize = 120;
  const x0 = cx - (logoSize + 26 + wHit + wFilan) / 2;
  drawLogo(ctx, logo, x0, 60, logoSize, true);
  stickerText(ctx, 'HIT', x0 + logoSize + 26, 60 + logoSize * 0.74, { size: 88, align: 'left' });
  stickerText(ctx, 'FILAN', x0 + logoSize + 26 + wHit, 60 + logoSize * 0.74, { size: 88, align: 'left', color: ACCENT });

  // Minutes, day, HIIT, site: plain centered lines
  stickerText(ctx, `${L.minutes} DK`, cx, 520, { size: 300, maxWidth: 940 });
  stickerText(ctx, `${L.day} · ${L.date}`, cx, 650, { size: 58, maxWidth: 940 });
  if (L.hiit) stickerText(ctx, L.hiit, cx, 760, { size: 58, color: ACCENT, maxWidth: 940 });
  stickerText(ctx, SITE, cx, 940, { size: 42, color: 'rgba(255,255,255,.95)' });
  return c;
}

function drawStrip(d, logo) {
  const [c, ctx] = makeCanvas(1080, 200);
  const L = lines(d);
  const lean = LEAN;
  ctx.fillStyle = 'rgba(13,17,23,.84)';
  slantPath(ctx, 70, 12, 960, 176, lean);
  ctx.fill();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 5;
  ctx.stroke();
  // accent edge on the left
  ctx.fillStyle = ACCENT;
  slantPath(ctx, 70, 12, 22, 176, lean);
  ctx.fill();

  drawLogo(ctx, logo, 120, 34, 84, false);
  const parts = [`${L.minutes} DK`, L.day];
  if (L.hiit) parts.push(`HIIT ${d.hiit.count} TUR`);
  slantText(ctx, parts.join(' · '), 228, 96, { size: 58, lean, maxWidth: 770 });
  slantText(ctx, `HITFILAN · ${SITE}`, 228, 160, { size: 30, color: ACCENT, lean, maxWidth: 770 });
  return c;
}

export async function renderShareCanvas(style, d) {
  try { await document.fonts?.ready; } catch { /* fonts API missing */ }
  const logo = await loadLogo();
  if (style === 'card') return drawCard(d, logo);
  if (style === 'strip') return drawStrip(d, logo);
  return drawTransparent(d, logo);
}

export async function renderShareImage(style, d) {
  const canvas = await renderShareCanvas(style, d);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });
}

// Shares the PNG through the system share sheet when files are supported
// (phones: Instagram is in the list), else downloads it.
export async function shareOrSave(style, d, mode) {
  const blob = await renderShareImage(style, d);
  const name = `hitfilan-${style}.png`;
  const file = new File([blob], name, { type: 'image/png' });
  if (mode === 'share' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
      // fall through to a download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'saved';
}
