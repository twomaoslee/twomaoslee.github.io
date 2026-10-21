'use strict';
const CACHE_NAME='cps2026:agenda:assets:v1',CORE=["./assets/conference-data.d23bb7bac030f8fb.js","./assets/agenda.e2b329cba8ed3497.js","./assets/agenda-model.c05425ea431e996e.js","./assets/agenda-navigation.a1f2977e5c3759e9.js","./assets/agenda-updates.bcd59d8123aa7422.js","./assets/agenda-analytics.50245dec98b35b15.js","./assets/agenda-cache.591bff23cd8fa184.js","./assets/agenda.c03f649c13471d2c.css"],LIMIT=96;
const inFlight=new Map();
function cacheable(request){
 const url=new URL(request.url),base=new URL('assets/',self.registration.scope);
 return request.method==='GET'&&url.origin===base.origin&&!url.search&&url.pathname.startsWith(base.pathname)&&/^[a-z-]+\.[a-f0-9]{16}\.(?:js|css)$/.test(url.pathname.slice(base.pathname.length));
}
async function trim(cache){
 const keys=await cache.keys(),protectedURLs=new Set(CORE.map(path=>new URL(path,self.registration.scope).href));
 let excess=keys.length-LIMIT;
 for(const key of keys){if(excess<=0)break;if(!protectedURLs.has(key.url)){await cache.delete(key);excess--;}}
}
async function remember(cache,request,response){if(response.ok&&response.type==='basic'){await cache.put(request,response);await trim(cache);}}
async function asset(request,event){
 let cache;
 try{cache=await caches.open(CACHE_NAME);const hit=await cache.match(request);if(hit)return hit;}catch(error){return fetch(request);}
 let pending=inFlight.get(request.url);
 if(!pending){pending=fetch(request).then(response=>{event.waitUntil(remember(cache,request,response.clone()).catch(()=>{}));return response;}).finally(()=>inFlight.delete(request.url));inFlight.set(request.url,pending);}
 return (await pending).clone();
}
self.addEventListener('install',event=>{event.waitUntil((async()=>{
 try{const cache=await caches.open(CACHE_NAME);await Promise.all(CORE.map(async path=>{try{const request=new Request(new URL(path,self.registration.scope),{cache:'force-cache',credentials:'same-origin'});if(!await cache.match(request)){const response=await fetch(request);await remember(cache,request,response);}}catch(error){/* A failed warmup never blocks the page. */}}));}catch(error){/* Private mode or storage limits: use the network normally. */}
 await self.skipWaiting();
})());});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim());});
self.addEventListener('fetch',event=>{if(cacheable(event.request))event.respondWith(asset(event.request,event));});
