import { extractDominantColorFromPixels, normalizeHex, pickReadableTextColor, rgbToHex } from './color.mjs';
import { fonts } from './fonts.mjs';
import { createPosterState, getAllowedPalettePositions, getDefaultPalettePosition } from './layout.mjs';
import { loadAsset, getSamplePixels } from './media.mjs';
import { isPointInRegion, mapClientPointToCanvasPoint } from './picker.mjs';
import { computeRegions, createPosterCanvas, renderPoster } from './renderer.mjs';

const state = {
  asset: null,
  autoColorHex: '#FF6B9A',
  colorHex: '#FF6B9A',
  candidates: [],
  contentText: '#FF6B9A',
  fontId: 'playfair',
  fontFamily: fonts[0].family,
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
  colorInput: document.querySelector('#color-input'),
  colorHex: document.querySelector('#color-hex'),
  swatches: document.querySelector('#swatches'),
  palettePosition: document.querySelector('#palette-position'),
  contentText: document.querySelector('#content-text'),
  fontSelect: document.querySelector('#font-select'),
  resultImage: document.querySelector('#result-image'),
  resultPanel: document.querySelector('#result-panel'),
};

const canvas = createPosterCanvas();
const renderContext = canvas.getContext('2d', { willReadFrequently: true });

init();

function init() {
  setupFonts();
  bindEvents();
  renderControls();
}

function setupFonts() {
  fonts.forEach((font) => {
    const option = document.createElement('option');
    option.value = font.id;
    option.textContent = font.label;
    elements.fontSelect.append(option);
  });
}

function bindEvents() {
  elements.fileInput.addEventListener('change', handleFileSelect);
  elements.colorInput.addEventListener('input', handleColorInput);
  elements.resultImage.addEventListener('pointerdown', handleResultPointerDown);
  elements.contentText.addEventListener('input', () => updateTextState(elements.contentText.value));
  elements.fontSelect.addEventListener('change', handleFontSelect);
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
    applyColor(palette.primary.hex, false);
    elements.uploadLabel.textContent = '上传图片';
    elements.appShell.dataset.hasAsset = 'true';
    renderControls();
    await renderResult(++state.renderNonce);
  } catch (error) {
    state.asset = null;
    elements.appShell.dataset.hasAsset = 'false';
    setStatus(error.message, true);
  } finally {
    elements.fileInput.value = '';
  }
}

function handleColorInput(event) {
  const next = normalizeHex(event.target.value);
  if (!next) return;
  applyColor(next, false);
  scheduleRenderResult();
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

function handleFontSelect(event) {
  const selected = fonts.find((font) => font.id === event.target.value) || fonts[0];
  state.fontId = selected.id;
  state.fontFamily = selected.family;
  scheduleRenderResult();
}

function scheduleRenderResult() {
  if (!state.asset) return;

  const nonce = ++state.renderNonce;
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

    renderPoster(canvas, state.asset, state);
    const blob = await canvasToBlob(canvas, 'image/png', 0.95);
    if (!state.asset || nonce !== state.renderNonce) return;

    replaceResultImage(blob);
    elements.appShell.dataset.hasAsset = 'true';
    elements.resultPanel.hidden = false;
    setStatus(`高清图 ${canvas.width}x${canvas.height} 已更新，长按保存。`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function applyColor(hex, updateText) {
  state.colorHex = hex;
  state.textColor = pickReadableTextColor(hex);
  elements.colorInput.value = hex;
  elements.colorHex.textContent = hex;

  if (updateText) {
    state.contentText = hex;
  }

  renderControls();
}

function renderControls() {
  elements.contentText.value = state.contentText;
  elements.fontSelect.value = state.fontId;
  elements.colorInput.value = state.colorHex;
  elements.colorHex.textContent = state.colorHex;
  elements.resultImage.dataset.picking = state.pickerActive ? 'true' : 'false';
  renderPalettePositionControls();
  renderSwatches();
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
