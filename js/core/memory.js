/**
 * LLM Benchmarker - Memory Monitoring for Ollama
 * Monitors RAM usage during Ollama model execution
 * 
 * Note: Browser-based monitoring has limitations:
 * - performance.memory requires Chrome with --enable-precision-memory-info flag
 * - Only provides JS heap size, not actual process memory
 * - For accurate Ollama process memory, a backend is required
 */

// Global to track memory during tests
ollamaMemoryMonitor = {
  peakMemory: 0,
  memoryReadings: [],
  monitoringInterval: null,
  isActive: false,
  
  /**
   * Start monitoring memory usage
   * Uses browser performance.memory API if available
   */
  start: function() {
    this.peakMemory = 0;
    this.memoryReadings = [];
    this.isActive = true;
    
    // Check if performance.memory is available (Chrome with flag)
    if (window.performance && window.performance.memory) {
      addDebugLog('Monitoring RAM via performance.memory (navigateur)', 'info');
      this._startBrowserMonitoring();
    } else {
      addDebugLog('performance.memory non disponible. Utilisez Chrome avec --enable-precision-memory-info pour le monitoring RAM.', 'warn');
      // Still try to monitor, but will return 0
      this._startFallbackMonitoring();
    }
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
        self.memoryReadings.push({ timestamp: Date.now(), memory: usedMB });
      }
    }, 500);
  },
  
  /**
   * Fallback monitoring (placeholder)
   */
  _startFallbackMonitoring: function() {
    var self = this;
    this.monitoringInterval = setInterval(function() {
      // No actual monitoring, just placeholder
    }, 500);
  },
  
  /**
   * Stop monitoring and return stats
   */
  stop: function() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isActive = false;
    return {
      peakMemory: this.peakMemory > 0 ? this.peakMemory : null,
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
  }
};

/**
 * Check if performance.memory API is available
 */
function isMemoryMonitoringAvailable() {
  return window.performance && window.performance.memory;
}
