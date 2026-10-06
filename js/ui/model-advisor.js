// Advisory estimates stay local; downloading requires an explicit selection.
var modelAdvisor={data:null,selected:new Set(),token:null,job:null,timer:null,downloading:false};
function advisorBusy(){return !!(state.isRunning||state.batchActive||state.analysisRunning||state.configuring);}
function advisorMessage(text){document.getElementById('advisorMessage').textContent=text;}
function advisorGiB(bytes){return Number.isFinite(bytes)?(bytes/1024**3).toFixed(1)+' GiB':'inconnu';}
async function advisorRequest(route,body){
 var response=await fetchWithTimeout(exportBackendBase()+'/api/models/advisor'+route,{...(body!==undefined?{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+modelAdvisor.token},body:JSON.stringify(body)}:{headers:modelAdvisor.token?{Authorization:'Bearer '+modelAdvisor.token}:{}})},20000);
 var data=await response.json();if(!response.ok)throw new Error(data.error||'advisor-unavailable');return data;
}
async function openModelAdvisor(){
 if(advisorBusy()&&!modelAdvisor.downloading){showToast('Attendez la fin de la tâche en cours.','info');return;}
 modelAdvisor.previousFocus=document.activeElement;var modal=document.getElementById('modelAdvisorModal');modal.hidden=false;if(modal.focus)modal.focus();
 if(modelAdvisor.downloading)return;
 try{var session=await advisorRequest('/session');if(session.version!=='1.0.0')throw Error('version');modelAdvisor.token=session.token;
  if(session.activeJob){modelAdvisor.job=session.activeJob;advisorDownloadLock(true);await pollAdvisorJob();return;}
  await analyzeModelAdvisor();
 }catch(e){advisorMessage('Analyse indisponible. Lancez le backend à jour avec npm start ; utilisez la page sur localhost. ('+e.message+')');}
}
function closeModelAdvisor(){document.getElementById('modelAdvisorModal').hidden=true;if(modelAdvisor.previousFocus?.focus)modelAdvisor.previousFocus.focus();}
function advisorDialogKey(event){
 if(event.key==='Escape'){event.preventDefault();closeModelAdvisor();return;}
 if(event.key!=='Tab')return;
 var nodes=[...document.getElementById('modelAdvisorModal').querySelectorAll('button, input, select, a, summary')].filter(el=>!el.disabled&&!el.hidden);
 if(!nodes.length)return;var first=nodes[0],last=nodes[nodes.length-1];
 if(event.shiftKey&&(document.activeElement===first||document.activeElement===document.getElementById('modelAdvisorModal'))){event.preventDefault();last.focus();}
 else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===document.getElementById('modelAdvisorModal'))){event.preventDefault();first.focus();}
}
async function analyzeModelAdvisor(){
 if(advisorBusy())return;
 advisorMessage('Analyse de la RAM et du volume présumé des modèles…');document.getElementById('advisorAnalyze').disabled=true;
 try{modelAdvisor.data=await advisorRequest('?context='+encodeURIComponent(document.getElementById('advisorContext').value));
  var data=modelAdvisor.data,h=data.hardware;
  document.getElementById('advisorHardware').textContent='RAM physique : '+advisorGiB(h.totalBytes)+' · réserve système : '+advisorGiB(Math.max(4*1024**3,h.totalBytes*.2))+' · mémoire libre OS : '+advisorGiB(h.freeBytes)+' (ne représente pas toute la mémoire récupérable) · disque libre : '+advisorGiB(h.diskFreeBytes)+' · dossier présumé : '+h.modelsPath;
  document.getElementById('advisorAssumptions').textContent=data.assumptions;
  document.getElementById('advisorCatalogVersion').textContent='Catalogue '+data.catalogVersion+' · vérifié le '+data.verifiedAt+' · estimateur '+data.estimatorVersion+' · confiance faible, sans garantie de chargement.';
  modelAdvisor.selected=new Set([...modelAdvisor.selected].filter(id=>data.variants.some(v=>v.id===id&&v.selectable)));
  var family=document.getElementById('advisorFamily'),previous=family.value;family.textContent='';
  ['Toutes les familles',...new Set(data.variants.map(v=>v.family))].forEach((value,index)=>{var option=document.createElement('option');option.value=index?value:'';option.textContent=value;family.appendChild(option);});family.value=previous;
  renderModelAdvisor();advisorMessage(h.supported?'Choisissez les variantes à télécharger. Les couleurs sont des estimations au contexte indiqué.':'Analyse Apple Silicon uniquement dans cette première version.');
 }catch(e){advisorMessage('Analyse impossible : '+e.message);}
 finally{document.getElementById('advisorAnalyze').disabled=false;}
}
function renderModelAdvisor(){
 var data=modelAdvisor.data;if(!data)return;var list=document.getElementById('advisorVariants');list.textContent='';
 var family=document.getElementById('advisorFamily').value,architecture=document.getElementById('advisorArchitecture').value,format=document.getElementById('advisorFormat').value,modality=document.getElementById('advisorModality').value;
 var labels={green:'Vert · marge estimée',orange:'Orange · sous conditions',red:'Rouge · déconseillé',unavailable:'Grisé · hors contraintes locales',unknown:'Estimation indisponible',cloud:'Cloud uniquement'};
 data.variants.filter(v=>(!family||v.family===family)&&(!architecture||v.architecture===architecture)&&(!format||v.format===format)&&(!modality||v.modalities.includes(modality))).forEach(v=>{
  var card=document.createElement('article');card.className='advisor-variant advisor-'+v.status;
  var label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=modelAdvisor.selected.has(v.id);check.disabled=!v.selectable||modelAdvisor.downloading;check.addEventListener('change',()=>{if(check.checked)modelAdvisor.selected.add(v.id);else modelAdvisor.selected.delete(v.id);updateAdvisorSelection();});
  label.appendChild(check);label.appendChild(document.createTextNode(' '+v.id));card.appendChild(label);
  var badge=document.createElement('strong');badge.className='advisor-status';badge.textContent=labels[v.status];card.appendChild(badge);
  var summary=document.createElement('p');summary.textContent=v.reason;card.appendChild(summary);
  var sizes=document.createElement('p');sizes.textContent='Téléchargement ≈ '+advisorGiB(v.weightsBytes)+' · mémoire estimée : '+(v.range?advisorGiB(v.range.lowerBytes)+' à '+advisorGiB(v.range.upperBytes):'inconnue')+' · contexte '+v.contextTokens+' tokens'+(v.suggestedContextTokens?' · essayer '+v.suggestedContextTokens+' tokens puis recalculer':'');card.appendChild(sizes);
  var details=document.createElement('details'),heading=document.createElement('summary'),info=document.createElement('p'),source=document.createElement('a');heading.textContent='Sources et limites';info.textContent=v.format+' · '+v.architecture+' · modalités déclarées : '+v.modalities.join(', ')+' · '+v.notes;source.textContent='Fiche Ollama et licence';source.href=v.source;source.target='_blank';source.rel='noopener noreferrer';details.append(heading,info,source);card.appendChild(details);list.appendChild(card);
 });
 if(!list.children.length)list.textContent='Aucune variante dans ces filtres.';
 updateAdvisorSelection();
}
function updateAdvisorSelection(){
 var data=modelAdvisor.data;if(!data)return;var chosen=data.variants.filter(v=>modelAdvisor.selected.has(v.id));
 var bytes=chosen.reduce((sum,v)=>sum+(v.weightsBytes||0),0),required=bytes*1.1+2*1024**3,space=data.hardware.diskFreeBytes,red=chosen.some(v=>v.status==='red');
 document.getElementById('advisorSelection').textContent=chosen.length+' variante(s) · volume publié ≈ '+advisorGiB(bytes)+' · espace requis avec marges ≈ '+advisorGiB(required)+' · téléchargements séquentiels, chargement à vérifier lors du benchmark.'+(Number(document.getElementById('advisorContext').value)!==data.contextTokens?' Contexte modifié : recalculez avant téléchargement.':'');
 document.getElementById('advisorDownload').disabled=modelAdvisor.downloading||Number(document.getElementById('advisorContext').value)!==data.contextTokens||!chosen.length||!Number.isFinite(space)||required>space||!document.getElementById('advisorPathConfirmed').checked||red&&!document.getElementById('advisorAllowRed').checked;
}
function advisorDownloadLock(locked){
 modelAdvisor.downloading=locked;state.isRunning=locked;lockCampaignControls(locked);
 document.querySelectorAll('#modelAdvisorModal input, #modelAdvisorModal select, #advisorAnalyze, #advisorDownload').forEach(el=>el.disabled=locked);
 document.getElementById('advisorCancel').hidden=!locked;document.getElementById('advisorCancel').disabled=locked&&!modelAdvisor.job;
 if(!locked){renderModelAdvisor();updateAdvisorSelection();if(typeof renderInterfaceMode==='function')renderInterfaceMode();}
}
async function downloadAdvisedModels(){
 if(advisorBusy()||!modelAdvisor.selected.size)return;
 updateAdvisorSelection();if(document.getElementById('advisorDownload').disabled)return;
 modelAdvisor.job=null;advisorDownloadLock(true);
 try{var data=await advisorRequest('/download',{models:[...modelAdvisor.selected],contextTokens:modelAdvisor.data.contextTokens,pathConfirmed:document.getElementById('advisorPathConfirmed').checked,allowRed:document.getElementById('advisorAllowRed').checked});
  modelAdvisor.job=data.id;advisorDownloadLock(true);await pollAdvisorJob();
 }catch(e){
  try{var session=await advisorRequest('/session');modelAdvisor.token=session.token;if(session.activeJob){modelAdvisor.job=session.activeJob;advisorDownloadLock(true);await pollAdvisorJob();return;}}catch(_){}
  advisorDownloadLock(false);advisorMessage('Lancement non confirmé : '+e.message+'. Vérifiez Ollama avant de relancer si la connexion a été interrompue.');
 }
}
async function pollAdvisorJob(){
 clearTimeout(modelAdvisor.timer);
 try{var job=await advisorRequest('/jobs/'+modelAdvisor.job),list=document.getElementById('advisorJobs');list.textContent='';
  var labels={queued:'En attente',downloading:'Téléchargement',installed:'Installé',failed:'Échec',cancelled:'Annulé','not-started':'Non lancé'};
  job.entries.forEach(e=>{var row=document.createElement('p');row.textContent=e.model+' — '+(labels[e.status]||e.status)+' · '+e.message+(e.layerTotal>0?' · couche '+Math.min(100,Math.round((e.layerCompleted||0)/e.layerTotal*100))+' %':'');list.appendChild(row);});
  if(job.status==='running'){modelAdvisor.timer=setTimeout(pollAdvisorJob,1000);return;}
  advisorDownloadLock(false);advisorMessage(job.status==='completed'?'Installations terminées. Rafraîchissement de la liste Ollama ; choisissez ensuite vos modèles et lancez le benchmark.':'File arrêtée : '+job.status+'. Les modèles déjà installés sont conservés.');if(state.runner==='ollama')await fetchModels();
 }catch(e){if(e.message==='job-not-found'){advisorDownloadLock(false);advisorMessage('File introuvable après un redémarrage du backend. Vérifiez les modèles installés dans Ollama avant de relancer.');return;}advisorMessage('Suivi indisponible : '+e.message+'. Le téléchargement peut continuer côté backend ; nouvel essai dans 3 secondes.');modelAdvisor.timer=setTimeout(pollAdvisorJob,3000);}
}
async function cancelAdvisedDownloads(){try{await advisorRequest('/jobs/'+modelAdvisor.job+'/cancel',{});await pollAdvisorJob();}catch(e){advisorMessage('Annulation non confirmée : '+e.message);}}
