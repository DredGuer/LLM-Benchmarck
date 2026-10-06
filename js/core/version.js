// Application version; backend, protocols and schemas are versioned independently.
var LLMB_VERSION = '0.08';
if (typeof document !== 'undefined' && document.querySelectorAll) {
  document.querySelectorAll('[data-app-version]').forEach(function(el) {
    el.textContent = 'v' + LLMB_VERSION;
  });
}
