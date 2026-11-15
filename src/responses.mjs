import { randomUUID, randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import { once } from 'node:events';
const uid=p=>p+'_'+randomUUID().replaceAll('-','');
export function seal(text,key) {const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',createHash('sha256').update(key).digest(),iv);const out=Buffer.concat([c.update(text,'utf8'),c.final()]);return 'wb1.'+Buffer.concat([iv,c.getAuthTag(),out]).toString('base64url');}
export function unseal(text,key) {if(!text?.startsWith('wb1.'))return '';const b=Buffer.from(text.slice(4),'base64url');const c=createDecipheriv('aes-256-gcm',createHash('sha256').update(key).digest(),b.subarray(0,12));c.setAuthTag(b.subarray(12,28));return Buffer.concat([c.update(b.subarray(28)),c.final()]).toString();}
function content(parts) {
 if(typeof parts==='string')return parts;
 if(!Array.isArray(parts))throw Error('消息内容需要文本或内容数组');
 return parts.map(p=>{if(['input_text','output_text','text'].includes(p.type))return {type:'text',text:p.text??''};if(p.type==='input_image'&&typeof p.image_url==='string')return {type:'image_url',image_url:{url:p.image_url,...p.detail?{detail:p.detail}:{}}};throw Error('此连接器尚不支持该输入类型：'+p.type);});
}
export function toChat(body,model,key) {
 if(body.previous_response_id)throw Error('请发送完整对话历史；此连接器不保存远端会话');
 const tools=[],toolMap=new Map();
 const add=(t,namespace)=>{
  if(t.type==='namespace'){for(const child of t.tools??[])add(child,t.name);return;}
  if(!['function','custom'].includes(t.type))throw Error('不支持的工具类型：'+t.type);
  const wire=namespace?namespace+'__'+t.name:t.name;if(!/^[a-zA-Z0-9_.-]{1,128}$/.test(wire))throw Error('工具名称无效');
  toolMap.set(wire,{name:t.name,type:t.type,namespace});
  const custom=t.type==='custom';
  tools.push({type:'function',function:{name:wire,description:(t.description??'')+(custom?'\nProvide the complete tool input as the input string.':'')+(custom&&t.format?.definition?'\nGrammar:\n'+t.format.definition:''),parameters:custom?{type:'object',properties:{input:{type:'string'}},required:['input'],additionalProperties:false}:t.parameters??{type:'object',properties:{}}}});
 };
 for(const t of body.tools??[])add(t);
 const input=typeof body.input==='string'?[{role:'user',content:body.input}]:body.input;
 if(!Array.isArray(input))throw Error('input 必须是文本或消息数组');
 const messages=[];if(body.instructions)messages.push({role:'system',content:body.instructions});
 let reasoning='';
 for(const item of input){
  if(item.type==='reasoning'){reasoning+=item.encrypted_content?unseal(item.encrypted_content,key):(item.summary??[]).map(p=>p.text??'').join('');continue;}
  if(item.type==='function_call'||item.type==='custom_tool_call'){
   const name=item.namespace?item.namespace+'__'+item.name:item.name;
   const call={id:item.call_id,type:'function',function:{name,arguments:item.type==='custom_tool_call'?JSON.stringify({input:item.input}):item.arguments}};
   const last=messages.at(-1);if(last?.role==='assistant'&&last.tool_calls){last.tool_calls.push(call);if(reasoning)last.reasoning_content=(last.reasoning_content??'')+reasoning;}
   else messages.push({role:'assistant',content:null,tool_calls:[call],...(reasoning?{reasoning_content:reasoning}:{})});reasoning='';continue;
  }
  if(item.type==='function_call_output'||item.type==='custom_tool_call_output'){messages.push({role:'tool',tool_call_id:item.call_id,content:typeof item.output==='string'?item.output:content(item.output)});continue;}
  if(item.type&&item.type!=='message')throw Error('不支持的历史条目：'+item.type);
  const role=item.role==='developer'?'system':item.role;if(!['user','assistant','system'].includes(role))throw Error('不支持的消息角色');
  messages.push({role,content:content(item.content),...(role==='assistant'&&reasoning?{reasoning_content:reasoning}:{})});if(role==='assistant')reasoning='';
 }
 if(!messages.length)throw Error('消息不能为空');
 if(!model.supportsImages&&messages.some(m=>Array.isArray(m.content)&&m.content.some(p=>p.type==='image_url')))throw Error('当前模型未声明支持图片，请选择支持图片的模型');
 const result={model:model.id,messages,stream:true,stream_options:{include_usage:true},...(tools.length?{tools,parallel_tool_calls:false}:{})};
 if(body.max_output_tokens)result.max_tokens=Math.min(body.max_output_tokens,model.maxTokens);
 if(body.reasoning?.effort){const allowed=model.reasoning?.supportedEfforts??[];const effort=body.reasoning.effort;if(allowed.includes(effort))result.reasoning_effort=effort;else if(allowed.length&&model.reasoning?.defaultEffort)result.reasoning_effort=model.reasoning.defaultEffort;}
 if(body.tool_choice){const choice=body.tool_choice;if(typeof choice==='string')result.tool_choice=choice;else if(choice.type==='function'||choice.type==='custom')result.tool_choice=choice.namespace?choice.namespace+'__'+choice.name:choice.name;else throw Error('不支持的工具选择');}
 return {request:result,toolMap};
}
export async function* sseJSON(stream) {
 const decoder=new TextDecoder();let buffer='';
 const parse=block=>{const data=block.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(!data)return null;if(data==='[DONE]')return {done:true};return {data:JSON.parse(data)};};
 for await(const chunk of stream){buffer+=decoder.decode(chunk,{stream:true}).replaceAll('\r\n','\n');if(buffer.length>8_000_000)throw Error('上游事件超过大小限制');let i;while((i=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,i);buffer=buffer.slice(i+2);const row=parse(block);if(row)yield row;}}
 buffer+=decoder.decode();if(buffer.trim()){const row=parse(buffer);if(row)yield row;}
}
export async function streamResponses(upstream,res,{model,key,toolMap,signal,stream=true}) {
 const responseId=uid('resp'),created=Math.floor(Date.now()/1000),items=[],calls=new Map();let seq=0,finished=false,finishReason,usage={},textItem,reasonItem,total=0;
 const base=status=>({id:responseId,object:'response',created_at:created,status,model,output:items,parallel_tool_calls:false,error:null});
 const emit=async(type,data={})=>{if(!stream)return;signal?.throwIfAborted();const ok=res.write(`event: ${type}\ndata: ${JSON.stringify({type,sequence_number:seq++,...data})}\n\n`);if(!ok)await once(res,'drain',{signal});};
 if(stream){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','X-Accel-Buffering':'no'});await emit('response.created',{response:base('in_progress')});await emit('response.in_progress',{response:base('in_progress')});}
 const newItem=async(item)=>{items.push(item);await emit('response.output_item.added',{output_index:items.length-1,item:structuredClone(item)});return item;};
 for await(const event of sseJSON(upstream)){
  signal?.throwIfAborted();if(event.done){finished=true;break;}const j=event.data;
  if(j.error||j.extError)throw Error('上游流返回错误：'+JSON.stringify(j.error??j.extError));
  if(j.usage)usage=j.usage;
  const choice=j.choices?.[0];if(!choice)continue;const d=choice.delta??choice.message??{};
  if(choice.finish_reason){finished=true;finishReason=choice.finish_reason;}
  if(d.reasoning_content){
   if(!reasonItem){reasonItem=await newItem({id:uid('rs'),type:'reasoning',summary:[]});await emit('response.reasoning_summary_part.added',{item_id:reasonItem.id,output_index:items.indexOf(reasonItem),summary_index:0,part:{type:'summary_text',text:''}});reasonItem.summary=[{type:'summary_text',text:''}];}
   reasonItem.summary[0].text+=d.reasoning_content;await emit('response.reasoning_summary_text.delta',{item_id:reasonItem.id,output_index:items.indexOf(reasonItem),summary_index:0,delta:d.reasoning_content});
  }
  if(d.content){
   if(typeof d.content!=='string')throw Error('上游返回了不支持的文本格式');
   if(!textItem){textItem=await newItem({id:uid('msg'),type:'message',role:'assistant',status:'in_progress',content:[]});textItem.content=[{type:'output_text',text:'',annotations:[]}];await emit('response.content_part.added',{item_id:textItem.id,output_index:items.indexOf(textItem),content_index:0,part:{type:'output_text',text:'',annotations:[]}});}
   textItem.content[0].text+=d.content;await emit('response.output_text.delta',{item_id:textItem.id,output_index:items.indexOf(textItem),content_index:0,delta:d.content});
  }
  for(const t of d.tool_calls??[]){const idx=t.index??0;if(!calls.has(idx))calls.set(idx,{id:'',name:'',arguments:''});const c=calls.get(idx);if(t.id)c.id=t.id;if(t.function?.name)c.name+=t.function.name;if(t.function?.arguments)c.arguments+=t.function.arguments;}
  total+=JSON.stringify(d).length;if(total>32_000_000)throw Error('模型输出超过大小限制');
 }
 if(!finished)throw Error('上游流中断，未收到完成标记');
 const incomplete=finishReason==='length'||finishReason==='content_filter';
 if(reasonItem){reasonItem.encrypted_content=seal(reasonItem.summary[0].text,key);await emit('response.reasoning_summary_text.done',{item_id:reasonItem.id,output_index:items.indexOf(reasonItem),summary_index:0,text:reasonItem.summary[0].text});await emit('response.reasoning_summary_part.done',{item_id:reasonItem.id,output_index:items.indexOf(reasonItem),summary_index:0,part:reasonItem.summary[0]});}
 if(textItem){textItem.status=incomplete?'incomplete':'completed';await emit('response.output_text.done',{item_id:textItem.id,output_index:items.indexOf(textItem),content_index:0,text:textItem.content[0].text});await emit('response.content_part.done',{item_id:textItem.id,output_index:items.indexOf(textItem),content_index:0,part:textItem.content[0]});}
 for(const c of calls.values()){
  if(incomplete)continue;
  if(!c.id||!c.name)throw Error('上游工具调用缺少标识或名称');const meta=toolMap.get(c.name);if(!meta)throw Error('上游调用了未声明的工具');
  let args;try{args=JSON.parse(c.arguments);}catch{throw Error('上游工具参数不是完整 JSON');}
  const common={id:uid('fc'),call_id:c.id,name:meta.name,status:'completed',...(meta.namespace?{namespace:meta.namespace}:{})};
  if(meta.type==='custom'){
   if(typeof args.input!=='string')throw Error('自定义工具缺少 input 字符串');
   const item=await newItem({...common,type:'custom_tool_call',input:''});await emit('response.custom_tool_call_input.delta',{item_id:item.id,output_index:items.indexOf(item),delta:args.input});item.input=args.input;await emit('response.custom_tool_call_input.done',{item_id:item.id,output_index:items.indexOf(item),input:item.input});
  }else{
   const item=await newItem({...common,type:'function_call',arguments:''});await emit('response.function_call_arguments.delta',{item_id:item.id,output_index:items.indexOf(item),delta:c.arguments});item.arguments=c.arguments;await emit('response.function_call_arguments.done',{item_id:item.id,output_index:items.indexOf(item),arguments:c.arguments});
  }
 }
 if(!textItem&&!calls.size)throw Error('上游没有返回正文或工具调用');
 for(let i=0;i<items.length;i++)await emit('response.output_item.done',{output_index:i,item:items[i]});
 const result={...base(incomplete?'incomplete':'completed'),usage:{input_tokens:usage.prompt_tokens??0,output_tokens:usage.completion_tokens??0,total_tokens:usage.total_tokens??0,input_tokens_details:{cached_tokens:usage.prompt_tokens_details?.cached_tokens??0},output_tokens_details:{reasoning_tokens:usage.completion_tokens_details?.reasoning_tokens??0}},...(incomplete?{incomplete_details:{reason:finishReason==='length'?'max_output_tokens':'content_filter'}}:{})};
 if(stream){await emit(incomplete?'response.incomplete':'response.completed',{response:result});res.end();}else{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));}return result;
}
