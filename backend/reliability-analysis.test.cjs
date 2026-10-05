const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {createTelemetry,parseMLXEvents}=require('./apple-resources.js');
const {validateReport}=require('../schemas/validate.cjs');
const script=p=>fs.readFileSync(p,'utf8');
const elements=new Map();
function element(id){if(!elements.has(id))elements.set(id,{value:'',checked:false,children:[],textContent:'',style:{},appendChild(x){this.children.push(x);},scrollHeight:0});return elements.get(id);}
let requests=[],toasts=[];
const result={id:'test',model:'example',runner:'Ollama',phase:'measurement',rep:1,promptType:'creative',promptText:'SECRET',response:'SECRET',env:{apiKeys:'SECRET',hostname:'SECRET',chip:'M3',ram:'36 GiB'},
 metrics:{totalTokens:8192,maxTokens:8192,tokensPerSec:20,totalTime:409600,thinkingObserved:true},completion:{reason:'length',limitReached:true,state:'truncated'},
 timestamp:'2026-10-05T18:00:00Z',protocol:{version:'0.08',loadState:'warm',cacheState:'present-coverage-unknown',cachePolicy:'runner-managed'},runnerVersion:'1.2.3'};
const scope={URL,crypto,AbortController,RUNNERS:{ollama:{base:'http://localhost:11434'}},state:{results:[result],isRunning:false},
 document:{getElementById:element,createElement:()=>({style:{}})},getSelectedModel:()=> 'example',showToast:(...v)=>toasts.push(v),
 fetchWithTimeout:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({message:{content:'<img src=x onerror=evil()> conclusion'},choices:[{message:{content:'conclusion'}}]})};}};
vm.createContext(scope);vm.runInContext(script('js/ui/analysis.js'),scope);vm.runInContext(script('js/core/protocol.js'),scope);
assert.equal(scope.classifyCompletion('length',2,8192,'declared').state,'truncated');
assert.equal(scope.classifyCompletion('stop',8192,8192,'declared').state,'possibly-truncated');
assert.equal(scope.classifyCompletion('stop',8192,8192,'estimated').state,'completed');
assert.equal(scope.classifyCompletion('content_filter',3,8192,'declared').state,'unknown');
assert.throws(()=>scope.analysisEndpoint('http://remote.example/v1'));
assert.throws(()=>scope.analysisEndpoint('https://user:secret@example.com/v1'));
assert.equal(scope.analysisEndpoint('https://example.com/v1/'),'https://example.com/v1');
assert.equal(scope.analysisEndpoint('http://[::1]:11434'),'http://[::1]:11434');
assert(!JSON.stringify(scope.analysisDataset([result])).includes('SECRET'));
vm.runInContext(script('js/core/community-export.js'),scope);
const report=scope.buildCommunityV2([result],'2026-10-05T18:00:01Z');validateReport(report);
assert.equal(report.tests[0].status,'partial');assert.equal(report.execution.runner.version,'1.2.3');
vm.runInContext(script('js/ui/statistics.js'),scope);
assert.equal(scope.buildStatistics([{results:[result]}]).length,0);
const complete={...result,completion:{reason:'stop',limitReached:false,state:'completed'}};
assert.equal(scope.buildStatistics([{results:[complete,{...complete,id:'other',runnerVersion:'2'}]}]).length,2);
(async()=>{
 const events=parseMLXEvents('time=2026-10-05T18:00:00Z level=INFO source=pipeline.go:1 msg=memory peak="21.21 GiB" held="20.83 GiB"',0);
 assert.equal(events[0].heldBytes,20.83*1024**3);
 let bytes=100,time=Date.parse('2026-10-05T18:00:00Z');
 const telemetry=createTelemetry({now:()=>time,state:async()=>{throw Error('no log');},collect:async()=>({observedAt:new Date(time).toISOString(),swapUsedBytes:bytes,compressedBytes:bytes,swapReadBytes:0,swapWriteBytes:0,diskReadBytes:0,diskWriteBytes:0,deviceSet:'disk'})});
 const session=await telemetry.start();bytes=50;time+=1000;const boundary=await telemetry.sample(session.id,true);
 assert.equal(boundary.swapStart.value,100);assert.equal(boundary.swapEnd.value,50);assert.equal(boundary.swapPeak.value,100);
 assert.notEqual(boundary.swapStart.observedAt,boundary.swapEnd.observedAt);

 element('analysisProvider').value='ollama';scope.analysisProviderChanged();element('analysisQuestion').value='Analyse';
 scope.state.isRunning=true;await scope.askAnalysis(false);assert.equal(requests.length,0);scope.state.isRunning=false;
 await scope.askAnalysis(false);assert.equal(requests.length,1);assert(requests[0].url.endsWith('/api/chat'));
 assert(!requests[0].options.body.includes('SECRET'));assert.equal(scope.state.analysisRunning,false);
 assert(element('analysisMessages').children.at(-1).textContent.includes('<img')); // text only, no HTML rendering
 element('analysisProvider').value='openai';scope.analysisProviderChanged();element('analysisModel').value='my-model';element('analysisQuestion').value='Analyse';element('analysisKey').value='PRIVATEKEY';
 await scope.askAnalysis(false);assert.equal(requests.length,1); // requires consent before any request
 element('analysisConsent').checked=true;await scope.askAnalysis(false);assert.equal(requests.length,2);
 assert.equal(requests[1].options.headers.Authorization,'Bearer PRIVATEKEY');assert(!requests[1].options.body.includes('PRIVATEKEY'));
 scope.clearAnalysis();assert.equal(element('analysisKey').value,'');assert.equal(scope.analysisConversation.length,0);
 scope.fetchWithTimeout=async()=>{throw Error('PRIVATEKEY');};element('analysisQuestion').value='Analyse';
 await scope.askAnalysis(false);assert.equal(scope.state.analysisRunning,false);assert.equal(element('runBtn').disabled,false);
 console.log('PASS: completion limits, cache/version v2, statistics exclusions, opt-in analysis, privacy allowlist, local/remote routing, consent, text rendering and failure unlock');
})().catch(e=>{console.error(e);process.exitCode=1;});
