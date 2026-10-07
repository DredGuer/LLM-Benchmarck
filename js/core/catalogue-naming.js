// Convention 0.1. Labels are hints, never replacements for exact IDs or sources.
var CatalogueNaming = (function() {
  function clean(value) { return typeof value === 'string' ? value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9.]+/g,'_').replace(/^_+|_+$/g,'') : ''; }
  function number(value) { return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null; }
  function size(bytes) { var n = number(bytes); return n === null ? null : String(+(n / 1073741824).toFixed(2)) + 'Go'; }
  function model(id, metadata) {
    var m=metadata||{}, original=typeof id==='string'?id:'unknown', parts=original.replace(/^hf\.co\//i,'').split('/');
    var leaf=parts[parts.length-1].split(':')[0], source=null;
    if (/^hf\.co\/[\w.-]+\/[\w.-]+(?::[\w.-]+)?$/i.test(original)) source=original.slice(6).split(':')[0];
    var match=leaf.match(/^(qwen\d+(?:\.\d+)?|gemma\d+(?:\.\d+)?|mistral|nemotron\d*(?:\.\d+)?|minimax\d*(?:\.\d+)?|ornith(?:-\d+(?:\.\d+)?)?)/i);
    var family=clean(m.baseName)|| (match?match[1].replace(/^qwen/i,'Qwen').replace(/^gemma/i,'Gemma').replace(/^mistral/i,'Mistral').replace(/^nemotron/i,'Nemotron').replace(/^minimax/i,'Minimax').replace(/^ornith/i,'Ornith'):clean(leaf)) || 'ModeleInconnu';
    family=family.replace(/^qwen/i,'Qwen').replace(/^gemma/i,'Gemma').replace(/^mistral/i,'Mistral').replace(/^nemotron/i,'Nemotron').replace(/^minimax/i,'Minimax').replace(/^ornith/i,'Ornith').replace(/[_-]?flash[_-]?next/i,'FlashNext');
    if (/flash[-_]?next/i.test(leaf) && !/flash/i.test(family)) family+='FlashNext';
    // Size comes from declared metadata, never from the download tag or active MoE count.
    var declared=typeof m.parameterSize==='string'&&/^\d+(?:\.\d+)?B$/i.test(m.parameterSize.trim())?m.parameterSize.trim().toUpperCase():null;
    var count=number(m.parameterCount), parameterSize=(m.type==='moe'&&count?String(+(count/1e9).toFixed(3))+'B':declared)||(count?String(+(count/1e9).toFixed(3))+'B':'TailleInconnue');
    var format=typeof m.format==='string'&&/^gguf$/i.test(m.format)?'GGUF':typeof m.format==='string'&&/^mlx$/i.test(m.format)?'MLX':/(?:^|[-_:])mlx(?:$|[-_:])/i.test(leaf+':'+original.split(':').slice(1).join(':'))?'MLX':/(?:^|[-_:])gguf(?:$|[-_:])/i.test(leaf)?'GGUF':null;
    var quant=clean(m.quantization).toUpperCase()||null;
    var principal=family+'_'+parameterSize, variant=clean(m.variant)||null;
    // A repository-derived/fine-tuned identity must not collapse into its commercial family.
    if (source) variant=clean(source);
    else if (/^[\w.-]+\/[\w.-]+(?::[\w.-]+)?$/.test(original)) variant=clean(original.split(':')[0]);
    else if (match) {
      var remainder=leaf.slice(match[0].length).replace(/^[\W_]+/,'').replace(/^flash[-_]?next(?:[-_]|$)/i,'').replace(/^\d+(?:\.\d+)?b(?:[-_]?a\d+(?:\.\d+)?b)?(?:[-_]|$)/i,'');
      if(remainder && !/^(?:mlx|gguf|flash[-_]?next)$/i.test(remainder) && clean(remainder).toUpperCase()!==quant)variant=clean(remainder);
    } else if (m.baseName && clean(leaf).toLowerCase()!==clean(m.baseName).toLowerCase()) variant=clean(leaf);

    var executed=[principal,format,quant,variant].filter(Boolean).join('_');
    return {conventionVersion:'0.1',algorithmVersion:'1.0.0',originalName:original,principalName:principal,normalizedName:executed,matchKey:executed.toLowerCase(),format:format,quantization:quant,sourceRepository:source,sourceRevision:typeof m.sourceRevision==='string'&&/^[a-f0-9]{7,64}$/i.test(m.sourceRevision)?m.sourceRevision:null,provisional:parameterSize==='TailleInconnue'||format===null||quant===null};
  }
  function hardware(machine, provider) {
    var n=machine||{}, cpus=n.cpus||[], gpus=n.gpus||[], original=(cpus.map(c=>c.model).filter(Boolean).join(' / ')||'Matériel d’inférence inconnu')+(size(n.memory?.physicalCapacity?.value)?' · '+size(n.memory.physicalCapacity.value).replace('Go',' Gio'):'')+' ('+(n.platform||'unknown')+')';
    var name,category='Autres / Multi-GPU', capacity=size(n.memory?.physicalCapacity?.value), cpu=cpus[0]||{};
    if(provider){category='Cloud';name='Cloud_'+clean(provider);}
    else if(n.platform==='apple-silicon') {category='Apple';var chip=clean(cpu.model).replace(/^Apple_/, '').replace(/_/g,'');name=['Apple',chip||'PuceInconnue',capacity].filter(Boolean).join('_');if(number(cpu.physicalCores))name+='_'+cpu.physicalCores+'CPU';if(gpus.length===1&&number(gpus[0].computeUnits))name+='_'+gpus[0].computeUnits+'GPU';}
    else if(gpus.length){var cards=gpus.map(g=>[clean(g.model).replace(/^(?:NVIDIA_|AMD_)?(?:GeForce_|Radeon_)?/i,'').replace(/^(RTX|GTX|RX)_?(\d+)_?(XT|Ti)?$/i,(_,prefix,n,suffix)=>prefix.toUpperCase()+n+(suffix?suffix.toUpperCase():''))||'GPUInconnu',size(g.capacity?.value)].filter(Boolean).join('_'));category=gpus.length>1?'Autres / Multi-GPU':/^(?:H100|H200|A100|B200|MI\d+)/i.test(cards[0])?'Pro':'Mono GPU';if(gpus.length>1&&cards.every(c=>c===cards[0])&&gpus.every(g=>size(g.capacity?.value)))name='MultiGPU_'+gpus.length+'x'+cards[0]+'Chacune';else name=(gpus.length>1?'MultiGPU_':'')+cards.join('_');}
    else name=['CPU',clean(cpu.model)||'MaterielInconnu',capacity].filter(Boolean).join('_');
    return {conventionVersion:'0.1',algorithmVersion:'1.0.0',originalName:original,normalizedName:name,matchKey:name.toLowerCase(),category:category,provisional:!provider&&(n.platform==='unknown'||n.platform==='apple-silicon'||(!gpus.length&&!cpu.model)|| (gpus.length?gpus.some(g=>!g.model||!size(g.capacity?.value)):!capacity))};
  }
  return {model:model,hardware:hardware};
})();
