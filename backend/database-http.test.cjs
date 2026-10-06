const assert=require('node:assert/strict'),express=require('express'),fs=require('node:fs'),path=require('node:path');
const {openStore,mountDatabaseRoutes}=require('./database');
(async()=>{const dir=fs.mkdtempSync(path.join(process.cwd(),'db-http-test-')),store=openStore(dir),app=express();mountDatabaseRoutes(app,{store});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port+'/api/database';
 async function request(p,method='GET',body,origin='http://localhost:8001'){const r=await fetch(base+p,{method,headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
 try{
 assert.equal((await request('/status')).status,200);assert.equal((await request('/status','GET',null,'https://evil.example')).status,403);
 const s={id:'c1',model:'test',runner:'ollama',results:[{id:'r1',model:'test',metrics:{tokensPerSec:1}}]};assert.equal((await request('/sessions','POST',s)).status,200);
 assert.equal((await request('/sessions/c1','PATCH',{name:'Renamed'})).data.item.metadata.name,'Renamed');assert.equal((await request('/sessions/c1','PATCH',{results:[]})).status,400);
 assert.equal((await request('/sessions','POST',{...s,results:[]})).status,409);assert.equal((await request('/sessions/c1','DELETE')).status,200);assert.equal((await request('/sessions')).data.items.length,0);assert.equal((await request('/sessions?trash=1')).data.items.length,1);
 assert.equal((await request('/sessions/c1/restore','POST',{})).status,200);await request('/sessions/c1','DELETE');assert.equal((await request('/sessions/c1?permanent=1','DELETE',{})).status,400);assert.equal((await request('/sessions/c1?permanent=1','DELETE',{confirm:'c1'})).status,200);
 assert.equal((await request('/import','POST',{format:'llmb-local-backup',version:9})).status,400);
 console.log('PASS: real HTTP SQLite CRUD, local-origin guards, immutable results, trash/restore/delete confirmation, backup version rejection');
 }finally{await new Promise(r=>server.close(r));store.close();fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
