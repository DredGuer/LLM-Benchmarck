/**
 * LLM Benchmarker - Configuration Loading
 * Loads runner and prompt configurations from inline JSON script tags
 */

// Load configurations from inline JSON script tags
var runnersEl = document.getElementById('runnersConfig');
var promptsEl = document.getElementById('promptsConfig');

if (runnersEl && promptsEl) {
  runnersConfig = JSON.parse(runnersEl.textContent);
  promptsConfig = JSON.parse(promptsEl.textContent);
  
  // Global configurations
  RUNNERS = runnersConfig.runners;
  DEFAULT_MODELS = {};
  for (var key in RUNNERS) {
    DEFAULT_MODELS[key] = RUNNERS[key].defaultModels || [];
  }
  PROMPT_TYPES = promptsConfig.promptTypes;
} else {
  console.error('ERROR: Could not find runnersConfig or promptsConfig elements');
}
