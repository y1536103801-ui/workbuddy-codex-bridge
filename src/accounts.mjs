import { join } from 'node:path';
import { WorkBuddyCredentialStore, parseWorkBuddyAuth } from '../vendor/workbuddy/auth.ts';
import { CN_VARIANT, AI_VARIANT } from '../vendor/workbuddy/variants.ts';
import { WorkBuddyUpstreamClient, regionOf } from '../vendor/workbuddy/upstream.ts';
import { bridgeHome } from './paths.mjs';
import { readJSON, saveJSON, safeError } from './storage.mjs';
export class Accounts {
 constructor(client=new WorkBuddyUpstreamClient()) { this.client=client; this.stores=new Map(); this.busy=false; }
 store(region,source) { const id=region+':'+source;if(!this.stores.has(id))this.stores.set(id,new WorkBuddyCredentialStore({variant:region==='global'?AI_VARIANT:CN_VARIANT,ownPath:join(bridgeHome(),`credential-${region}.json`),...(source==='import'?{desktopPath:join(bridgeHome(),'manual-no-desktop.info')} : {}),refresh:c=>this.client.refreshToken(c)}));return this.stores.get(id); }
 async settings() {return readJSON('settings.json',{});}
 async current() {const s=await this.settings();if(!s.connected)throw Error('请先连接 WorkBuddy 账号');return this.store(s.region,s.source).resolve();}
 async connect({region='cn',credential}={}) {
  if(!['cn','global'].includes(region))throw Error('账号区域无效');
  if(credential!==undefined&&(!credential||typeof credential==='string'&&!credential.trim()))throw Error('请粘贴完整账号凭证 JSON');
  const source=credential?'import':'desktop';const store=this.store(region,source);
  if(credential){const c=parseWorkBuddyAuth(typeof credential==='string'?credential:JSON.stringify(credential));if(!c)throw Error('凭证需要 accessToken；建议导入完整账号凭证 JSON');if(regionOf(c.domain)!==region)throw Error('凭证区域与选择不一致');await saveJSON(`credential-${region}.json`,{version:1,credential:c});}
  const c=await store.resolve();const models=await this.client.fetchModels(c);
  const previous=await this.settings();const same=previous.accountId===c.uid+':'+(c.enterpriseId??'');
  await saveJSON('catalog.json',{fetchedAt:Date.now(),models});
  await saveJSON('settings.json',{connected:true,region,source,accountId:c.uid+':'+(c.enterpriseId??''),selected:same&&models.some(m=>m.id===previous.selected)?previous.selected:null});
  if(!same)await saveJSON('compatibility.json',{});
  return this.status();
 }
 async disconnect() {await saveJSON('settings.json',{});await saveJSON('catalog.json',{models:[]});this.stores.clear();for(const region of ['cn','global'])await saveJSON(`credential-${region}.json`,{version:1});return this.status();}
 async refresh() {const c=await this.current();const models=await this.client.fetchModels(c);await saveJSON('catalog.json',{fetchedAt:Date.now(),models});return this.status();}
 async status() {
  const s=await this.settings(),catalog=await readJSON('catalog.json',{models:[]}),compat=await readJSON('compatibility.json',{});
  let account=null;if(s.connected){try{const c=await this.store(s.region,s.source).current();account=c?{name:c.nickname||'已连接账号',expiresAt:c.expiresAtMs,region:s.region}:null;}catch(e){account={name:'需要重新连接',error:safeError(e)};}}
  return {connected:!!s.connected,account,selected:s.selected??null,fetchedAt:catalog.fetchedAt,models:catalog.models.map(m=>({...m,compatibility:compat[m.id]??{state:'unverified'}}))};
 }
 async select(id) {const c=await readJSON('catalog.json',{models:[]});if(!c.models.some(m=>m.id===id))throw Error('模型不在当前账号目录中，请刷新');const s=await this.settings();await saveJSON('settings.json',{...s,selected:id});return this.status();}
 async model(id) {const c=await readJSON('catalog.json',{models:[]});const m=c.models.find(m=>m.id===id);if(!m)throw Error('模型不在当前账号目录中，请刷新并选择');return m;}
 async mark(id,state,detail) {const c=await readJSON('compatibility.json',{});c[id]={state,detail,checkedAt:Date.now()};await saveJSON('compatibility.json',c);}
}
