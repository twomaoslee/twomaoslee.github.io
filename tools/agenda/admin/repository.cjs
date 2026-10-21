'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const runFile=promisify(execFile),M=require('./model.cjs');
const SOURCE='tools/agenda/source',BOOK=SOURCE+'/data/conference-latest.json',PROGRAMS=SOURCE+'/data/main-programs.json';
class Repository{
 constructor({directory,remote,branch='main',publicURL='https://zimin.li/agenda/',onCommitted=async()=>{}}){this.directory=directory;this.remote=remote;this.branch=branch;this.publicURL=publicURL;this.onCommitted=onCommitted;}
 async git(args,options={}){return (await runFile('git',args,{cwd:this.directory,timeout:120000,maxBuffer:20*1024*1024,env:{...process.env,GIT_TERMINAL_PROMPT:'0'},...options})).stdout.trim();}
 async init(){
  if(!/^[\w./:@-]+$/.test(this.remote)||!this.remote)throw Error('Invalid repository address');
  if(!/^[\w/-]+$/.test(this.branch))throw Error('Invalid branch');
  await fs.mkdir(path.dirname(this.directory),{recursive:true,mode:0o700});
  try{await fs.access(path.join(this.directory,'.git'));}catch{await runFile('git',['clone','--filter=blob:none','--no-checkout','--single-branch','--branch',this.branch,'--',this.remote,this.directory],{timeout:120000,maxBuffer:1024*1024,env:{...process.env,GIT_TERMINAL_PROMPT:'0'}});}
  await this.refresh();
 }
 async refresh(){await this.git(['fetch','origin',this.branch]);return this.snapshot();}
 async snapshot(ref='origin/'+this.branch){
  if(!/^(?:origin\/[\w/-]+|[0-9a-f]{40})$/.test(ref))throw new M.UserError('版本编号无效');
  const head=await this.git(['rev-parse',ref]);
  const [b,p,v]=await Promise.all([this.git(['show',head+':'+BOOK]),this.git(['show',head+':'+PROGRAMS]),this.git(['show',head+':static/agenda/version.json'])]);
  const data={book:JSON.parse(b),programs:JSON.parse(p)};
  return {head,data,hash:M.hash(data),revision:JSON.parse(v).revision};
 }
 async history(){
  const text=await this.git(['log','origin/'+this.branch,'-30','--format=%H%x09%aI%x09%s','--',BOOK,PROGRAMS]);
  return text?text.split('\n').map(line=>{const [commit,date,...title]=line.split('\t');const raw=title.join('\t'),n=raw.match(/\((\d+) reports\)/)?.[1];return {commit,date,title:raw.startsWith('Update agenda via admin')?'日程修改'+(n?' · '+n+'场报告':''):raw.startsWith('Restore agenda via admin')?'回退日程'+(n?' · '+n+'场报告':''):raw}}):[];
 }
 async publish(review,progress){
  const current=await this.refresh();if(current.head!==review.head||current.hash!==review.baseHash)throw new M.UserError('网站已有新版本，请重新确认后发布',409);
  const temp=await fs.mkdtemp(path.join(path.dirname(this.directory),'release-'));let added=false;
  try{
   await this.git(['worktree','add','--detach','--no-checkout',temp,current.head]);added=true;
   await this.git(['-C',temp,'sparse-checkout','set','--cone',SOURCE,'static/agenda']);
   await this.git(['-C',temp,'checkout','--force',current.head]);
   const data=M.normalize(review.data);M.diff(current.data,data);
   await fs.writeFile(path.join(temp,BOOK),JSON.stringify(data.book,null,2)+'\n');
   await fs.writeFile(path.join(temp,PROGRAMS),JSON.stringify(data.programs,null,2)+'\n');
   progress('building','正在检查并生成网页');
   await runFile(process.execPath,[path.join(temp,SOURCE,'validate.cjs')],{cwd:temp,timeout:30000});
   await runFile(process.execPath,[path.join(temp,SOURCE,'build.cjs')],{cwd:temp,timeout:30000});
   // Only agenda files are staged. Homepage content and workflows are untouched.
   await this.git(['-C',temp,'add','--','static/agenda',SOURCE+'/data']);
   await this.git(['-C',temp,'diff','--cached','--check']);
   const changed=(await this.git(['-C',temp,'diff','--cached','--name-only'])).split('\n');
   if(changed.some(f=>!f.startsWith('static/agenda/')&&!f.startsWith(SOURCE+'/data/')))throw Error('Unexpected staged path');
   const prefix=review.operation==='rollback'?'Restore agenda via admin':'Update agenda via admin';
   await this.git(['-C',temp,'-c','user.name=Agenda administrator','-c','user.email=agenda-admin@users.noreply.github.com','commit','-m',prefix+' ('+review.changes.length+' reports)']);
   const commit=await this.git(['-C',temp,'rev-parse','HEAD']);
   const revision=JSON.parse(await fs.readFile(path.join(temp,'static/agenda/version.json'),'utf8')).revision;
   progress('pushing','正在提交发布');
   try{await this.git(['-C',temp,'push','origin','HEAD:refs/heads/'+this.branch]);}
   catch(error){
    // A push may succeed while its response is lost. Check before declaring failure.
    await this.refresh();const contains=await this.git(['branch','-r','--contains',commit]);if(!contains.split('\n').some(s=>s.trim()==='origin/'+this.branch))throw error;
   }
   await this.refresh();
   // The post-push callback must never turn a committed release into a failed job.
   await this.onCommitted({data,commit,revision}).catch(()=>{});
   return {commit,revision};
  }finally{
   if(added)await this.git(['worktree','remove','--force',temp]).catch(()=>{});
   await fs.rm(temp,{recursive:true,force:true});
  }
 }
 async isLive(revision){const u=new URL('version.json',this.publicURL);u.searchParams.set('admin_check',Date.now());try{const r=await fetch(u,{cache:'no-store',signal:AbortSignal.timeout(10000)});return r.ok&&(await r.json()).revision===revision;}catch{return false;}}
}
module.exports={Repository,SOURCE,BOOK,PROGRAMS};
