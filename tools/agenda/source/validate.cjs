'use strict';
const assert=require('node:assert/strict');
const book=require('./data/conference-latest.json'),programs=require('./data/main-programs.json');
const rows=[...book.reports,...programs.flatMap(p=>p.reports)];
assert.equal(book.reports.length,2847,'分会场记录数量不可变化');
assert.equal(rows.length,2885,'日程总记录数量不可变化');
assert.equal(new Set(rows.map(r=>r.id)).size,rows.length,'内部ID不可重复');
for(const r of rows){assert(r.id&&r.title&&r.trackCode,'必要字段缺失');for(const key of ['title','speaker','affiliation','room'])assert.equal(typeof(r[key]||''),'string');}
console.log('日程完整性检查通过：'+rows.length+'条记录');
