const {test}=require('node:test'),assert=require('node:assert/strict'),{readFileSync}=require('node:fs'),{runInNewContext}=require('node:vm'),ts=require('typescript');
function harness(campus='centrale'){
 const slots=[],effects=[],requests=[],listeners=new Map(),exports={};let index=0,today='2026-10-29';
 const react={useState(initial){const i=index++;if(!(i in slots))slots[i]={value:typeof initial==='function'?initial():initial};return[slots[i].value,v=>slots[i].value=typeof v==='function'?v(slots[i].value):v];},useEffect(fn,deps){const i=index++,old=slots[i];if(!old||deps.some((d,j)=>d!==old.deps[j]))effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});}};
 const jsx=(type,props)=>({type,props});
 runInNewContext(ts.transpileModule(readFileSync('src/Publication.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Date,setTimeout:()=>1,clearTimeout(){},document:{addEventListener:(k,fn)=>listeners.set(k,fn),removeEventListener:k=>listeners.delete(k)},require:n=>n==='react'?react:n==='react/jsx-runtime'?{jsx,jsxs:jsx}:n==='./Loading'?{Loading:'loading'}:n==='./display'?{romeDay:()=>today,nextMidnight:()=>Date.now()+10000}:{requestApi:(url,body)=>new Promise((resolve,reject)=>requests.push({url,body,resolve,reject}))}});
 const render=(day=today,disabled=false)=>{index=0;const tree=exports.Publication({day,campus,disabled});while(effects.length)effects.shift()();return tree;};
 const nodes=t=>!t?[]:Array.isArray(t)?t.flatMap(nodes):typeof t==='object'?[t,...nodes(t.props?.children)]:[];
 return{render,nodes,requests,listeners,setDay:d=>today=d,flush:async()=>{for(let i=0;i<8;i++)await Promise.resolve();}};
}
const status={configured:true,busy:false,uncertain:false,error:null,campus:'centrale',url:'https://fixture.pages.dev/display?campus=centrale'};
test('each account publishes today without a campus override; repeated clicks disabled while sending',async()=>{
 const h=harness('succursale');h.render();h.requests[0].resolve({...status,campus:'succursale'});await h.flush();
 let tree=h.render();assert.ok(h.nodes(tree).some(n=>n.props?.children==='Succursale'));
 const button=h.nodes(tree).find(n=>n.type==='button');assert.equal(button.props.disabled,false);button.props.onClick();tree=h.render();assert.equal(h.nodes(tree).find(n=>n.type==='button').props.disabled,true);
 assert.equal(JSON.stringify(h.requests[1].body),JSON.stringify({day:'2026-10-29'}));h.requests[1].resolve({started:true});await h.flush();h.render();assert.equal(h.requests.length,3);
});
test('historical dates and Rome midnight hide publication',()=>{const h=harness();assert.equal(h.render('2026-10-28'),null);assert.equal(h.requests.length,0);h.render();h.setDay('2026-10-30');h.listeners.get('visibilitychange')();assert.equal(h.render('2026-10-29'),null);});
test('busy, uncertain, unconfigured and unsaved work disable publishing',async()=>{
 for(const patch of[{busy:true},{uncertain:true},{configured:false}]){const h=harness();h.render();h.requests[0].resolve({...status,...patch});await h.flush();assert.equal(h.nodes(h.render()).find(n=>n.type==='button').props.disabled,true);}
 const h=harness();h.render();h.requests[0].resolve(status);await h.flush();assert.equal(h.nodes(h.render('2026-10-29',true)).find(n=>n.type==='button').props.disabled,true);
});
test('failed publication shows an error and preserves last verified timestamp',async()=>{const h=harness();h.render();h.requests[0].resolve({...status,updated:'2026-10-29T08:00:00Z'});await h.flush();h.nodes(h.render()).find(n=>n.type==='button').props.onClick();h.requests[1].reject(new Error('Upload failed'));await h.flush();const nodes=h.nodes(h.render());assert.ok(nodes.some(n=>n.props?.role==='alert'));assert.ok(nodes.some(n=>Array.isArray(n.props?.children)&&n.props.children[0]==='Ultima pubblicazione: '));});
