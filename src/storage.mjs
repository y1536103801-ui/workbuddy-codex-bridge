import { readFile, mkdir, chmod, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { bridgeHome } from './paths.mjs';
import { writeFileAtomic, withFileLock } from '../vendor/atomic/index.mjs';
export { writeFileAtomic, withFileLock };
export async function initHome() { const home=bridgeHome(); await mkdir(home,{recursive:true,mode:0o700}); if((await lstat(home)).isSymbolicLink()) throw Error('数据目录不能是符号链接'); await chmod(home,0o700); return home; }
export async function readJSON(name, fallback=null) { try { return JSON.parse(await readFile(join(bridgeHome(),name),'utf8')); } catch(e) { if(e.code==='ENOENT')return fallback; throw e; } }
export async function saveJSON(name,value) { await initHome(); await writeFileAtomic(join(bridgeHome(),name),JSON.stringify(value,null,2)+'\n',{mode:0o600}); }
export async function localKey() { await initHome(); const path=join(bridgeHome(),'api-key'); return withFileLock(path,async()=>{try{return (await readFile(path,'utf8')).trim();}catch(e){if(e.code!=='ENOENT')throw e;const key=randomBytes(32).toString('hex');await writeFileAtomic(path,key,{mode:0o600});return key;}}); }
export function equal(a,b) { const x=Buffer.from(String(a??'')),y=Buffer.from(String(b??''));return x.length===y.length&&timingSafeEqual(x,y); }
export function safeError(error) { return String(error?.message??error).replace(/Bearer\s+[^\s"']+/giu,'Bearer [隐藏]').replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/gu,'[隐藏凭证]').replace(/((?:access[_-]?token|refresh[_-]?token|api[_-]?key|authorization|password|secret)["']?\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}]+)/giu,'$1[隐藏]').replace(/https?:\/\/[^\s"'<>]+/giu,s=>{try{const u=new URL(s);return u.origin+u.pathname+(u.search?'?[隐藏参数]':'');}catch{return '[隐藏链接]';}}).slice(0,800); }
