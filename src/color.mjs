const CHANNEL_MAX = 255;

export function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(CHANNEL_MAX, Math.round(value))).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

export function normalizeHex(value) {
  const raw = String(value || '').trim().replace(/^#/, '');

  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw.split('').map((char) => char + char).join('').toUpperCase()}`;
  }

  if (/^[0-9a-fA-F]{6}$/.test(raw)) {
    return `#${raw.toUpperCase()}`;
  }

  return null;
}

export function hexToRgb(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;

  const value = normalized.slice(1);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

export function rgbToHsl(r, g, b) {
  const nr = r / CHANNEL_MAX;
  const ng = g / CHANNEL_MAX;
  const nb = b / CHANNEL_MAX;
  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: lightness };
  }

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue;

  if (max === nr) {
    hue = (ng - nb) / delta + (ng < nb ? 6 : 0);
  } else if (max === ng) {
    hue = (nb - nr) / delta + 2;
  } else {
    hue = (nr - ng) / delta + 4;
  }

  return { h: Math.round(hue * 60), s: saturation, l: lightness };
}

export function pickReadableTextColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#102033';

  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / CHANNEL_MAX;
  return luminance > 0.54 ? '#102033' : '#FFF9EE';
}

function colorKey(r, g, b) {
  const size = 8;
  const qr = Math.round(r / size) * size;
  const qg = Math.round(g / size) * size;
  const qb = Math.round(b / size) * size;
  return `${qr},${qg},${qb}`;
}

function bucketToCandidate(bucket, totalPixels) {
  const r = bucket.r / bucket.count;
  const g = bucket.g / bucket.count;
  const b = bucket.b / bucket.count;
  const hsl = rgbToHsl(r, g, b);
  const coverage = bucket.count / Math.max(1, totalPixels);
  const chromaBoost = 0.65 + hsl.s * 1.45;
  const lightnessPenalty = 1 - Math.abs(hsl.l - 0.52) * 0.55;
  const score = bucket.count * chromaBoost * Math.max(0.5, lightnessPenalty);

  return {
    hex: rgbToHex(r, g, b),
    score,
    coverage,
    hsl: {
      h: hsl.h,
      s: Number(hsl.s.toFixed(4)),
      l: Number(hsl.l.toFixed(4)),
    },
  };
}

export function extractDominantColorFromPixels(pixels, { width, height, maxCandidates = 5 } = {}) {
  if (!pixels || pixels.length < 4) {
    throw new Error('extractDominantColorFromPixels requires RGBA pixel data.');
  }

  const buckets = new Map();
  const totalPixels = width && height ? width * height : Math.floor(pixels.length / 4);

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha < 128) continue;

    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const key = colorKey(r, g, b);
    const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, count: 0 };

    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  const candidates = [...buckets.values()]
    .map((bucket) => bucketToCandidate(bucket, totalPixels))
    .sort((a, b) => b.coverage - a.coverage || b.score - a.score);

  const diverseCandidates = selectDiverseCandidates(candidates, maxCandidates);

  if (diverseCandidates.length === 0) {
    const fallback = { hex: '#FFFFFF', score: 0, coverage: 0, hsl: { h: 0, s: 0, l: 1 } };
    return { primary: fallback, candidates: [fallback] };
  }

  return {
    primary: diverseCandidates[0],
    candidates: diverseCandidates,
  };
}

function selectDiverseCandidates(candidates, maxCandidates) {
  if (candidates.length <= maxCandidates) {
    return candidates;
  }

  const selected = [];
  const remaining = [...candidates];
  const hueThresholds = [28, 18, 10, 0];

  for (const threshold of hueThresholds) {
    for (let index = 0; index < remaining.length && selected.length < maxCandidates;) {
      const candidate = remaining[index];
      const isDiverse = selected.every((selectedCandidate) => hueDistance(candidate.hsl.h, selectedCandidate.hsl.h) >= threshold);

      if (isDiverse || threshold === 0) {
        selected.push(candidate);
        remaining.splice(index, 1);
      } else {
        index += 1;
      }
    }

    if (selected.length >= maxCandidates) break;
  }

  return selected.slice(0, maxCandidates);
}

function hueDistance(a, b) {
  const distance = Math.abs(a - b);
  return Math.min(distance, 360 - distance);
}
