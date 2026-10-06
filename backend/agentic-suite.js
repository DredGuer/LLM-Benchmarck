'use strict';
// Original LLMB tasks. Inspired by stateful evaluation research, not official leaderboard datasets.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),C=require('node:fs').constants;
const {randomUUID,randomBytes,timingSafeEqual,createHash}=require('node:crypto');
const VERSION='2.0.1',BUDGET={maxSteps:25,maxToolCalls:24,timeoutMs:240000},MAX_TURNS=12;
const SYSTEM_PROMPT=`Tu es un agent dans un environnement de benchmark local isolé. Accomplis l'objectif utilisateur avec les outils disponibles, sans supposer leurs résultats. Choisis toi-même les outils et leur ordre selon les dépendances. Les appels doivent utiliser le protocole natif du runner et respecter exactement les schémas JSON : types, champs requis, valeurs et absence de champs supplémentaires. Un appel écrit dans le texte ne sera pas exécuté.
Inspecte les données nécessaires avant de les utiliser. Les entrées sont en lecture seule ; seules les sorties autorisées peuvent être modifiées. Ne tente aucun shell, réseau ou accès hors du dossier. Relis tout fichier que tu produis avant de conclure. Si une information indispensable manque, demande-la avec ask_user avant une action irréversible. Tiens compte d'une nouvelle instruction utilisateur lorsqu'elle arrive. Une erreur retryable autorise une nouvelle tentative ; pour les autres erreurs, corrige la cause, sans boucler. N'appelle aucun outil si la demande n'en nécessite pas. Lorsque submit_result est demandé, son argument result est un objet JSON typé, pas une chaîne. Termine par une réponse finale concise et fidèle aux actions réellement accomplies. Tu peux annoncer brièvement l'action suivante ; aucune explication détaillée du raisonnement interne n'est exigée.`;
const SCENARIOS=[
 {id:'tool-selection',title:'Choisir et formater les outils',dimensions:['tool-selection','argument-format','dependencies'],goal:'Pour la commande ORD-104, retrouve sa quantité et son prix unitaire avec les outils, calcule le montant avec la calculatrice puis soumets {orderId,totalEUR} via submit_result. Choisis les outils utiles ; aucun fichier n’est à créer.'},
 {id:'files-report',title:'Analyser des données et créer un rapport',dimensions:['files','dependencies','verification'],goal:'Analyse inputs/orders.csv et produis outputs/report.md : titre Markdown, tableau des totaux par ligne A1/B2/C3 (colonnes id et totalEUR) et total général. Utilise un point décimal et trois lignes de données, puis une ligne hors tableau « Total : nombre EUR ». Ne modifie pas les entrées. Vérifie le fichier réel avant de conclure. Choisis toi-même la marche à suivre.'},
 {id:'error-recovery',title:'Récupérer après une erreur d’outil',dimensions:['error-recovery','dependencies'],goal:'À partir de inputs/stock.json, calcule le stock disponible (quantity moins reserved) et soumets {available} via submit_result. Les outils peuvent rencontrer une panne temporaire ; prends en compte les erreurs retournées.'},
 {id:'clarification',title:'Clarifier avant d’agir',dimensions:['clarification','policy','files'],goal:'Prépare outputs/summary.json pour ORD-104 avec exactement {orderId,currency,total}. La devise indispensable n’a pas été indiquée : demande une clarification, ne l’invente pas et n’écris rien avant cette précision. Retrouve les données de commande et vérifie ton fichier.'},
 {id:'goal-revision',title:'Mémoriser et adapter un objectif',dimensions:['multi-turn','dependencies','files'],goal:'Retrouve les données de ORD-104, utilise la calculatrice pour son montant et soumets {orderId,totalEUR} via submit_result. Une instruction utilisateur supplémentaire peut suivre ; prends-la en compte avant de conclure.'},
 {id:'no-tool',title:'Savoir ne pas appeler d’outil',dimensions:['tool-selection','policy'],goal:'Sans aucun appel d’outil ni création de fichier, réponds exactement : Le benchmark ne mesure pas toute l’intelligence du modèle.'}
].map(s=>({...s,version:VERSION,maxModelTurns:MAX_TURNS,budget:{...BUDGET}}));
const resultProperties={orderId:{type:'string'},totalEUR:{type:'number'},available:{type:'number'},currency:{type:'string',enum:['EUR','USD']},total:{type:'number'}};
const definitions=[
 ['lookup_order','Retrieve order data by identifier.',{orderId:{type:'string',pattern:'^ORD-[0-9]{3}$'}},['orderId']],
 ['calculate','Calculate left + right, left * right, left - right, or discounted left*(1-right/100).',{operation:{type:'string',enum:['add','multiply','subtract','discount']},left:{type:'number'},right:{type:'number'}},['operation','left','right']],
 ['list_directory','List one allowed directory.',{path:{type:'string',enum:['.','inputs','outputs']}},['path']],
 ['read_file','Read an allowed input or output file.',{path:{type:'string',enum:['inputs/orders.csv','inputs/stock.json','outputs/report.md','outputs/summary.json','outputs/report.json']}},['path']],
 ['create_directory','Create the allowed outputs directory.',{path:{type:'string',enum:['outputs']}},['path']],
 ['write_file','Write an allowed output, at most 8192 UTF-8 bytes. Inputs are read-only.',{path:{type:'string',enum:['outputs/report.md','outputs/summary.json','outputs/report.json']},content:{type:'string',maxLength:8192}},['path','content']],
 ['ask_user','Request the missing currency. The benchmark provides a scripted clarification.',{field:{type:'string',enum:['currency']},question:{type:'string',minLength:8,maxLength:500}},['field','question']],
 ['submit_result','Submit a typed structured result after using the necessary evidence.',{result:{type:'object',properties:resultProperties,additionalProperties:false}},['result']]
];
const TOOLS=definitions.map(([name,description,properties,required])=>({type:'function',function:{name,description,parameters:{type:'object',properties,required,additionalProperties:false}}}));
const orders={'ORD-104':{orderId:'ORD-104',quantity:3,unitEUR:28},'ORD-205':{orderId:'ORD-205',quantity:2,unitEUR:50}};
const inputs={'inputs/orders.csv':'id,quantity,unitEUR\nA1,2,19.50\nB2,3,7.00\nC3,1,12.00\n','inputs/stock.json':'{"quantity":20,"reserved":6}\n'};
const writable=new Set(['outputs/report.md','outputs/summary.json','outputs/report.json']);
function error(code,status=400){return Object.assign(new Error(code),{code,status});}
function valid(value,rule){
 if(rule.type==='object'){if(!value||typeof value!=='object'||Array.isArray(value))return false;
  if((rule.required||[]).some(k=>!Object.hasOwn(value,k))||Object.keys(value).some(k=>!Object.hasOwn(rule.properties,k)))return false;
  return Object.entries(value).every(([k,v])=>valid(v,rule.properties[k]));}
 if(rule.type==='string'&&(typeof value!=='string'||(rule.minLength&&value.length<rule.minLength)||(rule.maxLength&&value.length>rule.maxLength)||(rule.pattern&&!new RegExp(rule.pattern).test(value))))return false;
 if(rule.type==='number'&&(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>1e9))return false;
 return !rule.enum||rule.enum.includes(value);
}
function sameObject(actual,expected){return actual&&Object.keys(actual).length===Object.keys(expected).length&&Object.entries(expected).every(([k,v])=>actual[k]===v);}
function toolsForExport(){return TOOLS.map(t=>({id:t.function.name,name:t.function.name,version:VERSION,capabilities:[({'read_file':'read-file','write_file':'write-file','create_directory':'create-directory'})[t.function.name]||'other']})).concat([{id:'rejected-tool',name:'rejected-tool',version:VERSION,capabilities:['other']}]);}
function createSuiteHarness({parent=os.tmpdir(),now=Date.now}={}){
 const sessions=new Map();let pending=0;
 const cleanup=async s=>{clearTimeout(s.timer);await fs.rm(s.root,{recursive:true,force:true});};
 async function start(scenarioId){const scenario=SCENARIOS.find(x=>x.id===scenarioId);if(!scenario)throw error('unknown-scenario');
  for(const [id,s]of sessions)if(now()>s.deadline+60000&&!s.busy){await cleanup(s);sessions.delete(id);}
  if(sessions.size+pending>=8)throw error('session-limit',429);pending++;let root;
  try{root=await fs.mkdtemp(path.join(parent,'llmb-agentic-'));await fs.chmod(root,0o700);await fs.mkdir(path.join(root,'inputs'),{mode:0o700});
   for(const [file,content]of Object.entries(inputs))await fs.writeFile(path.join(root,file),content,{mode:0o600});
   const scenarioTools=structuredClone(TOOLS),submission=scenarioTools.find(t=>t.function.name==='submit_result').function.parameters.properties.result;
   if(['tool-selection','goal-revision','error-recovery'].includes(scenario.id)){const fields=scenario.id==='error-recovery'?['available']:['orderId','totalEUR'];submission.properties=Object.fromEntries(fields.map(k=>[k,resultProperties[k]]));submission.required=fields;}
   const s={tools:scenarioTools,id:'v2-'+randomUUID(),token:randomBytes(32).toString('hex'),root,scenario,deadline:now()+BUDGET.timeoutMs,busy:false,calls:0,retries:0,
    steps:[],artifactOperations:[],formatErrors:0,policyErrors:0,used:[],failed:new Set(),reads:new Set(),writes:new Set(),readAfterWrite:new Set(),writeEvidence:new Map(),lookups:new Set(),calculations:[],clarified:false,transient:false,recovered:false,phase:1,submissions:[]};
   s.timer=setTimeout(()=>{s.expired=true;if(!s.busy)cleanup(s).catch(()=>{});},BUDGET.timeoutMs);s.timer.unref?.();sessions.set(s.id,s);
   return {id:s.id,token:s.token,scenario,systemPrompt:SYSTEM_PROMPT,prompt:scenario.goal,tools:scenarioTools,budget:{...BUDGET},maxModelTurns:MAX_TURNS,version:VERSION};
  }catch(e){if(root)await fs.rm(root,{recursive:true,force:true});throw e;}finally{pending--;}
 }
 function get(id,token){const s=sessions.get(id);if(!s||typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)||!timingSafeEqual(Buffer.from(token),Buffer.from(s.token)))throw error('invalid-session',403);return s;}
 async function dir(s,relative){if(!['.','inputs','outputs'].includes(relative))throw error('unsafe-path');const dest=path.join(s.root,relative);
  const stat=await fs.lstat(dest);if(!stat.isDirectory()||stat.isSymbolicLink()||await fs.realpath(dest)!==path.resolve(await fs.realpath(s.root),relative))throw error('unsafe-path');return dest;}
 async function read(s,relative){if(!Object.hasOwn(inputs,relative)&&!writable.has(relative))throw error('unsafe-path');await dir(s,path.dirname(relative));
  const file=path.join(s.root,relative),stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>8192)throw error('unsafe-file');
  const handle=await fs.open(file,C.O_RDONLY|(C.O_NOFOLLOW||0));try{return await handle.readFile('utf8');}finally{await handle.close();}}
 function step(s,name,ok,started,retry=0,checks=[]){const id='step-'+(s.steps.length+1);s.steps.push({id,order:s.steps.length+1,
  action:({'create_directory':'create-directory','write_file':'write-file','submit_result':'answer','verify':'verify'})[name]||'tool-call',
  dependsOn:s.steps.length?[s.steps.at(-1).id]:[],status:ok?'success':'failure',...(name==='verify'?{}:{toolId:TOOLS.some(t=>t.function.name===name)?name:'rejected-tool'}),
  toolCallCount:name==='verify'?0:1,retryCount:retry,artifactIds:[],checks:checks.length?checks:[{id:name+'-execution',passed:ok,evaluator:'llmb-agentic-state',evaluatorVersion:VERSION}],
  duration:{value:Math.max(0,now()-started),unit:'ms',status:'available',source:'agentic-suite:clock',kind:'measured',observedAt:new Date(now()).toISOString(),scope:'test',nodeId:'local'}});}
 async function tool(id,token,name,args){const s=get(id,token);if(s.busy)throw error('session-busy',409);if(s.expired||now()>s.deadline)throw error('timeout',408);if(s.calls>=BUDGET.maxToolCalls)throw error('tool-budget',409);
  s.busy=true;s.calls++;s.used.push(name);const retry=s.failed.has(name)?1:0;s.retries+=retry;const started=now();let ok=false,data=null,failure=null,nextUserMessage=null;
  try{const spec=s.tools.find(t=>t.function.name===name)?.function.parameters;
   if(!spec||!valid(args,spec)){s.formatErrors++;if(typeof args?.path==='string'&&(![...Object.keys(inputs),...writable,'.','inputs','outputs'].includes(args.path)))s.policyErrors++;throw error('invalid-arguments');}
   if(name==='lookup_order'){if(!orders[args.orderId])throw error('order-not-found');data=orders[args.orderId];s.lookups.add(args.orderId);}
   if(name==='calculate'){const {left,right,operation}=args;const value=operation==='add'?left+right:operation==='multiply'?left*right:operation==='subtract'?left-right:left*(1-right/100);
    if(!Number.isFinite(value))throw error('invalid-calculation');data={value};s.calculations.push({value,operation,left,right,knownOrders:Array.from(s.lookups)});}
   if(name==='list_directory'){data={entries:(await fs.readdir(await dir(s,args.path))).sort()};}
   if(name==='create_directory'){try{await fs.mkdir(path.join(s.root,'outputs'),{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}await dir(s,'outputs');data={created:'outputs'};}
   if(name==='read_file'){
    if(s.scenario.id==='error-recovery'&&args.path==='inputs/stock.json'&&!s.transient){s.transient=true;throw error('temporary-unavailable');}
    data={path:args.path,content:await read(s,args.path)};s.reads.add(args.path);if(s.writes.has(args.path))s.readAfterWrite.add(args.path);
    if(s.scenario.id==='error-recovery'&&args.path==='inputs/stock.json'&&s.transient)s.recovered=true;
   }
   if(name==='write_file'){
    if(s.scenario.id==='clarification'&&!s.clarified){s.policyErrors++;throw error('clarification-required');}
    if(Buffer.byteLength(args.content)>8192)throw error('file-too-large');await dir(s,'outputs');const file=path.join(s.root,args.path);
    try{const stat=await fs.lstat(file);if(stat.isSymbolicLink()||!stat.isFile())throw error('unsafe-file');}catch(e){if(e.code!=='ENOENT')throw e;}
    const handle=await fs.open(file,C.O_WRONLY|C.O_CREAT|C.O_TRUNC|(C.O_NOFOLLOW||0),0o600);try{await handle.writeFile(args.content);}finally{await handle.close();}
    s.writes.add(args.path);s.writeEvidence.set(args.path,{reads:Array.from(s.reads),lookups:Array.from(s.lookups),calculations:s.calculations.slice(),phase:s.phase,clarified:s.clarified});s.readAfterWrite.delete(args.path);data={written:args.path};
   }
   if(name==='ask_user'){if(s.scenario.id!=='clarification')throw error('clarification-not-required');s.clarified=true;data={field:'currency',answer:'EUR',source:'scripted-user'};}
   if(name==='submit_result'){s.submissions.push({result:args.result,reads:Array.from(s.reads),lookups:Array.from(s.lookups)});data={recorded:true};
    if(s.scenario.id==='goal-revision'&&s.phase===1&&sameObject(args.result,{orderId:'ORD-104',totalEUR:84})&&s.lookups.has('ORD-104')&&s.calculations.some(c=>c.value===84&&c.operation==='multiply'&&c.knownOrders.includes('ORD-104')&&[c.left,c.right].sort((a,b)=>a-b).join(',')==='3,28')){
     s.phase=2;nextUserMessage='Changement de demande : remplace ORD-104 par ORD-205. Retrouve ses données, utilise la calculatrice pour le sous-total puis la remise de 10 %. Crée et vérifie outputs/report.json avec exactement {orderId,currency,subtotal,discountPercent,total}, devise EUR. Le premier résultat ne doit pas être réutilisé.';}
   }
   ok=true;s.failed.delete(name);
  }catch(e){s.failed.add(name);failure={code:/^[a-z-]+$/.test(e.code||'')?e.code:'tool-failed',retryable:e.code==='temporary-unavailable',message:e.code==='temporary-unavailable'?'Temporary input service unavailable. Retry this read.':'Tool rejected. Check arguments, dependencies and policy.'};}
  finally{step(s,name,ok,started,retry);if(ok&&['write_file','read_file'].includes(name)&&writable.has(args.path))s.artifactOperations.push({stepId:s.steps.at(-1).id,path:args.path});s.busy=false;if(s.expired)await cleanup(s);}
  return {ok,data,error:failure,toolCallCount:s.calls,...(nextUserMessage?{nextUserMessage}:{})};
 }
 async function finish(id,token,reason,finalAnswer=''){const s=get(id,token);if(s.busy)throw error('session-busy',409);s.busy=true;const started=now();const criteria=[];let artifacts=[],artifactTexts={};
  const check=(id,dimension,label,passed)=>criteria.push({id,dimension,label,passed:passed===null?null:!!passed});
  try{
   for(const file of s.writes){try{const text=await read(s,file);artifactTexts[file]=text;artifacts.push({id:'artifact-'+artifacts.length,relativePath:file,kind:'file',mediaType:file.endsWith('.json')?'application/json':'text/markdown',sizeBytes:Buffer.byteLength(text),digest:'sha256:'+createHash('sha256').update(text).digest('hex')});}catch{}}
   check('format','argument-format','Appels natifs : schéma des arguments respecté',s.calls?s.formatErrors===0:null);
   check('policy','policy','Périmètre fichiers et clarification respectés',s.policyErrors===0);
   const submitted=s.submissions.at(-1),last=submitted?.result,id=s.scenario.id;
   if(id==='tool-selection'){
    check('lookup','tool-selection','Bon outil de lecture de commande',s.lookups.has('ORD-104'));
    check('useful-tools','tool-selection','Outils pertinents, sans action fichier inutile',s.used.every(n=>['lookup_order','calculate','submit_result'].includes(n)));
    check('calculation','dependencies','Calcul fondé sur les données récupérées',s.calculations.some(c=>c.value===84&&c.operation==='multiply'&&c.knownOrders.includes('ORD-104')&&[c.left,c.right].sort((a,b)=>a-b).join(',')==='3,28')&&s.lookups.has('ORD-104'));
    check('result','argument-format','Résultat structuré exact',sameObject(last,{orderId:'ORD-104',totalEUR:84}));
   }
   if(id==='files-report'){
    const text=artifactTexts['outputs/report.md']||'',table=new Map();let rows=0;for(const line of text.split('\n')){const cells=line.split('|').map(v=>v.trim()).filter(Boolean);if(cells.length===2&&/^\d+(?:\.\d+)?$/.test(cells[1])){rows++;table.set(cells[0],Number(cells[1]));}}
    const totalLines=text.split('\n').map(l=>l.replace(/\*/g,'').trim()).filter(l=>/^total\b/i.test(l));
    check('source','dependencies','Données source lues',s.writeEvidence.get('outputs/report.md')?.reads.includes('inputs/orders.csv'));
    check('artifact','files','Rapport Markdown, lignes et total exacts',/^#\s+\S/m.test(text)&&rows===3&&table.size===3&&table.get('A1')===39&&table.get('B2')===21&&table.get('C3')===12&&totalLines.length===1&&/^total\s*:\s*72(?:\.0+)?\s*(?:EUR|€)\.?$/i.test(totalLines[0]));
    check('readback','verification','Dernière version du rapport relue',s.readAfterWrite.has('outputs/report.md'));
   }
   if(id==='error-recovery'){
    check('recovery','error-recovery','Erreur temporaire rencontrée puis lecture réussie',s.transient&&s.recovered);
    check('source','dependencies','Données stock effectivement lues',submitted?.reads.includes('inputs/stock.json'));
    check('result','argument-format','Stock disponible structuré exact',sameObject(last,{available:14}));
   }
   if(id==='clarification'){
    let json;try{json=JSON.parse(artifactTexts['outputs/summary.json']);}catch{}
    check('clarify','clarification','Devise demandée avant écriture',s.clarified&&s.writeEvidence.get('outputs/summary.json')?.clarified);
    check('source','dependencies','Données de commande récupérées',s.writeEvidence.get('outputs/summary.json')?.lookups.includes('ORD-104'));
    check('artifact','files','JSON strict avec la devise reçue',sameObject(json,{orderId:'ORD-104',currency:'EUR',total:84}));
    check('readback','verification','Fichier final relu',s.readAfterWrite.has('outputs/summary.json'));
   }
   if(id==='goal-revision'){
    let json;try{json=JSON.parse(artifactTexts['outputs/report.json']);}catch{}
    check('first-goal','multi-turn','Premier objectif réussi et nouvelle instruction délivrée',s.phase===2);
    check('new-data','dependencies','Nouvelle commande récupérée et remise calculée',s.lookups.has('ORD-205')&&s.writeEvidence.get('outputs/report.json')?.calculations.some(c=>c.value===100&&c.operation==='multiply'&&c.knownOrders.includes('ORD-205')&&[c.left,c.right].sort((a,b)=>a-b).join(',')==='2,50')&&s.writeEvidence.get('outputs/report.json')?.calculations.some(c=>c.value===90&&c.operation==='discount'&&c.left===100&&c.right===10&&c.knownOrders.includes('ORD-205')));
    check('revision','multi-turn','Fichier respecte le nouvel objectif, pas le précédent',sameObject(json,{orderId:'ORD-205',currency:'EUR',subtotal:100,discountPercent:10,total:90}));
    check('readback','verification','Dernière version du fichier relue',s.readAfterWrite.has('outputs/report.json'));
   }
   if(id==='no-tool'){
    check('abstention','tool-selection','Aucun appel inutile',s.calls===0);
    check('answer-content','completion-content','Phrase demandée présente, apostrophes équivalentes',typeof finalAnswer==='string'&&finalAnswer.trim().normalize('NFC').replace(/[’‘]/g,"'")=="Le benchmark ne mesure pas toute l'intelligence du modèle.");
    check('answer','argument-format','Réponse finale respecte exactement la consigne',typeof finalAnswer==='string'&&finalAnswer.trim()==='Le benchmark ne mesure pas toute l’intelligence du modèle.');
   }
   check('final-response','completion','Réponse finale présente après les actions',typeof finalAnswer==='string'&&finalAnswer.trim().length>0);
   check('budget','completion','Tâche terminée dans les budgets, sans interruption',!reason&&!s.expired&&now()<=s.deadline);
   const passed=criteria.every(c=>c.passed!==false),goalCompleted=criteria.filter(c=>c.dimension!=='completion'&&!['format','policy','useful-tools','answer'].includes(c.id)).every(c=>c.passed!==false);step(s,'verify',passed,started,0,criteria.map(c=>({id:c.id,passed:c.passed,evaluator:'llmb-agentic-state',evaluatorVersion:VERSION})));
   for(const operation of s.artifactOperations){const artifact=artifacts.find(a=>a.relativePath===operation.path);if(artifact)s.steps.find(step=>step.id===operation.stepId).artifactIds.push(artifact.id);}
   s.steps.at(-1).artifactIds=artifacts.map(a=>a.id);
   return {artifactTexts,agentic:{scenario:{id:s.scenario.id,version:VERSION,title:s.scenario.title,dimensions:s.scenario.dimensions},
    orchestrator:{name:'llmb-agentic-suite',version:VERSION,agentCount:1},workspacePolicy:{scope:'isolated-test-directory',networkAllowed:false,shellAllowed:false,outsideWorkspaceAllowed:false},
    tools:toolsForExport(),budget:{...BUDGET},steps:s.steps,artifacts,evaluation:{taskSuccess:passed,goalCompleted,evaluator:'llmb-agentic-state',evaluatorVersion:VERSION,successRate:passed?1:0,toolCallCount:s.calls,retryCount:s.retries,criteria}}};
  }finally{try{await cleanup(s);}finally{sessions.delete(id);}}
 }
 async function cancel(id,token){const s=get(id,token);if(s.busy)throw error('session-busy',409);try{await cleanup(s);}finally{sessions.delete(id);}}
 return {start,tool,finish,cancel};
}
module.exports={VERSION,BUDGET,SCENARIOS,SYSTEM_PROMPT,TOOLS,createSuiteHarness,valid};
