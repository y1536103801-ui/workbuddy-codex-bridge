import { isDeepStrictEqual } from 'node:util';
import { readFile, mkdir, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { parse, stringify } from 'smol-toml';
import { bridgeHome, codexHome } from './paths.mjs';
import { readJSON, saveJSON, writeFileAtomic, withFileLock } from './storage.mjs';
const PROVIDER='workbuddy_bridge';
const ROOT_KEYS=['model_provider','model','model_reasoning_effort','model_catalog_json','web_search'];
async function load() {try{return await readFile(join(codexHome(),'config.toml'),'utf8');}catch(e){if(e.code==='ENOENT')return '';throw e;}}
async function safePath(path) {try{if((await lstat(path)).isSymbolicLink())throw Error('Codex 配置为符号链接，请先选择真实配置目录');}catch(e){if(e.code!=='ENOENT')throw e;}}
export async function configureCodex({model,models,key,port}) {
 const dir=codexHome();await mkdir(dir,{recursive:true,mode:0o700});const path=join(dir,'config.toml');await safePath(path);
 return withFileLock(path,async()=>{
  const raw=await load(),config=parse(raw);const prior=await readJSON('codex-change.json');
  if(prior&&prior.home!==dir)throw Error('Codex 配置目录已改变，请先恢复旧配置');
  if(config.model_providers?.[PROVIDER]&&!prior)throw Error('已存在同名提供商，请先手动处理，避免覆盖');
  let before=prior?.before;if(!before){before={};for(const k of ROOT_KEYS)before[k]={exists:Object.hasOwn(config,k),value:config[k]??null};before.provider={exists:false};await writeFileAtomic(join(bridgeHome(),'codex-config.original.toml'),raw,{mode:0o600});}
  for(const k of ROOT_KEYS)if(!before[k])before[k]={exists:Object.hasOwn(config,k),value:config[k]??null};
  const catalogPath=join(bridgeHome(),'codex-models.json');
  const catalog={models:models.map(m=>({slug:m.id,display_name:m.name,description:'WorkBuddy · '+m.name,default_reasoning_level:m.reasoning?.defaultEffort??'medium',supported_reasoning_levels:(m.reasoning?.supportedEfforts??[]).map(e=>({effort:e,description:e})),shell_type:'unified_exec',visibility:'list',supported_in_api:true,priority:0,base_instructions:'You are a coding assistant. Follow the user instructions and use the provided tools to complete tasks.',supports_reasoning_summaries:false,support_verbosity:false,default_verbosity:null,apply_patch_tool_type:'freeform',truncation_policy:{mode:'tokens',limit:10000},supports_parallel_tool_calls:false,context_window:m.contextWindow,effective_context_window_percent:90,experimental_supported_tools:[],input_modalities:m.supportsImages?['text','image']:['text'],supports_search_tool:false}))};
  await writeFileAtomic(catalogPath,JSON.stringify(catalog,null,2),{mode:0o600});
  config.web_search='disabled';config.model_provider=PROVIDER;config.model=model.id;config.model_catalog_json=catalogPath;
  if(model.reasoning?.defaultEffort)config.model_reasoning_effort=model.reasoning.defaultEffort;else delete config.model_reasoning_effort;
  config.model_providers??={};config.model_providers[PROVIDER]={name:'WorkBuddy Bridge',base_url:`http://127.0.0.1:${port}/v1`,wire_api:'responses',requires_openai_auth:false,http_headers:{Authorization:'Bearer '+key},request_max_retries:0,stream_max_retries:0,stream_idle_timeout_ms:300000};
  const after={};for(const k of ROOT_KEYS)after[k]={exists:Object.hasOwn(config,k),value:config[k]??null};after.provider=config.model_providers[PROVIDER];
  const next=stringify(config);parse(next);
  await saveJSON('codex-change.json',{home:dir,before,after});await writeFileAtomic(path,next,{mode:0o600});
  return {configured:true,model:model.id,path,restartRequired:true};
 });
}
export async function restoreCodex() {
 const saved=await readJSON('codex-change.json');if(!saved)return {restored:false};if(saved.home!==codexHome())throw Error('Codex 目录与备份不一致');const path=join(codexHome(),'config.toml');await safePath(path);
 return withFileLock(path,async()=>{const config=parse(await load());
  for(const k of ROOT_KEYS){const now={exists:Object.hasOwn(config,k),value:config[k]??null};if(!isDeepStrictEqual(now,saved.after[k]))throw Error('Codex 配置已被其他程序修改，请先处理：'+k);}
  if(!isDeepStrictEqual(JSON.parse(JSON.stringify(config.model_providers?.[PROVIDER])),saved.after.provider))throw Error('WorkBuddy 提供商配置已被其他程序修改');
  for(const k of ROOT_KEYS){if(saved.before[k].exists)config[k]=saved.before[k].value;else delete config[k];}delete config.model_providers[PROVIDER];if(!Object.keys(config.model_providers).length)delete config.model_providers;
  await writeFileAtomic(path,stringify(config),{mode:0o600});await saveJSON('codex-change.json',null);return {restored:true};});
}
