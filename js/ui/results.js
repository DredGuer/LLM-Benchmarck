function exportResourceSummary(resources) {
  if (!resources) return null;
  var result = { sampleCount: resources.sampleCount, startedAt: resources.startedAt,
    scopeNote: resources.scopeNote, sampleLimitReached: !!resources.sampleLimitReached };
  ['swapStart', 'swapEnd', 'compressedStart', 'compressedEnd', 'swapPeak', 'compressedPeak', 'swapReadDelta', 'swapWriteDelta', 'diskReadDelta', 'diskWriteDelta', 'mlxPeak', 'mlxHeldEnd'].forEach(function(key) {
    var r = resources[key];
    if (r) result[key] = Object.assign({}, r);
  });
  return result;
}

function resourceMetricItems(resources) {
  if (!resources) return [];
  return [
    ['Pic MLX · logs serveur Ollama', resources.mlxPeak],
    ['Allocation MLX conservée · dernier événement serveur', resources.mlxHeldEnd],
    ['Swap système · avant', resources.swapStart],
    ['Swap système · après', resources.swapEnd],
    ['Swap système · pic échantillonné', resources.swapPeak],
    ['Mémoire compressée · avant', resources.compressedStart],
    ['Mémoire compressée · après', resources.compressedEnd],
    ['Mémoire compressée système · pic', resources.compressedPeak],
    ['Lectures disques · système', resources.diskReadDelta],
    ['Écritures disques · système', resources.diskWriteDelta],
    ['Swap lu · équivalent pages', resources.swapReadDelta],
    ['Swap écrit · équivalent pages', resources.swapWriteDelta]
  ];
}

function cacheDescription(value) {
  return ({cold:'aucun token réutilisé déclaré',warm:'cache présent (ancienne mesure, couverture inconnue)',
    'present-coverage-unknown':'tokens réutilisés ; couverture inconnue',unknown:'inconnu',disabled:'désactivé'})[value] || value;
}
function resourceValue(reading) {
  if (reading?.status !== 'available' || !Number.isFinite(reading.value)) return 'Non disponible';
  var bytes = reading.value;
  return bytes >= 1024 ** 3 ? (bytes / 1024 ** 3).toFixed(2) + ' GiB' :
    bytes >= 1024 ** 2 ? (bytes / 1024 ** 2).toFixed(2) + ' MiB' :
    bytes >= 1024 ? (bytes / 1024).toFixed(1) + ' KiB' : bytes + ' B';
}

// Stable, allowlisted data for a future community importer. No keys, logs or responses.
function buildCommunityExport(results, generatedAt) {
  function number(value) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
  return {
    schema: 'llm-benchmarker.community', schemaVersion: '1.0.0',
    appVersion: '0.06', generatedAt: generatedAt,
    tests: results.map(function(r) {
      var m = r.metrics || {}, memory = r.memory || {}, loaded = memory.loadedModel || {}, env = r.env || {};
      return {
        id: r.id || null, timestamp: r.timestamp || null,
        model: r.model || null, modelMetadata: r.modelMetadata || null, runner: r.runner || null,
        promptType: r.promptType || null, repetition: number(r.rep),
        status: r.error ? 'error' : 'ok',
        parameters: { temperature: number(m.temperature), maxTokens: number(m.maxTokens), contextRequestedTokens: number(m.contextRequestedTokens), contextMode: m.contextMode || null, contextObservedTokens: number(m.contextObservedTokens) },
        metrics: {
          generatedTokens: number(m.totalTokens),
          averageTokensPerSecond: number(m.tokensPerSec),
          throughputMethod: 'generated-tokens/total-test-seconds',
          ttftMs: r.runner === 'Ollama' ? number(m.ttft) : null,
          totalTimeMs: number(m.totalTime),
          thinkingTokens: null, answerTokens: null
        },
        memory: {
          sampledSource: memory.source || null, sampledUnit: 'MiB',
          sampledPeak: number(memory.peak), sampledAverage: number(memory.average),
          resources: exportResourceSummary(memory.resources),
          loadedModel: loaded.source ? {
            source: loaded.source, unit: 'bytes', sizeBytes: number(loaded.sizeBytes),
            sizeVramBytes: number(loaded.sizeVramBytes), contextTokens: number(loaded.contextTokens), observedAt: number(loaded.observedAt)
          } : null
        },
        environment: {
          os: env.os || null, browser: env.browser || null,
          cpuCores: number(env.cores), ramDescription: env.ram || null, gpu: env.gpu || null,
          hardwareInventory: env.hardwareInventory || null
        }
      };
    })
  };
}

function markdownCell(value) {
  return String(value).replace(/\|/g, '&#124;').replace(/[\r\n]+/g, ' ');
}

function memoryLabel(memory) {
  return memory.source === 'process-tree-rss' ? 'RSS cumulée' :
    memory.source === 'browser-js-heap' ? 'Tas JS navigateur' : 'Mémoire (source inconnue)';
}

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
  if (result.completion?.limitReached) html += '<span class="badge badge-orange">⚠️ Limite de tokens atteinte · réponse possiblement tronquée</span>';
  if (result.phase === 'warmup') html += '<span class="badge badge-orange">🔥 Chauffe · hors moyennes</span>';
  html += '<span class="badge badge-blue">' + escapeHtml(result.runner) + '</span>';
  html += '<span class="badge ' + (isError ? 'badge-red' : 'badge-green') + '">' + (isError ? '❌ Erreur' : '✅ OK') + '</span>';
  html += '<span class="badge badge-purple">' + escapeHtml(result.promptTypeName) + '</span>';
  if (result.memory && result.memory.peak > 0) {
    html += '<span class="badge badge-orange">💾 ' + result.memory.peak + ' MiB · ' + memoryLabel(result.memory) + '</span>';
  }
  html += '<small style="color:var(--text3);font-size:0.75rem;margin-left:auto;">' + new Date(result.timestamp).toLocaleTimeString('fr-FR') + '</small>';
  html += '</div>';
  if (result.modelMetadata || m.contextRequestedTokens != null) {
    html += '<p style="padding:0 16px;font-size:0.8rem;">' + escapeHtml(modelArchitectureText(result.modelMetadata)) +
      ' · Contexte Auto · runner chargé : ' + (m.contextObservedTokens ?? 'inconnu') + ' tokens' +
      ' · Maximum déclaré : ' + (result.modelMetadata?.contextMaxTokens ?? 'inconnu') + ' tokens</p>';
  }

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
    if (Number.isFinite(m.firstAnswerTimeMs)) html += '<div class="metric-box"><div class="metric-value">' + Math.round(m.firstAnswerTimeMs) + ' ms</div><div class="metric-label">Premier segment de réponse finale</div></div>';
    if (result.memory?.loadedModelBefore) html += '<div class="metric-box"><div class="metric-value">' + (result.memory.loadedModelBefore.sizeBytes / 1024 ** 3).toFixed(2) + ' GiB</div><div class="metric-label">Allocation déclarée Ollama · avant</div></div>';
    if (result.memory && result.memory.peak > 0) {
      html += '<div class="metric-box highlight-purple"><div class="metric-value">' + result.memory.peak + ' MiB</div><div class="metric-label">' + memoryLabel(result.memory) + ' pic</div></div>';
      html += '<div class="metric-box highlight-green"><div class="metric-value">' + result.memory.average + ' MiB</div><div class="metric-label">' + memoryLabel(result.memory) + ' moyenne</div></div>';
    }
    if (result.memory && result.memory.loadedModel) {
      html += '<div class="metric-box"><div class="metric-value">' + (result.memory.loadedModel.sizeBytes / Math.pow(1024, 3)).toFixed(2) + ' GiB</div><div class="metric-label">Modèle chargé · déclaré par Ollama (pas un pic RAM)</div></div>';
    }
    resourceMetricItems(result.memory?.resources).forEach(function(item) {
      html += '<div class="metric-box"><div class="metric-value">' + resourceValue(item[1]) + '</div><div class="metric-label">' + escapeHtml(item[0]) + '</div></div>';
    });
    html += '</div>';
    if (result.memory?.resources) html += '<p style="font-size:0.8rem;padding:0 16px">Swap et E/S : système entier. Pic MLX des logs serveur Ollama, attribution au modèle non vérifiée. Activité disque observée, pas vitesse maximale SSD.</p>';
    if (result.protocol) html += '<p style="padding:0 16px;font-size:0.8rem">Chargement : ' + escapeHtml(result.protocol.loadState) + ' · Cache : ' + escapeHtml(cacheDescription(result.protocol.cacheState)) + ' · Chauffes préalables : ' + result.protocol.warmupRuns + '</p>';
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
  md += '> Généré le ' + dateStr + ' à ' + timeStr + ' par **LLM Benchmarker v0.06**\n\n';
  md += '---\n\n';
  md += '## 💻 Environnement de test\n\n';
  md += '| Paramètre | Valeur |\n';
  md += '|-----------|--------|\n';
  md += '| Système d\'exploitation | ' + (env.os || 'N/A') + ' |\n';
  md += '| Navigateur | ' + (env.browser || 'N/A') + ' |\n';
  md += '| Cœurs CPU | ' + (env.cores || 'N/A') + ' |\n';
  md += '| RAM (approx.) | ' + (env.ram || 'N/A') + ' |\n';
  md += '| GPU | ' + (env.gpu || 'N/A') + ' |\n\n';
  if (env.hardwareInventory) {
    var inventory = env.hardwareInventory, node = inventory.machine, cpu = node.cpus[0];
    md += '### Inventaire Apple détecté\n\n';
    md += '| Élément | Valeur | Source |\n|---|---|---|\n';
    function hardwareRow(label, value, source) {
      md += '| ' + [label, value == null ? 'N/A' : value, source].map(markdownCell).join(' | ') + ' |\n';
    }
    hardwareRow('CPU', cpu.model, inventory.provenance.cpuModel);
    hardwareRow('Cœurs physiques / logiques', (cpu.physicalCores ?? 'N/A') + ' / ' + (cpu.logicalCores ?? 'N/A'), inventory.provenance.physicalCores);
    hardwareRow('Cœurs performance / efficacité', (cpu.performanceCores ?? 'N/A') + ' / ' + (cpu.efficiencyCores ?? 'N/A'), inventory.provenance.coreClasses);
    hardwareRow('Fréquence déclarée (Hz, pas en direct)', cpu.frequency.value, cpu.frequency.source);
    hardwareRow('RAM physique (octets)', node.memory.physicalCapacity.value, node.memory.physicalCapacity.source);
    hardwareRow('Architecture mémoire', node.memory.architecture, inventory.provenance.memory);
    node.gpus.forEach(function(g) { hardwareRow('GPU ' + g.id, (g.model || 'N/A') + ' ; cœurs GPU : ' + (g.computeUnits ?? 'N/A'), inventory.provenance.gpus); });
    node.storage.forEach(function(d) { hardwareRow('Stockage ' + d.id, (d.model || 'N/A') + ' ; ' + d.kind + '/' + d.transport + ' ; octets : ' + (d.capacity.value ?? 'N/A'), d.capacity.source); });
    if (inventory.storageSpeed?.status === 'available') hardwareRow('Débit SSD (bytes/s)', inventory.storageSpeed.value, inventory.storageSpeed.source);
    md += '\n';
  }
  md += '---\n\n';
  md += '## 📈 Résumé des tests\n\n';
  md += '| # | Modèle | Runner | Type | Tokens | Tok/s moyen | TTFT (ms) | Temps total (s) | Source mémoire échantillonnée | Pic (MiB) | Moyenne (MiB) | Modèle chargé (GiB) | Source modèle chargé | Architecture | Contexte Auto · runner chargé (tokens) | Contexte max déclaré (tokens) | Statut |\n';
  md += '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n';

  for (var i = 0; i < state.results.length; i++) {
    var r = state.results[i], m = r.metrics || {}, memory = r.memory || {}, loaded = memory.loadedModel;
    var cells = [
      i + 1, r.model, r.runner, r.promptTypeName,
      m.totalTokens, m.tokensPerSec,
      r.runner === 'Ollama' && m.ttft != null ? m.ttft : 'N/A',
      Number.isFinite(m.totalTime) ? (m.totalTime / 1000).toFixed(2) : 'N/A',
      memory.source || 'unknown',
      memory.peak != null ? memory.peak : 'N/A',
      memory.average != null ? memory.average : 'N/A',
      loaded && Number.isFinite(loaded.sizeBytes) ? (loaded.sizeBytes / Math.pow(1024, 3)).toFixed(2) : 'N/A',
      loaded ? loaded.source : 'N/A', modelArchitectureText(r.modelMetadata),
      m.contextObservedTokens ?? 'Inconnu / non applicable', r.modelMetadata?.contextMaxTokens ?? 'N/A', r.error ? 'Erreur' : 'OK'
    ];
    md += '| ' + cells.map(markdownCell).join(' | ') + ' |\n';
  }
  md += '\nLe débit moyen inclut toute la durée du test. La mémoire échantillonnée dépend de sa source (RSS cumulée ou tas JS navigateur). La taille du modèle déclarée par Ollama est distincte du pic RAM ; ne pas additionner size et size_vram sur mémoire unifiée. N/A signifie inconnu.\n';
  md += '\n## Données structurées pour import communautaire\n\n';
  md += 'Schéma llm-benchmarker.community, version 2.0.0 (bundle de rapports si plusieurs runners/inventaires). Bloc limité aux paramètres, mesures et environnement sélectionné ; sans clés API, logs, prompts ni réponses. Le reste du rapport contient les prompts et réponses : vérifier avant partage.\n\n';
  md += '\x60\x60\x60json\n' + JSON.stringify(buildCommunityV2(state.results, now.toISOString()), null, 2).replace(/\x60/g, '\\u0060') + '\n\x60\x60\x60\n';
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
      md += '| Phase | ' + (r.phase || 'Historique non standardisé') + ' |\n';
      md += '| Chargement / cache | ' + (r.protocol?.loadState || 'unknown') + ' / ' + cacheDescription(r.protocol?.cacheState || 'unknown') + ' |\n';
      md += '| Temps chargement (ms) | ' + (m.loadTimeMs ?? 'N/A') + ' |\n';
      md += '| Débit génération seule (tok/s) | ' + (m.generationTokensPerSec ?? 'N/A') + ' |\n';
      if (r.memory?.loadedModelBefore) md += '| Allocation déclarée Ollama · avant | ' + (r.memory.loadedModelBefore.sizeBytes / 1024 ** 3).toFixed(2) + ' GiB |\n';
      md += '| Tokens max | ' + m.maxTokens + ' |\n';
      md += '| Fin de génération | ' + markdownCell(r.completion?.state || 'unknown') + ' · ' + markdownCell(r.completion?.reason || 'non déclarée') + ' |\n';
      md += '| Premier segment de réponse finale | ' + (Number.isFinite(m.firstAnswerTimeMs) ? Math.round(m.firstAnswerTimeMs) + ' ms' : 'Non disponible') + ' |\n';
      md += '| Version du runner | ' + markdownCell(r.runnerVersion || 'inconnue') + ' |\n';
      md += '| Contexte Auto · runner chargé (tokens, Ollama) | ' + (m.contextObservedTokens ?? 'Inconnu / non applicable') + ' |\n';
      md += '| Architecture Dense / MoE | ' + markdownCell(modelArchitectureText(r.modelMetadata)) + ' |\n';
      md += '| Contexte maximal déclaré (tokens) | ' + (r.modelMetadata?.contextMaxTokens ?? 'N/A') + ' |\n';
      md += '| Source métadonnées modèle | ' + (r.modelMetadata?.source || 'N/A') + ' |\n';
      if (r.memory && r.memory.peak > 0) {
        md += '| ' + memoryLabel(r.memory) + ' pic | ' + r.memory.peak + ' MiB |\n';
        md += '| ' + memoryLabel(r.memory) + ' moyenne | ' + r.memory.average + ' MiB |\n';
      }
      if (r.memory && r.memory.loadedModel) {
        md += '| Modèle chargé (déclaré par Ollama, pas un pic RAM) | ' + (r.memory.loadedModel.sizeBytes / Math.pow(1024, 3)).toFixed(2) + ' GiB |\n';
        md += '| Source mémoire du modèle | ollama-api-ps |\n';
        md += '| Taille modèle déclarée (octets) | ' + r.memory.loadedModel.sizeBytes + ' |\n';
        md += '| size_vram déclaré (octets) | ' + (r.memory.loadedModel.sizeVramBytes === null ? 'N/A' : r.memory.loadedModel.sizeVramBytes) + ' |\n';
      }
      resourceMetricItems(r.memory?.resources).forEach(function(item) {
        md += '| ' + markdownCell(item[0]) + ' | ' + resourceValue(item[1]) + ' |\n';
        md += '| Source ' + markdownCell(item[0]) + ' | ' + markdownCell(item[1]?.source || 'N/A') + ' |\n';
      });
      if (r.memory?.resources) md += '\nSwap et E/S : système entier. Le pic MLX est un événement des logs Ollama dont l’attribution au modèle est non vérifiée. Aucune vitesse maximale SSD n’est mesurée.\n';
      md += '\n';
      md += '#### Prompt\n\n';
      md += '```\n' + r.promptText + '\n```\n\n';
      md += '#### Réponse\n\n';
      md += '```\n' + r.response + '\n```\n\n';
    }
    md += '---\n\n';
  }
  
  md += '*Rapport généré automatiquement par LLM Benchmarker v0.06*\n';
  
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
