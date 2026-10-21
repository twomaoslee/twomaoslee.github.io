(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else factory().start(root);})(typeof window==='object'?window:null,function(){
'use strict';
const started=new WeakSet(),page='https://zimin.li/agenda/',endpoint='https://events.vercount.one/api/v2/log',storageKey='cps2026:agenda:visit-count:vercount:v1';
const valid=count=>Number.isSafeInteger(count)&&count>=0;
async function start(win){
 if(!win||win.location.origin!=='https://zimin.li'||!/^\/agenda\/(?:index\.html)?$/.test(win.location.pathname)||typeof win.fetch!=='function'||started.has(win))return;
 const doc=win.document,box=doc.getElementById('visit-counter'),pv=doc.getElementById('visit-pv'),status=doc.getElementById('visit-status');
 if(!box||!pv||!status)return;
 started.add(win);box.hidden=false;box.dataset.state='loading';status.textContent='统计加载中…';
 let cached=null;
 try{const value=JSON.parse(win.localStorage.getItem(storageKey));if(value&&valid(value.count))cached=value.count;}catch(error){}
 if(cached!==null){pv.textContent=cached.toLocaleString('zh-CN');box.title='最近一次成功获取的累计访问次数';}
 const unavailable=()=>{box.dataset.state=cached===null?'unavailable':'cached';status.textContent=cached===null?'统计暂不可用':'显示最近一次成功获取的累计访问次数';};
 const controller=win.AbortController?new win.AbortController():null;
 const timer=win.setTimeout(()=>{if(controller)controller.abort();unavailable();},5000);
 try{
  const response=await win.fetch(endpoint,{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:page,isNewUv:false}),...(controller?{signal:controller.signal}:{})});
  if(!response.ok)throw new Error('Counter unavailable');
  const data=await response.json(),views=data&&data.data&&data.data.page_pv;
  if(!data||data.status!=='success'||!valid(views))throw new Error('Invalid counter');
  if(box.dataset.state!=='loading')return;
  pv.textContent=views.toLocaleString('zh-CN');box.dataset.state='ready';box.title='';status.textContent='';
  try{win.localStorage.setItem(storageKey,JSON.stringify({count:views}));}catch(error){}
 }catch(error){unavailable();}
 finally{win.clearTimeout(timer);}
}
return {start};
});
