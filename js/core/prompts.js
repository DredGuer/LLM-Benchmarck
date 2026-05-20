/**
 * LLM Benchmarker - Prompt Types UI
 */

function renderPromptTypes() {
  var container = document.getElementById('promptTypesList');
  if (!container) return;
  
  container.innerHTML = '';
  
  for (var i = 0; i < PROMPT_TYPES.length; i++) {
    var pt = PROMPT_TYPES[i];
    var item = document.createElement('div');
    var isSelected = state.selectedPrompts && state.selectedPrompts.has(pt.id);
    item.className = 'prompt-type-item' + (isSelected ? ' selected' : '');
    item.dataset.id = pt.id;
    item.innerHTML = '<div class="prompt-check"></div><span class="prompt-type-emoji">' + pt.emoji + '</span><div class="prompt-type-info"><div class="prompt-type-name">' + pt.name + '</div><div class="prompt-type-desc">' + pt.desc + '</div></div>';
    item.onclick = function() { togglePromptType(pt.id, item); };
    container.appendChild(item);
  }
}

function togglePromptType(id, el) {
  if (!state || !state.selectedPrompts) return;
  
  if (state.selectedPrompts.has(id)) {
    state.selectedPrompts.delete(id);
    el.classList.remove('selected');
  } else {
    state.selectedPrompts.add(id);
    el.classList.add('selected');
  }
  
  var customPromptArea = document.getElementById('customPromptArea');
  if (customPromptArea) {
    customPromptArea.classList.toggle('visible', state.selectedPrompts.has('custom'));
  }
}
