const {test}=require('node:test'), assert=require('node:assert/strict');
const {readFileSync}=require('node:fs'), {runInNewContext}=require('node:vm'), ts=require('typescript');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function harness(){
 const slots=[], effects=[], requests=[], events=[], exports={};let cursor=0;
 const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},useRef(initial){const i=cursor++;return slots[i]||(slots[i]={current:initial});},useEffect(fn,deps){const i=cursor++;if(!(i in slots)){slots[i]=deps;effects.push(fn);}}};
 const jsx=(type,props)=>({type,props});
 runInNewContext(ts.transpileModule(readFileSync('src/Administration.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Event,window:{dispatchEvent:e=>events.push(e.type)},require:id=>id==='react'?react:id==='react/jsx-runtime'?{jsx,jsxs:jsx}:id==='react-router'?{Link:'link'}:id==='./Loading'?{Loading:'loading'}:{requestApi:(url,body)=>new Promise((resolve,reject)=>requests.push({url,body,resolve,reject}))}});
 const render=()=>{cursor=0;const nodes=[];function walk(n){if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;nodes.push(n);walk(n.props?.children);}walk(exports.Administration());effects.splice(0).forEach(fn=>fn());return nodes;};
 return{render,requests,events,exports};
}
const account={id:'root',username:'admin',name:'Amministratore',admin:true,campuses:[],enabled:true,protected:true,revision:3};
function button(h,text){return h.render().find(n=>n.type==='button'&&n.props.children===text);}
function input(h,label){const field=h.render().find(n=>n.type==='label'&&Array.isArray(n.props.children)&&n.props.children[0]===label);return field.props.children[1];}
test('protected editor preserves immutable identity, submits revision and reauthenticates after self-update',async()=>{
 const h=harness();h.render();h.requests.shift().resolve([account]);await settle();button(h,'Modifica').props.onClick();
 assert.equal(input(h,'Nome completo').props.value,'Amministratore');
 assert.ok(h.render().some(n=>n.type==='input'&&n.props.type==='checkbox'&&n.props.checked===true&&n.props.disabled===true));
 input(h,'Nome completo').props.onChange({target:{value:'Amministratore scuola'}});
 const submit=h.render().find(n=>n.type==='form').props.onSubmit;submit({preventDefault(){}});submit({preventDefault(){}});
 assert.equal(h.requests.length,1);assert.equal(h.requests[0].url,'accounts/root');assert.equal(h.requests[0].body.revision,3);
 assert.equal(h.requests[0].body.name,'Amministratore scuola');assert.ok(!('password'in h.requests[0].body));
 h.requests.shift().resolve({account:{...account,revision:4},reauthenticate:true});await settle();assert.deepEqual(h.events,['session-expired']);
});
test('stale save preserves the name draft, clears password and requires explicit reload',async()=>{
 const h=harness();h.render();h.requests.shift().resolve([account]);await settle();button(h,'Modifica').props.onClick();
 input(h,'Nome completo').props.onChange({target:{value:'Draft name'}});
 input(h,'Nuova password (lascia vuoto per mantenerla)').props.onChange({target:{value:'Temporary-secret-123'}});
 h.render().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
 const error=new Error('Account modificato');error.status=409;h.requests.shift().reject(error);await settle();
 assert.equal(input(h,'Nome completo').props.value,'Draft name');assert.equal(input(h,'Nuova password (lascia vuoto per mantenerla)').props.value,'');
 assert.equal(button(h,'Salva account').props.disabled,true);assert.ok(button(h,'Ricarica valori salvati'));
});
test('permission labels distinguish admin, both campuses and no access',()=>{
 const h=harness();assert.equal(h.exports.permissionLabel(account),'Amministratore');
 assert.equal(h.exports.permissionLabel({...account,admin:false,campuses:['centrale','succursale']}),'Centrale · Succursale');
 assert.equal(h.exports.permissionLabel({...account,admin:false}),'Nessun accesso assegnato');
 const exports={};runInNewContext(ts.transpileModule(readFileSync('src/attribution.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports});
 const author={id:'a',name:'Maria Rossi con un nome molto lungo',username:'maria.rossi'};
 assert.equal(exports.authorLabel(author),author.name);assert.equal(exports.authorLabel(author,true),author.name+' (maria.rossi)');
 assert.equal(exports.authorLabel({id:'foreign',name:'Autore non disponibile',username:''}),'Autore non disponibile');
});
