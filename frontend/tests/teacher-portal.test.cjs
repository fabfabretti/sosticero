const {test}=require('node:test'),assert=require('node:assert/strict');
const {readFileSync}=require('node:fs'),{runInNewContext}=require('node:vm'),ts=require('typescript');
const settle=()=>new Promise(r=>setImmediate(r));
function harness(file){
 const slots=[],effects=[],requests=[],exports={},handlers={},timers=[];let cursor=0;
 const react={useRef(initial){const i=cursor++;return slots[i]||(slots[i]={current:initial});},useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},useEffect(fn,deps){const i=cursor++;const old=slots[i];if(!old||!deps||deps.some((d,j)=>d!==old.deps?.[j])){slots[i]={deps,cleanup:old?.cleanup};effects.push(()=>{slots[i].cleanup?.();slots[i].cleanup=fn();});}}};
 const jsx=(type,props)=>({type,props});
 const enqueue=(url,body)=>new Promise((resolve,reject)=>requests.push({url,body,resolve,reject}));
 runInNewContext(ts.transpileModule(readFileSync(`src/${file}.tsx`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Intl,Date,URLSearchParams,setInterval:fn=>{timers.push(fn);return timers.length;},clearInterval(){},navigator:{clipboard:{writeText:()=>Promise.resolve()}},window:{confirm:()=>true,addEventListener:(name,fn)=>handlers[name]=fn,removeEventListener(){}},document:{visibilityState:'visible',addEventListener:(name,fn)=>handlers[name]=fn,removeEventListener(){}},fetch:(url,options)=>enqueue(url,options?.body?JSON.parse(options.body):undefined),require:id=>id==='react'?react:id==='react/jsx-runtime'?{jsx,jsxs:jsx}:id==='./session'?{requestApi:enqueue}:id==='./timetables'?{norm:s=>s.toLowerCase()}:{Loading:'loading'}});
 const render=()=>{cursor=0;const nodes=[];const walk=n=>{if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;nodes.push(n);walk(n.props?.children);};walk(exports[file]({onCreate(){}}));effects.splice(0).forEach(fn=>fn());return nodes;};
 const label=n=>Array.isArray(n)?n.map(label).join(''):typeof n==='string'||typeof n==='number'?String(n):n?.props?label(n.props.children):'';
 const button=text=>render().find(n=>n.type==='button'&&label(n.props.children)===text);
 const input=label=>render().find(n=>n.type==='input'&&n.props['aria-label']===label);
 const respond=async(value,status=200,request=requests.shift())=>{request.resolve(file==='TeacherPortal'?{ok:status<400,status,json:async()=>value}:value);await settle();};
 return{render,requests,button,input,respond,timers,exports,unmount:()=>slots.forEach(s=>s?.cleanup?.())};
}
const person={id:'a',name:'Anna Rossi',role:'curricolare'};
const second={id:'b',name:'Luca Verdi',role:'ITP'};
const account={person:'a',email:'anna@school.it',enabled:false,hasPin:false,revision:1};
test('inline emails batch together, stay across filters and survive conflicts',async()=>{
 const h=harness('TeacherAccess');h.render();await h.respond({people:{a:person,b:second},accounts:{}});
 h.button('Modifica email').props.onClick();
 h.input('Email di accesso di Anna Rossi').props.onChange({target:{value:'anna@school.it'}});
 h.input('Email di accesso di Luca Verdi').props.onChange({target:{value:'luca@school.it'}});
 h.render().find(n=>n.props.type==='search').props.onChange({target:{value:'Anna'}});
 assert.equal(h.render().filter(n=>n.props?.type==='email').length,1);
 h.button('Salva email (2)').props.onClick();const save=h.requests.shift();assert.equal(save.body.rows.length,2);assert.equal(save.body.rows[0].revision,0);
 save.reject(new Error('Accesso modificato'));await settle();assert.equal(h.input('Email di accesso di Anna Rossi').props.value,'anna@school.it');
 assert.match(JSON.stringify(h.render()),/email da salvare/);
 h.unmount();
});
test('activation saves immediately and shows generated PIN without another save',async()=>{
 const h=harness('TeacherAccess');h.render();await h.respond({people:{a:person},accounts:{a:account}});
 assert.ok(!h.input('Accesso attivo di Anna Rossi'));
 h.button('Attiva accesso').props.onClick();assert.equal(h.requests[0].url,'teacher-access/activation');
 assert.equal(h.requests[0].body.enabled,true);assert.equal(h.requests[0].body.rows[0].revision,1);
 // Do not pretend activation succeeded while the server is still processing.
 assert.ok(!h.render().some(n=>n.props?.className==='teacher-access-status is-active'));
 await h.respond({accounts:{a:{...account,enabled:true,hasPin:true,revision:2}},pins:[{person:'a',name:person.name,email:account.email,pin:'00001234'}]});
 assert.match(JSON.stringify(h.render()),/00001234/);assert.ok(h.button('Disattiva'));
 assert.ok(!h.render().some(n=>n.type==='button'&&String(n.props.children).startsWith('Salva email')));
 h.button('Disattiva').props.onClick();assert.equal(h.requests[0].body.enabled,false);
 await h.respond({accounts:{a:{...account,enabled:false,hasPin:true,revision:3}},pins:[]});
 // Later state changes must not erase PINs awaiting distribution.
 assert.match(JSON.stringify(h.render()),/00001234/);
 h.button('Chiudi PIN').props.onClick();assert.doesNotMatch(JSON.stringify(h.render()),/00001234/);h.unmount();
});
test('bulk activation includes all ready accounts, uses selection when requested and never resets PINs',async()=>{
 const h=harness('TeacherAccess');h.render();await h.respond({people:{a:person,b:second},accounts:{a:account,b:{...account,person:'b',email:'luca@school.it',hasPin:true}}});
 h.button('Attiva tutti con email (2)').props.onClick();assert.equal(h.requests[0].body.rows.length,2);
 await h.respond({accounts:{a:account,b:{...account,person:'b',email:'luca@school.it',hasPin:true}},pins:[]});
 h.input('Seleziona Anna Rossi').props.onChange({target:{checked:true}});
 h.button('Attiva selezionati (1)').props.onClick();assert.equal(h.requests[0].body.rows.length,1);assert.equal(h.requests[0].body.rows[0].person,'a');h.unmount();
});
test('email mode disables activation and failure retains actual inactive state',async()=>{
 const h=harness('TeacherAccess');h.render();await h.respond({people:{a:person},accounts:{a:account}});
 h.button('Modifica email').props.onClick();assert.equal(h.button('Attiva accesso').props.disabled,true);
 h.button('Annulla').props.onClick();h.button('Attiva accesso').props.onClick();h.requests.shift().reject(new Error('Conflitto'));await settle();
 assert.ok(h.button('Attiva accesso'));assert.ok(!h.button('Disattiva'));assert.match(JSON.stringify(h.render()),/Conflitto/);h.unmount();
});
const session={account:{id:'personal',person:'a',email:'anna@school.it'},csrf:'token'};
const snapshot=day=>({day,status:'ready',teacher:{name:'Anna Rossi'},periods:[{hour:2,classes:['2B'],activities:[],room:'12',site:'centrale'}]});
test('portal makes only teacher requests and prevents stale dates or identity content',async()=>{
 const h=harness('TeacherPortal');h.render();assert.equal(h.requests[0].url,'/api/teacher/auth/session');await h.respond(session);
 h.render();const old=h.requests.shift();const day=new URL('http://local'+old.url).searchParams.get('day');
 await h.respond(snapshot(day),200,old);assert.match(JSON.stringify(h.render()),/Anna Rossi/);
 const picker=h.render().find(n=>n.props.type==='date');picker.props.onChange({target:{value:'2026-11-09'}});h.render();const earlier=h.requests.shift();
 h.render().find(n=>n.props.type==='date').props.onChange({target:{value:'2026-11-10'}});h.render();const later=h.requests.shift();
 await h.respond(snapshot('2026-11-10'),200,later);await h.respond({...snapshot('2026-11-09'),teacher:{name:'Stale name'}},200,earlier);
 assert.doesNotMatch(JSON.stringify(h.render()),/Stale name/);
 h.button('Esci').props.onClick();assert.doesNotMatch(JSON.stringify(h.render()),/Anna Rossi/);
 await h.respond({ok:true});assert.doesNotMatch(JSON.stringify(h.render()),/2B/);assert.ok(h.button('Accedi'));h.unmount();
});
test('expired portal sessions clear timetable and login preserves leading-zero PINs',async()=>{
 const h=harness('TeacherPortal');h.render();await h.respond({detail:'Accesso richiesto.'},401);
 const email=h.render().find(n=>n.props.type==='email'),pin=h.render().find(n=>n.props.type==='password');
 email.props.onChange({target:{value:'anna@school.it'}});pin.props.onChange({target:{value:'00001234'}});
 h.render().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.equal(h.requests[0].body.pin,'00001234');
 await h.respond(session);h.render();await h.respond({detail:'Accesso richiesto.'},401);assert.ok(h.button('Accedi'));assert.doesNotMatch(JSON.stringify(h.render()),/2B/);h.unmount();
 assert.equal(h.exports.moveDate('2026-12-31',1),'2027-01-01');
});

test('teacher PIN visibility and paste normalization preserve the code on login errors',async()=>{
 const h=harness('TeacherPortal');h.render();await h.respond({detail:'Accesso richiesto.'},401);
 let pin=h.render().find(n=>n.props.type==='password');pin.props.onChange({target:{value:' 00001234 '}});
 h.button('Mostra PIN').props.onClick();pin=h.render().find(n=>n.props.type==='text'&&n.props.inputMode==='numeric');assert.equal(pin.props.value,'00001234');
 h.render().find(n=>n.props.type==='email').props.onChange({target:{value:' anna@school.it '}});
 h.render().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.equal(h.requests[0].body.email,'anna@school.it');assert.equal(h.requests[0].body.pin,'00001234');
 await h.respond({detail:'Credenziali non valide.'},401);assert.equal(h.render().find(n=>n.props.inputMode==='numeric').props.value,'00001234');h.unmount();
});

test('missing-email filter keeps edited rows visible while entering email addresses',async()=>{
 const h=harness('TeacherAccess');h.render();await h.respond({people:{a:person,b:second},accounts:{}});
 h.render().find(n=>n.type==='select').props.onChange({target:{value:'missing'}});h.button('Modifica email').props.onClick();
 h.input('Email di accesso di Anna Rossi').props.onChange({target:{value:'anna@school.it'}});
 assert.equal(h.render().filter(n=>n.props?.type==='email').length,2);assert.equal(h.input('Email di accesso di Anna Rossi').props.value,'anna@school.it');h.unmount();
});
