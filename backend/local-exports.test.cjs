const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path'), crypto = require('node:crypto');
const { createExportStore, modelFolder, localOrigin, mountExportRoutes } = require('./local-exports');
const { validateReport } = require('../schemas/validate.cjs');
(async () => {
  const parent = await fs.mkdtemp(path.join(process.cwd(), 'exports-test-'));
  try {
    const launches = [], store = createExportStore({ parent, platform: 'darwin', launch: (cmd,args,options,cb) => { launches.push([cmd,args]); cb(null); } });
    const report = JSON.parse(await fs.readFile(path.join(__dirname, '../schemas/examples/apple-generation.json'), 'utf8'));
    const model = report.tests[0].model.id; report.tests.forEach(t => t.model.id = model);
    const payload = { model, batchId: crypto.randomUUID(), position: 1, report, markdown: '# Report\nPRIVATE_CONTENT' };
    const saved = await store.save(payload); assert(saved.folder.startsWith('export/')); assert.equal(saved.files.length,2);
    const dir = path.join(parent, saved.folder); const json = JSON.parse(await fs.readFile(path.join(dir,saved.files[0]),'utf8')); validateReport(json);
    assert.equal(await fs.readFile(path.join(dir,saved.files[1]),'utf8'),payload.markdown);
    assert.deepEqual(await store.save(payload),saved);
    await assert.rejects(store.save({...payload,markdown:'different'}));
    await assert.rejects(store.save({...payload,model:'../../outside'}));
    await assert.rejects(store.save({...payload,batchId:'../../outside'}));
    await assert.rejects(store.save({...payload,position:-1}));
    const bad=structuredClone(payload);bad.report.secret='SHOULD_NOT_BE_EXPORTED';await assert.rejects(store.save(bad));
    assert.notEqual(modelFolder('a:b'),modelFolder('a/b'));assert.notEqual(modelFolder('Qwen'),modelFolder('qwen'));
    const malicious='../../a/b:evil';assert(!/[\\/]/.test(modelFolder(malicious)));assert(!modelFolder(malicious).startsWith('.'));
    await store.open();assert.deepEqual(launches,[['open',[path.join(parent,'export')]]]);
    await fs.unlink(path.join(dir,saved.files[1]));await fs.symlink(path.join(dir,saved.files[0]),path.join(dir,saved.files[1]));await assert.rejects(store.save(payload));
    await fs.rm(path.join(parent,'export'),{recursive:true});await fs.mkdir(path.join(parent,'outside'));await fs.symlink(path.join(parent,'outside'),path.join(parent,'export'));await assert.rejects(store.ready());
    const req={socket:{remoteAddress:'127.0.0.1'},headers:{host:'localhost:3001',origin:'http://localhost:8001'}};assert(localOrigin(req));
    assert(!localOrigin({...req,headers:{...req.headers,origin:'https://evil.example'}}));assert(!localOrigin({...req,headers:{...req.headers,origin:'null'}}));assert(!localOrigin({...req,headers:{...req.headers,host:'rebind.example:3001'}}));assert(!localOrigin({...req,socket:{remoteAddress:'192.168.1.10'}}));assert(!localOrigin({...req,headers:{host:'localhost:3001'}}));
    // Exercise the actual route guards and handlers; parser alone is substituted.
    const routes=new Map(), Module=require('node:module'), originalLoad=Module._load;
    Module._load=function(name,...args){return name==='express'?{json:()=> (_req,_res,next)=>next()}:originalLoad.call(this,name,...args);};
    try{mountExportRoutes({get:(route,...handlers)=>routes.set('GET '+route,handlers),post:(route,...handlers)=>routes.set('POST '+route,handlers)},{parent:path.join(parent,'outside'),launch:(_c,_a,_o,cb)=>cb(null)});}finally{Module._load=originalLoad;}
    async function request(method,route,overrides={}){const req2={...req,method,body:payload,...overrides},response={code:200,status(n){this.code=n;return this;},set(){return this;},json(data){this.data=data;return this;}};
      for(const handler of routes.get(method+' '+route)){let next=false;await handler(req2,response,()=>{next=true;});if(!next)break;}return response;}
    assert.equal((await request('GET','/api/exports/session',{headers:{...req.headers,origin:'https://evil.example'}})).code,403);
    const session=await request('GET','/api/exports/session');assert.equal(session.code,200);assert.equal(session.data.token.length,64);
    assert.equal((await request('POST','/api/exports/save')).code,403);
    const headers={...req.headers,'x-llmb-export-token':session.data.token};
    assert.equal((await request('POST','/api/exports/save',{headers,body:payload})).code,200);
    assert.equal((await request('POST','/api/exports/open',{headers})).code,200);
    assert.equal((await request('POST','/api/exports/open',{headers:{...headers,origin:'https://evil.example'}})).code,403);
    assert.equal((await request('POST','/api/exports/save',{headers,body:{...payload,report:{}}})).code,400);
    console.log('PASS: sorted model exports, valid JSON, Markdown persistence, idempotent recovery, no overwrite/traversal/symlinks, exact folder opener and local-origin checks');
  } finally { await fs.rm(parent,{recursive:true,force:true}); }
})().catch(e=>{console.error(e);process.exitCode=1;});
