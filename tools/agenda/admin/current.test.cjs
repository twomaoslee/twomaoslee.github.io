'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),M=require('../source/agenda-model.js'),book=require('../source/data/conference-latest.json');

test('时钟按北京时间取当天日期与分钟',()=>{
 assert.deepEqual(M.clockNow('2026-10-24T05:40:00Z'),{date:'2026-10-24',minutes:820,time:'13:40'});
 assert.equal(M.clockNow('2026-10-24T16:30:00Z').date,'2026-10-25');
 assert.equal(M.clockNow('2026-10-24T16:30:00Z').time,'00:30');
 assert.equal(M.clockNow('nonsense').minutes,null);
 assert.equal(M.minutesOf('08:05'),485);
 assert.equal(M.minutesOf(''),null);
});

test('默认日期优先今天，其次最近的将来，会议结束后停在最后一天',()=>{
 const dates=['2026-10-22','2026-10-23','2026-10-24','2026-10-25'];
 assert.equal(M.defaultDate(dates,'2026-10-24'),'2026-10-24');
 assert.equal(M.defaultDate(dates,'2026-10-23'),'2026-10-23');
 assert.equal(M.defaultDate(['2026-10-25'],'2026-10-23'),'2026-10-25');
 assert.equal(M.defaultDate(['2026-10-22'],'2026-10-23'),'2026-10-22');
 assert.equal(M.defaultDate(['2026-10-23','2026-10-25'],'2026-10-24'),'2026-10-25');
 assert.equal(M.defaultDate([],'2026-10-24'),'');
});

test('当天日程全部结束后默认跳到下一个有会的日子',()=>{
 const dates=['2026-10-24','2026-10-25'];
 const rows=[{kind:'oral',date:'2026-10-24',start:'16:00',end:'17:10'},{kind:'poster',date:'2026-10-24'},{kind:'break',date:'2026-10-24',start:'17:10',end:'18:00'},{kind:'oral',date:'2026-10-25',start:'08:30',end:'09:00'}];
 assert.equal(M.defaultDate(dates,{date:'2026-10-24',minutes:15*60},rows),'2026-10-24');
 assert.equal(M.defaultDate(dates,{date:'2026-10-24',minutes:17*60+5},rows),'2026-10-24');
 assert.equal(M.defaultDate(dates,{date:'2026-10-24',minutes:17*60+10},rows),'2026-10-25');
 assert.equal(M.defaultDate(dates,{date:'2026-10-24',minutes:21*60+50},rows),'2026-10-25');
 assert.equal(M.defaultDate(['2026-10-24'],{date:'2026-10-24',minutes:21*60},rows),'2026-10-24');
 assert.equal(M.defaultDate(dates,{date:'2026-10-26',minutes:600},rows),'2026-10-25');
 assert.equal(M.defaultDate(dates,{date:'2026-10-24',minutes:null},rows),'2026-10-24');
});

test('真实日程：散场后进入 G1 默认落在 10月25日，白天仍在当天',()=>{
 const rows=book.reports.filter(r=>r.trackCode==='G1');
 const dates=[...new Set(rows.filter(r=>r.kind!=='break'&&r.date).map(r=>r.date))].sort();
 assert.equal(M.defaultDate(dates,M.clockNow('2026-10-24T03:00:00Z'),rows),'2026-10-24');
 assert.equal(M.defaultDate(dates,M.clockNow('2026-10-24T13:50:00Z'),rows),'2026-10-25');
 assert.equal(M.defaultDate(dates,M.clockNow('2026-10-24T10:00:00Z'),rows),'2026-10-25');
});

test('「回到现在」按钮文案随目标日期变化',()=>{
 assert.equal(M.jumpLabel('','2026-10-24'),'');
 assert.equal(M.jumpLabel('2026-10-25','2026-10-25'),'回到现在');
 assert.equal(M.jumpLabel('2026-10-25','2026-10-24'),'回到现在（25日）');
 assert.equal(M.jumpLabel('2026-10-22','2026-10-25'),'回到现在（22日）');
});

test('当前报告取正在进行的一场，没有则取下一场，当天结束返回空',()=>{
 const rows=[{id:'a',kind:'invited',start:'09:00',end:'09:20'},{id:'b',kind:'break',start:'09:20',end:'09:40'},{id:'c',kind:'oral',start:'09:40',end:'10:00'},{id:'p',kind:'poster',start:'',end:''}];
 const day='2026-10-24';
 assert.deepEqual(M.currentReport(rows,day,{date:day,minutes:9*60+50}),{id:'c',status:'live'});
 assert.deepEqual(M.currentReport(rows,day,{date:day,minutes:9*60+30}),{id:'c',status:'next'});
 assert.deepEqual(M.currentReport(rows,day,{date:day,minutes:8*60+30}),{id:'a',status:'next'});
 assert.equal(M.currentReport(rows,day,{date:day,minutes:10*60+30}),null);
 assert.equal(M.currentReport(rows,'2026-10-25',{date:day,minutes:9*60+50}),null);
 assert.equal(M.currentReport(rows,'',{date:day,minutes:9*60+50}),null);
});

test('真实日程：10月24日下午 G1 会场命中正在进行的报告',()=>{
 const rows=book.reports.filter(r=>r.trackCode==='G1'&&r.date==='2026-10-24');
 const now=M.clockNow('2026-10-24T07:00:00Z');
 assert.equal(now.time,'15:00');
 const mark=M.currentReport(rows,'2026-10-24',now);
 assert.ok(mark,'应命中一场报告');
 const row=rows.find(r=>r.id===mark.id);
 assert.equal(row.kind==='oral'||row.kind==='invited',true);
 assert.ok(row.start<=now.time&&now.time<row.end,'命中报告应覆盖当前时间');
});


test('会议是否已结束：以最后一场报告的结束时刻为界',()=>{
 const at=(h,m)=>({date:'2026-10-25',minutes:h*60+m});
 assert.equal(M.conferenceOver('2026-10-25T18:15',at(12,0)),false);
 assert.equal(M.conferenceOver('2026-10-25T18:15',at(18,0)),false);
 assert.equal(M.conferenceOver('2026-10-25T18:15',at(18,14)),false);
 assert.equal(M.conferenceOver('2026-10-25T18:15',at(18,15)),true);
 assert.equal(M.conferenceOver('2026-10-25T18:15',at(21,0)),true);
 assert.equal(M.conferenceOver('2026-10-25T18:15',{date:'2026-10-26',minutes:9*60}),true);
 assert.equal(M.conferenceOver('2026-10-25T18:15',{date:'2026-10-23',minutes:9*60}),false);
 assert.equal(M.conferenceOver('',at(21,0)),false);
 assert.equal(M.conferenceOver(undefined,at(21,0)),false);
 assert.equal(M.conferenceOver('2026-10-25T18:15',{date:'',minutes:null}),false);
});

test('真实日程：结束时刻与数据一致，18:15 之后才算散会',()=>{
 assert.equal(book.closesAt,'2026-10-25T18:15');
 assert.equal(M.conferenceOver(book.closesAt,M.clockNow('2026-10-25T09:00:00Z')),false);
 assert.equal(M.conferenceOver(book.closesAt,M.clockNow('2026-10-25T10:14:00Z')),false);
 assert.equal(M.conferenceOver(book.closesAt,M.clockNow('2026-10-25T10:15:00Z')),true);
 assert.equal(M.conferenceOver(book.closesAt,M.clockNow('2026-10-26T01:00:00Z')),true);
});
