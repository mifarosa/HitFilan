// Exercise picture: start and end photos shown in turn, so the move "plays".
// Exercises without photos get a simple drawn placeholder.
import { exercisePhotos } from './data.js';

const PLACEHOLDER = `
  <svg class="ex-ph" viewBox="0 0 48 48" aria-hidden="true">
    <circle cx="24" cy="9" r="5"/>
    <path d="M24 15v15M24 20l-9 6M24 20l9-6M24 30l-7 12M24 30l7 12"/>
  </svg>`;

// size: 'thumb' (small, still) or 'full' (large, animated)
export function visualHTML(id, size = 'full', alt = '') {
  const photos = exercisePhotos(id);
  const cls = `ex-visual ${size}`;
  if (!photos) return `<div class="${cls} none" role="img" aria-label="${alt}">${PLACEHOLDER}</div>`;
  const lazy = size === 'thumb' ? ' loading="lazy"' : '';
  if (size === 'thumb') {
    return `<div class="${cls}"><img src="${photos[0]}" alt="${alt}"${lazy} decoding="async"></div>`;
  }
  return `
    <div class="${cls} anim" role="img" aria-label="${alt}">
      <img src="${photos[0]}" alt="" decoding="async">
      <img src="${photos[1]}" alt="" decoding="async">
    </div>`;
}
