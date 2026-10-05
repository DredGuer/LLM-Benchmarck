const fs=require('node:fs/promises'),constants=require('node:fs').constants,path=require('node:path'),os=require('node:os');
const {randomUUID,randomBytes,createHash,timingSafeEqual}=require('node:crypto');
const VERSION='1.0.0',BUDGET={maxSteps:16,maxToolCalls:12,timeoutMs:180000};
const TOOL_DEFINITIONS=[
 ['submit_answer','Submit the numerical answer to 17 + 25.',{answer:{type:'number'}},['answer']],
 ['create_directory','Create results in the isolated workspace.',{path:{type:'string',enum:['results']}},['path']],
 ['write_markdown','Write results/answer.md. The directory must already exist.',{path:{type:'string',enum:['results/answer.md']},content:{type:'string',maxLength:8192}},['path','content']],
 ['read_file','Read results/answer.md to verify it.',{path:{type:'string',enum:['results/answer.md']}},['path']]
].map(([name,description,properties,required])=>({type:'function',function:{name,description,parameters:{type:'object',properties,required,additionalProperties:false}}}));
const PROMPT='Calcule 17 + 25 et soumets la réponse avec submit_answer. Ensuite crée le dossier results avec create_directory, écris results/answer.md avec write_markdown : un titre Markdown, le calcul complet et une section Vérification expliquant comment vérifier le résultat. Relis le fichier avec read_file et termine par une confirmation brève. Utilise les outils, dans cet ordre. Les chemins sont relatifs à un dossier de test isolé.';
function fault(code,status=400){return Object.assign(new Error(code),{code,status});}
function localRequest(req){
 const address=req.socket?.remoteAddress || '';
 if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address))return false;
 const origin=req.headers.origin;if(!origin)return true;
 try{const u=new URL(origin);return ['http:','https:'].includes(u.protocol)&&['localhost','127.0.0.1','[::1]'].includes(u.hostname);}catch{return false;}
}
function createAgenticHarness({now=Date.now,parent=os.tmpdir()}={}){
 const sessions=new Map();let pendingStarts=0;
 async function cleanup(s){clearTimeout(s.timer);await fs.rm(s.root,{recursive:true,force:true});}
 async function start(){
  for(const [id,s] of sessions)if(now()>s.deadline+60000 && !s.busy){await cleanup(s);sessions.delete(id);}
  if(sessions.size+pendingStarts>=8)throw fault('session-limit',429);
  pendingStarts++;let root;try{root=await fs.mkdtemp(path.join(parent,'llmb-agentic-'));await fs.chmod(root,0o700);}catch(e){if(root)await fs.rm(root,{recursive:true,force:true});throw e;}finally{pendingStarts--;}
  const id=randomUUID(),token=randomBytes(32).toString('hex'),s={id,token,root,deadline:now()+BUDGET.timeoutMs,steps:[],calls:0,retries:0,failedTools:new Set(),answer:false,read:false,busy:false};
  s.timer=setTimeout(()=>{s.expired=true;if(!s.busy)cleanup(s).catch(()=>{});},BUDGET.timeoutMs);s.timer.unref?.();sessions.set(id,s);
  return {id,token,budget:{...BUDGET},tools:TOOL_DEFINITIONS,prompt:PROMPT,version:VERSION};
 }
 function get(id,token){const s=sessions.get(id);
  if(!s || typeof token!=='string' || !/^[a-f0-9]{64}$/.test(token) || !timingSafeEqual(Buffer.from(token),Buffer.from(s.token)))throw fault('invalid-session',403);
  return s;
 }
 async function directory(s){const folder=path.join(s.root,'results'),stat=await fs.lstat(folder);
  if(!stat.isDirectory()||stat.isSymbolicLink()||await fs.realpath(folder)!==path.join(await fs.realpath(s.root),'results'))throw fault('unsafe-directory');return folder;
 }
 async function read(s){await directory(s);const filename=path.join(s.root,'results','answer.md'),stat=await fs.lstat(filename);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>8192)throw fault('unsafe-file');
  const h=await fs.open(filename,constants.O_RDONLY|(constants.O_NOFOLLOW||0));try{return await h.readFile('utf8');}finally{await h.close();}}
 function add(s,action,passed,toolId,started,artifacts=[],retry=0){
  const id='step-'+(s.steps.length+1),at=new Date(now()).toISOString();
  s.steps.push({id,order:s.steps.length+1,action,dependsOn:s.steps.length?[s.steps.at(-1).id]:[],status:passed?'success':'failure',
   toolCallCount:toolId?1:0,retryCount:retry,artifactIds:artifacts,checks:[{id:'check-'+id,passed,evaluator:'llmb-files-v1',evaluatorVersion:VERSION}],
   ...(toolId?{toolId}:{}),duration:{value:Math.max(0,now()-started),unit:'ms',status:'available',source:'agentic-harness:clock',kind:'measured',observedAt:at,scope:'test',nodeId:'local'}});
 }
 async function tool(id,token,name,args){const s=get(id,token);
  if(s.busy)throw fault('session-busy',409);if(s.expired||now()>s.deadline)throw fault('timeout',408);
  if(s.calls>=BUDGET.maxToolCalls)throw fault('tool-budget',409);
  s.busy=true;s.calls++;const retry=s.failedTools.has(name)?1:0;s.retries+=retry;const started=now();let ok=false,content='tool-rejected',action='tool-call';
  try{
   const spec=TOOL_DEFINITIONS.find(t=>t.function.name===name)?.function.parameters;
   if(!spec || !args || typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(k=>!spec.required.includes(k))||spec.required.some(k=>!(k in args)))throw fault('invalid-arguments');
   if(name==='submit_answer'){action='answer';if(args.answer!==42)throw fault('wrong-answer');s.answer=true;content='Correct answer accepted.';}
   else {
    if(typeof args.path!=='string'||args.path!==spec.properties.path.enum[0])throw fault('unsafe-path');
    if(!s.answer)throw fault('answer-required');
    if(name==='create_directory'){action='create-directory';try{await fs.mkdir(path.join(s.root,'results'),{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;await directory(s);}content='Directory results exists.';}
    if(name==='write_markdown'){action='write-file';await directory(s);
     if(typeof args.content!=='string'||Buffer.byteLength(args.content)>8192)throw fault('file-too-large');
     const file=path.join(s.root,'results','answer.md');try{if((await fs.lstat(file)).isSymbolicLink())throw fault('unsafe-file');}catch(e){if(e.code!=='ENOENT')throw e;}
     const h=await fs.open(file,constants.O_WRONLY|constants.O_CREAT|constants.O_TRUNC|(constants.O_NOFOLLOW||0),0o600);
     try{await h.writeFile(args.content);}finally{await h.close();}s.read=false;content='Markdown written.';
    }
    if(name==='read_file'){const text=await read(s);s.read=true;content=text;}
   }
   ok=true;s.failedTools.delete(name);
  }catch(e){content=e.code && /^[-a-z]+$/.test(e.code)?e.code:'tool-failed';s.failedTools.add(name);}
  finally{s.busy=false;add(s,action,ok,TOOL_DEFINITIONS.some(t=>t.function.name===name)?name:'rejected-tool',started,[],retry);if(s.expired)await cleanup(s);}
  return {ok,content,toolCallCount:s.calls};
 }
 async function finish(id,token,reason){const s=get(id,token);if(s.busy)throw fault('session-busy',409);s.busy=true;const started=now();
  let text='',artifacts=[],fileValid=false;
  try{try{text=await read(s);fileValid=/^#{1,6}\s+\S/m.test(text)&&/17\s*\+\s*25\s*=\s*42/.test(text)&&/^#{1,6}[^\S\r\n]+V[eé]rification[^\r\n]*\r?\n(?:\s*\n)*[^\n]{8,}/im.test(text);
   artifacts=[{id:'folder',relativePath:'results',kind:'directory'},{id:'markdown',relativePath:'results/answer.md',kind:'file',mediaType:'text/markdown',sizeBytes:Buffer.byteLength(text),digest:'sha256:'+createHash('sha256').update(text).digest('hex')}];}catch{}
   const passed=s.answer&&s.read&&fileValid&&!reason&&!s.expired&&now()<=s.deadline;
   add(s,'verify',passed,null,started,artifacts.map(a=>a.id));
   return {artifactText:text || null,agentic:{orchestrator:{name:'llmb-files-harness',version:VERSION,agentCount:1},
    workspacePolicy:{scope:'isolated-test-directory',networkAllowed:false,shellAllowed:false,outsideWorkspaceAllowed:false},
    tools:TOOL_DEFINITIONS.map(t=>({id:t.function.name,name:t.function.name,version:VERSION,capabilities:[({'create_directory':'create-directory','write_markdown':'write-file','read_file':'read-file'})[t.function.name]||'other']})).concat([{id:'rejected-tool',name:'rejected-tool',version:VERSION,capabilities:['other']}]),budget:{...BUDGET},steps:s.steps,artifacts,
    evaluation:{taskSuccess:passed,evaluator:'llmb-files-v1',evaluatorVersion:VERSION,successRate:passed?1:0,toolCallCount:s.calls,retryCount:s.retries}}};
  }finally{try{await cleanup(s);}finally{sessions.delete(id);}}
 }
 async function cancel(id,token){const s=get(id,token);if(s.busy)throw fault('session-busy',409);await cleanup(s);sessions.delete(id);}
 return {start,tool,finish,cancel};
}
function mountAgenticRoutes(app,harness=createAgenticHarness(),suite=require('./agentic-suite').createSuiteHarness()){
 const catalog=require('./agentic-suite');
 const selected=req=>req.params.id.startsWith('v2-')?suite:harness;
 function guard(req,res,next){if(!localRequest(req)||req.headers['x-llmb-agentic']!=='1')return res.status(403).json({error:'local-origin-required'});next();}
 const auth=req=>String(req.headers.authorization||'').replace(/^Bearer /,'');
 function route(fn){return async(req,res)=>{try{res.json(await fn(req));}catch(e){res.status(e.status||500).json({error:e.code||'agentic-unavailable'});}};}
 app.get('/api/agentic/info',guard,route(async()=>({version:catalog.VERSION,budget:catalog.BUDGET,maxModelTurns:12,scenarios:catalog.SCENARIOS})));
 app.post('/api/agentic/start',guard,route(req=>req.body?.scenario?suite.start(req.body.scenario):harness.start()));
 app.post('/api/agentic/:id/tool',guard,route(req=>selected(req).tool(req.params.id,auth(req),req.body.name,req.body.arguments)));
 app.post('/api/agentic/:id/finish',guard,route(req=>selected(req).finish(req.params.id,auth(req),req.body.reason?true:false,req.body.finalAnswer)));
 app.delete('/api/agentic/:id',guard,route(async req=>{await selected(req).cancel(req.params.id,auth(req));return {success:true};}));
}
module.exports={createAgenticHarness,mountAgenticRoutes,localRequest,TOOL_DEFINITIONS,PROMPT,VERSION,BUDGET};
