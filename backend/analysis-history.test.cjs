const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const elements=new Map();function el(id){if(!elements.has(id))elements.set(id,{value:'',checked:false,children:[],style:{},textContent:'',appendChild(x){this.children.push(x);},addEventListener(){},focus(){},setSelectionRange(){}});return elements.get(id);}
const secret='SECRET_PROMPT_KEY';
const record=(id,model,tps,extra={})=>({id,model,runner:'Ollama',phase:'measurement',promptType:'math',promptText:secret,response:secret,
 timestamp:'2026-10-05T19:00:00Z',env:{chip:'M3',ram:'36 GiB',apiKeys:secret},metrics:{tokensPerSec:tps,totalTokens:100,prefillTimeMs:5},...extra});
const a=record('a','hf.co/model:Q4',10),b=record('b','other:mlx',30);
let history=[{results:[a,b]}],requests=[];
const scope={state:{results:[],isRunning:false},HISTORY_KEY:'history',localStorage:{getItem:()=>JSON.stringify(history)},document:{getElementById:el,createElement:()=>({style:{},addEventListener(){}})},
 URL,AbortController,RUNNERS:{ollama:{base:'http://localhost:11434'}},getSelectedModel:()=> 'analysis-model',showToast(){},
 fetchWithTimeout:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({message:{content:'conclusion'}})};}};
vm.createContext(scope);vm.runInContext(fs.readFileSync('js/ui/analysis.js','utf8'),scope);vm.runInContext(fs.readFileSync('js/ui/statistics.js','utf8'),scope);
assert.equal(scope.analysisHistoryResults().length,2);
scope.state.results=[a];assert.equal(scope.analysisHistoryResults().length,2);scope.state.results=[];
assert.equal(scope.selectAnalysisResults('Compare @hf.co/model:Q4 et @other:mlx',false).results.length,2);
assert.equal(scope.selectAnalysisResults('Analyse @{hf.co/model:Q4}',false).results.length,1);
assert.throws(()=>scope.selectAnalysisResults('@unknown',false));
assert.throws(()=>scope.selectAnalysisResults('Conclusion',true));
scope.state.results=[b];assert.equal(scope.selectAnalysisResults('Conclusion',true).results[0].id,'b');scope.state.results=[];
el('analysisScope').value='statistics';scope.statisticsSelection.excludedModels.add('other:mlx');
assert.equal(scope.selectAnalysisResults('Analyse',false).results.length,1);el('analysisScope').value='history';
const many=Array.from({length:120},(_,i)=>record('p'+i,'model',i));many.push(record('warm','model',999,{phase:'warmup'}));many.push(record('limited','model',999,{completion:{limitReached:true}}));
const context=scope.buildAnalysisContext(many,'history');assert.equal(context.totalTests,122);assert.equal(context.eligibleMeasurements,120);
assert.equal(context.modelSummaries[0].summary.tokensPerSecond.mean,59.5);assert.equal(context.details.length,100);assert(context.detailsLimited);
assert(!JSON.stringify(context).includes(secret));assert.equal(context.comparableGroups[0].count,120);
(async()=>{
 el('analysisProvider').value='ollama';el('analysisBase').value='http://localhost:11434';el('analysisModel').value='analysis-model';el('analysisQuestion').value='Que penses-tu de @hf.co/model:Q4 ?';
 await scope.askAnalysis(false);assert.equal(requests.length,1);const body=JSON.parse(requests[0].options.body);
 assert.equal(body.model,'analysis-model');assert(body.messages[0].content.includes('hf.co/model:Q4'));
 assert(!body.messages[0].content.includes('other:mlx'));assert(!body.messages[0].content.includes(secret));
 assert(body.messages[0].content.includes('INTERDICTIONS'));
 assert.equal(scope.selectAnalysisResults('Et le prefill ?',false).results.length,1);
 scope.resetAnalysisModelFilter();assert.equal(scope.selectAnalysisResults('Compare tout',false).results.length,2);assert.equal(scope.state.analysisRunning,false);
 scope.refreshAnalysisScope();el('analysisQuestion').value='Compare @';scope.updateAnalysisMentions();assert(el('analysisMentions').children.length>0);
 console.log('PASS: history without active campaign, deduplication, exact/braced @ mentions, unknown mention rejection, statistics filters, current conclusion, all-pass summaries beyond 100 details, privacy and independent analysis model');
})().catch(e=>{console.error(e);process.exitCode=1;});
