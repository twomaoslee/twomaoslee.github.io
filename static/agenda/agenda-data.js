(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else{root.AgendaData=factory();try{root.agendaData=root.AgendaData.create(root.CONFERENCE_CATALOG,root);root.CONFERENCE=root.agendaData.book;}catch(error){root.agendaDataError=error;}}})(typeof window==='object'?window:null,function(){
'use strict';
function create(catalog,env){
 if(!catalog||catalog.schema!==1||!catalog.chunks)throw Error('日程目录不可用，请刷新重试。');
 const cacheName='cps2026:agenda:assets:v1',snapshotKey='cps2026:agenda:snapshot:v1';
 let boot=null,cachePromise=null,baseSnapshotURL='';
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
 function absolute(url){return new URL(url,new URL('./',env.location.href)).href;}
 function getCache(){if(!cachePromise)cachePromise=(async()=>{try{return env.caches?await env.caches.open(cacheName):null;}catch(error){return null;}})();return cachePromise;}
 function marker(){try{const value=JSON.parse(env.localStorage.getItem(snapshotKey));return value&&typeof value.url==='string'&&/^https?:/.test(value.url)&&new URL(value.url).origin===env.location.origin?value:null;}catch(error){return null;}}
 async function remember(url,response){if(!response)return;try{const cache=await getCache();if(cache)await cache.put(url,response);}catch(error){/* The page still works with HTTP caching alone. */}}
 async function trimCache(){
  try{const cache=await getCache();if(!cache)return;const keys=await cache.keys(),keep=new Set(Object.values(catalog.chunks).map(c=>absolute(c.url)));
   if(catalog.fullData)keep.add(absolute(catalog.fullData.url));if(baseSnapshotURL)keep.add(baseSnapshotURL);
   if(env.document&&env.document.querySelectorAll)for(const el of env.document.querySelectorAll('script[src],link[rel="stylesheet"]'))keep.add(new URL(el.src||el.href,env.location.href).href);
   let excess=keys.length-96;for(const key of keys){if(excess<=0)break;if(!keep.has(key.url)){await cache.delete(key);excess--;}}
  }catch(error){}
 }
 function validate(key,payload){
  const c=catalog.chunks[key],expected=new Set(Object.values(c.kinds).flat());
  if(!payload||payload.schema!==1||payload.key!==key||!Array.isArray(payload.reports)||payload.reports.length!==expected.size)throw Error('日程文件不完整');
  const seen=new Set();for(const r of payload.reports){const stub=r&&byId.get(r.id);if(!r||!expected.has(r.id)||seen.has(r.id)||r.kind!==stub.kind||r.trackCode!==stub.trackCode||typeof r.title!=='string'||typeof r.date!=='string'||typeof r.start!=='string'||typeof r.end!=='string')throw Error('日程文件与当前目录不匹配');seen.add(r.id);}
  if(c.programId&&(!payload.program||payload.program.id!==c.programId))throw Error('专题信息不完整');
 }
 function commit(key,payload){
  for(const r of payload.reports){const stub=byId.get(r.id);for(const k of Object.keys(stub))if(!Object.prototype.hasOwnProperty.call(r,k))delete stub[k];Object.assign(stub,r);}
  const c=catalog.chunks[key];if(c.programId){const p=programs.get(c.programId),reports=p.reports;for(const k of Object.keys(p))if(!Object.prototype.hasOwnProperty.call(payload.program,k))delete p[k];reports.splice(0,reports.length,...payload.reports.map(r=>byId.get(r.id)));Object.assign(p,payload.program,{reports});}
  loaded.add(key);
 }
 function expandSnapshot(payload,complete){
  const fields=['id','number','kind','title','speaker','affiliation','room','date','start','end','period','chair','sessionTitle','session','sourceLabel','sourceSheet','sourceNote','abstract'];
  if(!payload||payload.schema!==1||!Array.isArray(payload.meta)||!Array.isArray(payload.entries)||!Array.isArray(payload.strings)||JSON.stringify(payload.fields)!==JSON.stringify(fields)||!Array.isArray(payload.programs)||!payload.chunkURLs||complete&&payload.version!==catalog.version)throw Error('完整日程版本不匹配');
  const records=new Map(),programData=new Map();
  for(const a of payload.entries){const m=payload.meta[a[0]];if(!m)throw Error('会场信息缺失');const r={track:m.track,trackCode:m.trackCode,trackName:m.trackName,sequence:a[1],sourceRow:a[2],timeUncertain:!!a[3],sharedWith:a[4]};fields.forEach((k,i)=>{r[k]=payload.strings[a[i+5]];});if(records.has(r.id))throw Error('重复ID');records.set(r.id,r);}
  for(const p of payload.programs){programData.set(p.id,p);for(const r of p.reports){if(records.has(r.id))throw Error('重复ID');records.set(r.id,r);}}
  const parts=[],allRecords=Array.from(records.values());for(const [key,c]of Object.entries(catalog.chunks)){
   if(payload.chunkURLs[key]!==c.url){if(complete)throw Error('分会版本不匹配');continue;}
   const expected=new Set(Object.values(c.kinds).flat()),part={schema:1,key,reports:allRecords.filter(r=>expected.has(r.id))};if(c.programId)part.program=programData.get(c.programId);validate(key,part);parts.push(part);
  }
  if(complete&&(records.size!==byId.size||parts.length!==Object.keys(catalog.chunks).length))throw Error('完整日程缺失');
  // Validate every selected section before changing live report objects.
  for(const part of parts)commit(part.key,part);
  return parts;
 }
 async function rememberParts(parts){
  const ResponseClass=env.Response;if(!ResponseClass)return;
  let next=0;await Promise.all(Array.from({length:Math.min(4,parts.length)},async()=>{while(next<parts.length){const part=parts[next++];await remember(absolute(catalog.chunks[part.key].url),new ResponseClass(JSON.stringify(part),{headers:{'Content-Type':'application/json; charset=utf-8'}}));}}));await trimCache();
 }
 async function warmCached(){
  const cache=await getCache();if(!cache)return;
  const queue=Object.keys(catalog.chunks);let next=0;
  await Promise.all(Array.from({length:4},async()=>{while(next<queue.length){const key=queue[next++];if(loaded.has(key))continue;try{const hit=await cache.match(absolute(catalog.chunks[key].url));if(hit){const part=await hit.json();validate(key,part);commit(key,part);}}catch(error){/* Only explicit foreground requests fetch missing data. */}}}));
 }
 async function bootstrap(){
  if(boot)return boot;
  boot=(async()=>{
   if(!catalog.fullData)return;
   if(!/^\.\/assets\/conference-complete\.[a-f0-9]{16}\.json$/.test(catalog.fullData.url))throw Error('完整日程地址无效');
   const current=absolute(catalog.fullData.url),previous=marker(),cache=await getCache();let keys=[],currentHit=null;
   if(cache){try{keys=await cache.keys();currentHit=await cache.match(current);}catch(error){}}
   const snapshots=keys.filter(r=>/\/conference-complete\.[a-f0-9]{16}\.json$/.test(new URL(r.url).pathname));
   const hadSnapshot=!!previous||snapshots.length>0;
   if(currentHit||!hadSnapshot||previous&&previous.url===current){
    const controller=env.AbortController?new env.AbortController():null;
    const timer=env.setTimeout?env.setTimeout(()=>{if(controller)controller.abort();},15000):null;
    try{
     let response=currentHit;if(!response)response=await env.fetch(current,{credentials:'omit',mode:'same-origin',cache:'force-cache',...(controller?{signal:controller.signal}:{})});
     if(!response.ok)throw Error('完整日程下载失败');const saved=response.clone?response.clone():null;
     const payload=await response.json(),parts=expandSnapshot(payload,true);baseSnapshotURL=current;
     try{env.localStorage.setItem(snapshotKey,JSON.stringify({url:current}));}catch(error){}
     // The snapshot supports immediate reuse; per-section copies allow selective updates later.
     remember(current,saved).then(()=>rememberParts(parts)).catch(()=>{});
    }catch(error){/* Fall back to downloading only the venue actually requested. */}
    finally{if(timer!==null&&env.clearTimeout)env.clearTimeout(timer);}
   }else if(cache){
    const candidate=previous&&keys.some(r=>r.url===previous.url)?previous.url:snapshots.length?snapshots[snapshots.length-1].url:'';
    if(candidate){try{const response=await cache.match(candidate);if(response){expandSnapshot(await response.json(),false);baseSnapshotURL=candidate;}}catch(error){}}
   }
  })();return boot;
 }
 async function load(key){
  if(loaded.has(key))return;
  if(pending.has(key))return pending.get(key);
  const c=catalog.chunks[key];if(!c)throw Error('日程目录中没有这个会场');
  const task=(async()=>{
   const controller=env.AbortController?new env.AbortController():null;
   const timer=env.setTimeout?env.setTimeout(()=>{if(controller)controller.abort();},15000):null;
   try{
    const url=absolute(c.url),cache=await getCache();let response;
    if(cache){try{response=await cache.match(url);}catch(error){}}
    if(!response)response=await env.fetch(url,{credentials:'omit',mode:'same-origin',cache:'force-cache',...(controller?{signal:controller.signal}:{})});
    if(!response.ok)throw Error('下载失败');const saved=response.clone?response.clone():null,payload=await response.json();
    validate(key,payload);commit(key,payload);remember(url,saved).then(trimCache).catch(()=>{});
   }catch(error){throw Error('日程暂时未能加载，请检查网络后重试。');}
   finally{if(timer!==null&&env.clearTimeout)env.clearTimeout(timer);}
  })();pending.set(key,task);
  try{await task;}finally{pending.delete(key);}
 }
 async function ensure(keys){const queue=unique(keys);if(ready(queue))return;await bootstrap();let next=0;await Promise.all(Array.from({length:Math.min(4,queue.length)},async()=>{while(next<queue.length)await load(queue[next++]);}));}
 async function start(keys){await bootstrap();warmCached().catch(()=>{});await ensure(keys||[]);}
 return {book,byId,keysForIds,keysForTrack,keysForPrograms,keysForVenue,ready,readyId,ensure,start};
}
return {create};
});
