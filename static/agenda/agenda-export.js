(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.AgendaImageExport=factory();})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
// Layout at twice a 390px phone width; large exports reduce pixel density,
// never split or omit reports. Canvas allocation stays bounded on phones.
const WIDTH=780,MAX_HEIGHT=30000,MAX_PIXELS=12000000,MARGIN=20,COLUMN=122,FOOTER=56;
const FONT='-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif';
const COLORS={background:'#f3f7fb',blue:'#165c91',text:'#203e55',muted:'#56758c',line:'#abc8dc',pale:'#e8f4fb',section:'#dcecf6'};
const font=(size,bold)=>`${bold?600:400} ${size}px ${FONT}`;
function wrap(value,width,measure,size,bold){
 const out=[];for(const paragraph of String(value||'').replace(/\r/g,'').split('\n')){
  if(!paragraph){out.push('');continue;}let line='';
  // Keep Latin words together; only an individually oversized word is split.
  for(const token of paragraph.match(/[A-Za-z0-9\u00c0-\u024f]+|[^]/gu)||[]){
   if(line&&measure(line+token,size,bold)>width){out.push(line);line='';}
   if(measure(token,size,bold)<=width)line+=token;
   else for(const character of Array.from(token)){if(line&&measure(line+character,size,bold)>width){out.push(line);line=character;}else line+=character;}
  }
  out.push(line);
 }return out;
}
function lines(value,width,measure,size,height,bold=false,color=COLORS.text){return wrap(value,width,measure,size,bold).map(text=>({text,size,height,bold,color}));}
function reportLines(r,poster,track,measure){
 const width=WIDTH-2*MARGIN-COLUMN-24,list=[];
 if(!poster)list.push(...lines(r.typeLabel||({invited:'邀请报告',oral:'口头报告',activity:'交流活动'}[r.kind]||'报告'),width,measure,22,30,false,COLORS.muted));
 list.push(...lines(r.title,width,measure,30,43,true));
 const person=[r.speaker,r.affiliation].filter(Boolean).join('　');
 if(person)list.push({text:'',height:6},...lines(person,width,measure,25,36,false,COLORS.muted));
 if(!poster&&r.room&&track.room&&r.room!==track.room)list.push(...lines('本报告地点：'+r.room,width,measure,24,34,false,COLORS.muted));
 if(r.timeUncertain)list.push(...lines('原表时间待核对',width,measure,24,34,false,'#8b6126'));
 return list;
}
function context(r,poster,measure){
 const text=poster?(r.sessionTitle||'张贴报告'):[r.period,r.sessionTitle].filter(Boolean).join(' · ')||'会议报告';
 const list=lines(text,WIDTH-2*MARGIN-24,measure,26,37,true,COLORS.blue);
 if(!poster&&r.chair)list.push(...lines('主持人：'+r.chair,WIDTH-2*MARGIN-24,measure,24,34,false,COLORS.muted));
 return {type:'section',key:r.session||text,lines:list,height:list.reduce((n,l)=>n+l.height,0)+18};
}
function header(track,label,measure){
 const list=[...lines('中国物理学会2026秋季学术会议',WIDTH-2*MARGIN,measure,24,35,false,COLORS.muted),{text:'',height:6},...lines(track.trackCode+'会场 · '+track.trackName,WIDTH-2*MARGIN,measure,40,54,true,COLORS.blue)];
 if(label!=='张贴报告'&&track.room)list.push({text:'',height:6},...lines('地点：'+track.room,WIDTH-2*MARGIN,measure,24,34,false,COLORS.muted));
 return {lines:list,height:22+list.reduce((n,l)=>n+l.height,0)+16+48+10,label};
}
// One complete long image for the selected day or all shared posters.
function plan({track,label,rows,poster=false},measure){
 if(!rows.length)throw Error('所选日期没有可导出的日程');
 const head=header(track,label,measure),page={units:[],height:head.height,ids:[]};let lastKey='',rowIndex=0;
 for(const r of rows){
  if(r.kind==='break'){
   const text=(r.start?r.start+'—'+r.end+'　':'')+r.title,body=lines(text,WIDTH-2*MARGIN-24,measure,24,34,false,COLORS.muted),height=body.reduce((n,l)=>n+l.height,0)+16;
   page.units.push({type:'break',id:r.id,lines:body,height});page.height+=height;continue;
  }
  const section=context(r,poster,measure),key=(r.period||'')+'|'+section.key;
  if(lastKey!==key){page.units.push(section);page.height+=section.height;lastKey=key;}
  const body=reportLines(r,poster,track,measure),height=Math.max(poster?60:108,body.reduce((n,l)=>n+l.height,0)+24);
  page.units.push({type:'report',id:r.id,number:r.number||'',start:poster?'':r.start||'',end:poster?'':r.end||'',poster,lines:body,height,tint:rowIndex%2===0});
  page.ids.push(r.id);page.height+=height;rowIndex++;
 }
 page.height+=FOOTER;
 return {width:WIDTH,header:head,track,label,poster,pages:[page],reportCount:rows.filter(r=>r.kind!=='break').length};
}
function drawText(ctx,list,x,y){for(const l of list){if(l.text){ctx.font=font(l.size,l.bold);ctx.fillStyle=l.color||COLORS.text;ctx.fillText(l.text,x,y+Math.max(0,(l.height-l.size)/2));}y+=l.height;}return y;}
function draw(ctx,layout,index,stamp){
 const page=layout.pages[index],width=WIDTH-2*MARGIN;
 ctx.textBaseline='top';ctx.fillStyle=COLORS.background;ctx.fillRect(0,0,WIDTH,page.height);ctx.fillStyle=COLORS.blue;ctx.fillRect(0,0,WIDTH,10);
 let y=22;y=drawText(ctx,layout.header.lines,MARGIN,y);y+=16;
 ctx.fillStyle=COLORS.blue;ctx.fillRect(MARGIN,y,width,48);ctx.font=font(28,true);ctx.fillStyle='#fff';ctx.fillText(layout.label,MARGIN+12,y+9);
 ctx.textAlign='right';ctx.font=font(24,false);ctx.fillText(layout.reportCount+' 项报告',WIDTH-MARGIN-12,y+12);ctx.textAlign='left';y+=58;
 for(const unit of page.units){
  ctx.fillStyle=unit.type==='section'?COLORS.section:unit.type==='break'?'#edf2f6':unit.tint?COLORS.pale:'#fff';ctx.fillRect(MARGIN,y,width,unit.height);ctx.strokeStyle=COLORS.line;ctx.lineWidth=1;ctx.strokeRect(MARGIN+.5,y+.5,width-1,unit.height);
  if(unit.type==='report'){
   ctx.beginPath();ctx.moveTo(MARGIN+COLUMN,y);ctx.lineTo(MARGIN+COLUMN,y+unit.height);ctx.stroke();
   const slot=unit.start?100:32;let ty=y+(unit.height-slot)/2;
   ctx.textAlign='center';ctx.font=font(22,true);ctx.fillStyle=COLORS.blue;ctx.fillText(unit.number,MARGIN+COLUMN/2,ty);ty+=30;
   if(unit.start){ctx.font=font(32,true);ctx.fillStyle=COLORS.text;ctx.fillText(unit.start,MARGIN+COLUMN/2,ty);ty+=40;ctx.font=font(24,false);ctx.fillText('—'+unit.end,MARGIN+COLUMN/2,ty);}
   ctx.textAlign='left';drawText(ctx,unit.lines,MARGIN+COLUMN+12,y+12);
  }else if(unit.type==='section')drawText(ctx,unit.lines,MARGIN+12,y+9);
  else {ctx.textAlign='center';drawText(ctx,unit.lines,WIDTH/2,y+8);ctx.textAlign='left';}
  y+=unit.height;
 }
 ctx.fillStyle=COLORS.muted;ctx.font=font(20,false);ctx.fillText(stamp,MARGIN,page.height-36);ctx.textAlign='right';ctx.fillText('zimin.li/agenda/',WIDTH-MARGIN,page.height-36);ctx.textAlign='left';
}
async function encode(canvas,win){
 if(typeof canvas.toBlob==='function')return new Promise((resolve,reject)=>{const timeout=win.setTimeout(()=>reject(Error('图片生成超时，请重试')),12000);try{canvas.toBlob(blob=>{win.clearTimeout(timeout);blob?resolve(blob):reject(Error('图片生成失败'));},'image/png');}catch(error){win.clearTimeout(timeout);reject(error);}});
 const data=canvas.toDataURL('image/png');if(!data.startsWith('data:image/png'))throw Error('当前浏览器无法生成图片');return {data};
}
function dataURL(blob,win){return new Promise((resolve,reject)=>{const reader=new win.FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('图片读取失败'));reader.readAsDataURL(blob);});}
function resolution(layout,factor=1){
 const height=layout.pages[0].height,scale=Math.min(1,(MAX_HEIGHT-1)/height,Math.sqrt((MAX_PIXELS-WIDTH)/(WIDTH*height)))*factor;
 const width=Math.max(1,Math.floor(WIDTH*scale));return {width,height:Math.ceil(height*width/WIDTH),scale:width/WIDTH};
}
async function renderImage(win,layout,index,stamp){
 for(const factor of [1,.75,.5]){
  const canvas=win.document.createElement('canvas');try{
   const size=resolution(layout,factor);canvas.width=size.width;canvas.height=size.height;const ctx=canvas.getContext('2d');if(!ctx)throw Error('当前浏览器无法生成图片');ctx.scale(size.scale,size.scale);draw(ctx,layout,index,stamp);
   const encoded=await encode(canvas,win);if(encoded.data)return {src:encoded.data,blob:null,dispose(){}};
   // Embedded browsers can reject blob-image navigation while offline. A local
   // data image also gives WeChat's native long-press menu a regular image source.
   if(typeof win.FileReader==='function'){
    let src;try{src=await dataURL(encoded,win);}catch{src=canvas.toDataURL('image/png');}
    if(!String(src).startsWith('data:image/png'))throw Error('当前浏览器无法生成图片');
    return {src,blob:encoded,dispose(){}};
   }
   const src=win.URL.createObjectURL(encoded);return {src,blob:encoded,dispose(){win.URL.revokeObjectURL(src);}};
  }catch(error){if(factor===.5)throw error;}finally{canvas.width=1;canvas.height=1;}
 }
}
function dateLabel(date){return Number(date.slice(5,7))+'月'+Number(date.slice(8,10))+'日 周'+'日一二三四五六'[new Date(date+'T12:00:00+08:00').getUTCDay()];}
function stamp(now){try{return '导出：'+new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(now);}catch{return '会议日程 · 请以网页最新安排为准';}}
let activeClose=null;
function closeActive(){if(activeClose)activeClose();}
// UI only reads supplied report data. No image upload, export API, analytics,
// or browser-storage mutation is performed by this module.
function open({win,track,initialKind,initialDate,prepare}){
 closeActive();const doc=win.document,previous=doc.activeElement,scroll=win.scrollY;
 const oldStyle={position:doc.body.style.position,top:doc.body.style.top,width:doc.body.style.width};
 const layer=doc.createElement('div');layer.className='export-layer';
 const panel=doc.createElement('section');panel.className='export-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','export-title');panel.tabIndex=-1;layer.appendChild(panel);
 function node(tag,className,text){const el=doc.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
 const toolbar=node('div','export-toolbar'),heading=node('h2','',track.trackCode+'会场 · 导出图片');heading.id='export-title';const close=node('button','export-close','关闭 ✕');close.type='button';toolbar.append(heading,close);panel.append(toolbar);
 const note=node('p','export-note','按日期导出完整日程，不受搜索关键词影响。'),choices=node('div','export-choices');choices.setAttribute('role','group');choices.setAttribute('aria-label','选择导出内容');
 const generate=node('button','export-generate','生成图片');generate.type='button';generate.disabled=true;
 const status=node('p','export-status','正在准备日程…');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const result=node('section','export-result');result.hidden=true;const hint=node('p','export-save-hint','长按图片保存到相册，可放大查看完整长图。');
 const image=node('img','export-image');image.alt='导出的分会场日程图片';image.draggable=false;
 const actions=node('div','export-image-actions'),download=node('a','export-download','下载图片'),share=node('button','export-share','分享图片');share.type='button';share.hidden=true;actions.append(download,share);result.append(hint,image,actions);
 panel.append(note,choices,generate,status,result);doc.body.append(layer);doc.body.classList.add('export-open');doc.body.style.position='fixed';doc.body.style.top=-scroll+'px';doc.body.style.width='100%';panel.focus();
 let closed=false,selected='',generation=0,layout=null,rendering=false,renderID=0,currentImage=null;
 function cleanupImages(){image.removeAttribute('src');if(currentImage)currentImage.dispose();currentImage=null;download.removeAttribute('href');}
 function closeDialog(){if(closed)return;closed=true;generation++;renderID++;cleanupImages();layer.remove();doc.body.classList.remove('export-open');Object.assign(doc.body.style,oldStyle);win.scrollTo(0,scroll);doc.removeEventListener('keydown',keydown);win.removeEventListener('popstate',closeDialog);win.removeEventListener('hashchange',closeDialog);if(previous&&doc.contains(previous))previous.focus({preventScroll:true});if(activeClose===closeDialog)activeClose=null;}
 function keydown(event){if(event.key==='Escape'){event.preventDefault();closeDialog();return;}if(event.key==='Tab'){const all=[...panel.querySelectorAll('button,a[href],input')].filter(el=>!el.disabled&&!el.hidden&&el.getClientRects().length);if(!all.length)return;const first=all[0],last=all[all.length-1];if(event.shiftKey&&(doc.activeElement===first||doc.activeElement===panel)){event.preventDefault();last.focus();}else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first.focus();}}}
 activeClose=closeDialog;close.onclick=closeDialog;layer.onclick=event=>{if(event.target===layer)closeDialog();};doc.addEventListener('keydown',keydown);win.addEventListener('popstate',closeDialog);win.addEventListener('hashchange',closeDialog);
 function busy(value){rendering=value;generate.disabled=value||!selected;for(const b of choices.children)b.disabled=value;}
 async function showImage(){
  const id=++renderID,requestGeneration=generation;busy(true);status.textContent='正在生成完整长图…';image.hidden=true;download.hidden=true;share.hidden=true;
  try{
   await new Promise(resolve=>win.setTimeout(resolve,20));if(closed||requestGeneration!==generation||id!==renderID)return;
   const entry=await renderImage(win,layout,0,stamp(new Date()));if(closed||requestGeneration!==generation||id!==renderID){entry.dispose();return;}
   currentImage=entry;image.onload=()=>{if(!closed&&id===renderID)image.hidden=false;};image.onerror=()=>{if(!closed&&id===renderID)status.textContent='图片暂时无法显示，请重新生成，或在系统浏览器中打开。';};image.src=entry.src;image.hidden=false;
   const filename=track.trackCode+'会场-'+layout.label.replace(/\s/g,'')+'.png';download.href=entry.src;download.download=filename;download.hidden=/MicroMessenger/i.test(win.navigator.userAgent);
   if(entry.blob&&typeof win.File==='function'&&typeof win.navigator.canShare==='function'&&typeof win.navigator.share==='function')try{share.hidden=!win.navigator.canShare({files:[new win.File([entry.blob],filename,{type:'image/png'})]});}catch{}
   status.textContent=layout.reportCount+' 项报告 · 已生成一张完整长图';result.hidden=false;
  }catch(error){if(!closed&&id===renderID){status.textContent=error.message||'图片生成失败，请重试';result.hidden=true;}}
  finally{if(!closed&&id===renderID)busy(false);}
 }
 function choose(value){if(selected&&selected!==value){cleanupImages();layout=null;result.hidden=true;status.textContent='点击生成图片，导出所选内容。';}selected=value;for(const b of choices.children)b.setAttribute('aria-pressed',String(b.dataset.value===value));generate.disabled=rendering;}
 generate.onclick=async()=>{
  const id=++generation;renderID++;cleanupImages();layout=null;result.hidden=true;busy(true);status.textContent='正在准备完整日程…';
  try{const kind=selected==='poster'?'poster':'oral',date=kind==='poster'?'':selected;const data=await prepare(kind,date);if(closed||id!==generation)return;if(!data.rows.length)throw Error('所选内容没有可导出的报告');
   if(doc.fonts?.ready)await doc.fonts.ready;await new Promise(resolve=>win.setTimeout(resolve,20));if(closed||id!==generation)return;
   const canvas=doc.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx)throw Error('当前浏览器无法生成图片，请使用系统浏览器打开');
   layout=plan({track,label:kind==='poster'?'张贴报告':dateLabel(date),rows:data.rows,poster:kind==='poster'},(text,size,bold)=>{ctx.font=font(size,bold);return ctx.measureText(text).width;});canvas.width=1;canvas.height=1;
   await showImage();
  }catch(error){if(!closed&&id===generation)status.textContent=error.message||'生成失败，请重试';}
  finally{if(!closed&&id===generation)busy(false);}
 };
 share.onclick=async()=>{if(!currentImage?.blob)return;try{await win.navigator.share({files:[new win.File([currentImage.blob],download.download,{type:'image/png'})]});}catch(error){if(error.name!=='AbortError')status.textContent='分享未成功，可以长按图片保存。';}};
 prepare('choices','').then(data=>{if(closed)return;status.textContent='每天一张长图；张贴报告单独一张。';const options=data.dates.map(date=>({value:date,label:dateLabel(date)}));if(data.hasPoster)options.push({value:'poster',label:'张贴报告'});
  for(const option of options){const b=node('button','export-choice',option.label);b.type='button';b.dataset.value=option.value;b.setAttribute('aria-pressed','false');b.onclick=()=>{if(!rendering)choose(option.value);};choices.append(b);}
  if(!options.length){status.textContent='该分会场暂无可导出的日程';return;}choose(initialKind==='poster'&&data.hasPoster?'poster':data.dates.includes(initialDate)?initialDate:options[0].value);
 }).catch(error=>{if(!closed)status.textContent=error.message||'日程读取失败，请关闭后重试';});
 return {close:closeDialog};
}
return {WIDTH,MAX_HEIGHT,MAX_PIXELS,wrap,plan,resolution,draw,renderImage,open,closeActive,isOpen:()=>!!activeClose};
});
