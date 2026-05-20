/**
 * LLM Benchmarker - Configuration Loading
 * Loads runner and prompt configurations from inline JSON script tags
 */

// Load configurations from inline JSON script tags
runnersConfig = JSON.parse(document.getElementById('runnersConfig').textContent);
promptsConfig = JSON.parse(document.getElementById('promptsConfig').textContent);

// Global configurations
RUNNERS = runnersConfig.runners;
DEFAULT_MODELS = {};
for (var key in RUNNERS) {
  DEFAULT_MODELS[key] = RUNNERS[key].defaultModels || [];
}
PROMPT_TYPES = promptsConfig.promptTypes;
