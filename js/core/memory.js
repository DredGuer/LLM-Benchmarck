/**
 * LLM Benchmarker - Memory Monitoring for Ollama
 * Monitors RAM usage during Ollama model execution
 * 
 * Priority:
 * 1. If backend server is running (localhost:3001), use it for process memory
 * 2. Fallback to browser performance.memory API (Chrome with flag)
 * 3. Last fallback: no monitoring
 */

// Configuration
window.MEMORY_MONITOR_CONFIG = {
  backendUrl: 'http://localhost:3001',
  pollInterval: 500, // ms
  timeout: 2000 // ms
};

// Global to track memory during tests
ollamaMemoryMonitor = {
  peakMemory: 0,
  currentMemory: 0,
  memoryReadings: [],
  monitoringInterval: null,
  isActive: false,
  backendAvailable: false,
  
  /**
   * Initialize - check if backend is available
   */
  init: async function() {
    addDebugLog('[MEMORY] Initializing memory monitor...', 'info');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      
      addDebugLog('[MEMORY] Checking backend at: ' + this._getBackendUrl('/api/ollama/status'), 'info');
      const response = await fetch(this._getBackendUrl('/api/ollama/status'), {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      addDebugLog('[MEMORY] Backend status response: ' + response.status + ' ' + response.statusText, 'info');
      this.backendAvailable = response.ok;
      if (this.backendAvailable) {
        addDebugLog('✅ Backend de monitoring RAM détecté sur port 3001', 'success');
      } else {
        addDebugLog('⚠️ Backend non disponible (statut: ' + response.status + ')', 'warn');
      }
    } catch (err) {
      this.backendAvailable = false;
      addDebugLog('[MEMORY] Backend check failed: ' + err.message, 'error');
      addDebugLog('⚠️ Backend monitoring RAM non détecté : ' + err.message, 'warn');
    }
  },
  
  /**
   * Start monitoring memory usage
   */
  start: function() {
    addDebugLog('[MEMORY] Starting memory monitoring. backendAvailable=' + this.backendAvailable, 'info');
    this.peakMemory = 0;
    this.currentMemory = 0;
    this.memoryReadings = [];
    this.isActive = true;
    
    // Try backend first
    if (this.backendAvailable) {
      addDebugLog('[MEMORY] Using backend for Ollama process memory', 'info');
      this._startBackendMonitoring();
    } 
    // Fallback to browser API
    else if (window.performance && window.performance.memory) {
      addDebugLog('[MEMORY] Using performance.memory (browser) as fallback', 'info');
      this._startBrowserMonitoring();
    }
    // Last fallback
    else {
      addDebugLog('[MEMORY] ERROR: No memory monitoring available!', 'error');
      addDebugLog('⚠️ Monitoring RAM désactivé. Backend non détecté et performance.memory non disponible.', 'warn');
      addDebugLog('   Solution 1: Lancez `node server.js` dans ce dossier', 'warn');
      addDebugLog('   Solution 2: Utilisez Chrome avec --enable-precision-memory-info', 'warn');
    }
  },
  
  /**
   * Get backend URL
   */
  _getBackendUrl: function(path) {
    return window.MEMORY_MONITOR_CONFIG.backendUrl + path;
  },
  
  /**
   * Monitor using backend server
   */
  _startBackendMonitoring: function() {
    var self = this;
    
    // Get initial memory
    this._fetchBackendMemory();
    
    // Poll every interval
    this.monitoringInterval = setInterval(function() {
      self._fetchBackendMemory();
    }, window.MEMORY_MONITOR_CONFIG.pollInterval);
  },
  
  /**
   * Fetch memory from backend
   */
  _fetchBackendMemory: function() {
    var self = this;
    
    addDebugLog('[MEMORY] Fetching from backend: ' + this._getBackendUrl('/api/memory'), 'info');
    
    fetch(this._getBackendUrl('/api/memory'))
      .then(function(response) { 
        addDebugLog('[MEMORY] Backend response status: ' + response.status, 'info');
        if (!response.ok) {
          throw new Error('Ollama non détecté ou backend erreur: ' + response.status);
        }
        return response.json(); 
      })
      .then(function(data) {
        addDebugLog('[MEMORY] Backend data received: ' + JSON.stringify(data).substring(0, 200), 'info');
        
        // UNIQUEMENT la mémoire du PROCESSUS Ollama (pas la RAM système)
        if (data.success && data.process && data.process.memoryMB && data.process.memoryMB > 0) {
          var memMB = data.process.memoryMB;
          addDebugLog('[MEMORY] Using process memory: ' + memMB + ' MB (PID: ' + data.pid + ')', 'success');
          if (memMB > self.peakMemory) {
            self.peakMemory = memMB;
          }
          self.currentMemory = memMB;
          self.memoryReadings.push({ timestamp: Date.now(), memory: memMB });
        } else {
          addDebugLog('[MEMORY] WARNING: No valid process memory in response. Success=' + data.success + ', process=' + (data.process ? 'yes' : 'no'), 'error');
          if (data.error) {
            addDebugLog('[MEMORY] Backend error: ' + data.error, 'error');
          }
        }
      })
      .catch(function(err) {
        addDebugLog('[MEMORY] Fetch error: ' + err.message, 'error');
        // Ollama n'est pas en cours d'exécution
        if (self.memoryReadings.length === 0) {
          addDebugLog('⚠️ Ollama non détecté - lancez `ollama serve` pour le monitoring RAM', 'warn');
        }
      });
  },
  
  /**
   * Monitor using browser performance.memory API
   */
  _startBrowserMonitoring: function() {
    var self = this;
    this.monitoringInterval = setInterval(function() {
      var mem = window.performance.memory;
      if (mem && mem.usedJSHeapSize) {
        var usedMB = Math.round(mem.usedJSHeapSize / 1024 / 1024);
        if (usedMB > self.peakMemory) {
          self.peakMemory = usedMB;
        }
        self.currentMemory = usedMB;
        self.memoryReadings.push({ timestamp: Date.now(), memory: usedMB });
      }
    }, window.MEMORY_MONITOR_CONFIG.pollInterval);
  },
  
  /**
   * Stop monitoring and return stats
   */
  stop: function() {
    addDebugLog('[MEMORY] Stopping memory monitoring. Readings: ' + this.memoryReadings.length + ', Peak: ' + this.peakMemory + ' MB, Avg: ' + this._calculateAverage() + ' MB', 'info');
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isActive = false;
    
    var result = {
      peakMemory: this.peakMemory > 0 ? this.peakMemory : null,
      averageMemory: this._calculateAverage(),
      currentMemory: this.currentMemory > 0 ? this.currentMemory : null,
      readings: this.memoryReadings,
      backendAvailable: this.backendAvailable
    };
    
    addDebugLog('[MEMORY] Final stats: peak=' + result.peakMemory + ' MB, avg=' + result.averageMemory + ' MB', 'info');
    return result;
  },
  
  /**
   * Calculate average memory usage
   */
  _calculateAverage: function() {
    if (this.memoryReadings.length === 0) return 0;
    var sum = 0;
    for (var i = 0; i < this.memoryReadings.length; i++) {
      sum += this.memoryReadings[i].memory;
    }
    return Math.round(sum / this.memoryReadings.length);
  },
  
  /**
   * Get current memory reading
   */
  getCurrent: function() {
    return this.currentMemory;
  }
};

/**
 * Check if memory monitoring is available
 */
function isMemoryMonitoringAvailable() {
  return ollamaMemoryMonitor.backendAvailable || 
         (window.performance && window.performance.memory);
}

/**
 * Initialize memory monitor on page load
 * (Called from main.js or directly)
 */
if (typeof ollamaMemoryMonitor !== 'undefined') {
  // Will be initialized when needed
}
