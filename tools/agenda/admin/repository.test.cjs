'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const exec=promisify(execFile),{Repository,BOOK,PROGRAMS}=require('./repository.cjs'),M=require('./model.cjs');
test('隔离Git仓库真实构建、发布、保留收藏ID、增量分片、远端冲突和数据回退',async t=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'agenda-publish-test-'));t.after(()=>fs.rm(temp,{recursive:true,force:true}));
 const seed=path.join(temp,'seed'),remote=path.join(temp,'remote.git');await fs.mkdir(seed);
 const git=async(args,cwd=seed)=>(await exec('git',args,{cwd,maxBuffer:20*1024*1024})).stdout.trim();
 await git(['init','--bare',remote],temp);await git(['init','-b','main']);await git(['config','user.email','tests@example.invalid']);await git(['config','user.name','Agenda tests']);
 await fs.cp(path.join(__dirname,'../source'),path.join(seed,'tools/agenda/source'),{recursive:true});
 await fs.cp(path.join(__dirname,'../../../static/agenda'),path.join(seed,'static/agenda'),{recursive:true});
 await fs.writeFile(path.join(seed,'homepage-sentinel.txt'),'keep-homepage');
 await git(['add','.']);await git(['commit','-m','Initial agenda']);await git(['remote','add','origin',remote]);await git(['push','origin','main']);
 const repo=new Repository({directory:path.join(temp,'admin/repository'),remote});await repo.init();const baseline=await repo.snapshot();
 const edited=M.apply(baseline.data,{'E-063':{title:'隔离测试：发布新标题'}}),changes=M.diff(baseline.data,edited);
 const result=await repo.publish({head:baseline.head,baseHash:baseline.hash,data:edited,changes,operation:'publish'},()=>{});
 const after=await repo.snapshot();assert.equal(after.data.book.reports.find(r=>r.id==='E-063').title,'隔离测试：发布新标题');
 assert.deepEqual(M.all(after.data).map(r=>r.id),M.all(baseline.data).map(r=>r.id));
 assert.equal(await repo.git(['show','origin/main:homepage-sentinel.txt']),'keep-homepage');
 const originalManifest=JSON.parse(await repo.git(['show',baseline.head+':static/agenda/asset-manifest.json'])),manifest=JSON.parse(await repo.git(['show','origin/main:static/agenda/asset-manifest.json']));
 const changed=manifest.chunks.filter(s=>!originalManifest.chunks.includes(s));assert.equal(changed.length,1);assert(changed[0].includes('chunk-track-e.'));assert.equal(manifest.revision,result.revision);
 const paths=(await repo.git(['diff','--name-only',baseline.head,after.head])).split('\n');assert(paths.every(p=>p.startsWith('static/agenda/')||p.startsWith('tools/agenda/source/data/')));
 const rollback=await repo.publish({head:after.head,baseHash:after.hash,data:baseline.data,changes:M.diff(after.data,baseline.data),operation:'rollback'},()=>{});
 assert.notEqual(rollback.commit,baseline.head);assert.equal((await repo.snapshot()).data.book.reports.find(r=>r.id==='E-063').title,baseline.data.book.reports.find(r=>r.id==='E-063').title);
 // Someone else publishes after a review was generated; never overwrite it.
 await git(['pull','--ff-only','origin','main']);await fs.writeFile(path.join(seed,'homepage-sentinel.txt'),'newer-homepage');await git(['add','.']);await git(['commit','-m','Unrelated homepage update']);await git(['push','origin','main']);
 await assert.rejects(repo.publish({head:after.head,baseHash:after.hash,data:edited,changes,operation:'publish'},()=>{}),/已有新版本/);
 assert.equal(await repo.git(['show','origin/main:homepage-sentinel.txt']),'newer-homepage');
});
