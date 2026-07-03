import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

function getRuleBody(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = styles.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `missing CSS rule: ${selector}`);
  return match[1];
}

test('saveable result image remains square-cornered for WeChat long-press saving', () => {
  const rule = getRuleBody('.result-panel img');

  assert.match(rule, /border-radius:\s*0(?:px)?\s*;/);
  assert.match(rule, /-webkit-touch-callout:\s*default\s*;/);
});
