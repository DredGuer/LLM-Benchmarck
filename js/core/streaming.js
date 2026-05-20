/**
 * LLM Benchmarker - Streaming & Live Output Management
 */

function updateThinkingOutput(text, reset) {
  var output = document.getElementById('thinkingOutput');
  if (reset) { output.textContent = ''; return; }
  output.textContent += text;
  output.scrollTop = output.scrollHeight;
}

function updateTokenProgress(current, max) {
  var counter = document.getElementById('tokenCounter');
  var bar = document.getElementById('tokenProgressBar');
  if (counter) counter.textContent = 'Tokens: ' + current + '/' + max;
  if (bar) bar.style.width = Math.min(100, (current / max) * 100) + '%';
  if (current >= max * 0.9 && current < max) {
    addDebugLog('Approche de la limite de tokens (' + current + '/' + max + ')', 'warn');
  }
}

function addDebugLog(message, type) {
  if (type === undefined) type = 'info';
  var logsDiv = document.getElementById('debugLogs');
  var timestamp = new Date().toLocaleTimeString('fr-FR');
  var prefix = { error: 'ERREUR', warn: 'ATTENTION', success: 'OK' }[type] || 'INFO';
  var icons = { error: '❌', warn: '⚠️', success: '✅', info: 'ℹ️' };
  var logEntry = '[' + timestamp + '] ' + (icons[type] || '•') + ' ' + message;
  currentTestState.logs.push({ timestamp: Date.now(), type: type, message: message });
  if (logsDiv) {
    var p = document.createElement('p');
    p.textContent = logEntry;
    var color = type === 'error' ? 'var(--accent3)' : type === 'warn' ? 'var(--accent5)' : type === 'success' ? 'var(--accent2)' : 'var(--text2)';
    p.style.color = color;
    logsDiv.appendChild(p);
    logsDiv.scrollTop = logsDiv.scrollHeight;
  }
}

function clearDebugLogs() {
  var logsDiv = document.getElementById('debugLogs');
  if (logsDiv) logsDiv.textContent = '';
  currentTestState.logs = [];
}

function stopCurrentTest() {
  if (currentAbortController) {
    addDebugLog('Arrêt demandé par l utilisateur', 'warn');
    currentAbortController.abort();
    currentAbortController = null;
  }
}

function skipToNextTest() { skipToNextFlag = true; stopCurrentTest(); }
function retryCurrentTest() { retryCurrentFlag = true; stopCurrentTest(); }

function resetLiveOutput() {
  updateThinkingOutput('', true);
  var counter = document.getElementById('tokenCounter');
  if (counter) counter.textContent = 'Tokens: 0/0';
  var bar = document.getElementById('tokenProgressBar');
  if (bar) bar.style.width = '0%';
  clearDebugLogs();
  currentTestState = { model: null, promptType: null, promptText: null, maxTokens: 512, tokensReceived: 0, isStreaming: false, startTime: null, logs: [] };
}

function setControlButtons(enabled, stopOnly) {
  document.getElementById('stopBtn').disabled = !enabled;
  if (!stopOnly) {
    document.getElementById('nextBtn').disabled = !enabled;
    document.getElementById('retryBtn').disabled = !enabled;
  }
}

function showLiveSections(show) {
  var liveOutput = document.getElementById('liveOutputSection');
  var debugLogs = document.getElementById('debugLogsSection');
  var controls = document.getElementById('controlButtons');
  if (liveOutput) liveOutput.style.display = show ? 'block' : 'none';
  if (debugLogs) debugLogs.style.display = show ? 'block' : 'none';
  if (controls) controls.style.display = show ? 'flex' : 'none';
}
