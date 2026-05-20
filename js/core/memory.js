/**
 * LLM Benchmarker - Memory Monitoring for Ollama
 * Monitors RAM usage during Ollama model execution
 */

// Global to track Ollama process memory
ollamaMemoryMonitor = {
  pid: null,
  peakMemory: 0,
  memoryReadings: [],
  monitoringInterval: null,
  
  /**
   * Start monitoring Ollama process memory
   * Uses Node.js backend if available, falls back to system info
   */
  start: function(pid) {
    this.pid = pid;
    this.peakMemory = 0;
    this.memoryReadings = [];
    
    // Try to get memory from backend if running
    if (window.memoryMonitorBackend) {
      this._startBackendMonitoring(pid);
    } else {
      // Fallback: monitor system memory (less precise)
      this._startSystemMonitoring();
    }
  },
  
  /**
   * Start monitoring via backend API
   */
  _startBackendMonitoring: function(pid) {
    var self = this;
    
    // Get initial memory
    this._fetchMemory(pid);
    
    // Poll every 500ms
    this.monitoringInterval = setInterval(function() {
      self._fetchMemory(pid);
    }, 500);
  },
  
  /**
   * Fetch memory from backend
   */
  _fetchMemory: function(pid) {
    var self = this;
    fetch('/api/memory?pid=' + pid)
      .then(function(response) { return response.json(); })
      .then(function(data) {
        var memMB = 0;
        if (data.process && data.process.memory) {
          memMB = Math.round(data.process.memory / 1024 / 1024);
        } else if (data.system) {
          memMB = Math.round((data.system.total - data.system.free) / 1024 / 1024);
        }
        
        if (memMB > self.peakMemory) {
          self.peakMemory = memMB;
        }
        self.memoryReadings.push({ timestamp: Date.now(), memory: memMB });
      })
      .catch(function(err) {
        addDebugLog('Erreur récupération mémoire: ' + err.message, 'warn');
      });
  },
  
  /**
   * Fallback: monitor system memory
   */
  _startSystemMonitoring: function() {
    var self = this;
    
    // Try to get system memory info from browser (Chrome only with flag)
    if (window.performance && window.performance.memory) {
      this.monitoringInterval = setInterval(function() {
        var mem = window.performance.memory;
        if (mem) {
          var usedMB = Math.round(mem.usedJSHeapSize / 1024 / 1024);
          if (usedMB > self.peakMemory) {
            self.peakMemory = usedMB;
          }
          self.memoryReadings.push({ timestamp: Date.now(), memory: usedMB });
        }
      }, 500);
    }
  },
  
  /**
   * Stop monitoring
   */
  stop: function() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    return {
      peakMemory: this.peakMemory,
      averageMemory: this._calculateAverage(),
      readings: this.memoryReadings
    };
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
   * Get current Ollama PID from local API
   */
  getOllamaPID: async function() {
    try {
      var response = await fetch('http://localhost:11434/api/ps');
      var data = await response.json();
      if (data.processes && data.processes.length > 0) {
        return data.processes[0].pid;
      }
    } catch (err) {
      addDebugLog('Impossible de récupérer le PID Ollama: ' + err.message, 'warn');
    }
    return null;
  }
};

/**
 * Alternative: Get system memory info (browser based)
 */
function getSystemMemoryInfo() {
  if (window.performance && window.performance.memory) {
    var mem = window.performance.memory;
    return {
      usedJSHeapSize: Math.round(mem.usedJSHeapSize / 1024 / 1024),
      totalJSHeapSize: Math.round(mem.totalJSHeapSize / 1024 / 1024),
      jsHeapSizeLimit: Math.round(mem.jsHeapSizeLimit / 1024 / 1024)
    };
  }
  return null;
}
