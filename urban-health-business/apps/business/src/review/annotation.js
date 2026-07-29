const SEVERITY_COLORS = {
  high: '#dc2626',
  medium: '#d97706',
  low: '#16a34a'
};

function clamp(value, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : minimum;
}

export function normalizeBbox(value) {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const bbox = value.map((item) => Number(item));
  if (bbox.some((item) => !Number.isFinite(item))) return null;
  const left = clamp(bbox[0], 0, 998);
  const top = clamp(bbox[1], 0, 998);
  const right = clamp(bbox[2], left + 1, 999);
  const bottom = clamp(bbox[3], top + 1, 999);
  return [left, top, right, bottom];
}

export function bboxPercentStyle(value) {
  const bbox = normalizeBbox(value);
  if (!bbox) return '';
  return [
    `left:${(bbox[0] / 9.99).toFixed(2)}%`,
    `top:${(bbox[1] / 9.99).toFixed(2)}%`,
    `width:${((bbox[2] - bbox[0]) / 9.99).toFixed(2)}%`,
    `height:${((bbox[3] - bbox[1]) / 9.99).toFixed(2)}%`
  ].join(';');
}

export function annotationPlan(candidates, width, height) {
  return (Array.isArray(candidates) ? candidates : []).flatMap((candidate) => {
    const bbox = normalizeBbox(candidate?.bbox);
    if (!bbox) return [];
    const severity = ['high', 'medium', 'low'].includes(candidate?.severity)
      ? candidate.severity
      : 'medium';
    return [{
      candidateId: String(candidate.id || ''),
      x: bbox[0] / 999 * width,
      y: bbox[1] / 999 * height,
      width: (bbox[2] - bbox[0]) / 999 * width,
      height: (bbox[3] - bbox[1]) / 999 * height,
      color: SEVERITY_COLORS[severity],
      label: String(candidate.categoryName || candidate.title || '待复核问题').slice(0, 40)
    }];
  });
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('原始照片加载失败，未生成标注图。'));
    image.src = url;
  });
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('浏览器未能生成标注图片。')),
      type,
      quality
    );
  });
}

export async function createAnnotatedImageFile(photo, candidates, options = {}) {
  if (!photo?.url) throw new Error('原始照片缺少可读取地址，未生成标注图。');
  const image = await loadImage(photo.url);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前浏览器不支持Canvas标注图生成。');
  context.drawImage(image, 0, 0);

  const plan = annotationPlan(candidates, canvas.width, canvas.height);
  const lineWidth = Math.max(3, canvas.width / 400);
  const fontSize = Math.max(18, canvas.width / 45);
  context.lineWidth = lineWidth;
  context.font = `600 ${fontSize}px sans-serif`;
  context.textBaseline = 'top';
  for (const box of plan) {
    context.strokeStyle = box.color;
    context.fillStyle = box.color;
    context.strokeRect(box.x, box.y, box.width, box.height);
    const padding = Math.max(5, fontSize / 4);
    const labelWidth = Math.min(
      context.measureText(box.label).width + padding * 2,
      Math.max(0, canvas.width - box.x)
    );
    const labelHeight = fontSize + padding * 2;
    const labelY = Math.max(0, box.y - labelHeight);
    context.fillRect(box.x, labelY, labelWidth, labelHeight);
    context.fillStyle = '#ffffff';
    context.fillText(box.label, box.x + padding, labelY + padding, Math.max(0, labelWidth - padding * 2));
  }

  const blob = await canvasBlob(canvas, 'image/jpeg', options.quality ?? 0.9);
  const baseName = String(photo.name || photo.id || 'photo').replace(/\.[^.]+$/, '');
  return new File([blob], `${baseName}-annotated.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now()
  });
}
