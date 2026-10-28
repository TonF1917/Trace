// Node tests for multi-file import: metadata/date/headline derivation, duplicate detection and
// the sequential batch orchestrator (parse / addArticle / analyze are injected stubs).
// Run: node tests/batch-import.test.mjs
import assert from 'node:assert/strict';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  parsePdfDate, isoDateFromTimestamp, sanePdfTitle, deriveMeta, deriveHeadline, deriveSourceName,
  stripExtension, findContentDuplicate, buildArticle, planArticlesFromRecords,
  createBatchItems, runBatch, resetFailed, summarizeBatch, STATUS,
} from '../src/utils/batchImport.js';

let failures = 0;
const check = async (label, fn) => {
  try { await fn(); console.log('PASS', label); } catch (e) { failures++; console.log('FAIL', label, '\n  ', e.stack || e.message); }
};

// ---- metadata -----------------------------------------------------------------------
await check('parsePdfDate handles D: strings, timezones and bad input', () => {
  assert.equal(parsePdfDate("D:20240305101500+08'00'"), '2024-03-05');
  assert.equal(parsePdfDate('D:20231231235959Z'), '2023-12-31');
  assert.equal(parsePdfDate('D:202402'), '2024-02-01');
  assert.equal(parsePdfDate('20200615'), '2020-06-15');
  assert.equal(parsePdfDate('D:20240230'), null); // Feb 30
  assert.equal(parsePdfDate('D:20241301'), null); // month 13
  assert.equal(parsePdfDate('D:18000101'), null);
  assert.equal(parsePdfDate(''), null);
  assert.equal(parsePdfDate(undefined), null);
  assert.equal(parsePdfDate('garbage'), null);
});

await check('isoDateFromTimestamp uses the local calendar date', () => {
  assert.equal(isoDateFromTimestamp(new Date(2024, 2, 5, 12, 0, 0).getTime()), '2024-03-05');
  assert.equal(isoDateFromTimestamp(0), null);
  assert.equal(isoDateFromTimestamp(NaN), null);
  assert.equal(isoDateFromTimestamp(undefined), null);
});

await check('sanePdfTitle rejects empty / untitled / overlong titles', () => {
  assert.equal(sanePdfTitle('  Annual Report 2023 '), 'Annual Report 2023');
  assert.equal(sanePdfTitle(''), '');
  assert.equal(sanePdfTitle(undefined), '');
  assert.equal(sanePdfTitle('Untitled'), '');
  assert.equal(sanePdfTitle('untitled document'), '');
  assert.equal(sanePdfTitle('x'.repeat(200)), '');
  assert.equal(sanePdfTitle('x'.repeat(199)).length, 199);
});

await check('deriveMeta: PDF metadata wins, ModDate and lastModified are fallbacks', () => {
  const lm = new Date(2022, 6, 9, 8, 0, 0).getTime();
  const full = deriveMeta({ lastModified: lm, pdfInfo: { Title: 'Report', Author: 'Jane Doe', CreationDate: 'D:20240305101500Z', ModDate: 'D:20250101000000Z' }, pages: 3, ocrPages: 1 });
  assert.deepEqual(full, { title: 'Report', author: 'Jane Doe', date: '2024-03-05', pages: 3, ocrPages: 1 });
  assert.equal(deriveMeta({ lastModified: lm, pdfInfo: { ModDate: 'D:20250101000000Z' } }).date, '2025-01-01');
  assert.equal(deriveMeta({ lastModified: lm, pdfInfo: { CreationDate: 'bad' } }).date, '2022-07-09');
  const plain = deriveMeta({ lastModified: lm });
  assert.deepEqual(plain, { title: '', author: '', date: '2022-07-09', pages: null, ocrPages: 0 });
});

await check('headline / source_name derivation (Author > Title > filename)', () => {
  assert.equal(stripExtension('My.Report.final.pdf'), 'My.Report.final');
  assert.equal(stripExtension('.hidden'), '.hidden');
  assert.equal(stripExtension('noext'), 'noext');
  const m = (title, author) => deriveMeta({ lastModified: 1e12, pdfInfo: { Title: title, Author: author } });
  assert.equal(deriveHeadline(m('Great Title', 'Jane'), 'a.pdf'), 'Great Title');
  assert.equal(deriveSourceName(m('Great Title', 'Jane'), 'a.pdf'), 'Jane');
  assert.equal(deriveSourceName(m('Great Title', ''), 'a.pdf'), 'Great Title');
  assert.equal(deriveHeadline(m('Untitled', ''), 'scan_01.pdf'), 'scan_01');
  assert.equal(deriveSourceName(m('Untitled', ''), 'scan_01.pdf'), 'scan_01');
  assert.equal(deriveHeadline(m('', ''), 'notes.txt'), 'notes');
});

await check('metadata extracted by the real pdfjs getMetadata flows through deriveMeta', async () => {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>',
    "<< /Title (Parsed Title) /Author (Some Author) /CreationDate (D:20230704120000+02'00') >>",
  ];
  let body = '%PDF-1.4\n';
  const offs = [];
  objs.forEach((o, i) => { offs.push(body.length); body += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = body.length;
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 4 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(Buffer.from(body, 'latin1')) }).promise;
  const info = (await pdf.getMetadata()).info;
  const meta = deriveMeta({ lastModified: 1e12, pdfInfo: info, pages: pdf.numPages });
  assert.equal(meta.title, 'Parsed Title');
  assert.equal(meta.author, 'Some Author');
  assert.equal(meta.date, '2023-07-04');
  await pdf.destroy?.();
});

// ---- article building + duplicates -----------------------------------------------------
const rec = (fileName, text, extra = {}) => ({
  fileName, size: text.length, text, error: null,
  meta: deriveMeta({ lastModified: new Date(2024, 0, 15, 12).getTime(), ...extra }),
});

await check('buildArticle has the store shape of handleAddArticle/handleResearchTopic', () => {
  const a = buildArticle(rec('Doc One.txt', 'hello world'), { projectId: 'p1', id: 'id-1' });
  assert.deepEqual(a, {
    id: 'id-1', projectId: 'p1', source_name: 'Doc One', source_id: 'doc-one', headline: 'Doc One',
    lede: 'hello world', date: '2024-01-15', url: '', frames: [],
    actors: { main_actor: 'Pending', blame_target: 'Pending' }, tone: 'Neutral', keywords: [],
  });
});

await check('findContentDuplicate: same headline + first 200 chars; analyzed articles match on text', () => {
  const body = 'Lorem ipsum '.repeat(40);
  const r = rec('A.txt', body);
  const existing = [{ id: 'x', headline: 'A', lede: body + ' different tail past 200 chars' }];
  assert.ok(findContentDuplicate(r, existing));
  // different headline, unprocessed -> not a duplicate
  assert.equal(findContentDuplicate(r, [{ headline: 'Other', lede: body }]), null);
  // analysis rewrote the headline to a quote -> still a duplicate
  assert.ok(findContentDuplicate(r, [{ headline: '"quote..."', lede: body, isProcessed: true }]));
  // differs inside the first 200 chars -> not a duplicate
  assert.equal(findContentDuplicate(r, [{ headline: 'A', lede: 'X' + body.slice(1) }]), null);
  // whitespace / case differences are ignored
  assert.ok(findContentDuplicate(rec('A.txt', 'Hello   World'), [{ headline: 'a', lede: 'hello world' }]));
});

await check('planArticlesFromRecords skips duplicate files and duplicate content, ignores errored records', () => {
  let n = 0;
  const records = [
    rec('a.txt', 'alpha text'),
    { ...rec('a.txt', 'alpha text') },                         // same name + size
    rec('copy-of-a.txt', 'alpha text'),                        // different name, same content, different headline
    { fileName: 'bad.pdf', size: 1, text: '', error: 'boom', meta: null },
    rec('b.txt', 'beta text'),
  ];
  const { articles, skipped } = planArticlesFromRecords(records, { projectId: 'p', existingArticles: [], makeId: () => `id${++n}` });
  assert.deepEqual(articles.map((a) => a.headline), ['a', 'copy-of-a', 'b']);
  assert.deepEqual(skipped, [{ fileName: 'a.txt', reason: 'duplicate-file' }]);
});

// ---- batch orchestration -------------------------------------------------------------
const fakeFile = (name, size) => ({ name, size, lastModified: new Date(2024, 0, 15, 12).getTime() });

function makeHarness({ files, parseFail = {}, analyzeFail = {}, existing = [], texts = {}, delay = 3 }) {
  const log = [];
  const store = [...existing];
  const snapshots = [];
  let active = 0, maxActive = 0;
  const sleep = () => new Promise((r) => setTimeout(r, delay));
  const state = { parseFail: { ...parseFail }, analyzeFail: { ...analyzeFail } };
  let idc = 0;
  const deps = {
    projectId: 'proj',
    makeId: () => `a${++idc}`,
    parse: async (file, { onStatus }) => {
      log.push(`parse:${file.name}`);
      onStatus?.('OCR 1/2 (p.1)');
      await sleep();
      if (state.parseFail[file.name]) return { fileName: file.name, size: file.size, text: '', meta: null, error: state.parseFail[file.name] };
      const text = texts[file.name] ?? `unique text of ${file.name}`;
      return rec(file.name, text);
    },
    getExistingArticles: () => store,
    addArticle: (a) => { log.push(`add:${a.headline}`); store.push(a); },
    analyze: async (article, { onRound }) => {
      active++; maxActive = Math.max(maxActive, active);
      log.push(`analyze:start:${article.headline}`);
      onRound?.(1, 2); await sleep(); onRound?.(2, 2);
      await sleep();
      active--;
      log.push(`analyze:end:${article.headline}`);
      if (state.analyzeFail[article.headline]) throw new Error(state.analyzeFail[article.headline]);
      return article.headline === 'warn' ? { warning: '1/2 rounds failed' } : {};
    },
    onChange: (items) => snapshots.push(items),
  };
  return { deps, log, store, snapshots, state, get maxActive() { return maxActive; }, items: createBatchItems(files) };
}

await check('batch: one article per file, analysis strictly sequential, progress callbacks fire', async () => {
  const h = makeHarness({ files: [fakeFile('a.pdf', 10), fakeFile('b.pdf', 20), fakeFile('c.txt', 30)] });
  const out = await runBatch(h.items, h.deps);
  assert.deepEqual(out.map((i) => i.status), ['done', 'done', 'done']);
  assert.equal(h.store.length, 3);
  assert.equal(h.maxActive, 1, 'analyses must never overlap');
  const analyzeEvents = h.log.filter((l) => l.startsWith('analyze'));
  assert.deepEqual(analyzeEvents, [
    'analyze:start:a', 'analyze:end:a', 'analyze:start:b', 'analyze:end:b', 'analyze:start:c', 'analyze:end:c',
  ]);
  // every parse happens before the first analysis (queued state), in file order
  assert.ok(h.log.indexOf('analyze:start:a') > h.log.indexOf('add:c'));
  assert.deepEqual(h.log.filter((l) => l.startsWith('parse')), ['parse:a.pdf', 'parse:b.pdf', 'parse:c.txt']);
  // progress: saw parsing + OCR detail, queued, analyzing with round info, done
  const seen = (pred) => h.snapshots.some((snap) => snap.some(pred));
  assert.ok(seen((i) => i.status === 'parsing' && i.detail === 'OCR 1/2 (p.1)'));
  assert.ok(seen((i) => i.status === 'queued'));
  assert.ok(seen((i) => i.status === 'analyzing' && i.round === 2 && i.rounds === 2));
  // snapshots are immutable copies
  assert.notEqual(h.snapshots[0], h.snapshots[1]);
  assert.equal(summarizeBatch(out).done, 3);
});

await check('batch: a failing file does not stop the rest (parse failure and analyze failure)', async () => {
  const h = makeHarness({
    files: [fakeFile('ok1.txt', 1), fakeFile('badparse.pdf', 2), fakeFile('badllm.txt', 3), fakeFile('ok2.txt', 4)],
    parseFail: { 'badparse.pdf': 'No text could be extracted' },
    analyzeFail: { badllm: 'API Error (500)' },
  });
  const out = await runBatch(h.items, h.deps);
  assert.deepEqual(out.map((i) => i.status), ['done', 'failed', 'failed', 'done']);
  assert.equal(out[1].failedStage, 'parse');
  assert.equal(out[1].error, 'No text could be extracted');
  assert.equal(out[2].failedStage, 'analyze');
  assert.equal(out[2].error, 'API Error (500)');
  assert.equal(h.store.length, 3, 'badparse never created an article; badllm article stays for retry');
  assert.ok(h.log.includes('analyze:end:ok2'));
  assert.deepEqual(summarizeBatch(out), { total: 4, done: 2, failed: 2, skipped: 0, active: 0 });
});

await check('batch: a thrown parser (not just error record) is isolated too', async () => {
  const h = makeHarness({ files: [fakeFile('x.txt', 1), fakeFile('y.txt', 2)] });
  const origParse = h.deps.parse;
  h.deps.parse = async (f, o) => { if (f.name === 'x.txt') throw new Error('parser crashed'); return origParse(f, o); };
  const out = await runBatch(h.items, h.deps);
  assert.deepEqual(out.map((i) => i.status), ['failed', 'done']);
  assert.equal(out[0].error, 'parser crashed');
});

await check('batch: retry-failed re-parses parse failures and only re-analyzes analyze failures', async () => {
  const h = makeHarness({
    files: [fakeFile('ok.txt', 1), fakeFile('badparse.pdf', 2), fakeFile('badllm.txt', 3)],
    parseFail: { 'badparse.pdf': 'ocr crashed' },
    analyzeFail: { badllm: 'timeout' },
  });
  const first = await runBatch(h.items, h.deps);
  assert.deepEqual(first.map((i) => i.status), ['done', 'failed', 'failed']);
  h.log.length = 0;
  h.state.parseFail = {};
  h.state.analyzeFail = {};
  const retryItems = resetFailed(first);
  assert.deepEqual(retryItems.map((i) => i.status), ['done', 'pending', 'queued']);
  const second = await runBatch(retryItems, h.deps);
  assert.deepEqual(second.map((i) => i.status), ['done', 'done', 'done']);
  assert.deepEqual(h.log.filter((l) => l.startsWith('parse')), ['parse:badparse.pdf'], 'ok.txt and badllm.txt are not re-parsed');
  assert.ok(!h.log.includes('analyze:start:ok'), 'finished file is not re-analyzed');
  assert.ok(h.log.includes('analyze:end:badllm') && h.log.includes('analyze:end:badparse'));
  assert.equal(h.store.length, 3, 'no duplicate articles after retry');
  assert.equal(h.store.filter((a) => a.headline === 'badllm').length, 1);
});

await check('batch: duplicates are skipped and reported (same file, same content, existing article)', async () => {
  const body = 'shared content '.repeat(30);
  const h = makeHarness({
    files: [fakeFile('one.txt', 5), fakeFile('one.txt', 5), fakeFile('two.txt', 6), fakeFile('three.txt', 7)],
    texts: { 'one.txt': 'one body', 'two.txt': body, 'three.txt': body },
    existing: [],
  });
  // 'three.txt' has same text as 'two.txt' but a different headline and the first is unprocessed -> not a dup.
  // Make an already-analyzed existing article with that content to force a content duplicate on 'two.txt'.
  h.store.push({ id: 'old', projectId: 'proj', headline: '"rewritten"', lede: body, isProcessed: true });
  const out = await runBatch(h.items, h.deps);
  assert.deepEqual(out.map((i) => [i.status, i.skipReason]), [
    ['done', null], ['skipped', 'duplicate-file'], ['skipped', 'duplicate-content'], ['skipped', 'duplicate-content'],
  ]);
  assert.equal(h.log.filter((l) => l === 'parse:one.txt').length, 1, 'duplicate file is not even parsed');
  assert.equal(h.store.length, 2);
  assert.equal(summarizeBatch(out).skipped, 3);
});

await check('batch: non-fatal analysis warning is kept on the row', async () => {
  const h = makeHarness({ files: [fakeFile('warn.txt', 1)] });
  const out = await runBatch(h.items, h.deps);
  assert.equal(out[0].status, 'done');
  assert.equal(out[0].note, '1/2 rounds failed');
});

await check('batch: a throwing onChange listener cannot break the import', async () => {
  const h = makeHarness({ files: [fakeFile('a.txt', 1), fakeFile('b.txt', 2)] });
  h.deps.onChange = () => { throw new Error('ui exploded'); };
  const out = await runBatch(h.items, h.deps);
  assert.deepEqual(out.map((i) => i.status), ['done', 'done']);
});

if (failures) { console.log(`\n${failures} test(s) FAILED`); process.exit(1); }
console.log('\nAll batch-import tests passed');
