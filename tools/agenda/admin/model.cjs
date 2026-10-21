'use strict';
const crypto=require('node:crypto');
const FIELDS={title:'报告题目',speaker:'报告人',affiliation:'单位',date:'日期',start:'开始时间',end:'结束时间',room:'地点',chair:'主持人',abstract:'摘要'};
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const copy=x=>JSON.parse(JSON.stringify(x));
class UserError extends Error {constructor(message,status=400){super(message);this.status=status;}}
const all=data=>[...data.book.reports,...data.programs.flatMap(p=>p.reports)];
function validatePatch(report,patch){
 if(!patch||Array.isArray(patch)||typeof patch!=='object')throw new UserError('修改内容格式不正确');
 for(const [k,v] of Object.entries(patch)){
  if(!Object.hasOwn(FIELDS,k))throw new UserError('编号、内部标识和分组不能在这里修改');
  if(typeof v!=='string'||v.length>(k==='abstract'?20000:2000)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v))throw new UserError('字段内容过长或包含无效字符');
 }
 const next={...report,...patch};
 if(report.contentItems&&['speaker','affiliation','abstract'].some(k=>Object.hasOwn(patch,k)&&patch[k]!==report[k]))throw new UserError('该活动的分项报告内容需由技术人员维护');
 if(!next.title.trim())throw new UserError('请填写报告题目');
 if(report.date&&!next.date)throw new UserError('请保留报告日期');
 if(next.kind==='poster'&&[next.date,next.start,next.end].some(Boolean))throw new UserError('张贴报告不填写日期和时段');
 if(next.date){const d=new Date(next.date+'T00:00:00Z');if(!/^2026-10-\d{2}$/.test(next.date)||!Number.isFinite(+d)||d.toISOString().slice(0,10)!==next.date||next.date<'2026-10-22'||next.date>'2026-10-25')throw new UserError('日期应在2026年10月22日至25日之间');}
 for(const k of ['start','end'])if(next[k]&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(next[k]))throw new UserError('时间请填写为 HH:mm');
 if(!!next.start!==!!next.end)throw new UserError('开始时间和结束时间需同时填写');
 if(next.start&&(!next.date||next.start>=next.end))throw new UserError('结束时间必须晚于开始时间，且需填写日期');
 return next;
}
function apply(data,changes){
 const out=copy(data),map=new Map(all(out).map(r=>[r.id,r]));
 for(const [id,patch] of Object.entries(changes)){
  const r=map.get(id);if(!r)throw new UserError('报告已不存在，请重新加载',409);
  const next=validatePatch(r,patch);
  if(Object.hasOwn(patch,'start')&&next.start!==r.start&&next.start){const hour=Number(next.start.slice(0,2));next.period=hour<12?'上午':hour<18?'下午':'晚上';}
  const sessionKeys=['date','chair','start'];
  if(sessionKeys.some(k=>Object.hasOwn(patch,k)&&r[k]!==patch[k])){
   // Existing sessions carry time/day/chair context. Do not leave stale headers.
   let parts=String(r.session||'').split('|');
   if(parts.length>=3){if(Object.hasOwn(patch,'date'))parts[1]=next.date;if(Object.hasOwn(patch,'start')&&['上午','下午','晚上'].includes(parts[2]))parts[2]=next.period;if(Object.hasOwn(patch,'chair')&&parts.length>=5)parts[parts.length-1]=next.chair;next.session=parts.join('|');}
  }
  Object.assign(r,next);
  const program=out.programs.find(p=>p.reports.some(item=>item.id===id));
  if(program&&program.reports.filter(item=>item.kind!=='break').length===1){
   for(const key of ['date','start','end','room'])if(Object.hasOwn(patch,key))program[key]=next[key];
   if(Object.hasOwn(patch,'room'))program.shortRoom=next.room.replace(/^中南大学潇湘校区/,'');
   if(Object.hasOwn(patch,'title')&&program.title===reportTitle(data,id))program.title=next.title;
  }
 }
 return out;
}
function reportTitle(data,id){return all(data).find(r=>r.id===id)?.title;}
function diff(before,after){
 const old=new Map(all(before).map(r=>[r.id,r])),rows=all(after);
 if(old.size!==rows.length||new Set(rows.map(r=>r.id)).size!==rows.length)throw new UserError('报告数量或内部标识发生改变，已阻止发布');
 const changes=[];
 for(const r of rows){const prev=old.get(r.id);if(!prev||prev.number!==r.number||prev.trackCode!==r.trackCode||prev.kind!==r.kind)throw new UserError('报告编号、分会场或内部标识发生改变，已阻止发布');
  const fields=Object.keys(FIELDS).filter(k=>(prev[k]||'')!==(r[k]||'')).map(k=>({key:k,label:FIELDS[k],before:prev[k]||'',after:r[k]||''}));
  if(fields.length)changes.push({id:r.id,number:r.number||r.id,speaker:r.speaker,title:r.title,track:r.track,fields});
 }
 return changes;
}
function normalize(data){
 const out=copy(data);out.book.version='ADMIN-20261021-'+hash({reports:out.book.reports,programs:out.programs}).slice(0,12);return out;
}
function warnings(changes){return changes.some(r=>r.fields.some(f=>['date','start','end','chair'].includes(f.key)))?['日期、时间和主持人只作用于所选报告；如果整个场次调整，请逐条检查。']:[];}
module.exports={FIELDS,hash,copy,UserError,all,validatePatch,apply,diff,normalize,warnings};
