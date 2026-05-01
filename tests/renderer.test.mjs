import test from 'node:test';
import assert from 'node:assert/strict';

import { computeRegions } from '../src/renderer.mjs';

test('computeRegions places the media region below a top landscape palette', () => {
  const regions = computeRegions(540, 720, 'landscape', 'top');

  assert.deepEqual(regions.palette, { x: 0, y: 0, width: 540, height: 360 });
  assert.deepEqual(regions.media, { x: 0, y: 360, width: 540, height: 360 });
});

test('computeRegions places the media region beside a right portrait palette', () => {
  const regions = computeRegions(540, 720, 'portrait', 'right');

  assert.deepEqual(regions.media, { x: 0, y: 0, width: 480, height: 720 });
  assert.deepEqual(regions.palette, { x: 480, y: 0, width: 60, height: 720 });
});

test('computeRegions preserves landscape ratios for high-resolution output', () => {
  const regions = computeRegions(3000, 4000, 'landscape', 'bottom');

  assert.deepEqual(regions.media, { x: 0, y: 0, width: 3000, height: 2000 });
  assert.deepEqual(regions.palette, { x: 0, y: 2000, width: 3000, height: 2000 });
});

test('computeRegions preserves portrait ratios for high-resolution output', () => {
  const regions = computeRegions(4000, 3000, 'portrait', 'left');

  assert.deepEqual(regions.palette, { x: 0, y: 0, width: 2000, height: 3000 });
  assert.deepEqual(regions.media, { x: 2000, y: 0, width: 2000, height: 3000 });
});
