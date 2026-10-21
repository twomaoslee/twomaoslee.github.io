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
test('34个分会场所有日期与共享张贴逐一覆盖，分图不遗漏不重复，不超过1080×3000',()=>{
 let plans=0;for(const track of book.meta.tracks.filter(t=>book.reports.some(r=>r.trackCode===t.trackCode&&r.kind!=='poster'))){const source=book.reports.filter(r=>M.matches(r,track.trackCode));const dates=[...new Set(source.filter(r=>r.kind!=='poster'&&r.kind!=='break').map(r=>r.date))];for(const choice of dates.concat(source.some(r=>r.kind==='poster')?['poster']:[])){const poster=choice==='poster',rows=M.select(book.reports,{kind:poster?'poster':'oral',track:track.trackCode,date:poster?'':choice,query:''},new Set(),false),layout=E.plan({track,label:poster?'张贴报告':M.dateLabel(choice),rows,poster},measure);
   assert.equal(layout.width,1080);assert(layout.pages.length);for(const p of layout.pages){assert(p.height<=3000);assert(p.height>layout.header.height);assert(p.units.some(u=>u.type==='report'));assert(p.units.every(u=>u.height>0));}
   const ids=reportIds(layout),expected=rows.filter(r=>r.kind!=='break').map(r=>r.id);assert.deepEqual(ids,expected,track.trackCode+' '+choice);for(const r of rows.filter(r=>r.kind!=='break')){const text=layout.pages.flatMap(p=>p.units).filter(u=>u.id===r.id).flatMap(u=>u.lines).map(l=>l.text).join('');assert(normalized(text).includes(normalized(r.title)),r.id);if(r.speaker)assert(normalized(text).includes(normalized(r.speaker)),r.id);if(r.affiliation)assert(normalized(text).includes(normalized(r.affiliation)),r.id);}
   if(poster)assert(layout.pages.flatMap(p=>p.units).filter(u=>u.type==='report').every(u=>!u.start&&!u.end));plans++;
  }}assert(plans>85);
});
test('J子会场导出完整375项共享张贴，分图包含主题，日期互不混入',()=>{
 const track=book.meta.tracks.find(t=>t.trackCode==='JA'),rows=M.select(book.reports,{track:'JA',kind:'poster',query:''},new Set(),false);assert.equal(rows.length,375);const p=E.plan({track,label:'张贴报告',rows,poster:true},measure);assert(p.pages.length>20);assert.equal(new Set(reportIds(p)).size,375);assert(p.pages.flatMap(p=>p.units).some(u=>u.type==='section'&&u.lines.some(l=>l.text)));
 const c=book.meta.tracks.find(t=>t.trackCode==='C');for(const date of ['2026-10-23','2026-10-24','2026-10-25']){const selected=M.select(book.reports,{track:'C',kind:'oral',date,query:''},new Set(),false);const layout=E.plan({track:c,label:date,rows:selected},measure);assert(reportIds(layout).every(id=>book.reports.find(r=>r.id===id).date===date));}
});
test('超长单项报告继续到下一张，不裁字；空数据和超长场次标题明确失败',()=>{
 const track=book.meta.tracks.find(t=>t.trackCode==='R'),sample=book.reports.find(r=>r.id==='R-014'),title='完整保留超长报告题目α₂'.repeat(500),r={...sample,title};const p=E.plan({track,label:'测试日期',rows:[r]},measure);assert(p.pages.length>3);assert(p.pages.every(p=>p.height<=3000));const all=p.pages.flatMap(p=>p.units.filter(u=>u.type==='report'));assert(all.slice(1).every(u=>u.continued));assert(normalized(all.flatMap(u=>u.lines).map(l=>l.text).join('')).includes(normalized(title)));
 assert.throws(()=>E.plan({track,label:'',rows:[]},measure),/没有可导出/);assert.throws(()=>E.plan({track,label:'',rows:[{...sample,chair:'主持信息'.repeat(2000)}]},measure),/场次信息过长/);
});
test('R更新后的导出保留茶歇和新主持人，不含已取消报告，源对象不被修改',()=>{
 const track=book.meta.tracks.find(t=>t.trackCode==='R'),rows=M.select(book.reports,{track:'R',kind:'oral',date:'2026-10-24',query:''},new Set(),false),before=JSON.stringify(rows);const p=E.plan({track,label:'10月24日 周六',rows},measure);assert.equal(p.reportCount,18);const text=p.pages.flatMap(p=>p.units).flatMap(u=>u.lines).map(l=>l.text).join('');assert(text.includes('14:50—15:25'));assert(text.includes('李俊'));assert(!text.includes('龚韬'));assert(!reportIds(p).includes('R-013'));assert.equal(JSON.stringify(rows),before);
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
