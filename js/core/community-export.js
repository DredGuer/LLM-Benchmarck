// Community v2 export: explicit units, scopes and unknowns; no prompt/response/log/key fields.
function communityNumber(value) { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null; }
function communityInteger(value) { return Number.isSafeInteger(value) && value >= 0 ? value : null; }
function communityReading(value, unit, source, observedAt, scope, nodeId, kind, method) {
  value = communityNumber(value);
  var reading = { value: value, unit: unit, status: value === null ? 'unavailable' : 'available',
    source: source, kind: kind || 'measured', observedAt: observedAt, scope: scope, nodeId: nodeId };
  if (method) reading.method = method;
  return reading;
}
function inventoryReading(r, scope, nodeId, deviceId, observedAt) {
  var result = communityReading(r?.value, r?.unit || 'bytes', r?.source || 'not-collected',
    r?.observedAt || observedAt, scope, nodeId, r?.kind || 'declared');
  result.deviceId = deviceId || null;
  return result;
}
function communityMachine(env, observedAt, id) {
  var n = env?.hardwareInventory?.machine;
  if (!n) return { id: id, platform: 'unknown', inventorySource: 'not-collected',
    os: { name: env?.os || null, architecture: null }, cpus: [], gpus: [], storage: [],
    memory: { architecture: 'unknown', physicalCapacity: communityReading(null, 'bytes', 'not-collected', observedAt, 'machine', id, 'declared') } };
  return {
    id: id, platform: n.platform, inventorySource: n.inventorySource,
    os: { name: n.os.name, version: n.os.version ?? null, kernel: n.os.kernel ?? null, architecture: n.os.architecture },
    cpus: n.cpus.map(function(c) { return { id: c.id, vendor: c.vendor ?? null, model: c.model ?? null,
      physicalCores: communityInteger(c.physicalCores), logicalCores: communityInteger(c.logicalCores),
      performanceCores: communityInteger(c.performanceCores), efficiencyCores: communityInteger(c.efficiencyCores),
      frequency: inventoryReading(c.frequency, 'cpu', id, c.id, observedAt) }; }),
    memory: { architecture: n.memory.architecture, physicalCapacity: inventoryReading(n.memory.physicalCapacity, 'machine', id, null, observedAt) },
    gpus: n.gpus.map(function(g) { return { id: g.id, vendor: g.vendor ?? null, model: g.model ?? null,
      kind: g.kind, memoryArchitecture: g.memoryArchitecture,
      capacity: inventoryReading(g.capacity, 'gpu', id, g.id, observedAt), sharedMemoryPoolId: g.sharedMemoryPoolId ?? null,
      computeBackend: g.computeBackend ?? null, computeUnits: communityInteger(g.computeUnits) }; }),
    storage: n.storage.map(function(d) { return { id: d.id, model: d.model ?? null, kind: d.kind,
      transport: d.transport, roles: (d.roles || []).slice(),
      capacity: inventoryReading(d.capacity, 'storage', id, d.id, observedAt) }; })
  };
}
function buildCommunityV2(results, generatedAt) {
  var groups = new Map();
  results.forEach(function(r) {
    // Keep materially different inventories and runners in separate schema-valid reports.
    var machine = communityMachine(r.env, generatedAt, 'local');
    var key = JSON.stringify([r.runner, r.runnerVersion || null, machine]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });
  var reports = [];
  groups.forEach(function(items) {
    var first = items[0], runner = first.runner || 'unknown';
    var localRunner = ['Ollama', 'LM Studio', 'llama.cpp'].includes(runner);
    var inferenceNode = localRunner ? 'local' : 'inference-unknown';
    var machines = [communityMachine(first.env, generatedAt, 'local')];
    if (!localRunner) machines.push(communityMachine({}, generatedAt, inferenceNode));
    var report = {
      schema: 'llm-benchmarker.community', schemaVersion: '2.0.0',
      reportId: crypto.randomUUID(), generatedAt: generatedAt,
      producer: { name: 'LLM Benchmarker', version: '0.06' }, synthetic: false,
      privacy: { profile: 'community-redacted', rawPromptsIncluded: false, rawResponsesIncluded: false, rawToolArgumentsIncluded: false },
      machines: machines,
      execution: { mode: 'single-machine', runner: { name: runner, version: first.runnerVersion || null, engine: null, backend: null },
        parallelism: 'unknown', requestedPlacements: [], observedPlacements: [], links: [],
        topologySource: localRunner ? 'configured-local-runner; actual placements not collected' : 'inference hardware unknown; local inventory belongs to client' },
      tests: items.map(function(r, index) {
        var m = r.metrics || {}, mem = r.memory || {}, meta = r.modelMetadata || {};
        var finishedAt = r.finishedAt || r.timestamp || generatedAt;
        var startedAt = r.startedAt || new Date(Date.parse(finishedAt) - (communityNumber(m.totalTime) || 0)).toISOString();
        function metric(value, unit, source, kind, method, node) {
          return communityReading(value, unit, source, finishedAt, 'test', node || inferenceNode, kind, method);
        }
        var summaries = [], samples = [];
        function sample(metricName, value, at, source, scope, kind, method) {
          if (!Number.isFinite(Date.parse(at))) return;
          samples.push({ elapsedMs: Math.max(0, Date.parse(at) - Date.parse(startedAt)), nodeId: 'local', metric: metricName,
            reading: communityReading(value, 'bytes', source, at, scope, 'local', kind, method) });
        }
        if (mem.source && localRunner) {
          (mem.readings || []).forEach(function(r) {
            if (typeof r.timestamp === 'number' && Number.isFinite(r.timestamp)) sample(mem.source === 'process-tree-rss' ? 'rss' : 'browser-js-heap',
              r.memory == null ? null : r.memory * 1024 ** 2, new Date(r.timestamp).toISOString(), mem.source,
              mem.source === 'process-tree-rss' ? 'process-tree' : 'machine', 'measured');
          });
          var count = communityInteger(mem.sampleCount) || 0;
          summaries.push({ nodeId: 'local', metric: mem.source === 'process-tree-rss' ? 'rss' : mem.source === 'browser-js-heap' ? 'browser-js-heap' : 'unknown-memory',
            peak: communityReading(mem.peak == null ? null : mem.peak * 1024 ** 2, 'bytes', mem.source, finishedAt, mem.source === 'process-tree-rss' ? 'process-tree' : 'machine', 'local'),
            average: communityReading(mem.average == null ? null : mem.average * 1024 ** 2, 'bytes', mem.source, finishedAt, mem.source === 'process-tree-rss' ? 'process-tree' : 'machine', 'local'),
            sampleCount: count, intervalMs: mem.intervalMs ?? null, aggregation: mem.source === 'process-tree-rss' ? 'sum-per-process-rss' : 'single-source' });
        }
        if (mem.loadedModel && localRunner) {
          var loaded = mem.loadedModel;
          summaries.push({ nodeId: 'local', metric: 'model-declared-size',
            total: communityReading(loaded.sizeBytes, 'bytes', loaded.source, new Date(loaded.observedAt).toISOString(), 'model', 'local', 'declared',
              'Loaded-model size; not a measured RAM peak; unified size and size_vram must not be added'),
            sampleCount: 1, intervalMs: null, aggregation: 'none' });
        }
        if (mem.loadedModelBefore && localRunner) summaries.push({nodeId:'local',metric:'model-declared-size',
          start:communityReading(mem.loadedModelBefore.sizeBytes,'bytes','ollama-api-ps',new Date(mem.loadedModelBefore.observedAt).toISOString(),'model','local','declared','Allocation declared before request; not model weights size'),sampleCount:1,intervalMs:null,aggregation:'none'});
        var resources = mem.resources;
        if (resources && localRunner) {
          (resources.samples || []).forEach(function(r) {
            [['swapUsedBytes','swap-used','sysctl:vm.swapusage'], ['compressedBytes','compressed-memory','vm_stat:compressor-pages'],
              ['swapReadBytes','swap-read-bytes','vm_stat:Swapins*page-size'], ['swapWriteBytes','swap-write-bytes','vm_stat:Swapouts*page-size'],
              ['diskReadBytes','disk-read-bytes','ioreg:IOBlockStorageDriver.Statistics'], ['diskWriteBytes','disk-write-bytes','ioreg:IOBlockStorageDriver.Statistics']]
              .forEach(function(spec) { sample(spec[1], r[spec[0]], r.observedAt, spec[2], 'machine',
                spec[1].startsWith('swap-') && spec[1] !== 'swap-used' ? 'estimated' : 'measured',
                spec[1].endsWith('-bytes') ? 'System counter delta since telemetry baseline; swap bytes are page-equivalent' : 'System-wide gauge'); });
          });
          [['swapStart', 'swap-used', 'start'], ['swapEnd', 'swap-used', 'end'],
            ['compressedStart', 'compressed-memory', 'start'], ['compressedEnd', 'compressed-memory', 'end'], ['swapPeak', 'swap-used', 'peak'], ['compressedPeak', 'compressed-memory', 'peak'],
            ['swapReadDelta', 'swap-read-bytes', 'total'], ['swapWriteDelta', 'swap-write-bytes', 'total'],
            ['diskReadDelta', 'disk-read-bytes', 'total'], ['diskWriteDelta', 'disk-write-bytes', 'total'],
            ['mlxHeldEnd', 'mlx-allocator-held-server-unattributed', 'end'], ['mlxPeak', 'mlx-allocator-peak-server-unattributed', 'peak']].forEach(function(spec) {
            var input = resources[spec[0]];
            if (!input) return;
            var summary = { nodeId: 'local', metric: spec[1], sampleCount: communityInteger(resources.sampleCount) || 0, intervalMs: null, aggregation: 'per-node' };
            summary[spec[2]] = communityReading(input.value, 'bytes', input.source, input.observedAt || finishedAt,
              input.scope, 'local', input.kind, spec[0].startsWith('mlx') ? 'Ollama server log; model attribution unverified; rounded allocator peak' :
              input.method || (spec[2] === 'total' ? 'System-wide counter delta during telemetry session; not SSD benchmark speed' : (spec[2] === 'peak' ? 'System-wide sampled peak' : 'System-wide boundary gauge')));
            summaries.push(summary);
          });
        }
        var tokenKind = m.tokenCountKind || 'estimated';
        var test = {
          id: r.id || 'test-' + index, kind: 'generation', status: r.error ? 'failure' : r.completion?.limitReached ? 'partial' : 'success',
          startedAt: startedAt, finishedAt: finishedAt,
          model: { id: r.model || 'unknown', digest: mem.loadedModel?.digest || null, quantization: meta.quantization || null,
            contextMaxTokens: communityInteger(meta.contextMaxTokens),
            parameterCount: communityInteger(meta.parameterCount), activeParameterCount: null,
            architecture: meta.type || 'unknown', architectureName: meta.architecture || null,
            expertCount: communityInteger(meta.expertCount), activeExpertsPerToken: communityInteger(meta.activeExperts) },
          parameters: { temperature: communityNumber(m.temperature), maxOutputTokens: communityInteger(m.maxTokens),
            contextTokens: communityInteger(m.contextObservedTokens), contextSource: m.contextObservedTokens != null ? 'ollama-api-ps:context_length (observed loaded runner)' : null, concurrency: 1,
            thinking: { enabled: typeof m.thinkingEnabled === 'boolean' ? m.thinkingEnabled : null, observed: typeof m.thinkingObserved === 'boolean' ? m.thinkingObserved : null } },
          protocol: { id: 'llmb-generation-' + (['conversation','factual','math','code','logic','creative','warmup'].includes(r.promptType) ? r.promptType : 'custom'),
            version: r.protocol?.version || '0.06', phase: r.phase || 'unknown', promptDigest: r.protocol?.promptDigest || null,
            warmupRuns: r.protocol?.warmupRuns || 0, loadState: r.protocol?.loadState || 'unknown', cacheState: r.protocol?.cacheState || 'unknown',
            cachePolicy: r.protocol?.cachePolicy || null, repetition: Math.max(1, communityInteger(r.rep) || 1) },
          participatingNodeIds: [inferenceNode],
          metrics: { loadTime: metric(m.loadTimeMs, 'ms', 'ollama-api-generate:load_duration', 'declared'),
            prefillTime: metric(m.prefillTimeMs, 'ms', 'ollama-api-generate:prompt_eval_duration', 'declared'),
            generationTime: metric(m.generationTimeMs, 'ms', 'ollama-api-generate:eval_duration', 'declared'),
            generationThroughput: metric(m.generationTokensPerSec, 'tokens/s', 'eval_count/eval_duration', 'estimated'),
            firstAnswerTime: metric(m.firstAnswerTimeMs, 'ms', 'browser:first-visible-answer-segment', 'measured'),
            inputTokens: metric(m.inputTokens, 'tokens', 'ollama-api-generate:prompt_eval_count', 'declared'),
            cachedInputTokens: metric(m.cachedInputTokens, 'tokens', 'ollama-api-generate:prompt_eval_cached_count', 'declared'),
            totalTime: metric(m.totalTime, 'ms', 'browser:performance.now', 'measured', 'Request duration excluding telemetry finalization'),
            totalOutputTokens: metric(m.totalTokens, 'tokens', m.tokenCountSource || 'legacy-unknown-token-count', tokenKind),
            thinkingTokens: metric(null, 'tokens', 'not-separated'), answerTokens: metric(null, 'tokens', 'not-separated'),
            averageThroughput: metric(m.tokensPerSec, 'tokens/s', 'generated-tokens/total-test-seconds', 'estimated'),
            ttft: metric(runner === 'Ollama' ? m.ttft : null, 'ms', 'browser:first-response-segment', 'measured') },
          resourceSamples: samples.sort((a,b) => a.elapsedMs - b.elapsedMs), resourceSummaries: summaries
        };
        if (r.completion) test.completion = { reason: r.completion.reason || null, limitReached: !!r.completion.limitReached, state: r.completion.state || 'unknown' };
        if (r.error) test.failureCode = 'generation-error'; // Do not leak raw error text/URLs.
        return test;
      })
    };
    reports.push(report);
  });
  return reports.length === 1 ? reports[0] : { schema: 'llm-benchmarker.community.bundle', schemaVersion: '1.0.0', reports: reports };
}

function exportCommunityJSON() {
  if (!state.results.length) { showToast('Aucun résultat à exporter', 'error'); return; }
  var report = buildCommunityV2(state.results, new Date().toISOString());
  var blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' });
  var url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = 'LLMB-community-v2-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
  link.click(); URL.revokeObjectURL(url);
  showToast('Export communautaire v2 téléchargé', 'success');
}
