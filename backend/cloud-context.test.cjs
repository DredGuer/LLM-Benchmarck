const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {validateReport}=require('../schemas/validate.cjs');
const read=p=>fs.readFileSync(p,'utf8');
function scopeFor(model='gemma4:cloud',controlled=true){
 const nodes=new Map(),requests=[],saved=[],messages=[];let id=0;
 const el=k=>{if(!nodes.has(k))nodes.set(k,{value:'',checked:false,style:{},textContent:'',appendChild(){},disabled:false});return nodes.get(k);};
 el('controlledEnabled').checked=controlled;el('controlledContextA').value='8192';el('controlledContextB').value='16384';el('maxTokens').value='8192';
 const s={state:{runner:'ollama',results:[],selectedPrompts:new Set(['conversation']),env:{chip:'CLIENT-M3',ram:36}},RUNNERS:{ollama:{base:'http://localhost:11434',type:'local',name:'Ollama'}},PROMPT_TYPES:[{id:'conversation',name:'Conversation',prompt:'Bonjour',emoji:'c'}],URL,TextEncoder,TextDecoder,crypto:crypto.webcrypto,AbortController,performance,setTimeout,clearTimeout,console,
 document:{getElementById:el,querySelectorAll:()=>[],createElement:()=>({style:{},appendChild(){}})},window:{MEMORY_MONITOR_CONFIG:{pollInterval:500}},localStorage:{getItem:()=>null,setItem(){}},
 getSelectedModel:()=>model,getMaxTokens:()=>8192,getRepetitions:()=>s.state.controlledActive?3:1,getTemperatureForPromptType:()=>s.state.controlledActive?0:0.7,
 agenticEnabled:()=>false,showToast:(msg)=>messages.push(msg),showResultsArea(){},resetLiveOutput(){},switchTab(){},setProgress(){},showLiveSections(){},setControlButtons(){},renderResultCard(){},renderStatistics(){},addDebugLog(){},updateThinkingOutput(){},updateTokenProgress(){},saveSessionToHistory:r=>{saved.push(r);return true;},
 ollamaMemoryMonitor:new Proxy({}, {get:(_,name)=>()=>{throw Error('Cloud must not use local telemetry: '+String(name));}}),
 fetchWithTimeout:async(url,options={})=>{
  requests.push({url,body:options.body?JSON.parse(options.body):null});
  if(url.endsWith('/api/show'))return {ok:true,json:async()=>model==='remote-alias'?{remote_host:'https://private.example?key=SECRET',remote_model:'remote-id'}:{}};
  if(url.endsWith('/api/version'))return {ok:true,json:async()=>({version:'proxy-version'})};
  if(url.endsWith('/api/generate')){
   const body=JSON.parse(options.body);assert.notEqual(body.keep_alive,0,'Never unload cloud');assert(!('num_ctx' in body.options));
   const bytes=new TextEncoder().encode(JSON.stringify({remote_model:'remote-id',remote_host:'https://private.example?key=SECRET',response:'OK',done:true,done_reason:'stop',eval_count:20,eval_duration:1000000000,prompt_eval_count:5})+'\n');
   return {ok:true,body:new ReadableStream({start(c){c.enqueue(bytes);c.close();}})};
  }
  throw Error('Cloud must not probe local residency: '+url);
 }};
 vm.createContext(s);for(const p of ['js/core/version.js','js/core/protocol.js','js/core/runners.js','js/core/controlled.js','js/core/benchmark.js','js/core/community-export.js','js/ui/statistics.js','js/ui/analysis.js'])vm.runInContext(read(p),s);
 s.saved=saved;s.requests=requests;s.messages=messages;s.el=el;return s;
}
(async()=>{
 for(const model of ['gemma4:cloud','gemma4-cloud','remote-alias']){
  const s=scopeFor(model);await s.runBenchmark();
  assert.equal(s.state.results.length,4);assert.equal(s.saved.length,1);assert.equal(s.requests.filter(r=>r.url.endsWith('/api/generate')).length,4);
  for(const r of s.state.results){assert.equal(r.executionOutcome,'completed');assert(!r.memory);assert.equal(r.metrics.contextRequestedTokens,null);assert.equal(r.metrics.contextObservedTokens,null);assert.equal(r.protocol.loadState,'unknown');assert.equal(r.protocol.cacheState,'unknown');assert(!r.protocol.campaignId);assert(r.provenance.attribution.startsWith('remote-inference:'));}
  assert.equal(await s.observeLoadedModel(model),'unknown');assert.equal(await s.loadedModelSnapshot(model),null);assert.equal(await s.unloadOllamaModel(model),'remote');
  const report=JSON.parse(JSON.stringify(s.buildCommunityV2(s.state.results,new Date().toISOString())));validateReport(report);
  assert.equal(report.producer.version,'0.17.0');assert.equal(report.machines.length,2);assert(report.tests.every(t=>t.participatingNodeIds[0]==='inference-unknown'&&!t.resourceSummaries.length&&!t.resourceSamples.length));
  assert(!JSON.stringify(report).includes('private.example'));assert(!JSON.stringify(report).includes('SECRET'));
  const dataset=s.analysisDataset(s.state.results);assert.equal(dataset[0].hardware.status,'unknown');assert(dataset[0].provenance.attribution.startsWith('remote-inference:'));
  const stats=s.buildStatistics([{results:s.state.results}]);assert(stats.length);assert.equal(stats.reduce((n,g)=>n+g.points.length,0),3);
 }
 // A provider error remains a technical error, rather than being hidden by cloud support.
 const fail=scopeFor('gemma4:cloud');fail.fetchWithTimeout=async(url)=>url.endsWith('/api/show')?{ok:true,json:async()=>({})}:url.endsWith('/api/version')?{ok:true,json:async()=>({})}:{ok:false,status:401};await fail.runBenchmark();assert(fail.state.results.some(r=>r.executionOutcome==='failed'));
 // Routing can also be discovered in an alias's actual generation stream.
 const alias=scopeFor('alias',false),fetchAlias=alias.fetchWithTimeout;let monitorStopped=0;alias.ollamaMemoryMonitor={isActive:false,startResources:async()=>{},start(){this.isActive=true;},stop(){this.isActive=false;monitorStopped++;return {readings:[],source:'process-tree-rss'};},cancelResources:async()=>{}};alias.fetchWithTimeout=async(url,options)=>url.endsWith('/api/ps')?{ok:true,json:async()=>({models:[]})}:fetchAlias(url,options);await alias.runBenchmark();assert(alias.state.results.every(r=>!r.memory));assert(alias.isOllamaCloud('alias'));assert.equal(monitorStopped,1);
 // A missing ps response never counts as successful local unloading.
 const local=scopeFor('local-model',false);local.fetchWithTimeout=async(url)=>url.endsWith('/api/generate')?{ok:true,json:async()=>({done:true})}:{ok:false};await assert.rejects(()=>local.unloadOllamaModel('local-model'),/invérifiable/);
 console.log('PASS: cloud names/API aliases, real streamed campaigns, three repetitions/one provider context, no local ps/telemetry/unload, remote topology, provenance/privacy, schema/export version, analysis/statistics and actual provider failures');
})().catch(e=>{console.error(e);process.exitCode=1;});
