function statisticsHardware(env) {
  var n = env?.hardwareInventory?.machine;
  return n ? JSON.stringify([n.platform, n.os?.version, n.cpus.map(c => [c.model,c.physicalCores,c.logicalCores]),
    n.memory.physicalCapacity.value, n.gpus.map(g => [g.model,g.computeUnits]), n.storage.map(d => [d.model,d.transport])]) :
    JSON.stringify(['unknown-hardware',env?.os,env?.chip,env?.cores,env?.ram,env?.gpu]);
}
function buildStatistics(sessions) {
  var groups = new Map(), seen = new Set();
  (Array.isArray(sessions) ? sessions : []).forEach(function(session) {
    (session.results || []).forEach(function(r) {
      if (r.error || r.completion?.limitReached || r.phase === 'warmup' || seen.has(r.id)) return;
      if (r.id) seen.add(r.id);
      var m = r.metrics || {}, p = r.protocol || {}, meta = r.modelMetadata || {};
      if (!Number.isFinite(m.tokensPerSec) || m.tokensPerSec < 0) return;
      var key = JSON.stringify([r.model, r.memory?.loadedModel?.digest, r.runner, statisticsHardware(r.env),
        meta.quantization, meta.type, m.contextObservedTokens, r.promptType,
        p.promptDigest || r.promptText || r.id, m.temperature, m.maxTokens,
        r.runnerVersion || 'unknown', m.thinkingEnabled ?? 'unknown', m.thinkingObserved ?? 'unknown', p.version || 'legacy', p.loadState || 'unknown', p.cacheState || 'unknown']);
      if (!groups.has(key)) groups.set(key, { model:r.model, runner:r.runner, type:meta.type || 'unknown',
        context:m.contextObservedTokens ?? null, prompt:r.promptTypeName || r.promptType, load:p.loadState || 'unknown',
        cache:p.cacheState || 'unknown', paramsB:Number.isFinite(meta.parameterCount) && meta.parameterCount > 0 ? meta.parameterCount / 1e9 : null,
        hardware:(r.env?.chip || 'CPU ?')+' / '+(r.env?.ram || 'RAM ?'), temperature:m.temperature, maxTokens:m.maxTokens,
        quantization:meta.quantization || 'unknown', runnerVersion:r.runnerVersion || 'unknown', thinkingEnabled:m.thinkingEnabled ?? null, thinkingObserved:m.thinkingObserved ?? null, protocolVersion:p.version || 'legacy', key:key, points:[] });
      groups.get(key).points.push({ id:r.id || key+'-'+(r.finishedAt || r.timestamp)+'-'+r.rep, rep:r.rep || 1, category:r.promptTypeName || r.promptType, prefill:Number.isFinite(m.prefillTimeMs) ? m.prefillTimeMs : null, at:r.finishedAt || r.timestamp, tps:m.tokensPerSec,
        generationTPS:Number.isFinite(m.generationTokensPerSec) ? m.generationTokensPerSec : null,
        ttft:Number.isFinite(m.ttft) && r.runner === 'Ollama' ? m.ttft : null,
        rss:r.memory?.source === 'process-tree-rss' ? r.memory.peak : null });
    });
  });
  function summarize(values) {
    values = values.filter(Number.isFinite).sort((a,b) => a-b);
    if (!values.length) return { count:0,mean:null,median:null,std:null };
    var mean = values.reduce((a,b) => a+b,0)/values.length, middle = Math.floor(values.length/2);
    return { count:values.length,mean:mean,median:values.length%2 ? values[middle] : (values[middle-1]+values[middle])/2,
      std:values.length>1 ? Math.sqrt(values.reduce((s,v)=>s+(v-mean)**2,0)/(values.length-1)) : null };
  }
  return Array.from(groups.values()).map(function(g) {
    g.points.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
    g.summary = {};
    ['tps','generationTPS','ttft','rss','prefill'].forEach(k => { g.summary[k] = summarize(g.points.map(p=>p[k])); });
    g.normalizedTPS = g.paramsB ? g.summary.tps.mean / g.paramsB : null;
    return g;
  });
}
var statisticsSelection = { excludedModels:new Set(),excludedPasses:new Set(),excludedCategories:new Set(),open:new Set() };
var STATISTICS_UNITS = {tps:'tok/s · durée totale',generationTPS:'tok/s · génération',ttft:'ms · TTFT',rss:'MiB · RSS pic',prefill:'ms · prefill'};
function statisticsSummary(values) {
  values=values.filter(v=>Number.isFinite(v) && v>=0).sort((a,b)=>a-b);
  if(!values.length)return {count:0,mean:null,median:null,std:null};
  var mean=values.reduce((a,b)=>a+b,0)/values.length,middle=Math.floor(values.length/2);
  return {count:values.length,mean,median:values.length%2?values[middle]:(values[middle-1]+values[middle])/2,
    std:values.length>1?Math.sqrt(values.reduce((s,v)=>s+(v-mean)**2,0)/(values.length-1)):null};
}
function selectedStatisticsModels(groups,selection) {
  var models=new Map();
  groups.forEach(g=>{
    if(selection.excludedModels.has(g.model))return;
    if(!models.has(g.model))models.set(g.model,{model:g.model,groups:[],points:[]});
    var points=g.points.filter(p=>!selection.excludedPasses.has(p.id) && !selection.excludedCategories.has(p.category));
    models.get(g.model).groups.push({...g,selectedPoints:points});
    models.get(g.model).points.push(...points.map(p=>({...p,conditions:g.key})));
  });
  return Array.from(models.values()).map(m=>{m.points.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||String(a.id).localeCompare(String(b.id)));return m;});
}
function statisticsRolling(points,metric,windowSize) {
  // Missing readings create gaps; never fill them with zero or bridge missing measurements.
  return points.map((p,i)=>({at:p.at,label:p.at,value:Number.isFinite(p[metric])?
    statisticsSummary(points.slice(Math.max(0,i-windowSize+1),i+1).map(v=>v[metric])).mean:null}));
}
function statisticsElement(tag,text,parent) {
  var el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(parent)parent.appendChild(el);return el;
}
function statisticsDetails(parent,key,title) {
  var details=statisticsElement('details',undefined,parent);details.style.margin='16px 0';details.open=statisticsSelection.open.has(key);
  statisticsElement('summary',title,details).style.cursor='pointer';
  details.addEventListener('toggle',()=>{if(details.open)statisticsSelection.open.add(key);else statisticsSelection.open.delete(key);});return details;
}
function statisticsCheckbox(parent,label,checked,onChange) {
  var wrap=statisticsElement('label',undefined,parent);wrap.style.cssText='display:inline-flex;gap:6px;align-items:center;margin:4px 12px 4px 0;';
  var box=statisticsElement('input',undefined,wrap);box.type='checkbox';box.checked=checked;box.addEventListener('change',()=>onChange(box.checked));
  statisticsElement('span',label,wrap);return box;
}
function statisticsTable(parent,headers,rows) {
  var wrapper=statisticsElement('div',undefined,parent);wrapper.style.overflowX='auto';
  var table=statisticsElement('table',undefined,wrapper);table.className='history-table';
  var head=statisticsElement('tr',undefined,table);headers.forEach(h=>statisticsElement('th',h,head));
  rows.forEach(row=>{var tr=statisticsElement('tr',undefined,table);row.forEach(v=>statisticsElement('td',v,tr));});return table;
}
function drawStatisticsChart(parent,series,labels,unit,type,title) {
  statisticsElement('p',title,parent);
  var canvas=statisticsElement('canvas',undefined,parent);canvas.width=900;canvas.height=280;canvas.style.cssText='width:100%;height:auto;display:block;';
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label',title+' ; valeurs détaillées dans le tableau suivant.');
  var colors=['#58a6ff','#3fb950','#ffa657','#d2a8ff','#ff7b72','#79c0ff','#f2cc60'];
  var values=series.flatMap(s=>s.values.filter(Number.isFinite));
  var ctx=canvas.getContext('2d');
  if(ctx && values.length){
    var high=Math.max(...values,1)*1.1,left=70,right=870,top=25,bottom=210;
    var x=i=>labels.length>1?left+i/(labels.length-1)*(right-left):(left+right)/2;
    var y=v=>bottom-v/high*(bottom-top);
    ctx.font='12px sans-serif';ctx.fillStyle='#c9d1d9';
    for(var tick=0;tick<=4;tick++){
      var value=high*tick/4,yy=y(value);ctx.strokeStyle='#30363d';ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(right,yy);ctx.stroke();ctx.fillText(value.toFixed(1),4,yy+4);
    }
    ctx.fillText(unit,left,14);
    labels.forEach((label,i)=>{if(labels.length<=8 || i===0 || i===labels.length-1){ctx.save();ctx.translate(x(i),230);ctx.rotate(-0.2);ctx.fillText(String(label).slice(0,24),-20,0);ctx.restore();}});
    series.forEach((s,index)=>{
      var color=colors[index%colors.length],segments=[],segment=[];
      s.values.forEach((v,i)=>{if(Number.isFinite(v)){segment.push([x(i),y(v),i]);}else if(segment.length){segments.push(segment);segment=[];}});if(segment.length)segments.push(segment);
      segments.forEach(points=>{
        if(type==='area' && points.length>1){ctx.beginPath();ctx.moveTo(points[0][0],bottom);points.forEach(p=>ctx.lineTo(p[0],p[1]));ctx.lineTo(points.at(-1)[0],bottom);ctx.closePath();ctx.fillStyle=color+'25';ctx.fill();}
        ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=2;points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke();
        ctx.fillStyle=color;points.forEach(p=>{ctx.beginPath();ctx.arc(p[0],p[1],4,0,Math.PI*2);ctx.fill();});
      });
    });
  }
  var legend=statisticsElement('div',undefined,parent);
  series.forEach((s,i)=>{var item=statisticsElement('span','● '+s.name,legend);item.style.cssText='margin-right:16px;color:'+colors[i%colors.length];});
  if(!values.length)statisticsElement('p','Aucune mesure disponible pour cette sélection.',parent);
  var data=statisticsDetails(parent,'values:'+title,'Valeurs du graphique');
  statisticsTable(data,['Axe',...series.map(s=>s.name+' · '+unit)],labels.map((l,i)=>[l,...series.map(s=>Number.isFinite(s.values[i])?s.values[i].toFixed(2):'—')]));
}
function statisticsConditions(g) {
  return g.runner+' · '+g.type+' · '+g.quantization+' · '+g.hardware+' · '+g.prompt+' · temp. '+(g.temperature??'?')+
    ' · max '+(g.maxTokens??'?')+' · contexte '+(g.context??'?')+' · chargement '+g.load+' · cache '+g.cache+' · runner v'+g.runnerVersion+' · protocole '+g.protocolVersion+' · thinking demandé '+(g.thinkingEnabled??'?')+' / observé '+(g.thinkingObserved??'?');
}
function renderStatistics() {
  var panel=document.getElementById('statisticsContent');if(!panel)return;
  var history;try{history=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');}catch(_){history=[];}
  var groups=buildStatistics(history),selection=statisticsSelection;
  var metric=document.getElementById('statisticsMetric')?.value||'tps',unit=STATISTICS_UNITS[metric];
  var type=document.getElementById('statisticsChartType')?.value||'line',aggregate=document.getElementById('statisticsAggregate')?.value||'mean';
  var windowSize=Number(document.getElementById('statisticsWindow')?.value)||1;
  panel.textContent='';
  if(!groups.length){statisticsElement('p','Aucune mesure exploitable dans l’historique. Lancez une campagne.',panel);return;}
  statisticsElement('p','Chaque passe sélectionnée a le même poids dans la moyenne. Les comparaisons globales sont descriptives : catégories, cache, versions, matériel et longueurs des réponses peuvent différer. Les conditions comparables restent détaillées séparément. Avec N = 1, aucune dispersion ne peut être estimée.',panel);
  var controls=statisticsElement('div',undefined,panel);statisticsElement('strong','Modèles à afficher',controls);
  Array.from(new Set(groups.map(g=>g.model))).forEach(model=>statisticsCheckbox(controls,model,!selection.excludedModels.has(model),checked=>{
    checked?selection.excludedModels.delete(model):selection.excludedModels.add(model);renderStatistics();
  }));
  var categories=Array.from(new Set(groups.flatMap(g=>g.points.map(p=>p.category)))).sort();
  var filters=statisticsElement('div',undefined,panel);statisticsElement('strong','Catégories',filters);
  categories.forEach(category=>statisticsCheckbox(filters,category,!selection.excludedCategories.has(category),checked=>{
    checked?selection.excludedCategories.delete(category):selection.excludedCategories.add(category);renderStatistics();
  }));
  var reset=statisticsElement('button','Tout sélectionner',panel);reset.className='btn btn-ghost btn-sm';reset.addEventListener('click',()=>{
    selection.excludedModels.clear();selection.excludedCategories.clear();selection.excludedPasses.clear();renderStatistics();
  });
  var models=selectedStatisticsModels(groups,selection),visibleCategories=categories.filter(c=>!selection.excludedCategories.has(c));
  if(!models.length){statisticsElement('p','Sélectionnez au moins un modèle.',panel);return;}
  drawStatisticsChart(panel,models.map(m=>({name:m.model,values:visibleCategories.map(c=>statisticsSummary(m.points.filter(p=>p.category===c).map(p=>p[metric]))[aggregate])})),
    visibleCategories,unit,type,(aggregate==='mean'?'Moyenne':'Médiane')+' par modèle et catégorie · '+unit);
  var format=v=>Number.isFinite(v)?v.toFixed(2):'—';
  models.forEach(model=>{
    var summary=statisticsSummary(model.points.map(p=>p[metric]));
    var detail=statisticsDetails(panel,'model:'+model.model,model.model+' · '+model.points.length+' passe(s) sélectionnée(s) · '+(aggregate==='mean'?'moyenne ':'médiane ')+format(summary[aggregate])+' '+unit);
    var sizes=Array.from(new Set(model.groups.map(g=>g.paramsB).filter(Number.isFinite))), paramsB=sizes.length===1?sizes[0]:null;
    var meanTPS=statisticsSummary(model.points.map(p=>p.tps)).mean;
    statisticsTable(detail,['Mesures disponibles','Moyenne','Médiane','Écart-type','Paramètres totaux (Md)','Tok/s moyen / Md total'],[[summary.count,format(summary.mean),format(summary.median),format(summary.std),format(paramsB),format(paramsB && Number.isFinite(meanTPS)?meanTPS/paramsB:null)]]);
    var all=model.groups.flatMap(g=>g.points);
    var buttons=statisticsElement('div',undefined,detail);
    ['Sélectionner toutes les passes','Désélectionner toutes les passes'].forEach((label,i)=>{
      var button=statisticsElement('button',label,buttons);button.className='btn btn-ghost btn-sm';button.addEventListener('click',()=>{
        all.forEach(p=>i?selection.excludedPasses.add(p.id):selection.excludedPasses.delete(p.id));renderStatistics();
      });
    });
    var chart=statisticsDetails(detail,'trend:'+model.model,'Graphiques du modèle · vitesse et prefill · lissage '+windowSize+' passe(s)');
    var labels=model.points.map((p,i)=>'P'+(i+1)+' · '+new Date(p.at).toLocaleTimeString('fr-FR'));
    statisticsElement('p','Ordre chronologique des passes sélectionnées. Le prefill est une durée en millisecondes ; il a son propre graphique. Le lissage calcule une moyenne mobile sur les valeurs disponibles et ne change pas les moyennes récapitulatives.',chart);
    ['tps','generationTPS','prefill'].forEach(k=>drawStatisticsChart(chart,[{name:model.model,values:statisticsRolling(model.points,k,windowSize).map(p=>p.value)}],labels,
      STATISTICS_UNITS[k],type,model.model+' · '+STATISTICS_UNITS[k]));
    model.groups.forEach(g=>{
      var stats=statisticsSummary(g.selectedPoints.map(p=>p[metric]));
      var condition=statisticsDetails(detail,'condition:'+g.key,statisticsConditions(g)+' · N='+stats.count+' · '+format(stats[aggregate])+' '+unit);
      statisticsCheckbox(condition,'Inclure toutes les passes de ces conditions',g.points.every(p=>!selection.excludedPasses.has(p.id)),checked=>{
        g.points.forEach(p=>checked?selection.excludedPasses.delete(p.id):selection.excludedPasses.add(p.id));renderStatistics();
      });
      statisticsElement('p','Moyenne : '+format(stats.mean)+' · médiane : '+format(stats.median)+' · écart-type : '+format(stats.std)+' '+unit,condition);
      var wrapper=statisticsElement('div',undefined,condition);wrapper.style.overflowX='auto';
      var table=statisticsElement('table',undefined,wrapper);table.className='history-table';var head=statisticsElement('tr',undefined,table);
      ['Inclure','Passe / répétition','Date','Débit moyen (tok/s)','Génération (tok/s)','Prefill (ms)','TTFT (ms)','RSS pic (MiB)'].forEach(h=>statisticsElement('th',h,head));
      g.points.forEach(p=>{
        var row=statisticsElement('tr',undefined,table),cell=statisticsElement('td',undefined,row);
        statisticsCheckbox(cell,'Inclure cette passe',!selection.excludedPasses.has(p.id),checked=>{
          checked?selection.excludedPasses.delete(p.id):selection.excludedPasses.add(p.id);renderStatistics();
        });
        [p.id.slice(0,8)+' · rép. '+p.rep,new Date(p.at).toLocaleString('fr-FR'),format(p.tps),format(p.generationTPS),format(p.prefill),format(p.ttft),format(p.rss)].forEach(v=>statisticsElement('td',v,row));
      });
    });
  });
}
