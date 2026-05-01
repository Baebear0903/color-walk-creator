import { classifyAssetLayout, computeMediaCropRect } from './layout.mjs';

export async function loadAsset(file) {
  if (!file) {
    throw new Error('请选择一张静态图片。');
  }

  if (file.type.startsWith('image/')) {
    const image = await loadImage(URL.createObjectURL(file));
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const layout = classifyAssetLayout(width, height);

    return {
      type: 'image',
      file,
      image,
      width,
      height,
      orientation: layout.orientation,
      normalizedRatio: layout.normalizedRatio,
      cropRect: computeMediaCropRect(width, height, layout.orientation),
      duration: 0,
      objectUrl: image.src,
    };
  }

  throw new Error('当前仅支持上传静态图片。');
}

export function getAssetSource(asset) {
  return asset.image;
}

export async function getSamplePixels(asset, size = 120) {
  const source = getAssetSource(asset);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const width = source.naturalWidth;
  const height = source.naturalHeight;
  const ratio = Math.min(size / width, size / height, 1);

  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  context.drawImage(source, 0, 0, canvas.width, canvas.height);

  return {
    pixels: context.getImageData(0, 0, canvas.width, canvas.height).data,
    width: canvas.width,
    height: canvas.height,
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片读取失败，请换一张图片试试。'));
    image.src = src;
  });
}
