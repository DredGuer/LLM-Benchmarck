// Native NDJSON / OpenAI-compatible SSE. Tools execute only after a complete model turn.
async function consumeAgenticChat(response,runner,signal,onEvent) {
  if(!response.ok)throw new Error('Le runner a refusé le chat agentique (HTTP '+response.status+'). Vérifiez modèle et template outils.');
  if(!response.body)throw new Error('Flux agentique absent.');
  var message={role:'assistant',content:''},calls=new Map(),anonymous=0,usage=null,timing={},finishReason=null,completed=false;
  function part(type,text){if(!text)return;message[type]=(message[type]||'')+text;onEvent(type==='content'?'content':'thinking',text);}
  function callDelta(delta,native){
    var key=delta.index??delta.function?.index;
    if(key===undefined)key=native?'anonymous-'+anonymous++:0;
    var call=calls.get(key);if(!call){call={type:'function',function:{name:'',arguments:native?{}:''}};calls.set(key,call);onEvent('tool-pending','Le modèle prépare un appel d’outil…');}
    if(delta.id)call.id=call.id?call.id+delta.id:delta.id;
    var fn=delta.function||{};
    if(fn.name){if(native)call.function.name=fn.name;else call.function.name+=fn.name;onEvent('tool-name',call.function.name);}
    if(fn.arguments!==undefined){
      if(native&&typeof fn.arguments==='object'&&fn.arguments!==null)call.function.arguments=Object.assign(typeof call.function.arguments==='object'?call.function.arguments:{},fn.arguments);
      else {if(typeof call.function.arguments!=='string')call.function.arguments='';call.function.arguments+=String(fn.arguments);}
      onEvent('tool-arguments',typeof call.function.arguments==='string'?call.function.arguments:JSON.stringify(call.function.arguments));
    }
  }
  function nativeFrame(frame){if(frame.error)throw new Error('Erreur du flux Ollama.');
    if(frame.message){part('thinking',frame.message.thinking);part('content',frame.message.content);(frame.message.tool_calls||[]).forEach(c=>callDelta(c,true));}
    if(frame.done===true){completed=true;usage={outputTokens:frame.eval_count,inputTokens:frame.prompt_eval_count};timing={generationMs:Number.isFinite(frame.eval_duration)?frame.eval_duration/1e6:null,prefillMs:Number.isFinite(frame.prompt_eval_duration)?frame.prompt_eval_duration/1e6:null};finishReason=frame.done_reason||null;}
  }
  function compatibleFrame(frame){if(frame.error)throw new Error('Erreur du flux compatible.');
    if(frame.usage)usage={outputTokens:frame.usage.completion_tokens,inputTokens:frame.usage.prompt_tokens};
    var choice=frame.choices?.[0];if(!choice)return;
    var delta=choice.delta||{};part('reasoning',delta.reasoning);part('reasoning_content',delta.reasoning_content);part('content',delta.content);
    (delta.tool_calls||[]).forEach(c=>callDelta(c,false));if(choice.finish_reason)finishReason=choice.finish_reason;
  }
  var reader=response.body.getReader(),decoder=new TextDecoder(),pending='',sse=[],bytes=0;
  function line(value){if(runner==='ollama'){if(value.trim())nativeFrame(JSON.parse(value));return;}
    if(!value){if(sse.length){var data=sse.join('\n');sse=[];if(data==='[DONE]')completed=true;else compatibleFrame(JSON.parse(data));}return;}
    if(value.startsWith('data:'))sse.push(value.slice(5).replace(/^ /,''));
  }
  try{while(true){if(signal?.aborted)throw new Error('Test agentique annulé.');var chunk=await reader.read();
    if(chunk.done){pending+=decoder.decode();if(pending)line(pending.replace(/\r$/,''));if(runner!=='ollama')line('');break;}
    bytes+=chunk.value.byteLength;if(bytes>4*1024*1024)throw new Error('Flux agentique trop volumineux.');
    pending+=decoder.decode(chunk.value,{stream:true});var lines=pending.split('\n');pending=lines.pop();lines.forEach(l=>line(l.replace(/\r$/,'')));
   }
   if(!completed||(runner!=='ollama'&&!finishReason))throw new Error('Flux agentique incomplet : fin de tour absente.');
   if(calls.size)message.tool_calls=Array.from(calls.values());
   return {message,usage,timing,finishReason};
  }finally{if(!completed&&reader.cancel){try{await reader.cancel();}catch(_){}}reader.releaseLock?.();}
}
