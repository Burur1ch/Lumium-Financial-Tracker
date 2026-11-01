type ReceiptOcrWord = {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

type ReceiptOcrBlock = {
  paragraphs: Array<{
    lines: Array<{ words: ReceiptOcrWord[] }>;
  }>;
};

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function loadReceiptImage(file: File) {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      source: bitmap as CanvasImageSource,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  await image.decode();
  return {
    source: image as CanvasImageSource,
    width: image.naturalWidth,
    height: image.naturalHeight,
    close: () => URL.revokeObjectURL(url),
  };
}

function percentile(histogram: Uint32Array, total: number, ratio: number) {
  const target = total * ratio;
  let current = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    current += histogram[value];
    if (current >= target) return value;
  }
  return 255;
}

function otsuThreshold(histogram: Uint32Array, total: number) {
  let weightedTotal = 0;
  for (let value = 0; value < 256; value += 1) {
    weightedTotal += value * histogram[value];
  }

  let backgroundWeight = 0;
  let backgroundSum = 0;
  let bestVariance = -1;
  let threshold = 170;
  for (let value = 0; value < 256; value += 1) {
    backgroundWeight += histogram[value];
    if (backgroundWeight === 0) continue;
    const foregroundWeight = total - backgroundWeight;
    if (foregroundWeight === 0) break;
    backgroundSum += value * histogram[value];
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (weightedTotal - backgroundSum) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      threshold = value;
    }
  }
  return threshold;
}

export async function prepareReceiptImages(file: File) {
  const imageSource = await loadReceiptImage(file);
  const upscale = imageSource.width < 1200 ? Math.min(2.2, 1200 / imageSource.width) : 1;
  const fit = Math.min(1800 / (imageSource.width * upscale), 3400 / (imageSource.height * upscale), 1);
  const scale = upscale * fit;
  const width = Math.max(1, Math.round(imageSource.width * scale));
  const height = Math.max(1, Math.round(imageSource.height * scale));
  const source = createCanvas(width, height);
  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) throw new Error("CANVAS_UNAVAILABLE");
  sourceContext.fillStyle = "#fff";
  sourceContext.fillRect(0, 0, width, height);
  sourceContext.drawImage(imageSource.source, 0, 0, width, height);
  imageSource.close();

  const image = sourceContext.getImageData(0, 0, width, height);
  const histogram = new Uint32Array(256);
  const gray = new Uint8Array(width * height);
  for (let pixel = 0, offset = 0; pixel < gray.length; pixel += 1, offset += 4) {
    const value = Math.round(
      image.data[offset] * 0.299 +
      image.data[offset + 1] * 0.587 +
      image.data[offset + 2] * 0.114,
    );
    gray[pixel] = value;
    histogram[value] += 1;
  }

  const low = percentile(histogram, gray.length, 0.02);
  const high = Math.max(low + 32, percentile(histogram, gray.length, 0.98));
  const enhancedHistogram = new Uint32Array(256);
  const enhanced = createCanvas(width, height);
  const enhancedContext = enhanced.getContext("2d");
  if (!enhancedContext) throw new Error("CANVAS_UNAVAILABLE");
  const enhancedImage = enhancedContext.createImageData(width, height);
  for (let pixel = 0, offset = 0; pixel < gray.length; pixel += 1, offset += 4) {
    const normalized = Math.max(0, Math.min(255, ((gray[pixel] - low) * 255) / (high - low)));
    const value = Math.max(0, Math.min(255, Math.round((normalized - 128) * 1.18 + 138)));
    enhancedHistogram[value] += 1;
    enhancedImage.data[offset] = value;
    enhancedImage.data[offset + 1] = value;
    enhancedImage.data[offset + 2] = value;
    enhancedImage.data[offset + 3] = 255;
    gray[pixel] = value;
  }
  enhancedContext.putImageData(enhancedImage, 0, 0);

  const threshold = Math.max(110, Math.min(220, otsuThreshold(enhancedHistogram, gray.length)));
  const binary = createCanvas(width, height);
  const binaryContext = binary.getContext("2d");
  if (!binaryContext) throw new Error("CANVAS_UNAVAILABLE");
  const binaryImage = binaryContext.createImageData(width, height);
  for (let pixel = 0, offset = 0; pixel < gray.length; pixel += 1, offset += 4) {
    const value = gray[pixel] <= threshold ? 0 : 255;
    binaryImage.data[offset] = value;
    binaryImage.data[offset + 1] = value;
    binaryImage.data[offset + 2] = value;
    binaryImage.data[offset + 3] = 255;
  }
  binaryContext.putImageData(binaryImage, 0, 0);

  return { enhanced, binary };
}

export function reconstructReceiptText(
  blocks: ReceiptOcrBlock[] | null | undefined,
  fallbackText: string,
) {
  const words = (blocks ?? [])
    .flatMap((block) => block.paragraphs)
    .flatMap((paragraph) => paragraph.lines)
    .flatMap((line) => line.words)
    .filter((word) => word.text.trim() && word.confidence >= 20)
    .sort((left, right) => {
      const leftCenter = (left.bbox.y0 + left.bbox.y1) / 2;
      const rightCenter = (right.bbox.y0 + right.bbox.y1) / 2;
      return leftCenter - rightCenter || left.bbox.x0 - right.bbox.x0;
    });
  if (words.length === 0) return fallbackText;

  const rows: Array<{ center: number; height: number; words: ReceiptOcrWord[] }> = [];
  for (const word of words) {
    const center = (word.bbox.y0 + word.bbox.y1) / 2;
    const height = Math.max(1, word.bbox.y1 - word.bbox.y0);
    const row = [...rows].reverse().find((candidate) =>
      Math.abs(candidate.center - center) <= Math.max(8, Math.min(candidate.height, height) * 0.62),
    );
    if (row) {
      row.words.push(word);
      row.center = (row.center * (row.words.length - 1) + center) / row.words.length;
      row.height = Math.max(row.height, height);
    } else {
      rows.push({ center, height, words: [word] });
    }
  }

  return rows
    .sort((left, right) => left.center - right.center)
    .map((row) => row.words
      .sort((left, right) => left.bbox.x0 - right.bbox.x0)
      .map((word) => word.text.trim())
      .join(" "))
    .join("\n");
}
