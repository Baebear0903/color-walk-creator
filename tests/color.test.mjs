import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractDominantColorFromPixels,
  normalizeHex,
  pickReadableTextColor,
  rgbToHex,
} from '../src/color.mjs';

test('extractDominantColorFromPixels ranks candidates by coverage', () => {
  const pixels = [];

  for (let i = 0; i < 80; i += 1) {
    pixels.push(238, 238, 232, 255);
  }

  for (let i = 0; i < 28; i += 1) {
    pixels.push(240, 196, 24, 255);
  }

  for (let i = 0; i < 10; i += 1) {
    pixels.push(40, 36, 34, 255);
  }

  const result = extractDominantColorFromPixels(Uint8ClampedArray.from(pixels), {
    width: 12,
    height: 10,
  });

  assert.equal(result.primary.hex, '#EEEEE8');
  assert.equal(result.candidates[0].hex, '#EEEEE8');
});

test('extractDominantColorFromPixels returns top coverage colors when hues differ', () => {
  const pixels = Uint8ClampedArray.from([
    254, 92, 134, 255,
    254, 92, 134, 255,
    30, 168, 216, 255,
    30, 168, 216, 255,
    30, 168, 216, 255,
  ]);

  const result = extractDominantColorFromPixels(pixels, { width: 5, height: 1 });

  assert.equal(result.candidates.length, 2);
  assert.equal(result.candidates[0].hex, '#1EA8D8');
  assert.equal(result.candidates[1].hex, '#FE5C86');
});

test('extractDominantColorFromPixels keeps five dominant colors from different hue families', () => {
  const pixels = [];
  const addColor = (rgb, count) => {
    for (let i = 0; i < count; i += 1) {
      pixels.push(...rgb, 255);
    }
  };

  addColor([232, 58, 76], 40);
  addColor([235, 72, 92], 36);
  addColor([236, 84, 104], 34);
  addColor([36, 151, 224], 30);
  addColor([44, 176, 116], 28);
  addColor([244, 198, 52], 26);
  addColor([124, 82, 214], 24);

  const result = extractDominantColorFromPixels(Uint8ClampedArray.from(pixels), {
    width: pixels.length / 4,
    height: 1,
  });

  assert.deepEqual(result.candidates.map((candidate) => candidate.hex), [
    '#E83A4C',
    '#2497E0',
    '#2CB074',
    '#F4C634',
    '#7C52D6',
  ]);
});

test('normalizeHex accepts short and long hex values', () => {
  assert.equal(normalizeHex('fff'), '#FFFFFF');
  assert.equal(normalizeHex('#1ea8d8'), '#1EA8D8');
  assert.equal(normalizeHex('bad-value'), null);
});

test('rgbToHex and pickReadableTextColor format preview text safely', () => {
  assert.equal(rgbToHex(12, 170, 240), '#0CAAF0');
  assert.equal(pickReadableTextColor('#0CAAF0'), '#102033');
  assert.equal(pickReadableTextColor('#312030'), '#FFF9EE');
});
