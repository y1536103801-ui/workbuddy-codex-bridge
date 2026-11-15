import { readFile, writeFile, mkdir, readdir, stat, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import assert from 'node:assert/strict';
import { parse } from 'smol-toml';
const run=(file,args,options={})=>new Promise((resolve,reject)=>{const child=execFile(file,args,options,(error,stdout,stderr)=>error?reject(Object.assign(error,{stdout,stderr})):resolve({stdout,stderr}));child.stdin?.end();});
const manifest=JSON.parse(await readFile('release/manifest.json','utf8'));
const root=resolve('.private/package-check');await mkdir(root,{recursive:true});
const result={version:manifest.version,sourceCommit:manifest.sourceCommit,at:new Date().toISOString(),packages:[],checks:[],passed:false};
const secrets=[(await readFile('.private/data/api-key','utf8')).trim()];
for(const name of await readdir('.private/data'))if(name.startsWith('credential-')){const d=JSON.parse(await readFile(join('.private/data',name),'utf8')).credential;if(d)secrets.push(d.accessToken,d.refreshToken);}
const needles=secrets.filter(s=>s&&s.length>15).map(s=>Buffer.from(s));
async function scan(dir){for(const d of await readdir(dir,{withFileTypes:true})){const path=join(dir,d.name);if(d.isDirectory())await scan(path);else if(d.isFile()){const b=await readFile(path);assert(!needles.some(s=>b.includes(s)),'Secret found in package file '+d.name);}}}
for(const pkg of manifest.packages){const zip=join('release',pkg.file),buffer=await readFile(zip);assert.equal(createHash('sha256').update(buffer).digest('hex'),pkg.sha256);const out=join(root,pkg.arch);await mkdir(out,{recursive:true});await run('/usr/bin/ditto',['-x','-k',zip,out]);const folder=join(out,pkg.file.replace(/\.zip$/,''));const app=join(folder,'WorkBuddy Codex Bridge.app');await run('/usr/bin/codesign',['--verify','--deep','--strict',app]);await scan(folder);const node=join(app,'Contents/Resources/node');const linked=(await run('/usr/bin/otool',['-L',node])).stdout;assert(!linked.includes('/opt/homebrew'));const osinfo=(await run('/usr/bin/otool',['-l',node])).stdout;const minos=osinfo.match(/\bminos\s+(\S+)/)?.[1];result.packages.push({arch:pkg.arch,sha256:pkg.sha256,signatureVerified:true,secretsFound:0,minimumOS:minos,standaloneRuntime:true});}
const folder=join(root,'arm64',manifest.packages.find(p=>p.arch==='arm64').file.replace(/\.zip$/,''));
const app=join(root,'installed','WorkBuddy Codex Bridge.app'),data=join(root,'data'),codex=join(root,'codex'),task=join(root,'task');
await mkdir(codex,{recursive:true});await mkdir(task,{recursive:true});
const old='model="previous-model"\n[projects."/fixture"]\ntrust_level="trusted"\n';await writeFile(join(codex,'config.toml'),old);
const env={...process.env,PATH:'/usr/bin:/bin:/usr/sbin:/sbin',WBCB_HOME:data,WBCB_CODEX_HOME:codex,WBCB_APP_DIR:app,WBCB_NO_OPEN:'1',WBCB_SERVICE_LABEL:'org.workbuddy.codex.bridge.packagecheck'};
let installed=false;
try{
 await run('/bin/sh',[join(folder,'安装.command')],{env,timeout:60000});installed=true;result.checks.push('one-click installer with no node on PATH');
 const svc=JSON.parse(await readFile(join(data,'service.json'),'utf8'));assert.notEqual(svc.port,13246);result.checks.push('occupied port automatically avoided');
 const key=(await readFile(join(data,'api-key'),'utf8')).trim(),base=`http://127.0.0.1:${svc.port}`;
 const api=async(path,input)=>{const r=await fetch(base+'/api/'+path,{method:input===undefined?'GET':'POST',headers:{Authorization:'Bearer '+key,...input!==undefined?{'Content-Type':'application/json'}:{}},...(input!==undefined?{body:JSON.stringify(input)}:{})});const j=await r.json();if(!r.ok)throw Error(j.error?.message??'API failure');return j;};
 assert.equal((await api('status')).connected,false);result.checks.push('fresh installation does not auto-import accounts');
 await run(join(app,'Contents/MacOS/launcher'),[],{env,timeout:30000});result.checks.push('native app launcher opens installed service');
 const connected=await api('connect',{region:'cn'});assert(connected.models.length>4);result.modelCount=connected.models.length;result.checks.push('packaged runtime connects directly to WorkBuddy');
 await api('select',{model:'glm-5.3-flash'});await api('configure',{});
 await writeFile(join(task,'AGENTS.md'),'只完成当前目录的验收任务：读取 input.txt、写 result.txt，不查阅上级目录或联网。\n');await writeFile(join(task,'input.txt'),'11 31\n');
 const exe=join(homedir(),'.local/bin/codex');const live=await run(exe,['-a','never','exec','--skip-git-repo-check','--sandbox','workspace-write','--json','-C',task,'通过工具读取当前目录 input.txt，把两个数相加，通过工具创建 result.txt，内容仅为结果与换行。完成后回复 DONE。'],{env:{...env,CODEX_HOME:codex},timeout:180000,maxBuffer:4*1024*1024});
 await writeFile(join(root,'codex-events.jsonl'),live.stdout,{mode:0o600});const rows=live.stdout.split('\n').filter(Boolean).map(s=>JSON.parse(s));assert(rows.some(r=>r.type==='turn.completed'));assert.equal(await readFile(join(task,'result.txt'),'utf8'),'42\n');result.checks.push('Codex reads input and writes 42 through installed package');result.codexExitCode=0;
 await api('restore',{});assert.deepEqual(parse(await readFile(join(codex,'config.toml'),'utf8')),parse(old));result.checks.push('Codex settings restore preserves original values');
 await api('disconnect',{});assert.equal((await api('status')).connected,false);result.checks.push('disconnect clears cached credentials');
 await run('/bin/sh',[join(folder,'卸载.command')],{env,timeout:30000});installed=false;
 await assert.rejects(access(app));await assert.rejects(access(join(homedir(),'Library/LaunchAgents/org.workbuddy.codex.bridge.packagecheck.plist')));result.checks.push('uninstaller removes app and launch agent');
 result.passed=true;
}finally{
 if(installed)await run('/bin/sh',[join(folder,'卸载.command')],{env,timeout:30000}).catch(()=>{});
 await writeFile('evidence/package-check.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}
