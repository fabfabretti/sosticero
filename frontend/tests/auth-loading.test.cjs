const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const { loading } = require('./loading-harness.cjs');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function harness() {
  const slots=[], effects=[], requests=[], events={}, timers=[];let cursor=0,session;
  const react={createContext:()=>({Provider:'provider'}), useContext(){},
    useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},
    useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},
    useEffect(fn,deps){const i=cursor++;if(!(i in slots)||deps.some((d,j)=>d!==slots[i][j]))effects.push(fn);slots[i]=deps;},
  };
  const exports={},jsx=(type,props)=>({type,props});
  runInNewContext(ts.transpileModule(readFileSync('src/Auth.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
    exports,requestAnimationFrame:fn=>fn(),setInterval:fn=>timers.push(fn),clearInterval(){},
    window:{addEventListener:(name,fn)=>events[name]=fn,removeEventListener(){}},document:{documentElement:{dataset:{}},visibilityState:'visible',addEventListener(){},removeEventListener(){}},
    require:id=>id==='react'?react:id==='react/jsx-runtime'?{jsx,jsxs:jsx}:id==='./Loading'?loading:{currentSession:()=>session,setSession:v=>session=v,requestApi:(url,body)=>new Promise((resolve,reject)=>requests.push({url,body,resolve,reject}))},
  });
  function render(){cursor=0;const nodes=[];function walk(n){if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;nodes.push(n);walk(n.props.children);}walk(exports.Auth({children:'content'}));effects.splice(0).forEach(fn=>fn());return nodes;}
  return {render,requests,events,timers,session:()=>session};
}
const account={account:{id:'test',name:'Test',campus:'centrale'}};
test('login has pending feedback, blocks duplicate submit and recovers from errors', async()=>{
  const h=harness();h.render();h.requests.shift().reject(Error('sign in'));await settle();
  let nodes=h.render();const submit=nodes.find(n=>n.type==='form').props.onSubmit;
  const a=submit({preventDefault(){}}),b=submit({preventDefault(){}});assert.equal(h.requests.length,1);
  nodes=h.render();assert.equal(nodes.find(n=>n.type==='button').props.disabled,true);
  h.requests.shift().reject(Error('wrong password'));await Promise.all([a,b]);assert.ok(h.render().some(n=>n.props.role==='alert'));
});
test('logout blocks duplicates and invalidates a session poll already in flight',async()=>{
  const h=harness();h.render();h.requests.shift().resolve(account);await settle();h.render();
  h.timers[0]();const stale=h.requests.shift();
  const a=h.events['session-logout'](),b=h.events['session-logout']();assert.equal(h.requests.length,1);
  assert.ok(h.render().some(n=>n.props.inert));h.requests.shift().resolve({});await Promise.all([a,b]);
  stale.resolve(account);await settle();h.render();assert.equal(h.session(),undefined);
});
