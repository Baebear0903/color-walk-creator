import test from 'node:test';
import assert from 'node:assert/strict';

import { isPointInRegion, mapClientPointToCanvasPoint } from '../src/picker.mjs';

test('mapClientPointToCanvasPoint maps CSS-scaled pointer coordinates to canvas pixels', () => {
  const point = mapClientPointToCanvasPoint(
    { clientX: 145, clientY: 200 },
    { left: 10, top: 20, width: 270, height: 360 },
    { width: 540, height: 720 },
  );

  assert.deepEqual(point, { x: 270, y: 360 });
});

test('mapClientPointToCanvasPoint clamps coordinates inside the canvas bounds', () => {
  const point = mapClientPointToCanvasPoint(
    { clientX: 281, clientY: 381 },
    { left: 10, top: 20, width: 270, height: 360 },
    { width: 540, height: 720 },
  );

  assert.deepEqual(point, { x: 539, y: 719 });
});

test('isPointInRegion accepts points inside a rectangular media region only', () => {
  const region = { x: 40, y: 80, width: 300, height: 220 };

  assert.equal(isPointInRegion({ x: 40, y: 80 }, region), true);
  assert.equal(isPointInRegion({ x: 339, y: 299 }, region), true);
  assert.equal(isPointInRegion({ x: 340, y: 299 }, region), false);
  assert.equal(isPointInRegion({ x: 120, y: 300 }, region), false);
});
