/**
 * LLM Benchmarker - Configuration Loading
 * Loads runner and prompt configurations from inline JSON scripts
 */

// Load configurations from inline JSON script tags
var runnersConfig = JSON.parse(document.getElementById('runnersConfig').textContent);
var promptsConfig = JSON.parse(document.getElementById('promptsConfig').textContent);

// Global configurations
var RUNNERS = runnersConfig.runners;
var DEFAULT_MODELS = {};
for (var key in RUNNERS) {
  DEFAULT_MODELS[key] = RUNNERS[key].defaultModels || [];
}
var PROMPT_TYPES = promptsConfig.promptTypes;
