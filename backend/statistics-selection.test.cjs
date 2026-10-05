const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.style={};this.value='';this.events={};}
 appendChild(el){this.children.push(el);return el;}
 addEventListener(type,fn){this.events[type]=fn;}
 setAttribute(){}
 getContext(){return {font:'',fillText(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},save(){},translate(){},rotate(){},restore(){},closePath(){},fill(){},arc(){}};}
}
const elements=new Map([['statisticsContent',new Element('div')],['statisticsMetric',{value:'prefill'}],['statisticsAggregate',{value:'mean'}],['statisticsChartType',{value:'area'}],['statisticsWindow',{value:'3'}]]);
const scope={document:{getElementById:id=>elements.get(id),createElement:tag=>new Element(tag)},HISTORY_KEY:'history',localStorage:{getItem:()=>JSON.stringify(sessions)}};
vm.createContext(scope);vm.runInContext(fs.readFileSync('js/ui/statistics.js','utf8'),scope);
const base={model:'A',runner:'Ollama',phase:'measurement',env:{chip:'M3',ram:'36 GiB'},promptType:'math',promptTypeName:'Maths',promptText:'same',
 metrics:{tokensPerSec:10,prefillTimeMs:100,temperature:0.7,maxTokens:8192,contextObservedTokens:8192},protocol:{version:'0.08',loadState:'warm',cacheState:'cold'},timestamp:'2026-10-05T19:00:00Z'};
const a={...base,id:'a'},b={...base,id:'b',metrics:{...base.metrics,tokensPerSec:30,prefillTimeMs:300}},c={...base,id:'c',model:'B'},
 diff={...b,id:'d',metrics:{...b.metrics,temperature:1}},missing={...base,id:'missing',metrics:{...base.metrics,prefillTimeMs:null}},
 warm={...base,id:'warm',phase:'warmup'},trunc={...base,id:'trunc',completion:{limitReached:true}};
const sessions=[{results:[a,b,c,diff,missing,warm,trunc,a]}];
const groups=scope.buildStatistics(sessions);assert.equal(groups.length,3);
let selected=scope.selectedStatisticsModels(groups,scope.statisticsSelection);assert.equal(selected.length,2);
const modelA=selected.find(m=>m.model==='A');assert.equal(modelA.points.length,4);
assert.equal(scope.statisticsSummary(modelA.points.map(p=>p.tps)).mean,20);
assert.equal(scope.statisticsSummary(modelA.points.map(p=>p.prefill)).mean,700/3);
scope.statisticsSelection.excludedPasses.add('b');selected=scope.selectedStatisticsModels(groups,scope.statisticsSelection);
assert.equal(selected.find(m=>m.model==='A').points.length,3);
scope.statisticsSelection.excludedModels.add('B');assert.equal(scope.selectedStatisticsModels(groups,scope.statisticsSelection).length,1);
scope.statisticsSelection.excludedCategories.add('Maths');assert.equal(scope.selectedStatisticsModels(groups,scope.statisticsSelection)[0].points.length,0);
scope.statisticsSelection.excludedCategories.clear();
const rolling=scope.statisticsRolling([{at:'a',tps:10},{at:'b',tps:20},{at:'c',tps:null},{at:'d',tps:40}],'tps',3);
assert.equal(rolling[1].value,15);assert.equal(rolling[2].value,null);assert.equal(rolling[3].value,30);
assert.equal(scope.statisticsSummary([0,null,undefined]).mean,0);
assert.equal(scope.statisticsSummary([10]).std,null);
scope.renderStatistics();assert(elements.get('statisticsContent').children.length>0);
assert.equal(sessions[0].results.length,8); // selection never changes saved history
console.log('PASS: model/category/pass filters, cross-condition summaries, duplicate/warmup/truncation exclusions, prefill unknowns, moving averages, area rendering and immutable history');
