'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const E=require('../source/agenda-export.js'),M=require('../source/agenda-model.js'),book=require('../source/data/conference-latest.json');
const measure=(s,size)=>Array.from(s).reduce((n,c)=>n+size*(/[\u0000-\u00ff]/.test(c)?.58:1),0);
const reportIds=p=>p.pages.flatMap(page=>page.units.filter(u=>u.type==='report').map(u=>u.id));
const normalized=s=>s.replace(/\s/g,'');
test('英文按单词换行，超长单词仍能折行且字符不丢失',()=>{
 const text='Hohlraum Debris Fields under High-Power Laser: Modeling and Experiment',wrapped=E.wrap(text,780,measure,40,true);assert.equal(wrapped.join(''),text);assert(!wrapped.some(s=>/La$|^ser/.test(s)));
 const oversized='abcdefghijklmnopqrstuvwxyz'.repeat(5),split=E.wrap(oversized,200,measure,40,true);assert.equal(split.join(''),oversized);assert(split.every(s=>measure(s,40)<=200));
});
test('34个分会场每个日期与全部张贴各一张长图，内容不遗漏不重复',()=>{
 let plans=0;for(const track of book.meta.tracks.filter(t=>book.reports.some(r=>r.trackCode===t.trackCode&&r.kind!=='poster'))){const source=book.reports.filter(r=>M.matches(r,track.trackCode));const dates=[...new Set(source.filter(r=>r.kind!=='poster'&&r.kind!=='break').map(r=>r.date))];for(const choice of dates.concat(source.some(r=>r.kind==='poster')?['poster']:[])){const poster=choice==='poster',rows=M.select(book.reports,{kind:poster?'poster':'oral',track:track.trackCode,date:poster?'':choice,query:''},new Set(),false),layout=E.plan({track,label:poster?'张贴报告':M.dateLabel(choice),rows,poster},measure);
   assert.equal(layout.width,780);assert.equal(layout.pages.length,1);for(const p of layout.pages){assert(p.height>layout.header.height);assert(p.units.some(u=>u.type==='report'));assert(p.units.every(u=>u.height>0));}const size=E.resolution(layout);assert(size.height<=E.MAX_HEIGHT);assert(size.width*size.height<=E.MAX_PIXELS);
   const ids=reportIds(layout),expected=rows.filter(r=>r.kind!=='break').map(r=>r.id);assert.deepEqual(ids,expected,track.trackCode+' '+choice);for(const r of rows.filter(r=>r.kind!=='break')){const text=layout.pages.flatMap(p=>p.units).filter(u=>u.id===r.id).flatMap(u=>u.lines).map(l=>l.text).join('');assert(normalized(text).includes(normalized(r.title)),r.id);if(r.speaker)assert(normalized(text).includes(normalized(r.speaker)),r.id);if(r.affiliation)assert(normalized(text).includes(normalized(r.affiliation)),r.id);}
   if(poster)assert(layout.pages.flatMap(p=>p.units).filter(u=>u.type==='report').every(u=>!u.start&&!u.end));plans++;
  }}assert(plans>85);
});
test('J子会场375项共享张贴仍在一张长图，包含主题，日期互不混入',()=>{
 const track=book.meta.tracks.find(t=>t.trackCode==='JA'),rows=M.select(book.reports,{track:'JA',kind:'poster',query:''},new Set(),false);assert.equal(rows.length,375);const p=E.plan({track,label:'张贴报告',rows,poster:true},measure);assert.equal(p.pages.length,1);assert.equal(new Set(reportIds(p)).size,375);assert(p.pages.flatMap(p=>p.units).some(u=>u.type==='section'&&u.lines.some(l=>l.text)));const size=E.resolution(p);assert(size.width<780);assert(size.height<=30000);assert(size.width*size.height<=E.MAX_PIXELS);
 const c=book.meta.tracks.find(t=>t.trackCode==='C');for(const date of ['2026-10-23','2026-10-24','2026-10-25']){const selected=M.select(book.reports,{track:'C',kind:'oral',date,query:''},new Set(),false);const layout=E.plan({track:c,label:date,rows:selected},measure);assert(reportIds(layout).every(id=>book.reports.find(r=>r.id===id).date===date));}
});
test('超长内容完整保留在一张图，按比例限制画布大小，不裁字',()=>{
 const track=book.meta.tracks.find(t=>t.trackCode==='R'),sample=book.reports.find(r=>r.id==='R-014'),title='完整保留超长报告题目α₂'.repeat(500),r={...sample,title};const p=E.plan({track,label:'测试日期',rows:[r]},measure);assert.equal(p.pages.length,1);const all=p.pages.flatMap(p=>p.units.filter(u=>u.type==='report'));assert.equal(all.length,1);assert(normalized(all.flatMap(u=>u.lines).map(l=>l.text).join('')).includes(normalized(title)));
 assert.throws(()=>E.plan({track,label:'',rows:[]},measure),/没有可导出/);const large=E.plan({track,label:'',rows:[{...sample,chair:'主持信息'.repeat(2000)}]},measure),size=E.resolution(large);assert.equal(large.pages.length,1);assert(size.height<=E.MAX_HEIGHT);assert(size.width*size.height<=E.MAX_PIXELS);
});
test('R更新后的导出保留茶歇和新主持人，不含已取消报告，源对象不被修改',()=>{
 const track=book.meta.tracks.find(t=>t.trackCode==='R'),rows=M.select(book.reports,{track:'R',kind:'oral',date:'2026-10-24',query:''},new Set(),false),before=JSON.stringify(rows);const p=E.plan({track,label:'10月24日 周六',rows},measure);assert.equal(p.reportCount,18);const text=p.pages.flatMap(p=>p.units).flatMap(u=>u.lines).map(l=>l.text).join('');assert(text.includes('14:50—15:25'));assert(text.includes('李俊'));assert(!text.includes('龚韬'));assert(!reportIds(p).includes('R-013'));assert.equal(JSON.stringify(rows),before);
});
test('个人日程按日期仅导出收藏，跨会场按时间排列，保留地点与备选标记',()=>{
 const programs=require('../source/data/main-programs.json').flatMap(p=>p.reports),all=book.reports.concat(programs),ids=new Set(['L-019','R-014','K-005','L-P001','topic-aps-workshop']),before=JSON.stringify(all);
 const rows=M.select(all,{kind:'oral',date:'2026-10-24',track:'',query:''},ids,true),p=E.plan({personal:true,label:'10月24日 周六',rows,priorities:{'R-014':'backup'},overlaps:new Set(['L-019'])},measure);
 assert.equal(p.pages.length,1);assert.deepEqual(reportIds(p),['K-005','R-014','L-019']);assert(p.header.lines.some(l=>l.text==='我的日程'));assert(!p.header.lines.some(l=>l.text.includes('undefined')));assert(p.pages[0].units.every(u=>u.type==='report'));
 for(const r of rows){const u=p.pages[0].units.find(u=>u.id===r.id),text=u.lines.map(l=>l.text).join('');assert(normalized(text).includes(normalized(r.title)));assert(normalized(text).includes(normalized(r.room)));assert(text.includes(r.trackCode+'会场'));}
 assert(p.pages[0].units.find(u=>u.id==='R-014').backup);assert(p.pages[0].units.find(u=>u.id==='R-014').lines.some(l=>l.text.includes('备选')));assert(p.pages[0].units.find(u=>u.id==='L-019').lines.some(l=>l.text.includes('首选')));
 const posters=M.select(all,{kind:'poster',date:'',query:''},ids,true),poster=E.plan({personal:true,label:'张贴报告',rows:posters,poster:true},measure);assert.deepEqual(reportIds(poster),['L-P001']);assert(poster.pages[0].units.every(u=>!u.start&&!u.end));assert.equal(JSON.stringify(all),before);
});
test('个人导出支持大会及专题，未列单场时间的大报告保留场次时段说明',()=>{
 const programs=require('../source/data/main-programs.json').flatMap(p=>p.reports),ids=new Set(['main-plenary-doeleman','topic-aps-workshop']),rows=M.select(programs,{kind:'oral',date:'2026-10-23',query:''},ids,true),p=E.plan({personal:true,label:'10月23日 周五',rows},measure);
 assert.deepEqual(reportIds(p),['main-plenary-doeleman','topic-aps-workshop']);const unit=p.pages[0].units[0];assert(unit.windowed);assert.equal(unit.start,'09:30');assert(unit.lines.some(l=>l.text.includes('开幕式与大会特邀报告')));assert(p.pages[0].units.find(u=>u.id==='topic-aps-workshop').lines.some(l=>l.text.includes('地点：')));
});
test('画布失败时降低分辨率重试，微信使用本地data图片，画布释放且无网络调用',async()=>{
 const track=book.meta.tracks.find(t=>t.trackCode==='R'),r=book.reports.find(r=>r.id==='R-014'),p=E.plan({track,label:'测试',rows:[r]},measure),canvases=[];let attempts=0;
 class Reader{readAsDataURL(){this.result='data:image/png;base64,bG9jYWw=';queueMicrotask(()=>this.onload());}}
 const win={setTimeout,clearTimeout,FileReader:Reader,navigator:{userAgent:'MicroMessenger'},fetch(){throw Error('不允许网络请求')},document:{createElement(){const ctx=new Proxy({},{get:(o,k)=>o[k]||(o[k]=()=>{}),set:(o,k,v)=>(o[k]=v,true)});const c={width:0,height:0,getContext:()=>ctx,toBlob(fn){attempts++;fn(attempts===1?null:{type:'image/png'})}};canvases.push(c);return c}}};
 const result=await E.renderImage(win,p,0,'导出时间');assert(result.src.startsWith('data:image/png'));assert.equal(attempts,2);assert(canvases.every(c=>c.width===1&&c.height===1));result.dispose();
});
test('WebKit离线拒绝读取Blob时直接从画布生成图片',async()=>{
 const track=book.meta.tracks.find(t=>t.trackCode==='R'),r=book.reports.find(r=>r.id==='R-014'),p=E.plan({track,label:'测试',rows:[r]},measure);let fallback=0;
 class Reader{readAsDataURL(){queueMicrotask(()=>this.onerror());}}
 const ctx=new Proxy({},{get:(o,k)=>o[k]||(o[k]=()=>{}),set:(o,k,v)=>(o[k]=v,true)}),canvas={getContext:()=>ctx,toBlob(fn){fn({type:'image/png'})},toDataURL(){fallback++;return 'data:image/png;base64,bG9jYWw='}};
 const result=await E.renderImage({document:{createElement:()=>canvas},FileReader:Reader,navigator:{userAgent:'Safari'},setTimeout,clearTimeout},p,0,'导出时间');assert.equal(fallback,1);assert(result.src.startsWith('data:image/png'));assert.equal(canvas.width,1);
});
test('导出入口按需加载脚本，模块不调用网络或写入浏览器收藏',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../source/agenda-export.js'),'utf8'),ui=fs.readFileSync(path.join(__dirname,'../source/agenda.js'),'utf8');assert(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage/.test(source));assert(ui.includes('loadExporter()'));assert(ui.includes("data-export-src")||fs.readFileSync(path.join(__dirname,'../source/index.html'),'utf8').includes('data-export-src'));assert(ui.includes("query:''"));assert(ui.includes('!exporting()'));
});
