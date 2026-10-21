(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else factory().start(root);})(typeof window==='object'?window:null,function(){
'use strict';
const started=new WeakSet();
function start(win){
 if(!win||win.isSecureContext===false||!win.navigator.serviceWorker||!/^\/agenda\/(?:index\.html)?$/.test(win.location.pathname)||started.has(win))return;
 started.add(win);
 const register=()=>{try{const url=new URL('./agenda-cache-worker.js',win.location.href);Promise.resolve(win.navigator.serviceWorker.register(url.href,{scope:url.pathname.replace(/[^/]+$/,''),updateViaCache:'none'})).catch(()=>{});}catch(error){/* Normal HTTP caching remains available. */}};
 if(win.document.readyState==='complete')register();else win.addEventListener('load',register,{once:true});
}
return {start};
});
