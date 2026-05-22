/**
 * LLM Benchmarker - Advanced Configuration
 * Handles Auto/Manual mode and per-prompt-type settings
 */

// Default temperatures for each prompt type in Auto mode
window.DEFAULT_TEMPERATURES = {
  'conversation': 0.7,
  'factual': 0.2,
  'math': 0.1,
  'code': 0.2,
  'creative': 1.0,
  'logic': 0.3,
  'custom': 0.7
};

// Auto mode settings
window.AUTO_MODE_SETTINGS = {
  maxTokens: 32768,
  repetitions: 1
};

// Storage key for advanced config
const ADVANCED_CONFIG_KEY = 'llm_bench_advanced_config';

// Current mode state
let isManualMode = true; // Default to Manual
let selectedGPU = 'auto'; // Default to auto selection

/**
 * Initialize advanced configuration
 */
async function initAdvancedConfig() {
  // Load saved config
  loadAdvancedConfig();
  
  // Initialize toggle state from stored mode or default to Manual
  const savedMode = localStorage.getItem('llm_bench_mode');
  isManualMode = savedMode !== 'auto';
  
  // Initialize GPU selection
  const savedGPU = localStorage.getItem('llm_bench_selected_gpu');
  if (savedGPU) selectedGPU = savedGPU;
  
  // Update UI based on mode
  updateModeUI();
  
  // Render prompt type configs in modal
  renderPromptTypeConfigs();
  
  // Initialize GPU selector
  await initGPUSelector();
}

/**
 * Toggle between Auto and Manual mode
 */
function toggleManualMode() {
  isManualMode = !isManualMode;
  
  // Save mode preference
  localStorage.setItem('llm_bench_mode', isManualMode ? 'manual' : 'auto');
  
  // Update UI
  updateModeUI();
  
  // Show toast notification
  const modeName = isManualMode ? 'Manuel' : 'Auto';
  showToast('Mode ' + modeName + ' activé', 'success');
}

/**
 * Update UI based on current mode
 */
function updateModeUI() {
  const toggle = document.getElementById('manualModeToggle');
  const modeLabel = document.getElementById('modeLabel');
  const autoSettings = document.getElementById('autoModeSettings');
  const manualSettings = document.getElementById('manualModeSettings');
  
  if (toggle) toggle.checked = isManualMode;
  if (modeLabel) modeLabel.textContent = isManualMode ? 'Manuel' : 'Auto';
  if (autoSettings) autoSettings.style.display = isManualMode ? 'none' : 'block';
  if (manualSettings) manualSettings.style.display = isManualMode ? 'block' : 'none';
  
  // Enable/disable manual inputs
  const tempInput = document.getElementById('temperature');
  const tokensInput = document.getElementById('maxTokens');
  const repsInput = document.getElementById('repetitions');
  
  if (tempInput) tempInput.disabled = !isManualMode;
  if (tokensInput) tokensInput.disabled = !isManualMode;
  if (repsInput) repsInput.disabled = !isManualMode;
}

/**
 * Get temperature for a prompt type
 * In Auto mode, uses predefined temperatures; in Manual mode, uses global setting
 */
function getTemperatureForPromptType(promptTypeId) {
  const manualTemp = parseFloat(document.getElementById('temperature')?.value) || 0.7;
  
  if (isManualMode) {
    // In Manual mode, check if we have per-type config
    const savedConfig = loadAdvancedConfig();
    if (savedConfig && savedConfig.temperatures && savedConfig.temperatures[promptTypeId] !== undefined) {
      return savedConfig.temperatures[promptTypeId];
    }
    return manualTemp;
  } else {
    // In Auto mode, use predefined temperature for this type
    return window.DEFAULT_TEMPERATURES[promptTypeId] || 0.7;
  }
}

/**
 * Get max tokens setting
 * In Auto mode, uses fixed value; in Manual mode, uses input value
 */
function getMaxTokens() {
  if (isManualMode) {
    return parseInt(document.getElementById('maxTokens')?.value) || 4096;
  } else {
    return window.AUTO_MODE_SETTINGS.maxTokens;
  }
}

/**
 * Get repetitions setting
 * In Auto mode, uses fixed value; in Manual mode, uses input value
 */
function getRepetitions() {
  if (isManualMode) {
    return parseInt(document.getElementById('repetitions')?.value) || 1;
  } else {
    return window.AUTO_MODE_SETTINGS.repetitions;
  }
}

/**
 * Render prompt type configurations in the modal
 */
function renderPromptTypeConfigs() {
  const container = document.getElementById('promptTypeConfigs');
  if (!container) return;
  
  const savedConfig = loadAdvancedConfig();
  let html = '';
  
  PROMPT_TYPES.forEach(function(pt) {
    if (pt.id === 'custom') return; // Skip custom for now
    
    const currentTemp = savedConfig?.temperatures?.[pt.id] !== undefined 
      ? savedConfig.temperatures[pt.id] 
      : window.DEFAULT_TEMPERATURES[pt.id];
    
    html += `
      <div class="form-group" style="margin-bottom: 12px; padding: 8px; background: var(--bg2); border-radius: 6px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <label style="margin: 0; font-weight: 600;">${pt.emoji} ${pt.name}</label>
          <span style="font-size: 0.75rem; color: var(--text3);">Défaut: ${window.DEFAULT_TEMPERATURES[pt.id]}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <input type="number" 
                 id="temp_${pt.id}" 
                 value="${currentTemp}" 
                 min="0" 
                 max="2" 
                 step="0.1"
                 style="flex: 1;">
          <button class="btn btn-ghost btn-xs" onclick="resetTempToDefault('${pt.id}')">↺ Réinit</button>
        </div>
        <small style="color: var(--text3); margin-top: 4px; display: block;">${pt.desc}</small>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

/**
 * Reset temperature to default for a prompt type
 */
function resetTempToDefault(promptTypeId) {
  const input = document.getElementById('temp_' + promptTypeId);
  if (input) {
    input.value = window.DEFAULT_TEMPERATURES[promptTypeId];
  }
}

/**
 * Open advanced config modal
 */
function openAdvancedConfigModal() {
  // Make sure configs are rendered
  renderPromptTypeConfigs();
  openModal('advancedConfigModal');
}

/**
 * Save advanced configuration
 */
function saveAdvancedConfig() {
  const config = {
    temperatures: {},
    savedAt: new Date().toISOString()
  };
  
  // Save temperatures for each prompt type
  PROMPT_TYPES.forEach(function(pt) {
    if (pt.id === 'custom') return;
    const input = document.getElementById('temp_' + pt.id);
    if (input) {
      config.temperatures[pt.id] = parseFloat(input.value);
    }
  });
  
  // Save to localStorage
  try {
    localStorage.setItem(ADVANCED_CONFIG_KEY, JSON.stringify(config));
    showToast('Configuration avancée sauvegardée', 'success');
  } catch (e) {
    showToast('Erreur lors de la sauvegarde', 'error');
  }
  
  closeModal('advancedConfigModal');
}

/**
 * Load advanced configuration from localStorage
 */
function loadAdvancedConfig() {
  try {
    const saved = localStorage.getItem(ADVANCED_CONFIG_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load advanced config:', e);
  }
  return null;
}

/**
 * Reset advanced configuration to defaults
 */
function resetAdvancedConfig() {
  try {
    localStorage.removeItem(ADVANCED_CONFIG_KEY);
    renderPromptTypeConfigs();
    showToast('Configuration avancée réinitialisée', 'success');
  } catch (e) {
    showToast('Erreur lors de la réinitialisation', 'error');
  }
}

/**
 * Initialize GPU selector with detected GPUs
 */
async function initGPUSelector() {
  try {
    // Fetch GPU info from backend
    const backendEnv = await fetchBackendEnvironment();
    let gpus = [];
    
    if (backendEnv && backendEnv.gpu && backendEnv.gpu.all) {
      gpus = backendEnv.gpu.all;
    }
    
    // If no backend or only 1 GPU, check if we should show selector
    const selector = document.getElementById('selectedGPU');
    const selectorGroup = document.getElementById('gpuSelectorGroup');
    
    if (!selector || !selectorGroup) return;
    
    if (gpus.length <= 1) {
      // Hide selector if only 1 GPU
      selectorGroup.style.display = 'none';
      return;
    }
    
    // Show selector if multiple GPUs
    selectorGroup.style.display = 'block';
    
    // Clear existing options (except "Auto")
    selector.innerHTML = '<option value="auto">Auto (Détection intelligente)</option>';
    
    // Add each GPU as an option
    gpus.forEach((gpu, index) => {
      const option = document.createElement('option');
      option.value = index.toString();
      option.textContent = `${gpu.model} ${gpu.vram ? `(${gpu.vram})` : ''} ${gpu.type === 'integrated' ? '(iGPU)' : '(dGPU)'}`;
      
      // Select if this matches the saved selection
      if (selectedGPU === index.toString()) {
        option.selected = true;
      }
      
      selector.appendChild(option);
    });
    
    // If no selection or selection is invalid, select "auto"
    if (!gpus[parseInt(selectedGPU)] && selectedGPU !== 'auto') {
      selector.value = 'auto';
      selectedGPU = 'auto';
      saveSelectedGPU();
    }
    
  } catch (err) {
    console.error('Failed to initialize GPU selector:', err);
    // Hide selector on error
    const selectorGroup = document.getElementById('gpuSelectorGroup');
    if (selectorGroup) selectorGroup.style.display = 'none';
  }
}

/**
 * Save selected GPU to localStorage
 */
function saveSelectedGPU() {
  const selector = document.getElementById('selectedGPU');
  if (selector) {
    selectedGPU = selector.value;
    try {
      localStorage.setItem('llm_bench_selected_gpu', selectedGPU);
      
      // Show instruction for Ollama restart
      if (selectedGPU !== 'auto') {
        const gpuIndex = parseInt(selectedGPU);
        const gpuSelector = document.getElementById('selectedGPU');
        const selectedOption = gpuSelector?.options[gpuSelector.selectedIndex];
        const gpuName = selectedOption?.textContent.replace('Auto (Détection intelligente)', '').trim() || '';
        
        showToast(`GPU sélectionné: ${gpuName}. Redémarrez Ollama avec CUDA_VISIBLE_DEVICES=${selectedGPU} ollama serve`, 'info', 8000);
      }
    } catch (e) {
      console.error('Failed to save selected GPU:', e);
    }
  }
}

/**
 * Get selected GPU index or 'auto'
 */
function getSelectedGPU() {
  return selectedGPU;
}

/**
 * Get CUDA_VISIBLE_DEVICES value for selected GPU
 * Returns empty string for 'auto' mode
 */
function getCUDAVisibleDevices() {
  if (selectedGPU === 'auto') {
    return '';
  }
  const index = parseInt(selectedGPU);
  if (!isNaN(index) && index >= 0) {
    return index.toString();
  }
  return '';
}

// Initialize on page load
initAdvancedConfig();
