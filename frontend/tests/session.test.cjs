const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {runInNewContext}=require('node:vm');
const ts=require('typescript');
function transport(){
 const calls=[],events=[],queue=[],exports={};
 class ApiError extends Error{constructor(status,detail){super(typeof detail==='string'?detail:detail.message);this.status=status;}}
 runInNewContext(ts.transpileModule(readFileSync('src/session.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports,Headers,Event,require:()=>({ApiError}),window:{dispatchEvent:e=>events.push(e.type)},
  fetch:async(url,options)=>{calls.push({url,options});const item=queue.shift()||{};return{ok:(item.status||200)<400,status:item.status||200,headers:new Headers({'X-Data-Generation':String(item.generation||0)}),json:async()=>item.data||{ok:true}};}
 });
 return {...exports,calls,events,queue};
}
test('writes use displayed generation and CSRF, never a newer polled baseline',async()=>{
 const t=transport();t.setSession({account:{id:'a'},csrf:'csrf-token',generation:9});
 t.queue.push({generation:9});await t.requestApi('entries',{day:'2026-10-12',expected:{record:'token',__generation__:'3'}});
 const call=t.calls[0];assert.equal(call.options.headers.get('X-CSRF-Token'),'csrf-token');assert.equal(call.options.headers.get('X-Data-Generation'),'3');
 assert.deepEqual(JSON.parse(call.options.body),{day:'2026-10-12',expected:{record:'token'}});
 t.queue.push({generation:10});await t.requestApi('orari/override',{basis:'old',_generation:4});
 assert.equal(t.calls[1].options.headers.get('X-Data-Generation'),'4');assert.ok(!t.calls[1].options.body.includes('_generation'));
});
test('read generations stay on snapshots and do not enter archive JSON',async()=>{
 const t=transport();t.setSession({account:{id:'a'},csrf:'csrf',generation:1});
 t.queue.push({generation:7,data:{concurrency:{records:{},dates:{}}}});const data=await t.requestApi('day/2026-10-12');
 assert.equal(data.generation,7);assert.equal(data.concurrency.generation,7);assert.equal(t.currentSession().generation,7);
 t.queue.push({generation:2});await t.requestApi('inbox/summary');assert.equal(t.currentSession().generation,7);
 t.queue.push({generation:7,data:{schema:7}});const archive=await t.requestApi('export');assert.equal(JSON.stringify(archive),'{"schema":7}');
});
test('expired requests trigger login without replay, permission denials retain session',async()=>{
 const t=transport();const session={account:{id:'a'},csrf:'csrf',generation:1};t.setSession(session);
 t.queue.push({status:403,data:{detail:'Wrong campus'}});await assert.rejects(t.requestApi('assignments',{}),e=>e.status===403);assert.equal(t.currentSession(),session);assert.equal(t.events.length,0);
 t.queue.push({status:401,data:{detail:'Accesso richiesto'}});await assert.rejects(t.requestApi('permessi',{}),e=>e.status===401);assert.equal(t.currentSession(),undefined);assert.deepEqual(t.events,['session-expired']);assert.equal(t.calls.length,2);
});
