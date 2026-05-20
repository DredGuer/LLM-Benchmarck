/**
 * LLM Benchmarker - Benchmark Engine
 */

async function runBenchmark() {
  if (state.isRunning) return;
  if (state.selectedPrompts.size === 0) { showToast('Sélectionnez au moins un type de prompt', 'error'); return; }
  var model = getSelectedModel();
  if (!model || model === 'unknown-model') { showToast('Veuillez sélectionner un modèle', 'error'); return; }

  state.isRunning = true;
  var runBtn = document.getElementById('runBtn');
  runBtn.disabled = true;
  runBtn.innerHTML = '<div class="spinner"></div> Benchmark en cours…';
  var progressSection = document.getElementById('progressSection');
  progressSection.style.display = 'block';
  
  var selectedTypes = PROMPT_TYPES.filter(function(pt) { return state.selectedPrompts.has(pt.id); });
  var repetitions = parseInt(document.getElementById('repetitions').value) || 1;
  var totalTests = selectedTypes.length * repetitions;
  var completedTests = 0;
  var sessionResults = [];
  skipToNextFlag = false;
  retryCurrentFlag = false;
  
  showResultsArea(true);
  showLiveSections(false);
  setControlButtons(false);

  for (var i = 0; i < selectedTypes.length; i++) {
    var pt = selectedTypes[i];
    skipToNextFlag = false;
    for (var rep = 0; rep < repetitions; rep++) {
      retryCurrentFlag = false;
      var progress = (completedTests / totalTests) * 100;
      setProgress(progress, 'Test : ' + pt.name + (repetitions > 1 ? ' (' + (rep+1) + '/' + repetitions + ')' : ''));
      var promptText = pt.id === 'custom' ? (document.getElementById('customPromptText').value.trim() || 'Dis bonjour.') : pt.prompt;
      var abortController = new AbortController();
      currentAbortController = abortController;
      try {
        showLiveSections(true); 
        setControlButtons(true);
        var result = await executeTest(model, pt, promptText, rep + 1, abortController.signal);
        if (skipToNextFlag) { addDebugLog('Test ' + pt.name + ' interrompu - Passage au suivant', 'warn'); skipToNextFlag = false; break; }
        if (retryCurrentFlag) { addDebugLog('Test ' + pt.name + ' - Relance demandée', 'info'); retryCurrentFlag = false; rep--; continue; }
        sessionResults.push(result); 
        state.results.unshift(result); 
        renderResultCard(result); 
        completedTests++;
      } catch (err) {
        showLiveSections(false); 
        setControlButtons(false);
        var errResult = buildErrorResult(model, pt, err.message, rep + 1);
        errResult.debugLogs = currentTestState.logs.slice(0);
        errResult.tokensReceived = currentTestState.tokensReceived;
        sessionResults.push(errResult); 
        state.results.unshift(errResult); 
        renderResultCard(errResult); 
        completedTests++;
        currentAbortController = null;
        if (skipToNextFlag) { skipToNextFlag = false; break; }
        if (retryCurrentFlag) { retryCurrentFlag = false; rep--; continue; }
        return;
      }
      showLiveSections(false); 
      setControlButtons(false); 
      currentAbortController = null;
    }
  }
  setProgress(100, 'Terminé !');
  document.getElementById('statusDot').className = 'status-dot done';
  showLiveSections(false); 
  setControlButtons(false); 
  currentAbortController = null;
  saveSessionToHistory({ model: model, runner: state.runner, results: sessionResults, env: state.env });
  document.getElementById('exportBtn').disabled = false;
  setTimeout(function() { 
    progressSection.style.display = 'none'; 
    runBtn.disabled = false; 
    runBtn.innerHTML = '⚡ Lancer le benchmark'; 
    state.isRunning = false; 
    skipToNextFlag = false; 
    retryCurrentFlag = false; 
  }, 1500);
  showToast('Benchmark terminé : ' + completedTests + ' test(s)', 'success');
}

async function executeTest(model, promptType, promptText, rep, signal) {
  var temperature = parseFloat(document.getElementById('temperature').value) || 0.7;
  var maxTokens = parseInt(document.getElementById('maxTokens').value) || 512;
  var t0 = performance.now();
  var firstTokenTime = null, fullText = '', tokensGenerated = 0;
  var memoryStats = null;
  currentTestState = { model: model, promptType: promptType, promptText: promptText, maxTokens: maxTokens, tokensReceived: 0, isStreaming: false, startTime: Date.now(), logs: [] };
  resetLiveOutput(); 
  showLiveSections(true); 
  setControlButtons(true);
  addDebugLog('Démarrage du test: ' + model + ' - ' + promptType.name, 'info');
  addDebugLog('Config: temp=' + temperature + ', max_tokens=' + maxTokens, 'info');
  
  // Start memory monitoring for Ollama (local only)
  if (state.runner === 'ollama') {
    var pid = await ollamaMemoryMonitor.getOllamaPID();
    if (pid) {
      addDebugLog('Monitoring RAM - PID Ollama: ' + pid, 'info');
      ollamaMemoryMonitor.start(pid);
    } else {
      addDebugLog('PID Ollama non trouvé, monitoring RAM limité', 'warn');
    }
  }

  if (state.runner === 'ollama') {
    currentTestState.isStreaming = true;
    try {
      var res = await fetchWithTimeout(RUNNERS.ollama.base + '/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model, prompt: promptText, stream: true, options: { temperature: temperature, num_predict: maxTokens } }),
        signal: signal
      }, 60000);
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      while (true) {
        if (signal && signal.aborted) { addDebugLog('Test annulé par l utilisateur', 'warn'); throw new Error('Test annulé'); }
        var result = await reader.read();
        if (result.done) break;
        var chunk = decoder.decode(result.value);
        var lines = chunk.split('\n').filter(function(l) { return l.trim() !== ''; });
        for (var j = 0; j < lines.length; j++) {
          try {
            var json = JSON.parse(lines[j]);
            if (json.response) {
              if (firstTokenTime === null) { 
                firstTokenTime = performance.now() - t0; 
                addDebugLog('Premier token reçu (TTFT: ' + Math.round(firstTokenTime) + 'ms)', 'success'); 
              }
              fullText += json.response; 
              updateThinkingOutput(json.response);
              tokensGenerated++; 
              currentTestState.tokensReceived = tokensGenerated; 
              updateTokenProgress(tokensGenerated, maxTokens);
            }
            if (json.done && json.eval_count) { 
              tokensGenerated = json.eval_count; 
              currentTestState.tokensReceived = tokensGenerated; 
              updateTokenProgress(tokensGenerated, maxTokens); 
            }
            if (json.done && tokensGenerated >= maxTokens) {
              addDebugLog('Limite de tokens atteinte: ' + tokensGenerated + '/' + maxTokens, 'warn');
            }
          } catch(e) { addDebugLog('Erreur parsing JSON: ' + e.message, 'error'); }
        }
      }
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
      firstTokenTime = 0;
      updateThinkingOutput(fullText);
      updateTokenProgress(tokensGenerated, maxTokens);
      addDebugLog('Réponse reçue: ' + tokensGenerated + ' tokens', 'success');
    }
  }
  
  // Stop memory monitoring for Ollama
  if (state.runner === 'ollama') {
    memoryStats = ollamaMemoryMonitor.stop();
    addDebugLog('RAM pic: ' + memoryStats.peakMemory + ' MB', 'info');
  }
  
  var totalTime = performance.now() - t0;
  var tokensPerSec = tokensGenerated > 0 ? (tokensGenerated / (totalTime / 1000)) : 0;
  var ttft = firstTokenTime !== null ? firstTokenTime : null;
  
  // Build result object
  var result = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    model: model,
    runner: RUNNERS[state.runner].name,
    promptType: promptType.id,
    promptTypeName: promptType.name,
    promptEmoji: promptType.emoji,
    promptText: promptText,
    response: fullText,
    metrics: {
      totalTokens: tokensGenerated,
      tokensPerSec: Math.round(tokensPerSec * 10) / 10,
      ttft: ttft !== null ? Math.round(ttft) : null,
      totalTime: Math.round(totalTime),
      temperature: temperature,
      maxTokens: maxTokens
    },
    env: state.env,
    rep: rep,
    error: null
  };
  
  // Add memory stats for Ollama
  if (memoryStats && memoryStats.peakMemory > 0) {
    result.memory = {
      peak: memoryStats.peakMemory,
      average: memoryStats.averageMemory
    };
  }
  
  return result;
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
