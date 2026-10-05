// A fixed, versioned task using native tool calls. No text-to-command execution.
function updateBenchmarkMode() {
  var active = document.getElementById('benchmarkMode')?.value === 'agentic';
  document.getElementById('promptCategoryCard').hidden = active;
  document.getElementById('agenticDescription').hidden = !active;
  updateCampaignPlan();
}
async function agenticRequest(route, body, session, signal, method) {
  var base = window.MEMORY_MONITOR_CONFIG.backendUrl.replace(/\/$/, '');
  var url = new URL(base);
  if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw new Error('Le backend agentique doit être local.');
  var response = await fetchWithTimeout(base+'/api/agentic'+route, {
    method: method || (body ? 'POST' : 'GET'), signal,
    headers: {'Content-Type':'application/json','X-LLMB-Agentic':'1',...(session ? {Authorization:'Bearer '+session.token} : {})},
    body: body ? JSON.stringify(body) : null
  }, 10000);
  if (!response.ok) throw new Error('Backend agentique indisponible ou budget atteint (HTTP '+response.status+'). Relancez npm start.');
  return response.json();
}
async function executeAgenticTest(model, rep, signal, warmupRuns) {
  var runner=state.runner, session=null, outcome=null, memory=null, loadedBefore=null;
  var startedAt=new Date().toISOString(), started=performance.now(), finishedAt, elapsed=0;
  var tokens=0, declared=true, turns=0, text='', failure=null, genMs=0, prefillMs=0, timingKnown=true, timingReports=0, thinking=false;
  var maximum=getMaxTokens(), temperature=getTemperatureForPromptType('agentic-files');
  var taskController=new AbortController(), externalSignal=signal, deadlineTimer;
  function cancelTask(){taskController.abort();}
  if(externalSignal.aborted)cancelTask();else externalSignal.addEventListener('abort',cancelTask,{once:true});
  signal=taskController.signal;
  var load=await observeLoadedModel(model,signal);
  try {
    loadedBefore=await loadedModelSnapshot(model);
    if(runner==='ollama'){await ollamaMemoryMonitor.startResources();ollamaMemoryMonitor.start(model);}
    session=await agenticRequest('/start',{},null,signal);
    // Budget starts when the workspace is created, after loading and telemetry setup.
    started=performance.now();startedAt=new Date().toISOString();
    deadlineTimer=setTimeout(cancelTask,session.budget.timeoutMs);
    var messages=[{role:'user',content:session.prompt}], done=false;
    while(turns<8 && !done){
      if(signal.aborted)throw new Error('Test agentique annulé.');
      var remaining=session.budget.timeoutMs-(performance.now()-started);
      if(remaining<=0)throw new Error('Limite de 3 minutes atteinte.');
      if(tokens>=maximum)throw new Error('Budget total de tokens atteint.');
      turns++;setProgress((turns-1)/8*100,'Agentique · tentative '+rep+' · tour '+turns+'/8');
      var body={model,messages,tools:session.tools,stream:false};
      if(runner==='ollama')body.options=buildOllamaOptions(temperature,Math.min(1024,maximum-tokens),null);
      else {body.temperature=temperature;body.max_tokens=Math.min(1024,maximum-tokens);}
      var response=await fetchWithTimeout(RUNNERS[runner].base+(runner==='ollama'?'/api/chat':'/v1/chat/completions'),
        {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal},remaining);
      if(!response.ok)throw new Error('Le runner a refusé les appels d’outils (HTTP '+response.status+'). Vérifiez le support natif du modèle.');
      var data=await response.json(), message=runner==='ollama'?data.message:data.choices?.[0]?.message;
      if(data.error || !message || message.role!=='assistant')throw new Error('Réponse structurée du modèle absente.');
      var reported=runner==='ollama'?data.eval_count:data.usage?.completion_tokens;
      if(Number.isSafeInteger(reported)&&reported>=0)tokens+=reported;
      else {declared=false;tokens+=estimateTokens(JSON.stringify(message));}
      if(runner==='ollama' && Number.isFinite(data.eval_duration)&&Number.isFinite(data.prompt_eval_duration)){timingReports++;genMs+=data.eval_duration/1e6;prefillMs+=data.prompt_eval_duration/1e6;}else timingKnown=false;
      thinking=thinking||!!message.thinking||String(message.content||'').includes('<think>');
      text=typeof message.content==='string'?message.content:'';
      var calls=message.tool_calls || [];
      if(!Array.isArray(calls))throw new Error('Appels d’outils invalides.');
      messages.push(message);
      var stopReason=runner==='ollama'?data.done_reason:data.choices?.[0]?.finish_reason;
      if(['length','max_tokens'].includes(stopReason)||tokens>maximum)throw new Error('Réponse tronquée ou budget de tokens dépassé.');
      if(!calls.length){done=true;break;}
      for(var call of calls){
        if(signal.aborted)throw new Error('Test agentique annulé.');
        if(performance.now()-started>session.budget.timeoutMs)throw new Error('Limite de 3 minutes atteinte.');
        var name=call.function?.name,args=call.function?.arguments;
        if(typeof args==='string'){try{args=JSON.parse(args);}catch(_){args=null;}}
        if(runner!=='ollama' && (typeof call.id!=='string'||!call.id))throw new Error('Identifiant d’appel d’outil absent.');
        var result=await agenticRequest('/'+session.id+'/tool',{name,arguments:args},session,signal);
        addDebugLog('Agentique · '+name+' : '+(result.ok?'validé':'rejeté'),'info');
        messages.push(runner==='ollama'?{role:'tool',tool_name:name,content:JSON.stringify(result)}:
          {role:'tool',tool_call_id:call.id,content:JSON.stringify(result)});
      }
    }
    if(!done)throw new Error('Limite de 8 tours modèle atteinte.');
    outcome=await agenticRequest('/'+session.id+'/finish',{},session,signal);
    if(!outcome.agentic.evaluation.taskSuccess)failure='Le scénario n’a pas passé toutes les vérifications : calcul, création, contenu Markdown et relecture.';
  } catch(error) {
    failure=signal.aborted?(externalSignal.aborted?'Test agentique annulé.':'Limite de 3 minutes atteinte.'):error.message;
    if(session && !outcome){try{outcome=await agenticRequest('/'+session.id+'/finish',{reason:'failed'},session);}catch(_){
      try{await agenticRequest('/'+session.id,null,session,null,'DELETE');}catch(_){}
    }}
  } finally {
    clearTimeout(deadlineTimer);externalSignal.removeEventListener('abort',cancelTask);
    elapsed=performance.now()-started;finishedAt=new Date().toISOString();
    if(runner==='ollama'){
      try{memory=ollamaMemoryMonitor.stop();await ollamaMemoryMonitor._fetchLoadedModel(ollamaMemoryMonitor.generation,true);
        if(ollamaMemoryMonitor.resourcesPending)await ollamaMemoryMonitor.resourcesPending;
        await ollamaMemoryMonitor.pollResources(true);
        memory={peak:memory.peakMemory||null,average:memory.averageMemory||null,source:memory.source,unit:'MiB',
          readings:memory.readings,sampleCount:memory.readings.length,intervalMs:window.MEMORY_MONITOR_CONFIG.pollInterval,
          loadedModelBefore:loadedBefore,loadedModel:ollamaMemoryMonitor.loadedModel,resources:ollamaMemoryMonitor.resources};
      }catch(_){}finally{await ollamaMemoryMonitor.cancelResources();}
    }
  }
  // No session/evaluator means no valid agentic record: do not invent an evaluation.
  if(!outcome)throw new Error(failure || 'Vérification backend indisponible ; aucun résultat agentique certifié.');
  return {id:crypto.randomUUID(),kind:'agentic',agentic:outcome.agentic,agenticArtifactText:outcome.artifactText,
    model,runner:RUNNERS[runner].name,runnerVersion:state.runnerVersion||null,modelMetadata:state.modelMetadata,
    timestamp:finishedAt,startedAt,finishedAt,phase:'measurement',rep,promptType:'agentic-files',promptTypeName:'Agentique · fichiers',promptEmoji:'🤖',
    promptText:session.prompt,response:text,error:failure,
    protocol:{version:'agentic-files-1.0.0',promptDigest:await promptFingerprint(session.prompt),loadState:load,cacheState:'unknown',warmupRuns},
    metrics:{totalTokens:tokens,tokensPerSec:elapsed>0?Math.round(tokens/(elapsed/1000)*10)/10:0,totalTime:Math.round(elapsed),ttft:null,
      tokenCountKind:declared?'declared':'estimated',tokenCountSource:declared?'native-chat:sum-output-token-counts':'native-chat:mixed-estimates',
      generationTimeMs:timingKnown&&timingReports?genMs:null,prefillTimeMs:timingKnown&&timingReports?prefillMs:null,generationTokensPerSec:timingKnown&&genMs>0?tokens/(genMs/1000):null,
      temperature,maxTokens:maximum,thinkingObserved:thinking,contextMode:'auto',contextRequestedTokens:null,contextObservedTokens:memory?.loadedModel?.contextTokens??null},
    env:JSON.parse(JSON.stringify(state.env)),...(memory?{memory}:{})};
}
async function runAgenticBenchmark() {
  if(state.isRunning||state.analysisRunning)return;
  if(!['ollama','lmstudio','llamacpp'].includes(state.runner)){showToast('Premier scénario : Ollama, LM Studio ou llama.cpp locaux, avec appels d’outils natifs.','error');return;}
  var model=getSelectedModel(),repetitions=getRepetitions(), runner=state.runner;
  if(!model||model==='unknown-model'||!Number.isInteger(repetitions)||repetitions<1||repetitions>20){showToast('Choisissez un modèle et 1 à 20 répétitions.','error');return;}
  if(state.unsavedSession && saveSessionToHistory(state.unsavedSession)===false)return;
  state.unsavedSession=null;state.isRunning=true;lockCampaignControls(true);
  var results=[],button=document.getElementById('runBtn'),warmups=0;
  var campaignController=new AbortController();currentAbortController=campaignController;
  document.getElementById('agenticStop').hidden=false;button.disabled=true;
  function remember(r){results.push(r);state.results.unshift(r);renderResultCard(r);}
  try{
    await agenticRequest('/info',null,null,campaignController.signal);
    resetCampaignResults();switchTab('results');document.getElementById('progressSection').style.display='block';
    await refreshModelMetadata();state.runnerVersion=null;
    if(runner==='ollama'){var version=await fetchWithTimeout(RUNNERS.ollama.base+'/api/version',{signal:campaignController.signal},5000);if(version.ok)state.runnerVersion=(await version.json()).version||null;}
    button.textContent='Chargement / chauffe…';
    var warm=await executeTest(model,{id:'warmup',name:'Chargement / chauffe',emoji:'🔥'},'Réponds uniquement par OK.',1,campaignController.signal,
      {warmup:true,loadState:await observeLoadedModel(model,campaignController.signal),warmupRuns:0});
    if(!warm.metrics.totalTokens&&!warm.response)throw new Error('Le modèle ne répond pas pendant la chauffe.');
    remember(warm);warmups++;
    showLiveSections(false);setControlButtons(false);
    for(var rep=1;rep<=repetitions;rep++){
      if(campaignController.signal.aborted)break;
      if(runner==='ollama' && await observeLoadedModel(model,campaignController.signal)==='cold')throw new Error('Modèle déchargé : relancez après vérification du runner.');
      button.textContent='Scénario agentique · '+rep+'/'+repetitions;
      remember(await executeAgenticTest(model,rep,campaignController.signal,warmups));
    }
    showToast('Campagne agentique terminée. Consultez les vérifications de chaque tentative.','success');
  }catch(error){showToast(error.message,'error');}
  finally{
    if(results.length){var session={model,runner,results,env:JSON.parse(JSON.stringify(state.env)),repetitions,warmupRuns:warmups};
      if(saveSessionToHistory(session)===false)state.unsavedSession=session;}
    document.getElementById('exportBtn').disabled=!state.results.length;
    document.getElementById('progressSection').style.display='none';document.getElementById('agenticStop').hidden=true;
    currentAbortController=null;showLiveSections(false);setControlButtons(false);button.disabled=false;button.textContent='⚡ Lancer le benchmark';
    state.isRunning=false;lockCampaignControls(false);renderStatistics();
  }
}
function stopAgenticBenchmark(){currentAbortController?.abort();}
function downloadAgenticArtifact(id){
  var result=state.results.find(r=>r.id===id);if(!result?.agenticArtifactText)return;
  var url=URL.createObjectURL(new Blob([result.agenticArtifactText],{type:'text/markdown;charset=utf-8'})),link=document.createElement('a');
  link.href=url;link.download='LLMB-'+result.model.replace(/[^a-zA-Z0-9._-]/g,'-')+'-agentic-answer.md';link.click();URL.revokeObjectURL(url);
}
