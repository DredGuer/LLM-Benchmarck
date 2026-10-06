const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{execFile}=require('node:child_process'),{promisify}=require('node:util');const run=promisify(execFile);
(async()=>{const dir=await fs.mkdtemp(path.join(process.cwd(),'.archive-test-'));try{await run('python3',['-c',`import zipfile, tarfile, io, sys
from pathlib import Path
p=Path(sys.argv[1])
with zipfile.ZipFile(p/'good.zip','w') as z: z.writestr('Ollama.app/Contents/Resources/ollama','test')
with zipfile.ZipFile(p/'bad.zip','w') as z: z.writestr('../escaped','bad')
with tarfile.open(p/'link.tar.gz','w:gz') as t:
 e=tarfile.TarInfo('lib'); e.type=tarfile.SYMTYPE; e.linkname='../../escaped'; t.addfile(e)
with tarfile.open(p/'good.tar.gz','w:gz') as t:
 e=tarfile.TarInfo('bin/llama-server'); data=b'test'; e.size=len(data); e.mode=0o755; t.addfile(e,io.BytesIO(data))
 e=tarfile.TarInfo('bin/current'); e.type=tarfile.SYMTYPE; e.linkname='llama-server'; t.addfile(e)
`,dir]);const script=path.resolve('backend/extract-runner.py');await run('python3',[script,path.join(dir,'good.zip'),path.join(dir,'zip')]);assert.equal(await fs.readFile(path.join(dir,'zip/Ollama.app/Contents/Resources/ollama'),'utf8'),'test');await run('python3',[script,path.join(dir,'good.tar.gz'),path.join(dir,'tar')]);assert.equal(await fs.readlink(path.join(dir,'tar/bin/current')),'llama-server');assert((await fs.stat(path.join(dir,'tar/bin/llama-server'))).mode&0o100);for(const name of ['bad.zip','link.tar.gz'])await assert.rejects(run('python3',[script,path.join(dir,name),path.join(dir,name+'-out')]));assert.equal(await fs.access(path.join(dir,'escaped')).then(()=>true,()=>false),false);console.log('PASS: real ZIP/tar extraction, executable modes, internal symlinks and escaping path/link rejection');}finally{await fs.rm(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
