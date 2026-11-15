import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Accounts } from './accounts.mjs';
import { localKey, equal, safeError, readJSON, saveJSON } from './storage.mjs';
import { VERSION } from './paths.mjs';
import { toChat, streamResponses, sseJSON } from './responses.mjs';
import { configureCodex, restoreCodex } from './codex.mjs';
const assets=new Map([['/','index.html'],['/app.js','app.js'],['/style.css','style.css']]);
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const failure=(res,status,message)=>json(res,status,{error:{message,type:'bridge_error',code:'bridge_error'}});
async function body(req) {if(!req.headers['content-type']?.startsWith('application/json'))throw Error('请求需要 application/json');let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>32*1024*1024)throw Error('请求过大');chunks.push(c);}return JSON.parse(Buffer.concat(chunks).toString());}
export async function createServer({accounts=new Accounts(),key,port=13246,webDir=join(dirname(fileURLToPath(import.meta.url)),'web')}={}) {
 key??=await localKey();
 let active=0,mutating=false;
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  const actualPort=server.address()?.port??port;const allowed=new Set([`127.0.0.1:${actualPort}`,`localhost:${actualPort}`]);
  if(!allowed.has(req.headers.host))return failure(res,403,'只允许本机访问');
  if(req.headers.origin&&!new Set([...allowed].map(h=>'http://'+h)).has(req.headers.origin))return failure(res,403,'来源不允许');
  const path=(req.url??'').split('?')[0];
  if(req.method==='GET'&&path==='/healthz')return json(res,200,{ok:true,version:VERSION});
  if(req.method==='GET'&&assets.has(path)){try{const f=assets.get(path);res.setHeader('Content-Type',f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(await readFile(join(webDir,f)));}catch{failure(res,404,'页面文件不存在');}return;}
  if(!equal(req.headers.authorization,'Bearer '+key))return failure(res,401,'请从应用重新打开设置页面');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Error('请求超过 5 分钟')),300000);res.on('close',()=>controller.abort());
  let acquired=false,editing=false,secrets=[];
  try{
   if(req.method==='GET'&&path==='/api/status')return json(res,200,{version:VERSION,...await accounts.status(),configured:!!(await readJSON('codex-change.json'))});
   if(req.method==='GET'&&path==='/v1/models'){const status=await accounts.status();return json(res,200,{object:'list',data:status.models.map(m=>({id:m.id,object:'model',owned_by:'workbuddy'}))});}
   if(req.method==='POST'&&path.startsWith('/api/')){
    if(mutating||active) return failure(res,409,'有请求正在进行，请完成后再修改设置');mutating=true;editing=true;
    const input=await body(req);
    if(path==='/api/connect')return json(res,200,await accounts.connect(input));
    if(path==='/api/disconnect')return json(res,200,await accounts.disconnect());
    if(path==='/api/refresh')return json(res,200,await accounts.refresh());
    if(path==='/api/select')return json(res,200,await accounts.select(input.model));
    if(path==='/api/configure'){const status=await accounts.status();const model=await accounts.model(status.selected);return json(res,200,await configureCodex({model,models:status.models,key,port:actualPort}));}
    if(path==='/api/restore')return json(res,200,await restoreCodex());
    if(path==='/api/check'){
     const status=await accounts.status(),model=await accounts.model(input.model??status.selected),credential=await accounts.current();
     secrets=[credential.accessToken,credential.refreshToken].filter(Boolean);
     const request={model:model.id,messages:[{role:'system',content:'You are testing a local model connector.'},{role:'user',content:'Call bridge_check with value "ok". Do not write any other text.'}],tools:[{type:'function',function:{name:'bridge_check',description:'Connection test',parameters:{type:'object',properties:{value:{type:'string'}},required:['value']}}}],tool_choice:'bridge_check',stream:true,max_tokens:1024};
     const result=await accounts.client.chatStream(credential,JSON.stringify(request),controller.signal);if(!result.ok)throw Error(`HTTP ${result.status}: ${result.message}`);
     let args='',name='',complete=false;for await(const e of sseJSON(result.response.body)){if(e.done){complete=true;break;}if(e.data.error)throw Error('上游检测失败');for(const c of e.data.choices??[]){if(c.finish_reason)complete=true;for(const t of c.delta?.tool_calls??[]){name+=t.function?.name??'';args+=t.function?.arguments??'';}}}
     let valid=false;try{valid=complete&&name==='bridge_check'&&JSON.parse(args).value==='ok';}catch{}
     await accounts.mark(model.id,valid?'tool_verified':'check_failed',valid?'工具调用检测通过':'模型未完成指定工具调用');return json(res,200,await accounts.status());
    }
    return failure(res,404,'未知操作');
   }
   if(req.method!=='POST'||path!=='/v1/responses')return failure(res,404,'未知接口');
   if(active||mutating)return failure(res,429,'当前账号有请求正在进行，请稍后继续');active++;acquired=true;
   const input=await body(req),model=await accounts.model(input.model),converted=toChat(input,model,key),credential=await accounts.current();
   secrets=[credential.accessToken,credential.refreshToken].filter(Boolean);
   const result=await accounts.client.chatStream(credential,JSON.stringify(converted.request),controller.signal);
   if(!result.ok){let msg=safeError(result.message);for(const s of [credential.accessToken,credential.refreshToken])if(s)msg=msg.replaceAll(s,'[隐藏]');throw Object.assign(Error(`模型 ${model.name} · HTTP ${result.status}：${msg}`),{status:result.status||502});}
   await streamResponses(result.response.body,res,{model:model.id,key,toolMap:converted.toolMap,signal:controller.signal,stream:input.stream!==false});
  }catch(e){let message=safeError(e);for(const secret of secrets)message=message.replaceAll(secret,'[隐藏]');if(!res.headersSent)failure(res,e.status>=400&&e.status<=599?e.status:400,message);else if(!res.destroyed)res.end('event: error\ndata: '+JSON.stringify({type:'error',code:'bridge_error',message})+'\n\n');}
  finally{clearTimeout(timer);if(acquired)active--;if(editing)mutating=false;}
 });
 server.requestTimeout=300000;server.headersTimeout=15000;server.maxHeadersCount=64;
 return server;
}
export async function serve() {const saved=await readJSON('service.json',{});const port=Number(process.env.WBCB_PORT??saved.port??13246);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('服务端口无效');const server=await createServer({port});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});await saveJSON('service.json',{port,pid:process.pid,version:VERSION});console.log(`WorkBuddy Codex Bridge ${VERSION} ready on 127.0.0.1:${port}`);for(const sig of ['SIGINT','SIGTERM'])process.once(sig,()=>{server.close(()=>process.exit());setTimeout(()=>process.exit(),5000).unref();});return server;}
