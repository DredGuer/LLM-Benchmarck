// Original bounded tasks, deterministic checks. No execution of generated code.
var LLMB_QUALITY_VERSION = '1.0.0';
function qualityEnabled() { return !!document.getElementById('qualityEnabled')?.checked; }
function qualityTasksFor(category) {
  var cases = [];
  if (category === 'math') [[360,80],[195,65]].forEach(function(v,i) {
    cases.push({id:'duration-'+(i+1),family:'duration',distance:v[0],speed:v[1],
      prompt:'Un véhicule roule à '+v[1]+' km/h et parcourt '+v[0]+' km. Calcule le temps. Réponds uniquement avec un objet JSON contenant totalMinutes (nombre), hours (entier), minutes (entier).'});
  });
  if (category === 'logic') [['car','car','laver la voiture à une station à 200 mètres'],['laundry','walk','laver du linge à une laverie à 200 mètres']].forEach(function(v,i) {
    cases.push({id:'transport-'+(i+1),family:'transport',object:v[0],mode:v[1],
      prompt:'Tu dois '+v[2]+'. L’objet à traiter est chez toi et doit être présent sur place. Tu peux le transporter toi-même ; aucun service de collecte n’existe. Pour le linge, le sac est léger et le chemin accessible à pied. Réponds uniquement en JSON : {"mode":"car ou walk","actions":[{"action":"transport ou service","object":"car ou laundry"}]}. Décris les actions nécessaires dans leur ordre ; utilise les valeurs anglaises indiquées, sans autre champ.'});
  });
  if (category === 'code') [[0,1,10,20],[2,7,15,25]].forEach(function(indices,i) {
    cases.push({id:'fibonacci-'+(i+1),family:'fibonacci',indices,
      prompt:'Évalue les sorties d’un algorithme Fibonacci : F(0)=0, F(1)=1, F(n)=F(n-1)+F(n-2). Pour les indices '+JSON.stringify(indices)+', réponds uniquement en JSON {"values":[les résultats dans le même ordre]}. Cette épreuve vérifie les sorties, pas la qualité ou l’exécution d’un programme.'});
  });
  return cases.map(function(task) { return {id:category,name:({math:'Mathématiques',logic:'Logique',code:'Sorties algorithmiques'})[category]+' · justesse '+task.id,emoji:'🎯',prompt:task.prompt,qualityTask:task}; });
}
function campaignPromptTypes() {
  return PROMPT_TYPES.filter(pt=>state.selectedPrompts.has(pt.id)).flatMap(pt=>qualityEnabled() && ['math','logic','code'].includes(pt.id) ? qualityTasksFor(pt.id) : [pt]);
}
function finalAnswerText(text) {
  var value=String(text || ''), end=value.lastIndexOf('</think>');
  return (end>=0?value.slice(end+8):value).trim();
}
function evaluateQuality(task,text,completion) {
  if (!task) return {status:'not-assessed',evaluatorId:null,evaluatorVersion:null,taskId:null,criteria:[]};
  var q={status:'fail',evaluatorId:'llmb-'+task.family,evaluatorVersion:LLMB_QUALITY_VERSION,taskId:task.id,criteria:[]};
  if(completion?.limitReached){q.status='incomplete';return q;}
  function check(id,label,passed){q.criteria.push({id,label,passed:!!passed});}
  var value,answer=finalAnswerText(text);
  if(/^```(?:json)?\s*\n[\s\S]*\n```$/i.test(answer))answer=answer.replace(/^```(?:json)?\s*\n/i,'').replace(/\n```$/,'');
  try{value=JSON.parse(answer);}catch(_){check('json','Réponse finale JSON valide',false);return q;}
  var object=value!==null&&typeof value==='object'&&!Array.isArray(value);check('json','Réponse finale JSON valide',object);
  if(!object)return q;
  var keys=Object.keys(value).sort().join(',');
  if(task.family==='duration'){
    var total=task.distance/task.speed*60;
    check('shape','Champs et types numériques attendus',keys==='hours,minutes,totalMinutes'&&Number.isFinite(value.totalMinutes)&&Number.isInteger(value.hours)&&Number.isInteger(value.minutes));
    check('duration','Durée totale calculée à partir des données',Number.isFinite(value.totalMinutes)&&Math.abs(value.totalMinutes-total)<1e-6);
    check('conversion','Heures et minutes cohérentes',value.hours===Math.floor(total/60)&&value.minutes===total%60);
  } else if(task.family==='transport'){
    var actions=Array.isArray(value.actions)?value.actions:[];
    check('shape','Plan structuré avec les champs autorisés',keys==='actions,mode'&&['car','walk'].includes(value.mode)&&actions.length>=2&&actions.length<=8&&actions.every(a=>a&&typeof a==='object'&&Object.keys(a).sort().join(',')==='action,object'&&['transport','service'].includes(a.action)&&['car','laundry'].includes(a.object)));
    check('mode','Mode compatible avec l’objet à transporter',value.mode===task.mode);
    var transport=actions.findIndex(a=>a?.action==='transport'&&a.object===task.object),service=actions.findIndex(a=>a?.action==='service'&&a.object===task.object);
    check('dependency','Transport du bon objet avant son traitement',transport>=0&&service>transport&&actions.every(a=>a?.object===task.object));
  } else if(task.family==='fibonacci'){
    check('shape','Vecteur entier avec tous les cas demandés',keys==='values'&&Array.isArray(value.values)&&value.values.length===task.indices.length&&value.values.every(Number.isSafeInteger));
    task.indices.forEach(function(n,i){var a=0,b=1;for(var k=0;k<n;k++){var next=a+b;a=b;b=next;}check('case-'+n,'Sortie F('+n+') exacte',value.values?.[i]===a);});
  }
  q.status=q.criteria.every(c=>c.passed)?'pass':'fail';return q;
}
function qualitySummary(results) {
  var groups=new Map();(results||[]).forEach(function(r){if(r.phase==='warmup'||!r.quality?.taskId)return;
    var q=r.quality,key=JSON.stringify([r.model,q.evaluatorId,q.evaluatorVersion,q.taskId,r.metrics?.contextObservedTokens,r.metrics?.temperature,r.modelMetadata?.quantization,r.runner,r.runnerVersion,r.provenance?.applicationVersion,r.protocol?.version,r.protocol?.loadState,r.protocol?.cacheState,r.metrics?.maxTokens,r.metrics?.thinkingObserved,typeof statisticsHardware === 'function' ? statisticsHardware(r.env) : JSON.stringify([r.env?.chip,r.env?.ram])]);
    if(!groups.has(key))groups.set(key,{model:r.model,task:q.taskId,version:q.evaluatorVersion,context:r.metrics?.contextObservedTokens??'inconnu',conditions:[r.runner || 'runner inconnu','v'+(r.runnerVersion || '?'),r.modelMetadata?.quantization || 'quantification inconnue','temp '+(r.metrics?.temperature ?? '?'),'max '+(r.metrics?.maxTokens ?? '?'),'chargement '+(r.protocol?.loadState || '?'),'cache '+(r.protocol?.cacheState || '?'),'application '+(r.provenance?.applicationVersion || '?'),r.env?.chip || 'matériel inconnu'].join(' · '),pass:0,fail:0,incomplete:0});
    var g=groups.get(key);if(q.status==='pass')g.pass++;else if(q.status==='fail')g.fail++;else g.incomplete++;
  });return Array.from(groups.values());
}
