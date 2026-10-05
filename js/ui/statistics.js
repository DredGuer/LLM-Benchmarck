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
      if (r.error || r.phase === 'warmup' || seen.has(r.id)) return;
      if (r.id) seen.add(r.id);
      var m = r.metrics || {}, p = r.protocol || {}, meta = r.modelMetadata || {};
      if (!Number.isFinite(m.tokensPerSec) || m.tokensPerSec < 0) return;
      var key = JSON.stringify([r.model, r.memory?.loadedModel?.digest, r.runner, statisticsHardware(r.env),
        meta.quantization, meta.type, m.contextObservedTokens, r.promptType,
        p.promptDigest || r.promptText || r.id, m.temperature, m.maxTokens,
        p.version || 'legacy', p.loadState || 'unknown', p.cacheState || 'unknown']);
      if (!groups.has(key)) groups.set(key, { model:r.model, runner:r.runner, type:meta.type || 'unknown',
        context:m.contextObservedTokens ?? null, prompt:r.promptTypeName || r.promptType, load:p.loadState || 'unknown',
        cache:p.cacheState || 'unknown', paramsB:Number.isFinite(meta.parameterCount) && meta.parameterCount > 0 ? meta.parameterCount / 1e9 : null,
        hardware:(r.env?.chip || 'CPU ?')+' / '+(r.env?.ram || 'RAM ?'), temperature:m.temperature, maxTokens:m.maxTokens,
        quantization:meta.quantization || 'unknown', points:[] });
      groups.get(key).points.push({ at:r.finishedAt || r.timestamp, tps:m.tokensPerSec,
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
    ['tps','generationTPS','ttft','rss'].forEach(k => { g.summary[k] = summarize(g.points.map(p=>p[k])); });
    g.normalizedTPS = g.paramsB ? g.summary.tps.mean / g.paramsB : null;
    return g;
  });
}
function renderStatistics() {
  var panel = document.getElementById('statisticsContent');
  if (!panel) return;
  var history;
  try { history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch (_) { history = []; }
  var groups = buildStatistics(history), metric = document.getElementById('statisticsMetric')?.value || 'tps';
  var unit = {tps:'tok/s moyen',generationTPS:'tok/s génération',ttft:'ms TTFT',rss:'MiB RSS pic'}[metric];
  panel.textContent = '';
  if (!groups.length) { panel.textContent = 'Lancez une campagne pour afficher les statistiques de votre historique.'; return; }
  var maximum = Math.max(...groups.map(g=>g.summary[metric].mean || 0),1);
  var table = document.createElement('table'); table.className = 'history-table';
  var header = document.createElement('tr');
  ['Modèle / conditions','N','Moyenne','Médiane','Écart-type','Paramètres (Md)','Tok/s moyen / Md total'].forEach(label => {
    var cell = document.createElement('th'); cell.textContent = label; header.appendChild(cell);
  }); table.appendChild(header);
  groups.forEach(function(g,index) {
    var summary=g.summary[metric], label=g.model+' · '+g.runner+' · '+g.type+' · '+g.quantization+
      ' · '+g.hardware+' · température '+(g.temperature ?? '?')+' · max '+(g.maxTokens ?? '?')+' · contexte '+(g.context ?? '?')+' · '+g.prompt+' · chargé '+g.load+' · cache '+g.cache;
    var row = document.createElement('tr');
    var display=v=>v===null ? '—' : v.toFixed(2);
    [label,summary.count,display(summary.mean),display(summary.median),display(summary.std),display(g.paramsB),display(g.normalizedTPS)].forEach(value=>{
      var cell=document.createElement('td'); cell.textContent=value; row.appendChild(cell);
    }); table.appendChild(row);
    var chart=document.createElement('div'); chart.style.margin='16px 0';
    var title=document.createElement('small'); title.textContent=label; chart.appendChild(title);
    var bar=document.createElement('div'); bar.style.cssText='background:var(--accent2);color:var(--bg);padding:8px;min-width:80px;border-radius:6px;box-sizing:border-box;';
    bar.style.width=Math.max(5,(summary.mean || 0)/maximum*100)+'%'; bar.textContent=display(summary.mean)+' '+unit; chart.appendChild(bar);
    var details=document.createElement('details'), toggle=document.createElement('summary');
    toggle.textContent='Tendance chronologique · '+g.points.length+' mesure(s)'; details.appendChild(toggle);
    var canvas=document.createElement('canvas'); canvas.width=720; canvas.height=200; canvas.style.width='100%';
    canvas.setAttribute('role','img'); canvas.setAttribute('aria-label','Tendance '+label); details.appendChild(canvas);
    var ctx=canvas.getContext('2d');
    var points=g.points.filter(p=>Number.isFinite(p[metric]));
    if (ctx && points.length) {
      var high=Math.max(...points.map(p=>p[metric]),1), low=Math.min(...points.map(p=>Date.parse(p.at))), end=Math.max(...points.map(p=>Date.parse(p.at)));
      ctx.strokeStyle='#58a6ff'; ctx.lineWidth=2; ctx.beginPath();
      points.forEach((p,i)=>{var x=end>low ? 30+(Date.parse(p.at)-low)/(end-low)*660 : 360, y=160-p[metric]/high*130;
        if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();
      ctx.fillStyle='#c9d1d9';ctx.font='12px sans-serif';ctx.fillText(high.toFixed(1)+' '+unit,10,15);
      ctx.fillText(new Date(points[0].at).toLocaleString('fr-FR'),30,190);
      if(points.length>1)ctx.fillText(new Date(points[points.length-1].at).toLocaleString('fr-FR'),480,190);
      points.forEach(p=>{var x=end>low ? 30+(Date.parse(p.at)-low)/(end-low)*660 : 360,y=160-p[metric]/high*130;
        ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();});
    }
    var values=document.createElement('p');
    values.textContent=points.map(p=>new Date(p.at).toLocaleString('fr-FR')+' : '+p[metric].toFixed(2)+' '+unit).join(' ; ');
    details.appendChild(values); chart.appendChild(details); panel.appendChild(chart);
  });
  var wrapper=document.createElement('div');wrapper.style.overflowX='auto';wrapper.appendChild(table);panel.appendChild(wrapper);
}
