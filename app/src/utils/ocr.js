// Shared OCR engine. One Tesseract worker is created lazily and reused for every
// file / page (jobs are serialized through a queue). All assets (worker, wasm core,
// eng + chi_sim traineddata) are served locally from /ocr (see scripts/copy-ocr-assets.mjs),
// so no CDN (jsdelivr/unpkg) is contacted at runtime.
import Tesseract from 'tesseract.js';

export const OCR_LANGS = 'eng+chi_sim';

const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
const ocrBase = `${baseUrl.replace(/\/?$/, '/')}ocr`;

let config = {
  workerPath: `${ocrBase}/worker.min.js`,
  corePath: `${ocrBase}/core`,
  langPath: `${ocrBase}/lang`,
  gzip: true,
};

/** Override asset locations (used by the node test harness). Resets any existing worker. */
export async function configureOcr(overrides = {}) {
  config = { ...config, ...overrides };
  await terminateOcr();
}

let workerPromise = null;
let queue = Promise.resolve();

export function getOcrWorker() {
  if (!workerPromise) {
    // undefined entries are dropped so tesseract.js keeps its own defaults (node harness)
    const options = Object.fromEntries(Object.entries({ ...config, cacheMethod: 'none' }).filter(([, v]) => v !== undefined));
    workerPromise = Tesseract.createWorker(OCR_LANGS, 1, options).catch((err) => {
      workerPromise = null; // allow a later retry
      throw new Error(`OCR engine failed to start: ${err?.message || err}`);
    });
  }
  return workerPromise;
}

export async function terminateOcr() {
  const p = workerPromise;
  workerPromise = null;
  if (p) {
    try { (await p).terminate(); } catch { /* ignore */ }
  }
}

// chi_sim output puts a space between every CJK character; remove those inter-character gaps.
const CJK = '\\u3400-\\u4dbf\\u4e00-\\u9fff\\u3000-\\u303f\\uff00-\\uffef';
const CJK_GAP = new RegExp(`([${CJK}])[ \\t]+(?=[${CJK}])`, 'g');
export const tidyCjkSpacing = (text) => text.replace(CJK_GAP, '$1');

/** OCR an image source (canvas, Blob/File, Uint8Array/Buffer, URL). Returns plain text. */
export function ocrImage(source) {
  const job = queue.then(async () => {
    const worker = await getOcrWorker();
    const { data } = await worker.recognize(source);
    return tidyCjkSpacing((data.text || '').trim());
  });
  queue = job.catch(() => {}); // keep the queue alive after a failure
  return job;
}

const normalizeLine = (s) => s.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');

/**
 * Merge OCR text into already-extracted text. OCR lines whose content already occurs in
 * `base` (e.g. the PDF text layer) are dropped; the remaining lines are appended.
 */
export function mergeOcrText(base, ocr) {
  const baseText = (base || '').trim();
  const ocrText = (ocr || '').trim();
  if (!ocrText) return baseText;
  if (!baseText) return ocrText;
  const haystack = normalizeLine(baseText);
  const extra = ocrText.split(/\r?\n/).filter((line) => {
    const n = normalizeLine(line);
    return n.length >= 3 && !haystack.includes(n);
  });
  return extra.length ? `${baseText}\n${extra.join('\n')}` : baseText;
}
