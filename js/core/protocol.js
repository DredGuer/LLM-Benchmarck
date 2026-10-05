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
  state.results = [];
  var list = document.getElementById('resultsList');
  if (list) list.textContent = '';
  showResultsArea(false);
  var button = document.getElementById('exportBtn'); if (button) button.disabled = true;
  resetLiveOutput();
}

function lockCampaignControls(lock) {
  var elements = Array.from(document.querySelectorAll('.runner-btn, #modelSelect, #modelCustom, #manualModeToggle, #temperature, #maxTokens, #repetitions, #customPromptText'));
  if (lock) {
    window.campaignControls = elements.map(el => [el, el.disabled]);
    elements.forEach(el => { el.disabled = true; });
  } else {
    (window.campaignControls || []).forEach(pair => { pair[0].disabled = pair[1]; });
    window.campaignControls = [];
  }
}
