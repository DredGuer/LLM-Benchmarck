/**
 * LLM Benchmarker - Runner Management
 */

function selectRunner(runner) {
  state.runner = runner;
  var buttons = document.querySelectorAll(".runner-btn");
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].classList.toggle("active", buttons[i].dataset.runner === runner);
  }
  updateRunnerConfig();
  populateModelSelect();
  if (RUNNERS[runner].type === "local" || runner === "custom") fetchModels();
}

function updateRunnerConfig() {
  var cfg = document.getElementById('runnerConfig');
  var r = RUNNERS[state.runner];
  if (state.runner === 'custom') {
    cfg.innerHTML = '<div class="form-group"><label>URL de base</label><input type="url" id="customBaseUrl" placeholder="http://localhost:8080" value="' + (state.customBase || '') + '" oninput="state.customBase=this.value"></div>';
  } else if (r.type === 'local') {
    cfg.innerHTML = '<div style="display:flex;align-items:center;gap:8px;font-size:0.82rem;color:var(--text2);"><span>🔗</span><span>Endpoint : <code class="code-tag">' + r.base + '</code></span></div>';
  } else if (r.type === 'api') {
    var hasKey = !!state.apiKeys[state.runner];
    var color = hasKey ? 'var(--accent2)' : 'var(--accent5)';
    var icon = hasKey ? '✅' : '⚠️';
    var text = hasKey ? 'Clé API configurée' : 'Clé API manquante';
    cfg.innerHTML = '<div style="display:flex;align-items:center;gap:8px;font-size:0.82rem;"><span>' + icon + '</span><span style="color:' + color + '">' + text + '</span><button class="btn btn-ghost btn-sm" onclick="openModal(\'apiModal\')">Configurer</button></div>';
  }
}

function populateModelSelect() {
  var sel = document.getElementById('modelSelect');
  var models = DEFAULT_MODELS[state.runner] || [];
  sel.innerHTML = '<option value="">— Choisir ou saisir —</option>';
  for (var i = 0; i < models.length; i++) {
    var opt = document.createElement('option');
    opt.value = models[i];
    opt.textContent = models[i];
    sel.appendChild(opt);
  }
  if (models.length > 0) sel.value = models[0];
}

async function fetchModels() {
  var status = document.getElementById('modelStatus');
  status.textContent = '⏳ Récupération des modèles…';
  var r = RUNNERS[state.runner];
  if (r.type !== 'local' && state.runner !== 'custom') {
    status.textContent = '⚠️ Auto-détection non disponible pour les APIs externes.';
    return;
  }
  var base = state.runner === 'custom' ? state.customBase : r.base;
  if (!base) { status.textContent = '⚠️ URL de base non définie.'; return; }
  try {
    var models = [];
    if (state.runner === 'ollama') {
      var res = await fetchWithTimeout(base + '/api/tags', {}, 10000);
      var data = await res.json();
      models = data.models ? data.models.map(function(m) { return m.name; }) : [];
    } else {
      var res = await fetchWithTimeout(base + '/v1/models', {}, 10000);
      var data = await res.json();
      models = data.data ? data.data.map(function(m) { return m.id; }) : [];
    }
    if (models.length === 0) { status.textContent = '⚠️ Aucun modèle trouvé.'; return; }
    var sel = document.getElementById('modelSelect');
    sel.innerHTML = '<option value="">— Choisir —</option>';
    for (var i = 0; i < models.length; i++) {
      var opt = document.createElement('option');
      opt.value = models[i];
      opt.textContent = models[i];
      sel.appendChild(opt);
    }
    sel.value = models[0];
    status.textContent = '✅ ' + models.length + ' modèle(s) trouvé(s)';
    showToast(models.length + ' modèles détectés', 'success');
  } catch (e) {
    status.textContent = "❌ Impossible de contacter le runner. Vérifiez que le service est lancé ou servez ce fichier via un serveur web (ex: `python -m http.server`).";
    showToast('Runner inaccessible', 'error');
  }
}
