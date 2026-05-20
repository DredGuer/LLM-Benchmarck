/**
 * LLM Benchmarker - Connectivity Testing
 */

async function testConnectivity() {
  var container = document.getElementById('connectivityResults');
  var localRunners = [
    { name: 'Ollama', url: 'http://localhost:11434/api/tags' },
    { name: 'LM Studio', url: 'http://localhost:1234/v1/models' },
    { name: 'llama.cpp', url: 'http://localhost:8080/v1/models' },
  ];
  container.innerHTML = '';
  for (var i = 0; i < localRunners.length; i++) {
    var runner = localRunners[i];
    var el = document.createElement('div');
    el.id = 'conn-' + runner.name;
    el.innerHTML = '<div class="spinner"></div> <span>Test ' + runner.name + '...</span>';
    container.appendChild(el);
  }
  for (var i = 0; i < localRunners.length; i++) {
    var runner = localRunners[i];
    var el = document.getElementById('conn-' + runner.name);
    try {
      await fetchWithTimeout(runner.url, {}, 3000);
      el.innerHTML = '<span style="color:var(--accent2)">✅</span> <strong>' + runner.name + '</strong><span style="color:var(--text3)">' + runner.url + '</span><span class="badge badge-green">Accessible</span>';
    } catch(e) {
      el.innerHTML = '<span style="color:var(--accent3)">❌</span> <strong>' + runner.name + '</strong><span style="color:var(--text3)">' + runner.url + '</span><span class="badge badge-red">Inaccessible</span>';
    }
  }
}
