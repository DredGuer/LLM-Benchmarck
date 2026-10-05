const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const elements = Object.fromEntries(['modelSelect', 'modelCustom', 'modelStatus', 'modelMetadata', 'contextTokens']
  .map(id => [id, { value: '', textContent: '', innerHTML: '', appendChild() {} }]));
const scope = { state: { runner: 'ollama' }, RUNNERS: { ollama: { type: 'local', base: 'http://local' }, lmstudio: { type: 'local', base: 'http://other' } },
  DEFAULT_MODELS: {}, document: { getElementById: id => elements[id], createElement: () => ({ style: {}, appendChild() {} }) },
  getSelectedModel: () => elements.modelCustom.value || elements.modelSelect.value,
  showToast() {}, console };
vm.createContext(scope);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/core/runners.js'), 'utf8'), scope);
const moe = scope.parseModelMetadata({ model_info: { 'general.architecture': 'qwen3moe',
  'general.parameter_count': 30000000000, 'qwen3moe.expert_count': 128,
  'qwen3moe.expert_used_count': 8, 'qwen3moe.context_length': 131072 }, details: { quantization_level: 'Q4' } }, 'example');
assert.equal(moe.type, 'moe'); assert.equal(moe.activeExperts, 8); assert.equal(moe.contextMaxTokens, 131072);
assert.equal(scope.parseModelMetadata({ model_info: { 'general.architecture': 'llama', 'llama.expert_count': 0 } }, 'dense').type, 'dense');
assert.equal(scope.parseModelMetadata({}, 'qwen-moe-name-is-not-evidence').type, 'unknown');
assert.equal(scope.parseModelMetadata({ model_info: { 'general.architecture': 'x', 'x.expert_count': '128' } }, 'x').type, 'unknown');
assert.equal(scope.getRequestedContextTokens(), null);
elements.contextTokens.value = '8192'; assert.equal(scope.getRequestedContextTokens(), null);
assert.equal(scope.buildOllamaOptions(0.7, 256, 8192).num_ctx, 8192);
assert(!('num_ctx' in scope.buildOllamaOptions(0.7, 256, null)));
elements.contextTokens.value = '-1'; assert.equal(scope.getRequestedContextTokens(), null);
scope.state.runner = 'lmstudio'; assert.equal(scope.getRequestedContextTokens(), null);
scope.state.runner = 'ollama'; elements.contextTokens.value = '';
(async () => {
  scope.fetchWithTimeout = async () => ({ json: async () => ({ models: [{ name: 'first' }, { name: 'previous' }] }) });
  elements.modelSelect.value = 'previous';
  await scope.fetchModels(); assert.equal(elements.modelSelect.value, 'previous');
  let release;
  elements.modelSelect.value = 'first';
  scope.fetchWithTimeout = () => new Promise(resolve => { release = resolve; });
  const pending = scope.refreshModelMetadata();
  elements.modelCustom.value = 'changed';
  release({ ok: true, json: async () => ({ model_info: { 'general.architecture': 'x', 'x.expert_count': 8 } }) });
  await pending; assert.equal(scope.state.modelMetadata, null);
  elements.modelCustom.value = '';
  scope.fetchWithTimeout = async () => ({ ok: true, json: async () => ({ model_info: { 'general.architecture': 'x', 'x.expert_count': 8 } }) });
  await scope.refreshModelMetadata(); assert.equal(scope.state.modelMetadata.type, 'moe');
  scope.fetchWithTimeout = async () => { throw Error('unavailable'); };
  await scope.refreshModelMetadata(); assert.equal(scope.state.modelMetadata, null);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/ui/results.js'), 'utf8'), scope);
  const exported = scope.buildCommunityExport([{ model: 'first', modelMetadata: moe, metrics: { contextMode: 'auto', contextObservedTokens: 4096 } }], new Date().toISOString());
  assert.equal(exported.tests[0].parameters.contextObservedTokens, 4096);
  assert.equal(exported.tests[0].modelMetadata.type, 'moe');
  console.log('PASS: model metadata, unknown architecture, context options, preserved selection, stale responses and export');
})().catch(error => { console.error(error); process.exitCode = 1; });
