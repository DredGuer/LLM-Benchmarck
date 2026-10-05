const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {createSuiteHarness,SCENARIOS,BUDGET}=require('./agentic-suite');
const markdown='# Rapport\n\n| id | totalEUR |\n|---|---|\n| A1 | 39.00 |\n| B2 | 21.00 |\n| C3 | 12.00 |\n\nTotal : 72.00 EUR\n';
(async()=>{const parent=await fs.mkdtemp(path.join(process.cwd(),'suite-test-'));try{
 const h=createSuiteHarness({parent});const call=(s,name,args)=>h.tool(s.id,s.token,name,args);
 async function ok(s,n,a){const r=await call(s,n,a);assert(r.ok,JSON.stringify(r));return r;}
 async function order(s,id='ORD-104'){const r=await ok(s,'lookup_order',{orderId:id});await ok(s,'calculate',{operation:'multiply',left:r.data.quantity,right:r.data.unitEUR});}
 async function file(s,relative,content){await ok(s,'create_directory',{path:'outputs'});await ok(s,'write_file',{path:relative,content});await ok(s,'read_file',{path:relative});}
 const outcomes=[];
 for(const scenario of SCENARIOS){const s=await h.start(scenario.id);assert(s.systemPrompt.includes('schémas JSON'));assert.equal(s.maxModelTurns,12);
  if(scenario.id==='tool-selection'){await order(s);await ok(s,'submit_result',{result:{orderId:'ORD-104',totalEUR:84}});}
  if(scenario.id==='files-report'){await ok(s,'read_file',{path:'inputs/orders.csv'});await file(s,'outputs/report.md',markdown);}
  if(scenario.id==='error-recovery'){const first=await call(s,'read_file',{path:'inputs/stock.json'});assert(!first.ok);assert(first.error.retryable);await ok(s,'read_file',{path:'inputs/stock.json'});await ok(s,'submit_result',{result:{available:14}});}
  if(scenario.id==='clarification'){await ok(s,'ask_user',{field:'currency',question:'Quelle devise souhaitez-vous ?'});await order(s);await file(s,'outputs/summary.json',JSON.stringify({orderId:'ORD-104',currency:'EUR',total:84}));}
  if(scenario.id==='goal-revision'){await order(s);const revised=await ok(s,'submit_result',{result:{orderId:'ORD-104',totalEUR:84}});assert(revised.nextUserMessage.includes('ORD-205'));await order(s,'ORD-205');await ok(s,'calculate',{operation:'discount',left:100,right:10});await file(s,'outputs/report.json',JSON.stringify({orderId:'ORD-205',currency:'EUR',subtotal:100,discountPercent:10,total:90}));}
  const out=await h.finish(s.id,s.token,false,scenario.id==='no-tool'?'Le benchmark ne mesure pas toute l’intelligence du modèle.':'Terminé.');
  assert(out.agentic.evaluation.taskSuccess,scenario.id+JSON.stringify(out.agentic.evaluation.criteria));assert(out.agentic.evaluation.goalCompleted);outcomes.push(out);
  assert(out.agentic.evaluation.criteria.every(c=>c.passed!==false));if(out.agentic.artifacts.length)assert(out.agentic.steps.at(-1).artifactIds.length);assert.equal((await fs.readdir(parent)).length,0);
 }
 assert.equal(outcomes[2].agentic.evaluation.retryCount,1);assert.equal(outcomes[5].agentic.evaluation.criteria.find(c=>c.id==='format').passed,null);
 let s=await h.start('files-report');await file(s,'outputs/report.md',markdown);await ok(s,'read_file',{path:'inputs/orders.csv'});let out=await h.finish(s.id,s.token,false,'Terminé');assert(!out.agentic.evaluation.taskSuccess,'Reading after guessing is not a data dependency');
 s=await h.start('tool-selection');assert(!(await call(s,'calculate',{operation:'multiply',left:'3',right:28})).ok);await order(s);await ok(s,'submit_result',{result:{orderId:'ORD-104',totalEUR:84}});out=await h.finish(s.id,s.token,false,'Terminé.');assert(out.agentic.evaluation.goalCompleted);assert(!out.agentic.evaluation.taskSuccess,'Final outcome and format compliance differ');
 s=await h.start('tool-selection');await ok(s,'calculate',{operation:'multiply',left:3,right:28});await ok(s,'lookup_order',{orderId:'ORD-104'});await ok(s,'submit_result',{result:{orderId:'ORD-104',totalEUR:84}});out=await h.finish(s.id,s.token,false,'Terminé.');assert(!out.agentic.evaluation.criteria.find(c=>c.id==='calculation').passed);
 s=await h.start('no-tool');await ok(s,'list_directory',{path:'.'});out=await h.finish(s.id,s.token,false,'Le benchmark ne mesure pas toute l’intelligence du modèle.');assert(!out.agentic.evaluation.taskSuccess);
 s=await h.start('clarification');await ok(s,'create_directory',{path:'outputs'});assert(!(await call(s,'write_file',{path:'outputs/summary.json',content:'{}'})).ok);await ok(s,'ask_user',{field:'currency',question:'Quelle devise choisir ?'});await order(s);await file(s,'outputs/summary.json',JSON.stringify({orderId:'ORD-104',currency:'EUR',total:84}));out=await h.finish(s.id,s.token,false,'Terminé.');assert(out.agentic.evaluation.goalCompleted);assert(!out.agentic.evaluation.taskSuccess);
 s=await h.start('files-report');assert(!(await call(s,'write_file',{path:'inputs/orders.csv',content:'tampered'})).ok);assert(!(await call(s,'read_file',{path:'../../private'})).ok);await h.cancel(s.id,s.token);
 s=await h.start('files-report');const root=path.join(parent,(await fs.readdir(parent))[0]);await fs.symlink(parent,path.join(root,'outputs'),'dir');assert(!(await call(s,'create_directory',{path:'outputs'})).ok);await h.cancel(s.id,s.token);
 s=await h.start('files-report');for(let i=0;i<BUDGET.maxToolCalls;i++)await call(s,'unknown',{});await assert.rejects(call(s,'read_file',{path:'inputs/orders.csv'}),/tool-budget/);out=await h.finish(s.id,s.token,false,'Terminé.');assert.equal(out.agentic.steps.length,25);
 let time=Date.now();const timed=createSuiteHarness({parent,now:()=>time});s=await timed.start('no-tool');time+=BUDGET.timeoutMs+1;out=await timed.finish(s.id,s.token,false,'Le benchmark ne mesure pas toute l’intelligence du modèle.');assert(!out.agentic.evaluation.taskSuccess);
 const many=await Promise.allSettled(Array.from({length:12},()=>h.start('no-tool')));assert.equal(many.filter(x=>x.status==='fulfilled').length,8);for(const x of many)if(x.status==='fulfilled')await h.cancel(x.value.id,x.value.token);
 assert.equal((await fs.readdir(parent)).length,0);
 console.log('PASS: six stateful tasks, typed arguments, causal dependencies, goal vs compliance, scripted clarification/revision, recovery, abstention, budgets, path/symlink rejection, cleanup');
 }finally{await fs.rm(parent,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
