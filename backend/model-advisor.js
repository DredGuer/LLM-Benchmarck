const os=require('node:os'),fs=require('node:fs/promises'),path=require('node:path');
const {randomBytes,randomUUID}=require('node:crypto');
const {localOrigin}=require('./local-exports');
const catalog=require('./model-catalog.json');
const GiB=1024**3, DISK_RESERVE=2*GiB;
function contextValue(value){const n=Number(value);if(!Number.isInteger(n)||n<1024||n>32768)throw Error('context-invalid');return n;}
function estimate(variant,hardware,context=4096,sizeBytes=null){
 context=contextValue(context);
 const weights=sizeBytes??(variant.downloadGB===null?null:variant.downloadGB*1e9);
 const total=hardware.totalBytes,validTotal=Number.isFinite(total)&&total>0,reserve=validTotal?Math.max(4*GiB,total*.2):null,budget=validTotal?Math.max(0,total-reserve):null;
 const range=weights===null?null:{lowerBytes:weights*1.1+.5*GiB+context*65536,upperBytes:weights*1.5+GiB+context*524288};
 let status='unknown',reason='Informations insuffisantes.',selectable=false;
 if(variant.deployment==='cloud'){status='cloud';reason='Cloud uniquement : matériel distant inconnu, aucun téléchargement de poids locaux.';}
 else if(!hardware.supported){status='unavailable';reason='Cette première analyse exige Apple Silicon et un backend local.';}
 else if(!Number.isFinite(total)||total<=0||!range){status='unknown';reason='Capacité mémoire ou taille des poids indisponible.';}
 else {
  selectable=true;
  if(range.lowerBytes>total){status='unavailable';reason='Même la borne basse dépasse la RAM physique ; hors budget pour une exécution locale sans offload prévu.';selectable=false;}
  else if(range.lowerBytes>budget){status='red';reason='Borne basse supérieure au budget après réserve système : fortement déconseillé.';}
  else if(range.upperBytes>budget*.85){status='orange';reason='Marge incertaine au contexte choisi ; réduire le contexte peut aider, sans garantie de chargement.';}
  else {status='green';reason='Fourchette estimée dans le budget avec une marge ; chargement non encore vérifié.';}
  if(!Number.isFinite(hardware.diskFreeBytes)){status='unknown';reason='Espace libre du volume des modèles indisponible : téléchargement bloqué.';selectable=false;}
  else if(weights*1.1+DISK_RESERVE>hardware.diskFreeBytes){status='unavailable';reason='Espace libre insuffisant sur le volume présumé des modèles.';selectable=false;}
 }
 return {...variant,contextTokens:context,weightsBytes:weights,range,reserveBytes:reserve,budgetBytes:budget,status,reason,selectable,
  estimatorVersion:'1.0.0',confidence:'low',suggestedContextTokens:status==='orange'?[1024,2048,4096,8192,16384].filter(c=>c<context&&weights*1.5+GiB+c*524288<=budget*.85).pop()||null:null};
}
async function diskSnapshot(modelsPath,io=fs){
 let probe=modelsPath;
 while(true){try{const stat=await io.statfs(probe);const free=Number(stat.bavail)*Number(stat.bsize);return {diskFreeBytes:Number.isFinite(free)?free:null,modelsPath,spaceSource:'fs.statfs:bavail*bsize (nearest existing ancestor)',pathVerified:false};}
 catch(e){if(e.code!=='ENOENT')return {diskFreeBytes:null,modelsPath,spaceSource:'unavailable',pathVerified:false};const parent=path.dirname(probe);if(parent===probe)return {diskFreeBytes:null,modelsPath,spaceSource:'unavailable',pathVerified:false};probe=parent;}}
}
function createAdvisor({system=os,io=fs,request=fetch,modelsPath=process.env.OLLAMA_MODELS||path.join(os.homedir(),'.ollama','models')}={}){
 let active=null,starting=false;const jobs=new Map();
 async function hardware(){const disk=await diskSnapshot(modelsPath,io);return {...disk,supported:system.platform()==='darwin'&&system.arch()==='arm64',totalBytes:system.totalmem(),freeBytes:system.freemem(),memorySource:'node:os.totalmem/freemem; free is not reclaimable memory',observedAt:new Date().toISOString()};}
 async function analyze(context){context=contextValue(context);const hw=await hardware();return {catalogVersion:catalog.version,verifiedAt:catalog.verifiedAt,estimatorVersion:'1.0.0',hardware:hw,contextTokens:context,variants:catalog.variants.map(v=>estimate(v,hw,context)),assumptions:'Un seul modèle, texte, pas de mesure de qualité/vitesse ; réserve max(4 GiB,20% RAM). Fourchette heuristique non calibrée : poids×1.1..1.5 + 0.5..1 GiB + contexte×64..512 KiB. Le cache KV exact, les buffers multimodaux, le moteur et les applications peuvent changer ce coût. Le chemin des modèles doit être confirmé avant téléchargement.'};}
 function publicJob(job){return {id:job.id,status:job.status,entries:job.entries.map(e=>({...e})),contextTokens:job.contextTokens};}
 async function manifest(v,signal){
  const response=await request('https://registry.ollama.ai/v2/library/'+v.family+'/manifests/'+v.tag,{headers:{Accept:'application/vnd.docker.distribution.manifest.v2+json'},signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])});
  if(!response.ok)throw Error('manifest-unavailable');
  const text=await response.text();if(text.length>1024*1024)throw Error('manifest-invalid');const data=JSON.parse(text);
  if(data.config?.size!==undefined&&(!Number.isSafeInteger(data.config.size)||data.config.size<0))throw Error('manifest-invalid');
  if(!Array.isArray(data.layers)||!data.layers.length||!data.layers.every(l=>Number.isSafeInteger(l.size)&&l.size>=0))throw Error('manifest-invalid');
  const bytes=data.layers.reduce((n,l)=>n+l.size,0)+(Number.isSafeInteger(data.config?.size)?data.config.size:0);if(!Number.isSafeInteger(bytes)||bytes<=0)throw Error('manifest-invalid');return bytes;
 }
 async function pull(v,entry,job){
  const bytes=await manifest(v,job.controller.signal),hw=await hardware(),rating=estimate(v,hw,job.contextTokens,bytes);
  if(!rating.selectable||rating.status==='red'&&!job.allowRed)throw Error('current-budget-insufficient');
  entry.downloadBytes=bytes;entry.status='downloading';
  // Reserve room for the full manifest even when some layers are cached. Never delete user models.
  if(bytes*1.1+DISK_RESERVE>hw.diskFreeBytes)throw Error('disk-space-insufficient');
  const signal=AbortSignal.any([job.controller.signal,AbortSignal.timeout(60*60*1000)]);
  const response=await request('http://127.0.0.1:11434/api/pull',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:v.id,stream:true}),signal});
  if(!response.ok||!response.body)throw Error('ollama-pull-refused');
  const reader=response.body.getReader(),decoder=new TextDecoder();let pending='',success=false,lastCheck=0;
  async function frame(line){if(!line.trim())return;const item=JSON.parse(line);if(item.error)throw Error('ollama-pull-error');
   if(item.status==='success')success=true;
   entry.message=typeof item.status==='string'?item.status.slice(0,120):'';
   entry.layerCompleted=Number.isFinite(item.completed)?item.completed:null;entry.layerTotal=Number.isFinite(item.total)?item.total:null;
   if(Date.now()-lastCheck>2000){lastCheck=Date.now();const disk=await diskSnapshot(modelsPath,io);if(disk.diskFreeBytes===null||disk.diskFreeBytes<DISK_RESERVE)throw Error('disk-reserve-reached');}
  }
  try{while(true){if(signal.aborted)throw Error('download-cancelled');const chunk=await reader.read();if(chunk.done){pending+=decoder.decode();if(pending.trim())await frame(pending);break;}pending+=decoder.decode(chunk.value,{stream:true});if(pending.length>1024*1024)throw Error('pull-frame-too-large');const lines=pending.split('\n');pending=lines.pop();for(const line of lines)await frame(line);}
   if(!success)throw Error('pull-incomplete');entry.status='installed';entry.message='Installation confirmée par Ollama ; chargement et benchmark non vérifiés.';
  }finally{if(!success)await reader.cancel().catch(()=>{});reader.releaseLock();}
 }
 async function start(body){
  if(active||starting)throw Error('download-busy');
  starting=true;try {
  const context=contextValue(body.contextTokens);
  if(body.pathConfirmed!==true)throw Error('models-path-not-confirmed');
  if(!Array.isArray(body.models)||!body.models.length||body.models.length>50||new Set(body.models).size!==body.models.length)throw Error('selection-invalid');
  const hw=await hardware();if(!hw.supported)throw Error('apple-silicon-required');
  const variants=body.models.map(id=>catalog.variants.find(v=>v.id===id));if(variants.some(v=>!v||v.deployment!=='local'))throw Error('model-not-allowed');
  const rated=variants.map(v=>estimate(v,hw,context));if(rated.some(v=>!v.selectable||v.status==='red'&&body.allowRed!==true))throw Error('selection-budget-insufficient');
  const total=variants.reduce((n,v)=>n+v.downloadGB*1e9,0);if(total*1.1+DISK_RESERVE>hw.diskFreeBytes)throw Error('selection-disk-insufficient');
  const job={id:randomUUID(),contextTokens:context,allowRed:body.allowRed===true,controller:new AbortController(),status:'running',entries:variants.map(v=>({model:v.id,status:'queued',message:'En attente'}))};
  active=job;while(jobs.size>=5)jobs.delete(jobs.keys().next().value);jobs.set(job.id,job);
  job.completion=(async()=>{try{for(let i=0;i<variants.length;i++){if(job.controller.signal.aborted)break;try{await pull(variants[i],job.entries[i],job);}catch(e){job.entries[i].status=job.controller.signal.aborted?'cancelled':'failed';job.entries[i].message=e.message;job.status=job.controller.signal.aborted?'cancelled':'failed';break;}}if(job.status==='running')job.status=job.controller.signal.aborted?'cancelled':'completed';}
   finally{for(const entry of job.entries)if(entry.status==='queued')entry.status='not-started';active=null;}})();
  return publicJob(job);
  }finally{starting=false;}
 }
 function status(id){const job=jobs.get(id);if(!job)throw Error('job-not-found');return publicJob(job);}
 function cancel(id){const job=jobs.get(id);if(!job)throw Error('job-not-found');job.controller.abort();return publicJob(job);}
 return {analyze,start,status,cancel,activeJob:()=>active?.id||null,wait:async id=>{await jobs.get(id)?.completion;return status(id);}};
}
function mountAdvisorRoutes(app,service=createAdvisor()){
 const token=randomBytes(32).toString('hex');
 const origin=(req,res,next)=>{res.set('Cache-Control','no-store');return localOrigin(req)?next():res.status(403).json({error:'local-origin-required'});};
 const guard=(req,res,next)=>req.headers.authorization==='Bearer '+token?next():res.status(403).json({error:'session-required'});
 app.get('/api/models/advisor/session',origin,(_req,res)=>res.json({version:'1.0.0',token,activeJob:service.activeJob()}));
 app.get('/api/models/advisor',origin,async(req,res)=>{try{res.json(await service.analyze(req.query.context??4096));}catch{res.status(400).json({error:'analysis-unavailable-or-invalid-context'});}});
 app.post('/api/models/advisor/download',origin,guard,async(req,res)=>{try{res.json(await service.start(req.body||{}));}catch(e){res.status(409).json({error:e.message});}});
 app.get('/api/models/advisor/jobs/:id',origin,guard,(req,res)=>{try{res.json(service.status(req.params.id));}catch{res.status(404).json({error:'job-not-found'});}});
 app.post('/api/models/advisor/jobs/:id/cancel',origin,guard,(req,res)=>{try{res.json(service.cancel(req.params.id));}catch{res.status(404).json({error:'job-not-found'});}});
}
module.exports={catalog,estimate,diskSnapshot,createAdvisor,mountAdvisorRoutes};
