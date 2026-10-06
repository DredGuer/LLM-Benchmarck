// Application version; backend, protocols and schemas are versioned independently.
var LLMB_VERSION = '0.09.0';
if (typeof document !== 'undefined' && document.querySelectorAll) {
  document.querySelectorAll('[data-app-version]').forEach(function(el) {
    el.textContent = 'v' + LLMB_VERSION;
  });
}

function captureTestProvenance() {
  var runner = typeof state === 'object' ? state.runner : null;
  var locality = 'unknown';
  try { var url = new URL(RUNNERS[runner].base); locality = ['localhost','127.0.0.1','[::1]'].includes(url.hostname) ? 'loopback' : 'remote'; } catch (_) {}
  return { applicationVersion: LLMB_VERSION, capturedAt: new Date().toISOString(), clientNodeId: 'local',
    inferenceEndpoint: locality, runnerName: typeof RUNNERS === 'object' ? RUNNERS[runner]?.name || null : null,
    runnerVersion: typeof state === 'object' ? state.runnerVersion || null : null,
    engine: null, backend: null, attribution: 'configured-endpoint; engine and actual placement unverified' };
}
