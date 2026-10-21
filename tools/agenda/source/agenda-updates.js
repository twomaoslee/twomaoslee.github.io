(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.AgendaUpdates=factory();})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
function watch(win,options){
 const doc=win.document,now=options.now||(()=>Date.now()),valid=revision=>typeof revision==='string'&&/^[a-f0-9]{10}$/.test(revision);
 let lastCheck=-Infinity,inFlight=false,latest='',loading=false;
 async function check(){
  if(doc.visibilityState==='hidden'||win.navigator.onLine===false||inFlight||now()-lastCheck<30000||!valid(options.current))return;
  inFlight=true;lastCheck=now();
  const controller=win.AbortController?new win.AbortController():null;
  const timer=controller?win.setTimeout(()=>controller.abort(),8000):null;
  try{
   const url=new URL('./version.json',win.location.href);url.searchParams.set('check',String(now()));
   const response=await win.fetch(url.href,{cache:'no-store',credentials:'omit',mode:'same-origin',...(controller?{signal:controller.signal}:{})});
   if(!response.ok)return;const manifest=await response.json();
   if(!manifest||manifest.schema!==1||!valid(manifest.revision))return;
   latest=manifest.revision===options.current?'':manifest.revision;
   options.available(latest);
  }catch(error){/* Keep the current agenda usable while offline or during a failed deployment check. */}
  finally{if(timer!==null)win.clearTimeout(timer);inFlight=false;}
 }
 function load(){
  if(!latest||loading)return;
  if(win.navigator.onLine===false){if(options.failed)options.failed('当前离线，请联网后加载');return;}
  loading=true;if(options.loading)options.loading(true);
  try{options.reload(latest);}catch(error){loading=false;if(options.loading)options.loading(false);if(options.failed)options.failed('暂时无法加载，请稍后重试');}
 }
 win.addEventListener('pageshow',check);win.addEventListener('focus',check);win.addEventListener('online',()=>{lastCheck=-Infinity;check();});
 doc.addEventListener('visibilitychange',check);
 win.setInterval(check,300000);
 check();
 return {check,load};
}
return {watch};
});
