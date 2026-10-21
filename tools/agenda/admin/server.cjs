'use strict';
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {promisify}=require('node:util'),scrypt=promisify(crypto.scrypt),M=require('./model.cjs');
const PUBLIC=path.join(__dirname,'public');
const opaque=()=>crypto.randomBytes(32).toString('base64url');
const safeEqual=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
async function passwordHash(password,salt=crypto.randomBytes(16).toString('hex')){return {salt,hash:(await scrypt(password,salt,64)).toString('hex')}}
async function atomic(file,value){const temp=file+'.'+opaque()+'.tmp';await fs.writeFile(temp,JSON.stringify(value,null,2)+'\n',{mode:0o600});await fs.rename(temp,file);}
async function body(req){let bytes=0,parts=[];for await(const part of req){bytes+=part.length;if(bytes>256*1024)throw new M.UserError('提交内容过大',413);parts.push(part);}try{const result=JSON.parse(Buffer.concat(parts).toString()||'{}');if(!result||Array.isArray(result)||typeof result!=='object')throw Error();return result;}catch{throw new M.UserError('请求内容格式不正确')}}
function createAdmin({repository,stateDirectory,origin,username,password,secure=false,pollInterval=10000,pollLimit=60}){
 const sessions=new Map(),attempts=new Map(),reviews=new Map();let draft={etag:opaque(),baseHash:'',changes:{}},snapshot,refreshed=0,refreshing,job=null,lock=false,timer,closed=false;
 const draftFile=path.join(stateDirectory,'draft.json'),jobFile=path.join(stateDirectory,'job.json');
 const busy=()=>job&&['building','pushing','deploying'].includes(job.status);
 async function latest(force=false){if(!snapshot||force||Date.now()-refreshed>15000){if(!refreshing)refreshing=repository.refresh().then(s=>{snapshot=s;refreshed=Date.now();return s}).finally(()=>{refreshing=null});await refreshing;}return snapshot;}
 function requireIdle(){if(lock||busy())throw new M.UserError('正在发布，请完成后再修改',409);}
 function checkETag(value){if(value!==draft.etag)throw new M.UserError('草稿已在其他窗口修改，请刷新后重试',409);}
 async function writeDraft(next){next.etag=opaque();next.savedAt=new Date().toISOString();await atomic(draftFile,next);draft=next;reviews.clear();}
 function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));}
 function session(req){const cookie=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('agenda_session='));const token=cookie?.slice('agenda_session='.length);const s=sessions.get(token);if(s&&s.until>Date.now())return s;if(token)sessions.delete(token);return null;}
 function headers(res){for(const [k,v]of Object.entries({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",'Permissions-Policy':'camera=(), microphone=(), geolocation=()'}))res.setHeader(k,v);if(secure)res.setHeader('Strict-Transport-Security','max-age=31536000');}
 async function setJob(status,message,extra={}){job={...job,status,message,...extra,updatedAt:new Date().toISOString()};await atomic(jobFile,job);}
 async function watchDeployment(){
  if(closed||!job||!['deploying','pending'].includes(job.status))return;
  if(await repository.isLive(job.revision)){await setJob('live','已上线');return;}
  job.polls=(job.polls||0)+1;
  if(job.polls>=pollLimit){await setJob('pending','已提交，网站部署仍待确认；可点击重新检查');return;}
  timer=setTimeout(()=>watchDeployment().catch(()=>{}),pollInterval);timer.unref();
 }
 async function publish(review){
  let committed;
  try{
   const result=await repository.publish(review,(status,message)=>{job={...job,status,message};});
   committed=result;
   await writeDraft({etag:opaque(),baseHash:'',changes:{}});
   refreshed=0;await setJob('deploying','已提交，正在等待网站上线',{...result,polls:0});
   await watchDeployment();
  }catch(error){
   const status=committed?'pending':'failed',message=committed?'已提交，但本机状态保存失败，请核对网站和版本记录':error instanceof M.UserError?error.message:'发布失败，日程草稿仍保留。请检查仓库权限或网络后重新确认。';
   try{await setJob(status,message,committed||{});}catch{job={...job,...committed,status,message};}
   console.error('Agenda publish failed:',error.name);
  }
 }
 const server=http.createServer(async(req,res)=>{
  headers(res);
  try{
   // Host and Origin are checked even on loopback to block DNS rebinding and CSRF.
   const expected=new URL(origin);if(req.headers.host!==expected.host)throw new M.UserError('访问地址不匹配',403);
   const url=new URL(req.url,origin),mutation=!['GET','HEAD'].includes(req.method);
   if(mutation&&(req.headers.origin!==origin||!String(req.headers['content-type']).startsWith('application/json')))throw new M.UserError('请求来源不匹配',403);
   if(url.pathname==='/api/login'&&req.method==='POST'){
    const ip=req.socket.remoteAddress||'unknown',now=Date.now();
    for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);
    const rate=attempts.get(ip)||{count:0,until:now+15*60*1000};
    if(rate.count>=8)throw new M.UserError('登录尝试过多，请15分钟后再试',429);
    rate.count++;attempts.set(ip,rate);
    const b=await body(req);if(typeof b.password!=='string'||b.password.length>512)throw new M.UserError('账号或密码不正确',401);
    const actual=await passwordHash(b.password,password.salt);
    if(b.username!==username||!safeEqual(actual.hash,password.hash)){throw new M.UserError('账号或密码不正确',401);}
    for(const [id,s] of sessions)if(s.until<now)sessions.delete(id);
    if(sessions.size>20)sessions.delete(sessions.keys().next().value);
    const id=opaque(),csrf=opaque();sessions.set(id,{csrf,until:now+8*3600000});attempts.delete(ip);
    res.setHeader('Set-Cookie','agenda_session='+id+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800'+(secure?'; Secure':''));return json(res,200,{csrf,username});
   }
   if(url.pathname==='/api/session'&&req.method==='GET'){const s=session(req);return json(res,200,s?{authenticated:true,username,csrf:s.csrf}:{authenticated:false});}
   if(url.pathname.startsWith('/api/')){
    const s=session(req);if(!s)throw new M.UserError('请先登录',401);
    if(mutation&&!safeEqual(req.headers['x-csrf-token'],s.csrf))throw new M.UserError('会话校验失败，请重新登录',403);
    if(req.method==='POST'&&url.pathname==='/api/logout'){sessions.clear();res.setHeader('Set-Cookie','agenda_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'+(secure?'; Secure':''));return json(res,200,{ok:true});}
    if(req.method==='GET'&&url.pathname==='/api/state'){
     const current=await latest(),stale=Object.keys(draft.changes).length>0&&draft.baseHash!==current.hash;
     const changes=stale?[]:M.diff(current.data,M.apply(current.data,draft.changes));
     return json(res,200,{revision:current.revision,etag:draft.etag,changes,stale,draftCount:Object.keys(draft.changes).length,job,tracks:[...new Map(M.all(current.data).map(r=>[r.trackCode,r.track])).entries()],history:await repository.history()});
    }
    if(req.method==='GET'&&url.pathname==='/api/reports'){
     const current=await latest(),valid=draft.baseHash===current.hash,data=valid?M.apply(current.data,draft.changes):current.data;
     const q=(url.searchParams.get('q')||'').trim().toLowerCase().replace(/^([a-z]+)-?0*(\d+)$/,'$1-$2'),track=url.searchParams.get('track')||'';
     const needle=(url.searchParams.get('q')||'').trim().toLowerCase();
     let rows=M.all(data).filter(r=>(!track||r.trackCode===track)&&(!needle||[r.number,r.speaker,r.title,r.affiliation,r.track].some(v=>String(v||'').toLowerCase().includes(needle))||String(r.number||'').toLowerCase().replace(/^([a-z]+)-?0*(\d+)$/,'$1-$2')===q));
     const count=rows.length;rows=rows.slice(0,100).map(r=>({id:r.id,number:r.number||'',speaker:r.speaker,title:r.title,date:r.date,start:r.start,end:r.end,track:r.track,kind:r.kind,changed:valid&&Object.hasOwn(draft.changes,r.id)}));
     return json(res,200,{rows,count});
    }
    if(req.method==='GET'&&url.pathname==='/api/report'){
     const current=await latest(),r=M.all(current.data).find(r=>r.id===url.searchParams.get('id'));if(!r)throw new M.UserError('未找到报告',404);
     const valid=draft.baseHash===current.hash;return json(res,200,{report:valid?{...r,...draft.changes[r.id]}:r,etag:draft.etag});
    }
    if(req.method==='POST'&&url.pathname==='/api/draft'){
     requireIdle();const b=await body(req);checkETag(b.etag);const current=await latest(true);
     if(Object.keys(draft.changes).length&&draft.baseHash!==current.hash)throw new M.UserError('线上日程已改变，请先清除旧草稿并重新编辑',409);
     const r=M.all(current.data).find(r=>r.id===b.id);if(!r)throw new M.UserError('未找到报告',404);
     M.validatePatch(r,b.fields);const patches={...draft.changes},patch={...patches[b.id],...b.fields};
     for(const k of Object.keys(patch))if((r[k]||'')===patch[k])delete patch[k];
     if(Object.keys(patch).length)patches[b.id]=patch;else delete patches[b.id];
     // Recheck after await: another client may have saved a draft meanwhile.
     requireIdle();checkETag(b.etag);lock=true;try{await writeDraft({baseHash:current.hash,changes:patches});}finally{lock=false;}
     return json(res,200,{ok:true,etag:draft.etag});
    }
    if(req.method==='POST'&&url.pathname==='/api/discard'){
     requireIdle();const b=await body(req);requireIdle();checkETag(b.etag);lock=true;try{await writeDraft({baseHash:'',changes:{}});}finally{lock=false;}return json(res,200,{ok:true});
    }
    if(req.method==='POST'&&url.pathname==='/api/review'){
     requireIdle();const b=await body(req);checkETag(b.etag);const current=await latest(true);let data;
     if(b.operation==='publish'){
      if(draft.baseHash!==current.hash)throw new M.UserError('日程已有新版本，请重新核对草稿',409);
      data=M.apply(current.data,draft.changes);
     }else if(b.operation==='rollback'){
      if(Object.keys(draft.changes).length)throw new M.UserError('请先发布或清除草稿，再回退版本');
      const history=await repository.history();if(!history.some(h=>h.commit===b.commit))throw new M.UserError('该版本不在可回退记录中');
      data=(await repository.snapshot(b.commit)).data;
     }else throw new M.UserError('操作无效');
     const changes=M.diff(current.data,data);if(!changes.length)throw new M.UserError('没有需要发布的修改');
     requireIdle();checkETag(b.etag);const token=opaque();for(const [k,r]of reviews)if(r.until<Date.now())reviews.delete(k);
     reviews.set(token,{operation:b.operation,head:current.head,baseHash:current.hash,etag:draft.etag,data,changes,until:Date.now()+10*60*1000});
     return json(res,200,{token,changes,warnings:M.warnings(changes),operation:b.operation});
    }
    if(req.method==='POST'&&url.pathname==='/api/publish'){
     requireIdle();const b=await body(req),review=reviews.get(b.token);if(!review||review.until<Date.now()||review.etag!==draft.etag)throw new M.UserError('确认已过期，请重新核对修改',409);
     requireIdle();reviews.clear();lock=true;
     try{job={id:opaque(),status:'building',message:'正在检查并生成网页',startedAt:new Date().toISOString()};await atomic(jobFile,job);}finally{lock=false;}
     publish(review).catch(()=>{});return json(res,202,{job});
    }
    if(req.method==='POST'&&url.pathname==='/api/check-deployment'){
     if(job?.status==='pending'){job.polls=0;await setJob('deploying','重新检查上线状态');watchDeployment().catch(()=>{});}return json(res,200,{job});
    }
    throw new M.UserError('未找到接口',404);
   }
   const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};
   if(req.method!=='GET'||!files[url.pathname])throw new M.UserError('页面不存在',404);
   res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript; charset=utf-8':url.pathname.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8');
   res.end(await fs.readFile(path.join(PUBLIC,files[url.pathname])));
  }catch(error){if(!res.headersSent)json(res,error.status||500,{error:error instanceof M.UserError?error.message:'暂时无法完成操作，请检查网络或联系技术人员'});else res.end();if(!(error instanceof M.UserError))console.error('Admin request failed:',error.name);}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;
 return {server,async init(){await fs.mkdir(stateDirectory,{recursive:true,mode:0o700});await repository.init();try{const saved=JSON.parse(await fs.readFile(draftFile,'utf8'));if(saved.etag&&saved.changes)draft=saved;}catch(e){if(e.code!=='ENOENT')throw e;}
  try{job=JSON.parse(await fs.readFile(jobFile,'utf8'));if(['building','pushing'].includes(job.status))await setJob('failed','上次发布被中断，请核对版本记录后重新确认');if(job.status==='deploying')watchDeployment().catch(()=>{});}catch(e){if(e.code!=='ENOENT')throw e;}
 },close(){closed=true;clearTimeout(timer);server.closeAllConnections();return new Promise(resolve=>server.close(resolve));}};
}
module.exports={createAdmin,passwordHash,atomic};
