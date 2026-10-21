(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else factory().start(root);})(typeof window==='object'?window:null,function(){
'use strict';
const started=new WeakSet(),page='https://zimin.li/agenda/',endpoint='https://cdn.busuanzi.cc/api.php';
async function start(win){
 if(!win||win.location.origin!=='https://zimin.li'||!/^\/agenda\/(?:index\.html)?$/.test(win.location.pathname)||typeof win.fetch!=='function'||started.has(win))return;
 const doc=win.document,box=doc.getElementById('visit-counter'),pv=doc.getElementById('visit-pv'),uv=doc.getElementById('visit-uv'),status=doc.getElementById('visit-status');
 if(!box||!pv||!uv||!status)return;
 started.add(win);box.hidden=false;box.dataset.state='loading';status.textContent='统计加载中…';
 const controller=win.AbortController?new win.AbortController():null;
 const timer=win.setTimeout(()=>{if(controller)controller.abort();box.dataset.state='unavailable';status.textContent='统计暂不可用';},5000);
 try{
  const response=await win.fetch(endpoint,{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({url:page,referrer:''}),...(controller?{signal:controller.signal}:{})});
  if(!response.ok)throw new Error('Counter unavailable');
  const data=await response.json(),views=data.busuanzi_page_pv,visitors=data.busuanzi_page_uv;
  if(!Number.isSafeInteger(views)||views<0||!Number.isSafeInteger(visitors)||visitors<0)throw new Error('Invalid counter');
  if(box.dataset.state!=='loading')return;
  pv.textContent=views.toLocaleString('zh-CN');uv.textContent=visitors.toLocaleString('zh-CN');box.dataset.state='ready';status.textContent='';
 }catch(error){box.dataset.state='unavailable';status.textContent='统计暂不可用';}
 finally{win.clearTimeout(timer);}
}
return {start};
});
