(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.AgendaNavigation=factory();})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
function historyNavigation(win,options){
 let index=0,pending=false;
 const owned=state=>state&&state.agendaNav&&state.agendaNav.version===1&&Number.isSafeInteger(state.agendaNav.index)&&state.agendaNav.index>=0;
 function replace(){win.history.replaceState(Object.assign({},win.history.state,{agendaNav:{version:1,index,snapshot:options.capture()}}),'',options.url());}
 function navigate(change,overwrite){replace();change();if(!overwrite)index++;win.history[overwrite?'replaceState':'pushState'](Object.assign({},win.history.state,{agendaNav:{version:1,index,snapshot:options.capture()}}),'',options.url());}
 function receive(state){pending=false;if(owned(state)){index=state.agendaNav.index;options.restore(state.agendaNav.snapshot);}else{index=0;options.parse();replace();}}
 function back(){if(pending)return;if(index>0){replace();pending=true;win.history.back();}else if(options.fallback)navigate(options.fallback,true);}
 win.addEventListener('popstate',e=>receive(e.state));
 win.addEventListener('hashchange',()=>{if(!owned(win.history.state))receive(win.history.state);});
 win.addEventListener('pagehide',replace);
 if('scrollRestoration' in win.history)win.history.scrollRestoration='manual';
 if(owned(win.history.state))receive(win.history.state);else{options.parse();replace();}
 return {navigate,replace,back,canBack:()=>index>0};
}
function installSwipe(win,options){
 const doc=win.document;let gesture=null,suppressUntil=0;
 const excluded='input,textarea,select,a,summary,button:not(.report-title),[contenteditable]:not([contenteditable="false"]),[role="slider"]';
 function clear(){gesture=null;if(options.progress)options.progress(0);}
 doc.addEventListener('touchstart',e=>{
  clear();if(e.touches.length!==1||!options.canBack()||e.target.closest&&e.target.closest(excluded))return;
  const selection=win.getSelection&&win.getSelection();if(selection&&!selection.isCollapsed)return;
  const t=e.touches[0];if(t.clientX<24||t.clientX>Math.min(100,win.innerWidth*.28))return;
  gesture={id:t.identifier,x:t.clientX,y:t.clientY,time:e.timeStamp,locked:false};
 },{passive:true});
 doc.addEventListener('touchmove',e=>{
  if(!gesture)return;if(e.touches.length!==1){clear();return;}
  const t=Array.from(e.touches).find(t=>t.identifier===gesture.id);if(!t){clear();return;}
  const dx=t.clientX-gesture.x,dy=Math.abs(t.clientY-gesture.y);
  if(dx < -12||e.timeStamp-gesture.time>800||!gesture.locked&&dy>12&&dy>=Math.abs(dx)){clear();return;}
  if(dx>18&&dx>dy*2.5)gesture.locked=true;
  if(gesture.locked){if(e.cancelable)e.preventDefault();if(options.progress)options.progress(Math.max(0,Math.min(1,dx/Math.max(72,Math.min(100,win.innerWidth*.22)))));}
 },{passive:false});
 doc.addEventListener('touchend',e=>{
  if(!gesture)return;const g=gesture,t=Array.from(e.changedTouches).find(t=>t.identifier===g.id);clear();if(!t)return;
  const dx=t.clientX-g.x,dy=Math.abs(t.clientY-g.y),threshold=Math.max(72,Math.min(100,win.innerWidth*.22));
  if(g.locked&&dx>=threshold&&dy<=Math.min(40,dx*.35)&&e.timeStamp-g.time<=700&&options.canBack()){
   if(e.cancelable)e.preventDefault();suppressUntil=Date.now()+350;options.back();
  }
 },{passive:false});
 doc.addEventListener('touchcancel',clear,{passive:true});
 doc.addEventListener('click',e=>{if(e.detail>0&&Date.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();suppressUntil=0;}},true);
}
return {historyNavigation,installSwipe};
});
