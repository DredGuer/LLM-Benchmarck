// Sequential Ollama campaigns. Each model uses the existing benchmark engine.
var exportSessionToken = null;
function exportBackendBase() {
  var base = window.MEMORY_MONITOR_CONFIG?.backendUrl || 'http://localhost:3001';
  var url = new URL(base);
  if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password) throw new Error('Les exports exigent un backend local.');
  return url.origin;
}
async function prepareLocalExports() {
  var response = await fetchWithTimeout(exportBackendBase() + '/api/exports/session', {}, 10000);
  if (!response.ok) throw new Error('Redémarrez le backend à jour avec npm start pour créer les exports locaux.');
  var data = await response.json();
  if (data.version !== '1.0.0' || !/^[a-f0-9]{64}$/.test(data.token)) throw new Error('Service d’export incompatible.');
  exportSessionToken = data.token;
}
async function localExportRequest(action, payload) {
  if (!exportSessionToken) await prepareLocalExports();
  var options = { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-LLMB-Export-Token': exportSessionToken }, body: JSON.stringify(payload || {}) };
  var response = await fetchWithTimeout(exportBackendBase() + '/api/exports/' + action, options, 60000);
  if (response.status === 403) { await prepareLocalExports(); options.headers['X-LLMB-Export-Token'] = exportSessionToken; response = await fetchWithTimeout(exportBackendBase() + '/api/exports/' + action, options, 60000); }
  if (!response.ok) throw new Error(action === 'open' ? 'Ouverture automatique indisponible. Ouvrez le dossier export à la racine du projet.' : 'Export local non sauvegardé. La file est arrêtée ; utilisez « Récupérer les exports » pour réessayer.');
  return response.json();
}
async function recoverLocalExports() {
  try {
    if (state.pendingLocalExport && !state.batchActive) { await localExportRequest('save', state.pendingLocalExport); state.pendingLocalExport = null; showToast('Export sauvegardé. Vous pouvez relancer une campagne.', 'success'); }
    await localExportRequest('open');
  } catch (error) { showToast(error.message, 'error'); }
}
function renderBatchModels(models) {
  var list = document.getElementById('batchModels'); if (!list || state.batchActive) return;
  state.availableBatchModels = models.slice();
  var selected = new Set(state.desiredBatchModels || Array.from(list.querySelectorAll('input:checked')).map(el => el.value));
  state.missingBatchModels = Array.from(selected).filter(m => !models.includes(m));
  list.textContent = '';
  if (state.runner !== 'ollama') { list.textContent = 'Le mode multi-modèles est disponible pour Ollama.'; return; }
  models.forEach(model => {
    var label = document.createElement('label'), input = document.createElement('input');
    input.type = 'checkbox'; input.value = model; input.checked = selected.has(model); input.setAttribute('data-batch-model', '');
    input.addEventListener('change', function(){ state.desiredBatchModels = null; state.missingBatchModels = []; updateBatchSelection(true); });
    label.append(input, document.createTextNode(' ' + model)); list.appendChild(label);
  });
  if (state.missingBatchModels.length) { var warning=document.createElement('p');warning.textContent='Modèles du profil indisponibles : '+state.missingBatchModels.join(', ');list.appendChild(warning); }
  if (typeof updateBatchSelection === 'function') updateBatchSelection(false);
  if (!models.length) list.textContent = 'Aucun modèle disponible. Lancez Ollama et rafraîchissez la liste.';
}
function updateBatchSelection(preview) {
  var models=Array.from(document.querySelectorAll('#batchModels input:checked')).map(el=>el.value),count=document.getElementById('batchSelectionCount');
  if(count)count.textContent=models.length+' modèle(s) sélectionné(s)'+(state.missingBatchModels?.length?' · '+state.missingBatchModels.length+' indisponible(s)':'');
  var button=document.getElementById('runBtn');if(button&&!state.batchActive&&!state.isRunning)button.textContent=state.interfaceMode==='pro'&&models.length&&state.runner==='ollama'?'⚡ Lancer '+models.length+' modèle(s)':'⚡ Lancer le benchmark';
  if(preview&&models.length){document.getElementById('modelSelect').value=models[0];document.getElementById('modelCustom').value='';refreshModelMetadata();}
}
function renderBatchQueue() {
  var list = document.getElementById('batchQueue'); if (!list) return;
  list.textContent = '';
  (state.batchQueue || []).forEach((entry, index) => {
    var li = document.createElement('li'); li.textContent = (index + 1) + '. ' + entry.model + ' — ' + entry.status;
    list.appendChild(li);
  });
}
function requestBatchStop(immediate) {
  if (!state.batchActive) return;
  state.batchStop = true;
  if (immediate) { state.batchAbort = true; currentAbortController?.abort(); }
  showToast(immediate ? 'Arrêt demandé ; conservation des résultats partiels puis déchargement.' : 'Arrêt après le modèle en cours.', 'info');
}
async function unloadBatchModel(model) {
  return unloadOllamaModel(model);
}
async function runBatchCampaign(explicitModels) {
  if (state.batchActive || state.isRunning || state.analysisRunning) return;
  if (state.pendingLocalExport) { showToast('Sauvegardez d’abord l’export en attente avec « Récupérer les exports ».', 'error'); return; }
  var models = Array.isArray(explicitModels) ? explicitModels.slice() : Array.from(document.querySelectorAll('#batchModels input:checked')).map(el => el.value);
  if (!explicitModels && state.missingBatchModels?.length) { showToast('Modèles du profil indisponibles : '+state.missingBatchModels.join(', ')+'. Rafraîchissez ou modifiez votre sélection.', 'error'); return; }
  if (state.runner !== 'ollama' || !models.length || models.length > 100) { showToast('Sélectionnez de 1 à 100 modèles Ollama.', 'error'); return; }
  if (!state.selectedPrompts.size && !agenticEnabled()) { showToast('Choisissez les catégories ou épreuves à exécuter.', 'error'); return; }
  if (agenticEnabled() && !selectedAgenticScenarios().length) { showToast('Choisissez au moins une épreuve agentique.', 'error'); return; }
  if (!Number.isInteger(getRepetitions()) || getRepetitions() < 1 || getRepetitions() > 20) { showToast('Choisissez de 1 à 20 répétitions.', 'error'); return; }
  if (state.unsavedSession && (await saveSessionToHistory(state.unsavedSession)) === false) return;
  state.unsavedSession = null;
  state.batchActive = true; state.batchStop = false; state.batchAbort = false;
  state.batchQueue = models.map(model => ({ model, status: 'en attente' }));
  state.batchResults = []; state.batchId = crypto.randomUUID();
  lockCampaignControls(true); document.getElementById('runBtn').disabled = true;
  document.getElementById('batchStopControls').hidden = false; renderBatchQueue();
  var continueErrors = document.getElementById('batchContinueErrors').checked;
  try {
    // Check filesystem access before loading a model or clearing prior results.
    await prepareLocalExports();
    for (var i = 0; i < models.length && !state.batchStop; i++) {
      var entry = state.batchQueue[i], model = entry.model, unloaded = false;
      state.batchModel = model; state.batchFailure = null; resetCampaignResults();
      entry.status = 'chargement / chauffe puis mesures'; renderBatchQueue();
      try {
        await runBenchmark(true);
        var results = state.results.filter(r => r.model === model).slice();
        state.batchResults.push(...results);
        var contextIssue=results.some(r=>r.protocol?.campaignId&&r.protocol.contextValidation!=='verified');
        var failed = !!state.batchFailure || !results.length || results.some(r => ['failed', 'interrupted'].includes(r.executionOutcome));
        entry.status = state.batchAbort ? 'interrompu · sauvegarde' : failed ? 'erreur technique · sauvegarde' : 'mesures terminées · sauvegarde'; renderBatchQueue();
        if (results.length) {
          var now = new Date(), report = buildCommunityV2(results, now.toISOString());
          state.pendingLocalExport = { model, batchId: state.batchId, position: i + 1,
            report: report, markdown: buildMarkdownReport(results, now, report) };
          var saved = await localExportRequest('save', state.pendingLocalExport);
          state.pendingLocalExport = null; entry.folder = saved.folder;
        }
        entry.status = 'déchargement et vérification'; renderBatchQueue();
        await unloadBatchModel(model); unloaded = true;
        entry.status = (state.batchAbort ? 'interrompu' : failed ? 'erreur technique' : contextIssue ? 'partiel : contexte non confirmé' : 'terminé') + (results.length ? ' · exports sauvegardés' : ' · aucun résultat') + (isOllamaCloud(model) ? ' · cloud : mémoire distante non gérée' : ' · déchargé');
        if (state.unsavedSession) throw new Error('Historique non sauvegardé ; exports conservés, file arrêtée.');
        if (failed && !continueErrors) break;
      } catch (error) {
        entry.status = 'arrêt : ' + error.message;
        // Even if export/history fails, release this model; never proceed on failure.
        if (!unloaded) { try { await unloadBatchModel(model); entry.status += isOllamaCloud(model)?' · cloud : mémoire distante non gérée':' · déchargé'; } catch (unloadError) { entry.status += ' · ' + unloadError.message; } }
        throw error;
      } finally { document.getElementById('runBtn').disabled = true; renderBatchQueue(); }
    }
  } catch (error) { showToast(error.message, 'error'); }
  finally {
    state.batchQueue.forEach(e => { if (e.status === 'en attente') e.status = 'non exécuté'; });
    state.batchActive = false; state.batchModel = null; lockCampaignControls(false);
    document.getElementById('runBtn').disabled = false; document.getElementById('batchStopControls').hidden = true;
    if (state.batchResults.length) {
      state.results = state.batchResults.slice().reverse();
      document.getElementById('resultsList').textContent = '';
      state.results.forEach(renderResultCard); showResultsArea(true); document.getElementById('exportBtn').disabled = false;
    }
    renderBatchQueue(); loadHistory(); renderStatistics();
    if(typeof renderInterfaceMode === "function")renderInterfaceMode();
    updateBatchSelection(false);
  }
}
