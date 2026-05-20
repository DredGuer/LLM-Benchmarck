/**
 * LLM Benchmarker - Main Initialization
 * Initializes all modules and sets up the application
 */

// Initialize immediately since scripts are loaded at end of body
loadHardwareConfig();

// Initialize environment detection (async to try backend)
detectEnvironment().catch(function(err) {
  console.error('Environment detection failed:', err);
  // Fallback to browser detection only
  detectFullHardware();
});

renderPromptTypes();
updateRunnerConfig();
populateModelSelect();
loadApiKeys();
loadHistory();
updateTime();
setInterval(updateTime, 30000);

// Initialize memory monitor (async, non-blocking)
if (typeof ollamaMemoryMonitor !== 'undefined') {
  ollamaMemoryMonitor.init().catch(function(err) {
    // Silent fail - will use fallback methods
  });
}
