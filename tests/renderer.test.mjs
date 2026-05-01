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
