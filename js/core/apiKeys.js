/**
 * LLM Benchmarker - API Keys Management
 */

function loadApiKeys() {
  try {
    var saved = localStorage.getItem(API_KEYS_KEY);
    if (saved) state.apiKeys = JSON.parse(saved);
  } catch(e) {}
  try {
    document.getElementById('keyOpenAI').value = state.apiKeys.openai || '';
    document.getElementById('keyMistral').value = state.apiKeys.mistral || '';
    document.getElementById('keyClaude').value = state.apiKeys.claude || '';
    document.getElementById('keyGemini').value = state.apiKeys.gemini || '';
  } catch(e) {}
}

function saveApiKeys() {
  state.apiKeys = {
    openai: document.getElementById('keyOpenAI').value.trim(),
    mistral: document.getElementById('keyMistral').value.trim(),
    claude: document.getElementById('keyClaude').value.trim(),
    gemini: document.getElementById('keyGemini').value.trim(),
  };
  try {
    localStorage.setItem(API_KEYS_KEY, JSON.stringify(state.apiKeys));
    closeModal('apiModal');
    updateRunnerConfig();
    showToast('Clés API sauvegardées', 'success');
  } catch(e) { showToast('Erreur lors de la sauvegarde', 'error'); }
}
