const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto');
const {validateReport}=require('../schemas/validate.cjs');
const read=p=>fs.readFileSync(path.join(__dirname,'../'+p),'utf8');
function scopeFor(extra={}){
 const els={qualityEnabled:{checked:true},controlledEnabled:{checked:true},controlledContextA:{value:'8192'},controlledContextB:{value:'16384'},temperature:{value:'0.7'},maxTokens:{value:'8192'},repetitions:{value:'1'},runBtn:{},progressSection:{style:{}},resultsList:{},exportBtn:{}};
 const store=new Map();const s={state:{runner:'ollama',runnerVersion:'mock',modelMetadata:{contextMaxTokens:32768},selectedPrompts:new Set(['math']),env:{},results:[]},RUNNERS:{ollama:{name:'Ollama',type:'local',base:'http://localhost:11434'}},PROMPT_TYPES:[{id:'math',name:'Math',prompt:'old'}],window:{},crypto,URL,TextEncoder,AbortController,
  document:{getElementById:id=>els[id],querySelectorAll:()=>[],addEventListener(){}},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},console,showToast(){},getSelectedModel:()=> 'model',agenticEnabled:()=>false,showResultsArea(){},resetLiveOutput(){},switchTab(){},setProgress(){},showLiveSections(){},setControlButtons(){},renderResultCard(){},renderStatistics(){},...extra};
 vm.createContext(s);for(const p of ['js/core/version.js','js/core/quality.js','js/core/runners.js','js/core/protocol.js','js/core/advancedConfig.js','js/core/controlled.js','js/core/benchmark.js','js/core/community-export.js'])vm.runInContext(read(p).replace('\ninitAdvancedConfig();',''),s);
 s.isManualMode=true;s.refreshModelMetadata=async()=>{};s.fetchWithTimeout=async()=>({ok:true,json:async()=>({models:[{name:'model'}],version:'mock'})});s.els=els;return s;
}
(async()=>{
 const s=scopeFor();
 const provenance=s.captureTestProvenance();assert.equal(provenance.inferenceEndpoint,'loopback');assert.equal(provenance.engine,null);
 s.RUNNERS.ollama.base='https://private.example/api?key=SECRET';const remote=s.captureTestProvenance();assert.equal(remote.inferenceEndpoint,'remote');assert(!JSON.stringify(remote).includes('private'));assert(!JSON.stringify(remote).includes('SECRET'));s.RUNNERS.ollama.base='http://localhost:11434';
 const duration=s.qualityTasksFor('math')[0].qualityTask;
 assert.equal(s.evaluateQuality(duration,'{"totalMinutes":270,"hours":4,"minutes":30}').status,'pass');
 assert.equal(s.evaluateQuality(duration,'<think>ignore</think>\n```json\n{"totalMinutes":270,"hours":4,"minutes":30}\n```').status,'pass');
 assert.equal(s.evaluateQuality(duration,'{"totalMinutes":270,"hours":4,"minutes":31}').status,'fail');
 assert.equal(s.evaluateQuality(duration,'270 minutes, 4 heures 30').status,'fail');assert.equal(s.evaluateQuality(duration,'{}',{limitReached:true}).status,'incomplete');assert.equal(s.evaluateQuality(null,'whatever').status,'not-assessed');
 for(const pt of s.qualityTasksFor('logic')){
  const t=pt.qualityTask,good={mode:t.mode,actions:[{action:'transport',object:t.object},{action:'service',object:t.object}]};assert.equal(s.evaluateQuality(t,JSON.stringify(good)).status,'pass');good.actions.reverse();assert.equal(s.evaluateQuality(t,JSON.stringify(good)).status,'fail');
 }
 const fib=s.qualityTasksFor('code')[0].qualityTask;assert.equal(s.evaluateQuality(fib,'{"values":[0,1,55,6765]}').status,'pass');assert.equal(s.evaluateQuality(fib,'{"values":[0,1,55,6764]}').status,'fail');
 let id=0,saved=[];s.saveSessionToHistory=x=>{saved.push(x);return true;};
 s.executeTest=async(model,pt,prompt,rep,signal,protocol)=>{
  const options=s.buildOllamaOptions(s.getTemperatureForPromptType(pt.id),s.getMaxTokens(),s.getRequestedContextTokens());assert.equal(options.temperature,0);assert([8192,16384].includes(options.num_ctx));assert.equal(options.num_predict,8192);
  return {id:'r'+(++id),model,runner:'Ollama',phase:protocol.warmup?'warmup':'measurement',protocol:{...protocol,version:'0.09'},rep,metrics:{totalTokens:1,contextObservedTokens:options.num_ctx,contextRequestedTokens:options.num_ctx,contextMode:'explicit',temperature:0,maxTokens:8192,totalTime:100,tokensPerSec:10},response:'OK',env:{},executionOutcome:'completed',provenance:s.captureTestProvenance()};
 };
 await s.runBenchmark();assert.equal(saved.length,2);assert.equal(s.state.results.length,14); // two variants × 3 repetitions + warmup, per context
 const measurements=s.state.results.filter(r=>r.phase==='measurement');assert.equal(measurements.length,12);assert.equal(new Set(measurements.map(r=>r.protocol.campaignId)).size,1);assert(measurements.every(r=>r.protocol.contextValidation==='verified'));assert.equal(s.getRequestedContextTokens(),null);assert.equal(s.getRepetitions(),1);assert.equal(s.getTemperatureForPromptType('math'),0.7);
 const report=JSON.parse(JSON.stringify(s.buildCommunityV2(s.state.results,new Date().toISOString())));assert.equal(report.schemaVersion,'2.2.0');validateReport(report);assert.equal(report.tests[0].provenance.applicationVersion,s.LLMB_VERSION);
 const qualityResult={...s.state.results[0],quality:s.evaluateQuality(duration,'{\"totalMinutes\":270,\"hours\":4,\"minutes\":30}')};
 const qualityReport=JSON.parse(JSON.stringify(s.buildCommunityV2([qualityResult],new Date().toISOString())));validateReport(qualityReport);assert.equal(qualityReport.tests[0].verdict.quality,'pass');
 const badQuality=structuredClone(qualityReport);badQuality.tests[0].quality.criteria[0].passed=false;assert.throws(()=>validateReport(badQuality),/Quality/);
 const originalVersion=qualityResult.provenance.applicationVersion;s.LLMB_VERSION='99.0.0';const reexport=s.buildCommunityV2([qualityResult],new Date().toISOString());assert.equal(reexport.producer.version,'99.0.0');assert.equal(reexport.tests[0].provenance.applicationVersion,originalVersion);s.LLMB_VERSION=originalVersion;
 const old=JSON.parse(JSON.stringify(s.buildCommunityV2([{id:'old',model:'old',runner:'Ollama',timestamp:new Date().toISOString(),metrics:{}}],new Date().toISOString())));assert(!old.tests[0].provenance);assert.equal(old.schemaVersion,'2.0.0');validateReport(old);
 const changed=structuredClone(report);changed.tests[0].parameters.contextTokens=4096;assert.throws(()=>validateReport(changed),/context mismatch/);
 const firstContexts=saved.map(x=>x.results[0].metrics.contextObservedTokens);saved=[];await s.runBenchmark();assert.deepEqual(saved.map(x=>x.results[0].metrics.contextObservedTokens),firstContexts.reverse());
 saved=[];s.executeTest=async()=>({id:'mismatch',model:'model',runner:'Ollama',phase:'warmup',metrics:{totalTokens:1,contextObservedTokens:4096},response:'OK'});await s.runBenchmark();assert.equal(saved.length,1);assert(s.state.results.some(r=>r.protocol?.contextValidation==='mismatch'));assert.equal(s.state.controlledActive,false);
 saved=[];s.executeTest=async()=>({id:'unknown',model:'model',runner:'Ollama',phase:'warmup',metrics:{totalTokens:1},response:'OK'});await s.runBenchmark();assert.equal(saved.length,1);assert(s.state.results.some(r=>r.protocol?.contextValidation==='unverified'));
 saved=[];s.executeTest=async()=>{throw Error('Test annulé');};await s.runBenchmark();assert.equal(saved.length,1);assert(s.state.results.some(r=>r.executionOutcome==='interrupted'));assert.equal(s.state.controlledPreparing,false);
 s.els.controlledContextB.value='8192';saved=[];await s.runBenchmark();assert.equal(saved.length,0);
 console.log('PASS: provenance privacy/history, numeric/structured quality, dependency checks, actual controlled campaign loops, two contexts/three repetitions, fixed parameters, context verification, alternating order and schema');
})().catch(e=>{console.error(e);process.exitCode=1;});
