import test from 'node:test';
import assert from 'node:assert/strict';

import { fonts } from '../src/fonts.mjs';

test('colorwalk research fonts are pinned to the top of the font list', () => {
  assert.deepEqual(
    fonts.slice(0, 6).map((font) => font.id),
    ['special-elite', 'rubbed-on', 'vibrant', 'cooper', 'bebas', 'bodoni'],
  );
});

test('colorwalk research fonts include readable fallback families', () => {
  for (const font of fonts.slice(0, 6)) {
    assert.match(font.family, /,/);
  }
});
