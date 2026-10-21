const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {assetPath,renderHTML}=require('./cache-build.cjs');
const {split}=require('./lazy-build.cjs');
const book=require('./data/conference-latest.json'),programs=require('./data/main-programs.json');
const out=process.env.AGENDA_OUTPUT?path.resolve(process.env.AGENDA_OUTPUT):path.resolve(__dirname,'../../../static/agenda');fs.mkdirSync(out,{recursive:true});
const fields=['id','number','kind','title','speaker','affiliation','room','date','start','end','period','chair','sessionTitle','session','sourceLabel','sourceSheet','sourceNote','abstract'];
const texts=[''],dict=new Map([['',0]]);const intern=s=>{s=String(s||'');if(!dict.has(s)){dict.set(s,texts.length);texts.push(s);}return dict.get(s);};
const meta=book.meta.tracks;const index=new Map(meta.map((t,i)=>[t.trackCode,i]));
const rows=book.reports.map(r=>[index.get(r.trackCode),r.sequence||0,r.sourceRow||0,r.timeUncertain?1:0,r.sharedWith||[],...fields.map(f=>intern(r[f]))]);
const favoriteMigrations={'main-plenary':programs.find(p=>p.id==='MAIN').reports.filter(r=>r.typeLabel==='大会特邀报告').map(r=>r.id)};
const code=`'use strict';\nwindow.CONFERENCE=(function(){const meta=${JSON.stringify(meta)},strings=${JSON.stringify(texts)},fields=${JSON.stringify(fields)},entries=${JSON.stringify(rows)};return {version:${JSON.stringify(book.version)},title:${JSON.stringify(book.meta.title)},source:${JSON.stringify(book.source)},tracks:meta,favoriteMigrations:${JSON.stringify(favoriteMigrations)},programs:${JSON.stringify(programs)},reports:entries.map(function(a){const m=meta[a[0]],r={track:m.track,trackCode:m.trackCode,trackName:m.trackName,sequence:a[1],sourceRow:a[2],timeUncertain:!!a[3],sharedWith:a[4]};fields.forEach(function(k,i){r[k]=strings[a[i+5]];});return r;})};})();\n`;
fs.writeFileSync(out+'/conference-data.js',code);
// Keep the complete compatibility bundle for the native-project sync tool and
// old pages, but the current HTML only requests the lightweight catalog.
const sandbox={window:{}};require('node:vm').runInNewContext(code,sandbox);
const partition=split(sandbox.window.CONFERENCE);
// The first visit downloads one compact snapshot after rendering the directory.
// It also records chunk hashes, so subsequent visits can reuse unchanged parts
// of an older cached snapshot without downloading a new complete file.
const completeBytes=Buffer.from(JSON.stringify({schema:1,version:book.version,meta,strings:texts,fields,entries:rows,programs,chunkURLs:Object.fromEntries(Object.entries(partition.catalog.chunks).map(([key,c])=>[key,c.url]))}));
const completeURL=assetPath('conference-complete.json',completeBytes);
partition.catalog.fullData={url:completeURL,version:book.version};
const catalogCode="'use strict';\nwindow.CONFERENCE_CATALOG="+JSON.stringify(partition.catalog)+';\n';
fs.writeFileSync(out+'/conference-catalog.js',catalogCode);
const files=['agenda-data.js','agenda.js','agenda-model.js','agenda-navigation.js','agenda-updates.js','agenda-analytics.js','agenda-cache.js','agenda.css'];
const contents={'conference-catalog.js':Buffer.from(catalogCode)};
for(const file of files)contents[file]=fs.readFileSync(__dirname+'/'+file);
const assets=Object.fromEntries(Object.entries(contents).map(([file,bytes])=>[file,assetPath(file,bytes)]));
fs.mkdirSync(out+'/assets',{recursive:true});
// Keep earlier content-addressed files: cached old HTML must still load a complete matching release.
for(const [file,url]of Object.entries(assets))fs.writeFileSync(path.join(out,url),contents[file]);
for(const [url,bytes]of Object.entries(partition.files))fs.writeFileSync(path.join(out,url),bytes);
fs.writeFileSync(path.join(out,completeURL),completeBytes);
const workerSource=fs.readFileSync(__dirname+'/agenda-cache-worker.js','utf8');
const worker=workerSource.replace('__CORE_ASSETS__',JSON.stringify(Object.values(assets))).replace('__DATA_ASSETS__',JSON.stringify([completeURL,...Object.keys(partition.files)]));
const revisionHash=crypto.createHash('sha256').update(code);
fs.cpSync(__dirname+'/images',out+'/images',{recursive:true});for(const file of fs.readdirSync(__dirname+'/images').sort())revisionHash.update(fs.readFileSync(__dirname+'/images/'+file));
for(const file of ['index.html',...files])revisionHash.update(fs.readFileSync(__dirname+'/'+file));
revisionHash.update(worker);
const rev=revisionHash.digest('hex').slice(0,10);
const html=renderHTML(fs.readFileSync(__dirname+'/index.html','utf8'),assets,rev);fs.writeFileSync(out+'/index.html',html);
for(const file of files)fs.copyFileSync(__dirname+'/'+file,out+'/'+file);
fs.writeFileSync(out+'/agenda-cache-worker.js',worker);
fs.writeFileSync(out+'/asset-manifest.json',JSON.stringify({schema:1,revision:rev,assets,chunks:Object.keys(partition.files),fullData:completeURL},null,2));
fs.writeFileSync(out+'/version.json',JSON.stringify({schema:1,revision:rev}));
const programRecords=programs.reduce((n,p)=>n+p.reports.length,0);
fs.writeFileSync(__dirname+'/build-info.json',JSON.stringify({revision:rev,version:book.version,records:book.reports.length+programRecords,branchRecords:book.reports.length,programRecords,dataBytes:Buffer.byteLength(code),catalogBytes:Buffer.byteLength(catalogCode),chunkCount:Object.keys(partition.files).length,assets,files:['index.html',...files,'agenda-cache-worker.js','asset-manifest.json','version.json','conference-data.js','conference-catalog.js']},null,2));
console.log('Built',rev,book.reports.length+programRecords,'records;',Buffer.byteLength(code),'bytes data');
