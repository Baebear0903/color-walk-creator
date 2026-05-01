import { extractDominantColorFromPixels, normalizeHex, pickReadableTextColor, rgbToHex } from './color.mjs';
import { fonts } from './fonts.mjs';
import {
  computeOutputSizeFromCrop,
  createPosterState,
  getAllowedPalettePositions,
  getDefaultPalettePosition,
} from './layout.mjs';
import { loadAsset, getSamplePixels } from './media.mjs';
import { isPointInRegion, mapClientPointToCanvasPoint } from './picker.mjs';
import {
  clampFontSize,
  computeDefaultFontSize,
  computeRegions,
  createPosterCanvas,
  renderPoster,
} from './renderer.mjs';

const state = {
  asset: null,
  autoColorHex: '#FF6B9A',
  colorHex: '#FF6B9A',
  candidates: [],
  contentText: '#FF6B9A',
  fontId: fonts[0].id,
  fontFamily: fonts[0].family,
  fontSizePx: 0,
  fontSizeTouched: false,
  palettePosition: 'top',
  pickerActive: false,
  textColor: '#102033',
  resultUrl: '',
  renderTimer: 0,
  renderNonce: 0,
};

const elements = {
  appShell: document.querySelector('#app-shell'),
  fileInput: document.querySelector('#file-input'),
  uploadLabel: document.querySelector('#upload-label'),
  status: document.querySelector('#status'),
  colorPreview: document.querySelector('#color-preview'),
  colorHex: document.querySelector('#color-hex'),
  swatches: document.querySelector('#swatches'),
  fontPicker: document.querySelector('#font-picker'),
  fontSizeDecrease: document.querySelector('#font-size-decrease'),
  fontSizeIncrease: document.querySelector('#font-size-increase'),
  fontSizeValue: document.querySelector('#font-size-value'),
  palettePosition: document.querySelector('#palette-position'),
  contentText: document.querySelector('#content-text'),
  resultImage: document.querySelector('#result-image'),
  renderLoading: document.querySelector('#render-loading'),
  resultPanel: document.querySelector('#result-panel'),
};

const canvas = createPosterCanvas();
const renderContext = canvas.getContext('2d', { willReadFrequently: true });

init();

function init() {
  bindEvents();
  renderControls();
}

function bindEvents() {
  elements.fileInput.addEventListener('change', handleFileSelect);
  elements.resultImage.addEventListener('pointerdown', handleResultPointerDown);
  elements.contentText.addEventListener('input', () => updateTextState(elements.contentText.value));
  elements.fontSizeDecrease.addEventListener('click', () => stepFontSize(-4));
  elements.fontSizeIncrease.addEventListener('click', () => stepFontSize(4));
  elements.fontSizeValue.addEventListener('change', commitFontSizeInput);
  elements.fontSizeValue.addEventListener('keydown', handleFontSizeKeydown);
}

async function handleFileSelect(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  setStatus('正在读取素材...');
  clearResultImage();

  try {
    state.asset = await loadAsset(file);
    const sample = await getSamplePixels(state.asset);
    const palette = extractDominantColorFromPixels(sample.pixels, sample);
    const nextPosterState = createPosterState(palette.primary.hex, state.asset.orientation);

    state.autoColorHex = palette.primary.hex;
    state.candidates = palette.candidates.slice(0, 5);
    state.pickerActive = false;
    state.palettePosition = nextPosterState.palettePosition;
    state.contentText = nextPosterState.contentText;
    state.fontSizeTouched = false;
    applyColor(palette.primary.hex, false);
    syncFontSize();
    elements.uploadLabel.textContent = '上传图片';
    elements.appShell.dataset.hasAsset = 'true';
    renderControls();
    setLoading(true);
    await renderResult(++state.renderNonce);
  } catch (error) {
    state.asset = null;
    elements.appShell.dataset.hasAsset = 'false';
    setStatus(error.message, true);
  } finally {
    elements.fileInput.value = '';
  }
}

function handleToggleColorPicker() {
  if (!state.asset) {
    setStatus('先上传一张静态图片。', true);
    return;
  }

  state.pickerActive = !state.pickerActive;
  renderControls();
  setStatus(state.pickerActive ? '点击成图中的照片区域取色。' : '');
}

function handleResultPointerDown(event) {
  if (!state.pickerActive || !state.asset) return;

  event.preventDefault();

  const point = mapClientPointToCanvasPoint(
    event,
    elements.resultImage.getBoundingClientRect(),
    canvas,
  );
  const regions = computeRegions(
    canvas.width,
    canvas.height,
    state.asset.orientation,
    state.palettePosition,
  );

  if (!isPointInRegion(point, regions.media)) {
    setStatus('请点选成图中的照片区域。', true);
    return;
  }

  const pixel = renderContext.getImageData(point.x, point.y, 1, 1).data;
  const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);

  state.pickerActive = false;
  applyColor(hex, false);
  scheduleRenderResult();
  setStatus(`已取色 ${hex}。`);
}

function updateTextState(value) {
  state.contentText = value;
  scheduleRenderResult();
}

function handleFontSelect(fontId) {
  const selected = fonts.find((font) => font.id === fontId) || fonts[0];
  state.fontId = selected.id;
  state.fontFamily = selected.family;
  renderControls();
  scheduleRenderResult();
}

function stepFontSize(delta) {
  const region = getCurrentPaletteRegion();
  state.fontSizeTouched = true;
  state.fontSizePx = clampFontSize((state.fontSizePx || computeDefaultFontSize(region)) + delta, region);
  renderControls();
  scheduleRenderResult();
}

function handleFontSizeKeydown(event) {
  if (event.key !== 'Enter') return;

  event.preventDefault();
  commitFontSizeInput();
  elements.fontSizeValue.blur();
}

function commitFontSizeInput() {
  const value = Number.parseInt(elements.fontSizeValue.value, 10);
  if (!Number.isFinite(value)) {
    renderControls();
    return;
  }

  state.fontSizeTouched = true;
  state.fontSizePx = clampFontSize(value, getCurrentPaletteRegion());
  renderControls();
  scheduleRenderResult();
}

function scheduleRenderResult() {
  if (!state.asset) return;

  const nonce = ++state.renderNonce;
  setLoading(true);
  window.clearTimeout(state.renderTimer);
  state.renderTimer = window.setTimeout(() => {
    state.renderTimer = 0;
    void renderResult(nonce);
  }, 80);
}

async function renderResult(nonce) {
  if (!state.asset || nonce !== state.renderNonce) return;

  try {
    await document.fonts?.ready;
    if (!state.asset || nonce !== state.renderNonce) return;

    syncFontSize();
    renderPoster(canvas, state.asset, state);
    const blob = await canvasToBlob(canvas, 'image/png', 0.95);
    if (!state.asset || nonce !== state.renderNonce) return;

    replaceResultImage(blob);
    elements.appShell.dataset.hasAsset = 'true';
    elements.resultPanel.hidden = false;
    setStatus(`高清图 ${canvas.width}x${canvas.height} 已更新，长按保存。`);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    if (nonce === state.renderNonce) {
      setLoading(false);
    }
  }
}

function applyColor(hex, updateText) {
  state.colorHex = hex;
  state.textColor = pickReadableTextColor(hex);
  elements.colorPreview.style.background = hex;
  elements.colorHex.textContent = hex;

  if (updateText) {
    state.contentText = hex;
  }

  renderControls();
}

function renderControls() {
  elements.contentText.value = state.contentText;
  elements.colorPreview.style.background = state.colorHex;
  elements.colorHex.textContent = state.colorHex;
  elements.fontSizeValue.value = state.fontSizePx || '';
  elements.resultImage.dataset.picking = state.pickerActive ? 'true' : 'false';
  renderPalettePositionControls();
  renderSwatches();
  renderFontPicker();
}

function renderSwatches() {
  elements.swatches.replaceChildren();

  const swatches = state.candidates.length > 0
    ? state.candidates.slice(0, 5)
    : [{ hex: '#FF6B9A' }, { hex: '#FFD166' }, { hex: '#36C9A3' }, { hex: '#33A8FF' }, { hex: '#9B5CFF' }];

  swatches.forEach((candidate) => {
    const button = document.createElement('button');
    button.className = 'swatch';
    button.type = 'button';
    button.style.background = candidate.hex;
    button.title = candidate.hex;
    button.setAttribute('aria-label', `选择 ${candidate.hex}`);
    button.dataset.active = candidate.hex === state.colorHex ? 'true' : 'false';
    button.addEventListener('click', () => {
      state.pickerActive = false;
      applyColor(candidate.hex, false);
      scheduleRenderResult();
    });
    elements.swatches.append(button);
  });

  const pickButton = document.createElement('button');
  pickButton.className = 'swatch swatch-pick';
  pickButton.type = 'button';
  pickButton.textContent = '取色';
  pickButton.setAttribute('aria-label', '点选照片区域取色');
  pickButton.dataset.active = state.pickerActive ? 'true' : 'false';
  pickButton.addEventListener('click', handleToggleColorPicker);
  elements.swatches.append(pickButton);
}

function renderFontPicker() {
  elements.fontPicker.replaceChildren();

  fonts.forEach((font) => {
    const button = document.createElement('button');
    button.className = 'font-option';
    button.type = 'button';
    button.textContent = font.label;
    button.style.fontFamily = font.family;
    button.dataset.active = font.id === state.fontId ? 'true' : 'false';
    button.setAttribute('aria-label', `选择字体 ${font.label}`);
    button.addEventListener('click', () => handleFontSelect(font.id));
    elements.fontPicker.append(button);
  });
}

function renderPalettePositionControls() {
  const orientation = state.asset?.orientation || 'landscape';
  const allowedPositions = getAllowedPalettePositions(orientation);
  const labels = {
    top: '上',
    bottom: '下',
    left: '左',
    right: '右',
  };

  if (!allowedPositions.includes(state.palettePosition)) {
    state.palettePosition = getDefaultPalettePosition(orientation);
  }

  elements.palettePosition.replaceChildren();
  allowedPositions.forEach((position) => {
    const button = document.createElement('button');
    button.className = 'segment-button';
    button.type = 'button';
    button.textContent = labels[position];
    button.dataset.active = position === state.palettePosition ? 'true' : 'false';
    button.addEventListener('click', () => {
      state.palettePosition = position;
      syncFontSize();
      renderControls();
      scheduleRenderResult();
    });
    elements.palettePosition.append(button);
  });
}

function replaceResultImage(blob) {
  if (state.resultUrl) {
    URL.revokeObjectURL(state.resultUrl);
  }

  state.resultUrl = URL.createObjectURL(blob);
  elements.resultImage.src = state.resultUrl;
}

function clearResultImage() {
  window.clearTimeout(state.renderTimer);
  state.renderTimer = 0;
  state.renderNonce += 1;

  if (state.resultUrl) {
    URL.revokeObjectURL(state.resultUrl);
  }

  state.resultUrl = '';
  elements.resultImage.removeAttribute('src');
  elements.resultPanel.hidden = true;
  setLoading(false);
}

function syncFontSize() {
  if (!state.asset) return;

  const region = getCurrentPaletteRegion();
  state.fontSizePx = state.fontSizeTouched
    ? clampFontSize(state.fontSizePx, region)
    : computeDefaultFontSize(region);
}

function getCurrentPaletteRegion() {
  if (!state.asset) {
    return { width: 540, height: 360 };
  }

  const outputSize = computeOutputSizeFromCrop(state.asset.cropRect, state.asset.orientation);
  return computeRegions(
    outputSize.width,
    outputSize.height,
    state.asset.orientation,
    state.palettePosition,
  ).palette;
}

function setLoading(isLoading) {
  elements.renderLoading.hidden = !isLoading;
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.dataset.error = isError ? 'true' : 'false';
}

function canvasToBlob(targetCanvas, type = 'image/png', quality = 0.95) {
  return new Promise((resolve, reject) => {
    targetCanvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('图片生成失败，请重试。'));
    }, type, quality);
  });
}
