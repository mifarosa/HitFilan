// "Workout done" pictures for sharing (e.g. Instagram), drawn on a canvas and
// exported as PNG. Three styles:
//   card         1080x1920 story with a background
//   transparent  1080x1080, no background (a sticker over the user's own photo)
//   strip        1080x180 one-line pill, transparent around it
export const SHARE_STYLES = [
  { id: 'card', label: 'Arka planlı' },
  { id: 'transparent', label: 'Saydam' },
  { id: 'strip', label: 'Çizgi' },
];

const ACCENT = '#ff7a1a';
const GREEN = '#35c47c';
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' });

const mmss = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

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

// Shrinks the font until the text fits maxWidth.
function fitText(ctx, text, maxWidth, size, weight) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${FONT}`;
    s -= 2;
  } while (ctx.measureText(text).width > maxWidth && s > 16);
}

function checkBadge(ctx, cx, cy, r) {
  ctx.fillStyle = GREEN;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0d1117';
  ctx.lineWidth = r * 0.14;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.38, cy + r * 0.02);
  ctx.lineTo(cx - r * 0.1, cy + r * 0.3);
  ctx.lineTo(cx + r * 0.42, cy - r * 0.28);
  ctx.stroke();
}

function stats(d) {
  const out = [
    { value: mmss(d.durationSec), label: 'süre' },
    { value: `~${d.kcal}`, label: 'kcal' },
    { value: dateFmt.format(new Date(d.date)), label: 'tarih' },
  ];
  return out;
}

function drawStats(ctx, d, cx, y, width, valueSize, labelSize, shadow) {
  const items = stats(d);
  const colW = width / items.length;
  items.forEach((it, i) => {
    const x = cx - width / 2 + colW * (i + 0.5);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    if (shadow) {
      ctx.shadowColor = 'rgba(0,0,0,.65)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 3;
    }
    ctx.fillStyle = '#fff';
    fitText(ctx, it.value, colW - 16, valueSize, 800);
    ctx.fillText(it.value, x, y);
    ctx.fillStyle = shadow ? '#fff' : 'rgba(255,255,255,.62)';
    ctx.font = `600 ${labelSize}px ${FONT}`;
    ctx.fillText(it.label, x, y + labelSize + 14);
    ctx.shadowColor = 'transparent';
  });
}

function drawContent(ctx, d, cx, top, scale, shadow) {
  const s = scale;
  if (shadow) {
    ctx.shadowColor = 'rgba(0,0,0,.65)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
  }
  checkBadge(ctx, cx, top + 90 * s, 90 * s);
  ctx.shadowColor = 'transparent';

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (shadow) {
    ctx.shadowColor = 'rgba(0,0,0,.65)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 3;
  }
  ctx.fillStyle = '#fff';
  ctx.font = `800 ${86 * s}px ${FONT}`;
  ctx.fillText('Antrenman tamam!', cx, top + 280 * s);
  ctx.fillStyle = ACCENT;
  fitText(ctx, d.name, 900, 54 * s, 700);
  ctx.fillText(d.name, cx, top + 360 * s);
  ctx.shadowColor = 'transparent';

  drawStats(ctx, d, cx, top + 540 * s, 960, 84 * s, 34 * s, shadow);

  if (d.streak > 0) {
    const text = `${d.streak} haftalık seri`;
    ctx.font = `700 ${38 * s}px ${FONT}`;
    const w = ctx.measureText(text).width + 70 * s;
    const y = top + 690 * s;
    ctx.fillStyle = 'rgba(255,122,26,.18)';
    roundRectPath(ctx, cx - w / 2, y - 48 * s, w, 70 * s, 35 * s);
    ctx.fill();
    ctx.fillStyle = ACCENT;
    ctx.fillText(text, cx, y);
  }
}

function drawCard(d) {
  const [c, ctx] = makeCanvas(1080, 1920);
  const g = ctx.createLinearGradient(0, 0, 0, 1920);
  g.addColorStop(0, '#0d1117');
  g.addColorStop(0.6, '#161b22');
  g.addColorStop(1, '#2a1708');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1080, 1920);
  const glow = ctx.createRadialGradient(540, 1700, 40, 540, 1700, 760);
  glow.addColorStop(0, 'rgba(255,122,26,.40)');
  glow.addColorStop(1, 'rgba(255,122,26,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1080, 1920);

  drawContent(ctx, d, 540, 430, 1.1, false);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = `800 64px ${FONT}`;
  const w1 = ctx.measureText('Hit').width;
  const w2 = ctx.measureText('Filan').width;
  const x0 = 540 - (w1 + w2) / 2;
  ctx.textAlign = 'left';
  ctx.fillText('Hit', x0, 1780);
  ctx.fillStyle = ACCENT;
  ctx.fillText('Filan', x0 + w1, 1780);
  return c;
}

function drawTransparent(d) {
  const [c, ctx] = makeCanvas(1080, 1080);
  drawContent(ctx, d, 540, 110, 1, true);
  return c;
}

function drawStrip(d) {
  const [c, ctx] = makeCanvas(1080, 180);
  ctx.fillStyle = 'rgba(13,17,23,.82)';
  roundRectPath(ctx, 6, 6, 1068, 168, 84);
  ctx.fill();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 4;
  ctx.stroke();
  checkBadge(ctx, 90, 90, 44);
  const text = `${d.name} · ${mmss(d.durationSec)} · ~${d.kcal} kcal`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  fitText(ctx, text, 880, 58, 700);
  ctx.fillText(text, 160, 92);
  return c;
}

// d = { name, durationSec, kcal, date, streak }
export async function renderShareCanvas(style, d) {
  try { await document.fonts?.ready; } catch { /* fonts API missing */ }
  if (style === 'card') return drawCard(d);
  if (style === 'strip') return drawStrip(d);
  return drawTransparent(d);
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
