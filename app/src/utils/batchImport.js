// Pure (DOM-free, worker-free) helpers for multi-file import: metadata derivation,
// duplicate detection, article construction and the sequential batch orchestrator.
// Parsing, store access and LLM analysis are injected so everything here is node-testable.

export const MAX_HEADLINE_LEN = 200;
const DEDUPE_PREFIX = 200;

const pad = (n) => String(n).padStart(2, '0');
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f]/g;
const cleanStr = (v) => (typeof v === 'string' ? v.replace(CONTROL_RE, ' ').replace(/\s+/g, ' ').trim() : '');

export function stripExtension(fileName) {
  const name = String(fileName || '').trim();
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

/** "D:20240305101500+08'00'" -> "2024-03-05" (date digits as written); null if unusable. */
export function parsePdfDate(value) {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(?:D:)?(\d{4})(\d{2})?(\d{2})?/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) : 1;
  const day = m[3] ? Number(m[3]) : 1;
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1) return null; // e.g. Feb 30
  return `${m[1]}-${pad(month)}-${pad(day)}`;
}

/** Local calendar date of a timestamp (ms) as yyyy-mm-dd; null if invalid. */
export function isoDateFromTimestamp(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return null;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A PDF Title is usable if non-empty, shorter than 200 chars and not a placeholder. */
export function sanePdfTitle(title) {
  const t = cleanStr(title);
  if (!t || t.length >= MAX_HEADLINE_LEN) return '';
  if (/^(untitled|无标题|未命名)(\b.*)?$/i.test(t) && t.length < 24) return '';
  return t;
}

export function sanePdfAuthor(author) {
  const a = cleanStr(author);
  return a && a.length < 120 ? a : '';
}

/**
 * @param {{lastModified?:number, pdfInfo?:object, pages?:number, ocrPages?:number, now?:number}} p
 * @returns {{title:string, author:string, date:string, pages:number|null, ocrPages:number}}
 */
export function deriveMeta({ lastModified, pdfInfo, pages = null, ocrPages = 0, now = Date.now() }) {
  const title = sanePdfTitle(pdfInfo?.Title);
  const author = sanePdfAuthor(pdfInfo?.Author);
  const date = parsePdfDate(pdfInfo?.CreationDate) || parsePdfDate(pdfInfo?.ModDate)
    || isoDateFromTimestamp(lastModified) || isoDateFromTimestamp(now);
  return { title, author, date, pages, ocrPages };
}

export const deriveHeadline = (meta, fileName) => meta?.title || stripExtension(fileName) || 'Untitled Document';
export const deriveSourceName = (meta, fileName) => meta?.author || meta?.title || stripExtension(fileName) || 'Unknown Source';
export const slugSourceId = (name) => String(name || '').toLowerCase().replace(/\s+/g, '-');

// ---- duplicate detection -------------------------------------------------------------
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
export const fileKey = (fileName, size) => `${fileName}|${size ?? ''}`;
export const contentPrefix = (text) => norm(text).slice(0, DEDUPE_PREFIX);

/**
 * Returns the existing article that duplicates this record, or null. Match = same first 200
 * chars of text AND (same headline OR the existing article was already analyzed, because
 * analysis rewrites the headline to the extracted quote).
 */
export function findContentDuplicate(record, existingArticles = []) {
  const prefix = contentPrefix(record.text);
  if (!prefix) return null;
  const headline = norm(deriveHeadline(record.meta, record.fileName));
  return existingArticles.find((a) => {
    const lede = a.lede ?? a.content ?? '';
    if (contentPrefix(lede) !== prefix) return false;
    return norm(a.headline ?? a.title) === headline || !!a.isProcessed;
  }) || null;
}

export function buildArticle(record, { projectId, id }) {
  const source_name = deriveSourceName(record.meta, record.fileName);
  return {
    id,
    projectId,
    source_name,
    source_id: slugSourceId(source_name),
    headline: deriveHeadline(record.meta, record.fileName),
    lede: record.text,
    date: record.meta?.date || isoDateFromTimestamp(Date.now()),
    url: '',
    frames: [],
    actors: { main_actor: 'Pending', blame_target: 'Pending' },
    tone: 'Neutral',
    keywords: [],
  };
}

/** Pure planning step used by project creation: records -> articles + skipped duplicates. */
export function planArticlesFromRecords(records, { projectId, existingArticles = [], makeId }) {
  const articles = [];
  const skipped = [];
  const seen = new Set();
  for (const record of records) {
    if (record.error || !record.text) continue;
    const key = fileKey(record.fileName, record.size);
    if (seen.has(key)) { skipped.push({ fileName: record.fileName, reason: 'duplicate-file' }); continue; }
    seen.add(key);
    if (findContentDuplicate(record, [...existingArticles, ...articles])) {
      skipped.push({ fileName: record.fileName, reason: 'duplicate-content' });
      continue;
    }
    articles.push(buildArticle(record, { projectId, id: makeId() }));
  }
  return { articles, skipped };
}

// ---- batch orchestration -------------------------------------------------------------
export const STATUS = {
  PENDING: 'pending', PARSING: 'parsing', QUEUED: 'queued', ANALYZING: 'analyzing',
  DONE: 'done', FAILED: 'failed', SKIPPED: 'skipped',
};

export function createBatchItems(files) {
  return Array.from(files).map((file, i) => ({
    index: i,
    file,
    fileName: file.name,
    size: file.size,
    status: STATUS.PENDING,
    detail: '',          // sub-step text while parsing (e.g. "OCR 2/5 (p.3)")
    round: 0,
    rounds: 0,
    error: null,
    note: null,          // non-fatal warning (e.g. failed extraction rounds)
    skipReason: null,    // 'duplicate-file' | 'duplicate-content'
    article: null,       // the article created for this file
    failedStage: null,   // 'parse' | 'analyze' (what a retry must redo)
  }));
}

export function summarizeBatch(items) {
  const count = (s) => items.filter((i) => i.status === s).length;
  return {
    total: items.length,
    done: count(STATUS.DONE),
    failed: count(STATUS.FAILED),
    skipped: count(STATUS.SKIPPED),
    active: items.filter((i) => [STATUS.PENDING, STATUS.PARSING, STATUS.QUEUED, STATUS.ANALYZING].includes(i.status)).length,
  };
}

/** Failed items go back to the stage that failed, ready for another runBatch. */
export function resetFailed(items) {
  return items.map((it) => {
    if (it.status !== STATUS.FAILED) return it;
    const toAnalyze = it.failedStage === 'analyze' && it.article;
    return { ...it, status: toAnalyze ? STATUS.QUEUED : STATUS.PENDING, error: null, note: null, detail: '', round: 0, rounds: 0, failedStage: null };
  });
}

/**
 * Sequential batch import. One file = one article. Phase 1 parses each pending file in
 * order (dedupe, then addArticle); phase 2 analyzes queued articles one at a time.
 * A failure in any single file is recorded on its row and never stops the others.
 *
 * deps: {
 *   projectId, makeId,
 *   parse(file, {onStatus}) -> {fileName,size,text,meta,error},
 *   getExistingArticles() -> article[],
 *   addArticle(article),
 *   analyze(article, {onRound(current,total,info)}) -> Promise<{warning?:string}|void>   (throws on failure)
 *   onChange(items)   // called with a fresh immutable snapshot after every state change
 * }
 * @returns final items array
 */
export async function runBatch(initialItems, deps) {
  const items = initialItems.map((it) => ({ ...it }));
  const emit = () => { try { deps.onChange?.(items.map((it) => ({ ...it }))); } catch { /* UI errors must not break the batch */ } };
  const patch = (index, changes) => {
    items[index] = { ...items[index], ...changes };
    emit();
  };

  // Phase 1: parse -> dedupe -> create article
  for (let i = 0; i < items.length; i++) {
    if (items[i].status !== STATUS.PENDING) continue;
    const item = items[i];
    const key = fileKey(item.fileName, item.size);
    const earlier = items.slice(0, i).some((o) => fileKey(o.fileName, o.size) === key && o.status !== STATUS.FAILED);
    if (earlier) { patch(i, { status: STATUS.SKIPPED, skipReason: 'duplicate-file' }); continue; }

    patch(i, { status: STATUS.PARSING, detail: '' });
    try {
      const record = await deps.parse(item.file, { onStatus: (s) => patch(i, { detail: s }) });
      if (record.error) throw new Error(record.error);
      if (!record.text || !record.text.trim()) throw new Error('No text could be extracted from this file.');
      const dup = findContentDuplicate(record, deps.getExistingArticles());
      if (dup) { patch(i, { status: STATUS.SKIPPED, skipReason: 'duplicate-content', detail: '' }); continue; }
      const article = buildArticle(record, { projectId: deps.projectId, id: deps.makeId() });
      deps.addArticle(article);
      patch(i, { status: STATUS.QUEUED, detail: '', article });
    } catch (err) {
      patch(i, { status: STATUS.FAILED, failedStage: 'parse', error: err?.message || String(err), detail: '' });
    }
  }

  // Phase 2: analyze queued articles strictly one after another
  for (let i = 0; i < items.length; i++) {
    if (items[i].status !== STATUS.QUEUED || !items[i].article) continue;
    patch(i, { status: STATUS.ANALYZING, round: 0, rounds: 0 });
    try {
      const res = await deps.analyze(items[i].article, {
        onRound: (current, total) => patch(i, { round: current, rounds: total }),
      });
      patch(i, { status: STATUS.DONE, note: res?.warning || null });
    } catch (err) {
      patch(i, { status: STATUS.FAILED, failedStage: 'analyze', error: err?.message || String(err) });
    }
  }
  return items;
}
