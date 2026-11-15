#!/usr/bin/env node
import net from 'node:net';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, mkdir, cp, rm, chmod, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { serve } from './server.mjs';
import { APP_NAME, bridgeHome } from './paths.mjs';
import { localKey, readJSON, saveJSON, safeError, writeFileAtomic } from './storage.mjs';
import { restoreCodex } from './codex.mjs';
const run=promisify(execFile);
const here=dirname(fileURLToPath(import.meta.url));
const appDir=()=>process.env.WBCB_APP_DIR||join(homedir(),'Applications',APP_NAME+'.app');
const label=()=>process.env.WBCB_SERVICE_LABEL||'org.workbuddy.codex.bridge';
const plist=()=>join(homedir(),'Library','LaunchAgents',label()+'.plist');
const domain=()=>`gui/${process.getuid()}`;
const xml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
async function ready(port,key) {try{const r=await fetch(`http://127.0.0.1:${port}/healthz`,{signal:AbortSignal.timeout(1000)});if((await r.json()).version!=='0.1.0')return false;if(key)return (await fetch(`http://127.0.0.1:${port}/api/status`,{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(2000)})).ok;return true;}catch{return false;}}
async function startAndOpen() {
 const key=await localKey();let port=(await readJSON('service.json',{})).port??13246;
 if(!await ready(port,key)){
  if(process.platform==='darwin'){await run('/bin/launchctl',['kickstart',`${domain()}/${label()}`]).catch(async()=>{await installService();port=(await readJSON('service.json',{})).port??port;});}
  else throw Error('安装器目前仅支持 macOS');
  for(let i=0;i<60&&!await ready(port,key);i++)await new Promise(r=>setTimeout(r,250));
  if(!await ready(port,key))throw Error('服务未启动，请查看应用数据目录中的 service-error.log');
 }
 const url=`http://127.0.0.1:${port}/#key=${key}`;
 if(process.env.WBCB_NO_OPEN!=='1')await run('/usr/bin/open',[url]);
 console.log('设置页面已就绪：http://127.0.0.1:'+port+'/');
}
async function installService() {
 if(process.platform!=='darwin')throw Error('当前安装器仅支持 macOS');
 await localKey();const res=join(appDir(),'Contents','Resources');await access(join(res,'node'));await access(join(res,'cli.mjs'));
 const config=await readJSON('service.json',{});if(!config.port){for(let p=13246;p<13267;p++){const free=await new Promise(r=>{const s=net.createServer();s.once('error',()=>r(false));s.listen(p,'127.0.0.1',()=>s.close(()=>r(true)));});if(free){config.port=p;break;}}if(!config.port)throw Error('没有可用的本地端口');}await saveJSON('service.json',config);
 const env={WBCB_HOME:bridgeHome(),...(process.env.WBCB_CODEX_HOME?{WBCB_CODEX_HOME:process.env.WBCB_CODEX_HOME}:{})};
 const document=`<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>${xml(label())}</string><key>ProgramArguments</key><array><string>${xml(join(res,'node'))}</string><string>${xml(join(res,'cli.mjs'))}</string><string>serve</string></array><key>EnvironmentVariables</key><dict>${Object.entries(env).map(([k,v])=>`<key>${xml(k)}</key><string>${xml(v)}</string>`).join('')}</dict><key>RunAtLoad</key><true/><key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict><key>ThrottleInterval</key><integer>10</integer><key>StandardOutPath</key><string>${xml(join(bridgeHome(),'service.log'))}</string><key>StandardErrorPath</key><string>${xml(join(bridgeHome(),'service-error.log'))}</string></dict></plist>`;
 await mkdir(dirname(plist()),{recursive:true});await run('/bin/launchctl',['bootout',`${domain()}/${label()}`]).catch(()=>{});
 await writeFileAtomic(plist(),document,{mode:0o600});await run('/bin/launchctl',['bootstrap',domain(),plist()]);
}
async function install() {
 const source=resolve(here,'..','..');if(!source.endsWith('.app'))throw Error('请从发布包运行安装程序');
 const destination=appDir();await mkdir(dirname(destination),{recursive:true});
 if(resolve(source)!==resolve(destination)){
  // Same-volume staging plus rename keeps the previous app recoverable until copying completes.
  const stage=destination+'.installing';await rm(stage,{recursive:true,force:true});await cp(source,stage,{recursive:true});
  const {rename}=await import('node:fs/promises');const backup=destination+'.previous';await rm(backup,{recursive:true,force:true});
  await run('/bin/launchctl',['bootout',`${domain()}/${label()}`]).catch(()=>{});
  let hadPrevious=false;try{await rename(destination,backup);hadPrevious=true;}catch(e){if(e.code!=='ENOENT')throw e;}
  try{await rename(stage,destination);}catch(e){if(hadPrevious)await rename(backup,destination);throw e;}
 }
 await installService();await startAndOpen();console.log('安装完成：'+destination);
}
async function uninstall() {
 await restoreCodex();await run('/bin/launchctl',['bootout',`${domain()}/${label()}`]).catch(()=>{});await rm(plist(),{force:true});
 // Only the known application bundle is removed; account data is retained for recovery.
 const app=appDir();if(!app.endsWith(APP_NAME+'.app'))throw Error('应用路径不符合卸载规则');await rm(app,{recursive:true,force:true});console.log('已卸载应用并恢复 Codex 配置。账号数据保留在：'+bridgeHome());
}
const command=process.argv[2]??'open';
try {if(command==='launch'){if(resolve(here,'..','..')!==resolve(appDir()))await install();else await startAndOpen();}else if(command==='serve')await serve();else if(command==='open')await startAndOpen();else if(command==='install')await install();else if(command==='uninstall')await uninstall();else if(command==='status'){const s=await readJSON('service.json',{});console.log(JSON.stringify({running:await ready(s.port??13246),port:s.port??13246}));}else throw Error('用法：bridge [open|install|uninstall|status|serve]');}catch(e){console.error(safeError(e));process.exitCode=1;}
