import { pickReadableTextColor } from './color.mjs';
import { classifyAssetLayout, splitContentLines } from './layout.mjs';
import { getAssetSource } from './media.mjs';

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

  canvas.width = layout.outputWidth;
  canvas.height = layout.outputHeight;
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
  const lines = splitContentLines(state.contentText || state.colorHex);
  const shortestSide = Math.min(region.width, region.height);
  const fontSize = Math.max(30, Math.min(62, Math.round(shortestSide * 0.12)));
  const lineHeight = fontSize * 1.34;
  const totalHeight = lineHeight * lines.length;
  const startY = region.y + region.height / 2 - totalHeight / 2 + lineHeight / 2;

  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = textColor;
  context.font = `${fontSize}px ${state.fontFamily}`;

  lines.forEach((line, index) => {
    context.globalAlpha = index === 0 ? 1 : 0.88;
    drawFittedLine(
      context,
      line,
      region.x + region.width / 2,
      startY + index * lineHeight,
      region.width * 0.82,
    );
  });

  context.globalAlpha = 1;
}

function drawFittedLine(context, text, x, y, maxWidth) {
  if (context.measureText(text).width <= maxWidth) {
    context.fillText(text, x, y);
    return;
  }

  let fitted = text;
  while (fitted.length > 1 && context.measureText(`${fitted}...`).width > maxWidth) {
    fitted = fitted.slice(0, -1);
  }
  context.fillText(`${fitted}...`, x, y);
}
