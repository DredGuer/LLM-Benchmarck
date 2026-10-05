const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
async function test(fail) {
  const calls = [], monitor = {
    isActive: false, generation: 1, resourcesPending: null,
    loadedModel: { contextTokens: 8192, sizeBytes: 20 * 1024 ** 3, observedAt: Date.now(), source: 'ollama-api-ps' },
    resources: null,
    async startResources() { calls.push('begin'); },
    start() { this.isActive = true; calls.push('start'); },
    stop() { this.isActive = false; calls.push('stop'); return { peakMemory: 100, averageMemory: 90, source: 'process-tree-rss', readings: [] }; },
    async _fetchLoadedModel(generation, final) { assert.equal(final, true); calls.push('context'); },
    async pollResources(finish) { assert.equal(finish, true); calls.push('finish'); this.resources = { sampleCount: 1 }; },
    async cancelResources() { calls.push('cancel'); }
  };
  let request, time = 0;
  const scope = { state: { runner: 'ollama', env: {} }, currentTestState: {}, window: { MEMORY_MONITOR_CONFIG: { pollInterval: 500 } },
    getTemperatureForPromptType: () => 0.7, getMaxTokens: () => 256, getRequestedContextTokens: () => null,
    modelArchitectureText: () => 'unknown', buildOllamaOptions: (temperature, max) => ({ temperature, num_predict: max }),
    ollamaMemoryMonitor: monitor, performance: { now: () => { const value = time; time += 10; return value; } },
    RUNNERS: { ollama: { base: 'http://local', name: 'Ollama' } }, TextDecoder, crypto,
    setTimeout: fn => { fn(); return 0; }, resetLiveOutput() {}, showLiveSections() {}, setControlButtons() {},
    addDebugLog() {}, updateThinkingOutput() {}, updateTokenProgress() {},
    fetchWithTimeout: async (url, options) => {
      request = JSON.parse(options.body);
      if (fail) throw Error('request failed');
      let ended = false;
      return { body: { getReader: () => ({ read: async () => {
        if (ended) return { done: true }; ended = true;
        return { done: false, value: Buffer.from(JSON.stringify({ response: 'hello', done: true, eval_count: 10 }) + '\n') };
      } }) } };
    }
  };
  vm.createContext(scope);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/core/benchmark.js'), 'utf8'), scope);
  if (fail) await assert.rejects(() => scope.executeTest('test', { id: 'conversation', name: 'test' }, 'hello', 1));
  else {
    const result = await scope.executeTest('test', { id: 'conversation', name: 'test' }, 'hello', 1);
    assert.equal(result.metrics.contextMode, 'auto'); assert.equal(result.metrics.contextObservedTokens, 8192);
    assert.equal(result.metrics.tokenCountKind, 'declared'); assert.equal(result.metrics.totalTime, 20);
    assert.equal(result.memory.resources.sampleCount, 1);
    assert(!('num_ctx' in request.options));
    assert(calls.indexOf('begin') < calls.indexOf('start'));
    assert(calls.indexOf('stop') < calls.indexOf('finish'));
  }
  assert.equal(calls.filter(c => c === 'stop').length, 1);
  assert.equal(calls.filter(c => c === 'cancel').length, 1);
}
(async () => { await test(false); await test(true);
  console.log('PASS: benchmark Auto context, final runner context, telemetry timing excluded and cleanup on success/failure');
})().catch(error => { console.error(error); process.exitCode = 1; });
