// SQLite is authoritative. These arrays are a disposable view, never a browser backup.
var databaseView={ready:false,sessions:[],profiles:[],trash:[],profileTrash:[],pending:Promise.resolve()};
async function databaseRequest(route,method,body){
 var controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{var res=await fetch((typeof window!=='undefined'&&window.MEMORY_MONITOR_CONFIG?.backendUrl||'http://localhost:3001')+'/api/database'+route,{method:method||'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:controller.signal});var data=await res.json();if(!res.ok)throw new Error(data.error||'Erreur SQLite');return data;}finally{clearTimeout(timer);}
}
function databaseHistory(){return databaseView.ready?databaseView.sessions.map(s=>({...s,results:(s.results||[]).filter(r=>!(s.metadata?.excludedResultIds||[]).includes(r.id))})):[];}
async function refreshDatabase(){
 var [a,b,c,d]=await Promise.all(['/sessions','/profiles','/sessions?trash=1','/profiles?trash=1'].map(p=>databaseRequest(p)));
 databaseView.sessions=a.items;databaseView.profiles=b.items;databaseView.trash=c.items;databaseView.profileTrash=d.items;databaseView.ready=true;
 loadHistory();renderCampaignProfiles();if(typeof renderStatistics==='function')renderStatistics();
}
async function initializeDatabase(){
 var status=document.getElementById('databaseStatus');
 try{
  var info=await databaseRequest('/status');
  var migrationNote='';
  try {
   var sessions=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]'),profiles=typeof storedLegacyProfiles==='function'?storedLegacyProfiles():[];
   if(!Array.isArray(sessions))throw new Error('Historique navigateur invalide.');
   if(sessions.length||profiles.length){var result=await databaseRequest('/migrate','POST',{sessions,profiles});if(result.inserted)showToast(result.inserted+' élément(s) migré(s) vers SQLite. Copie navigateur conservée.','success');}
  } catch(e){migrationNote=' · migration non réalisée : '+e.message;showToast('Anciennes données conservées dans le navigateur : '+e.message,'error');}

  await refreshDatabase();if(status)status.textContent='SQLite connecté · '+info.filename+' · copie navigateur conservée'+migrationNote;
 }catch(e){databaseView.ready=false;if(status)status.textContent='Historique SQLite indisponible : lancez/reconnectez le backend. '+e.message;showToast('SQLite indisponible. Les nouvelles mesures ne sont pas sauvegardées ; exportez-les ou reconnectez le backend.','error');}
}
function queueDatabaseSave(session){
 if(!session.id)session.id=crypto.randomUUID();if(!session.savedAt)session.savedAt=new Date().toISOString();
 var snapshot=JSON.parse(JSON.stringify(session));
 var operation=databaseView.pending.catch(()=>{}).then(async()=>{var data=await databaseRequest('/sessions','POST',snapshot);databaseView.ready=true;var i=databaseView.sessions.findIndex(s=>s.id===data.item.id);if(i<0)databaseView.sessions.unshift(data.item);else databaseView.sessions[i]=data.item;return true;});
 databaseView.pending=operation;
 return operation.catch(e=>{state.unsavedSession=session;showToast('Passe non sauvegardée : '+e.message+' — gardez la page ouverte et exportez les résultats.','error');return false;});
}
async function backupDatabase(){try{var data=await databaseRequest('/backup');var url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='LLMB-sauvegarde-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){showToast(e.message,'error');}}
async function importDatabaseBackup(input){try{var file=input.files[0];if(!file)return;if(file.size>32*1024*1024)throw new Error('Sauvegarde limitée à 32 MiB.');var data=JSON.parse(await file.text());await databaseRequest('/import','POST',data);await refreshDatabase();showToast('Sauvegarde importée, doublons ignorés.','success');}catch(e){showToast(e.message,'error');}finally{input.value='';}}
