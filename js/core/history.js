/**
 * LLM Benchmarker - History Management
 */

function saveSessionToHistory(session) {
  try {
    var history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    history.unshift({ ...session, savedAt: new Date().toISOString() });
    if (history.length > 50) history.splice(50);
    while (history.length) {
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); return true; }
      catch (error) {
        if (error.name !== 'QuotaExceededError' || history.length === 1) throw error;
        history.pop();
      }
    }
  } catch(error) {
    showToast('Historique non sauvegardé : exportez cette campagne ou libérez du stockage avant la suivante.', 'error');
    return false;
  }
}

function loadHistory() {
  try {
    var history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    var container = document.getElementById('historyContainer');
    if (!container) return;
    
    if (history.length === 0) {
      container.innerHTML = '<p style="color:var(--text3);font-size:0.875rem;text-align:center;padding:20px;">Aucune session sauvegardée.</p>';
      return;
    }
    var html = '<div style="overflow-x:auto"><table class="history-table"><thead><tr><th>Date</th><th>Modèle</th><th>Runner</th><th>Tests</th><th>Moy. tok/s</th><th>Actions</th></tr></thead><tbody>';
    for (var i = 0; i < history.length; i++) {
      var session = history[i];
      var date = new Date(session.savedAt).toLocaleString('fr-FR');
      var measurements = (session.results || []).filter(r => r.phase !== 'warmup' && !r.error);
      var count = measurements.length;
      var avgTPS = count > 0 ? Math.round(measurements.reduce(function(a, r) { return a + (r.metrics?.tokensPerSec || 0); }, 0) / count * 10) / 10 : 0;
      html += '<tr><td>' + date + '</td><td><code class="code-tag">' + escapeHtml(session.model) + '</code></td><td>' + escapeHtml(session.runner) + '</td><td><span class="badge badge-blue">' + count + '</span></td><td><strong style="color:var(--accent2)">' + avgTPS + '</strong></td><td><button class="btn btn-ghost btn-sm" onclick="restoreSession(' + i + ')">↩ Restaurer</button></td></tr>';
    }
    html += '</tbody></table></div>';
    container.innerHTML = html;
  } catch(e) { console.error('Erreur chargement historique:', e); }
}

function restoreSession(idx) {
  try {
    var history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    var session = history[idx];
    if (!session) return;
    resetCampaignResults();
    state.results = session.results ? session.results.slice(0) : [];
    showResultsArea(!!state.results.length);
    for (var i = 0; i < state.results.length; i++) {
      renderResultCard(state.results[i]);
    }
    document.getElementById('exportBtn').disabled = false;
    switchTab('results');
    showToast('Session restaurée : ' + session.results.length + ' résultat(s)', 'success');
  } catch(e) { showToast('Erreur de restauration', 'error'); }
}

function clearHistory() {
  if (!confirm('Vider tout l\'historique ?')) return;
  localStorage.removeItem(HISTORY_KEY);
  loadHistory();
  if (typeof renderStatistics === 'function') renderStatistics();
  showToast('Historique vidé', 'info');
}

function clearAllResults() {
  if (state.isRunning || state.results.length === 0) return;
  if (!confirm('Vider les résultats actuels ?')) return;
  state.results = [];
  state.unsavedSession = null;
  var resultsList = document.getElementById('resultsList');
  if (resultsList) resultsList.innerHTML = '';
  showResultsArea(false);
  document.getElementById('exportBtn').disabled = true;
  showToast('Résultats effacés', 'info');
}
