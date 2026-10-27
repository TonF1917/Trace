import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs?worker';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { ocrImage, mergeOcrText } from './ocr';
import { extractPdfText } from './pdfExtract';

// Use Vite's native worker support to avoid CORS issues with CDNs
pdfjsLib.GlobalWorkerOptions.workerPort = new pdfjsWorker();

const plainTextExtensions = [
  'txt', 'md', 'markdown', 'csv', 'json', 'xml', 'log', 'yaml', 'yml',
  'ini', 'cfg', 'conf', 'rtf', 'tsv', 'js', 'ts', 'py', 'java', 'c',
  'cpp', 'cs', 'go', 'rs', 'sql'
];
const rasterImageExtensions = ['png', 'jpg', 'jpeg', 'bmp', 'webp'];
const legacyBinaryDocExtensions = ['doc', 'dot', 'wps'];

const SVG_MAX_SIDE = 3000;
const SVG_MIN_SIDE = 1600;

const createDomCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

const readText = (file, label) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => resolve(e.target.result);
  reader.onerror = () => reject(new Error(`Failed to read ${label} file.`));
  reader.readAsText(file);
});

const withOcrContext = async (fn) => {
  try {
    return await fn();
  } catch (err) {
    throw new Error(`OCR extraction failed: ${err?.message || err}`, { cause: err });
  }
};

async function parseSvg(file) {
  const svgText = await readText(file, 'SVG');
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  // Text nodes embedded in the SVG are exact; OCR covers outlined / raster content.
  const embedded = Array.from(doc.querySelectorAll('text'))
    .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');

  const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('SVG could not be rasterized.'));
      img.src = url;
    });
    let w = img.naturalWidth || 1200;
    let h = img.naturalHeight || 900;
    const scale = Math.min(SVG_MAX_SIDE / Math.max(w, h), Math.max(1, SVG_MIN_SIDE / Math.max(w, h)));
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
    const canvas = createDomCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const ocr = await withOcrContext(() => ocrImage(canvas));
    return mergeOcrText(embedded, ocr);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function parseGif(file) {
  // Browser decodes the first frame; raw bytes are the fallback (leptonica reads GIF too).
  let source = null;
  try {
    const bmp = await createImageBitmap(file);
    const canvas = createDomCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, bmp.width, bmp.height);
    ctx.drawImage(bmp, 0, 0);
    bmp.close?.();
    source = canvas;
  } catch {
    source = new Uint8Array(await file.arrayBuffer());
  }
  return withOcrContext(() => ocrImage(source));
}

async function parseTiff(file) {
  // Browsers cannot decode TIFF; Tesseract's leptonica can, so hand it the bytes.
  const bytes = new Uint8Array(await file.arrayBuffer());
  return withOcrContext(() => ocrImage(bytes));
}

// Magic-number sniffing so unknown binary formats are rejected rather than garbage-decoded.
const SIGNATURES = [
  ['PNG image', [0x89, 0x50, 0x4e, 0x47]],
  ['JPEG image', [0xff, 0xd8, 0xff]],
  ['GIF image', [0x47, 0x49, 0x46, 0x38]],
  ['TIFF image', [0x49, 0x49, 0x2a, 0x00]],
  ['TIFF image', [0x4d, 0x4d, 0x00, 0x2a]],
  ['BMP image', [0x42, 0x4d]],
  ['PDF document', [0x25, 0x50, 0x44, 0x46]],
  ['ZIP archive', [0x50, 0x4b, 0x03, 0x04]],
  ['RAR archive', [0x52, 0x61, 0x72, 0x21]],
  ['7-Zip archive', [0x37, 0x7a, 0xbc, 0xaf]],
  ['gzip archive', [0x1f, 0x8b]],
  ['Windows executable', [0x4d, 0x5a]],
  ['ELF executable', [0x7f, 0x45, 0x4c, 0x46]],
  ['Mach-O executable', [0xcf, 0xfa, 0xed, 0xfe]],
  ['OLE2 binary (Office)', [0xd0, 0xcf, 0x11, 0xe0]],
  ['RIFF container (WebP/AVI/WAV)', [0x52, 0x49, 0x46, 0x46]],
];

export function sniffBinary(bytes) {
  for (const [name, sig] of SIGNATURES) {
    if (sig.every((b, i) => bytes[i] === b)) return name;
  }
  return null;
}

function unsupportedError(file, extension, kind) {
  const what = kind ? `${kind} content` : 'binary content';
  return new Error(`Unsupported file type ".${extension}" (${file.name}): detected ${what}. Supported: TXT/MD/CSV/JSON etc., HTML, DOCX, DOC, XLSX/XLS, PDF (with OCR), EPUB, and images (PNG, JPG, BMP, WEBP, GIF, TIFF, SVG).`);
}

async function parseLegacyBinaryDoc(file) {
  const arrayBuffer = await file.arrayBuffer();
  // Old binary files like .doc store text in either UTF-16LE or ANSI (e.g., GB18030 for Chinese)
  const text16 = new TextDecoder('utf-16le').decode(arrayBuffer);
  const text8 = new TextDecoder('gb18030').decode(arrayBuffer);

  // eslint-disable-next-line no-control-regex
  const cleanRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFFFD]/g;
  const clean16 = text16.replace(cleanRegex, ' ').replace(/\s{2,}/g, ' ').trim();
  const clean8 = text8.replace(cleanRegex, ' ').replace(/\s{2,}/g, ' ').trim();

  const countValid = (str) => {
    const match = str.match(/[\u4e00-\u9fa5a-zA-Z0-9]/g);
    return match ? match.length : 0;
  };
  return countValid(clean16) > countValid(clean8) ? clean16 : clean8;
}

async function parseUnknown(file, extension) {
  const head = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
  const sniffed = sniffBinary(head);
  if (sniffed) throw unsupportedError(file, extension, sniffed);
  if (head.includes(0)) {
    // NUL bytes: only a UTF-16 text file is acceptable, anything else is binary.
    const bom16 = (head[0] === 0xff && head[1] === 0xfe) || (head[0] === 0xfe && head[1] === 0xff);
    if (!bom16) throw unsupportedError(file, extension);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    const text = new TextDecoder('gb18030').decode(bytes);
    const replacement = (text.match(/\uFFFD/g) || []).length;
    // eslint-disable-next-line no-control-regex
    const control = (text.match(/[\x00-\x08\x0E-\x1F]/g) || []).length;
    if (replacement + control > text.length * 0.02) throw unsupportedError(file, extension);
    return text;
  }
}

/**
 * Parse a File into plain text. No length limit is applied here: long text is handled by
 * the chunked multi-round processing in LLMService.
 * @param file File
 * @param opts.onStatus optional (message) => void for sub-step progress (e.g. OCR pages)
 */
export async function parseFile(file, opts = {}) {
  const extension = (file.name.split('.').pop() || '').toLowerCase();

  if (plainTextExtensions.includes(extension)) {
    return readText(file, 'text');
  }

  if (['html', 'htm'].includes(extension)) {
    const html = await readText(file, 'HTML');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || doc.body.innerText || '';
  }

  if (['xlsx', 'xls'].includes(extension)) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    let fullText = '';
    workbook.SheetNames.forEach((sheetName) => {
      const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
      fullText += `--- Sheet: ${sheetName} ---\n${csv}\n`;
    });
    return fullText;
  }

  if (extension === 'pdf') {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    try {
      return await extractPdfText(pdf, {
        createCanvas: createDomCanvas,
        ocr: (canvas) => withOcrContext(() => ocrImage(canvas)),
        onStatus: opts.onStatus,
      });
    } finally {
      pdf.destroy?.();
    }
  }

  if (extension === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  if (rasterImageExtensions.includes(extension)) {
    opts.onStatus?.('OCR');
    return withOcrContext(() => ocrImage(file));
  }
  if (extension === 'gif') { opts.onStatus?.('OCR'); return parseGif(file); }
  if (['tif', 'tiff'].includes(extension)) { opts.onStatus?.('OCR'); return parseTiff(file); }
  if (extension === 'svg') { opts.onStatus?.('OCR'); return parseSvg(file); }

  if (extension === 'epub') {
    try {
      const loadedZip = await new JSZip().loadAsync(file);
      let fullText = '';
      const htmlFiles = Object.values(loadedZip.files).filter((f) => !f.dir && /\.(html|htm|xhtml)$/i.test(f.name));
      // Sort files by name to approximate chapter order (e.g. 01.xhtml, 02.xhtml)
      htmlFiles.sort((a, b) => a.name.localeCompare(b.name));
      const parser = new DOMParser();
      for (const f of htmlFiles) {
        const content = await f.async('string');
        const doc = parser.parseFromString(content, 'text/html');
        fullText += (doc.body?.textContent || doc.body?.innerText || '') + '\n\n';
      }
      return fullText;
    } catch {
      throw new Error('Failed to parse EPUB file.');
    }
  }

  if (legacyBinaryDocExtensions.includes(extension)) {
    const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    const sniffed = sniffBinary(head);
    // Legacy .doc is an OLE2 container; anything else that is clearly binary is rejected.
    if (sniffed && sniffed !== 'OLE2 binary (Office)') throw unsupportedError(file, extension, sniffed);
    return parseLegacyBinaryDoc(file);
  }

  return parseUnknown(file, extension);
}

/**
 * Parse several files, collecting per-file errors instead of failing the batch.
 * Each file's text is prefixed with a `=== <filename> ===` header for provenance.
 * @returns {{ text: string, parsed: {name, text}[], errors: {name, message}[] }}
 */
export async function parseFilesBatch(files, { onProgress } = {}) {
  const parsed = [];
  const errors = [];
  const total = files.length;
  for (let i = 0; i < total; i++) {
    const file = files[i];
    const base = `${i + 1}/${total} ${file.name}`;
    onProgress?.(base);
    try {
      const raw = await parseFile(file, { onStatus: (s) => onProgress?.(`${base} · ${s}`) });
      const body = (raw || '').trim();
      if (!body) throw new Error('No text could be extracted from this file.');
      parsed.push({ name: file.name, text: `=== ${file.name} ===\n${body}` });
    } catch (err) {
      errors.push({ name: file.name, message: err?.message || String(err) });
    }
  }
  return { text: parsed.map((p) => p.text).join('\n\n'), parsed, errors };
}
