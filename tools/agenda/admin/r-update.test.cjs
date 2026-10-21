'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),book=require('../source/data/conference-latest.json');
test('R取消龚韬后仅显示编号顺延，剩余报告收藏身份和原时段保留',()=>{
 const rows=book.reports.filter(r=>r.trackCode==='R'),talks=rows.filter(r=>/^R-\d{3}$/.test(r.number));
 assert(!rows.some(r=>r.id==='R-013'||r.speaker==='龚韬'||r.chair.includes('龚韬')));
 assert.equal(talks.length,33);assert.deepEqual(talks.map(r=>r.number),Array.from({length:33},(_,i)=>'R-'+String(i+1).padStart(3,'0')));
 const z=rows.find(r=>r.id==='R-014');assert.deepEqual([z.number,z.speaker,z.start,z.end],['R-014','张靖','15:25','15:50']);
 const y=rows.find(r=>r.id==='R-020');assert.deepEqual([y.number,y.speaker,y.date,y.start,y.end],['R-019','余金清','2026-10-25','08:30','08:55']);
 const final=rows.find(r=>r.id==='R-035');assert.equal(final.number,'R-033');assert.equal(final.speaker,'李丽灵');
 const tea=rows.find(r=>r.id==='R-BREAK-60-L-22');assert.deepEqual([tea.title,tea.date,tea.start,tea.end],['茶歇','2026-10-24','14:50','15:25']);
 const session=rows.filter(r=>r.date==='2026-10-24'&&r.sessionTitle==='流体力学不稳定性');assert.equal(session.length,6);assert(session.every(r=>r.chair==='李俊（中国科学技术大学）'&&r.session.endsWith(r.chair)));
 assert.deepEqual(rows.filter(r=>r.kind==='poster').map(r=>r.number),Array.from({length:9},(_,i)=>'R-P'+String(i+1).padStart(3,'0')));
});
