import { describe, expect, it } from 'vitest';
import { nextSideMode, parseSideMode, sideLayout } from '@/ui/sideLayout';

describe('sideways layout', () => {
  // iPhone 13 sideways: 844 wide minus the 47 px insets, about 390 high
  const W = 750;
  const H = 370;

  it('cycles full -> half -> quarter -> full', () => {
    expect(nextSideMode('full')).toBe('half');
    expect(nextSideMode('half')).toBe('quarter');
    expect(nextSideMode('quarter')).toBe('full');
  });

  it('falls back to full for anything unknown', () => {
    expect(parseSideMode('half')).toBe('half');
    expect(parseSideMode(undefined)).toBe('full');
    expect(parseSideMode('huge')).toBe('full');
  });

  it('gives the video the room the card gives up', () => {
    const full = sideLayout('full', W, H);
    const half = sideLayout('half', W, H);
    const quarter = sideLayout('quarter', W, H);
    expect(half.cardW).toBeLessThan(full.cardW);
    expect(quarter.cardW).toBeLessThan(half.cardW);
    expect(half.videoW).toBeGreaterThan(full.videoW);
    expect(quarter.videoW).toBeGreaterThanOrEqual(half.videoW);
  });

  it('never makes the video taller than the screen or the row wider than it', () => {
    for (const mode of ['full', 'half', 'quarter'] as const) {
      for (const [w, h] of [[750, 370], [838, 397], [667, 355], [560, 300]]) {
        const { videoW, cardW } = sideLayout(mode, w, h);
        expect(videoW * (9 / 16)).toBeLessThanOrEqual(h + 0.5);
        expect(videoW + cardW + 28).toBeLessThanOrEqual(w + 0.5);
        expect(cardW).toBeGreaterThanOrEqual(90);
      }
    }
  });

  it('the full card is at least 240 px wide, like before', () => {
    expect(sideLayout('full', W, H).cardW).toBeGreaterThanOrEqual(240);
  });
});
