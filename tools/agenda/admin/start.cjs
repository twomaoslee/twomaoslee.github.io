'use strict';
const path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os');
const {createAdmin,passwordHash,atomic}=require('./server.cjs'),{Repository}=require('./repository.cjs');
const state=process.env.AGENDA_ADMIN_STATE||path.join(os.homedir(),'.local/share/cps2026-agenda-admin');
async function secret(prompt){
 if(!process.stdin.isTTY)throw Error('交互配置需在终端运行，或使用 AGENDA_ADMIN_PASSWORD 环境变量');
 process.stdout.write(prompt);process.stdin.setRawMode(true);process.stdin.resume();let value='';
 return new Promise((resolve,reject)=>{const done=()=>{process.stdin.setRawMode(false);process.stdin.pause();process.stdin.off('data',input);process.stdout.write('\n');};const input=chunk=>{for(const c of chunk.toString()){if(c==='\u0003'){done();reject(Error('已取消'));return;}if(c==='\r'||c==='\n'){done();resolve(value);return;}if(c==='\u007f')value=value.slice(0,-1);else if(c>=' ')value+=c;}};process.stdin.on('data',input);});
}
(async()=>{
 await fs.mkdir(state,{recursive:true,mode:0o700});const configFile=path.join(state,'config.json');
 if(process.argv.includes('--setup')){
  // Environment input keeps the password out of process arguments and source files.
  const p=process.env.AGENDA_ADMIN_PASSWORD||await secret('设置管理密码（至少14位，输入时不显示）：');if(!p||p.length<14)throw Error('管理密码至少14位');
  if(!process.env.AGENDA_ADMIN_PASSWORD&&await secret('再次输入管理密码：')!==p)throw Error('两次密码不一致');
  let old={};try{old=JSON.parse(await fs.readFile(configFile,'utf8'));}catch{}
  await atomic(configFile,{...old,username:process.env.AGENDA_ADMIN_USER||old.username||'admin',password:await passwordHash(p)});
  console.log('管理员已配置。启动：node tools/agenda/admin/start.cjs');return;
 }
 const config=JSON.parse(await fs.readFile(configFile,'utf8'));
 const host=process.env.AGENDA_ADMIN_HOST||'127.0.0.1',port=Number(process.env.PORT||8790);
 const origin=process.env.AGENDA_ADMIN_ORIGIN||'http://127.0.0.1:'+port;
 if(host!=='127.0.0.1'&&!origin.startsWith('https://'))throw Error('远程管理需要配置 HTTPS 的 AGENDA_ADMIN_ORIGIN');
 const repository=new Repository({directory:path.join(state,'repository'),remote:process.env.AGENDA_ADMIN_REMOTE||'https://github.com/twomaoslee/twomaoslee.github.io.git'});
 const app=createAdmin({repository,stateDirectory:state,origin,username:config.username,password:config.password,secure:origin.startsWith('https://')});
 await app.init();app.server.listen(port,host,()=>console.log('会议日程管理后台：'+origin));
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>app.close().then(()=>process.exit(0)));
})().catch(e=>{console.error(e.code==='ENOENT'?'请先运行管理账号配置（见 README）':e.message);process.exit(1)});
