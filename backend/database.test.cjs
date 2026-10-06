const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {openStore}=require('./database');
const dir=fs.mkdtempSync(path.join(process.cwd(),'db-test-'));let db;
try{
 db=openStore(dir);const session={id:'campaign-1',model:'qwen:4b',runner:'ollama',savedAt:'2026-10-06T12:00:00Z',results:[{id:'pass-1',model:'qwen:4b',metrics:{tokensPerSec:40},provenance:{applicationVersion:'0.14.0'}}],apiKeys:{ollama:'SECRET'}};
 db.put('session',session);assert.equal(db.list('session').length,1);assert(!JSON.stringify(db.backup()).includes('SECRET'));
 db.put('session',{...session,results:[...session.results,{id:'pass-2',model:'qwen:4b',metrics:{tokensPerSec:42}}]});
 assert.throws(()=>db.put('session',{...session,results:[{...session.results[0],metrics:{tokensPerSec:999}}]}),/originales/);
 db.patch('session',session.id,{name:'Machine A',notes:'Test',tags:['mlx'],excludedResultIds:['pass-2']});assert.throws(()=>db.patch('session',session.id,{results:[]}),/annotations/);
 assert.equal(db.list('session')[0].results[0].metrics.tokensPerSec,40);
 const legacy={model:'gemma',runner:'mlx',results:[{model:'gemma',id:'legacy-pass'}]};
 assert.equal(db.migrate({sessions:[legacy],profiles:[]},true).inserted,1);assert.equal(db.migrate({sessions:[legacy],profiles:[]},true).inserted,0);
 const legacyId=db.list('session').find(s=>s.model==='gemma').id;db.remove('session',legacyId);db.remove('session',legacyId,true);db.migrate({sessions:[legacy],profiles:[]},true);assert.equal(db.list('session').length,1,'Legacy receipt prevents deleted results returning');
 assert.throws(()=>db.migrate({sessions:[{...legacy,model:'new'},{}],profiles:[]},true));assert.equal(db.list('session').length,1,'Atomic migration rollback');
 const profile={id:'profile-1',name:'Mes tests',settings:{version:'1.0.0',runner:'ollama',apiKey:'SECRET'}};db.put('profile',profile);db.put('profile',{...profile,name:'Nouveau nom'});assert.equal(db.list('profile')[0].name,'Nouveau nom');
 db.remove('session',session.id);assert.equal(db.list('session').length,0);assert.equal(db.list('session',true).length,1);db.restore('session',session.id);assert.throws(()=>db.remove('session',session.id,true),/corbeille/);
 const backup=db.backup();db.close();db=openStore(dir);assert.equal(db.list('session')[0].results.length,2,'Durable after reopen');
 const target=openStore(path.join(dir,'restore'));target.importBackup(backup);assert.equal(target.list('session')[0].metadata.name,'Machine A');assert.deepEqual(target.list('session')[0].metadata.excludedResultIds,['pass-2']);assert.equal(target.importBackup(backup).duplicates,2);target.close();
 db.remove('profile',profile.id);const deletedBackup=db.backup(),other=openStore(path.join(dir,'trash-restore'));other.importBackup(deletedBackup);assert.equal(other.list('profile').length,0);assert.equal(other.list('profile',true).length,1);other.close();
 console.log('PASS: real SQLite durability, immutable measurements, CRUD, trash, atomic/idempotent migration, backup restore, secret filtering');
}finally{db?.close();fs.rmSync(dir,{recursive:true,force:true});}
