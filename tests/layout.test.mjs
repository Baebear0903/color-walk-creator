import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyAssetLayout,
  computeMediaCropRect,
  computeOutputSizeFromCrop,
  createPosterState,
  getAllowedPalettePositions,
  splitContentLines,
} from '../src/layout.mjs';

test('classifyAssetLayout returns target ratios and default palette positions', () => {
  assert.deepEqual(classifyAssetLayout(3000, 2000), {
    orientation: 'landscape',
    normalizedRatio: '3:2',
    defaultPalettePosition: 'top',
    outputWidth: 1080,
    outputHeight: 1440,
  });

  assert.deepEqual(classifyAssetLayout(2000, 3000), {
    orientation: 'portrait',
    normalizedRatio: '2:3',
    defaultPalettePosition: 'right',
    outputWidth: 1440,
    outputHeight: 1080,
  });
});

test('computeMediaCropRect keeps 3:2 and 2:3 source media intact', () => {
  assert.deepEqual(computeMediaCropRect(3000, 2000, 'landscape'), {
    x: 0,
    y: 0,
    width: 3000,
    height: 2000,
  });

  assert.deepEqual(computeMediaCropRect(2000, 3000, 'portrait'), {
    x: 0,
    y: 0,
    width: 2000,
    height: 3000,
  });
});

test('computeMediaCropRect center-crops 4:3 and 3:4 media to 3:2 and 2:3', () => {
  assert.deepEqual(computeMediaCropRect(4000, 3000, 'landscape'), {
    x: 0,
    y: 167,
    width: 4000,
    height: 2667,
  });

  assert.deepEqual(computeMediaCropRect(3000, 4000, 'portrait'), {
    x: 167,
    y: 0,
    width: 2667,
    height: 4000,
  });
});

test('computeOutputSizeFromCrop matches landscape media crop clarity', () => {
  assert.deepEqual(computeOutputSizeFromCrop({ width: 3000, height: 2000 }, 'landscape'), {
    width: 3000,
    height: 4000,
  });
});

test('computeOutputSizeFromCrop matches portrait media crop clarity', () => {
  assert.deepEqual(computeOutputSizeFromCrop({ width: 2000, height: 3000 }, 'portrait'), {
    width: 4000,
    height: 3000,
  });
});

test('computeOutputSizeFromCrop constrains oversized output for mobile browsers', () => {
  assert.deepEqual(computeOutputSizeFromCrop({ width: 6000, height: 4000 }, 'landscape'), {
    width: 3072,
    height: 4096,
  });
});

test('getAllowedPalettePositions constrains controls by orientation', () => {
  assert.deepEqual(getAllowedPalettePositions('landscape'), ['top', 'bottom']);
  assert.deepEqual(getAllowedPalettePositions('portrait'), ['left', 'right']);
});

test('createPosterState defaults content text to extracted color', () => {
  const state = createPosterState('#F0C418', 'portrait');

  assert.equal(state.contentText, '#F0C418');
  assert.equal(state.palettePosition, 'right');
});

test('splitContentLines preserves intentional line breaks and removes empty outer lines', () => {
  assert.deepEqual(splitContentLines('\n#F0C418\nTaiziwan Park\n10:25am\n'), [
    '#F0C418',
    'Taiziwan Park',
    '10:25am',
  ]);
});
