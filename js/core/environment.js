/**
 * LLM Benchmarker - Hardware Detection & Configuration
 * Handles environment detection, hardware info, and manual configuration
 */

// Backend environment config
window.BACKEND_ENV_CONFIG = {
  url: 'http://localhost:3001',
  timeout: 2000
};

/**
 * Fetch environment from backend server
 * Returns promise with backend env data or null
 */
async function fetchBackendEnvironment() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), window.BACKEND_ENV_CONFIG.timeout);
    
    const response = await fetch(window.BACKEND_ENV_CONFIG.url + '/api/environment', {
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        return data;
      }
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Full hardware detection using various browser APIs
function detectFullHardware() {
  var ua = navigator.userAgent;
  var os = 'Inconnu', osVersion = '';
  
  if (ua.includes('Windows')) {
    os = 'Windows';
    if (ua.includes('Windows NT 10.0')) osVersion = ' 10/11';
    else if (ua.includes('Windows NT 6.3')) osVersion = ' 8.1';
    else if (ua.includes('Windows NT 6.2')) osVersion = ' 8';
    else if (ua.includes('Windows NT 6.1')) osVersion = ' 7';
  } else if (ua.includes('Mac')) {
    os = 'macOS';
    if (ua.includes('Mac OS X')) {
      var match = ua.match(/Mac OS X (\d+[._]\d+)/);
      if (match) osVersion = ' ' + match[1].replace('_', '.');
    }
  } else if (ua.includes('Linux')) {
    os = 'Linux';
  } else if (ua.includes('Android')) {
    os = 'Android';
  } else if (ua.includes('iOS')) {
    os = 'iOS';
  }

  var chip = '', gpu = 'Non disponible', gpuRam = '?';
  var isApple = (os === 'macOS');
  
  if (isApple) {
    try {
      var canvas = document.createElement('canvas');
      var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        var ext = gl.getExtension('WEBGL_debug_renderer_info');
        if (ext) {
          var renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
          if (renderer) {
            gpu = renderer;
            if (renderer.includes('Apple')) {
              if (renderer.includes('M1')) { chip = 'Apple M1'; gpu = 'Apple M1';
              } else if (renderer.includes('M2')) { chip = 'Apple M2'; gpu = 'Apple M2';
              } else if (renderer.includes('M3')) { chip = 'Apple M3'; gpu = 'Apple M3';
              } else { chip = 'Apple Silicon'; gpu = 'Apple GPU'; }
            }
          }
        }
      }
    } catch(e) {}
    
    if (!chip && navigator.oscpu && navigator.oscpu.includes('Apple')) {
      chip = 'Apple Silicon';
      if (!gpu || gpu === 'Non disponible') gpu = 'Apple GPU';
    }
    gpuRam = 'Unifiée';
  }

  // RAM detection
  var ram = '?';
  if (navigator.deviceMemory) {
    ram = navigator.deviceMemory + ' Go';
  } else if (navigator.systemMemory) {
    ram = (navigator.systemMemory / (1024 * 1024 * 1024)).toFixed(0) + ' Go';
  } else if (window.performance && window.performance.memory) {
    try {
      var memGB = Math.round(window.performance.memory.jsHeapSizeLimit / (1024 * 1024 * 1024));
      if (memGB > 0) ram = memGB + ' Go (est.)';
    } catch(e) {}
  }
  
  // Estimate RAM based on chip for Apple
  if (ram === '?' && chip) {
    if (chip.includes('M1 Pro') || chip.includes('M1 Max') || chip.includes('M1 Ultra')) {
      ram = '16 Go (est.)';
    } else if (chip.includes('M2') || chip.includes('M3') || chip === 'Apple Silicon' || chip.includes('M1')) {
      ram = '16 Go (est.)';
    }
  }

  if (!isApple) {
    try {
      var canvas2 = document.createElement('canvas');
      var gl2 = canvas2.getContext('webgl') || canvas2.getContext('experimental-webgl');
      if (gl2) {
        var ext2 = gl2.getExtension('WEBGL_debug_renderer_info');
        if (ext2) {
          gpu = gl2.getParameter(ext2.UNMASKED_RENDERER_WEBGL);
          if (gpu.length > 30) gpu = gpu.substring(0, 30) + '…';
        }
      }
    } catch(e) {}
    
    try {
      if (navigator.gpu) {
        navigator.gpu.requestAdapter().then(function(adapter) {
          if (adapter) gpu = adapter.device.descriptor.label || gpu;
        });
      }
    } catch(e) {}
  }

  // Browser detection
  var browser = 'Inconnu';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';

  var cores = navigator.hardwareConcurrency || '?';

  return { 
    os: os + osVersion, 
    osVersion: osVersion.trim(), 
    browser: browser, 
    cores: cores, 
    chip: chip, 
    ram: ram, 
    gpu: gpu, 
    gpuRam: gpuRam, 
    isApple: isApple 
  };
}

// Detect environment and populate state (async now)
async function detectEnvironment() {
  var hw = detectFullHardware();
  var manual = manualHardwareConfig || {};
  
  // Try to fetch from backend first
  var backendEnv = null;
  try {
    backendEnv = await fetchBackendEnvironment();
  } catch (e) {
    // Silently fail - will use browser detection
  }
  
  // Build environment from best available source
  // Priority: Manual > Backend > Browser
  state.env = {
    os: manual.os || (backendEnv ? backendEnv.os.name + (backendEnv.os.version ? ' ' + backendEnv.os.version : '') : hw.os) || 'Inconnu',
    osVersion: manual.osVersion || (backendEnv ? backendEnv.os.version : hw.osVersion) || '',
    browser: hw.browser || 'Inconnu',
    cores: manual.cores || (backendEnv ? backendEnv.cpu.cores : hw.cores) || '?',
    chip: manual.chip || (backendEnv ? backendEnv.machine.model : hw.chip) || '',
    ram: manual.ram || (backendEnv ? backendEnv.memory.totalStr : hw.ram) || '?',
    gpu: manual.gpu || (backendEnv ? backendEnv.gpu.model : hw.gpu) || 'Non disponible',
    gpuRam: manual.gpuRam || (backendEnv ? backendEnv.gpu.vramStr : (hw.isApple ? 'Unifiée' : hw.gpuRam)) || '?'
  };
  
  // Store backend availability for debugging
  if (backendEnv) {
    addDebugLog('✅ Environnement détecté via backend (précis)', 'success');
  }
  
  updateEnvDisplayWithIndicators();
}

// Load saved hardware configuration from localStorage
function loadHardwareConfig() {
  try {
    var saved = localStorage.getItem(HARDWARE_CONFIG_KEY);
    if (saved) manualHardwareConfig = JSON.parse(saved);
  } catch (e) {}
  return manualHardwareConfig;
}

// Load and apply hardware configuration (async to try backend)
async function loadAndApplyHardwareConfig() {
  var hw = detectFullHardware();
  var config = manualHardwareConfig || {};
  
  // Try backend if manual config not set
  var backendEnv = null;
  if (!config.os && !config.chip && !config.ram) {
    try {
      backendEnv = await fetchBackendEnvironment();
    } catch (e) {}
  }
  
  state.env = {
    os: config.os || (backendEnv ? backendEnv.os.name + (backendEnv.os.version ? ' ' + backendEnv.os.version : '') : hw.os) || 'Inconnu',
    osVersion: config.osVersion || (backendEnv ? backendEnv.os.version : hw.osVersion) || '',
    browser: hw.browser || 'Inconnu',
    cores: config.cores || (backendEnv ? backendEnv.cpu.cores : hw.cores) || '?',
    chip: config.chip || (backendEnv ? backendEnv.machine.model : hw.chip) || '',
    ram: config.ram || (backendEnv ? backendEnv.memory.totalStr : hw.ram) || '?',
    gpu: config.gpu || (backendEnv ? backendEnv.gpu.model : hw.gpu) || 'Non disponible',
    gpuRam: config.gpuRam || (backendEnv ? backendEnv.gpu.vramStr : (hw.isApple ? 'Unifiée' : hw.gpuRam)) || '?'
  };
  updateEnvDisplayWithIndicators();
}

// Update environment display with manual/auto indicators
function updateEnvDisplayWithIndicators() {
  var isManual = !!manualHardwareConfig;
  var config = manualHardwareConfig || {};
  var fields = [
    { id: 'envOS', value: state.env.os, manual: isManual && config.os },
    { id: 'envBrowser', value: state.env.browser, manual: false },
    { id: 'envCores', value: (state.env.cores || '?') + (state.env.cores !== '?' ? ' vCPU' : ''), manual: false },
    { id: 'envChip', value: state.env.chip, manual: isManual && config.chip, display: !!state.env.chip },
    { id: 'envRAM', value: state.env.ram, manual: isManual && config.ram },
    { id: 'envGPU', value: state.env.gpu, manual: isManual && config.gpu },
    { id: 'envGPURam', value: state.env.gpuRam || '?', manual: isManual && config.gpuRam }
  ];
  for (var i = 0; i < fields.length; i++) {
    var field = fields[i];
    var el = document.getElementById(field.id);
    if (el) {
      el.textContent = field.value;
      el.className = 'env-value' + (field.manual ? ' manual' : '');
      if (field.display !== undefined) {
        el.style.display = field.display ? 'block' : 'none';
      }
    }
  }
}

// Open hardware configuration modal with current values
function openHardwareConfigModal() {
  var config = manualHardwareConfig || {};
  document.getElementById('manualOS').value = config.os || state.env.os || '';
  document.getElementById('manualOSVersion').value = config.osVersion || state.env.osVersion || '';
  document.getElementById('manualChip').value = config.chip || state.env.chip || '';
  document.getElementById('manualRAM').value = config.ram || state.env.ram || '';
  document.getElementById('manualGPU').value = config.gpu || state.env.gpu || '';
  var gpuRamSelect = document.getElementById('manualGPURam');
  gpuRamSelect.value = config.gpuRam || state.env.gpuRam || '';
  
  var osSelect = document.getElementById('manualOS');
  
  function updateGpuRamVisibility() {
    var isApple = osSelect.value === 'macOS';
    var opts = gpuRamSelect.querySelectorAll('option');
    for (var j = 0; j < opts.length; j++) {
      opts[j].style.display = isApple && opts[j].value !== '' && opts[j].value !== 'unified' ? 'none' : '';
    }
    if (isApple && !gpuRamSelect.value) gpuRamSelect.value = 'unified';
    if (!isApple && gpuRamSelect.value === 'unified') gpuRamSelect.value = '';
  }
  
  osSelect.addEventListener('change', updateGpuRamVisibility);
  updateGpuRamVisibility();
  openModal('hardwareModal');
}

// Save hardware configuration to localStorage
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
  try {
    localStorage.setItem(HARDWARE_CONFIG_KEY, JSON.stringify(manualHardwareConfig));
    showToast('Configuration matérielle sauvegardée', 'success');
  } catch (e) { showToast('Erreur lors de la sauvegarde', 'error'); }
  loadAndApplyHardwareConfig().catch(function(err) {
    console.error('Failed to load hardware config:', err);
  });
  closeModal('hardwareModal');
}

// Reset hardware configuration to auto-detection
function resetHardwareConfig() {
  manualHardwareConfig = null;
  try {
    localStorage.removeItem(HARDWARE_CONFIG_KEY);
    showToast('Configuration réinitialisée - détection automatique', 'success');
  } catch (e) { showToast('Erreur lors de la réinitialisation', 'error'); }
  detectEnvironment().catch(function(err) {
    console.error('Environment detection failed:', err);
  });
  closeModal('hardwareModal');
}
