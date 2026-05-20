"use strict";

/* ═══════════════════════════════════════════
   CONFIGURATION - Chargée depuis les fichiers JSON
═══════════════════════════════════════════ */
// Charger les configurations depuis les fichiers JSON externes
const runnersConfig = JSON.parse(document.getElementById('runnersConfig').textContent);
const promptsConfig = JSON.parse(document.getElementById('promptsConfig').textContent);
const RUNNERS = runnersConfig.runners;
const DEFAULT_MODELS = {};
for (const [key, value] of Object.entries(runnersConfig.runners)) {
  DEFAULT_MODELS[key] = value.defaultModels || [];
}
const PROMPT_TYPES = promptsConfig.promptTypes;

/* ═══════════════════════════════════════════
   HARDWARE CONFIGURATION MANAGER
═══════════════════════════════════════════ */

// Stockage des configurations matérielles manuelles
const HARDWARE_CONFIG_KEY = 'llm_bench_hardware_config';

// Configuration manuelle actuelle
let manualHardwareConfig = null;

// Ouvrir la modal de configuration matérielle
function openHardwareConfigModal() {
  const config = manualHardwareConfig || {};
  
  // Pré-remplir avec les valeurs actuelles (manuelles ou auto)
  // Si config manuelle existe, utiliser celle-ci, sinon utiliser state.env
  document.getElementById('manualOS').value = config.os || state.env.os || '';
  document.getElementById('manualOSVersion').value = config.osVersion || state.env.osVersion || '';
  document.getElementById('manualChip').value = config.chip || state.env.chip || '';
  document.getElementById('manualRAM').value = config.ram || state.env.ram || '';
  document.getElementById('manualGPU').value = config.gpu || state.env.gpu || '';
  
  // Pour la RAM GPU, gérer selon l'OS
  const gpuRamSelect = document.getElementById('manualGPURam');
  if (config.gpuRam) {
    gpuRamSelect.value = config.gpuRam;
  } else if (state.env.gpuRam) {
    gpuRamSelect.value = state.env.gpuRam;
  } else {
    gpuRamSelect.value = '';
  }
  
  // Gérer l'affichage de la RAM GPU selon l'OS sélectionné
  const osSelect = document.getElementById('manualOS');
  
  function updateGpuRamVisibility() {
    const isApple = osSelect.value === 'macOS';
    const options = gpuRamSelect.querySelectorAll('option');
    
    options.forEach(opt => {
      if (isApple) {
        // Sur Mac, masquer les options numériques
        if (opt.value !== '' && opt.value !== 'unified') {
          opt.style.display = 'none';
        }
      } else {
        // Sur Windows/Linux, montrer toutes les options
        opt.style.display = '';
      }
    });
    
    // Sélectionner "Unifiée" automatiquement si Apple et pas de valeur
    if (isApple && !gpuRamSelect.value) {
      gpuRamSelect.value = 'unified';
    }
    // Réinitialiser si non-Apple et valeur = unified
    if (!isApple && gpuRamSelect.value === 'unified') {
      gpuRamSelect.value = '';
    }
  }
  
  osSelect.addEventListener('change', updateGpuRamVisibility);
  updateGpuRamVisibility();
  
  openModal('hardwareModal');
}

// Sauvegarder la configuration matérielle manuelle
function saveHardwareConfig() {
  manualHardwareConfig = {
    os: document.getElementById('manualOS').value,
    osVersion: document.getElementById('manualOSVersion').value.trim(),
    chip: document.getElementById('manualChip').value,
    ram: document.getElementById('manualRAM').value,
    gpu: document.getElementById('manualGPU').value,
    gpuRam: document.getElementById('manualGPURam').value,
    savedAt: new Date().toISOString()
  };
  
  // Sauvegarder dans localStorage
  try {
    localStorage.setItem(HARDWARE_CONFIG_KEY, JSON.stringify(manualHardwareConfig));
    showToast('Configuration matérielle sauvegardée', 'success');
  } catch (e) {
    showToast('Erreur lors de la sauvegarde', 'error');
  }
  
  // Recharger la détection avec les valeurs manuelles
  loadAndApplyHardwareConfig();
  closeModal('hardwareModal');
}

// Réinitialiser la configuration matérielle
function resetHardwareConfig() {
  manualHardwareConfig = null;
  try {
    localStorage.removeItem(HARDWARE_CONFIG_KEY);
    showToast('Configuration réinitialisée - détection automatique', 'success');
  } catch (e) {
    showToast('Erreur lors de la réinitialisation', 'error');
  }
  
  // Recharger avec la détection automatique
  detectEnvironment();
  closeModal('hardwareModal');
}

// Charger la configuration matérielle depuis localStorage
function loadHardwareConfig() {
  try {
    const saved = localStorage.getItem(HARDWARE_CONFIG_KEY);
    if (saved) {
      manualHardwareConfig = JSON.parse(saved);
    }
  } catch (e) {
    manualHardwareConfig = null;
  }
  return manualHardwareConfig;
}

// Appliquer la configuration matérielle (manuelle ou auto)
function loadAndApplyHardwareConfig() {
  const config = manualHardwareConfig || {};
  const hw = detectFullHardware();
  
  // Créer l'objet env complet
  // Les valeurs manuelles priment sur la détection auto
  const env = {
    os: config.os || hw.os || 'Inconnu',
    osVersion: config.osVersion || hw.osVersion || '',
    browser: hw.browser || 'Inconnu',
    cores: hw.cores || '?',
    chip: config.chip || hw.chip || '',
    ram: config.ram || hw.ram || '?',
    gpu: config.gpu || hw.gpu || 'Non disponible',
    gpuRam: config.gpuRam || (hw.isApple ? 'Unifiée' : (hw.gpuRam || '?'))
  };
  
  // Mettre à jour state.env
  state.env = env;
  
  // Mettre à jour l'UI avec les indicateurs
  updateEnvDisplayWithIndicators();
}

// Mettre à jour l'affichage de l'environnement avec indicateurs auto/manual
function updateEnvDisplayWithIndicators() {
  const isManual = !!manualHardwareConfig;
  const config = manualHardwareConfig || {};
  
  // Mettre à jour chaque champ
  const fields = [
    { id: 'envOS', value: state.env.os, manual: isManual && config.os },
    { id: 'envBrowser', value: state.env.browser, manual: false }, // Toujours auto
    { id: 'envCores', value: (state.env.cores || '?') + (state.env.cores !== '?' ? ' vCPU' : ''), manual: false }, // Toujours auto
    { id: 'envChip', value: state.env.chip, manual: isManual && config.chip, display: !!state.env.chip },
    { id: 'envRAM', value: state.env.ram, manual: isManual && config.ram },
    { id: 'envGPU', value: state.env.gpu, manual: isManual && config.gpu },
    { id: 'envGPURam', value: state.env.gpuRam || '?', manual: isManual && config.gpuRam }
  ];
  
  fields.forEach(field => {
    const el = document.getElementById(field.id);
    if (el) {
      el.textContent = field.value;
      el.className = 'env-value' + (field.manual ? ' manual' : '');
      if (field.display !== undefined) {
        el.style.display = field.display ? 'block' : 'none';
      }
    }
  });
}

// Fonction améliorée de détection du matériel
function detectFullHardware() {
  const ua = navigator.userAgent;
  const platform = navigator.platform;
  
  // OS
  let os = 'Inconnu';
  let osVersion = '';
  if (ua.includes('Windows')) {
    os = 'Windows';
    if (ua.includes('Windows NT 10.0')) osVersion = ' 10/11';
    else if (ua.includes('Windows NT 6.3')) osVersion = ' 8.1';
    else if (ua.includes('Windows NT 6.2')) osVersion = ' 8';
    else if (ua.includes('Windows NT 6.1')) osVersion = ' 7';
  } else if (ua.includes('Mac')) {
    os = 'macOS';
    if (ua.includes('Mac OS X')) {
      const match = ua.match(/Mac OS X (\d+[._]\d+)/);
      if (match) osVersion = ' ' + match[1].replace('_', '.');
    }
  } else if (ua.includes('Linux')) {
    os = 'Linux';
  } else if (ua.includes('Android')) {
    os = 'Android';
  } else if (ua.includes('iOS')) {
    os = 'iOS';
  }

  // Détection Apple Silicon (M1/M2/M3)
  let chip = '';
  let gpu = 'Non disponible';
  let gpuRam = '?';
  const isApple = os === 'macOS';
  
  if (isApple) {
    // Détecter via WebGL
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        if (ext) {
          const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
          if (renderer) {
            gpu = renderer;
            // Standardiser les noms Apple
            if (renderer.includes('Apple')) {
              if (renderer.includes('M1')) {
                chip = 'Apple M1';
                gpu = 'Apple M1';
              } else if (renderer.includes('M2')) {
                chip = 'Apple M2';
                gpu = 'Apple M2';
              } else if (renderer.includes('M3')) {
                chip = 'Apple M3';
                gpu = 'Apple M3';
              } else {
                chip = 'Apple Silicon';
                gpu = 'Apple GPU';
              }
            }
          }
        }
      }
    } catch(e) {}
    
    // Alternative via navigator.oscpu
    if (!chip && navigator.oscpu && navigator.oscpu.includes('Apple')) {
      chip = 'Apple Silicon';
      if (!gpu || gpu === 'Non disponible') gpu = 'Apple GPU';
    }
    
    // Sur Mac, RAM GPU = RAM unifiée
    gpuRam = 'Unifiée';
  }

  // Détection RAM
  let ram = '?';
  if (navigator.deviceMemory) {
    ram = navigator.deviceMemory + ' Go';
  } else if (navigator.systemMemory) {
    ram = (navigator.systemMemory / (1024 * 1024 * 1024)).toFixed(0) + ' Go';
  } else if (window.performance && window.performance.memory) {
    try {
      const memGB = Math.round(window.performance.memory.jsHeapSizeLimit / (1024 * 1024 * 1024));
      if (memGB > 0) {
        ram = memGB + ' Go (est.)';
      }
    } catch(e) {}
  }
  
  // Si toujours pas de RAM, estimation basée sur le chip Apple
  if (ram === '?' && chip) {
    if (chip.includes('M1 Pro') || chip.includes('M1 Max') || chip.includes('M1 Ultra')) {
      ram = '16 Go (est.)';
    } else if (chip.includes('M2')) {
      ram = '16 Go (est.)';
    } else if (chip.includes('M3')) {
      ram = '16 Go (est.)';
    } else if (chip === 'Apple Silicon' || chip.includes('M1')) {
      ram = '16 Go (est.)';
    }
  }
  
  // Détection GPU pour Windows/Linux
  if (!isApple) {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        if (ext) {
          gpu = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
          if (gpu.length > 30) gpu = gpu.substring(0, 30) + '…';
        }
      }
    } catch(e) {}
    
    // Essayer de détecter la RAM GPU (non standard)
    try {
      if (navigator.gpu) {
        // WebGPU API (expérimental)
        navigator.gpu.requestAdapter().then(adapter => {
          if (adapter) {
            gpu = adapter.device.descriptor.label || gpu;
            // RAM GPU non disponible via WebGPU pour l'instant
          }
        });
      }
    } catch(e) {}
  }

  // Browser
  let browser = 'Inconnu';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';

  // Cores
  const cores = navigator.hardwareConcurrency || '?';

  return {
    os: os + osVersion,
    osVersion: osVersion.trim(),
    browser,
    cores,
    chip,
    ram,
    gpu,
    gpuRam,
    isApple
  };
}

/* ═══════════════════════════════════════════
   ÉTAT GLOBAL
═══════════════════════════════════════════ */
let state = {
  runner: 'ollama',
  model: '',
  selectedPrompts: new Set(['conversation']),
  results: [],
  isRunning: false,
  env: {},
  apiKeys: {},
  customBase: '',
};

// Contrôle du benchmark en cours
let currentAbortController = null;
let currentTestState = {
  model: null,
  promptType: null,
  promptText: null,
  maxTokens: 512,
  tokensReceived: 0,
  isStreaming: false,
  startTime: null,
  logs: [],
};

// Flags de contrôle
let skipToNextFlag = false;
let retryCurrentFlag = false;

/* ═══════════════════════════════════════════
   INIT
═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  detectEnvironment();
  renderPromptTypes();
  updateRunnerConfig();
  populateModelSelect();
  loadApiKeys();
  loadHistory();
  updateTime();
  setInterval(updateTime, 30000);
});

/* ═══════════════════════════════════════════
   ENVIRONNEMENT
═══════════════════════════════════════════ */
// Détection complète de l'environnement (appelée au démarrage)
function detectEnvironment() {
  // Charger la config manuelle si elle existe
  loadHardwareConfig();
  
  // Détecter automatiquement le matériel
  const hw = detectFullHardware();
  
  // Fusionner avec la config manuelle (les valeurs manuelles priment)
  const manual = manualHardwareConfig || {};
  
  state.env = {
    os: manual.os || hw.os || 'Inconnu',
    osVersion: manual.osVersion || hw.osVersion || '',
    browser: hw.browser || 'Inconnu',
    cores: hw.cores || '?',
    chip: manual.chip || hw.chip || '',
    ram: manual.ram || hw.ram || '?',
    gpu: manual.gpu || hw.gpu || 'Non disponible',
    gpuRam: manual.gpuRam || (hw.isApple ? 'Unifiée' : hw.gpuRam || '?')
  };
  
  // Mettre à jour l'affichage avec les indicateurs
  updateEnvDisplayWithIndicators();
}

function updateTime() {
  document.getElementById('envTime').textContent =
    new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/* ═══════════════════════════════════════════
   RUNNER
═══════════════════════════════════════════ */
function selectRunner(runner) {
  state.runner = runner;
  document.querySelectorAll(".runner-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.runner === runner);
  });
  updateRunnerConfig();
  populateModelSelect();
  if (RUNNERS[runner].type === "local" || runner === "custom") fetchModels();
}


function updateRunnerConfig() {
  const cfg = document.getElementById('runnerConfig');
  const r   = RUNNERS[state.runner];

  if (state.runner === 'custom') {
    cfg.innerHTML = `
      <div class="form-group">
        <label>URL de base</label>
        <input type="url" id="customBaseUrl" placeholder="http://localhost:8080"
               value="${state.customBase}" oninput="state.customBase=this.value">
      </div>`;
  } else if (r.type === 'local') {
    cfg.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;font-size:0.82rem;color:var(--text2);">
        <span>🔗</span>
        <span>Endpoint : <code class="code-tag">${r.base}</code></span>
      </div>`;
  } else if (r.type === 'api') {
    const hasKey = !!state.apiKeys[state.runner];
    cfg.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;font-size:0.82rem;">
        <span>${hasKey ? '✅' : '⚠️'}</span>
        <span style="color:${hasKey ? 'var(--accent2)' : 'var(--accent5)'}">
          ${hasKey ? 'Clé API configurée' : 'Clé API manquante'}
        </span>
        <button class="btn btn-ghost btn-sm" onclick="openModal('apiModal')">Configurer</button>
      </div>`;
  }
}

/* ═══════════════════════════════════════════
   MODÈLES
═══════════════════════════════════════════ */
function populateModelSelect() {
  const sel    = document.getElementById('modelSelect');
  const models = DEFAULT_MODELS[state.runner] || [];
  sel.innerHTML = '<option value="">— Choisir ou saisir —</option>';
  models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    sel.appendChild(opt);
  });
  if (models.length > 0) sel.value = models[0];
}

async function fetchModels() {
  const status = document.getElementById('modelStatus');
  status.textContent = '⏳ Récupération des modèles…';
  const r = RUNNERS[state.runner];
  if (r.type !== 'local' && state.runner !== 'custom') {
    status.textContent = '⚠️ Auto-détection non disponible pour les APIs externes.';
    return;
  }

  const base = state.runner === 'custom' ? state.customBase : r.base;
  if (!base) { status.textContent = '⚠️ URL de base non définie.'; return; }

  try {
    let models = [];

    if (state.runner === 'ollama') {
      const res = await fetchWithTimeout(`${base}/api/tags`, {}, 10000);
      const data = await res.json();
      models = data.models?.map(m => m.name) || [];
    } else {
      // LM Studio / llama.cpp : endpoint /v1/models (OpenAI-compatible)
      const res = await fetchWithTimeout(`${base}/v1/models`, {}, 10000);
      const data = await res.json();
      models = data.data?.map(m => m.id) || [];
    }

    if (models.length === 0) {
      status.textContent = '⚠️ Aucun modèle trouvé.';
      return;
    }

    const sel = document.getElementById('modelSelect');
    sel.innerHTML = '<option value="">— Choisir —</option>';
    models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m; opt.textContent = m; sel.appendChild(opt);
    });
    sel.value = models[0];
    status.textContent = `✅ ${models.length} modèle(s) trouvé(s)`;
    showToast(`${models.length} modèles détectés`, 'success');
  } catch (e) {
    status.textContent = "❌ Impossible de contacter Ollama. Vérifiez que \`ollama serve\` est lancé ou servez ce fichier via un serveur web (ex: \`python -m http.server\`).";
    showToast('Runner inaccessible', 'error');
  }
}

function getSelectedModel() {
  const custom = document.getElementById('modelCustom').value.trim();
  if (custom) return custom;
  const sel = document.getElementById('modelSelect').value;
  return sel || 'unknown-model';
}

/* ═══════════════════════════════════════════
   PROMPT TYPES UI
═══════════════════════════════════════════ */
function renderPromptTypes() {
  const container = document.getElementById('promptTypesList');
  container.innerHTML = '';

  PROMPT_TYPES.forEach(pt => {
    const item = document.createElement('div');
    item.className = 'prompt-type-item' + (state.selectedPrompts.has(pt.id) ? ' selected' : '');
    item.dataset.id = pt.id;
    item.innerHTML = `
      <div class="prompt-check"></div>
      <span class="prompt-type-emoji">${pt.emoji}</span>
      <div class="prompt-type-info">
        <div class="prompt-type-name">${pt.name}</div>
        <div class="prompt-type-desc">${pt.desc}</div>
      </div>`;
    item.onclick = () => togglePromptType(pt.id, item);
    container.appendChild(item);
  });
}

function togglePromptType(id, el) {
  if (state.selectedPrompts.has(id)) {
    state.selectedPrompts.delete(id);
    el.classList.remove('selected');
  } else {
    state.selectedPrompts.add(id);
    el.classList.add('selected');
  }
  // Afficher/masquer zone prompt custom
  document.getElementById('customPromptArea').classList.toggle(
    'visible', state.selectedPrompts.has('custom')
  );
}

/* ═══════════════════════════════════════════
   LIVE OUTPUT & DEBUG LOGGING
═══════════════════════════════════════════ */

// Afficher le thinking en temps réel
function updateThinkingOutput(text, reset = false) {
  const output = document.getElementById('thinkingOutput');
  if (reset) {
    output.textContent = '';
    return;
  }
  output.textContent += text;
  output.scrollTop = output.scrollHeight;
}

// Mettre à jour le compteur de tokens
function updateTokenProgress(current, max) {
  const counter = document.getElementById('tokenCounter');
  const bar = document.getElementById('tokenProgressBar');
  if (counter) counter.textContent = `Tokens: ${current}/${max}`;
  if (bar) bar.style.width = `${Math.min(100, (current / max) * 100)}%`;
  
  // Avertissement à 90%
  if (current >= max * 0.9 && current < max) {
    addDebugLog(`⚠️ Approche de la limite de tokens (${current}/${max})`, 'warn');
  }
}

// Ajouter un log de débogage
function addDebugLog(message, type = 'info') {
  const logsDiv = document.getElementById('debugLogs');
  const timestamp = new Date().toLocaleTimeString('fr-FR');
  let prefix;
  switch (type) {
    case 'error': prefix = '❌'; break;
    case 'warn': prefix = '⚠️'; break;
    case 'success': prefix = '✅'; break;
    default: prefix = 'ℹ️'; break;
  }
  const logEntry = `[${timestamp}] ${prefix} ${message}`;
  currentTestState.logs.push({ timestamp: Date.now(), type, message });
  
  if (logsDiv) {
    const p = document.createElement('p');
    p.textContent = logEntry;
    p.style.color = type === 'error' ? 'var(--accent3)' : 
                   type === 'warn' ? 'var(--accent5)' : 
                   type === 'success' ? 'var(--accent2)' : 'var(--text2)';
    logsDiv.appendChild(p);
    logsDiv.scrollTop = logsDiv.scrollHeight;
  }
}

// Effacer les logs
function clearDebugLogs() {
  document.getElementById('debugLogs').textContent = '';
  currentTestState.logs = [];
}

// Arrêter le test en cours
function stopCurrentTest() {
  if (currentAbortController) {
    addDebugLog('Arrêt demandé par l\'utilisateur', 'warn');
    currentAbortController.abort();
    currentAbortController = null;
  }
}

// Passer au test suivant (appelé depuis runBenchmark)
function skipToNextTest() {
  skipToNextFlag = true;
  stopCurrentTest();
}

// Recommencer le test en cours
function retryCurrentTest() {
  retryCurrentFlag = true;
  stopCurrentTest();
}

// Réinitialiser les zones live
function resetLiveOutput() {
  updateThinkingOutput('', true);
  updateTokenProgress(0, 100);
  clearDebugLogs();
  currentTestState = {
    model: null,
    promptType: null,
    promptText: null,
    maxTokens: 512,
    tokensReceived: 0,
    isStreaming: false,
    startTime: null,
    logs: [],
  };
}

// Activer/désactiver les boutons de contrôle
function setControlButtons(enabled, stopOnly = false) {
  document.getElementById('stopBtn').disabled = !enabled;
  if (!stopOnly) {
    document.getElementById('nextBtn').disabled = !enabled;
    document.getElementById('retryBtn').disabled = !enabled;
  }
}

// Afficher/masquer les sections live
function showLiveSections(show) {
  document.getElementById('liveOutputSection').style.display = show ? 'block' : 'none';
  document.getElementById('debugLogsSection').style.display = show ? 'block' : 'none';
  document.getElementById('controlButtons').style.display = show ? 'flex' : 'none';
}

/* ═══════════════════════════════════════════
   BENCHMARK ENGINE
═══════════════════════════════════════════ */
async function runBenchmark() {
  if (state.isRunning) return;
  if (state.selectedPrompts.size === 0) {
    showToast('Sélectionnez au moins un type de prompt', 'error'); return;
  }
  const model = getSelectedModel();
  if (!model || model === 'unknown-model') {
    showToast('Veuillez sélectionner un modèle', 'error'); return;
  }

  state.isRunning = true;
  const runBtn = document.getElementById('runBtn');
  runBtn.disabled = true;
  runBtn.innerHTML = '<div class="spinner"></div> Benchmark en cours…';

  const progressSection = document.getElementById('progressSection');
  progressSection.style.display = 'block';

  const selectedTypes  = PROMPT_TYPES.filter(pt => state.selectedPrompts.has(pt.id));
  const repetitions    = parseInt(document.getElementById('repetitions').value) || 1;
  const totalTests     = selectedTypes.length * repetitions;
  let   completedTests = 0;
  const sessionResults = [];

  // Réinitialiser les flags de contrôle
  skipToNextFlag = false;
  retryCurrentFlag = false;

  // Préparer l'affichage résultats
  showResultsArea(true);
  showLiveSections(false);
  setControlButtons(false);

  for (const pt of selectedTypes) {
    // Réinitialiser le flag à chaque nouveau type de prompt
    skipToNextFlag = false;
    
    for (let rep = 0; rep < repetitions; rep++) {
      // Réinitialiser le flag à chaque répétition
      retryCurrentFlag = false;
      
      const progress = (completedTests / totalTests) * 100;
      setProgress(progress, `Test : ${pt.name}${repetitions > 1 ? ` (${rep+1}/${repetitions})` : ''}`);

      const promptText = pt.id === 'custom'
        ? (document.getElementById('customPromptText').value.trim() || 'Dis bonjour.')
        : pt.prompt;

      // Créer un AbortController pour ce test
      const abortController = new AbortController();
      currentAbortController = abortController;

      try {
        // Afficher les sections live pour ce test
        showLiveSections(true);
        setControlButtons(true);
        
        const result = await executeTest(model, pt, promptText, rep + 1, abortController.signal);
        
        // Si l'utilisateur a demandé de passer au suivant, on sort de la boucle de répétition
        if (skipToNextFlag) {
          addDebugLog(`Test ${pt.name} intercepté - Passage au suivant`, 'warn');
          skipToNextFlag = false;
          break;
        }
        
        // Si l'utilisateur a demandé de recommencer, on relance cette répétition
        if (retryCurrentFlag) {
          addDebugLog(`Test ${pt.name} - Relance demandée`, 'info');
          retryCurrentFlag = false;
          rep--; // Décrémenter pour relancer
          continue;
        }
        
        sessionResults.push(result);
        state.results.unshift(result);
        renderResultCard(result);
        completedTests++;
        
      } catch (err) {
        // Masquer les sections live après une erreur
        showLiveSections(false);
        setControlButtons(false);
        
        const errResult = buildErrorResult(model, pt, err.message, rep + 1);
        // Ajouter les logs aux résultats pour le débogage
        errResult.debugLogs = [...currentTestState.logs];
        errResult.tokensReceived = currentTestState.tokensReceived;
        
        sessionResults.push(errResult);
        state.results.unshift(errResult);
        renderResultCard(errResult);
        completedTests++;
        
        // Réinitialiser l'AbortController
        currentAbortController = null;
        
        // Si l'utilisateur a demandé de passer au suivant ou recommencer, gérer ça
        if (skipToNextFlag) {
          skipToNextFlag = false;
          break;
        }
        if (retryCurrentFlag) {
          retryCurrentFlag = false;
          rep--;
          continue;
        }
        
        return; // Sortir complètement sur erreur
      }
      
      // Masquer les sections live entre chaque test
      showLiveSections(false);
      setControlButtons(false);
      currentAbortController = null;
    }
  }

  // Fin du benchmark
  setProgress(100, 'Terminé !');
  document.getElementById('statusDot').className = 'status-dot done';
  showLiveSections(false);
  setControlButtons(false);
  currentAbortController = null;

  // Sauvegarder la session
  saveSessionToHistory({ model, runner: state.runner, results: sessionResults, env: state.env });

  document.getElementById('exportBtn').disabled = false;

  setTimeout(() => {
    progressSection.style.display = 'none';
    runBtn.disabled = false;
    runBtn.innerHTML = '⚡ Lancer le benchmark';
    state.isRunning = false;
    
    // Réinitialiser les flags
    skipToNextFlag = false;
    retryCurrentFlag = false;
  }, 1500);

  showToast(`Benchmark terminé : ${completedTests} test(s)`, 'success');
}

async function executeTest(model, promptType, promptText, rep, signal = null) {
  const temperature = parseFloat(document.getElementById('temperature').value) || 0.7;
  const maxTokens   = parseInt(document.getElementById('maxTokens').value)     || 512;

  const t0 = performance.now();
  let firstTokenTime = null;
  let fullText = '';
  let tokensGenerated = 0;
  
  // Initialiser l'état du test courant
  currentTestState = {
    model: model,
    promptType: promptType,
    promptText: promptText,
    maxTokens: maxTokens,
    tokensReceived: 0,
    isStreaming: false,
    startTime: Date.now(),
    logs: [],
  };
  
  // Réinitialiser l'affichage
  resetLiveOutput();
  showLiveSections(true);
  setControlButtons(true);
  
  // Log du démarrage
  addDebugLog(`Démarrage du test: ${model} - ${promptType.name || promptType.id}`, 'info');
  addDebugLog(`Config: temp=${temperature}, max_tokens=${maxTokens}`, 'info');

  // ── ROUTING ──────────────────────────────────
  if (state.runner === 'ollama') {
    currentTestState.isStreaming = true;
    
    try {
      const res = await fetchWithTimeout(
        `${RUNNERS.ollama.base}/api/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt: promptText, stream: true,
                                 options: { temperature, num_predict: maxTokens } }),
          signal: signal,
        },
        60000
      );
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        // Vérifier si annulé
        if (signal && signal.aborted) {
          addDebugLog('Test annulé par l\'utilisateur', 'warn');
          throw new Error('Test annulé');
        }
        
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(Boolean);
        
        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            
            if (json.response) {
              if (firstTokenTime === null) {
                firstTokenTime = performance.now() - t0;
                addDebugLog(`Premier token reçu (TTFT: ${firstTokenTime.toFixed(0)}ms)`, 'success');
              }
              
              // Afficher en direct
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
            
            // Vérifier limite de tokens
            if (json.done && tokensGenerated >= maxTokens) {
              addDebugLog(`Limite de tokens atteinte: ${tokensGenerated}/${maxTokens}`, 'warn');
            }
            
          } catch(e) {
            addDebugLog(`Erreur parsing JSON: ${e.message}`, 'error');
          }
        }
      }
      
      addDebugLog(`Stream terminé - Tokens totaux: ${tokensGenerated}`, 'info');
      
    } catch (err) {
      if (err.name === 'AbortError') {
        addDebugLog('Requête annulée', 'warn');
        throw new Error('Test annulé par l\'utilisateur');
      }
      throw err;
    } finally {
      currentTestState.isStreaming = false;
    }

  } else if (state.runner === 'lmstudio' || state.runner === 'llamacpp') {
    const base = state.runner === 'lmstudio' ? RUNNERS.lmstudio.base : RUNNERS.llamacpp.base;
    addDebugLog('Envoi requête à LM Studio/llama.cpp (non-streaming)', 'info');
    
    const res = await fetchWithTimeout(
      `${base}/v1/chat/completions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: promptText }],
          temperature, max_tokens: maxTokens, stream: false,
        }),
        signal: signal,
      },
      60000
    );
    const data = await res.json();
    fullText = data.choices?.[0]?.message?.content || '';
    tokensGenerated = data.usage?.completion_tokens || estimateTokens(fullText);
    firstTokenTime = 0;
    
    // Afficher le résultat final (non-streaming)
    updateThinkingOutput(fullText);
    updateTokenProgress(tokensGenerated, maxTokens);
    addDebugLog(`Réponse reçue: ${tokensGenerated} tokens`, 'success');

  } else if (state.runner === 'openai') {
    const key = state.apiKeys['openai'];
    if (!key) throw new Error('Clé API OpenAI manquante');
    addDebugLog('Envoi requête à OpenAI (non-streaming)', 'info');
    
    const res = await fetchWithTimeout(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: promptText }],
          temperature, max_tokens: maxTokens, stream: false,
        }),
        signal: signal,
      },
      60000
    );
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    fullText = data.choices?.[0]?.message?.content || '';
    tokensGenerated = data.usage?.completion_tokens || estimateTokens(fullText);
    firstTokenTime = 0;
    
    updateThinkingOutput(fullText);
    updateTokenProgress(tokensGenerated, maxTokens);
    addDebugLog(`Réponse OpenAI: ${tokensGenerated} tokens`, 'success');

  } else if (state.runner === 'mistral') {
    const key = state.apiKeys['mistral'];
    if (!key) throw new Error('Clé API Mistral manquante');
    addDebugLog('Envoi requête à Mistral (non-streaming)', 'info');
    
    const res = await fetchWithTimeout(
      'https://api.mistral.ai/v1/chat/completions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: promptText }],
          temperature, max_tokens: maxTokens,
        }),
        signal: signal,
      },
      60000
    );
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    fullText = data.choices?.[0]?.message?.content || '';
    tokensGenerated = data.usage?.completion_tokens || estimateTokens(fullText);
    firstTokenTime = 0;
    
    updateThinkingOutput(fullText);
    updateTokenProgress(tokensGenerated, maxTokens);
    addDebugLog(`Réponse Mistral: ${tokensGenerated} tokens`, 'success');

  } else if (state.runner === 'claude') {
    const key = state.apiKeys['claude'];
    if (!key) throw new Error('Clé API Claude manquante');
    addDebugLog('Envoi requête à Claude (non-streaming)', 'info');
    
    const res = await fetchWithTimeout(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: promptText }],
        }),
        signal: signal,
      },
      60000
    );
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    fullText = data.content?.[0]?.text || '';
    tokensGenerated = data.usage?.output_tokens || estimateTokens(fullText);
    firstTokenTime = 0;
    
    updateThinkingOutput(fullText);
    updateTokenProgress(tokensGenerated, maxTokens);
    addDebugLog(`Réponse Claude: ${tokensGenerated} tokens`, 'success');

  } else if (state.runner === 'custom') {
    const base = state.customBase || 'http://localhost:8080';
    addDebugLog(`Envoi requête à ${base} (non-streaming)`, 'info');
    
    const res = await fetchWithTimeout(
      `${base}/v1/chat/completions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: promptText }],
          temperature, max_tokens: maxTokens, stream: false,
        }),
        signal: signal,
      },
      60000
    );
    const data = await res.json();
    fullText = data.choices?.[0]?.message?.content || '';
    tokensGenerated = data.usage?.completion_tokens || estimateTokens(fullText);
    firstTokenTime = 0;
    
    updateThinkingOutput(fullText);
    updateTokenProgress(tokensGenerated, maxTokens);
    addDebugLog(`Réponse Custom: ${tokensGenerated} tokens`, 'success');
  }

  const totalTime     = performance.now() - t0;
  const tokensPerSec  = tokensGenerated > 0 ? (tokensGenerated / (totalTime / 1000)) : 0;
  const ttft          = firstTokenTime !== null ? firstTokenTime : null;

  return {
    id:             crypto.randomUUID(),
    timestamp:      new Date().toISOString(),
    model,
    runner:         RUNNERS[state.runner].name,
    promptType:     promptType.id,
    promptTypeName: promptType.name,
    promptEmoji:    promptType.emoji,
    promptText,
    response:       fullText,
    metrics: {
      totalTokens:   tokensGenerated,
      tokensPerSec:  Math.round(tokensPerSec * 10) / 10,
      ttft:          ttft !== null ? Math.round(ttft) : null,
      totalTime:     Math.round(totalTime),
      temperature,
      maxTokens,
    },
    env:   state.env,
    rep,
    error: null,
  };
}

function buildErrorResult(model, promptType, errorMsg, rep) {
  return {
    id:             crypto.randomUUID(),
    timestamp:      new Date().toISOString(),
    model,
    runner:         RUNNERS[state.runner]?.name || state.runner,
    promptType:     promptType.id,
    promptTypeName: promptType.name,
    promptEmoji:    promptType.emoji,
    promptText:     promptType.prompt || '',
    response:       '',
    metrics:        { totalTokens: 0, tokensPerSec: 0, ttft: null, totalTime: 0 },
    env:            state.env,
    rep,
    error:          errorMsg,
  };
}

/* ═══════════════════════════════════════════
   RENDU RÉSULTATS
═══════════════════════════════════════════ */
function showResultsArea(show) {
  document.getElementById('emptyState').style.display   = show ? 'none' : 'flex';
  document.getElementById('resultsList').style.display  = show ? 'flex' : 'none';
}

function renderResultCard(result) {
  showResultsArea(true);
  const list = document.getElementById('resultsList');

  const card = document.createElement('div');
  card.className = 'result-card';
  card.id = `result-${result.id}`;

  const isError = !!result.error;
  const m = result.metrics;

  const ttftStr = m.ttft !== null ? `${m.ttft} ms` : 'N/A';
  const tpsColor = m.tokensPerSec > 30 ? 'highlight-green'
                 : m.tokensPerSec > 10 ? 'highlight-orange'
                 : 'highlight-purple';

  card.innerHTML = `
    <div class="result-card-header">
      <span class="prompt-type-emoji" style="font-size:1.4rem">${result.promptEmoji}</span>
      <span class="model-name">${result.model}</span>
      <span class="badge badge-blue">${result.runner}</span>
      <span class="badge ${isError ? 'badge-red' : 'badge-green'}">${isError ? '❌ Erreur' : '✅ OK'}</span>
      <span class="badge badge-purple">${result.promptTypeName}</span>
      <small style="color:var(--text3);font-size:0.75rem;margin-left:auto;">
        ${new Date(result.timestamp).toLocaleTimeString('fr-FR')}
      </small>
    </div>
    <div class="result-card-body">
      ${isError ? `
        <div style="background:rgba(247,129,102,0.1);border:1px solid rgba(247,129,102,0.3);
             border-radius:6px;padding:12px;color:var(--accent3);font-size:0.875rem;">
          ⚠️ <strong>Erreur :</strong> ${escapeHtml(result.error)}
        </div>
      ` : `
        <div class="metrics-grid">
          <div class="metric-box highlight-blue">
            <div class="metric-value">${m.totalTokens}</div>
            <div class="metric-label">Tokens générés</div>
          </div>
          <div class="metric-box ${tpsColor}">
            <div class="metric-value">${m.tokensPerSec}</div>
            <div class="metric-label">Tokens / sec</div>
          </div>
          <div class="metric-box highlight-orange">
            <div class="metric-value">${ttftStr}</div>
            <div class="metric-label">1er token (TTFT)</div>
          </div>
          <div class="metric-box">
            <div class="metric-value">${(m.totalTime/1000).toFixed(2)}s</div>
            <div class="metric-label">Temps total</div>
          </div>
        </div>
        <div class="prompt-echo">
          <strong>Prompt :</strong> ${escapeHtml(result.promptText.substring(0, 180))}${result.promptText.length > 180 ? '…' : ''}
        </div>
        <div class="response-block">${escapeHtml(result.response)}</div>
      `}
    </div>`;

  list.insertBefore(card, list.firstChild);
}

/* ═══════════════════════════════════════════
   PROGRESS
═══════════════════════════════════════════ */
function setProgress(percent, detail) {
  document.getElementById('progressBar').style.width   = percent + '%';
  document.getElementById('statusText').textContent    = detail;
  document.getElementById('progressDetail').textContent = `${Math.round(percent)}% complété`;
}

/* ═══════════════════════════════════════════
   EXPORT MARKDOWN
═══════════════════════════════════════════ */
function exportMarkdown() {
  if (state.results.length === 0) {
    showToast('Aucun résultat à exporter', 'error'); return;
  }

  const now    = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { year:'numeric', month:'long', day:'numeric' });
  const timeStr = now.toLocaleTimeString('fr-FR');
  const env    = state.results[0]?.env || {};

  let md = `# 📊 Rapport de Benchmark LLM\n\n`;
  md += `> Généré le ${dateStr} à ${timeStr} par **LLM Benchmarker v0.01**\n\n`;
  md += `---\n\n`;

  // Environnement
  md += `## 💻 Environnement de test\n\n`;
  md += `| Paramètre | Valeur |\n|-----------|--------|\n`;
  md += `| Système d'exploitation | ${env.os || 'N/A'} |\n`;
  md += `| Navigateur | ${env.browser || 'N/A'} |\n`;
  md += `| Cœurs CPU | ${env.cores || 'N/A'} |\n`;
  md += `| RAM (approx.) | ${env.ram || 'N/A'} |\n`;
  md += `| GPU | ${env.gpu || 'N/A'} |\n\n`;

  // Résumé
  md += `## 📈 Résumé des tests\n\n`;
  md += `| # | Modèle | Runner | Type | Tokens | Tok/s | TTFT | Temps total | Statut |\n`;
  md += `|---|--------|--------|------|--------|-------|------|-------------|--------|\n`;

  state.results.forEach((r, i) => {
    const m = r.metrics;
    const ttftStr = m.ttft !== null ? `${m.ttft} ms` : 'N/A';
    const status  = r.error ? '❌ Erreur' : '✅ OK';
    md += `| ${i+1} | \`${r.model}\` | ${r.runner} | ${r.promptEmoji} ${r.promptTypeName} | ${m.totalTokens} | ${m.tokensPerSec} | ${ttftStr} | ${(m.totalTime/1000).toFixed(2)}s | ${status} |\n`;
  });

  md += `\n---\n\n`;

  // Détail par test
  md += `## 🔍 Détail des tests\n\n`;

  state.results.forEach((r, i) => {
    const m = r.metrics;
    md += `### Test ${i+1} — ${r.promptEmoji} ${r.promptTypeName}\n\n`;
    md += `**Modèle :** \`${r.model}\` | **Runner :** ${r.runner} | **Date :** ${new Date(r.timestamp).toLocaleString('fr-FR')}\n\n`;

    if (r.error) {
      md += `**Statut :** ❌ Erreur\n\n`;
      md += `**Message d'erreur :**\n\`\`\`\n${r.error}\n\`\`\`\n\n`;
    } else {
      md += `#### Métriques\n\n`;
      md += `| Métrique | Valeur |\n|----------|--------|\n`;
      md += `| Tokens générés | ${m.totalTokens} |\n`;
      md += `| Tokens / seconde | ${m.tokensPerSec} |\n`;
      md += `| Temps 1er token (TTFT) | ${m.ttft !== null ? m.ttft + ' ms' : 'N/A'} |\n`;
      md += `| Temps total | ${(m.totalTime/1000).toFixed(2)} s |\n`;
      md += `| Température | ${m.temperature} |\n`;
      md += `| Tokens max | ${m.maxTokens} |\n\n`;

      md += `#### Prompt\n\n`;
      md += '\`\`\`\n' + r.promptText + '\n\`\`\`\n\n';

      md += `#### Réponse\n\n`;
      md += '\`\`\`\n' + r.response + '\n\`\`\`\n\n';
    }

    md += `---\n\n`;
  });

  md += `*Rapport généré automatiquement par LLM Benchmarker v0.01*\n`;

  // Téléchargement
  const blob     = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  const modelName = (state.results[0]?.model || 'unknown').replace(/[\/:*?"<>|]/g, '-');
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const filename = `LLMB-${modelName}-${yyyy}${mm}${dd}-${hh}${min}.md`;
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  showToast(`Exporté : ${filename}`, 'success');
}

/* ═══════════════════════════════════════════
   HISTORIQUE (localStorage)
═══════════════════════════════════════════ */
function saveSessionToHistory(session) {
  try {
    const history = JSON.parse(localStorage.getItem('llm_bench_history') || '[]');
    history.unshift({ ...session, savedAt: new Date().toISOString() });
    if (history.length > 50) history.splice(50);
    localStorage.setItem('llm_bench_history', JSON.stringify(history));
  } catch(e) { console.error('Erreur sauvegarde:', e); }
}

function loadHistory() {
  try {
    const history = JSON.parse(localStorage.getItem('llm_bench_history') || '[]');
    const container = document.getElementById('historyContainer');

    if (history.length === 0) {
      container.innerHTML = '<p style="color:var(--text3);font-size:0.875rem;text-align:center;padding:20px;">Aucune session sauvegardée.</p>';
      return;
    }

    let html = `<div style="overflow-x:auto"><table class="history-table">
      <thead><tr>
        <th>Date</th><th>Modèle</th><th>Runner</th>
        <th>Tests</th><th>Moy. tok/s</th><th>Actions</th>
      </tr></thead><tbody>`;

    history.forEach((session, idx) => {
      const date   = new Date(session.savedAt).toLocaleString('fr-FR');
      const count  = session.results?.length || 0;
      const avgTPS = count > 0
        ? Math.round(session.results.reduce((a, r) => a + (r.metrics?.tokensPerSec || 0), 0) / count * 10) / 10
        : 0;

      html += `<tr>
        <td>${date}</td>
        <td><code class="code-tag">${escapeHtml(session.model)}</code></td>
        <td>${escapeHtml(session.runner)}</td>
        <td><span class="badge badge-blue">${count}</span></td>
        <td><strong style="color:var(--accent2)">${avgTPS}</strong></td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="restoreSession(${idx})">↩ Restaurer</button>
        </td>
      </tr>`;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  } catch(e) { console.error('Erreur chargement historique:', e); }
}

function restoreSession(idx) {
  try {
    const history = JSON.parse(localStorage.getItem('llm_bench_history') || '[]');
    const session = history[idx];
    if (!session) return;
    state.results = [...(session.results || []), ...state.results];
    showResultsArea(true);
    session.results.forEach(r => renderResultCard(r));
    document.getElementById('exportBtn').disabled = false;
    switchTab('results');
    showToast(`Session restaurée : ${session.results.length} résultat(s)`, 'success');
  } catch(e) { showToast('Erreur de restauration', 'error'); }
}

function clearHistory() {
  if (!confirm('Vider tout l\'historique ?')) return;
  localStorage.removeItem('llm_bench_history');
  loadHistory();
  showToast('Historique vidé', 'info');
}

/* ═══════════════════════════════════════════
   CLEAR RÉSULTATS
═══════════════════════════════════════════ */
function clearAllResults() {
  if (state.results.length === 0) return;
  if (!confirm('Vider les résultats actuels ?')) return;
  state.results = [];
  document.getElementById('resultsList').innerHTML = '';
  showResultsArea(false);
  document.getElementById('exportBtn').disabled = true;
  showToast('Résultats effacés', 'info');
}

/* ═══════════════════════════════════════════
   CLÉS API
═══════════════════════════════════════════ */
function loadApiKeys() {
  try {
    state.apiKeys = JSON.parse(localStorage.getItem('llm_bench_keys') || '{}');
    document.getElementById('keyOpenAI').value  = state.apiKeys.openai  || '';
    document.getElementById('keyMistral').value = state.apiKeys.mistral || '';
    document.getElementById('keyClaude').value  = state.apiKeys.claude  || '';
  } catch(e) {}
}

function saveApiKeys() {
  state.apiKeys = {
    openai:  document.getElementById('keyOpenAI').value.trim(),
    mistral: document.getElementById('keyMistral').value.trim(),
    claude:  document.getElementById('keyClaude').value.trim(),
  };
  localStorage.setItem('llm_bench_keys', JSON.stringify(state.apiKeys));
  closeModal('apiModal');
  updateRunnerConfig();
  showToast('Clés API sauvegardées', 'success');
}

/* ═══════════════════════════════════════════
   CONNECTIVITÉ
═══════════════════════════════════════════ */
async function testConnectivity() {
  const container = document.getElementById('connectivityResults');
  const localRunners = [
    { name: 'Ollama', url: 'http://localhost:11434/api/tags' },
    { name: 'LM Studio', url: 'http://localhost:1234/v1/models' },
    { name: 'llama.cpp', url: 'http://localhost:8080/v1/models' },
  ];

  container.innerHTML = localRunners.map(r =>
    `<div id="conn-${r.name}" style="display:flex;align-items:center;gap:10px;font-size:0.85rem;">
       <div class="spinner"></div> <span>Test ${r.name}…</span>
     </div>`
  ).join('');

  for (const runner of localRunners) {
    const el = document.getElementById(`conn-${runner.name}`);
    try {
      await fetchWithTimeout(runner.url, {}, 3000);
      el.innerHTML = `<span style="color:var(--accent2)">✅</span> <strong>${runner.name}</strong>
                      <span style="color:var(--text3)">${runner.url}</span>
                      <span class="badge badge-green">Accessible</span>`;
    } catch(_) {
      el.innerHTML = `<span style="color:var(--accent3)">❌</span> <strong>${runner.name}</strong>
                      <span style="color:var(--text3)">${runner.url}</span>
                      <span class="badge badge-red">Inaccessible</span>`;
    }
  }
}

/* ═══════════════════════════════════════════
   UTILITAIRES
═══════════════════════════════════════════ */
function fetchWithTimeout(url, options = {}, timeout = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id));
}

function estimateTokens(text) {
  // Estimation grossière : ~4 caractères par token
  return Math.ceil(text.length / 4);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHtmlForMarkdown(str) {
  if (!str) return "";
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/`/g, "\\`")
    .replace(/\[/g, "\\\[")
    .replace(/\]/g, "\\\]")
    .replace(/\+/g, "\\+")
    .replace(/\-/g, "\\-")
    .replace(/\=/g, "\\=")
    .replace(/\|/g, "\\|");
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast     = document.createElement('div');
  const icons     = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || '•'}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// Fermer modal sur clic extérieur
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach((b, i) => {
    const tabNames = ['results', 'history', 'about'];
    b.classList.toggle('active', tabNames[i] === name);
  });
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.toggle('active', c.id === `tab-${name}`);
  });
  if (name === 'history') loadHistory();
}
