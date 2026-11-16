// Geometry of the rounded-square progress frame. Pure, so it can be tested without a screen.

export interface Frame {
  path: string; // starts at the top middle and runs clockwise
  length: number; // total length, for strokeDasharray / strokeDashoffset
}

/** A rounded rectangle of w x h with corner radius r, drawn `inset` px inside the box (half the stroke). */
export function roundedFrame(w: number, h: number, r: number, inset = 0): Frame {
  const x0 = inset;
  const y0 = inset;
  const x1 = w - inset;
  const y1 = h - inset;
  const rr = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
  const cx = (x0 + x1) / 2;
  const f = (n: number) => Number(n.toFixed(2));
  const path = [
    `M ${f(cx)} ${f(y0)}`,
    `L ${f(x1 - rr)} ${f(y0)}`,
    `A ${f(rr)} ${f(rr)} 0 0 1 ${f(x1)} ${f(y0 + rr)}`,
    `L ${f(x1)} ${f(y1 - rr)}`,
    `A ${f(rr)} ${f(rr)} 0 0 1 ${f(x1 - rr)} ${f(y1)}`,
    `L ${f(x0 + rr)} ${f(y1)}`,
    `A ${f(rr)} ${f(rr)} 0 0 1 ${f(x0)} ${f(y1 - rr)}`,
    `L ${f(x0)} ${f(y0 + rr)}`,
    `A ${f(rr)} ${f(rr)} 0 0 1 ${f(x0 + rr)} ${f(y0)}`,
    `L ${f(cx)} ${f(y0)}`,
  ].join(' ');
  const length = 2 * (x1 - x0 - 2 * rr) + 2 * (y1 - y0 - 2 * rr) + 2 * Math.PI * rr;
  return { path, length };
}
