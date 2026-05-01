export function mapClientPointToCanvasPoint(event, rect, canvas) {
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const rawX = Math.floor((event.clientX - rect.left) * scaleX);
  const rawY = Math.floor((event.clientY - rect.top) * scaleY);

  return {
    x: clamp(rawX, 0, canvas.width - 1),
    y: clamp(rawY, 0, canvas.height - 1),
  };
}

export function isPointInRegion(point, region) {
  return point.x >= region.x
    && point.x < region.x + region.width
    && point.y >= region.y
    && point.y < region.y + region.height;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
