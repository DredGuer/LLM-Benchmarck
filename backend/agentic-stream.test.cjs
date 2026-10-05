const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const scope={TextDecoder};vm.createContext(scope);vm.runInContext(fs.readFileSync('js/core/agentic-stream.js','utf8'),scope);
function response(text,step=7){const bytes=new TextEncoder().encode(text);let at=0;return {ok:true,body:new ReadableStream({pull(c){if(at>=bytes.length){c.close();return;}c.enqueue(bytes.slice(at,at+=step));}})};}
(async()=>{
 let events=[];const native=[{message:{role:'assistant',thinking:'Je prépare une lecture é'}},{message:{tool_calls:[{function:{index:0,name:'read_file',arguments:{path:'inputs/stock.json'}}}]}},{message:{tool_calls:[{function:{index:0,name:'read_file',arguments:{path:'inputs/stock.json'}}}]}},{done:true,eval_count:12,eval_duration:1000000,prompt_eval_duration:2000000,done_reason:'stop'}].map(JSON.stringify).join('\n');
 let out=await scope.consumeAgenticChat(response(native),'ollama',new AbortController().signal,(...e)=>events.push(e));assert.equal(out.message.tool_calls.length,1);assert.equal(out.message.thinking,'Je prépare une lecture é');assert.equal(out.usage.outputTokens,12);assert.equal(out.timing.prefillMs,2);assert(events.some(e=>e[0]==='thinking'));
 const frames=[{choices:[{delta:{reasoning:'Observation',tool_calls:[{index:0,id:'call-1',function:{name:'read_',arguments:'{"path":'}}]}}]},{choices:[{delta:{tool_calls:[{index:0,function:{name:'file',arguments:'"inputs/stock.json"}'}}]},finish_reason:'tool_calls'}]},{choices:[],usage:{completion_tokens:13,prompt_tokens:30}}];
 const compatible=frames.map(f=>'data: '+JSON.stringify(f)+'\r\n\r\n').join('')+'data: [DONE]\r\n\r\n';
 out=await scope.consumeAgenticChat(response(compatible,1),'lmstudio',new AbortController().signal,()=>{});assert.equal(out.message.tool_calls[0].function.name,'read_file');assert.equal(out.message.tool_calls[0].id,'call-1');assert.equal(JSON.parse(out.message.tool_calls[0].function.arguments).path,'inputs/stock.json');assert.equal(out.message.reasoning,'Observation');assert.equal(out.usage.outputTokens,13);
 await assert.rejects(scope.consumeAgenticChat(response('{"message":{"content":"partial"}}\n'),'ollama',new AbortController().signal,()=>{}),/incomplet/);
 await assert.rejects(scope.consumeAgenticChat(response('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'),'lmstudio',new AbortController().signal,()=>{}),/incomplet/);
 await assert.rejects(scope.consumeAgenticChat(response('{"error":"private"}\n'),'ollama',new AbortController().signal,()=>{}),/Erreur/);
 const aborted=new AbortController();aborted.abort();await assert.rejects(scope.consumeAgenticChat(response(native),'ollama',aborted.signal,()=>{}),/annulé/);
 console.log('PASS: fragmented NDJSON/SSE and UTF-8, thinking preservation, indexed tool assembly, usage, incomplete/error streams and cancellation');
})().catch(e=>{console.error(e);process.exitCode=1;});
