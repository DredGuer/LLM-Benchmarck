const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { validateReport } = require('../schemas/validate.cjs');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '../schemas/examples/apple-generation.json')));
const observedAt = '2026-10-05T17:00:01.000Z';
const secret = 'PRIVATE_PROMPT_KEY_SERIAL';
const machine = structuredClone(fixture.machines[0]); machine.id = 'local';
machine.cpus[0].serialNumber = secret;
machine.cpus[0].frequency = { value: null, source: 'test' };
machine.storage[0].capacity = { value: null, source: 'test' };
const sample = { value: 100, unit: 'bytes', status: 'available', source: 'sysctl:vm.swapusage',
  kind: 'measured', observedAt, scope: 'machine', nodeId: 'local' };
const input = {
  id: 'real-test', timestamp: observedAt, startedAt: '2026-10-05T17:00:00.000Z', finishedAt: observedAt,
  runner: 'Ollama', model: 'example:moe', promptType: 'conversation', promptText: secret, response: secret,
  metrics: { totalTokens: 10, tokenCountKind: 'declared', tokenCountSource: 'ollama-api-generate:eval_count',
    totalTime: 1000, tokensPerSec: 10, ttft: 100, temperature: 0.7, maxTokens: 4096, contextMode: 'auto', contextObservedTokens: 8192 },
  modelMetadata: { type: 'moe', architecture: 'qwen3moe', parameterCount: 35000000000, expertCount: 256, activeExperts: 8, quantization: 'Q4_K_M' },
  memory: { readings: [{ timestamp: Date.parse(observedAt), memory: 1000 }], source: 'process-tree-rss', peak: 1000, average: 900, sampleCount: 2, intervalMs: 500,
    loadedModel: { sizeBytes: 20 * 1024 ** 3, sizeVramBytes: 20 * 1024 ** 3, observedAt: Date.parse(observedAt), source: 'ollama-api-ps' },
    resources: { samples: [{ observedAt, swapUsedBytes: 100, compressedBytes: 100, swapReadBytes: 0, swapWriteBytes: null, diskReadBytes: 100, diskWriteBytes: 200 }], sampleCount: 3, swapPeak: sample, diskReadDelta: sample,
      mlxPeak: { ...sample, scope: 'process-tree', source: 'ollama-server-log:memory-peak' } } },
  env: { os: 'macOS', hardwareInventory: { machine, provenance: { cpuModel: 'test', physicalCores: 'test', coreClasses: 'test', memory: 'test', gpus: 'test' } }, apiKeys: secret, hostname: secret }, rep: 1
};
let downloaded, cardHTML;
const scope = { crypto, Blob, state: { results: [input] },
  modelArchitectureText: meta => meta?.type || 'unknown', escapeHtml: String,
  URL: { createObjectURL: blob => { downloaded = blob; return 'blob:test'; }, revokeObjectURL() {} },
  document: { getElementById: id => id === 'resultsList' ? { style: {}, insertBefore: card => { cardHTML = card.innerHTML; } } : { style: {} },
    createElement: () => ({ click() {} }) }, showToast() {} };
vm.createContext(scope);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/core/community-export.js'), 'utf8'), scope);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/ui/results.js'), 'utf8'), scope);
const report = scope.buildCommunityV2([input], observedAt);
validateReport(report);
assert.equal(report.tests[0].resourceSamples.length, 7);
assert.equal(report.schemaVersion, '2.0.0'); assert.equal(report.synthetic, false);
assert.equal(report.tests[0].parameters.contextTokens, 8192);
assert.equal(report.tests[0].model.architecture, 'moe');
assert.equal(report.tests[0].resourceSummaries.find(x => x.metric === 'disk-read-bytes').total.value, 100);
assert(!JSON.stringify(report).includes(secret));
const legacy = { id: 'old', runner: 'Ollama', model: 'old', timestamp: observedAt, metrics: { totalTime: 1000 }, env: {} };
validateReport(scope.buildCommunityV2([legacy], observedAt));
const remote = { ...legacy, id: 'remote', runner: 'OpenAI' };
const bundle = scope.buildCommunityV2([input, remote], observedAt);
assert.equal(bundle.schema, 'llm-benchmarker.community.bundle');
assert.equal(bundle.reports.length, 2); bundle.reports.forEach(validateReport);
assert.equal(bundle.reports[1].tests[0].participatingNodeIds[0], 'inference-unknown');
assert.equal(bundle.reports[1].machines[1].memory.physicalCapacity.value, null);
const failure = scope.buildCommunityV2([{ ...legacy, error: secret }], observedAt);
validateReport(failure); assert(!JSON.stringify(failure).includes(secret));
const warm = { ...input, id: 'warmup', phase: 'warmup', protocol: { phase:'warmup',version:'0.07',loadState:'cold',cacheState:'unknown',warmupRuns:0,promptDigest:'abc' } };
const heatedReport = scope.buildCommunityV2([warm, { ...input, protocol:{phase:'measurement',version:'0.07',loadState:'warm',cacheState:'cold',warmupRuns:1} }], observedAt);
validateReport(heatedReport);
assert.equal(heatedReport.tests[0].protocol.phase,'warmup');
assert.equal(heatedReport.tests[1].protocol.warmupRuns,1);
const altered = structuredClone(report); altered.tests[0].model.expertCount = -1;
assert.throws(() => validateReport(altered));
(async () => {
  scope.exportCommunityJSON(); validateReport(JSON.parse(await downloaded.text()));
  scope.exportMarkdown(); const markdown = await downloaded.text();
  assert(markdown.includes('version 2.0.0')); assert(markdown.includes('Swap système'));
  assert(!markdown.includes(' |\\n| Source Swap'));
  const block = markdown.match(/\x60\x60\x60json\n([\s\S]*?)\n\x60\x60\x60/);
  assert(block); validateReport(JSON.parse(block[1]));
  scope.renderResultCard({ ...input, promptTypeName: 'Conversation', promptEmoji: 'x', response: 'ok', promptText: 'hello' });
  assert(cardHTML.includes('Swap système')); assert(cardHTML.includes('Contexte Auto'));
  console.log('PASS: actual v2 exports/schema, hardware allowlist, telemetry totals, legacy unknowns, mixed runners, failure privacy, JSON/Markdown and result cards');
})().catch(error => { console.error(error); process.exitCode = 1; });
