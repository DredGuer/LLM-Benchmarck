async function observeLoadedModel(model, signal) {
  if (state.runner !== 'ollama') return 'unknown';
  try {
    var res = await fetchWithTimeout(RUNNERS.ollama.base + '/api/ps', { signal: signal }, 5000);
    if (!res.ok) return 'unknown';
    var data = await res.json();
    if (!Array.isArray(data.models)) return 'unknown';
    return data.models.some(m => [m.name, m.model].some(name => typeof name === 'string' && name.replace(/:latest$/, '') === model.replace(/:latest$/, ''))) ? 'warm' : 'cold';
  } catch (_) { return 'unknown'; }
}

async function promptFingerprint(text) {
  try {
    var hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  } catch (_) { return null; }
}

async function consumeOllamaStream(response, signal, onFrame) {
  if (response.ok === false) throw new Error('Ollama a refusé la génération (HTTP ' + response.status + ').');
  if (!response.body) throw new Error('Flux Ollama absent.');
  var reader = response.body.getReader(), decoder = new TextDecoder(), pending = '', completed = false;
  function frame(line) {
    if (!line.trim()) return;
    var data = JSON.parse(line);
    if (data.error) throw new Error('Ollama : ' + data.error);
    onFrame(data);
    if (data.done === true) completed = true;
  }
  try {
    while (true) {
      if (signal?.aborted) throw new Error('Test annulé');
      var chunk = await reader.read();
      if (chunk.done) { pending += decoder.decode(); if (pending.trim()) frame(pending); break; }
      pending += decoder.decode(chunk.value, { stream: true });
      if (pending.length > 4 * 1024 * 1024) throw new Error('Ligne Ollama trop volumineuse.');
      var lines = pending.split('\n'); pending = lines.pop(); lines.forEach(frame);
    }
    if (!completed) throw new Error('Flux Ollama incomplet : confirmation finale absente.');
  } finally {
    if (!completed && reader.cancel) { try { await reader.cancel(); } catch (_) {} }
    if (reader.releaseLock) reader.releaseLock();
  }
}

function resetCampaignResults() {
  if (state.controlledActive && state.controlledAppend) return;
  state.results = [];
  var agenticLivePanel = document.getElementById('agenticLive'); if (agenticLivePanel) agenticLivePanel.hidden = true;
  var list = document.getElementById('resultsList');
  if (list) list.textContent = '';
  showResultsArea(false);
  var button = document.getElementById('exportBtn'); if (button) button.disabled = true;
  resetLiveOutput();
}

function lockCampaignControls(lock) {
  var elements = Array.from(document.querySelectorAll('.runner-btn, #agenticEnabled, #agenticScenarios input, #modelSelect, #modelCustom, #manualModeToggle, #temperature, #maxTokens, #repetitions, #customPromptText, #qualityEnabled, #controlledEnabled, #controlledContextA, #controlledContextB, #customTemp, #batchStart, #batchModels input, #batchContinueErrors, #selectedGPU, #hardwareModal input, #hardwareModal button, #hardwareModal select, #advancedConfigModal input, #advancedConfigModal button, .sidebar button:not([data-batch-available])'));
  if ((state.controlledActive || state.batchActive) && !lock) return;
  if (lock) {
    if (window.campaignControls?.length) return;
    window.campaignControls = elements.map(el => [el, el.disabled]);
    elements.forEach(el => { el.disabled = true; });
  } else {
    (window.campaignControls || []).forEach(pair => { pair[0].disabled = pair[1]; });
    window.campaignControls = [];
  }
}

function classifyCompletion(reason, count, limit, kind) {
  var limited = ['length','max_tokens','MAX_TOKENS'].includes(reason);
  var suspected = !limited && kind === 'declared' && count >= limit;
  return { reason: reason || null, limitReached: limited || suspected,
    state: limited ? 'truncated' : suspected ? 'possibly-truncated' : ['stop','end_turn','stop_sequence','STOP','eos'].includes(reason) ? 'completed' : 'unknown' };
}

async function loadedModelSnapshot(model) {
  if (state.runner !== 'ollama') return null;
  try {
    var res = await fetchWithTimeout(RUNNERS.ollama.base + '/api/ps', {}, 5000);
    if (!res.ok) return null;
    var data = await res.json(), item = (data.models || []).find(m => [m.name,m.model].some(n => typeof n === 'string' && n.replace(/:latest$/, '') === model.replace(/:latest$/, '')));
    return item && Number.isFinite(item.size) && item.size >= 0 ? {sizeBytes:item.size,source:'ollama-api-ps',observedAt:Date.now()} : null;
  } catch (_) { return null; }
}
function updateCampaignPlan() {
  var el = document.getElementById('campaignPlan');if(!el)return;
  var agentic = typeof agenticEnabled === 'function' && agenticEnabled();
  var count = typeof campaignPromptTypes === 'function' ? campaignPromptTypes().length : state.selectedPrompts.size, reps = getRepetitions();
  if (typeof controlledEnabled === 'function' && controlledEnabled()) {
    el.textContent = 'Campagne contrôlée : '+count+' cas de génération + '+(agentic ? selectedAgenticScenarios().length : 0)+' épreuves agentiques × 3 répétitions × 2 contextes ; température 0, chauffe à chaque contexte, cache non réinitialisé. Contextes demandés : '+document.getElementById('controlledContextA').value+' / '+document.getElementById('controlledContextB').value+' tokens. Les mesures sans contexte vérifié sont exclues des comparaisons.'; return;
  }
  if (agentic) { var tasks=selectedAgenticScenarios().length; el.textContent = count+' catégorie(s) de génération + '+tasks+' épreuve(s) agentique(s) × '+reps+' répétition(s) = '+(count+tasks)*reps+' mesures + chauffe séparée. Chaque épreuve : 12 tours, 24 appels, 4 minutes ; '+getMaxTokens()+' tokens de sortie cumulés. Plusieurs répétitions fiabilisent les taux.'; return; }
  el.textContent = count+' catégorie(s) × '+reps+' répétition(s) = '+count*reps+' mesure(s)'+(RUNNERS[state.runner]?.type === 'local' ? ' + chauffe séparée' : '')+'. Limite : '+getMaxTokens()+' tokens par réponse.';
}
