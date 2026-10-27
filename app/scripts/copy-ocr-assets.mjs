// Copies Tesseract worker, wasm core and language data from node_modules into
// public/ocr so the OCR pipeline never needs a CDN (offline / China network).
import { cpSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules');
const out = join(root, 'public', 'ocr');
mkdirSync(join(out, 'core'), { recursive: true });
mkdirSync(join(out, 'lang'), { recursive: true });

const copy = (from, to) => {
  if (!existsSync(from)) throw new Error(`OCR asset missing: ${from} (run npm install)`);
  cpSync(from, to);
};

copy(join(nm, 'tesseract.js', 'dist', 'worker.min.js'), join(out, 'worker.min.js'));
// tesseract.js picks the core variant at runtime (relaxedsimd > simd > plain); keep all LSTM-only variants.
for (const f of readdirSync(join(nm, 'tesseract.js-core'))) {
  if (/^tesseract-core.*lstm\.wasm\.js$/.test(f)) copy(join(nm, 'tesseract.js-core', f), join(out, 'core', f));
}
for (const lang of ['eng', 'chi_sim']) {
  copy(join(nm, '@tesseract.js-data', lang, '4.0.0_best_int', `${lang}.traineddata.gz`), join(out, 'lang', `${lang}.traineddata.gz`));
}
console.log('[ocr-assets] copied to public/ocr');
