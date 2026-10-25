'use strict';
const assert=require('node:assert/strict');
const book=require('./data/conference-latest.json'),programs=require('./data/main-programs.json');
const rows=[...book.reports,...programs.flatMap(p=>p.reports)];
assert.equal(book.reports.length,2852,'分会场记录数量不可变化');
assert.equal(rows.length,2890,'日程总记录数量不可变化');
assert.equal(new Set(rows.map(r=>r.id)).size,rows.length,'内部ID不可重复');
for(const r of rows){assert(r.id&&r.title&&r.trackCode,'必要字段缺失');for(const key of ['title','speaker','affiliation','room'])assert.equal(typeof(r[key]||''),'string');}
const closingEnds=book.reports.filter(r=>['oral','invited','activity'].includes(r.kind)&&r.date&&r.end).map(r=>r.date+'T'+r.end).sort();
assert(closingEnds.length,'缺少可计算会议结束时间的报告');
assert.equal(book.closesAt,closingEnds[closingEnds.length-1],'closesAt 必须等于最后一场报告的结束时刻');
console.log('日程完整性检查通过：'+rows.length+'条记录，会议结束于 '+book.closesAt);
