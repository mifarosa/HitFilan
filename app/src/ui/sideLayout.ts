// Sideways with a video: how wide the video and the card are in each of the card's three sizes.
// A smaller card gives its room to the video, which stays 16:9 and never gets taller than the screen.

export type SideMode = 'full' | 'half' | 'quarter';

const ORDER: SideMode[] = ['full', 'half', 'quarter'];

export const nextSideMode = (mode: SideMode): SideMode => ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];

export const parseSideMode = (value: unknown): SideMode => (ORDER.includes(value as SideMode) ? (value as SideMode) : 'full');

const GAP = 28; // between the video and the card (12) and the right margin (16)
const MIN_FULL = 240;
const HALF = 150;
const QUARTER = 92;

export function sideLayout(mode: SideMode, availW: number, availH: number): { videoW: number; cardW: number } {
  const byHeight = (availH * 16) / 9; // the widest 16:9 video that fits the height
  const fullVideo = Math.min(byHeight, availW - MIN_FULL - GAP);
  const fullCard = Math.max(MIN_FULL, availW - fullVideo - GAP);
  const cardW = mode === 'full' ? fullCard : mode === 'half' ? HALF : QUARTER;
  const videoW = Math.max(160, Math.min(byHeight, availW - cardW - GAP));
  return { videoW, cardW };
}
