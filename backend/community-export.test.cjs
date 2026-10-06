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
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/core/version.js'), 'utf8'), scope);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/core/community-export.js'), 'utf8'), scope);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/ui/results.js'), 'utf8'), scope);
const named = scope.communityFilename([{model:'hf.co/empero-ai/Qwen:Q4_K_M'}],new Date(observedAt));
assert(named.startsWith('LLMB-hf.co-empero-ai-Qwen-Q4_K_M-community-v2-'));assert(!/[\\/]/.test(named));
assert(scope.communityFilename([{model:'a'},{model:'b'}],new Date(observedAt)).includes('a-et-1-autres-modeles'));
assert(scope.communityFilename([],new Date(observedAt)).includes('modele-inconnu'));
assert(scope.benchmarkHelp('1er token (TTFT)').includes('thinking'));
assert(scope.benchmarkHelp('RSS cumulée pic').includes('Metal/MLX'));
const report = scope.buildCommunityV2([input], observedAt);
validateReport(report);
assert.equal(report.producer.version, '0.13.0');
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
  assert(markdown.includes('LLM Benchmarker v0.13.0'));
  assert(markdown.includes('version 2.0.0')); assert(markdown.includes('Swap système'));
  assert(!markdown.includes(' |\\n| Source Swap'));
  const block = markdown.match(/\x60\x60\x60json\n([\s\S]*?)\n\x60\x60\x60/);
  assert(block); validateReport(JSON.parse(block[1]));
  scope.state.results = [input, remote];
  scope.exportMarkdown(); const bundleMarkdown = await downloaded.text();
  assert(bundleMarkdown.includes('Bundle llm-benchmarker.community.bundle, version 1.0.0'));
  assert(bundleMarkdown.includes('versions des rapports : 2.0.0'));
  scope.state.results = [input];
  scope.renderResultCard({ ...input, promptTypeName: 'Conversation', promptEmoji: 'x', response: 'ok', promptText: 'hello' });
  const primary = cardHTML.split('class="metrics-grid primary-metrics">')[1].split('<details class="result-metric-details">')[0];
  assert.equal((primary.match(/class="metric-box/g) || []).length, 4);
  assert(primary.includes('1er token (TTFT)')); assert(primary.includes('Tokens / sec'));
  assert(primary.includes('RSS cumulée pic')); assert(primary.includes('Temps total'));
  assert(!primary.includes('Tokens générés'));
  assert(cardHTML.includes('<details class="result-metric-details"><summary>Toutes les métriques et conditions</summary>'));
  assert(cardHTML.includes('Tokens générés'));
  assert(cardHTML.includes('Swap système')); assert(cardHTML.includes('Contexte Auto'));
  const diagnostic={...input,id:'nonconform',executionOutcome:'completed',error:'Épreuve non conforme',promptTypeName:'Non-conformité',promptEmoji:'x',provenance:{applicationVersion:'0.12.0'},
    agentic:{evaluation:{goalCompleted:false,taskSuccess:false,toolCallCount:1,retryCount:0,criteria:[]},steps:[],artifacts:[]},kind:'agentic'};
  const stopped={...diagnostic,id:'stopped',executionOutcome:'failed',error:'Limite de tours modèle atteinte.',promptTypeName:'Budget',agentic:{...diagnostic.agentic,evaluation:{...diagnostic.agentic.evaluation,goalCompleted:true}}};
  const details=scope.buildMarkdownReport([diagnostic,stopped],new Date(observedAt),report).split('## 🔍 Détail des tests')[1];
  const sections=details.split(/(?=### Test \d+ —)/).slice(1);assert.equal(sections.length,2);
  assert(sections[0].startsWith('### Test 1 —'));assert(sections[0].includes('**Exécution :** terminée'));assert(sections[0].includes('Exécution terminée — critères non conformes'));assert(!sections[0].includes('❌ Erreur'));
  assert(sections[0].includes('**Version lors du test :** 0.12.0'),'Historical measurement version must remain unchanged');
  assert(!sections[0].includes('Limite de tours'));assert(sections[1].includes('**Objectif atteint :** oui'));assert(sections[1].includes('**Conformité :** échouée'));assert(sections[1].includes('Limite de tours'));assert(sections[1].includes('| Temps total | 1.00 s |'));assert(sections[1].includes('#### Métriques'));
  const noTiming={...stopped,metrics:{totalTokens:10,totalTime:null,ttft:null,tokensPerSec:null}};const partial=scope.buildMarkdownReport([noTiming],new Date(observedAt),report).split('## 🔍 Détail des tests')[1];assert(partial.includes('| Temps total | N/A |'));assert(!partial.includes('| Temps total | 0.00 s |'));
  assert(scope.benchmarkHelp('Swap système').includes('ne prouve pas des échanges actifs'));
  console.log('PASS: actual v2 exports/schema, hardware allowlist, telemetry totals, legacy unknowns, mixed runners, failure privacy, JSON/Markdown and result cards');
})().catch(error => { console.error(error); process.exitCode = 1; });
