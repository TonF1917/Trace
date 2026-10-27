// Verifies multi-round chunked LLM processing with a stubbed fetch (no network).
// Run: node tests/chunking.test.mjs
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true }, logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const llm = await server.ssrLoadModule('/src/services/LLMService.js');

let failures = 0;
const check = async (label, fn) => {
  try { await fn(); console.log('PASS', label); } catch (e) { failures++; console.log('FAIL', label, '\n  ', e.stack || e.message); }
};

// stub: reply based on the chunk id embedded in the user prompt ("[[Pn]]" markers)
let calls = [];
let failPlan = {}; // chunkMarker -> number of failures remaining
function installFetch(handler) {
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    const user = body.messages[1].content;
    const system = body.messages[0].content;
    calls.push({ user, system });
    const reply = handler({ user, system });
    return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }) };
  };
}
const markersIn = (s) => [...s.matchAll(/\[\[P(\d+)\]\]/g)].map((m) => Number(m[1]));

// 120k chars: 240 paragraphs of ~500 chars, each tagged [[Pn]]
const paras = Array.from({ length: 240 }, (_, i) => `[[P${i}]] ` + 'lorem ipsum dolor sit amet '.repeat(18));
const bigText = paras.join('\n\n');

await check('splitIntoChunks: >100k input -> many ~14k chunks on paragraph boundaries with overlap', () => {
  assert.ok(bigText.length > 100000, `len=${bigText.length}`);
  const chunks = llm.splitIntoChunks(bigText);
  console.log(`   input ${bigText.length} chars -> ${chunks.length} chunks; sizes`, chunks.map((c) => c.length).slice(0, 4), '...');
  assert.ok(chunks.length >= 8);
  chunks.forEach((c) => assert.ok(c.length <= 14000 + 400 + 2, `chunk too long ${c.length}`));
  // every paragraph marker appears in at least one chunk (nothing dropped)
  const seen = new Set(chunks.flatMap(markersIn));
  for (let i = 0; i < 240; i++) assert.ok(seen.has(i), `paragraph ${i} lost`);
  // chunks start on a paragraph/word boundary (overlap prefix is a tail of the previous chunk)
  assert.ok(chunks[1].slice(0, 100).length > 0);
  assert.ok(chunks[0].endsWith('amet') || chunks[0].endsWith('amet '));
  // one huge paragraph without newlines is still split
  const huge = llm.splitIntoChunks('word '.repeat(20000));
  assert.ok(huge.length >= 7 && huge.every((c) => c.length <= 14402));
});

await check('analyzeArticle: >100k text runs sequential rounds, progress i/n, merges + dedupes', async () => {
  calls = [];
  installFetch(({ user }) => {
    const ids = markersIn(user);
    const first = ids[0];
    return {
      keywords: ['k' + (first % 2), 'shared'],
      relationships: [
        { main_actor: `Actor${first}`, blame_target: 'Target', relation_type: 'Opposes / Blames', quote: `q${first}` },
        { main_actor: 'Same', blame_target: 'Dup', relation_type: 'Belongs To', quote: 'dup' }, // identical every round
      ],
    };
  });
  const progress = [];
  const result = await llm.analyzeArticle(bigText, ['F'], ['T'], ['Opposes / Blames', 'Belongs To'], 10, (i, n, info) => progress.push(`${i}/${n}:${info.phase}`));
  const n = calls.length;
  console.log(`   rounds=${n}; progress=${progress.slice(0, 3)}..${progress.at(-1)}; relationships=${result.relationships.length}; keywords=${result.keywords}`);
  assert.ok(n >= 8);
  assert.equal(progress.length, n);
  assert.equal(progress.at(-1), `${n}/${n}:round`);
  assert.equal(result.relationships.filter((r) => r.main_actor === 'Same').length, 1, 'duplicate across rounds merged');
  assert.equal(result.relationships.length, n + 1);
  assert.equal(new Set(result.keywords).size, result.keywords.length, 'keywords deduped');
  assert.ok(result.keywords.includes('shared') && result.keywords.includes('k0'));
  assert.equal(result.failedRounds.length, 0);
});

await check('round failure: retried once, then success is used (no failure reported)', async () => {
  calls = [];
  let hits = 0;
  installFetch(({ user }) => {
    const ids = markersIn(user);
    if (ids[0] === 0 && hits++ === 0) throw new Error('transient network error');
    return { keywords: [], relationships: [{ main_actor: `A${ids[0]}`, blame_target: 'T', relation_type: 'R' }] };
  });
  // fetch throwing -> callLLM wraps as Connection Error -> runChunkedRounds retries
  const r = await llm.analyzeArticle(bigText, ['F'], ['T'], ['R'], 10);
  assert.equal(r.failedRounds.length, 0);
  assert.equal(calls.length, llm.splitIntoChunks(bigText).length + 1, 'exactly one extra call for the retry');
});

await check('round failure: persistent failure on round 3 is reported (not silently dropped)', async () => {
  calls = [];
  const chunks = llm.splitIntoChunks(bigText);
  const third = markersIn(chunks[2])[0];
  installFetch(({ user }) => {
    if (markersIn(user)[0] === third) throw new Error('boom');
    return { keywords: [], relationships: [{ main_actor: `A${markersIn(user)[0]}`, blame_target: 'T', relation_type: 'R' }] };
  });
  const r = await llm.analyzeArticle(bigText, ['F'], ['T'], ['R'], 10);
  console.log('   failedRounds:', JSON.stringify(r.failedRounds).slice(0, 160));
  assert.equal(r.failedRounds.length, 1);
  assert.equal(r.failedRounds[0].round, 3);
  assert.equal(r.totalRounds, chunks.length);
  assert.equal(r.relationships.length, chunks.length - 1);
});

await check('all rounds failing throws ChunkedRoundsError naming the rounds', async () => {
  installFetch(() => { throw new Error('down'); });
  await assert.rejects(() => llm.analyzeArticle(bigText, ['F'], ['T'], ['R'], 10), (e) => e.name === 'ChunkedRoundsError' && /round 1\//.test(e.message) && e.failedRounds.length === llm.splitIntoChunks(bigText).length);
});

await check('generateProjectOntology: multi-round, merges frames/tones, final synthesis call', async () => {
  calls = [];
  installFetch(({ user }) => {
    if (/Reconcile/.test(user)) return { name: 'Final Name', description: 'Final desc', frames: ['A', 'B', 'C', 'D'], tones: ['Neutral', 'Critical', 'Alarmist'] };
    const k = markersIn(user)[0];
    return { name: `N${k}`, description: `D${k}`, frames: ['Shared', `F${k}`], tones: ['Neutral', `T${k}`] };
  });
  const progress = [];
  const o = await llm.generateProjectOntology(bigText, (i, n, info) => progress.push(`${i}/${n}:${info.phase}`));
  const rounds = llm.splitIntoChunks(bigText).length;
  console.log(`   calls=${calls.length} (rounds ${rounds} + 1 synthesis); last progress=${progress.at(-1)}; result=${JSON.stringify(o).slice(0, 120)}`);
  assert.equal(calls.length, rounds + 1);
  assert.equal(o.name, 'Final Name');
  assert.deepEqual(o.frames, ['A', 'B', 'C', 'D']);
  assert.equal(progress.at(-1), `${rounds}/${rounds}:synthesize`);
});

await check('generateProjectOntology: synthesis failure falls back to deduped merge', async () => {
  installFetch(({ user }) => {
    if (/Reconcile/.test(user)) throw new Error('x');
    const k = markersIn(user)[0];
    return { name: `N${k}`, description: `D${k}`, frames: ['Shared', `F${k}`], tones: ['Neutral'] };
  });
  const o = await llm.generateProjectOntology(bigText);
  assert.equal(o.frames.filter((f) => f === 'Shared').length, 1);
  assert.ok(o.frames.length <= 8 && o.frames.length >= 2);
  assert.deepEqual(o.tones, ['Neutral']);
});

await check('extractMoreRelationships: later rounds are told about earlier finds; existing filtered', async () => {
  calls = [];
  installFetch(({ user }) => {
    const k = markersIn(user)[0];
    return { relationships: [{ main_actor: `X${k}`, blame_target: 'Y', relation_type: 'R', quote: 'q' }, { main_actor: 'Old', blame_target: 'Known', relation_type: 'R' }] };
  });
  const r = await llm.extractMoreRelationships(bigText, ['F'], ['T'], ['R'], [{ actor: 'Old', target: 'Known', relation_type: 'R', quote: '' }], 10);
  assert.ok(!r.relationships.some((x) => x.main_actor === 'Old'));
  assert.ok(calls.at(-1).system.includes('Actor: X0 | Target: Y'), 'round n system prompt lists round-1 results');
});

await check('connectExistingEntities: no 15k slice; chunked and merged', async () => {
  calls = [];
  installFetch(({ user }) => ({ relationships: [{ main_actor: 'A', blame_target: 'B', relation_type: 'R' }] }));
  const r = await llm.connectExistingEntities(bigText, ['F'], ['T'], ['R'], ['A', 'B'], 'ctx', 10);
  assert.equal(r.relationships.length, 1);
  assert.ok(calls.length >= 8);
  const covered = new Set(calls.flatMap((c) => markersIn(c.user)));
  assert.equal(covered.size, 240);
});

await check('aiCompressText: uses chunk helper, reports progress, throws naming failed round', async () => {
  installFetch(({ user }) => ({ summary: 's' + markersIn(user)[0] }));
  const prog = [];
  const out = await llm.aiCompressText(bigText, (i, n) => prog.push(`${i}/${n}`), 4);
  assert.match(out, /\[Segment 1 Summary\]:\ns0/);
  assert.ok(prog.length >= 8);
  installFetch(({ user }) => { if (markersIn(user)[0] === 0) throw new Error('nope'); return { summary: 'ok' }; });
  await assert.rejects(() => llm.aiCompressText(bigText, null, 4), /round 1\/\d+/);
});

await check('short text is a single round with unchanged result shape', async () => {
  calls = [];
  installFetch(() => ({ keywords: ['a'], relationships: [{ main_actor: 'A', blame_target: 'B', relation_type: 'R' }] }));
  const r = await llm.analyzeArticle('short article', ['F'], ['T'], ['R'], 5);
  assert.equal(calls.length, 1);
  assert.equal(r.relationships.length, 1);
});

await server.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
