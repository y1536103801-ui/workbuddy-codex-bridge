const $=id=>document.getElementById(id);
const fragment=new URLSearchParams(location.hash.slice(1));if(fragment.has('key')){sessionStorage.setItem('wbcb-key',fragment.get('key'));history.replaceState(null,'',location.pathname);}
const key=sessionStorage.getItem('wbcb-key');let state={models:[]},busy=false;
function notice(text,error=false){const n=$('notice');n.hidden=false;n.textContent=text;n.className=error?'error':'success';}
async function api(path,data){const r=await fetch('/api/'+path,{method:data===undefined?'GET':'POST',headers:{Authorization:'Bearer '+key,...data!==undefined?{'Content-Type':'application/json'}:{}},...(data!==undefined?{body:JSON.stringify(data)}:{})});const j=await r.json();if(!r.ok)throw Error(j.error?.message??'操作失败');return j;}
function render(){
 $('version').textContent='v'+(state.version??'0.1.0');$('connection').textContent=state.connected?'账号已连接':'尚未连接';$('connection').classList.toggle('connected',!!state.connected);$('account-name').textContent=state.account?.name??'等待连接';$('selected').textContent=state.models.find(m=>m.id===state.selected)?.name??'尚未选择模型';
 $('catalog-time').textContent=state.fetchedAt?'更新于 '+new Date(state.fetchedAt).toLocaleString('zh-CN'):'';
 $('check').disabled=busy||!state.selected;$('configure').disabled=busy||!state.selected;$('refresh').disabled=busy||!state.connected;$('disconnect').disabled=busy||!state.connected;$('restore').disabled=busy||!state.configured;
 const query=$('search').value.toLowerCase();const models=state.models.filter(m=>(m.name+' '+m.id).toLowerCase().includes(query));$('model-count').textContent=state.models.length?`${models.length} / ${state.models.length} 个模型`:'连接后获取账号模型';
 const list=$('model-list');list.replaceChildren();if(!models.length){const el=document.createElement('div');el.className='empty';el.textContent=state.connected?'没有匹配的模型，请刷新或更换搜索词。':'登录后，可用模型会显示在这里。';list.append(el);}
 for(const m of models){const b=document.createElement('button');b.className='model'+(m.id===state.selected?' selected':'');b.disabled=busy;b.setAttribute('aria-pressed',String(m.id===state.selected));const title=document.createElement('strong');title.textContent=m.name;const id=document.createElement('small');id.textContent=m.id;const meta=document.createElement('span');meta.className='model-meta';const status=m.compatibility?.state;meta.textContent=[Math.round(m.contextWindow/1000)+'K 上下文',m.supportsImages?'图片 + 文本':'文本',status==='tool_verified'?'✓ 工具检测通过':status==='check_failed'?'检测未通过':'待检测'].join(' · ');b.append(title,id,meta);b.onclick=()=>act(async()=>{await api('select',{model:m.id});notice('已选择 '+m.name+'。点击“应用到 Codex”使切换生效。');});list.append(b);}
}
async function reload(){state=await api('status');render();}
async function act(fn){if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();await reload();}catch(e){notice(e.message,true);}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);render();}}
$('connect').onclick=()=>act(async()=>{notice('正在读取账号并获取模型…');await api('connect',{region:$('region').value});notice('账号连接成功。选择一个模型继续。');});
$('import').onclick=()=>act(async()=>{const credential=$('credential').value;try{await api('connect',{region:$('region').value,credential});notice('凭证已导入。');}finally{$('credential').value='';}});
$('refresh').onclick=()=>act(async()=>{await api('refresh',{});notice('模型列表已刷新。');});
$('check').onclick=()=>act(async()=>{notice('正在检测工具调用…');const s=await api('check',{model:state.selected});const m=s.models.find(m=>m.id===state.selected);notice(m.compatibility.detail,m.compatibility.state!=='tool_verified');});
$('configure').onclick=()=>act(async()=>{const r=await api('configure',{});notice('已应用 '+r.model+'。请重新打开 Codex，并新建聊天。');});
$('restore').onclick=()=>act(async()=>{await api('restore',{});notice('已恢复接入前的 Codex 设置，请重新打开 Codex。');});
$('disconnect').onclick=()=>act(async()=>{await api('disconnect',{});notice('账号已断开。');});
$('search').oninput=render;
if(!key)notice('请从“WorkBuddy Codex Bridge”应用打开设置页面。',true);else reload().catch(e=>notice(e.message,true));
