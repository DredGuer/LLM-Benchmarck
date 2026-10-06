// Named campaign settings stay in this browser. Keys and hardware inventories are excluded.
var PROFILE_STORAGE_KEY = 'llmb-campaign-profiles-v1';
var INTERFACE_MODE_KEY = 'llmb-interface-mode';
function configurationBusy() { return !!(state.isRunning || state.batchActive || state.analysisRunning || state.configuring); }
function profileField(id) { return document.getElementById(id); }
function checkedBatchModels() { return Array.from(document.querySelectorAll('#batchModels input:checked')).map(el => el.value); }
function validateCampaignSettings(c) {
  var fail = () => { throw new Error('Profil de campagne invalide ou incompatible.'); };
  if (!c || c.version !== '1.0.0' || !Object.hasOwn(RUNNERS, c.runner)) fail();
  function str(v, max) { if (typeof v !== 'string' || v.length > max) fail(); }
  function num(v, min, max, integer) { if (!Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) fail(); }
  function bool(v) { if (typeof v !== 'boolean') fail(); }
  str(c.model,256); str(c.customModel,256); str(c.customPrompt,100000);str(c.customBase,2048);
  if(c.customBase){try{var url=new URL(c.customBase);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)fail();}catch{throw new Error('L’URL du profil doit être HTTP(S), sans identifiants ni paramètres secrets.');}}
  if (!Array.isArray(c.models) || c.models.length>100 || new Set(c.models).size!==c.models.length) fail();
  c.models.forEach(m=>{str(m,256);if(!m.trim())fail();});
  if (!Array.isArray(c.prompts) || c.prompts.some(id=>!PROMPT_TYPES.some(p=>p.id===id)) || new Set(c.prompts).size!==c.prompts.length) fail();
  if (!Array.isArray(c.agenticScenarios) || c.agenticScenarios.some(id=>!AGENTIC_SCENARIOS.some(s=>s.id===id)) || new Set(c.agenticScenarios).size!==c.agenticScenarios.length) fail();
  bool(c.manual);bool(c.agentic);bool(c.quality);bool(c.controlled);bool(c.continueErrors);
  num(c.temperature,0,2);num(c.customTemperature,0,2);num(c.maxTokens,1,32768,true);num(c.repetitions,1,20,true);
  num(c.contextA,1024,262144,true);num(c.contextB,1024,262144,true);
  if(c.controlled && (c.contextA===c.contextB || c.runner!=='ollama'))fail();
  if(c.agentic&&!['ollama','lmstudio','llamacpp','mlx'].includes(c.runner))fail();
  if(c.agentic&&!c.agenticScenarios.length)fail();
  if (!c.temperatures || typeof c.temperatures!=='object' || Array.isArray(c.temperatures))fail();
  for (var [id,temp] of Object.entries(c.temperatures)) { if(!PROMPT_TYPES.some(p=>p.id===id&&id!=='custom'))fail();num(temp,0,2); }
  // Return an explicit allowlist, so secrets in malformed storage never propagate.
  return {version:'1.0.0',runner:c.runner,customBase:c.customBase,model:c.model,customModel:c.customModel,models:c.models.slice(),prompts:c.prompts.slice(),customPrompt:c.customPrompt,
    manual:c.manual,temperature:c.temperature,customTemperature:c.customTemperature,maxTokens:c.maxTokens,repetitions:c.repetitions,
    temperatures:Object.fromEntries(Object.entries(c.temperatures)),agentic:c.agentic,agenticScenarios:c.agenticScenarios.slice(),quality:c.quality,
    controlled:c.controlled,contextA:c.contextA,contextB:c.contextB,continueErrors:c.continueErrors};
}
function captureCampaignSettings() {
  var temperatures={},saved=loadAdvancedConfig()?.temperatures || {};
  PROMPT_TYPES.forEach(p=>{if(p.id!=='custom'&&Number.isFinite(saved[p.id]))temperatures[p.id]=saved[p.id];});
  return validateCampaignSettings({version:'1.0.0',runner:state.runner,customBase:state.customBase||'',model:profileField('modelSelect').value||'',customModel:profileField('modelCustom').value||'',
    models:state.runner==='ollama'?(state.desiredBatchModels||checkedBatchModels()):[],prompts:Array.from(state.selectedPrompts),customPrompt:profileField('customPromptText').value||'',
    manual:isManualMode,temperature:Number(profileField('temperature').value),customTemperature:Number(profileField('customTemp').value),maxTokens:Number(profileField('maxTokens').value),repetitions:Number(profileField('repetitions').value),temperatures,
    agentic:agenticEnabled(),agenticScenarios:selectedAgenticScenarios().map(s=>s.id),quality:profileField('qualityEnabled').checked,
    controlled:profileField('controlledEnabled').checked,contextA:Number(profileField('controlledContextA').value),contextB:Number(profileField('controlledContextB').value),continueErrors:profileField('batchContinueErrors').checked});
}
function storedCampaignProfiles() {
  var value=JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY)||'[]');
  if(!Array.isArray(value)||value.length>40)throw new Error('Stockage des profils invalide.');
  return value.map(p=>{
    if(!p||typeof p.id!=='string'||!/^[a-f0-9-]{36}$/i.test(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>80)throw new Error('Profil sauvegardé invalide.');
    return {id:p.id,name:p.name,createdAt:p.createdAt,updatedAt:p.updatedAt,applicationVersion:p.applicationVersion,settings:validateCampaignSettings(p.settings)};
  });
}
function renderCampaignProfiles(selected) {
  var select=profileField('campaignProfileSelect');if(!select)return;
  select.textContent='';var placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='— Choisir un profil —';select.appendChild(placeholder);
  try {storedCampaignProfiles().forEach(p=>{var opt=document.createElement('option');opt.value=p.id;opt.textContent=p.name;select.appendChild(opt);});select.value=selected||'';}
  catch(error){showToast(error.message,'error');}
}
function saveCampaignProfile(update) {
  if(configurationBusy()||state.interfaceMode!=='pro')return;
  try {
    var settings=captureCampaignSettings(),profiles=storedCampaignProfiles(),id=update?profileField('campaignProfileSelect').value:null;
    var existing=profiles.find(p=>p.id===id),name=profileField('campaignProfileName').value.trim();
    if(update&&!existing)throw new Error('Choisissez le profil à mettre à jour.');
    if(!name||name.length>80)throw new Error('Donnez un nom de 1 à 80 caractères au profil.');
    if(!existing&&profiles.length>=40)throw new Error('Maximum : 40 profils.');
    if(profiles.some(p=>p.name===name&&p.id!==id))throw new Error('Ce nom existe déjà. Chargez le profil et utilisez Mettre à jour.');
    var now=new Date().toISOString(),profile={id:existing?.id||crypto.randomUUID(),name,createdAt:existing?.createdAt||now,updatedAt:now,applicationVersion:LLMB_VERSION,settings};
    if(existing)profiles[profiles.indexOf(existing)]=profile;else profiles.push(profile);
    localStorage.setItem(PROFILE_STORAGE_KEY,JSON.stringify(profiles));renderCampaignProfiles(profile.id);showToast('Profil « '+name+' » sauvegardé dans ce navigateur.','success');
  }catch(error){showToast(error.message,'error');}
}
async function applyCampaignSettings(settings) {
  var c=validateCampaignSettings(settings);
  // Persist temperature settings before changing the UI; a quota failure leaves it intact.
  localStorage.setItem(ADVANCED_CONFIG_KEY,JSON.stringify({temperatures:c.temperatures,savedAt:new Date().toISOString()}));
  isManualMode=c.manual;localStorage.setItem('llm_bench_mode',c.manual?'manual':'auto');
  state.desiredBatchModels=c.models.slice();
  state.customBase=c.customBase;
  if(state.runner!==c.runner)await selectRunner(c.runner);
  else if(c.runner==='custom'){updateRunnerConfig();await fetchModels();}
  profileField('modelSelect').value=c.model;profileField('modelCustom').value=c.customModel;
  if(c.model&&!profileField('modelSelect').value&&!c.customModel)profileField('modelCustom').value=c.model;
  state.selectedPrompts=new Set(c.prompts);
  for(var [id,value] of Object.entries({customPromptText:c.customPrompt,temperature:c.temperature,customTemp:c.customTemperature,maxTokens:c.maxTokens,repetitions:c.repetitions,controlledContextA:c.contextA,controlledContextB:c.contextB}))profileField(id).value=String(value);
  for(var [id,value] of Object.entries({agenticEnabled:c.agentic,qualityEnabled:c.quality,controlledEnabled:c.controlled,batchContinueErrors:c.continueErrors}))profileField(id).checked=value;
  AGENTIC_SCENARIOS.forEach(s=>{profileField('agentic-'+s.id).checked=c.agenticScenarios.includes(s.id);});
  renderPromptTypes();profileField('customPromptArea').classList.toggle('visible',c.prompts.includes('custom'));
  updateModeUI();renderPromptTypeConfigs();updateBenchmarkMode();
  renderBatchModels(state.availableBatchModels||[]);updateBatchSelection(false);
  await refreshModelMetadata();
}
async function loadCampaignProfile() {
  if(configurationBusy()||state.interfaceMode!=='pro')return;
  try {
    var p=storedCampaignProfiles().find(p=>p.id===profileField('campaignProfileSelect').value);if(!p)throw new Error('Choisissez un profil.');
    state.configuring=true;lockCampaignControls(true);renderInterfaceMode();await applyCampaignSettings(p.settings);
    profileField('campaignProfileName').value=p.name;state.proDraft=captureCampaignSettings();showToast('Profil « '+p.name+' » chargé.','success');
  }catch(error){showToast(error.message,'error');}
  finally{state.configuring=false;lockCampaignControls(false);renderInterfaceMode();}
}
function deleteCampaignProfile() {
  if(configurationBusy()||state.interfaceMode!=='pro')return;
  try{var id=profileField('campaignProfileSelect').value,profiles=storedCampaignProfiles(),p=profiles.find(p=>p.id===id);if(!p)return;
    if(!confirm('Supprimer le profil « '+p.name+' » ?'))return;
    localStorage.setItem(PROFILE_STORAGE_KEY,JSON.stringify(profiles.filter(p=>p.id!==id)));renderCampaignProfiles();profileField('campaignProfileName').value='';showToast('Profil supprimé.','info');
  }catch(error){showToast(error.message,'error');}
}
function prepareSimpleModel() {
  if(state.runner==='custom')return;
  var selected=getSelectedModel(),select=profileField('modelSelect');
  if(selected&&selected!=='unknown-model'){
    select.value=selected;
    if(!select.value){var option=document.createElement('option');option.value=selected;option.textContent=selected;select.appendChild(option);select.value=selected;}
  }
  profileField('modelCustom').value='';
}
function applySimpleDefaults() {
  state.selectedPrompts=new Set(PROMPT_TYPES.filter(p=>p.id!=='custom').map(p=>p.id));
  profileField('qualityEnabled').checked=true;profileField('controlledEnabled').checked=false;
  AGENTIC_SCENARIOS.forEach(s=>{profileField('agentic-'+s.id).checked=true;});
  profileField('repetitions').value='1';
  renderPromptTypes();updateBenchmarkMode();updateModeUI();
}
function renderInterfaceMode() {
  if(!configurationBusy())updateModeUI();
  var simple=state.interfaceMode==='simple';document.body.dataset.interfaceMode=simple?'simple':'pro';document.body.dataset.runner=state.runner;
  ['simple','pro'].forEach(mode=>{var button=profileField('interface-'+mode);button.setAttribute('aria-pressed',String(state.interfaceMode===mode));button.disabled=configurationBusy();});
  document.querySelectorAll('[data-profile-action]').forEach(el=>{el.disabled=configurationBusy();});
  profileField('runBtn').disabled=configurationBusy();
  if(simple)profileField('maxTokens').disabled=configurationBusy();
  profileField('agenticSimpleNote').textContent=agenticEnabled()?'Les 6 épreuves agentiques seront exécutées automatiquement.':'Activez cette option pour ajouter les 6 épreuves agentiques.';
  var available=['ollama','lmstudio','llamacpp','mlx'].includes(state.runner);
  profileField('agenticEnabled').disabled=configurationBusy()||!available;
  if(!available)profileField('agenticEnabled').checked=false;
  updateCampaignPlan();
  if(!configurationBusy())updateBatchSelection(false);
}
async function setInterfaceMode(mode) {
  if(!['simple','pro'].includes(mode)||configurationBusy()||state.interfaceMode===mode)return;
  try{
    if(mode==='simple')state.proDraft=captureCampaignSettings();
    else state.simpleDraft={maxTokens:profileField('maxTokens').value,agentic:agenticEnabled()};
    state.configuring=true;lockCampaignControls(true);state.interfaceMode=mode;renderInterfaceMode();
    if(mode==='simple'){
      prepareSimpleModel();profileField('maxTokens').value=state.simpleDraft?.maxTokens||'8192';profileField('agenticEnabled').checked=state.simpleDraft?.agentic||false;applySimpleDefaults();
    }else if(state.proDraft)await applyCampaignSettings(state.proDraft);
    localStorage.setItem(INTERFACE_MODE_KEY,mode);
  }catch(error){showToast(error.message,'error');}
  finally{state.configuring=false;lockCampaignControls(false);renderInterfaceMode();}
}
function initInterfaceModes() {
  renderCampaignProfiles();
  var mode=localStorage.getItem(INTERFACE_MODE_KEY)==='pro'?'pro':'simple';
  try{state.proDraft=captureCampaignSettings();}catch(error){showToast('Réglages existants invalides : vérifiez-les en Pro avant de sauvegarder un profil.','info');}
  state.interfaceMode=mode;
  if(mode==='simple'){prepareSimpleModel();applySimpleDefaults();}renderInterfaceMode();
}
async function launchConfiguredBenchmark() {
  if(configurationBusy())return;
  if(state.interfaceMode==='simple'){
    var max=Number(profileField('maxTokens').value);if(!Number.isInteger(max)||max<1||max>32768){showToast('Choisissez de 1 à 32 768 tokens maximum.','error');return;}
    applySimpleDefaults();
    if(state.runner==='ollama'){
      var model=getSelectedModel();if(!model||model==='unknown-model'){showToast('Choisissez un modèle.','error');return;}
      return runBatchCampaign([model]);
    }
    return runBenchmark();
  }
  if(state.runner==='ollama'){if(!checkedBatchModels().length){showToast('Cochez au moins un modèle dans Modèles à tester.', 'error');return;}return runBatchCampaign();}
  return runBenchmark();
}
