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
};

const elements = {
  fileInput: document.querySelector('#file-input'),
  uploadLabel: document.querySelector('#upload-label'),
  status: document.querySelector('#status'),
  preview: document.querySelector('#preview'),
  emptyPreview: document.querySelector('#empty-preview'),
  colorInput: document.querySelector('#color-input'),
  colorHex: document.querySelector('#color-hex'),
  autoColorButton: document.querySelector('#auto-color-button'),
  pickColorButton: document.querySelector('#pick-color-button'),
  swatches: document.querySelector('#swatches'),
  palettePosition: document.querySelector('#palette-position'),
  contentText: document.querySelector('#content-text'),
  fontSelect: document.querySelector('#font-select'),
  generate: document.querySelector('#generate-button'),
  resultImage: document.querySelector('#result-image'),
  resultPanel: document.querySelector('#result-panel'),
};

const canvas = createPosterCanvas();
const previewContext = elements.preview.getContext('2d');

init();

function init() {
  setupFonts();
  bindEvents();
  renderControls();
  drawPlaceholder();
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
  elements.autoColorButton.addEventListener('click', handleUseAutoColor);
  elements.pickColorButton.addEventListener('click', handleToggleColorPicker);
  elements.preview.addEventListener('pointerdown', handlePreviewPointerDown);
  elements.contentText.addEventListener('input', () => updateTextState(elements.contentText.value));
  elements.fontSelect.addEventListener('change', handleFontSelect);
  elements.generate.addEventListener('click', handleGenerate);
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
    state.candidates = palette.candidates;
    state.pickerActive = false;
    state.palettePosition = nextPosterState.palettePosition;
    state.contentText = nextPosterState.contentText;
    applyColor(palette.primary.hex, false);
    elements.uploadLabel.textContent = file.name;
    elements.emptyPreview.hidden = true;
    drawPreview();
    setStatus(`已提取主色 ${state.colorHex}，素材按 ${state.asset.normalizedRatio} 处理。`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function handleColorInput(event) {
  const next = normalizeHex(event.target.value);
  if (!next) return;
  applyColor(next, false);
  drawPreview();
}

function handleUseAutoColor() {
  if (!state.asset) return;

  state.pickerActive = false;
  applyColor(state.autoColorHex, false);
  drawPreview();
  setStatus(`已恢复自动提取主色 ${state.colorHex}。`);
}

function handleToggleColorPicker() {
  if (!state.asset) {
    setStatus('先上传一张静态图片。', true);
    return;
  }

  state.pickerActive = !state.pickerActive;
  renderControls();
  drawPreview();
  setStatus(state.pickerActive ? '在预览图的照片区域点击或触摸取色。' : '已退出点选取色。');
}

function handlePreviewPointerDown(event) {
  if (!state.pickerActive || !state.asset) return;

  event.preventDefault();

  const point = mapClientPointToCanvasPoint(
    event,
    elements.preview.getBoundingClientRect(),
    elements.preview,
  );
  const regions = computeRegions(
    elements.preview.width,
    elements.preview.height,
    state.asset.orientation,
    state.palettePosition,
  );

  if (!isPointInRegion(point, regions.media)) {
    setStatus('请点选预览图中的照片区域。', true);
    return;
  }

  const pixel = previewContext.getImageData(point.x, point.y, 1, 1).data;
  const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);

  state.pickerActive = false;
  applyColor(hex, false);
  drawPreview();
  setStatus(`已手动取色 ${hex}。`);
}

function updateTextState(value) {
  state.contentText = value;
  drawPreview();
}

function handleFontSelect(event) {
  const selected = fonts.find((font) => font.id === event.target.value) || fonts[0];
  state.fontId = selected.id;
  state.fontFamily = selected.family;
  drawPreview();
  redrawAfterFontsLoad();
}

async function handleGenerate() {
  if (!state.asset) {
    setStatus('先上传一张静态图片。', true);
    return;
  }

  elements.generate.disabled = true;
  setStatus('正在生成静态图片...');

  try {
    await document.fonts?.ready;
    renderPoster(canvas, state.asset, state);
    const blob = await canvasToBlob(canvas, 'image/png', 0.95);
    clearResultImage();
    state.resultUrl = URL.createObjectURL(blob);
    elements.resultImage.src = state.resultUrl;
    elements.resultPanel.hidden = false;
    setStatus('已生成静态图片，长按下方成图即可保存到相册。');
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    elements.generate.disabled = false;
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
  renderPalettePositionControls();
  renderColorPickerControls();
  elements.swatches.replaceChildren();

  const swatches = state.candidates.length > 0
    ? state.candidates
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
      applyColor(candidate.hex, false);
      drawPreview();
    });
    elements.swatches.append(button);
  });
}

function renderColorPickerControls() {
  const hasAsset = Boolean(state.asset);

  elements.preview.dataset.picking = state.pickerActive ? 'true' : 'false';
  elements.autoColorButton.disabled = !hasAsset || state.colorHex === state.autoColorHex;
  elements.pickColorButton.disabled = !hasAsset;
  elements.pickColorButton.textContent = state.pickerActive ? '取消取色' : '点选取色';
  elements.pickColorButton.dataset.active = state.pickerActive ? 'true' : 'false';
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
      drawPreview();
    });
    elements.palettePosition.append(button);
  });
}

function drawPreview() {
  if (!state.asset) {
    drawPlaceholder();
    return;
  }

  renderPoster(canvas, state.asset, state);
  elements.preview.width = canvas.width / 2;
  elements.preview.height = canvas.height / 2;
  previewContext.clearRect(0, 0, elements.preview.width, elements.preview.height);
  previewContext.drawImage(canvas, 0, 0, elements.preview.width, elements.preview.height);
}

function drawPlaceholder() {
  const context = previewContext;
  const gradient = context.createLinearGradient(0, 0, elements.preview.width, elements.preview.height);
  gradient.addColorStop(0, '#ff6b9a');
  gradient.addColorStop(0.44, '#ffd166');
  gradient.addColorStop(1, '#36c9a3');
  context.fillStyle = gradient;
  context.fillRect(0, 0, elements.preview.width, elements.preview.height);
  context.fillStyle = 'rgba(255,255,255,0.86)';
  context.font = '28px Georgia, serif';
  context.textAlign = 'center';
  context.fillText('Colorwalk', elements.preview.width / 2, elements.preview.height * 0.42);
  context.font = '15px Arial, sans-serif';
  context.fillText('Upload a color moment', elements.preview.width / 2, elements.preview.height * 0.48);
}

function clearResultImage() {
  if (state.resultUrl) {
    URL.revokeObjectURL(state.resultUrl);
  }
  state.resultUrl = '';
  elements.resultImage.removeAttribute('src');
  elements.resultPanel.hidden = true;
}

function redrawAfterFontsLoad() {
  if (!document.fonts) return;

  document.fonts.ready.then(() => {
    drawPreview();
  });
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
