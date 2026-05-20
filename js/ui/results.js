/**
 * LLM Benchmarker - Results Rendering & Export
 */

// Show/hide results area
function showResultsArea(show) {
  var emptyState = document.getElementById('emptyState');
  var resultsList = document.getElementById('resultsList');
  if (emptyState) emptyState.style.display = show ? 'none' : 'flex';
  if (resultsList) resultsList.style.display = show ? 'flex' : 'none';
}

function renderResultCard(result) {
  showResultsArea(true);
  var list = document.getElementById('resultsList');
  var card = document.createElement('div');
  card.className = 'result-card';
  card.id = 'result-' + result.id;
  
  var isError = !!result.error;
  var m = result.metrics;
  var ttftStr = m.ttft !== null ? m.ttft + ' ms' : 'N/A';
  var tpsColor = m.tokensPerSec > 30 ? 'highlight-green' : m.tokensPerSec > 10 ? 'highlight-orange' : 'highlight-purple';
  
  var html = '<div class="result-card-header">';
  html += '<span class="prompt-type-emoji" style="font-size:1.4rem">' + result.promptEmoji + '</span>';
  html += '<span class="model-name">' + escapeHtml(result.model) + '</span>';
  html += '<span class="badge badge-blue">' + escapeHtml(result.runner) + '</span>';
  html += '<span class="badge ' + (isError ? 'badge-red' : 'badge-green') + '">' + (isError ? '❌ Erreur' : '✅ OK') + '</span>';
  html += '<span class="badge badge-purple">' + escapeHtml(result.promptTypeName) + '</span>';
  if (result.memory && result.memory.peak > 0) {
    html += '<span class="badge badge-orange">💾 ' + result.memory.peak + ' MB</span>';
  }
  html += '<small style="color:var(--text3);font-size:0.75rem;margin-left:auto;">' + new Date(result.timestamp).toLocaleTimeString('fr-FR') + '</small>';
  html += '</div>';
  
  if (isError) {
    html += '<div class="result-card-body">';
    html += '<div style="background:rgba(247,129,102,0.1);border:1px solid rgba(247,129,102,0.3);border-radius:6px;padding:12px;color:var(--accent3);font-size:0.875rem;">⚠️ <strong>Erreur :</strong> ' + escapeHtml(result.error) + '</div>';
  } else {
    html += '<div class="result-card-body">';
    html += '<div class="metrics-grid">';
    html += '<div class="metric-box highlight-blue"><div class="metric-value">' + m.totalTokens + '</div><div class="metric-label">Tokens générés</div></div>';
    html += '<div class="metric-box ' + tpsColor + '"><div class="metric-value">' + m.tokensPerSec + '</div><div class="metric-label">Tokens / sec</div></div>';
    html += '<div class="metric-box highlight-orange"><div class="metric-value">' + ttftStr + '</div><div class="metric-label">1er token (TTFT)</div></div>';
    html += '<div class="metric-box"><div class="metric-value">' + (m.totalTime/1000).toFixed(2) + 's</div><div class="metric-label">Temps total</div></div>';
    if (result.memory && result.memory.peak > 0) {
      html += '<div class="metric-box highlight-purple"><div class="metric-value">' + result.memory.peak + ' MB</div><div class="metric-label">RAM pic</div></div>';
    }
    html += '</div>';
    html += '<div class="prompt-echo"><strong>Prompt :</strong> ' + escapeHtml(result.promptText.substring(0, 180)) + (result.promptText.length > 180 ? '…' : '') + '</div>';
    html += '<div class="response-block">' + escapeHtml(result.response) + '</div>';
  }
  html += '</div>';
  
  card.innerHTML = html;
  if (list) {
    list.insertBefore(card, list.firstChild);
  }
}

function exportMarkdown() {
  if (state.results.length === 0) { showToast('Aucun résultat à exporter', 'error'); return; }
  var now = new Date();
  var dateStr = now.toLocaleDateString('fr-FR', { year:'numeric', month:'long', day:'numeric' });
  var timeStr = now.toLocaleTimeString('fr-FR');
  var env = state.results[0]?.env || {};
  
  var md = '# 📊 Rapport de Benchmark LLM\n\n';
  md += '> Généré le ' + dateStr + ' à ' + timeStr + ' par **LLM Benchmarker v0.01**\n\n';
  md += '---\n\n';
  md += '## 💻 Environnement de test\n\n';
  md += '| Paramètre | Valeur |\n';
  md += '|-----------|--------|\n';
  md += '| Système d\'exploitation | ' + (env.os || 'N/A') + ' |\n';
  md += '| Navigateur | ' + (env.browser || 'N/A') + ' |\n';
  md += '| Cœurs CPU | ' + (env.cores || 'N/A') + ' |\n';
  md += '| RAM (approx.) | ' + (env.ram || 'N/A') + ' |\n';
  md += '| GPU | ' + (env.gpu || 'N/A') + ' |\n\n';
  md += '---\n\n';
  md += '## 📈 Résumé des tests\n\n';
  md += '| # | Modèle | Runner | Type | Tokens | Tok/s | TTFT | Temps total | RAM | Statut |\n';
  md += '|---|--------|--------|------|--------|-------|------|-------------|-----|--------|\n';
  
  for (var i = 0; i < state.results.length; i++) {
    var r = state.results[i];
    var m = r.metrics;
    var ttftStr = m.ttft !== null ? m.ttft + ' ms' : 'N/A';
    var ramStr = (r.memory && r.memory.peak > 0) ? r.memory.peak + ' MB' : 'N/A';
    var status = r.error ? '❌ Erreur' : '✅ OK';
    md += '| ' + (i+1) + ' | `'+ r.model +'` | ' + r.runner + ' | ' + r.promptEmoji + ' ' + r.promptTypeName + ' | ' + m.totalTokens + ' | ' + m.tokensPerSec + ' | ' + ttftStr + ' | ' + (m.totalTime/1000).toFixed(2) + 's | ' + ramStr + ' | ' + status + ' |\n';
  }
  
  md += '\n---\n\n';
  md += '## 🔍 Détail des tests\n\n';
  
  for (var i = 0; i < state.results.length; i++) {
    var r = state.results[i];
    var m = r.metrics;
    md += '### Test ' + (i+1) + ' — ' + r.promptEmoji + ' ' + r.promptTypeName + '\n\n';
    md += '**Modèle :** `'+ r.model +'` | **Runner :** ' + r.runner + ' | **Date :** ' + new Date(r.timestamp).toLocaleString('fr-FR') + '\n\n';
    
    if (r.error) {
      md += '**Statut :** ❌ Erreur\n\n';
      md += '**Message d\'erreur :**\n';
      md += '```\n' + r.error + '\n```\n\n';
    } else {
      md += '#### Métriques\n\n';
      md += '| Métrique | Valeur |\n';
      md += '|----------|--------|\n';
      md += '| Tokens générés | ' + m.totalTokens + ' |\n';
      md += '| Tokens / seconde | ' + m.tokensPerSec + ' |\n';
      md += '| Temps 1er token (TTFT) | ' + (m.ttft !== null ? m.ttft + ' ms' : 'N/A') + ' |\n';
      md += '| Temps total | ' + (m.totalTime/1000).toFixed(2) + ' s |\n';
      md += '| Température | ' + m.temperature + ' |\n';
      md += '| Tokens max | ' + m.maxTokens + ' |\n';
      if (r.memory && r.memory.peak > 0) {
        md += '| RAM pic | ' + r.memory.peak + ' MB |\n';
        md += '| RAM moyenne | ' + r.memory.average + ' MB |\n';
      }
      md += '\n';
      md += '#### Prompt\n\n';
      md += '```\n' + r.promptText + '\n```\n\n';
      md += '#### Réponse\n\n';
      md += '```\n' + r.response + '\n```\n\n';
    }
    md += '---\n\n';
  }
  
  md += '*Rapport généré automatiquement par LLM Benchmarker v0.01*\n';
  
  var blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  var modelName = (state.results[0]?.model || 'unknown').replace(/[\/:*?"<>|]/g, '-');
  var yyyy = now.getFullYear();
  var mm = String(now.getMonth() + 1).padStart(2, '0');
  var dd = String(now.getDate()).padStart(2, '0');
  var hh = String(now.getHours()).padStart(2, '0');
  var min = String(now.getMinutes()).padStart(2, '0');
  var filename = 'LLMB-' + modelName + '-' + yyyy + mm + dd + '-' + hh + min + '.md';
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exporté : ' + filename, 'success');
}
