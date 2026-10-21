const crypto=require('node:crypto'),path=require('node:path');
function assetPath(name,bytes){const ext=path.extname(name),base=path.basename(name,ext),hash=crypto.createHash('sha256').update(bytes).digest('hex').slice(0,16);return './assets/'+base+'.'+hash+ext;}
function renderHTML(source,assets,revision){let html=source;for(const [name,url]of Object.entries(assets))html=html.replaceAll('./'+name+'?v=__REV__',url);return html.replaceAll('__REV__',revision);}
module.exports={assetPath,renderHTML};
