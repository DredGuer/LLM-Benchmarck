/**
 * LLM Benchmarker - Main Initialization
 * Initializes all modules and sets up the application
 */

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Load hardware configuration
  loadHardwareConfig();
  
  // Detect environment
  detectEnvironment();
  
  // Render prompt types
  renderPromptTypes();
  
  // Initialize runner UI
  updateRunnerConfig();
  populateModelSelect();
  
  // Load API keys
  loadApiKeys();
  
  // Load history
  loadHistory();
  
  // Update time display
  updateTime();
  setInterval(updateTime, 30000);
});
