const assert=require('node:assert/strict'),fs=require('node:fs/promises'),sync=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {createExportStore}=require('./local-exports');
const read=p=>sync.readFileSync(path.join(__dirname,'../'+p),'utf8');
async function scenario(parent,mode='normal') {
 const events=[],models=['qwen:small','gemma:small'],entries=new Map(),history=[];let loaded=null,id=0,saves=0;
 function el(id){if(!entries.has(id))entries.set(id,{value:'',checked:false,style:{},children:[],textContent:'',appendChild(x){this.children.push(x);},querySelectorAll(){return[];}});return entries.get(id);}
 const storage=new Map(),store=createExportStore({parent,launch:(_cmd,_args,_opts,cb)=>cb(null)});
 const s={window:{MEMORY_MONITOR_CONFIG:{backendUrl:'http://localhost:3001'}},URL,Blob,crypto,console,AbortController,TextEncoder,setTimeout,clearTimeout,
 state:{runner:'ollama',selectedPrompts:new Set(['conversation']),results:[],env:{}},RUNNERS:{ollama:{type:'local',name:'Ollama',base:'http://localhost:11434'}},PROMPT_TYPES:[{id:'conversation',name:'Conversation',emoji:'c',prompt:'hello'}],
 document:{getElementById:el,querySelectorAll:query=>query==='#batchModels input:checked'?models.map(value=>({value})):[],createElement:()=>({textContent:''})},
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},showToast(){},showResultsArea(){},resetLiveOutput(){},switchTab(){},setProgress(){},showLiveSections(){},setControlButtons(){},renderStatistics(){},loadHistory(){},modelArchitectureText:()=> 'unknown',
 getRepetitions:()=>s.state.controlledActive?3:2,getTemperatureForPromptType:()=>0.7,getMaxTokens:()=>8192,getRequestedContextTokens:()=>s.state.controlledActive?s.state.activeContextTokens:null,
 agenticEnabled:()=>false,selectedAgenticScenarios:()=>[],refreshModelMetadata:async()=>{s.state.modelMetadata={contextMaxTokens:32768};},saveSessionToHistory:session=>{history.push(session);return true;},escapeHtml:String};
 vm.createContext(s);for(const p of ['js/core/version.js','js/utils/helpers.js','js/core/protocol.js','js/core/controlled.js','js/core/community-export.js','js/ui/results.js','js/core/benchmark.js','js/core/batch.js'])vm.runInContext(read(p),s);
 s.renderResultCard=()=>{};
 el('controlledContextA').value='8192';el('controlledContextB').value='16384';el('batchContinueErrors').checked=mode==='continue';el('controlledEnabled').checked=mode==='controlled';
 s.fetchWithTimeout=async(url,options={})=>{
   if(url.endsWith('/api/exports/session'))return {ok:true,json:async()=>({version:'1.0.0',token:'a'.repeat(64)})};
   if(url.endsWith('/api/exports/save')){const payload=JSON.parse(options.body);events.push('save:'+payload.model);saves++;if(mode==='save-fail'&&saves===1)return {ok:false,status:500};const saved=await store.save(payload);return {ok:true,json:async()=>saved};}
   if(url.endsWith('/api/exports/open')){await store.open();return {ok:true,json:async()=>({opened:true})};}
   if(url.endsWith('/api/generate')){const data=JSON.parse(options.body);assert.equal(data.keep_alive,0);events.push('unload:'+data.model);if(mode==='unload-fail')return {ok:false};loaded=null;return {ok:true,json:async()=>({done:true})};}
   if(url.endsWith('/api/ps'))return {ok:true,json:async()=>({models:loaded?[{name:loaded}]:[]})};
   return {ok:true,json:async()=>({version:'mock'})};
 };
 s.executeTest=async(model,pt,prompt,rep,signal,protocol)=>{
  if(protocol.warmup){events.push('warmup:'+model);assert(!loaded||loaded===model);loaded=model;}
  else {events.push('measure:'+model);if(mode==='abort') {s.requestBatchStop(true);throw Error('Test annulé');}if((mode==='continue'||mode==='fail')&&model===models[0])throw Error('provider-failed');if(mode==='stop-after')s.requestBatchStop(false);}
  const context=s.getRequestedContextTokens();
  return {id:'test-'+(++id),model,runner:'Ollama',phase:protocol.warmup?'warmup':'measurement',promptType:pt.id,promptTypeName:pt.name,promptEmoji:pt.emoji,promptText:prompt,response:'OK',rep,
   metrics:{totalTokens:2,totalTime:100,tokensPerSec:20,ttft:10,temperature:0.7,maxTokens:8192,contextObservedTokens:context,contextRequestedTokens:context,contextMode:context?'explicit':'auto'},protocol:{...protocol,version:'0.09'},env:{},executionOutcome:'completed',provenance:s.captureTestProvenance()};
 };
 await s.runBatchCampaign();
 assert.equal(s.state.batchActive,false);assert.equal(s.state.batchModel,null);assert.equal(s.window.campaignControls.length,0);assert(!el('runBtn').disabled);
 if(mode==='normal'||mode==='controlled'){
  const warmups=mode==='controlled'?2:1,measurements=mode==='controlled'?6:2;
  assert.equal(history.length,2*warmups);assert.equal(events.filter(e=>e.startsWith('measure:')).length,2*measurements);
  assert(events.indexOf('save:'+models[0])<events.indexOf('unload:'+models[0]));assert(events.indexOf('unload:'+models[0])<events.indexOf('warmup:'+models[1]));assert.equal(s.state.results.length,2*(warmups+measurements));
  assert.equal(s.state.batchQueue[1].status,'terminé · exports sauvegardés · déchargé');
  const dirs=await fs.readdir(path.join(parent,'export'));assert.equal(dirs.length,2);for(const dir of dirs){const files=await fs.readdir(path.join(parent,'export',dir));assert.equal(files.length,2);const file=files.find(f=>f.endsWith('.json')),report=JSON.parse(await fs.readFile(path.join(parent,'export',dir,file),'utf8'));const md=await fs.readFile(path.join(parent,'export',dir,files.find(f=>f.endsWith('.md'))),'utf8');const block=md.match(/```json\n([\s\S]*?)\n```/);assert(block);assert.deepEqual(JSON.parse(block[1]),report);assert.equal(report.producer.version,'0.11.0');assert(report.tests.every(t=>t.model.id===report.tests[0].model.id));assert(report.tests.every(t=>t.provenance.applicationVersion==='0.11.0'));}
 }else if(mode==='continue'){assert(events.includes('warmup:'+models[1]));assert(events.includes('unload:'+models[0]));}
 else{assert(!events.includes('warmup:'+models[1]));assert(events.includes('unload:'+models[0]));}
 if(mode==='save-fail'){assert(s.state.pendingLocalExport);await s.recoverLocalExports();assert.equal(s.state.pendingLocalExport,null);assert.equal(saves,2);}
 return events;
}
(async()=>{
 const parent=await fs.mkdtemp(path.join(process.cwd(),'batch-test-'));
 try{for(const mode of ['normal','controlled','abort','stop-after','fail','continue','save-fail','unload-fail']){const dir=path.join(parent,mode);await fs.mkdir(dir);await scenario(dir,mode);}
 console.log('PASS: real sequential benchmark/control loops, per-model disk exports and versions, save-before-unload-before-next, partial abort/stop, failure policies, blocked unload and export recovery');
 }finally{await fs.rm(parent,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
