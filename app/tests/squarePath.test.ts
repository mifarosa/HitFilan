import { describe, expect, it } from 'vitest';
import { roundedFrame } from '@/ui/squarePath';

describe('rounded square frame', () => {
  it('has the length of a rounded rectangle', () => {
    const { length } = roundedFrame(200, 100, 20);
    expect(length).toBeCloseTo(2 * 160 + 2 * 60 + 2 * Math.PI * 20, 5);
  });

  it('starts and ends at the top middle, running clockwise', () => {
    const { path } = roundedFrame(200, 100, 20);
    expect(path.startsWith('M 100 0 L 180 0')).toBe(true); // first goes right along the top
    expect(path.endsWith('L 100 0')).toBe(true);
  });

  it('keeps the frame inside the box by the inset and clamps a too big radius', () => {
    const { path, length } = roundedFrame(100, 40, 500, 3.5);
    expect(path.startsWith('M 50 3.5')).toBe(true);
    // the radius shrinks to half the short side: a stadium shape
    expect(length).toBeCloseTo(2 * (93 - 33) + 2 * Math.PI * 16.5, 1);
  });

  it('survives a card that is not measured yet', () => {
    const { length } = roundedFrame(0, 0, 26, 3.5);
    expect(Number.isFinite(length)).toBe(true);
  });
});
