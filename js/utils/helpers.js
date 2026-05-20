/**
 * LLM Benchmarker - Utility Helpers
 * Pure utility functions with no dependencies
 */

// Fetch with timeout support
function fetchWithTimeout(url, options, timeout) {
  if (options === undefined) options = {};
  if (timeout === undefined) timeout = 30000;
  var controller = new AbortController();
  var id = setTimeout(function() { controller.abort(); }, timeout);
  return fetch(url, { 
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body || null,
    signal: controller.signal 
  }).finally(function() { clearTimeout(id); });
}

// Estimate token count from text
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

// Escape HTML special characters
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Escape special characters for Markdown code blocks
function escapeHtmlForMarkdown(str) {
  if (!str) return "";
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/`/g, "\\`")
    .replace(/\[/g, "\\\[")
    .replace(/\]/g, "\\\]")
    .replace(/\+/g, "\\+")
    .replace(/\-/g, "\\-")
    .replace(/=/g, "\\=")
    .replace(/\|/g, "\\|");
}

// Get the currently selected model from the UI
function getSelectedModel() {
  var custom = document.getElementById('modelCustom');
  if (custom && custom.value && custom.value.trim()) return custom.value.trim();
  var select = document.getElementById('modelSelect');
  return (select && select.value) ? select.value : 'unknown-model';
}

// Update the current time display
function updateTime() {
  var el = document.getElementById('envTime');
  if (el) {
    el.textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
}
