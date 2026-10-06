const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const read=p=>fs.readFileSync(path.join(__dirname,'../'+p),'utf8');
function scopeFor(storage=new Map()) {
 class Node {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.style={};this.dataset={};this.attrs={};this._value='';this.checked=false;this.disabled=false;this._text='';this.listeners={};this.classList={toggle(){},add(){},remove(){}};}
  setAttribute(k,v){this.attrs[k]=v;}addEventListener(k,f){this.listeners[k]=f;}
  appendChild(n){this.children.push(n);return n;}append(...nodes){nodes.forEach(n=>this.appendChild(n));}
  set textContent(v){this._text=v;this.children=[];}get textContent(){return this._text+this.children.map(n=>n.textContent||'').join('');}
  set innerHTML(v){this._text=v;this.children=[];for(const m of v.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)){const n=new Node('option');n.value=m[1];n.textContent=m[2];this.children.push(n);}}
  get innerHTML(){return this._text;}get value(){return this._value;}set value(v){this._value=this.tagName==='select'&&!this.children.some(n=>n.value===String(v))?'':String(v);}
  querySelectorAll(q){const nodes=[];function walk(n){n.children.forEach(c=>{if(c.tagName==='input'&&(q==='input'||(q==='input:checked'&&c.checked)))nodes.push(c);walk(c);});}walk(this);return nodes;}
 }
 const els=new Map();
 // Build actual initial controls from the shipped HTML, not a second settings definition.
 for(const m of read('llm-benchmarker.html').matchAll(/<([a-z]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){
  const n=new Node(m[1]);n.id=m[3];n._value=/\bvalue="([^"]*)"/.exec(m[2])?.[1]||'';n.checked=/\bchecked\b/.test(m[2]);n.disabled=/\bdisabled\b/.test(m[2]);n.attrs['data-profile-action']=/data-profile-action/.test(m[2]);els.set(n.id,n);
 }
 const doc={body:new Node('body'),getElementById:id=>els.get(id)||null,createElement:tag=>new Node(tag),createTextNode:t=>({textContent:t,children:[]}),querySelectorAll(q){
  if(q==='#batchModels input:checked')return els.get('batchModels').querySelectorAll('input:checked');
  if(q==='[data-profile-action]')return [...els.values()].filter(n=>n.attrs['data-profile-action']);
  if(q.startsWith('.runner-btn'))return [...els.values()].filter(n=>['input','select','textarea','button'].includes(n.tagName)).concat(els.get('batchModels').querySelectorAll('input'));
  return [];
 }};
 // Dynamic agentic IDs are registered when the real initializer inserts checkboxes.
 const originalAppend=Node.prototype.appendChild;Node.prototype.appendChild=function(n){if(n.id)els.set(n.id,n);return originalAppend.call(this,n);};
 const toasts=[],s={console,URL,crypto,AbortController,TextEncoder,setTimeout,clearTimeout,document:doc,confirm:()=>true,
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},state:{runner:'ollama',selectedPrompts:new Set(['conversation']),env:{},results:[],apiKeys:{ollama:'SECRET_API_KEY'}},
 RUNNERS:{ollama:{name:'Ollama',type:'local',base:'http://localhost:11434'},lmstudio:{name:'LM Studio',type:'local',base:'http://localhost:1234'},openai:{name:'OpenAI',type:'api'},custom:{name:'Custom',type:'local'}},DEFAULT_MODELS:{ollama:['qwen:small','gemma:small'],openai:['remote-model']},
 PROMPT_TYPES:['conversation','factual','math','code','creative','logic','custom'].map(id=>({id,name:id,desc:id,prompt:'hello'})),showToast:(...x)=>toasts.push(x),fetchWithTimeout:async()=>({ok:true,json:async()=>({models:[{name:'qwen:small'},{name:'gemma:small'}]})})};
 s.window=s;vm.createContext(s);
 for(const p of ['js/core/version.js','js/utils/helpers.js','js/core/advancedConfig.js','js/core/runners.js','js/core/prompts.js','js/core/protocol.js','js/core/agentic.js','js/core/batch.js','js/core/profiles.js'])vm.runInContext(read(p).replace('\ninitAdvancedConfig();',''),s);
 s.refreshModelMetadata=async()=>{};s.initAgenticUI();s.populateModelSelect();s.initInterfaceModes();s.els=els;s.storage=storage;s.toasts=toasts;return s;
}
(async()=>{
 const s=scopeFor(),el=id=>s.els.get(id);
 assert.equal(s.state.interfaceMode,'simple');assert.equal(s.document.body.dataset.interfaceMode,'simple');assert.equal(s.state.selectedPrompts.size,6);assert(!s.state.selectedPrompts.has('custom'));assert(el('qualityEnabled').checked);assert(!el('controlledEnabled').checked);assert.equal(s.getRepetitions(),1);assert.equal(s.getMaxTokens(),8192);assert(!el('maxTokens').disabled);
 await s.setInterfaceMode('pro');assert.equal(s.state.interfaceMode,'pro');assert.deepEqual([...s.state.selectedPrompts],['conversation']);
 const inputs=el('batchModels').querySelectorAll('input');inputs.forEach(n=>{n.checked=true;});inputs[0].listeners.change();assert(el('batchSelectionCount').textContent.includes('2 modèle'));assert(el('runBtn').textContent.includes('2 modèle'));
 s.state.selectedPrompts=new Set(['custom','logic']);el('customPromptText').value='PROMPT PERSONNEL avec <b>texte</b>';el('temperature').value='0.4';el('customTemp').value='0.9';el('maxTokens').value='4096';el('repetitions').value='3';el('qualityEnabled').checked=true;el('controlledEnabled').checked=true;el('controlledContextA').value='4096';el('controlledContextB').value='8192';el('batchContinueErrors').checked=true;el('agenticEnabled').checked=true;
 s.AGENTIC_SCENARIOS.forEach(task=>{el('agentic-'+task.id).checked=task.id==='files-report';});
 s.localStorage.setItem('llm_bench_advanced_config',JSON.stringify({temperatures:{logic:0.2}}));el('campaignProfileName').value='Ma campagne';s.saveCampaignProfile(false);
 const saved=JSON.parse(s.storage.get(s.PROFILE_STORAGE_KEY));assert.equal(saved.length,1);assert.deepEqual(saved[0].settings.models,['qwen:small','gemma:small']);assert.equal(saved[0].settings.customPrompt,el('customPromptText').value);assert.deepEqual(saved[0].settings.agenticScenarios,['files-report']);assert(!JSON.stringify(saved).includes('SECRET_API_KEY'));assert.equal(saved[0].applicationVersion,'0.14.0');
 el('customPromptText').value='changed';el('repetitions').value='1';await s.loadCampaignProfile();assert.equal(el('customPromptText').value,saved[0].settings.customPrompt);assert.equal(el('repetitions').value,'3');assert.equal(s.checkedBatchModels().length,2);assert.equal(s.selectedAgenticScenarios().length,1);
 await s.setInterfaceMode('simple');assert.equal(s.getRepetitions(),1);assert.equal(el('runBtn').textContent,'⚡ Lancer le benchmark');assert(!el('controlledEnabled').checked);assert.equal(s.selectedAgenticScenarios().length,6);assert.equal(s.getTemperatureForPromptType('logic'),0.3);
 el('maxTokens').value='2048';el('agenticEnabled').checked=true;let launched;
 const realBatch=s.runBatchCampaign;s.runBatchCampaign=async models=>{launched=models;};await s.launchConfiguredBenchmark();assert.deepEqual(Array.from(launched),['qwen:small']);assert.equal(s.getMaxTokens(),2048);assert.equal(s.state.selectedPrompts.size,6);s.runBatchCampaign=realBatch;
 await s.setInterfaceMode('pro');assert.equal(el('maxTokens').value,'4096');assert.equal(el('repetitions').value,'3');assert(el('controlledEnabled').checked);assert.deepEqual([...s.state.selectedPrompts],['custom','logic']);assert.equal(s.selectedAgenticScenarios().length,1);assert.equal(s.checkedBatchModels().length,2);
 el('customPromptText').value='Updated';s.saveCampaignProfile(true);assert.equal(JSON.parse(s.storage.get(s.PROFILE_STORAGE_KEY)).length,1);assert.equal(JSON.parse(s.storage.get(s.PROFILE_STORAGE_KEY))[0].settings.customPrompt,'Updated');
 const restarted=scopeFor(new Map(s.storage));assert.equal(restarted.state.interfaceMode,'pro');restarted.els.get('campaignProfileSelect').value=saved[0].id;await restarted.loadCampaignProfile();assert.equal(restarted.els.get('customPromptText').value,'Updated');assert.equal(restarted.checkedBatchModels().length,2);
 const bad=structuredClone(saved[0].settings);bad.repetitions=0;assert.throws(()=>s.validateCampaignSettings(bad));bad.repetitions=3;bad.customBase='https://example.com?key=SECRET';assert.throws(()=>s.validateCampaignSettings(bad));bad.customBase='';bad.temperatures.logic=99;assert.throws(()=>s.validateCampaignSettings(bad));
 s.state.isRunning=true;await s.setInterfaceMode('simple');assert.equal(s.state.interfaceMode,'pro');s.saveCampaignProfile(true);s.state.isRunning=false;
 const missing=structuredClone(saved[0].settings);missing.models.push('absent:model');await s.applyCampaignSettings(missing);assert.deepEqual(Array.from(s.state.missingBatchModels),['absent:model']);assert(s.captureCampaignSettings().models.includes('absent:model'));await s.runBatchCampaign();assert(s.toasts.some(t=>t[0].includes('indisponibles')));assert(!s.state.batchActive);
 s.renderBatchModels(['qwen:small','gemma:small','absent:model']);assert.equal(s.checkedBatchModels().length,3);assert.equal(s.state.missingBatchModels.length,0);
 // Loading/saving must never launch inference, and invalid profiles are rejected before UI mutation.
 const prior=el('repetitions').value;const corrupt=structuredClone(saved[0]);corrupt.settings.maxTokens=-1;s.localStorage.setItem(s.PROFILE_STORAGE_KEY,JSON.stringify([corrupt]));await s.loadCampaignProfile();assert.equal(el('repetitions').value,prior);
 console.log('PASS: shipped HTML startup/agentic initialization, Simple presets/single-model launch, visible multi-selection, complete named profile save/load/update across reload, Pro draft preservation, missing models, privacy, validation and busy guards');
})().catch(e=>{console.error(e);process.exitCode=1;});
