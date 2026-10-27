// Node harness: builds test PDFs in the OS temp dir (outside the repo) and runs the real
// extractPdfText + shared OCR engine (local eng/chi_sim data, no CDN).
// Run: node tests/pdf-ocr.test.mjs   (requires `npm run build` or any run of scripts/copy-ocr-assets.mjs)
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { configureOcr, getOcrWorker, ocrImage, terminateOcr, mergeOcrText } from '../src/utils/ocr.js';
import { extractPdfText } from '../src/utils/pdfExtract.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = mkdtempSync(join(tmpdir(), 'trace-ocr-'));
console.log('temp dir:', dir);

await configureOcr({ workerPath: undefined, corePath: undefined, langPath: join(root, 'public', 'ocr', 'lang'), gzip: true });

function textImage(lines, w = 1000, h = 400, font = 'bold 56px Arial') {
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#000'; ctx.font = font;
  lines.forEach((l, i) => ctx.fillText(l, 40, 90 + i * 90));
  return c;
}

// --- minimal PDF writer: pages = [{w,h,text?,jpeg?,iw?,ih?,imgH?}] ----------
function buildPdf(pages) {
  const objs = [];
  const add = (body) => { objs.push(body); return objs.length; };
  const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageBodies = [];
  for (const p of pages) {
    let xobj = '';
    let content = '';
    if (p.text) content += `BT /F1 18 Tf 50 ${p.h - 80} Td (${p.text}) Tj ET\n`;
    if (p.jpeg) {
      const imgId = add(Buffer.concat([
        Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${p.iw} /Height ${p.ih} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`, 'latin1'),
        p.jpeg, Buffer.from('\nendstream', 'latin1')]));
      xobj = `/XObject << /Im0 ${imgId} 0 R >>`;
      content += `q ${p.w} 0 0 ${p.imgH ?? p.h} 0 0 cm /Im0 Do Q\n`;
    }
    const contentId = add(`<< /Length ${content.length} >>\nstream\n${content}endstream`);
    pageBodies.push({ contentId, xobj, w: p.w, h: p.h });
  }
  const pagesId = objs.length + pages.length + 1;
  const pageIds = pageBodies.map((b) => add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${b.w} ${b.h}] /Contents ${b.contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> ${b.xobj} >> >>`));
  assert.equal(add(`<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((i) => `${i} 0 R`).join(' ')}] >>`), pagesId);
  const catId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  const chunks = [Buffer.from('%PDF-1.4\n', 'latin1')];
  const offsets = [];
  let pos = chunks[0].length;
  objs.forEach((body, i) => {
    offsets.push(pos);
    const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, 'latin1'), Buffer.isBuffer(body) ? body : Buffer.from(body, 'latin1'), Buffer.from('\nendobj\n', 'latin1')]);
    chunks.push(b); pos += b.length;
  });
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => { xref += `${String(o).padStart(10, '0')} 00000 n \n`; });
  xref += `trailer\n<< /Size ${objs.length + 1} /Root ${catId} 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(chunks);
}

const scanPage = (lines, font) => {
  const c = textImage(lines, 1000, 400, font);
  return { w: 595, h: 238, imgH: 238, jpeg: c.toBuffer('image/jpeg'), iw: 1000, ih: 400 };
};

async function run(buf, name, opts = {}) {
  writeFileSync(join(dir, name), buf);
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const statuses = [];
  const text = await extractPdfText(pdf, {
    createCanvas,
    ocr: (canvas) => ocrImage(canvas.toBuffer('image/png')),
    onStatus: (s) => statuses.push(s),
    ...opts,
  });
  return { text, statuses };
}

let failures = 0;
const check = async (label, fn) => {
  try { await fn(); console.log('PASS', label); } catch (e) { failures++; console.log('FAIL', label, '\n  ', e.message); }
};

await check('text-only PDF keeps text layer and runs NO OCR', async () => {
  const { text, statuses } = await run(buildPdf([{ w: 595, h: 842, text: 'Hello text layer document about the Soviet economy in 1921' }]), 'text.pdf');
  console.log('   ->', JSON.stringify(text));
  assert.match(text, /Soviet economy in 1921/);
  assert.equal(statuses.length, 0);
});

await check('scanned (image-only) PDF yields OCR text (eng)', async () => {
  const { text, statuses } = await run(buildPdf([scanPage(['Scanned invoice number', 'Total amount 4521 dollars'])]), 'scan.pdf');
  console.log('   ->', JSON.stringify(text), statuses);
  assert.match(text, /Scanned/i);
  assert.match(text, /4521/);
  assert.equal(statuses.length, 1);
});

await check('scanned PDF with Chinese text yields chi_sim OCR', async () => {
  const { text } = await run(buildPdf([scanPage(['中国经济发展报告', '第二章 改革开放'], 'bold 60px "Microsoft YaHei", SimSun, sans-serif')]), 'scan-zh.pdf');
  console.log('   ->', JSON.stringify(text));
  assert.match(text, /经济/);
});

await check('mixed PDF: text page has image -> OCR adds only image-only lines (dedupe)', async () => {
  const pg = scanPage(['Chart caption unique zebra']);
  pg.text = 'Intro paragraph with a lot of ordinary text content here';
  pg.h = 842;
  const { text, statuses } = await run(buildPdf([pg]), 'mixed.pdf');
  console.log('   ->', JSON.stringify(text), statuses);
  assert.match(text, /Intro paragraph/);
  assert.match(text, /zebra/i);
  assert.equal((text.match(/Intro paragraph/g) || []).length, 1);
});

await check('OCR page cap: 4 scanned pages, cap 2 -> note lists skipped pages', async () => {
  const pages = [1, 2, 3, 4].map((n) => scanPage([`Page marker number ${n}${n}${n}`]));
  const { text, statuses } = await run(buildPdf(pages), 'cap.pdf', { maxOcrPages: 2 });
  console.log('   ->', JSON.stringify(text), statuses);
  assert.equal(statuses.length, 2);
  assert.match(text, /OCR NOTE: 2 page\(s\) needing OCR were skipped .* limit of 2 .* Skipped pages: 3, 4/);
});

await check('shared worker: one worker instance, concurrent jobs are queued', async () => {
  const a = await getOcrWorker(); const b = await getOcrWorker();
  assert.equal(a, b);
  const results = await Promise.all([1, 2, 3].map((n) => ocrImage(textImage([`Concurrent job ${n}${n}${n}`]).toBuffer('image/png'))));
  console.log('   ->', JSON.stringify(results));
  results.forEach((r, i) => assert.match(r, new RegExp(`${i + 1}${i + 1}${i + 1}`)));
});

await check('mergeOcrText dedupes lines already in text layer', async () => {
  assert.equal(mergeOcrText('Hello World foo bar', 'Hello World\nnew line here'), 'Hello World foo bar\nnew line here');
});

await check('TIFF bytes (uncompressed, hand-encoded) are OCR-able by the engine', async () => {
  const w = 800, h = 200;
  const { data } = textImage(['Tiff format sample 7788'], w, h).getContext('2d').getImageData(0, 0, w, h);
  const gray = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) gray[i] = data[i * 4];
  const nEntries = 9;
  const stripOffset = 8 + 2 + 12 * nEntries + 4;
  const entries = [[256, 3, w], [257, 3, h], [258, 3, 8], [259, 3, 1], [262, 3, 1], [273, 4, stripOffset], [277, 3, 1], [278, 3, h], [279, 4, w * h]];
  const ifd = Buffer.alloc(2 + 12 * nEntries + 4);
  ifd.writeUInt16LE(nEntries, 0);
  entries.forEach(([tag, type, val], i) => {
    const o = 2 + i * 12;
    ifd.writeUInt16LE(tag, o); ifd.writeUInt16LE(type, o + 2); ifd.writeUInt32LE(1, o + 4);
    if (type === 3) ifd.writeUInt16LE(val, o + 8); else ifd.writeUInt32LE(val, o + 8);
  });
  const tiff = Buffer.concat([Buffer.from([0x49, 0x49, 0x2a, 0, 8, 0, 0, 0]), ifd, gray]);
  writeFileSync(join(dir, 'sample.tif'), tiff);
  const out = await ocrImage(new Uint8Array(tiff));
  console.log('   ->', JSON.stringify(out));
  assert.match(out, /7788/);
});

await check('GIF bytes are OCR-able by the engine', async () => {
  let gif = null;
  try { gif = textImage(['Gif format sample 9911'], 800, 200).toBuffer('image/gif'); } catch { /* encoder missing */ }
  if (!gif) { console.log('   (canvas cannot encode gif here; skipped)'); return; }
  const out = await ocrImage(new Uint8Array(gif));
  console.log('   ->', JSON.stringify(out));
  assert.match(out, /9911/);
});

await terminateOcr();
rmSync(dir, { recursive: true, force: true });
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
