'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
function dataDirectory(){return process.env.LLMB_DATA_DIR || (process.platform==='darwin'?path.join(os.homedir(),'Library','Application Support','LLM-Benchmarker'):process.platform==='win32'?path.join(process.env.LOCALAPPDATA||os.homedir(),'LLM-Benchmarker'):path.join(process.env.XDG_DATA_HOME||path.join(os.homedir(),'.local','share'),'llm-benchmarker'));}
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
function plain(v){return v&&typeof v==='object'&&!Array.isArray(v);}
function text(v,max=256){if(typeof v!=='string'||v.length>max)fail('Texte invalide.');return v;}
function clean(value){if(!plain(value))fail('Objet invalide.');const out=JSON.parse(JSON.stringify(value));function walk(v){if(!v||typeof v!=='object')return;for(const k of Object.keys(v)){if(/^(api[_-]?keys?|authorization|password|access[_-]?token|refresh[_-]?token|secret)$/i.test(k))delete v[k];else walk(v[k]);}}walk(out);return out;}
function id(v){if(typeof v!=='string'||!/^[-a-zA-Z0-9_:.]{1,160}$/.test(v))fail('Identifiant invalide.');return v;}
function sessionData(v){v=clean(v);text(v.model);text(v.runner);if(!Array.isArray(v.results)||v.results.length>10000)fail('Résultats invalides.');for(const r of v.results){if(!plain(r)||typeof r.model!=='string')fail('Passe invalide.');}const ids=v.results.filter(r=>r.id).map(r=>r.id);if(new Set(ids).size!==ids.length)fail('Identifiants de passes dupliqués.');delete v.metadata;delete v.deletedAt;delete v.createdAt;delete v.updatedAt;return v;}
function profileData(v){v=clean(v);delete v.metadata;delete v.deletedAt;delete v.createdAt;delete v.updatedAt;text(v.name,80);if(!v.name.trim()||!plain(v.settings)||v.settings.version!=='1.0.0')fail('Profil invalide.');return v;}
function openStore(directory=dataDirectory()){
 fs.mkdirSync(directory,{recursive:true,mode:0o700});const filename=path.join(directory,'benchmarks.sqlite');const db=new DatabaseSync(filename);fs.chmodSync(filename,0o600);
 db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
 const version=db.prepare('PRAGMA user_version').get().user_version;if(version>1){db.close();fail('Base créée par une version plus récente.',409);}
 db.exec(`CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,metadata TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,deleted_at TEXT,PRIMARY KEY(kind,id));CREATE TABLE IF NOT EXISTS migrations(digest TEXT PRIMARY KEY); PRAGMA user_version=1;`);
 function tx(fn){db.exec('BEGIN IMMEDIATE');try{const v=fn();db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}}
 function row(kind,key){const r=db.prepare('SELECT * FROM records WHERE kind=? AND id=?').get(kind,id(key));if(!r)fail('Élément introuvable.',404);return r;}
 function unpack(r){return {...JSON.parse(r.payload),id:r.id,metadata:JSON.parse(r.metadata),createdAt:r.created_at,updatedAt:r.updated_at,deletedAt:r.deleted_at};}
 function list(kind,trash=false){return db.prepare(`SELECT * FROM records WHERE kind=? AND deleted_at IS ${trash?'NOT ':''}NULL ORDER BY created_at DESC,id`).all(kind).map(unpack);}
 function put(kind,v){v=kind==='session'?sessionData(v):profileData(v);const key=v.id?id(v.id):(kind==='session'?'session-'+crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex'):crypto.randomUUID());v.id=key;
 const old=db.prepare('SELECT * FROM records WHERE kind=? AND id=?').get(kind,key),now=new Date().toISOString();
 if(old){if(old.deleted_at)fail('Élément dans la corbeille : restaurez-le.',409);const previous=JSON.parse(old.payload);
 if(kind==='session'){if(previous.model!==v.model||previous.runner!==v.runner)fail('Identifiant de campagne déjà utilisé.',409);
 const oldResults=previous.results;const incoming=new Map(v.results.map((r,i)=>[r.id||'index-'+i,r]));for(let i=0;i<oldResults.length;i++){const r=oldResults[i],other=incoming.get(r.id||'index-'+i);if(!other||JSON.stringify(r)!==JSON.stringify(other))fail('Les mesures originales ne peuvent pas être modifiées.',409);}}
 db.prepare('UPDATE records SET payload=?,updated_at=? WHERE kind=? AND id=?').run(JSON.stringify(v),now,kind,key);
 }else{db.prepare('INSERT INTO records(kind,id,payload,created_at,updated_at) VALUES(?,?,?,?,?)').run(kind,key,JSON.stringify(v),v.savedAt||now,now);}
 return unpack(row(kind,key));}
 function patch(kind,key,m){if(!plain(m))fail('Annotations invalides.');const allowed=['name','notes','tags','excludedResultIds'];if(Object.keys(m).some(k=>!allowed.includes(k)))fail('Seules les annotations sont modifiables.');if(m.name!==undefined)text(m.name,80);if(m.notes!==undefined)text(m.notes,10000);for(const k of ['tags','excludedResultIds'])if(m[k]!==undefined){if(!Array.isArray(m[k])||m[k].length>10000)fail('Liste invalide.');m[k].forEach(x=>text(x,160));}
 const r=row(kind,key),metadata={...JSON.parse(r.metadata),...m};db.prepare('UPDATE records SET metadata=?,updated_at=? WHERE kind=? AND id=?').run(JSON.stringify(metadata),new Date().toISOString(),kind,key);return unpack(row(kind,key));}
 function remove(kind,key,permanent=false){const r=row(kind,key);if(permanent){if(!r.deleted_at)fail('Placez cet élément dans la corbeille avant suppression définitive.',409);db.prepare('DELETE FROM records WHERE kind=? AND id=?').run(kind,key);}else db.prepare('UPDATE records SET deleted_at=? WHERE kind=? AND id=?').run(new Date().toISOString(),kind,key);}
 function restore(kind,key){row(kind,key);db.prepare('UPDATE records SET deleted_at=NULL WHERE kind=? AND id=?').run(kind,key);return unpack(row(kind,key));}
 function migrate(body,remember=false){if(!plain(body)||!Array.isArray(body.sessions)||!Array.isArray(body.profiles)||body.sessions.length>10000||body.profiles.length>1000)fail('Migration invalide.');return tx(()=>{const digest=crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');if(remember&&db.prepare('SELECT digest FROM migrations WHERE digest=?').get(digest))return {inserted:0,duplicates:body.sessions.length+body.profiles.length};let inserted=0,duplicates=0;for(const [kind,values] of [['session',body.sessions],['profile',body.profiles]])for(let v of values){v=kind==='session'?sessionData(v):profileData(v);const key=v.id|| (kind==='session'?'session-'+crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex'):crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex'));v.id=key;
 const old=db.prepare('SELECT payload FROM records WHERE kind=? AND id=?').get(kind,key);if(old){if(JSON.stringify(JSON.parse(old.payload))!==JSON.stringify(v))fail('Conflit d’import : identifiant déjà présent avec des données différentes.',409);duplicates++;}else{put(kind,v);inserted++;}}if(remember)db.prepare('INSERT INTO migrations(digest) VALUES(?)').run(digest);return {inserted,duplicates};});}
 function importBackup(body){return tx(()=>{let inserted=0,duplicates=0;for(const [kind,values] of [['session',body.sessions],['profile',body.profiles]]){if(!Array.isArray(values)||values.length>10000)fail('Sauvegarde invalide.');for(const source of values){const v=kind==='session'?sessionData(source):profileData(source);if(!v.id)fail('Identifiant manquant.');const old=db.prepare('SELECT payload FROM records WHERE kind=? AND id=?').get(kind,id(v.id));if(old){if(JSON.stringify(JSON.parse(old.payload))!==JSON.stringify(v))fail('Conflit de sauvegarde.',409);duplicates++;continue;}put(kind,v);if(source.metadata)patch(kind,v.id,source.metadata);if(source.deletedAt)remove(kind,v.id);inserted++;}}if(body.migrationReceipts!==undefined){if(!Array.isArray(body.migrationReceipts)||body.migrationReceipts.length>10000||body.migrationReceipts.some(v=>typeof v!=='string'||!/^([a-f0-9]{64})$/.test(v)))fail('Reçus de migration invalides.');for(const digest of body.migrationReceipts)db.prepare('INSERT OR IGNORE INTO migrations(digest) VALUES(?)').run(digest);}return {inserted,duplicates};});}
 return {filename,list,put:(...args)=>tx(()=>put(...args)),patch:(...args)=>tx(()=>patch(...args)),remove:(...args)=>tx(()=>remove(...args)),restore:(...args)=>tx(()=>restore(...args)),migrate,importBackup,close:()=>db.close(),backup:()=>tx(()=>({format:'llmb-local-backup',version:1,createdAt:new Date().toISOString(),sessions:[...list('session'),...list('session',true)],profiles:[...list('profile'),...list('profile',true)],migrationReceipts:db.prepare('SELECT digest FROM migrations').all().map(r=>r.digest)})),tx};
}
function mountDatabaseRoutes(app,options={}){
 const express=require('express'),store=options.store||openStore();
 app.use('/api/database',(req,res,next)=>{const host=req.headers.host||'';const origin=req.headers.origin;const local=/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host);let trusted=!origin;try{const u=new URL(origin);trusted=['http:','https:'].includes(u.protocol)&&['localhost','127.0.0.1','[::1]'].includes(u.hostname);}catch{}if(!local||!trusted||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))return res.status(403).json({error:'Accès local uniquement.'});next();},express.json({limit:'32mb'}));
 const route=(method,url,fn)=>app[method]('/api/database'+url,(req,res)=>{try{res.json(fn(req));}catch(e){res.status(e.status||500).json({error:e.status?e.message:'Sauvegarde SQLite impossible : vérifiez le disque et les permissions.'});}});
 route('get','/status',()=>({success:true,schemaVersion:1,filename:store.filename}));
 for(const [kind,plural] of [['session','sessions'],['profile','profiles']]){
 route('get','/'+plural,r=>({items:store.list(kind,r.query.trash==='1')}));route('post','/'+plural,r=>({item:store.put(kind,r.body)}));
 route('patch','/'+plural+'/:id',r=>({item:store.patch(kind,r.params.id,r.body)}));
 route('delete','/'+plural+'/:id',r=>{if(r.query.permanent==='1'&&r.body?.confirm!==r.params.id)fail('Confirmation de suppression requise.');store.remove(kind,r.params.id,r.query.permanent==='1');return {success:true};});
 route('post','/'+plural+'/:id/restore',r=>({item:store.restore(kind,r.params.id)}));}
 route('post','/migrate',r=>({success:true,...store.migrate(r.body,true)}));
 route('get','/backup',()=>store.backup());
 route('post','/import',r=>{if(r.body?.format!=='llmb-local-backup'||r.body.version!==1)fail('Version de sauvegarde incompatible.');return {success:true,...store.importBackup(r.body)};});
 return store;
}
module.exports={openStore,mountDatabaseRoutes,dataDirectory};
