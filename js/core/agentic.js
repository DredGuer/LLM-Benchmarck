// Integrated generation + agentic campaign, independent task evaluation and local-only traces.
var AGENTIC_SCENARIOS=[
 {id:'tool-selection',title:'Choix des outils et arguments JSON',detail:'Sélectionner les bons outils et transmettre des valeurs typées.'},
 {id:'files-report',title:'Données → fichiers → vérification',detail:'Lire des données, calculer et contrôler un rapport réel.'},
 {id:'error-recovery',title:'Erreur temporaire et reprise',detail:'Réagir à un échec explicite et poursuivre sans boucler.'},
 {id:'clarification',title:'Clarification avant écriture',detail:'Demander une information manquante au lieu de l’inventer.'},
 {id:'goal-revision',title:'Plusieurs tours et objectif modifié',detail:'Tenir compte d’une nouvelle instruction, sans réutiliser l’ancien résultat.'},
 {id:'no-tool',title:'Abstention : aucun outil nécessaire',detail:'Respecter une consigne textuelle sans action inutile.'}
];
function agenticEnabled(){return document.getElementById('agenticEnabled')?.checked===true;}
function selectedAgenticScenarios(){return AGENTIC_SCENARIOS.filter(s=>document.getElementById('agentic-'+s.id)?.checked!==false);}
function updateBenchmarkMode(){
  var panel=document.getElementById('agenticDescription');if(panel)panel.hidden=!agenticEnabled();
  // Generation categories remain available: both capabilities can share one campaign.
  var category=document.getElementById('promptCategoryCard');if(category)category.hidden=false;
  if(typeof renderInterfaceMode === "function" && state.interfaceMode)renderInterfaceMode();else updateCampaignPlan();
}
function initAgenticUI(){
  var list=document.getElementById('agenticScenarios');if(!list)return;list.textContent='';
  AGENTIC_SCENARIOS.forEach(s=>{var label=document.createElement('label');label.style.display='block';label.style.margin='10px 0';
    var checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.id='agentic-'+s.id;checkbox.checked=true;checkbox.addEventListener('change',updateCampaignPlan);
    label.appendChild(checkbox);label.appendChild(document.createTextNode(' '+s.title+' — '+s.detail));list.appendChild(label);});updateBenchmarkMode();
}
function agenticLiveStart(title){var panel=document.getElementById('agenticLive');if(!panel)return;
  panel.hidden=false;document.getElementById('agenticLiveTitle').textContent=title;document.getElementById('agenticLiveStatus').textContent='Préparation…';
  document.getElementById('agenticLiveTrace').textContent='';
}
function agenticLive(type,text){var status=document.getElementById('agenticLiveStatus'),trace=document.getElementById('agenticLiveTrace');if(!trace||!status)return;
  var labels={'tool-pending':'Appel natif en préparation','tool-name':'Outil choisi','tool-arguments':'Arguments préparés',thinking:'Réflexion rapportée par le runner',content:'Message du modèle',request:'Requête modèle en cours',tool:'Exécution outil',result:'Retour d’outil',verification:'Vérification indépendante',user:'Nouvelle instruction utilisateur',warmup:'Chargement / chauffe'};
  status.textContent=labels[type]||'Appel d’outil en préparation';
  var entry=trace.lastElementChild;
  if(!entry||entry.dataset.type!==type||!['thinking','content'].includes(type)){entry=document.createElement('p');entry.dataset.type=type;entry.style.whiteSpace='pre-wrap';entry.textContent=(labels[type]||type)+' : ';trace.appendChild(entry);}
  entry.textContent=(entry.textContent+String(text)).slice(0,16000);
  while(trace.children.length>160||trace.textContent.length>128000)trace.removeChild(trace.firstElementChild);trace.scrollTop=trace.scrollHeight;
}
async function agenticRequest(route,body,session,signal,method){
  var base=window.MEMORY_MONITOR_CONFIG.backendUrl.replace(/\/$/,''),url=new URL(base);
  if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('Le backend agentique doit être local.');
  var response=await fetchWithTimeout(base+'/api/agentic'+route,{method:method||(body?'POST':'GET'),signal,
    headers:{'Content-Type':'application/json','X-LLMB-Agentic':'1',...(session?{Authorization:'Bearer '+session.token}:{})},body:body?JSON.stringify(body):null},10000);
  if(!response.ok)throw new Error('Backend agentique indisponible ou budget atteint (HTTP '+response.status+'). Vérifiez npm start.');return response.json();
}
async function executeAgenticTest(model,rep,externalSignal,warmupRuns,scenario){
  var provenance=typeof captureTestProvenance==='function'?captureTestProvenance(model):null;
  var runner=state.runner,session=null,outcome=null,memory=null,loadedBefore=null,trace=[],traceBudget=65536,traceLimited=false,turns=0,tokens=0,declared=true,firstSegment=null,firstAnswer=null,firstTool=null,turnFirstContent=null,thinkingSeen=false,turnOpen=false;
  var genMs=0,prefillMs=0,timingKnown=true,timingReports=0,text='',failure=null,started=performance.now(),startedAt=new Date().toISOString(),finishedAt,elapsed=0;
  var maxTokens=getMaxTokens(),temperature=getTemperatureForPromptType('agentic'),controller=new AbortController(),deadlineTimer;
  var signal=controller.signal;function cancel(){controller.abort();}if(externalSignal.aborted)cancel();else externalSignal.addEventListener('abort',cancel,{once:true});
  var monitorLocal=runner==='ollama'&&!isOllamaCloud(model);
  var load=await observeLoadedModel(model,signal);
  function event(type,value){
    agenticLive(type,value);if(type==='thinking')thinkingSeen=true;
    if(['thinking','content','tool-name','tool-arguments'].includes(type)&&firstSegment===null)firstSegment=performance.now()-started;
    if(type==='content'&&turnFirstContent===null)turnFirstContent=performance.now()-started;
    value=String(value);if(traceBudget<=0){traceLimited=true;return;}if(value.length>traceBudget){value=value.slice(0,traceBudget);traceLimited=true;}traceBudget-=value.length;var last=trace.at(-1);
    if(['thinking','content'].includes(type)&&last?.type===type){if(last.text.length+value.length>16000)traceLimited=true;last.text=(last.text+value).slice(0,16000);}
    else if(trace.length<160){if(value.length>16000)traceLimited=true;trace.push({type,text:value.slice(0,16000),elapsedMs:Math.round(performance.now()-started)});}else traceLimited=true;
  }
  try{
    if(monitorLocal){loadedBefore=await loadedModelSnapshot(model);await ollamaMemoryMonitor.startResources();ollamaMemoryMonitor.start(model);}
    session=await agenticRequest('/start',{scenario:scenario.id},null,signal);
    started=performance.now();startedAt=new Date().toISOString();deadlineTimer=setTimeout(cancel,session.budget.timeoutMs);
    agenticLiveStart(session.scenario.title);event('request','Le modèle reçoit le cadre système, l’objectif et les schémas d’outils. Aucun flux de réflexion reçu à ce stade.');
    var messages=[{role:'system',content:session.systemPrompt},{role:'user',content:session.prompt}],done=false;
    while(turns<session.maxModelTurns&&!done){
      if(signal.aborted)throw new Error('Test agentique interrompu.');var remaining=session.budget.timeoutMs-(performance.now()-started);
      if(remaining<=0)throw new Error('Budget de temps atteint.');if(tokens>=maxTokens)throw new Error('Budget cumulé de tokens atteint.');
      turns++;setProgress((turns-1)/session.maxModelTurns*100,session.scenario.title+' · passe '+rep+' · tour '+turns+'/'+session.maxModelTurns);
      event('request','Tour '+turns+' : attente de la réponse ou des appels natifs.');
      var body={model,messages,tools:session.tools,stream:true};
      if(runner==='ollama')body.options=buildOllamaOptions(temperature,Math.min(2048,maxTokens-tokens),getRequestedContextTokens());
      else {body.temperature=temperature;body.max_tokens=Math.min(2048,maxTokens-tokens);body.stream_options={include_usage:true};}
      turnFirstContent=null;turnOpen=true;var response=await fetchWithTimeout(RUNNERS[runner].base+(runner==='ollama'?'/api/chat':'/v1/chat/completions'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal},remaining);
      var turn=await consumeAgenticChat(response,runner,signal,event),message=turn.message,calls=message.tool_calls||[];turnOpen=false;
      var reported=turn.usage?.outputTokens;if(Number.isSafeInteger(reported)&&reported>=0)tokens+=reported;else{declared=false;tokens+=estimateTokens(JSON.stringify(message));}
      if(Number.isFinite(turn.timing.generationMs)&&Number.isFinite(turn.timing.prefillMs)){genMs+=turn.timing.generationMs;prefillMs+=turn.timing.prefillMs;timingReports++;}else timingKnown=false;
      text=message.content||'';messages.push(message);
      if(['length','max_tokens'].includes(turn.finishReason)||tokens>maxTokens)throw new Error('Tour tronqué ou budget de tokens dépassé.');
      if(!calls.length){firstAnswer=turnFirstContent;done=true;break;}
      var nextUser=[];
      for(var call of calls){if(signal.aborted)throw new Error('Test agentique interrompu.');
        var name=call.function?.name,args=call.function?.arguments;if(typeof args==='string'){try{args=JSON.parse(args);}catch(_){args=null;}}
        if(runner!=='ollama'&&(!call.id||typeof call.id!=='string'))throw new Error('Identifiant d’appel natif absent.');
        if(firstTool===null)firstTool=performance.now()-started;
        event('tool',name+' '+JSON.stringify(args));
        var result=await agenticRequest('/'+session.id+'/tool',{name,arguments:args},session,signal);
        event('result',JSON.stringify(result));
        messages.push(runner==='ollama'?{role:'tool',tool_name:name,content:JSON.stringify(result)}:{role:'tool',tool_call_id:call.id,content:JSON.stringify(result)});
        if(result.nextUserMessage)nextUser.push(result.nextUserMessage);
      }
      nextUser.forEach(content=>{messages.push({role:'user',content});event('user',content);});
    }
    if(!done)throw new Error('Limite de tours modèle atteinte.');event('verification','Contrôle des états, fichiers, dépendances et consignes par le backend.');
    outcome=await agenticRequest('/'+session.id+'/finish',{finalAnswer:text},session,signal);
    if(!outcome.agentic.evaluation.taskSuccess)failure='Épreuve non conforme : consultez les critères réussis et échoués ci-dessous.';
  }catch(error){failure=signal.aborted?(externalSignal.aborted?'Test agentique annulé.':'Budget de temps atteint.'):error.message;
    if(session&&!outcome){try{outcome=await agenticRequest('/'+session.id+'/finish',{reason:'failed',finalAnswer:text},session);}catch(_){try{await agenticRequest('/'+session.id,null,session,null,'DELETE');}catch(_){}}}
    event('verification',failure);
  }finally{
    clearTimeout(deadlineTimer);externalSignal.removeEventListener('abort',cancel);elapsed=performance.now()-started;finishedAt=new Date().toISOString();
    if(monitorLocal){try{var stats=ollamaMemoryMonitor.stop();await ollamaMemoryMonitor._fetchLoadedModel(ollamaMemoryMonitor.generation,true);if(ollamaMemoryMonitor.resourcesPending)await ollamaMemoryMonitor.resourcesPending;await ollamaMemoryMonitor.pollResources(true);
      memory={peak:stats.peakMemory||null,average:stats.averageMemory||null,source:stats.source,unit:'MiB',readings:stats.readings,sampleCount:stats.readings.length,intervalMs:window.MEMORY_MONITOR_CONFIG.pollInterval,loadedModelBefore:loadedBefore,loadedModel:ollamaMemoryMonitor.loadedModel,resources:ollamaMemoryMonitor.resources};
    }catch(_){}finally{await ollamaMemoryMonitor.cancelResources();}}
  }
  if(isOllamaCloud(model)){memory=null;provenance=typeof captureTestProvenance==='function'?captureTestProvenance(model):null;}
  if(!outcome)throw new Error(failure||'Aucune évaluation backend reçue.');
  return {id:crypto.randomUUID(),provenance,executionOutcome:done?'completed':signal.aborted?'interrupted':'failed',kind:'agentic',agentic:outcome.agentic,agenticArtifacts:outcome.artifactTexts,agenticTrace:trace,agenticTraceLimited:traceLimited,agenticSystemPrompt:session.systemPrompt,agenticToolSchemas:session.tools,
    model,runner:RUNNERS[runner].name,runnerVersion:state.runnerVersion||null,modelMetadata:state.modelMetadata,timestamp:finishedAt,startedAt,finishedAt,phase:'measurement',rep,
    promptType:'agentic-'+scenario.id,promptTypeName:'Agentique · '+scenario.title,promptEmoji:'🤖',promptText:session.prompt,response:text,error:failure,
    protocol:{version:'agentic-suite-'+session.version,promptDigest:await promptFingerprint(session.systemPrompt+'\n'+session.prompt),loadState:load,cacheState:'unknown',warmupRuns},
    metrics:{totalTokens:turnOpen?null:tokens,tokensPerSec:turnOpen?null:elapsed>0?Math.round(tokens/(elapsed/1000)*10)/10:0,totalTime:Math.round(elapsed),ttft:firstSegment===null?null:Math.round(firstSegment),firstAnswerTimeMs:firstAnswer===null?null:Math.round(firstAnswer),firstToolTimeMs:firstTool===null?null:Math.round(firstTool),modelTurns:turns,
      tokenCountKind:!turnOpen&&declared?'declared':'estimated',tokenCountSource:turnOpen?'native-chat:incomplete-token-total-unavailable':declared?'native-chat:sum-output-token-counts':'native-chat:mixed-estimates',generationTimeMs:!turnOpen&&timingKnown&&timingReports?genMs:null,prefillTimeMs:!turnOpen&&timingKnown&&timingReports?prefillMs:null,generationTokensPerSec:!turnOpen&&timingKnown&&genMs>0?tokens/(genMs/1000):null,
      temperature,maxTokens,thinkingObserved:thinkingSeen,contextMode:getRequestedContextTokens()===null?'auto':'explicit',contextRequestedTokens:getRequestedContextTokens(),contextObservedTokens:memory?.loadedModel?.contextTokens??null},env:JSON.parse(JSON.stringify(state.env)),...(memory?{memory}:{})};
}
async function runAgenticBenchmark(inBatch){
  if(state.batchActive&&!inBatch)return;
  if(state.isRunning||state.analysisRunning)return;
  if(!['ollama','lmstudio','llamacpp','mlx'].includes(state.runner)){showToast('La batterie agentique exige un runner local avec appels d’outils natifs.','error');return;}
  var scenarios=selectedAgenticScenarios(),generation=typeof campaignPromptTypes==='function'?campaignPromptTypes():PROMPT_TYPES.filter(pt=>state.selectedPrompts.has(pt.id)),model=getSelectedModel(),repetitions=getRepetitions(),runner=state.runner;
  if(!scenarios.length){showToast('Sélectionnez au moins une épreuve agentique.','error');return;}
  if(!model||model==='unknown-model'||!Number.isInteger(repetitions)||repetitions<1||repetitions>20){showToast('Choisissez un modèle et 1 à 20 répétitions.','error');return;}
  if(state.unsavedSession&&(await saveSessionToHistory(state.unsavedSession))===false)return;
  state.unsavedSession=null;state.isRunning=true;lockCampaignControls(true);var controller=new AbortController();currentAbortController=controller;
  var sessionId=crypto.randomUUID(),sessionSavedAt=new Date().toISOString();
  var results=[],warmups=0,button=document.getElementById('runBtn');button.disabled=true;document.getElementById('agenticStop').hidden=false;
  async function remember(r){if(typeof recordControlledResult==='function')recordControlledResult(r);results.push(r);state.results.unshift(r);renderResultCard(r);if(typeof queueDatabaseSave==='function' && await saveSessionToHistory({id:sessionId,savedAt:sessionSavedAt,model,runner,results,env:JSON.parse(JSON.stringify(state.env)),repetitions,warmupRuns:warmups})===false)throw Object.assign(new Error('Sauvegarde SQLite interrompue.'),{persistence:true});}
  async function warmup(){agenticLiveStart('Chargement / chauffe');agenticLive('warmup','Le runner charge le modèle et vérifie sa réponse ; cette passe reste hors des scores.');
    button.textContent='Chargement / chauffe…';var warm=await executeTest(model,{id:'warmup',name:'Chargement / chauffe',emoji:'🔥'},'Réponds uniquement par OK.',1,controller.signal,{warmup:true,loadState:await observeLoadedModel(model,controller.signal),warmupRuns:warmups});
    if(controller.signal.aborted)throw new Error('Campagne annulée pendant la chauffe.');if(!warm.metrics.totalTokens&&!warm.response)throw new Error('Le modèle ne répond pas pendant la chauffe.');await remember(warm);warmups++;if(state.controlledActive&&state.controlledStop)throw Object.assign(new Error('Contexte demandé non confirmé après la chauffe.'),{contextVerification:true});showLiveSections(false);setControlButtons(false);
  }
  try{var info=await agenticRequest('/info',null,null,controller.signal);if(info.version!=='2.0.1'||!Array.isArray(info.scenarios))throw new Error('Redémarrez le backend mis à jour : batterie agentique v2 requise.');
    resetCampaignResults();switchTab('results');document.getElementById('progressSection').style.display='block';await refreshModelMetadata();state.runnerVersion=null;
    if(runner==='ollama'){var v=await fetchWithTimeout(RUNNERS.ollama.base+'/api/version',{signal:controller.signal},5000);if(v.ok)state.runnerVersion=(await v.json()).version||null;}
    if(state.batchAbort)throw new Error("Campagne automatique interrompue.");
    await warmup();
    for(var rep=1;rep<=repetitions;rep++){
      for(var pt of generation){if(state.batchAbort || controller.signal.aborted || (state.controlledActive && state.controlledStop))break;
        if(runner==='ollama'&&await observeLoadedModel(model,controller.signal)==='cold')await warmup();
        var prompt=pt.id==='custom'?(document.getElementById('customPromptText').value.trim()||'Dis bonjour.'):pt.prompt;
        agenticLiveStart('Génération · '+pt.name);agenticLive('request','Mesure de génération ; le suivi texte est affiché dans la zone en direct.');
        button.textContent='Génération · '+pt.name+' · '+rep+'/'+repetitions;
        try{await remember(await executeTest(model,pt,prompt,rep,controller.signal,{loadState:await observeLoadedModel(model,controller.signal),warmupRuns:warmups}));}
        catch(error){if(controller.signal.aborted||error.persistence)throw error;await remember(buildErrorResult(model,pt,error.message,rep));}
        showLiveSections(false);setControlButtons(false);
      }
      for(var scenario of scenarios){if(state.batchAbort || controller.signal.aborted || (state.controlledActive && state.controlledStop))break;if(runner==='ollama'&&await observeLoadedModel(model,controller.signal)==='cold')await warmup();
        button.textContent=scenario.title+' · '+rep+'/'+repetitions;await remember(await executeAgenticTest(model,rep,controller.signal,warmups,scenario));}
      if(state.batchAbort || controller.signal.aborted || (state.controlledActive && state.controlledStop))break;
    }
    showToast(controller.signal.aborted?'Campagne interrompue ; résultats conservés.':'Campagne terminée : génération et capacités agentiques.','info');
  }catch(error){if(state.batchActive&&!error.contextVerification)state.batchFailure=error.message;if(state.controlledActive)state.controlledStop=true;showToast(error.message,'error');}
  finally{if(controller.signal.aborted&&state.controlledActive)state.controlledStop=true;if(results.length){var session={id:sessionId,savedAt:sessionSavedAt,model,runner,results,env:JSON.parse(JSON.stringify(state.env)),repetitions,warmupRuns:warmups};if((await saveSessionToHistory(session))===false)state.unsavedSession=session;}
    document.getElementById('exportBtn').disabled=!state.results.length;document.getElementById('progressSection').style.display='none';document.getElementById('agenticStop').hidden=true;
    currentAbortController=null;showLiveSections(false);setControlButtons(false);button.disabled=!!state.batchActive;button.textContent='⚡ Lancer le benchmark';state.isRunning=false;lockCampaignControls(false);renderStatistics();}
}
function stopAgenticBenchmark(){if(state.batchActive)requestBatchStop(true);else currentAbortController?.abort();}
function downloadAgenticArtifact(id,relative){var result=state.results.find(r=>r.id===id),text=relative?result?.agenticArtifacts?.[relative]:result?.agenticArtifactText;if(typeof text!=='string')return;
  var json=relative?.endsWith('.json'),url=URL.createObjectURL(new Blob([text],{type:json?'application/json':'text/markdown;charset=utf-8'})),link=document.createElement('a');
  link.href=url;link.download='LLMB-'+result.model.replace(/[^a-zA-Z0-9._-]/g,'-')+'-'+(relative?relative.split('/').pop():'agentic-answer.md');link.click();URL.revokeObjectURL(url);}
