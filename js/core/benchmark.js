/**
 * LLM Benchmarker - Benchmark Engine
 */

async function runBenchmark() {
  if (document.getElementById('benchmarkMode')?.value === 'agentic') return runAgenticBenchmark();
  if (state.isRunning || state.analysisRunning) return;
  if (!state.selectedPrompts.size) { showToast('Sélectionnez un type de prompt', 'error'); return; }
  var model = getSelectedModel();
  if (!model || model === 'unknown-model') { showToast('Veuillez sélectionner un modèle', 'error'); return; }
  var repetitions = getRepetitions();
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 20) { showToast('Choisissez de 1 à 20 répétitions.', 'error'); return; }
  if (state.unsavedSession && saveSessionToHistory(state.unsavedSession) === false) return;
  state.unsavedSession = null;
  var runner = state.runner, sessionResults = [], warmupRuns = 0, completedTests = 0;
  var runBtn = document.getElementById('runBtn'), progressSection = document.getElementById('progressSection');
  var selectedTypes = PROMPT_TYPES.filter(pt => state.selectedPrompts.has(pt.id));
  var totalTests = selectedTypes.length * repetitions;
  var activeType = selectedTypes[0], activePrompt = '', activeRep = 1, activePhase = 'measurement';
  state.isRunning = true; resetCampaignResults(); switchTab('results'); lockCampaignControls(true);
  runBtn.disabled = true; runBtn.innerHTML = '<div class="spinner"></div> Chargement / chauffe…';
  progressSection.style.display = 'block'; skipToNextFlag = false; retryCurrentFlag = false;
  function remember(result) { sessionResults.push(result); state.results.unshift(result); renderResultCard(result); }
  async function warmup() {
    activeType = { id: 'warmup', name: 'Chargement / chauffe', emoji: '🔥' };
    activePrompt = 'Réponds uniquement par OK.'; activeRep = 1; activePhase = 'warmup';
    setProgress(0, 'Vérification du modèle et chauffe mesurée…');
    currentAbortController = new AbortController(); showLiveSections(true); setControlButtons(true, true);
    var loadState = await observeLoadedModel(model, currentAbortController.signal);
    var result = await executeTest(model, activeType, activePrompt, 1, currentAbortController.signal,
      { warmup: true, loadState: loadState, warmupRuns: warmupRuns });
    if (!result.metrics.totalTokens && !result.response) throw new Error('Le modèle n’a généré aucun token pendant la chauffe.');
    remember(result); warmupRuns++;
    if (runner === 'ollama' && await observeLoadedModel(model, currentAbortController.signal) === 'cold')
      throw new Error('Le modèle ne reste pas chargé après la chauffe.');
  }
  try {
    await refreshModelMetadata();
    state.runnerVersion = null;
    if (runner === "ollama") {
      try { var v = await fetchWithTimeout(RUNNERS.ollama.base + "/api/version", {}, 5000);
        if (v.ok) { var data = await v.json(); state.runnerVersion = typeof data.version === "string" ? data.version : null; }
      } catch (_) {}
    }
    if (RUNNERS[runner].type === 'local') await warmup();
    for (var i = 0; i < selectedTypes.length; i++) {
      for (var rep = 1; rep <= repetitions; rep++) {
        activeType = selectedTypes[i]; activeRep = rep; activePhase = 'measurement';
        activePrompt = activeType.id === 'custom' ? (document.getElementById('customPromptText').value.trim() || 'Dis bonjour.') : activeType.prompt;
        skipToNextFlag = false; retryCurrentFlag = false;
        currentAbortController = new AbortController();
        var loadState = await observeLoadedModel(model, currentAbortController.signal);
        if (runner === 'ollama' && loadState === 'cold') {
          await warmup();
          activeType = selectedTypes[i]; activeRep = rep; activePhase = 'measurement';
          activePrompt = activeType.id === 'custom' ? (document.getElementById('customPromptText').value.trim() || 'Dis bonjour.') : activeType.prompt;
          loadState = await observeLoadedModel(model, currentAbortController.signal);
        }
        setProgress(completedTests / totalTests * 100, activeType.name + ' · ' + rep + '/' + repetitions);
        runBtn.innerHTML = '<div class="spinner"></div> Mesures après chauffe…';
        showLiveSections(true); setControlButtons(true);
        try {
          var result = await executeTest(model, activeType, activePrompt, rep, currentAbortController.signal,
            { loadState: loadState, warmupRuns: warmupRuns });
          if (retryCurrentFlag) { rep--; continue; }
          remember(result); completedTests++;
          if (skipToNextFlag) break;
        } catch (error) {
          if (retryCurrentFlag) { rep--; continue; }
          if (skipToNextFlag) break;
          throw error;
        }
      }
    }
    setProgress(100, 'Terminé : chauffe séparée et ' + completedTests + ' mesure(s)');
    showToast('Campagne terminée : ' + completedTests + ' mesure(s)', 'success');
  } catch (error) {
    var failed = buildErrorResult(model, activeType, error.message, activeRep);
    failed.phase = activePhase; failed.promptText = activePrompt;
    remember(failed); showToast(error.message, 'error');
  } finally {
    if (sessionResults.length) {
      var session = { model: model, runner: runner, results: sessionResults,
        env: JSON.parse(JSON.stringify(state.env)), repetitions: repetitions, warmupRuns: warmupRuns };
      if (saveSessionToHistory(session) === false) state.unsavedSession = session;
    }
    document.getElementById('exportBtn').disabled = !state.results.length;
    currentAbortController = null; showLiveSections(false); setControlButtons(false);
    progressSection.style.display = 'none'; runBtn.disabled = false; runBtn.innerHTML = '⚡ Lancer le benchmark';
    state.isRunning = false; skipToNextFlag = false; retryCurrentFlag = false; lockCampaignControls(false);
    if (typeof renderStatistics === 'function') renderStatistics();
  }
}

async function executeTest(model, promptType, promptText, rep, signal, protocol) {
  // Use advanced config functions to get settings based on mode
  protocol = protocol || {};
  var temperature = protocol.warmup ? 0 : getTemperatureForPromptType(promptType.id);
  var maxTokens = protocol.warmup ? 32 : getMaxTokens();
  var fingerprint = await promptFingerprint(promptText);
  var contextTokens = getRequestedContextTokens();
  var modelMetadata = state.modelMetadata && state.modelMetadata.model === model ? Object.assign({}, state.modelMetadata) : null;
  var loadedBefore = await loadedModelSnapshot(model);
  if (state.runner === 'ollama') await ollamaMemoryMonitor.startResources();
  try {
  var testStartedAt = new Date().toISOString();
  var t0 = performance.now();
  var firstTokenTime = null, fullText = '', tokensGenerated = 0;
  var memoryStats = null;
  var tokenCountSource = 'stream-chunk-count', tokenCountKind = 'estimated';
  var ollamaTiming = {}, cachedTokens = null, inputTokens = null, finishReason = null, thinkingObserved = false, firstAnswerTime = null;
  currentTestState = { model: model, promptType: promptType, promptText: promptText, maxTokens: maxTokens, tokensReceived: 0, isStreaming: false, startTime: Date.now(), logs: [] };
  resetLiveOutput(); 
  showLiveSections(true); 
  setControlButtons(true);
  if (protocol.warmup && document.getElementById('benchmarkMode')?.value === 'agentic') {
    document.getElementById('nextBtn').disabled = true; document.getElementById('retryBtn').disabled = true;
  }
  addDebugLog('Démarrage du test: ' + model + ' - ' + promptType.name, 'info');
  addDebugLog('Config: temp=' + temperature + ', max_tokens=' + maxTokens, 'info');
  
  addDebugLog(modelArchitectureText(modelMetadata) + ' ; contexte demandé : ' + (contextTokens ?? 'réglage du runner') +
    ' ; maximum déclaré : ' + (modelMetadata?.contextMaxTokens ?? 'inconnu'), 'info');

  // Start memory monitoring for local runners (Ollama)
  if (state.runner === 'ollama') {
    ollamaMemoryMonitor.start(model);
  }

  if (state.runner === 'ollama') {
    currentTestState.isStreaming = true;
    try {
      var res = await fetchWithTimeout(RUNNERS.ollama.base + '/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model, prompt: promptText, stream: true, keep_alive: '10m', ...(protocol.warmup ? { think: false } : {}), options: buildOllamaOptions(temperature, maxTokens, contextTokens) }),
        signal: signal
      }, 180000); // 3 minutes pour les modèles lourds (>30B)
      await consumeOllamaStream(res, signal, function(json) {
        var segment = json.response || json.thinking;
        if (json.thinking) thinkingObserved = true;
        if (segment) {
          var arrival = firstTokenTime === null || (json.response && firstAnswerTime === null) ? performance.now() - t0 : null;
          if (json.response && firstAnswerTime === null) firstAnswerTime = arrival;
          if (firstTokenTime === null) firstTokenTime = arrival;
          if (json.response) fullText += json.response;
          updateThinkingOutput(segment); tokensGenerated++;
          currentTestState.tokensReceived = tokensGenerated; updateTokenProgress(tokensGenerated, maxTokens);
        }
        if (json.done) {
          if (Number.isInteger(json.eval_count) && json.eval_count >= 0) {
            tokensGenerated = json.eval_count; tokenCountSource = 'ollama-api-generate:eval_count'; tokenCountKind = 'declared';
          }
          finishReason = typeof json.done_reason === "string" ? json.done_reason : null;
          inputTokens = Number.isInteger(json.prompt_eval_count) && json.prompt_eval_count >= 0 ? json.prompt_eval_count : null;
          cachedTokens = Number.isInteger(json.prompt_eval_cached_count) && json.prompt_eval_cached_count >= 0 ? json.prompt_eval_cached_count : null;
          ['load_duration', 'prompt_eval_duration', 'eval_duration'].forEach(function(key) {
            ollamaTiming[key] = Number.isFinite(json[key]) && json[key] >= 0 ? json[key] / 1e6 : null;
          });
          currentTestState.tokensReceived = tokensGenerated; updateTokenProgress(tokensGenerated, maxTokens);
        }
      });
      addDebugLog('Stream terminé - Tokens totaux: ' + tokensGenerated, 'info');
    } catch (err) {
      if (err.name === 'AbortError') { 
        addDebugLog('Requête annulée', 'warn'); 
        throw new Error('Test annulé par l utilisateur'); 
      }
      throw err;
    } finally { 
      currentTestState.isStreaming = false; 
    }
  } else {
    // Non-streaming runners
    var base, endpoint, body, headers = { 'Content-Type': 'application/json' };
    
    if (state.runner === 'lmstudio' || state.runner === 'llamacpp') {
      base = state.runner === 'lmstudio' ? RUNNERS.lmstudio.base : RUNNERS.llamacpp.base;
      endpoint = '/v1/chat/completions';
      body = { model: model, messages: [{ role: 'user', content: promptText }], temperature: temperature, max_tokens: maxTokens, stream: false };
    } else if (state.runner === 'openai') {
      var key = state.apiKeys.openai;
      if (!key) throw new Error('Clé API OpenAI manquante');
      base = 'https://api.openai.com';
      endpoint = '/v1/chat/completions';
      headers.Authorization = 'Bearer ' + key;
      body = { model: model, messages: [{ role: 'user', content: promptText }], temperature: temperature, max_tokens: maxTokens, stream: false };
    } else if (state.runner === 'mistral') {
      var key = state.apiKeys.mistral;
      if (!key) throw new Error('Clé API Mistral manquante');
      base = 'https://api.mistral.ai';
      endpoint = '/v1/chat/completions';
      headers.Authorization = 'Bearer ' + key;
      body = { model: model, messages: [{ role: 'user', content: promptText }], temperature: temperature, max_tokens: maxTokens };
    } else if (state.runner === 'claude') {
      var key = state.apiKeys.claude;
      if (!key) throw new Error('Clé API Claude manquante');
      base = 'https://api.anthropic.com';
      endpoint = '/v1/messages';
      headers['x-api-key'] = key;
      headers['anthropic-version'] = '2023-06-01';
      body = { model: model, max_tokens: maxTokens, messages: [{ role: 'user', content: promptText }] };
    } else if (state.runner === 'gemini') {
      var key = state.apiKeys.gemini;
      if (!key) throw new Error('Clé API Gemini manquante');
      base = 'https://generativelanguage.googleapis.com';
      endpoint = '/v1beta/models/' + model + ':generateContent';
      headers['x-goog-api-key'] = key;
      headers['Content-Type'] = 'application/json';
      body = { contents: [{ parts: [{ text: promptText }] }], generationConfig: { temperature: temperature, maxOutputTokens: maxTokens } };
    } else if (state.runner === 'custom') {
      base = state.customBase || 'http://localhost:8080';
      endpoint = '/v1/chat/completions';
      body = { model: model, messages: [{ role: 'user', content: promptText }], temperature: temperature, max_tokens: maxTokens, stream: false };
    }
    
    if (base && endpoint && body) {
      addDebugLog('Envoi requête à ' + base + endpoint, 'info');
      var res = await fetchWithTimeout(base + endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
        signal: signal
      }, 60000);
      var data = await res.json();
      
      if (data.error) {
        throw new Error(data.error.message || JSON.stringify(data.error));
      }
      
      // Extract response based on API format
      if (state.runner === 'claude') {
        fullText = data.content && data.content[0] && data.content[0].text ? data.content[0].text : '';
        tokensGenerated = data.usage && data.usage.output_tokens ? data.usage.output_tokens : estimateTokens(fullText);
      } else if (state.runner === 'gemini') {
        fullText = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text ? data.candidates[0].content.parts[0].text : '';
        tokensGenerated = data.usageMetadata && data.usageMetadata.outputTokenCount ? data.usageMetadata.outputTokenCount : estimateTokens(fullText);
      } else {
        fullText = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content ? data.choices[0].message.content : '';
        tokensGenerated = data.usage && data.usage.completion_tokens ? data.usage.completion_tokens : estimateTokens(fullText);
      }
      finishReason = state.runner === "claude" ? data.stop_reason : state.runner === "gemini" ? data.candidates?.[0]?.finishReason : data.choices?.[0]?.finish_reason;
      finishReason = typeof finishReason === "string" ? finishReason : null;
      var hasUsage = state.runner === 'claude' ? data.usage?.output_tokens != null :
        state.runner === 'gemini' ? data.usageMetadata?.outputTokenCount != null : data.usage?.completion_tokens != null;
      tokenCountSource = hasUsage ? 'provider:output-token-usage' : 'text-token-estimate';
      tokenCountKind = hasUsage ? 'declared' : 'estimated';
      firstTokenTime = 0;
      updateThinkingOutput(fullText);
      updateTokenProgress(tokensGenerated, maxTokens);
      addDebugLog('Réponse reçue: ' + tokensGenerated + ' tokens', 'success');
    }
  }
  
  var generationTotalTime = performance.now() - t0;
  var testFinishedAt = new Date().toISOString();
  if (state.runner === 'ollama') memoryStats = ollamaMemoryMonitor.stop();
  // Capture the last loaded runner context and resource sample after the stream closes.
  if (state.runner === 'ollama') {
    await ollamaMemoryMonitor._fetchLoadedModel(ollamaMemoryMonitor.generation, true);
    if (ollamaMemoryMonitor.resourcesPending) await ollamaMemoryMonitor.resourcesPending;
    // Ollama emits its MLX memory line just after completing the response.
    await new Promise(resolve => setTimeout(resolve, 150));
    await ollamaMemoryMonitor.pollResources(true);
  }

  // Stop memory monitoring for Ollama
  if (state.runner === 'ollama') {
    memoryStats.loadedModel = ollamaMemoryMonitor.loadedModel;
    memoryStats.resources = ollamaMemoryMonitor.resources;
    if (memoryStats.peakMemory) {
      addDebugLog('RAM pic: ' + memoryStats.peakMemory + ' MB', 'info');
    } else {
      addDebugLog('Monitoring RAM : API non disponible. Utilisez Chrome avec --enable-precision-memory-info', 'warn');
    }
  }
  
  var totalTime = generationTotalTime;
  var tokensPerSec = tokensGenerated > 0 ? (tokensGenerated / (totalTime / 1000)) : 0;
  var ttft = firstTokenTime !== null ? firstTokenTime : null;
  
  // Build result object
  var result = {
    id: crypto.randomUUID(),
    timestamp: testFinishedAt,
    startedAt: testStartedAt,
    finishedAt: testFinishedAt,
    phase: protocol.warmup ? 'warmup' : 'measurement',
    protocol: { version: '0.08', phase: protocol.warmup ? 'warmup' : 'measurement', promptDigest: fingerprint,
      warmupRuns: protocol.warmupRuns || 0, loadState: protocol.loadState || 'unknown',
      cacheState: cachedTokens === null ? 'unknown' : cachedTokens > 0 ? 'present-coverage-unknown' : 'cold', cachePolicy: 'runner-managed; persistent model; no forced cache reset' },
    completion: classifyCompletion(finishReason, tokensGenerated, maxTokens, tokenCountKind),
    runnerVersion: state.runnerVersion || null,
    model: model,
    modelMetadata: modelMetadata,
    runner: RUNNERS[state.runner].name,
    promptType: promptType.id,
    promptTypeName: promptType.name,
    promptEmoji: promptType.emoji,
    promptText: promptText,
    response: fullText,
    metrics: {
      loadTimeMs: ollamaTiming.load_duration ?? null,
      prefillTimeMs: ollamaTiming.prompt_eval_duration ?? null,
      generationTimeMs: ollamaTiming.eval_duration ?? null,
      cachedInputTokens: cachedTokens,
      inputTokens: inputTokens,
      firstAnswerTimeMs: firstAnswerTime,
      thinkingObserved: thinkingObserved,
      generationTokensPerSec: ollamaTiming.eval_duration > 0 ? tokensGenerated / (ollamaTiming.eval_duration / 1000) : null,
      totalTokens: tokensGenerated,
      tokenCountSource: tokenCountSource,
      tokenCountKind: tokenCountKind,
      thinkingEnabled: protocol.warmup ? false : null,
      tokensPerSec: Math.round(tokensPerSec * 10) / 10,
      ttft: ttft !== null ? Math.round(ttft) : null,
      totalTime: Math.round(totalTime),
      temperature: temperature,
      maxTokens: maxTokens,
      contextRequestedTokens: contextTokens,
      contextMode: 'auto',
      contextObservedTokens: memoryStats?.loadedModel?.contextTokens ?? null
    },
    env: JSON.parse(JSON.stringify(state.env)),
    rep: rep,
    error: null
  };
  
  // Add memory stats for Ollama
  if (state.runner === 'ollama' && memoryStats) {
    result.memory = {
      peak: memoryStats.peakMemory || null,
      average: memoryStats.averageMemory || null,
      source: memoryStats.source,
      unit: 'MiB',
      sampleCount: memoryStats.readings.length,
      readings: memoryStats.readings.map(r => ({ timestamp: r.timestamp, memory: r.memory })),
      intervalMs: window.MEMORY_MONITOR_CONFIG.pollInterval,
      loadedModelBefore: loadedBefore,
      loadedModel: memoryStats.loadedModel,
      resources: memoryStats.resources
    };
  }
  
  return result;
  } finally {
    if (state.runner === 'ollama') {
      if (ollamaMemoryMonitor.isActive) ollamaMemoryMonitor.stop();
      await ollamaMemoryMonitor.cancelResources();
    }
  }
}

function buildErrorResult(model, promptType, errorMsg, rep) {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    model: model,
    runner: RUNNERS[state.runner] ? RUNNERS[state.runner].name : state.runner,
    promptType: promptType.id,
    promptTypeName: promptType.name,
    promptEmoji: promptType.emoji,
    promptText: promptType.prompt || '',
    response: '',
    metrics: { totalTokens: 0, tokensPerSec: 0, ttft: null, totalTime: 0 },
    env: state.env,
    rep: rep,
    error: errorMsg
  };
}

function setProgress(percent, detail) {
  var bar = document.getElementById('progressBar');
  var statusText = document.getElementById('statusText');
  var progressDetail = document.getElementById('progressDetail');
  if (bar) bar.style.width = percent + '%';
  if (statusText) statusText.textContent = detail;
  if (progressDetail) progressDetail.textContent = Math.round(percent) + '% complété';
}
