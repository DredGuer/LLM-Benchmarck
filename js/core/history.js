/**
 * LLM Benchmarker - History Management
 */

async function saveSessionToHistory(session) {
  var saved=await queueDatabaseSave(session);if(saved&&state.unsavedSession?.id===session.id)state.unsavedSession=null;return saved;
}

function loadHistory() {
  try {
    var history = databaseView.sessions;
    var container = document.getElementById('historyContainer');
    if (!container) return;
    
    if (!databaseView.ready) { container.textContent='Historique indisponible : reconnectez le backend SQLite.'; return; }
    if (history.length === 0) {
      container.innerHTML = '<p style="color:var(--text3);font-size:0.875rem;text-align:center;padding:20px;">Aucune session sauvegardée.</p>';
      renderDatabaseTrash(container);return;
    }
    var html = '<div style="overflow-x:auto"><table class="history-table"><thead><tr><th>Date</th><th>Modèle</th><th>Runner</th><th>Tests</th><th>Moy. tok/s</th><th>Actions</th></tr></thead><tbody>';
    for (var i = 0; i < history.length; i++) {
      var session = history[i];
      var query=(document.getElementById('historyFilter')?.value||'').trim().toLowerCase();if(query&&!JSON.stringify([session.model,session.runner,session.metadata]).toLowerCase().includes(query))continue;
      var date = new Date(session.savedAt||session.createdAt).toLocaleString('fr-FR');
      var measurements = (session.results || []).filter(r => r.phase !== 'warmup' && !r.error);
      var count = measurements.length;
      var avgTPS = count > 0 ? Math.round(measurements.reduce(function(a, r) { return a + (r.metrics?.tokensPerSec || 0); }, 0) / count * 10) / 10 : 0;
      html += '<tr><td>' + date + '</td><td><code class="code-tag">' + escapeHtml(session.model) + '</code>' + (session.metadata?.name?'<br>'+escapeHtml(session.metadata.name):'') + '</td><td>' + escapeHtml(session.runner) + '</td><td><span class="badge badge-blue">' + count + '</span></td><td><strong style="color:var(--accent2)">' + avgTPS + '</strong></td><td><button class="btn btn-ghost btn-sm" onclick="restoreSession(' + i + ')">↩ Restaurer</button> <button class="btn btn-ghost btn-sm" onclick="editHistorySession(' + i + ')">✎ Modifier</button> <button class="btn btn-ghost btn-sm" onclick="trashHistorySession(' + i + ')">Corbeille</button></td></tr>';
    }
    html += '</tbody></table></div>';
    container.innerHTML = html;
    renderHistoryPassControls(container);
    renderDatabaseTrash(container);
  } catch(e) { console.error('Erreur chargement historique:', e); }
}

function restoreSession(idx) {
  if (state.isRunning || state.batchActive) return;
  try {
    var history = databaseView.sessions;
    var session = history[idx];
    if (!session) return;
    resetCampaignResults();
    state.results = session.results ? session.results.slice(0) : [];
    showResultsArea(!!state.results.length);
    for (var i = 0; i < state.results.length; i++) {
      renderResultCard(state.results[i]);
    }
    document.getElementById('exportBtn').disabled = false;
    switchTab('results');
    showToast('Session restaurée : ' + session.results.length + ' résultat(s)', 'success');
  } catch(e) { showToast('Erreur de restauration', 'error'); }
}

async function clearHistory() {
  if (state.isRunning || state.batchActive) return;
  if (!confirm('Placer tout l’historique dans la corbeille restaurable ?')) return;
  try {for (var session of databaseView.sessions) await databaseRequest('/sessions/'+encodeURIComponent(session.id),'DELETE');await refreshDatabase();}
  catch(e){showToast(e.message,'error');await refreshDatabase();}
}
async function editHistorySession(idx) {
  var s=databaseView.sessions[idx];if(!s||state.isRunning||state.batchActive)return;
  var name=prompt('Nom de la campagne',s.metadata?.name||s.model);if(name===null)return;
  var notes=prompt('Notes',s.metadata?.notes||'');if(notes===null)return;
  var tags=prompt('Tags séparés par des virgules',(s.metadata?.tags||[]).join(', '));if(tags===null)return;
  try{await databaseRequest('/sessions/'+encodeURIComponent(s.id),'PATCH',{name,notes,tags:tags.split(',').map(t=>t.trim()).filter(Boolean)});await refreshDatabase();}catch(e){showToast(e.message,'error');}
}
async function trashHistorySession(idx){var s=databaseView.sessions[idx];if(!s||state.isRunning||state.batchActive)return;try{await databaseRequest('/sessions/'+encodeURIComponent(s.id),'DELETE');await refreshDatabase();}catch(e){showToast(e.message,'error');}}
function renderDatabaseTrash(container){
 var detail=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Corbeille · '+(databaseView.trash.length+databaseView.profileTrash.length)+' élément(s)';detail.appendChild(summary);container.appendChild(detail);
 for(var kind of ['sessions','profiles'])for(var item of (kind==='sessions'?databaseView.trash:databaseView.profileTrash)){
  var row=document.createElement('div');row.textContent=(item.metadata?.name||item.name||item.model)+' ';detail.appendChild(row);
  for(var action of ['restore','delete']){var button=document.createElement('button');button.className='btn btn-ghost btn-sm';button.textContent=action==='restore'?'Restaurer':'Supprimer définitivement';button.onclick=(function(kind,item,action){return async function(){if(state.isRunning||state.batchActive)return;if(action==='delete'&&!confirm('Supprimer définitivement cet élément ? Cette action est irréversible.'))return;try{await databaseRequest('/'+kind+'/'+encodeURIComponent(item.id)+(action==='restore'?'/restore':'?permanent=1'),action==='restore'?'POST':'DELETE',action==='delete'?{confirm:item.id}:{});await refreshDatabase();}catch(e){showToast(e.message,'error');}};})(kind,item,action);row.appendChild(button);}
 }
}

function clearAllResults() {
  if (state.isRunning || state.batchActive || state.results.length === 0) return;
  if (!confirm('Vider les résultats actuels ?')) return;
  state.results = [];
  state.unsavedSession = null;
  var resultsList = document.getElementById('resultsList');
  if (resultsList) resultsList.innerHTML = '';
  showResultsArea(false);
  document.getElementById('exportBtn').disabled = true;
  showToast('Résultats effacés', 'info');
}

function renderHistoryPassControls(container){
 var detail=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Inclure / exclure des passes dans les statistiques (mesures conservées)';detail.appendChild(summary);container.appendChild(detail);
 for(var session of databaseView.sessions){var group=document.createElement('details'),title=document.createElement('summary');title.textContent=(session.metadata?.name||session.model)+' · '+new Date(session.savedAt||session.createdAt).toLocaleString();group.appendChild(title);detail.appendChild(group);
 for(var result of session.results||[]){if(!result.id)continue;var label=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.checked=!(session.metadata?.excludedResultIds||[]).includes(result.id);label.appendChild(box);label.appendChild(document.createTextNode(' '+(result.promptTypeName||result.promptType||'Passe')+' · '+(result.phase||'measurement')+' · répétition '+(result.rep||1)));group.appendChild(label);group.appendChild(document.createElement('br'));
 box.onchange=(function(session,result,box){return async function(){box.disabled=true;try{var excluded=new Set(session.metadata?.excludedResultIds||[]);box.checked?excluded.delete(result.id):excluded.add(result.id);var data=await databaseRequest('/sessions/'+encodeURIComponent(session.id),'PATCH',{excludedResultIds:Array.from(excluded)});session.metadata=data.item.metadata;renderStatistics();}catch(e){box.checked=!box.checked;showToast(e.message,'error');}finally{box.disabled=false;}};})(session,result,box);
 }}
}
