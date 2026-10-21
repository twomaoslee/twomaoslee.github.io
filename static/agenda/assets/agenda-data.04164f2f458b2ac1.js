(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else{root.AgendaData=factory();try{root.agendaData=root.AgendaData.create(root.CONFERENCE_CATALOG,root);root.CONFERENCE=root.agendaData.book;}catch(error){root.agendaDataError=error;}}})(typeof window==='object'?window:null,function(){
'use strict';
function create(catalog,env){
 if(!catalog||catalog.schema!==1||!catalog.chunks)throw Error('日程目录不可用，请刷新重试。');
 const tracks=new Map(catalog.tracks.map(t=>[t.trackCode,t])),byId=new Map(),locations=new Map(),loaded=new Set(),pending=new Map();
 const book={version:catalog.version,title:catalog.title,source:catalog.source,tracks:catalog.tracks,favoriteMigrations:catalog.favoriteMigrations,programs:[],reports:[]};
 const programs=new Map(catalog.programs.map(p=>[p.id,Object.assign({},p,{reports:[]})]));book.programs=Array.from(programs.values());
 for(const [key,c]of Object.entries(catalog.chunks)){
  if(!/^\.\/assets\/chunk-[a-z0-9-]+\.[a-f0-9]{16}\.json$/.test(c.url))throw Error('日程文件地址无效');
  const t=tracks.get(c.trackCode),program=programs.get(c.programId);
  for(const [kind,ids]of Object.entries(c.kinds))for(const id of ids){
   if(byId.has(id))throw Error('报告内部ID重复');
   const r={id,kind,trackCode:c.trackCode,track:t?t.track:program.title,trackName:t?t.trackName:program.title,sharedWith:c.sharedWith||[]};
   if(program)r.programId=program.id;
   byId.set(id,r);locations.set(id,key);(program?program.reports:book.reports).push(r);
  }
 }
 function unique(keys){return Array.from(new Set(keys.filter(k=>Object.prototype.hasOwnProperty.call(catalog.chunks,k))));}
 function keysForIds(ids){return unique(Array.from(ids,id=>locations.get(id)));}
 function keysForTrack(track,kind){return Object.keys(catalog.chunks).filter(key=>{const c=catalog.chunks[key];return !c.programId&&(kind==='poster'?!!c.kinds.poster:!c.kinds.poster)&&(!track||c.trackCode===track||(kind==='poster'&&(c.sharedWith||[]).some(t=>t.startsWith(track+' · '))));});}
 function keysForPrograms(id){return Object.keys(catalog.chunks).filter(k=>catalog.chunks[k].programId&&(!id||catalog.chunks[k].programId===id));}
 function keysForVenue(id){const parts=id.split(':'),group=parts[0]==='group';return Object.keys(catalog.chunks).filter(k=>{const c=catalog.chunks[k];return !c.programId&&(group?c.trackCode[0]===parts[1]:c.trackCode===parts[1]||(c.sharedWith||[]).some(t=>t.startsWith(parts[1]+' · ')));});}
 function ready(keys){return keys.every(k=>loaded.has(k));}
 function readyId(id){return loaded.has(locations.get(id));}
 async function load(key){
  if(loaded.has(key))return;
  if(pending.has(key))return pending.get(key);
  const c=catalog.chunks[key];if(!c)throw Error('日程目录中没有这个会场');
  const task=(async()=>{
   const controller=env.AbortController?new env.AbortController():null;
   const timer=env.setTimeout?env.setTimeout(()=>{if(controller)controller.abort();},15000):null;
   try{
    const url=new URL(c.url,new URL('./',env.location.href));
    const response=await env.fetch(url.href,{credentials:'omit',mode:'same-origin',cache:'force-cache',...(controller?{signal:controller.signal}:{})});
    if(!response.ok)throw Error('下载失败');
    const payload=await response.json(),expected=new Set(Object.values(c.kinds).flat());
    if(!payload||payload.schema!==1||payload.key!==key||!Array.isArray(payload.reports)||payload.reports.length!==expected.size)throw Error('日程文件不完整');
    const seen=new Set();for(const r of payload.reports){const stub=r&&byId.get(r.id);if(!r||!expected.has(r.id)||seen.has(r.id)||r.kind!==stub.kind||r.trackCode!==stub.trackCode||typeof r.title!=='string'||typeof r.date!=='string'||typeof r.start!=='string'||typeof r.end!=='string')throw Error('日程文件与当前目录不匹配');seen.add(r.id);}
    if(c.programId&&(!payload.program||payload.program.id!==c.programId))throw Error('专题信息不完整');
    // Commit only after the entire chunk has passed validation. Keep object
    // identities stable: existing favorites, maps and list arrays refer to them.
    for(const r of payload.reports){const stub=byId.get(r.id);for(const k of Object.keys(stub))if(!Object.prototype.hasOwnProperty.call(r,k))delete stub[k];Object.assign(stub,r);}
    if(c.programId){const p=programs.get(c.programId),reports=p.reports;for(const k of Object.keys(p))if(!Object.prototype.hasOwnProperty.call(payload.program,k))delete p[k];reports.splice(0,reports.length,...payload.reports.map(r=>byId.get(r.id)));Object.assign(p,payload.program,{reports});}
    loaded.add(key);
   }catch(error){throw Error('日程暂时未能加载，请检查网络后重试。');}
   finally{if(timer!==null&&env.clearTimeout)env.clearTimeout(timer);}
  })();pending.set(key,task);
  try{await task;}finally{pending.delete(key);}
 }
 async function ensure(keys){const queue=unique(keys);let next=0;await Promise.all(Array.from({length:Math.min(4,queue.length)},async()=>{while(next<queue.length)await load(queue[next++]);}));}
 return {book,byId,keysForIds,keysForTrack,keysForPrograms,keysForVenue,ready,readyId,ensure};
}
return {create};
});
