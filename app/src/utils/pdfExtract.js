// PDF text extraction with OCR fallback. Environment-agnostic: the caller supplies a
// canvas factory and an OCR function so this runs in the browser and in node tests.
import { OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { mergeOcrText } from './ocr.js';

export const PDF_OCR_MAX_PAGES = 50;
export const PDF_MIN_TEXT_CHARS = 20;
const OCR_SCALE = 2;
const MAX_CANVAS_SIDE = 4096;

const IMAGE_OPS = new Set([
  OPS.paintImageXObject,
  OPS.paintInlineImageXObject,
  OPS.paintImageMaskXObject,
  OPS.paintJpegXObject,
  OPS.paintImageXObjectRepeat,
  OPS.paintImageMaskXObjectRepeat,
  OPS.paintSolidColorImageMask,
].filter((v) => v !== undefined));

function textLayerToString(items) {
  let out = '';
  for (const item of items) {
    if (typeof item.str !== 'string') continue;
    out += item.str;
    out += item.hasEOL ? '\n' : ' ';
  }
  return out.replace(/[ \t]+\n/g, '\n').trim();
}

async function pageHasImages(page) {
  try {
    const ops = await page.getOperatorList();
    return ops.fnArray.some((fn) => IMAGE_OPS.has(fn));
  } catch {
    return false;
  }
}

async function ocrPage(page, { createCanvas, ocr }) {
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(OCR_SCALE, MAX_CANVAS_SIDE / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // intent 'print' avoids requestAnimationFrame, so rendering also progresses in background tabs
  await page.render({ canvasContext: ctx, canvas, viewport, intent: 'print' }).promise;
  try {
    return await ocr(canvas);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

/**
 * @param pdf       pdfjs PDFDocumentProxy
 * @param opts.createCanvas (w,h) => canvas
 * @param opts.ocr          (canvas) => Promise<string>
 * @param opts.onStatus     optional (message) => void
 * @param opts.maxOcrPages  default 50
 */
export async function extractPdfText(pdf, { createCanvas, ocr, onStatus, maxOcrPages = PDF_OCR_MAX_PAGES }) {
  const n = pdf.numPages;
  const pages = [];

  // Pass 1: text layer + image detection (cheap).
  for (let i = 1; i <= n; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = textLayerToString(content.items);
    const short = text.length < PDF_MIN_TEXT_CHARS;
    const hasImages = short ? false : await pageHasImages(page);
    pages.push({ page, text, short, hasImages, ocrText: '', ocrFailed: null });
  }

  // Pass 2: choose OCR pages. Pages without a usable text layer take priority over
  // text pages that merely contain images; the per-file cap applies to both.
  const needing = pages.map((p, idx) => ({ p, idx })).filter(({ p }) => p.short || p.hasImages);
  const ordered = [...needing.filter(({ p }) => p.short), ...needing.filter(({ p }) => !p.short)];
  const selected = ordered.slice(0, maxOcrPages);
  const skipped = ordered.slice(maxOcrPages).map(({ idx }) => idx + 1).sort((a, b) => a - b);
  const selectedSet = new Set(selected.map(({ idx }) => idx));

  let done = 0;
  for (let idx = 0; idx < pages.length; idx++) {
    if (!selectedSet.has(idx)) continue;
    const p = pages[idx];
    onStatus?.(`OCR ${++done}/${selected.length} (p.${idx + 1})`);
    try {
      p.ocrText = await ocrPage(p.page, { createCanvas, ocr });
    } catch (err) {
      p.ocrFailed = err?.message || String(err);
    }
  }

  const failed = pages.map((p, i) => (p.ocrFailed ? i + 1 : 0)).filter(Boolean);
  const out = pages.map((p) => {
    p.page.cleanup?.();
    return mergeOcrText(p.text, p.ocrText);
  });

  let result = out.join('\n\n').trim();
  const notes = [];
  if (skipped.length) {
    notes.push(`[OCR NOTE: ${skipped.length} page(s) needing OCR were skipped because the per-file limit of ${maxOcrPages} OCR pages was reached. Skipped pages: ${skipped.join(', ')}]`);
  }
  if (failed.length) {
    notes.push(`[OCR NOTE: OCR failed on page(s): ${failed.join(', ')}]`);
  }
  if (notes.length) result += `\n\n${notes.join('\n')}`;
  return result;
}
