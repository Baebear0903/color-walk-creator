import { pickReadableTextColor } from './color.mjs';
import { classifyAssetLayout, computeOutputSizeFromCrop, splitContentLines } from './layout.mjs';
import { getAssetSource } from './media.mjs';

export const MIN_FONT_SIZE = 24;
export const DEFAULT_FONT_SIZE_RATIO = 0.12;
export const MAX_FONT_SIZE_RATIO = 0.24;

export function createPosterCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1440;
  return canvas;
}

export function renderPoster(canvas, asset, state, frame = 0) {
  const context = canvas.getContext('2d');
  const source = getAssetSource(asset);
  const color = state.colorHex;
  const textColor = state.textColor || pickReadableTextColor(color);
  const layout = classifyAssetLayout(asset.width, asset.height);
  const palettePosition = state.palettePosition || layout.defaultPalettePosition;
  const outputSize = computeOutputSizeFromCrop(asset.cropRect, asset.orientation);

  canvas.width = outputSize.width;
  canvas.height = outputSize.height;
  context.clearRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const regions = computeRegions(canvas.width, canvas.height, asset.orientation, palettePosition);
  drawContainedMedia(context, source, asset.cropRect, regions.media, frame);
  drawSoftDivider(context, regions, palettePosition);
  drawPosterText(context, state, textColor, regions.palette);
}

export function computeRegions(width, height, orientation, palettePosition) {
  if (orientation === 'portrait') {
    const mediaWidth = Math.round(height * (2 / 3));
    const paletteWidth = width - mediaWidth;
    const palette = palettePosition === 'left'
      ? { x: 0, y: 0, width: paletteWidth, height }
      : { x: mediaWidth, y: 0, width: paletteWidth, height };
    const media = palettePosition === 'left'
      ? { x: paletteWidth, y: 0, width: mediaWidth, height }
      : { x: 0, y: 0, width: mediaWidth, height };

    return { palette, media };
  }

  const mediaHeight = Math.round(width * (2 / 3));
  const paletteHeight = height - mediaHeight;
  const palette = palettePosition === 'bottom'
    ? { x: 0, y: mediaHeight, width, height: paletteHeight }
    : { x: 0, y: 0, width, height: paletteHeight };
  const media = palettePosition === 'bottom'
    ? { x: 0, y: 0, width, height: mediaHeight }
    : { x: 0, y: paletteHeight, width, height: mediaHeight };

  return { palette, media };
}

function drawContainedMedia(context, source, cropRect, region, frame) {
  const pulse = 1 + Math.sin(frame * Math.PI * 2) * 0.004;
  const width = region.width * pulse;
  const height = region.height * pulse;
  const x = region.x + (region.width - width) / 2;
  const y = region.y + (region.height - height) / 2;

  context.drawImage(
    source,
    cropRect.x,
    cropRect.y,
    cropRect.width,
    cropRect.height,
    x,
    y,
    width,
    height,
  );
}

function drawSoftDivider(context, regions, palettePosition) {
  const vertical = palettePosition === 'left' || palettePosition === 'right';
  const edge = vertical
    ? regions.media.x === 0 ? regions.palette.x : regions.media.x
    : regions.media.y === 0 ? regions.palette.y : regions.media.y;

  context.fillStyle = 'rgba(255,255,255,0.36)';

  if (vertical) {
    context.fillRect(edge - 1, 0, 2, regions.media.height);
  } else {
    context.fillRect(0, edge - 1, regions.media.width, 2);
  }
}

function drawPosterText(context, state, textColor, region) {
  const fontSize = clampFontSize(state.fontSizePx || computeDefaultFontSize(region), region);
  const baseLineHeight = fontSize * 1.34;

  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = textColor;
  context.font = `${fontSize}px ${state.fontFamily}`;

  const lines = wrapTextToLines(
    context,
    splitContentLines(state.contentText || state.colorHex),
    region.width * 0.82,
  );
  const lineHeight = Math.min(baseLineHeight, (region.height * 0.84) / Math.max(1, lines.length));
  const totalHeight = lineHeight * lines.length;
  const startY = region.y + region.height / 2 - totalHeight / 2 + lineHeight / 2;

  lines.forEach((line, index) => {
    context.globalAlpha = index === 0 ? 1 : 0.88;
    context.fillText(line, region.x + region.width / 2, startY + index * lineHeight);
  });

  context.globalAlpha = 1;
}

export function computeDefaultFontSize(region) {
  return Math.round(Math.min(region.width, region.height) * DEFAULT_FONT_SIZE_RATIO);
}

export function clampFontSize(value, region) {
  const maxSize = Math.max(MIN_FONT_SIZE, Math.round(Math.min(region.width, region.height) * MAX_FONT_SIZE_RATIO));
  const size = Number.isFinite(Number(value)) ? Math.round(Number(value)) : computeDefaultFontSize(region);
  return Math.max(MIN_FONT_SIZE, Math.min(maxSize, size));
}

export function wrapTextToLines(context, lines, maxWidth) {
  return lines.flatMap((line) => wrapLine(context, line, maxWidth));
}

function wrapLine(context, text, maxWidth) {
  if (!text) return [''];
  if (context.measureText(text).width <= maxWidth) {
    return [text];
  }

  const wrapped = [];
  let current = '';

  for (const char of Array.from(text)) {
    const next = `${current}${char}`;

    if (current && context.measureText(next).width > maxWidth) {
      wrapped.push(current);
      current = char;
    } else {
      current = next;
    }
  }

  if (current) {
    wrapped.push(current);
  }

  return wrapped;
}
