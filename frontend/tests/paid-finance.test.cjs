const {test}=require('node:test'), assert=require('node:assert/strict');
const {readFileSync}=require('node:fs'), {runInNewContext}=require('node:vm'),ts=require('typescript');
const jsx=(type,props)=>({type,props});
function load(file,imports={}) { const exports={};runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:id=>imports[id]||{},console});return exports; }
function flatten(node){if(Array.isArray(node))return node.flatMap(flatten);if(!node||typeof node!=='object')return[];return [node,...flatten(node.props?.children)];}
const money=load('src/paid-finance.ts');
test('euro inputs distinguish optional, zero, decimals and Italian grouping exactly',()=>{
 for(const [input,want] of [['',null],['0',0],['31,11',3111],['28.74',2874],['3.406,12',340612],['3406.12',340612]])assert.equal(money.parseEuro(input),want);
 for(const input of ['-1','1,234','1.234','1e3','Infinity','1.2,34','2,4,5'])assert.throws(()=>money.parseEuro(input));
 assert.equal(money.amountInput(null),'');assert.equal(money.amountInput(0),'0,00');assert.equal(money.amountInput(3111),'31,11');
});
test('summary exposes overrun, incomplete scope and zero budget without capping text',()=>{
 const mod=load('src/PaidBudgetSummary.tsx',{'react/jsx-runtime':{jsx,jsxs:jsx},'./paid-finance':money});
 const value={cost:12111,budget:10000,remaining:-2111,percent:121.11,unpriced:1};
 const nodes=flatten(mod.PaidBudgetSummary({finance:{sites:{centrale:value,succursale:{...value,budget:null}},all:value,configured:['centrale'],overall:value}}));
 const total=nodes.find(n=>typeof n.type==='function');const inner=flatten(total.type(total.props));
 const text=JSON.stringify(inner);
 assert.match(text,/121,11% utilizzato/);assert.match(text,/Superato di/);assert.match(text,/totale parziale/);assert.match(text,/ore da valorizzare/);
 assert.equal(inner.find(n=>n.type==='progress').props.value,100);
 assert.match(JSON.stringify(nodes),/Solo budget configurati/);
 const zero=flatten(total.type({title:'Zero',value:{...value,budget:0,percent:null}}));assert.match(JSON.stringify(zero),/Percentuale non disponibile/);assert.ok(!zero.some(n=>n.type==='progress'));
});
test('settings save cents and preserve stale draft until explicit reconciliation',async()=>{
 let cursor=0;const slots=[],effects=[],requests=[];
 const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},useRef(initial){const i=cursor++;return slots[i]||(slots[i]={current:initial});},useEffect(fn){const i=cursor++;if(!(i in slots)){slots[i]=true;effects.push(fn);}}};
 const config={sites:{centrale:{budget:null,laureato:null,diplomato:null},succursale:{budget:null,laureato:null,diplomato:null}},overrides:{}};
 const inventory={config,expected:{paidFinance:'token'},generation:4,teachers:{itp:{id:'itp',name:'Docente ITP',role:'ITP'}}};
 const mod=load('src/PaidBudgetSettings.tsx',{react,'react/jsx-runtime':{jsx,jsxs:jsx},'./paid-finance':money,'./SettingsGroup':{SettingsGroup:'group'},'./TeacherPicker':{TeacherPicker:'picker'},'./Loading':{Loading:'loading'},'./useQuietRefresh':{useQuietRefresh(load,apply){return{refresh:async()=>{apply(inventory);return inventory;},invalidate(){},loading:false,loadError:''};}}});
 const api=(url,body)=>new Promise((resolve,reject)=>requests.push({url,body,resolve,reject}));
 const render=()=>{cursor=0;const nodes=flatten(mod.PaidBudgetSettings({api,revision:0}));effects.splice(0).forEach(fn=>fn());return nodes;};
 const settle=()=>new Promise(r=>setImmediate(r));render();await settle();
 let nodes=render();nodes.find(n=>n.type==='button'&&n.props.children==='Modifica budget e tariffe').props.onClick();nodes=render();
 nodes.filter(n=>n.type==='input')[0].props.onChange({target:{value:'3.406,12',setCustomValidity(){}}});
 nodes=render();nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
 assert.equal(requests[0].body.config.sites.centrale.budget,340612);assert.equal(requests[0].body.expected.__generation__,'4');
 const error=new Error('Dati modificati');error.status=409;requests.shift().reject(error);await settle();nodes=render();
 assert.equal(nodes.filter(n=>n.type==='input')[0].props.value,'3.406,12');assert.ok(nodes.find(n=>n.type==='button'&&n.props.children==='Salva budget e tariffe').props.disabled);
 assert.ok(nodes.find(n=>n.type==='button'&&n.props.children==='Ricarica valori salvati'));
});
