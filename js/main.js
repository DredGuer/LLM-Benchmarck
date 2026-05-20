/**
 * LLM Benchmarker - Main Initialization
 * Initializes all modules and sets up the application
 */

// Initialize immediately since scripts are loaded at end of body
loadHardwareConfig();
detectEnvironment();
renderPromptTypes();
updateRunnerConfig();
populateModelSelect();
loadApiKeys();
loadHistory();
updateTime();
setInterval(updateTime, 30000);
