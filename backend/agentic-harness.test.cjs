const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {createAgenticHarness,localRequest,BUDGET}=require('./agentic-harness');
const md='# Réponse\n\n17 + 25 = 42\n\n## Vérification\n42 - 25 = 17.\n';
(async()=>{
 const parent=await fs.mkdtemp(path.join(process.cwd(),'agentic-test-'));
 try{
 const h=createAgenticHarness({parent});
 async function call(s,n,a){return h.tool(s.id,s.token,n,a);}
 async function write(s){assert((await call(s,'submit_answer',{answer:42})).ok);assert((await call(s,'create_directory',{path:'results'})).ok);assert((await call(s,'write_markdown',{path:'results/answer.md',content:md})).ok);}
 let s=await h.start();await write(s);assert((await call(s,'read_file',{path:'results/answer.md'})).ok);
 let out=await h.finish(s.id,s.token);assert(out.agentic.evaluation.taskSuccess);assert.equal(out.agentic.evaluation.toolCallCount,4);assert.equal(out.agentic.evaluation.retryCount,0);
 assert.equal(out.agentic.steps.length,5);assert.equal(out.artifactText,md);assert.match(out.agentic.artifacts[1].digest,/^sha256:[a-f0-9]{64}$/);
 assert.equal((await fs.readdir(parent)).length,0);await assert.rejects(h.finish(s.id,s.token),/invalid-session/);
 s=await h.start();out=await h.finish(s.id,s.token);assert(!out.agentic.evaluation.taskSuccess);assert.equal(out.agentic.evaluation.toolCallCount,0);
 s=await h.start();assert(!(await call(s,'submit_answer',{answer:43})).ok);await write(s);await call(s,'read_file',{path:'results/answer.md'});out=await h.finish(s.id,s.token);assert(out.agentic.evaluation.taskSuccess);assert.equal(out.agentic.evaluation.retryCount,1);
 s=await h.start();assert(!(await call(s,'write_markdown',{path:'results/answer.md',content:md})).ok);
 assert(!(await call(s,'create_directory',{path:'../../escape'})).ok);await h.cancel(s.id,s.token);
 s=await h.start();await write(s);out=await h.finish(s.id,s.token);assert(!out.agentic.evaluation.taskSuccess,'No read: failure');
 s=await h.start();await write(s);await call(s,'read_file',{path:'results/answer.md'});await call(s,'write_markdown',{path:'results/answer.md',content:md});out=await h.finish(s.id,s.token);assert(!out.agentic.evaluation.taskSuccess,'Rewrite invalidates verification');
 s=await h.start();await write(s);assert(!(await call(s,'write_markdown',{path:'results/answer.md',content:'x'.repeat(8193)})).ok);
 assert(!(await call(s,'write_markdown',{path:'results/answer.md',content:md,extra:1})).ok);await h.cancel(s.id,s.token);
 s=await h.start();await call(s,'submit_answer',{answer:42});const root=path.join(parent,(await fs.readdir(parent))[0]);
 await fs.symlink(parent,path.join(root,'results'),'dir');assert(!(await call(s,'create_directory',{path:'results'})).ok);await h.cancel(s.id,s.token);
 s=await h.start();await write(s);const root2=path.join(parent,(await fs.readdir(parent))[0]);await fs.rm(path.join(root2,'results','answer.md'));
 await fs.symlink(__filename,path.join(root2,'results','answer.md'));assert(!(await call(s,'read_file',{path:'results/answer.md'})).ok);assert(!(await call(s,'write_markdown',{path:'results/answer.md',content:md})).ok);await h.cancel(s.id,s.token);
 s=await h.start();for(let i=0;i<BUDGET.maxToolCalls;i++)await call(s,'unknown',{});await assert.rejects(call(s,'submit_answer',{answer:42}),/tool-budget/);out=await h.finish(s.id,s.token);assert.equal(out.agentic.steps.length,13);assert(!out.agentic.evaluation.taskSuccess);
 let clock=Date.now();const exp=createAgenticHarness({parent,now:()=>clock});s=await exp.start();clock+=BUDGET.timeoutMs+1;await assert.rejects(exp.tool(s.id,s.token,'submit_answer',{answer:42}),/timeout/);assert(!(await exp.finish(s.id,s.token)).agentic.evaluation.taskSuccess);
 s=await h.start();await assert.rejects(h.tool(s.id,'x'.repeat(64),'submit_answer',{answer:42}),/invalid-session/);await h.cancel(s.id,s.token);
 const many=await Promise.allSettled(Array.from({length:12},()=>h.start()));assert.equal(many.filter(x=>x.status==='fulfilled').length,8);
 for(const x of many)if(x.status==='fulfilled')await h.cancel(x.value.id,x.value.token);
 assert.equal((await fs.readdir(parent)).length,0);
 assert(localRequest({socket:{remoteAddress:'127.0.0.1'},headers:{origin:'http://localhost:8001'}}));
 assert(!localRequest({socket:{remoteAddress:'10.0.0.2'},headers:{}}));assert(!localRequest({socket:{remoteAddress:'::1'},headers:{origin:'https://evil.example'}}));
 console.log('PASS: agentic filesystem success, actual verification, retry, budgets, tokens, expiry, capacity, path/symlink rejection and cleanup');
 }finally{await fs.rm(parent,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
