export const LANDSCAPE_OUTPUT = { width: 1080, height: 1440 };
export const PORTRAIT_OUTPUT = { width: 1440, height: 1080 };

const TARGET_RATIOS = {
  landscape: 3 / 2,
  portrait: 2 / 3,
};

export function classifyAssetLayout(width, height) {
  const orientation = width >= height ? 'landscape' : 'portrait';
  const output = orientation === 'landscape' ? LANDSCAPE_OUTPUT : PORTRAIT_OUTPUT;

  return {
    orientation,
    normalizedRatio: orientation === 'landscape' ? '3:2' : '2:3',
    defaultPalettePosition: getDefaultPalettePosition(orientation),
    outputWidth: output.width,
    outputHeight: output.height,
  };
}

export function computeMediaCropRect(width, height, orientation) {
  const targetRatio = TARGET_RATIOS[orientation] || TARGET_RATIOS.landscape;
  const sourceRatio = width / height;

  if (Math.abs(sourceRatio - targetRatio) < 0.01) {
    return { x: 0, y: 0, width, height };
  }

  if (sourceRatio > targetRatio) {
    const croppedWidth = Math.round(height * targetRatio);
    return {
      x: Math.round((width - croppedWidth) / 2),
      y: 0,
      width: croppedWidth,
      height,
    };
  }

  const croppedHeight = Math.round(width / targetRatio);
  return {
    x: 0,
    y: Math.round((height - croppedHeight) / 2),
    width,
    height: croppedHeight,
  };
}

export function getAllowedPalettePositions(orientation) {
  return orientation === 'portrait' ? ['left', 'right'] : ['top', 'bottom'];
}

export function getDefaultPalettePosition(orientation) {
  return orientation === 'portrait' ? 'right' : 'top';
}

export function createPosterState(colorHex, orientation = 'landscape') {
  return {
    colorHex,
    contentText: colorHex,
    palettePosition: getDefaultPalettePosition(orientation),
  };
}

export function splitContentLines(contentText) {
  const lines = String(contentText || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.length > 0 ? lines : [''];
}
