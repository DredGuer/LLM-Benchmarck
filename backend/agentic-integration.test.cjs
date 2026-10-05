const assert=require('node:assert/strict'),fs=require('node:fs'),fsp=require('node:fs/promises'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto');
const {createAgenticHarness,mountAgenticRoutes}=require('./agentic-harness');const {validateReport}=require('../schemas/validate.cjs');
(async()=>{
 const parent=await fsp.mkdtemp(path.join(process.cwd(),'agentic-integration-'));
 try{
 const harness=createAgenticHarness({parent}),elements=new Map(),requests=[];
 function element(id){if(!elements.has(id))elements.set(id,{value:'',disabled:false,hidden:false,style:{},textContent:'',innerHTML:'',children:[],appendChild(x){this.children.push(x);},addEventListener(){},querySelector(){return null;}});return elements.get(id);}
 let mode='success',modelTurns=0;
 const md='# Réponse\n\n17 + 25 = 42\n\n## Vérification\n42 - 25 = 17.';
 const actions=[['submit_answer',{answer:42}],['create_directory',{path:'results'}],['write_markdown',{path:'results/answer.md',content:md}],['read_file',{path:'results/answer.md'}]];
 const scope={state:{runner:'ollama',env:{},results:[],isRunning:false},window:{MEMORY_MONITOR_CONFIG:{backendUrl:'http://localhost:3001',pollInterval:500}},
  URL,AbortController,TextEncoder,crypto:crypto.webcrypto,performance,setTimeout,clearTimeout,console,
  document:{getElementById:element,createElement:()=>element('node'+Math.random())},RUNNERS:{ollama:{name:'Ollama',base:'http://localhost:11434'},lmstudio:{name:'LM Studio',base:'http://localhost:1234'}},
  getMaxTokens:()=>4096,getTemperatureForPromptType:()=>0,buildOllamaOptions:(temperature,num_predict)=>({temperature,num_predict}),estimateTokens:t=>Math.ceil(t.length/4),
  observeLoadedModel:async()=> 'warm',loadedModelSnapshot:async()=>null,promptFingerprint:async()=> 'a'.repeat(64),addDebugLog(){},setProgress(){},
  ollamaMemoryMonitor:{startResources:async()=>{},start(){},stop:()=>({readings:[],source:'process-tree-rss'}),_fetchLoadedModel:async()=>{},pollResources:async()=>{},cancelResources:async()=>{}},
  fetchWithTimeout:async(url,options)=>{
   requests.push({url,options});const body=options.body?JSON.parse(options.body):null;
   if(url.includes('/api/agentic')){const route=url.split('/api/agentic')[1],token=(options.headers.Authorization||'').replace('Bearer ','');let result;
    if(route==='/start'){modelTurns=0;result=await harness.start();}
    else if(route==='/info')result={version:'1.0.0'};
    else {const [_,id,action]=route.split('/');if(action==='tool')result=await harness.tool(id,token,body.name,body.arguments);else if(action==='finish')result=await harness.finish(id,token,body.reason);else {await harness.cancel(id,token);result={success:true};}}
    return {ok:true,json:async()=>result};
   }
   if(url.endsWith('/api/version'))return {ok:true,json:async()=>({version:'test'})};
   assert(url.endsWith('/api/chat')||url.endsWith('/v1/chat/completions'));
   modelTurns++;const turn=modelTurns;let calls=turn===1&&mode==='success'?actions.map(([name,args],i)=>({id:'call-'+i,type:'function',function:{name,arguments:scope.state.runner==='ollama'?args:JSON.stringify(args)}})):[];
   if(mode==='unsupported')return {ok:false,status:400};
   if(mode==='loop')calls=[{id:'bad',function:{name:'invented_shell',arguments:{}}}];
   if(mode==='cancel')return new Promise((resolve,reject)=>{if(options.signal.aborted)reject(new Error('aborted'));else options.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});});
   const message={role:'assistant',content:calls.length?'':'Fichier créé.',...(calls.length?{tool_calls:calls}:{})};
   const result=scope.state.runner==='ollama'?{message,eval_count:20,eval_duration:1000000,prompt_eval_duration:2000000,done_reason:'stop'}:
    {choices:[{message,finish_reason:calls.length?'tool_calls':'stop'}],usage:{completion_tokens:20}};
   return {ok:true,json:async()=>result};
  }
 };
 vm.createContext(scope);for(const file of ['js/core/agentic.js','js/core/community-export.js','js/ui/statistics.js','js/ui/analysis.js'])vm.runInContext(fs.readFileSync(file,'utf8'),scope);
 let result=await scope.executeAgenticTest('test:tools',1,new AbortController().signal,1);
 assert(result.agentic.evaluation.taskSuccess);assert.equal(result.runner,'Ollama');assert.equal(result.metrics.ttft,null);assert.equal(result.metrics.totalTokens,40);
 assert.equal(result.agentic.evaluation.toolCallCount,4);assert.equal(result.agenticArtifactText,md);assert.equal((await fsp.readdir(parent)).length,0);
 const report=JSON.parse(JSON.stringify(scope.buildCommunityV2([result],new Date().toISOString())));validateReport(report);assert.equal(report.tests[0].kind,'agentic');
 assert(!JSON.stringify(report).includes(md));assert(!JSON.stringify(report).includes('Bearer'));assert(!JSON.stringify(report).includes(parent));
 const toolReply=JSON.parse(requests.find(r=>r.url.endsWith('/api/chat')&&JSON.parse(r.options.body).messages.length>1).options.body).messages.find(m=>m.role==='tool');assert.equal(toolReply.tool_name,'submit_answer');
 scope.escapeHtml=String;
 vm.runInContext(fs.readFileSync('js/ui/results.js','utf8'),scope);
 scope.state.results=[result];assert(scope.agenticResultHTML(result).includes('submit_answer'));assert(scope.agenticResultHTML(result).includes('Télécharger'));
 assert(scope.agenticMarkdown(result).includes('read_file'));
 const original=result;
 scope.state.runner='lmstudio';result=await scope.executeAgenticTest('test:tools',1,new AbortController().signal,1);assert(result.agentic.evaluation.taskSuccess);assert.equal(result.runner,'LM Studio');validateReport(JSON.parse(JSON.stringify(scope.buildCommunityV2([result],new Date().toISOString()))));
 const compatible=JSON.parse(requests.filter(r=>r.url.endsWith('/v1/chat/completions')).at(-1).options.body);assert(compatible.messages.some(m=>m.role==='tool'&&m.tool_call_id==='call-0'));
 scope.state.runner='ollama';mode='claim';result=await scope.executeAgenticTest('test:tools',2,new AbortController().signal,1);assert(!result.agentic.evaluation.taskSuccess);assert(result.error);
 const groups=scope.buildAgenticStatistics([{results:[original,result,original]}]);assert.equal(groups[0].attempts,2);assert.equal(groups[0].successes,1);
 assert.equal(scope.buildStatistics([{results:[original,result]}]).length,0);
 const analysis=scope.buildAnalysisContext([original,result],'history');assert.equal(analysis.agenticAttempts.length,2);assert.equal(analysis.eligibleMeasurements,0);assert(!JSON.stringify(analysis).includes(md));
 mode='unsupported';result=await scope.executeAgenticTest('test:tools',3,new AbortController().signal,1);assert(result.error);assert(!result.agentic.evaluation.taskSuccess);assert.equal((await fsp.readdir(parent)).length,0);
 mode='loop';result=await scope.executeAgenticTest('test:tools',4,new AbortController().signal,1);assert(result.error);assert.equal(modelTurns,8);assert.equal(result.agentic.evaluation.toolCallCount,8);
 validateReport(JSON.parse(JSON.stringify(scope.buildCommunityV2([result],new Date().toISOString()))));
 mode='cancel';const taskCancel=new AbortController();const abortTimer=setTimeout(()=>taskCancel.abort(),5);
 result=await scope.executeAgenticTest('test:tools',5,taskCancel.signal,1);clearTimeout(abortTimer);assert(result.error.includes('annulé'));assert(!result.agentic.evaluation.taskSuccess);assert.equal((await fsp.readdir(parent)).length,0);
 // Campaign startup, warmup, repetitions, history and restored controls.
 mode='success';let saved,locked=[];Object.assign(scope,{getSelectedModel:()=> 'test:tools',getRepetitions:()=>2,lockCampaignControls:x=>locked.push(x),resetCampaignResults:()=>{scope.state.results=[];},switchTab(){},refreshModelMetadata:async()=>{},
  executeTest:async()=>({...original,id:'warmup',kind:'generation',agentic:undefined,phase:'warmup'}),showLiveSections(){},setControlButtons(){},renderResultCard(){},showToast(){},
  saveSessionToHistory:s=>{saved=s;return true;},renderStatistics(){}});
 await scope.runAgenticBenchmark();assert.equal(saved.results.length,3);assert.equal(saved.results[0].phase,'warmup');assert(saved.results.slice(1).every(r=>r.agentic.evaluation.taskSuccess));
 assert.deepEqual(locked,[true,false]);assert.equal(scope.state.isRunning,false);assert.equal(element('agenticStop').hidden,true);
 // HTTP guard: remote addresses, hostile origins and missing preflight header rejected.
 const routes=[];mountAgenticRoutes({get(...args){routes.push(args);},post(...args){routes.push(args);},delete(...args){routes.push(args);}},harness);
 const guard=routes[0][1];for(const req of [{socket:{remoteAddress:'10.0.0.2'},headers:{'x-llmb-agentic':'1'}},{socket:{remoteAddress:'127.0.0.1'},headers:{origin:'https://evil.example','x-llmb-agentic':'1'}},{socket:{remoteAddress:'127.0.0.1'},headers:{}}]){
  let status;guard(req,{status(n){status=n;return this;},json(){}},()=>assert.fail('Unsafe request accepted'));assert.equal(status,403);}
 // External cancellation reaches fetch (the timeout helper formerly replaced the signal).
 const cancelScope={AbortController,setTimeout,clearTimeout,fetch:(url,opt)=>new Promise((resolve,reject)=>{if(opt.signal.aborted)reject(new Error('aborted'));else opt.signal.addEventListener('abort',()=>reject(new Error('aborted')));})};
 vm.createContext(cancelScope);vm.runInContext(fs.readFileSync('js/utils/helpers.js','utf8'),cancelScope);
 const controller=new AbortController(),pending=cancelScope.fetchWithTimeout('local',{signal:controller.signal},10000);controller.abort();await assert.rejects(pending,/aborted/);
 console.log('PASS: native Ollama/compatible tools, real artifacts, failure/loop cleanup, v2 validation/privacy, isolated statistics/AI, warmup/history, route guard and cancellation');
 }finally{await fsp.rm(parent,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
