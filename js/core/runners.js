/**
 * LLM Benchmarker - Runner Management
 */

var modelListGeneration = 0;
var modelMetadataGeneration = 0;

function selectRunner(runner) {
  modelListGeneration++;
  modelMetadataGeneration++;
  state.modelMetadata = null;
  state.runner = runner;
  var buttons = document.querySelectorAll(".runner-btn");
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].classList.toggle("active", buttons[i].dataset.runner === runner);
  }
  updateRunnerConfig();
  populateModelSelect();
  renderModelMetadata(null);
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
  var runner = state.runner, generation = ++modelListGeneration;
  var previous = document.getElementById('modelSelect').value;
  var r = RUNNERS[runner];
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
    if (generation !== modelListGeneration || runner !== state.runner) return;
    if (models.length === 0) { status.textContent = '⚠️ Aucun modèle trouvé.'; return; }
    var sel = document.getElementById('modelSelect');
    sel.innerHTML = '<option value="">— Choisir —</option>';
    for (var i = 0; i < models.length; i++) {
      var opt = document.createElement('option');
      opt.value = models[i];
      opt.textContent = models[i];
      sel.appendChild(opt);
    }
    sel.value = models.includes(previous) ? previous : models[0];
    refreshModelMetadata();
    status.textContent = '✅ ' + models.length + ' modèle(s) trouvé(s)';
    showToast(models.length + ' modèles détectés', 'success');
  } catch (e) {
    if (generation !== modelListGeneration || runner !== state.runner) return;
    status.textContent = "❌ Impossible de contacter le runner. Vérifiez que le service est lancé ou servez ce fichier via un serveur web (ex: `python -m http.server`).";
    showToast('Runner inaccessible', 'error');
  }
}

function parseModelMetadata(data, model) {
  var info = data.model_info || {};
  var architecture = typeof info['general.architecture'] === 'string' ? info['general.architecture'] : null;
  function numeric(key) { var value = info[key]; return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null; }
  var experts = architecture ? numeric(architecture + '.expert_count') : null;
  return {
    model: model, source: 'ollama-api-show', observedAt: new Date().toISOString(),
    architecture: architecture,
    type: experts === null ? 'unknown' : experts > 1 ? 'moe' : 'dense',
    expertCount: experts,
    activeExperts: architecture ? numeric(architecture + '.expert_used_count') : null,
    parameterCount: numeric('general.parameter_count'),
    contextMaxTokens: architecture ? numeric(architecture + '.context_length') : null,
    quantization: typeof data.details?.quantization_level === 'string' ? data.details.quantization_level : null
  };
}

function modelArchitectureText(metadata) {
  if (!metadata) return 'Architecture non disponible';
  return metadata.type === 'moe' ? 'MoE · ' + metadata.expertCount + ' experts · actifs par token : ' + (metadata.activeExperts ?? 'inconnu') :
    metadata.type === 'dense' ? 'Dense' : 'Dense / MoE : non déclaré';
}

function renderModelMetadata(metadata) {
  var panel = document.getElementById('modelMetadata');
  if (!panel) return;
  panel.textContent = '';
  if (!metadata) { panel.textContent = 'Informations du modèle non disponibles.'; return; }
  var cards = [
    ['Architecture', modelArchitectureText(metadata)],
    ['Paramètres totaux', metadata.parameterCount === null ? 'Inconnus' : (metadata.parameterCount / 1e9).toFixed(2) + ' milliards'],
    ['Quantification', metadata.quantization || 'Inconnue'],
    ['Contexte maximum', (metadata.contextMaxTokens ?? 'Inconnu') + ' tokens'],
    ['Contexte du test', state.runner === 'ollama' ? 'Auto · réglage Ollama' : 'Géré par le fournisseur']
  ];
  cards.forEach(function(item) {
    var box = document.createElement('div');
    box.className = 'metric-box';
    var title = document.createElement('div'), value = document.createElement('strong');
    title.className = 'metric-label'; title.textContent = item[0];
    value.textContent = item[1]; value.style.display = 'block'; value.style.marginTop = '6px';
    box.appendChild(title); box.appendChild(value); panel.appendChild(box);
  });
}

async function refreshModelMetadata() {
  var generation = ++modelMetadataGeneration, runner = state.runner, model = getSelectedModel();
  state.modelMetadata = null;
  renderModelMetadata(null);
  if (runner !== 'ollama' || !model || model === 'unknown-model') return null;
  try {
    var response = await fetchWithTimeout(RUNNERS.ollama.base + '/api/show', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: model })
    }, 10000);
    if (!response.ok) throw new Error('Métadonnées non disponibles');
    var metadata = parseModelMetadata(await response.json(), model);
    if (generation !== modelMetadataGeneration || runner !== state.runner || model !== getSelectedModel()) return null;
    state.modelMetadata = metadata;
    renderModelMetadata(metadata);
    return metadata;
  } catch (error) {
    if (generation === modelMetadataGeneration) renderModelMetadata(null);
    return null;
  }
}

// Auto delegates context allocation to the runner; never forces the model maximum.
function getRequestedContextTokens() { return state.controlledActive && Number.isInteger(state.activeContextTokens) ? state.activeContextTokens : null; }

function buildOllamaOptions(temperature, maxTokens, contextTokens) {
  var options = { temperature: temperature, num_predict: maxTokens };
  if (contextTokens !== null) options.num_ctx = contextTokens;
  return options;
}
