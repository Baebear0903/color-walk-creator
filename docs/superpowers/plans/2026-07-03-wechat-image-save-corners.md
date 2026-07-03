# WeChat Image Save Corners Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the CSS clipping source that causes WeChat's long-press save flow to bake rounded corners into generated images, then publish and verify the fix on GitHub Pages.

**Architecture:** Keep the Canvas-to-PNG generation pipeline unchanged. Add a focused CSS regression test, set the saveable `<img>` element's radius to zero, verify the actual mobile-sized UI, and use the existing `main` branch GitHub Pages workflow for deployment.

**Tech Stack:** Static HTML/CSS, browser Canvas API, Node.js 22 built-in test runner, Python static HTTP server, GitHub Actions, GitHub Pages.

## Global Constraints

- Do not add dependencies, analytics, telemetry, or network requests.
- Do not change Canvas dimensions, PNG export format, image content, or editing behavior.
- Do not add a Blob download button or WeChat JS-SDK integration.
- Keep the existing `-webkit-touch-callout: default` long-press behavior.
- Do not modify `.github/workflows/pages.yml`; the existing `main` push workflow is sufficient.
- Limit code changes to `styles.css` and `tests/styles.test.mjs`; the specification and this plan are documentation artifacts.

---

## File Structure

- Create `tests/styles.test.mjs`: regression coverage for the saveable result image's computed intent in the stylesheet.
- Modify `styles.css`: make `.result-panel img` square-cornered while retaining sizing, background, shadow, and touch-callout rules.
- Reuse `.github/workflows/pages.yml`: test and deploy the repository root after a push to `main`; no file change.

### Task 1: Add the CSS regression test and minimal fix

**Files:**
- Create: `tests/styles.test.mjs`
- Modify: `styles.css:112-123`
- Test: `tests/styles.test.mjs`

**Interfaces:**
- Consumes: the `.result-panel img { ... }` rule in `styles.css`.
- Produces: an invariant that the saveable image has `border-radius: 0` and retains `-webkit-touch-callout: default`.

- [ ] **Step 1: Write the failing regression test**

Create `tests/styles.test.mjs` with:

```js
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
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/styles.test.mjs
```

Expected: FAIL because the current rule contains `border-radius: 8px`, so the `border-radius: 0` assertion does not match. The touch-callout assertion must already match.

- [ ] **Step 3: Implement the minimal CSS change**

In `.result-panel img`, replace only the radius declaration:

```css
.result-panel img {
  width: auto;
  max-width: 100%;
  max-height: 64svh;
  object-fit: contain;
  border-radius: 0;
  background: #fff;
  box-shadow: 0 10px 28px rgba(16, 32, 51, 0.18);
  -webkit-user-select: auto;
  user-select: auto;
  -webkit-touch-callout: default;
}
```

Do not add clipping, masks, `overflow: hidden`, or a rounded parent wrapper.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
node --test tests/styles.test.mjs
```

Expected: PASS with one passing test and zero failures.

- [ ] **Step 5: Run the full automated suite**

Run:

```bash
npm test
git diff --check
```

Expected: all Node tests pass; `git diff --check` exits zero with no output.

### Task 2: Verify the real mobile-sized page locally

**Files:**
- Verify only: `index.html`, `styles.css`, `src/app.mjs`

**Interfaces:**
- Consumes: local page at `http://127.0.0.1:5173/` and the image input `#file-input`.
- Produces: runtime evidence that `#result-image` is square-cornered and the existing editing flow remains usable.

- [ ] **Step 1: Start the configured static server**

Run:

```bash
npm run serve
```

Expected: Python serves the repository on port 5173. Keep the process running only for local validation.

- [ ] **Step 2: Open the page with a phone-sized viewport and upload representative media**

Use the in-app browser at `http://127.0.0.1:5173/`, set a viewport close to `390x844`, and upload:

```text
/Users/yangyinglin/.codex/attachments/9859c888-47c8-474e-8948-1ca25b642642/image-1.jpg
```

Expected: the workspace appears and the status reports an updated high-resolution image.

- [ ] **Step 3: Verify computed style and visible corners**

Evaluate in the rendered page:

```js
const image = document.querySelector('#result-image');
const style = getComputedStyle(image);
const imageRule = Array.from(document.styleSheets)
  .flatMap((sheet) => Array.from(sheet.cssRules))
  .find((rule) => rule.selectorText === '.result-panel img');
({
  loaded: image.complete && image.naturalWidth > 0,
  borderRadius: style.borderRadius,
  touchCalloutDeclaration: imageRule.style.getPropertyValue('-webkit-touch-callout'),
  parentOverflow: getComputedStyle(image.parentElement).overflow,
});
```

Expected:

```js
{
  loaded: true,
  borderRadius: '0px',
  touchCalloutDeclaration: 'default',
  parentOverflow: 'visible'
}
```

Capture a screenshot showing the generated image with four square corners.

- [ ] **Step 4: Smoke-test existing interactions**

Change the content text, change the palette position, and use the re-upload control.

Expected: the generated image updates after each edit and the re-upload input remains available. No console errors are introduced.

### Task 3: Commit and publish the implementation

**Files:**
- Commit: `styles.css`
- Commit: `tests/styles.test.mjs`
- Preserve: `.github/workflows/pages.yml`

**Interfaces:**
- Consumes: a clean automated and browser verification result.
- Produces: a `main` commit on `origin` that triggers the Pages workflow.

- [ ] **Step 1: Audit the implementation diff**

Run:

```bash
git status --short
git diff -- styles.css tests/styles.test.mjs
git diff --check
```

Expected: only `styles.css` and `tests/styles.test.mjs` are uncommitted; no whitespace errors.

- [ ] **Step 2: Create the implementation commit**

Run:

```bash
git add styles.css tests/styles.test.mjs
git commit -m "fix: preserve square corners when saving images"
```

Expected: commit succeeds and includes exactly two files.

- [ ] **Step 3: Re-run verification on the exact committed state**

Run:

```bash
npm test
git status --short
```

Expected: all tests pass and the worktree is clean.

- [ ] **Step 4: Confirm GitHub authentication and push `main`**

Run:

```bash
gh auth status
git push origin main
```

Expected: authentication is valid and `origin/main` advances to the local `main` commit. If authentication fails, stop without exposing credentials.

- [ ] **Step 5: Monitor the exact Pages workflow run**

Run:

```bash
HEAD_SHA=$(git rev-parse HEAD)
for attempt in {1..12}; do
  RUN_ID=$(gh run list --workflow pages.yml --branch main --limit 20 --json databaseId,headSha --jq ".[] | select(.headSha == \"$HEAD_SHA\") | .databaseId" | head -n 1)
  test -n "$RUN_ID" && break
  sleep 5
done
test -n "$RUN_ID"
gh run watch "$RUN_ID" --exit-status
gh run view "$RUN_ID" --json headSha,status,conclusion,url
```

Expected: the run for the exact local `HEAD_SHA` is found, finishes with `conclusion: success`, and both the `Test` and `Deploy` jobs pass.

### Task 4: Verify the published GitHub Pages page

**Files:**
- Verify remote: `https://baebear0903.github.io/color-walk-creator/styles.css`
- Verify page: `https://baebear0903.github.io/color-walk-creator/`

**Interfaces:**
- Consumes: successful Pages deployment for the pushed commit.
- Produces: authoritative online evidence that the live page serves the square-corner fix.

- [ ] **Step 1: Verify the deployed stylesheet with cache bypass**

Run:

```bash
SHA=$(git rev-parse HEAD)
curl -fsSL "https://baebear0903.github.io/color-walk-creator/styles.css?rev=$SHA" | sed -n '/\.result-panel img {/,/^}/p'
```

Expected: the live `.result-panel img` rule contains `border-radius: 0` and `-webkit-touch-callout: default`.

- [ ] **Step 2: Repeat the mobile browser validation online**

Set the cache-busted online URL, then open the printed value in the in-app browser:

```bash
SHA=$(git rev-parse HEAD)
ONLINE_URL="https://baebear0903.github.io/color-walk-creator/?rev=$SHA"
echo "$ONLINE_URL"
```

Upload the same representative image and repeat the Task 2 computed-style evaluation.

Expected: the online generated image loads with `borderRadius: '0px'`, `touchCalloutDeclaration: 'default'`, and a non-clipping parent. Existing edits still update the image.

- [ ] **Step 3: Perform the completion audit**

Run:

```bash
npm test
git status --short
git log -2 --oneline
```

Confirm all objective requirements:

- Root cause is documented as a WeChat WebView/CSS compatibility issue, not user error.
- The saveable image no longer has CSS corner clipping.
- Regression tests and full tests pass on the final commit.
- Local and online mobile-sized UI checks pass.
- The Pages run for the final commit succeeded.
- The repository is clean and no unrelated files changed.
