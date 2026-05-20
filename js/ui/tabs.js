/**
 * LLM Benchmarker - Tab Management
 * Handles tab switching between different views
 */

function switchTab(name) {
  var tabNames = ['results', 'history', 'about'];
  
  // Update tab buttons
  var buttons = document.querySelectorAll('.tab-btn');
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].classList.toggle('active', tabNames[i] === name);
  }

  // Update tab content
  var contents = document.querySelectorAll('.tab-content');
  for (var j = 0; j < contents.length; j++) {
    contents[j].classList.toggle('active', contents[j].id === 'tab-' + name);
  }

  // Load history data when switching to history tab
  if (name === 'history') {
    loadHistory();
  }
}
