(function(){
'use strict';
const $=id=>document.getElementById(id),book=window.CONFERENCE,M=window.AgendaModel;
if(!book||!M){$('summary').textContent='日程加载失败，请刷新页面重试。';return;}
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const chairText=s=>String(s||'').replace(/\s*编号\s*姓名\s*单位\s*题目\s*$/, '').trim();
const room=r=>(r||'').replace(/^中南大学潇湘校区/,'');
const type=r=>({invited:'邀请报告',oral:'口头报告',activity:'交流活动',poster:'张贴报告'}[r.kind]||'报告');
const byId=new Map(book.reports.map(r=>[r.id,r]));
const tracks=book.tracks.filter(t=>book.reports.some(r=>r.trackCode===t.trackCode&&r.kind!=='poster')).slice().sort((a,b)=>a.trackCode.localeCompare(b.trackCode));
const KEY='cps2026:agenda:favorites:v1';
let favoriteIds=new Set(),view='agenda',conflictIds=new Set(),detailId='',returnFocus=null,toastTimer,searchTimer,composing=false;
const states={agenda:{kind:'oral',date:'',track:'',query:'',page:1},mine:{kind:'all',date:'',track:'',query:'',page:1}};
function warn(text){$('storage-warning').textContent=text;$('storage-warning').hidden=false;}
try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved&&saved.schema===1&&Array.isArray(saved.ids))favoriteIds=new Set(saved.ids.filter(id=>byId.has(id)&&byId.get(id).kind!=='break'));}catch(error){warn('当前浏览器无法读取收藏，请检查是否限制了网站存储。');}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,1800);}
function toggleFavorite(id){if(!byId.has(id)||byId.get(id).kind==='break')return;const next=new Set(favoriteIds),add=!next.has(id);if(add)next.add(id);else next.delete(id);try{localStorage.setItem(KEY,JSON.stringify({schema:1,ids:Array.from(next)}));}catch(error){warn('收藏未保存：浏览器存储不可用或空间不足，请检查后重试。');return;}favoriteIds=next;render();if(detailId)renderDetail(detailId);toast(add?'已加入我的日程':'已取消收藏');}
$('track').innerHTML='<option value="">全部分会场</option>'+tracks.map(t=>`<option value="${esc(t.trackCode)}">${esc(t.track)}</option>`).join('');
function button(label,value,current,attribute){return `<button type="button" ${attribute}="${esc(value)}" aria-pressed="${current===value}">${esc(label)}</button>`;}
function render(){
 const s=states[view],mine=view==='mine',track=tracks.find(t=>t.trackCode===s.track),trackBook=book.reports.filter(r=>M.matches(r,s.track));
 const dates=Array.from(new Set(trackBook.map(r=>r.date).filter(Boolean))).sort();if(s.date&&!dates.includes(s.date))s.date='';
 const own=book.reports.filter(r=>favoriteIds.has(r.id)&&r.kind!=='break');conflictIds=M.conflicts(own);
 const totals=M.counts(trackBook),ownCounts=M.counts(own.filter(r=>M.matches(r,s.track)));
 $('page-title').textContent=mine?'我的日程':track?track.trackCode+'会场 · '+track.trackName:'大会日程';
 $('saved-total').textContent=mine?favoriteIds.size+' 项收藏':'已收藏 '+favoriteIds.size;
 $('summary').textContent=mine?'口头报告按时间排列，张贴报告单独列出。':totals.oral+' 场报告'+(totals.activity?' · '+totals.activity+' 项活动':'')+' · '+totals.poster+' 项张贴报告';
 $('venue').hidden=mine||!track||s.kind==='poster';$('venue').textContent=track?'地点：'+track.room:'';
 $('track-info').hidden=mine||!track;if(track)$('track-info-body').innerHTML=[['召集人',track.convener],['工作委员会',track.committee],['联系人',track.contact]].filter(pair=>pair[1]).map(pair=>`<p>${pair[0]}：${esc(pair[1])}</p>`).join('');
 const labels=mine?[['全部收藏','all'],['口头 '+(ownCounts.oral+ownCounts.activity),'oral'],['张贴 '+ownCounts.poster,'poster']]:[['口头日程 '+(totals.oral+totals.activity),'oral'],['张贴报告 '+totals.poster,'poster']];
 $('kind-tabs').innerHTML=labels.map(([label,value])=>button(label,value,s.kind,'data-kind')).join('');
 $('date-tabs').hidden=s.kind==='poster';$('date-tabs').innerHTML=button('全部日期','',s.date,'data-date')+dates.map(date=>button(Number(date.slice(5,7))+'月'+Number(date.slice(8,10))+'日 周'+'日一二三四五六'[new Date(date+'T12:00:00+08:00').getUTCDay()],date,s.date,'data-date')).join('');
 $('track').value=s.track;if($('search').value!==s.query)$('search').value=s.query;
 $('conflict-warning').hidden=!mine||!conflictIds.size;$('conflict-warning').textContent=conflictIds.size+' 项收藏存在时间重叠，请核对安排。';
 const filtered=M.select(book.reports,s,favoriteIds,mine),paged=M.page(filtered,s.page);s.page=paged.number;
 const total=filtered.filter(r=>r.kind!=='break').length;$('result-count').textContent='匹配 '+total+' 项'+(mine?'收藏':'日程');
 $('results').innerHTML=M.group(paged.rows,mine).map(g=>renderGroup(g,mine)).join('');
 $('empty').hidden=!!paged.rows.length;$('empty-title').textContent=mine&&!favoriteIds.size?'还没有收藏日程':'没有匹配的日程';$('empty-help').textContent=mine&&!favoriteIds.size?'在报告旁点击“☆”，即可加入这里。':'试试其他日期、分会场或关键词。';
 $('pager').hidden=paged.count<2;$('previous').disabled=paged.number===1;$('next').disabled=paged.number===paged.count;$('page-number').textContent='第 '+paged.number+' / '+paged.count+' 页';
 $('source').textContent=book.source+' · 点击题目查看完整信息';
 for(const name of ['agenda','mine']){if(name===view)$('tab-'+name).setAttribute('aria-current','page');else $('tab-'+name).removeAttribute('aria-current');}
 $('mine-badge').textContent=favoriteIds.size?'('+favoriteIds.size+')':'';
}
function renderGroup(g,mine){return `<section class="program"><h2 class="period-bar">${esc(g.title)}</h2>${mine?'':`<p class="track-bar">${esc(g.track)}${g.room?`<span class="group-room">${esc(room(g.room))}</span>`:''}</p>`}${g.sessions.map(s=>`${s.topic?`<p class="track-bar">${esc(s.topic)}</p>`:''}${s.chair?`<p class="chair-bar">主持人：${esc(chairText(s.chair))}</p>`:''}${s.rows.map((r,i)=>renderRow(r,i,mine)).join('')}`).join('')}</section>`;}
function renderRow(r,index,mine){if(r.kind==='break')return `<div class="break-row">${r.start?esc(r.start+'—'+r.end)+'　':''}${esc(r.title)}</div>`;const poster=r.kind==='poster',saved=favoriteIds.has(r.id);return `<article class="program-row ${index%2===0?'tinted':''}" data-report-id="${esc(r.id)}"><div class="time-column ${poster?'poster-column':''}">${r.kind!=='activity'?`<div class="row-number">${esc(r.number||r.id)}</div>`:''}${!poster&&r.start?`<div class="start-time">${esc(r.start)}</div><div class="end-time">—${esc(r.end)}</div>`:''}</div><div class="report-content"><div class="report-main">${!poster?`<div class="type-label">${esc(type(r))}</div>`:''}<button type="button" class="report-title" data-detail="${esc(r.id)}">${esc(r.title)}</button>${r.timeUncertain?'<p class="conflict">原表时间待核对</p>':''}${r.speaker||r.affiliation?`<p class="person-line"><span class="speaker">${esc(r.speaker)}</span><span class="affiliation">${esc(r.affiliation)}</span></p>`:''}${mine?`<div class="row-location">${esc(r.trackCode+'会场 · '+r.trackName)} · ${esc(room(r.room)||'原表未注明展示地点')}</div>`:''}${mine&&conflictIds.has(r.id)?'<p class="conflict">与其他收藏时间重叠</p>':''}</div><button type="button" class="star" data-star="${esc(r.id)}" aria-label="${saved?'取消收藏':'收藏'} ${esc(r.number||r.title)}" aria-pressed="${saved}">${saved?'★':'☆'}</button></div></article>`;}
function scrollToResults(){const top=$('app').getBoundingClientRect().top+window.scrollY;window.scrollTo({top:Math.max(0,top),behavior:'auto'});}
function changeFilter(values){Object.assign(states[view],values,{page:1});render();}
$('kind-tabs').addEventListener('click',e=>{const t=e.target.closest('[data-kind]');if(t)changeFilter({kind:t.dataset.kind,date:''});});
$('date-tabs').addEventListener('click',e=>{const t=e.target.closest('[data-date]');if(t)changeFilter({date:t.dataset.date});});
$('track').addEventListener('change',e=>{changeFilter({track:e.target.value});$('track-info').open=false;});
function search(){if(!composing){clearTimeout(searchTimer);searchTimer=setTimeout(()=>changeFilter({query:$('search').value}),100);}}
$('search').addEventListener('input',search);$('search').addEventListener('compositionstart',()=>composing=true);$('search').addEventListener('compositionend',()=>{composing=false;search();});
$('clear').addEventListener('click',()=>{clearTimeout(searchTimer);changeFilter({date:'',track:'',query:''});});
$('previous').addEventListener('click',()=>{states[view].page--;render();scrollToResults();});$('next').addEventListener('click',()=>{states[view].page++;render();scrollToResults();});
for(const name of ['agenda','mine'])$('tab-'+name).addEventListener('click',()=>{clearTimeout(searchTimer);states[view].query=$('search').value;view=name;render();scrollToResults();});
$('results').addEventListener('click',e=>{const star=e.target.closest('[data-star]'),title=e.target.closest('[data-detail]');if(star){const id=star.dataset.star;toggleFavorite(id);const focus=Array.from(document.querySelectorAll('[data-star]')).find(el=>el.dataset.star===id);if(focus)focus.focus({preventScroll:true});}else if(title){returnFocus=title;location.hash='report='+encodeURIComponent(title.dataset.detail);}});
function detailRow(label,text){return text?`<div class="detail-row"><span class="detail-label">${esc(label)}</span>${esc(text)}</div>`:'';}
function renderDetail(id){const r=byId.get(id);if(!r||r.kind==='break'){closeDetail();toast('这条报告不存在，请从日程列表查找。');return;}detailId=id;const saved=favoriteIds.has(id),poster=r.kind==='poster';$('detail-body').innerHTML=`<p class="detail-code">${esc(r.number||'')}　${esc(type(r))}</p><h2 class="detail-title" id="detail-title">${esc(r.title)}</h2>${!poster&&r.date?`<p class="detail-time">${esc(M.dateLabel(r.date))} · ${esc(r.period)}<br>${esc(r.start&&r.start+'—'+r.end)}</p>`:''}${detailRow('报告人 / 单位',[r.speaker,r.affiliation].filter(Boolean).join('　'))}${detailRow('分会场',r.trackCode+'会场 · '+r.trackName)}${detailRow('本段主持人',chairText(r.chair))}${detailRow('主题',r.sessionTitle)}${detailRow('会场位置',r.room||'原表未注明展示地点')}${conflictIds.has(id)?'<p class="warning">这场报告与其他收藏时间重叠，请确认参会安排。</p>':''}${r.abstract?detailRow('报告摘要',r.abstract):''}${r.sourceNote?`<p class="warning">${esc(r.sourceNote)}</p>`:''}<button type="button" class="detail-favorite" data-detail-star="${esc(id)}" aria-pressed="${saved}">${saved?'★ 已收藏 · 点击取消':'☆ 收藏到我的日程'}</button><p class="source-note">${esc([r.sourceLabel,r.sourceSheet,r.sourceRow?'第'+r.sourceRow+'行':''].filter(Boolean).join(' · '))}</p>`;$('detail-layer').hidden=false;document.body.classList.add('modal-open');}
function hashDetail(){const m=location.hash.match(/^#report=(.*)$/);if(m){let id;try{id=decodeURIComponent(m[1]);}catch(error){id='';}renderDetail(id);$('detail').focus();}else hideDetail();}
function hideDetail(){detailId='';$('detail-layer').hidden=true;document.body.classList.remove('modal-open');if(returnFocus&&document.contains(returnFocus))returnFocus.focus({preventScroll:true});returnFocus=null;}
function closeDetail(){if(location.hash.startsWith('#report='))history.replaceState(null,'',location.pathname+location.search);hideDetail();}
$('close-detail').addEventListener('click',closeDetail);$('detail-layer').addEventListener('click',e=>{if(e.target===$('detail-layer'))closeDetail();const star=e.target.closest('[data-detail-star]');if(star)toggleFavorite(star.dataset.detailStar);});
window.addEventListener('hashchange',hashDetail);document.addEventListener('keydown',e=>{if(!detailId)return;if(e.key==='Escape')closeDetail();if(e.key==='Tab'){const all=Array.from($('detail').querySelectorAll('button,a,input,select,[tabindex="0"]')).filter(el=>!el.disabled);if(!all.length)return;const first=all[0],last=all[all.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===$('detail'))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===$('detail'))){e.preventDefault();first.focus();}}});
render();hashDetail();
})();
