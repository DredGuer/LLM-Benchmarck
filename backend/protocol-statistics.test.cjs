const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), crypto = require('node:crypto');
const script = p => fs.readFileSync(path.join(__dirname, '../' + p),'utf8');
async function campaign(fail) {
  let loaded=false, saved=[], rendered=[];
  const elements = Object.fromEntries(['runBtn','progressSection','resultsList','exportBtn'].map(id=>[id,{style:{},innerHTML:'old',textContent:'old'}]));
  const scope={state:{runner:'ollama',selectedPrompts:new Set(['conversation']),results:[{id:'old'}],env:{}},
    window:{}, document:{getElementById:id=>elements[id],querySelectorAll:()=>[]},
    getSelectedModel:()=> 'example', getRepetitions:()=>3, refreshModelMetadata:async()=>{},
    RUNNERS:{ollama:{type:'local',base:'http://local'}}, PROMPT_TYPES:[{id:'conversation',name:'Conversation',prompt:'hello'}],
    showToast(){},showResultsArea(){},resetLiveOutput(){},switchTab(){},setProgress(){},showLiveSections(){},setControlButtons(){},
    renderResultCard:r=>rendered.push(r),saveSessionToHistory:s=>saved.push(s), AbortController,
    fetchWithTimeout:async()=>({ok:true,json:async()=>({models:loaded?[{name:'example:latest'}]:[]})}), crypto,TextEncoder };
  vm.createContext(scope);vm.runInContext(script('js/core/protocol.js'),scope);vm.runInContext(script('js/core/benchmark.js'),scope);
  scope.executeTest=async(model,pt,prompt,rep,signal,protocol)=>{
    if(fail && protocol.warmup)throw Error('load failed');
    loaded=true;
    return {id:'test-'+rendered.length,phase:protocol.warmup?'warmup':'measurement',metrics:{totalTokens:1,tokensPerSec:10},response:'OK',protocol};
  };
  await scope.runBenchmark();
  assert.equal(scope.state.isRunning,false);assert.equal(elements.runBtn.disabled,false);assert.equal(saved.length,1);
  assert(!scope.state.results.some(r=>r.id==='old'));
  if(fail){assert.equal(rendered.length,1);assert.equal(rendered[0].phase,'warmup');assert(rendered[0].error);}
  else {assert.equal(rendered.length,4);assert.equal(rendered[0].phase,'warmup');
    assert.equal(rendered[0].protocol.loadState,'cold');assert.equal(rendered[1].protocol.loadState,'warm');
    assert.equal(rendered[1].protocol.warmupRuns,1);}
}
async function historySafety() {
 const scope={state:{},queueDatabaseSave:async()=>true};vm.createContext(scope);vm.runInContext(script('js/core/history.js'),scope);
 assert.equal(await scope.saveSessionToHistory({id:'a'}),true);
 scope.state.unsavedSession={id:'a'};await scope.saveSessionToHistory({id:'a'});assert.equal(scope.state.unsavedSession,null);
 scope.queueDatabaseSave=async()=>false;assert.equal(await scope.saveSessionToHistory({id:'b'}),false);
}
async function stream() {
  const scope={TextDecoder,TextEncoder,crypto};vm.createContext(scope);vm.runInContext(script('js/core/protocol.js'),scope);
  const encode=s=>new TextEncoder().encode(s);
  function response(parts) { return {ok:true,body:{getReader:()=>({read:async()=>parts.length?{done:false,value:encode(parts.shift())}:{done:true},releaseLock(){}})}}; }
  const frames=[];await scope.consumeOllamaStream(response(['{"res','ponse":"é"}\n{"done":tr','ue,"eval_count":1}']),null,d=>frames.push(d));
  assert.equal(frames[0].response,'é');assert.equal(frames.length,2);
  await assert.rejects(()=>scope.consumeOllamaStream(response(['{"error":"cannot load"}\n']),null,()=>{}));
  await assert.rejects(()=>scope.consumeOllamaStream(response(['{"response":"incomplete"}\n']),null,()=>{}));
  await assert.rejects(()=>scope.consumeOllamaStream({ok:false,status:500},null,()=>{}));
  assert.equal((await scope.promptFingerprint('hello')).length,64);
}
function statistics() {
 const scope={};vm.createContext(scope);vm.runInContext(script('js/ui/statistics.js'),scope);
 const base={model:'test',runner:'Ollama',phase:'measurement',env:{chip:'M3',ram:'36 GiB'},promptType:'conversation',promptText:'hello',
   modelMetadata:{parameterCount:2e9,type:'dense'},protocol:{version:'0.07',loadState:'warm',cacheState:'cold'},
   metrics:{tokensPerSec:10,temperature:0.7,maxTokens:256,contextObservedTokens:8192},timestamp:'2026-10-05T17:00:00Z'};
 const b={...base,id:'b',metrics:{...base.metrics,tokensPerSec:20}},a={...base,id:'a'};
 const groups=scope.buildStatistics([{results:[a,b,{...a,id:'warm',phase:'warmup'},{...a,id:'error',error:'failed'},a]}]);
 assert.equal(groups.length,1);assert.equal(groups[0].summary.tps.count,2);assert.equal(groups[0].summary.tps.mean,15);
 assert.equal(groups[0].summary.tps.median,15);assert.equal(groups[0].normalizedTPS,7.5);
 assert.equal(scope.buildStatistics([{results:[a,{...b,protocol:{...b.protocol,cacheState:'warm'}}]}]).length,2);
 assert.equal(scope.buildStatistics([{results:[a,{...b,modelMetadata:{...b.modelMetadata,type:'moe'}}]}]).length,2);
 assert.equal(scope.buildStatistics([{results:[a,{...b,metrics:{...b.metrics,contextObservedTokens:4096}}]}]).length,2);
}
(async()=>{await campaign(false);await campaign(true);await stream();statistics();await historySafety();
 console.log('PASS: cold warmup/warm measurements, no accumulation, saved failure/unlock, split NDJSON/errors, fingerprints and comparable statistics');
})().catch(error=>{console.error(error);process.exitCode=1;});
