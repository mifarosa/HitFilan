// Same palette as the web app (css/style.css).
export const colors = {
  bg: '#101418',
  surface: '#182028',
  surface2: '#212b35',
  line: '#2c3844',
  text: '#eef2f5',
  muted: '#8d9aa7',
  accent: '#ff7a1a',
  accentInk: '#1a0d02',
  easy: '#3fb68b',
  moderate: '#f2b233',
  hard: '#ef4d4d',
  warn: '#ffb020',
};

// Level id of a step ('easy' | 'moderate' | 'hard' | 'work' | 'rest' | 'prep') -> color.
export function levelColor(level: string): string {
  switch (level) {
    case 'easy':
    case 'rest':
      return colors.easy;
    case 'moderate':
      return colors.moderate;
    case 'hard':
    case 'work':
      return colors.hard;
    default:
      return colors.muted;
  }
}
