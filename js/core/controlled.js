// Explicit opt-in. Real inference is performed by the user's Ollama server.
function controlledEnabled() { return !!document.getElementById('controlledEnabled')?.checked; }
function controlledParameters() {
  var a=Number(document.getElementById('controlledContextA')?.value),b=Number(document.getElementById('controlledContextB')?.value);
  if(![a,b].every(n=>Number.isInteger(n)&&n>=1024&&n<=262144)||a===b)throw new Error('Choisissez deux contextes entiers distincts entre 1 024 et 262 144 tokens.');
  var limit=state.modelMetadata?.contextMaxTokens;
  if(Number.isFinite(limit)&&(a>limit||b>limit))throw new Error('Un contexte dépasse le maximum déclaré du modèle.');
  var maxTokens=getMaxTokens();if(!Number.isInteger(maxTokens)||maxTokens<1||maxTokens>32768)throw new Error('Plafond de sortie invalide.');
  return {contexts:[a,b],maxTokens};
}
function recordControlledResult(r) {
  if(!state.controlledActive)return;
  if(isOllamaCloud(r.model)){r.protocol=r.protocol||{};r.protocol.cachePolicy='remote-provider-managed; context and cache unverified; three repetitions; no local context comparison';return;}
  var requested=state.activeContextTokens,observed=r.metrics?.contextObservedTokens;
  r.protocol=r.protocol||{};Object.assign(r.protocol,{campaignId:state.controlledCampaignId,contextOrder:state.controlledContextOrder,
    requestedContextTokens:requested,contextValidation:!Number.isInteger(observed)?'unverified':observed===requested?'verified':'mismatch',
    cachePolicy:'runner unloaded and reloaded per context; OS/disk/prompt cache not guaranteed reset; ordered repetitions; one measured warmup per context'});
  if(r.protocol.contextValidation!=='verified')state.controlledStop=true;
}
async function runControlledCampaign(inBatch) {
  if(state.batchActive&&!inBatch)return;
  if(state.controlledPreparing||state.controlledActive||state.isRunning||state.analysisRunning)return;
  if(state.runner!=='ollama'){showToast('La campagne à contextes explicites est disponible pour Ollama uniquement.','error');return;}
  if(!getSelectedModel()||getSelectedModel()==='unknown-model'){showToast('Choisissez un modèle.','error');return;}
  if(!state.selectedPrompts.size&&!agenticEnabled()){showToast('Sélectionnez une catégorie ou une épreuve agentique.','error');return;}
  state.controlledPreparing=true;state.isRunning=true;lockCampaignControls(true);document.getElementById('runBtn').disabled=true;
  try {
    await refreshModelMetadata();var cloud=isOllamaCloud(getSelectedModel());
    var config=cloud?{contexts:[null],maxTokens:getMaxTokens()}:controlledParameters();
    if(!Number.isInteger(config.maxTokens)||config.maxTokens<1||config.maxTokens>32768)throw new Error('Plafond de sortie invalide.');
    if(cloud)showToast('Cloud : 3 répétitions en contexte fournisseur ; RAM distante et comparaison de contextes indisponibles.','info');
    var order=Number(localStorage.getItem('llmb-controlled-order')||0);if(!Number.isFinite(order))order=0;
    if(order%2)config.contexts.reverse();localStorage.setItem('llmb-controlled-order',String(order+1));
    state.isRunning=false;state.controlledPreparing=false;state.controlledActive=true;state.controlledStop=false;state.controlledCampaignId=crypto.randomUUID();state.controlledMaxTokens=config.maxTokens;
    for(var index=0;index<config.contexts.length;index++){
      state.activeContextTokens=config.contexts[index];state.controlledContextOrder=index+1;state.controlledAppend=index>0;
      if(!isOllamaCloud(getSelectedModel()))await unloadOllamaModel(getSelectedModel());
      await runBenchmark(!!state.batchActive);
      if(isOllamaCloud(getSelectedModel()))break;
      if(state.controlledStop||state.unsavedSession||state.batchAbort)break;
    }
    showToast(state.controlledStop?'Campagne contrôlée arrêtée : interruption, erreur ou contexte non vérifié. Consultez les résultats.':isOllamaCloud(getSelectedModel())?'Campagne cloud terminée : 3 répétitions, contexte fournisseur non vérifié.':'Campagne contrôlée terminée : 3 répétitions à chaque contexte.','info');
  }catch(error){if(state.batchActive)state.batchFailure=error.message;showToast(error.message,'error');}
  finally{state.isRunning=false;state.controlledPreparing=false;document.getElementById('runBtn').disabled=!!state.batchActive;state.controlledActive=false;state.activeContextTokens=null;state.controlledMaxTokens=null;state.controlledAppend=false;state.controlledStop=false;state.controlledCampaignId=null;lockCampaignControls(false);updateCampaignPlan();}
}
