const {assetPath}=require('./cache-build.cjs');
// Payloads are independent of the conference revision, so an edit to K never
// changes the content-addressed URL of L or any other unaffected venue.
function split(book){
 const chunks={},files={},previewFields=['id','title','room','date','start','end','section','label','shortRoom'];
 function add(key,reports,extra={}){
  const bytes=Buffer.from(JSON.stringify({schema:1,key,reports,...extra}));
  const url=assetPath('chunk-'+key.toLowerCase()+'.json',bytes);files[url]=bytes;
  const first=reports[0],kinds={};for(const r of reports)(kinds[r.kind]||(kinds[r.kind]=[])).push(r.id);
  const descriptor={url,trackCode:first.trackCode,kinds};
  if(first.sharedWith?.length)descriptor.sharedWith=first.sharedWith;
  if(first.programId)descriptor.programId=first.programId;
  chunks[key]=descriptor;
 }
 for(const track of book.tracks){
  const reports=book.reports.filter(r=>r.trackCode===track.trackCode);
  for(const poster of [false,true]){const rows=reports.filter(r=>(r.kind==='poster')===poster);if(rows.length)add((poster?'poster-':'track-')+track.trackCode,rows);}
 }
 const programs=book.programs.map(p=>{
  const key='program-'+p.id;add(key,p.reports,{program:p});
  const preview=Object.fromEntries(previewFields.filter(k=>p[k]!==undefined).map(k=>[k,p[k]]));
  preview.speakers=p.reports.filter(r=>r.portrait).map(({id,speaker,portrait})=>({id,speaker,portrait}));
  return preview;
 });
 const catalog={schema:1,version:book.version,title:book.title,source:book.source,tracks:book.tracks,favoriteMigrations:book.favoriteMigrations,programs,chunks};
 return {catalog,files};
}
module.exports={split};
