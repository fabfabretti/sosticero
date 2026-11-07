const {test}=require('node:test'),assert=require('node:assert/strict');
const {readFileSync}=require('node:fs'),{runInNewContext}=require('node:vm'),ts=require('typescript');
const settle=()=>new Promise(r=>setImmediate(r));
const norm=s=>s.toLowerCase().replace(/[\s.-]/g,'');
const original={id:'original',name:'Anna Rossi',code:'ROS',role:'curricolare',classe_concorso:'A041'};
const replacement={id:'replacement',name:'Marco Verdi',code:'VER',role:'curricolare',classe_concorso:'A041'};
const empty={schema:1,people:{},sources:{},absences:[],appointments:[]};
const result=(extra={})=>({token:'reviewed',ready:true,records:[],issues:[],dataset:{teachers:{},lessons:{}},...extra});
function harness(file='Staffing',props){
 const slots=[],effects=[],requests=[],exports={};let cursor=0,seq=0;
 const react={useRef(initial){const i=cursor++;return slots[i]||(slots[i]={current:initial});},useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},useEffect(fn){const i=cursor++;if(!(i in slots)){slots[i]=true;effects.push(fn);}}};
 const jsx=(type,props)=>({type,props});
 runInNewContext(ts.transpileModule(readFileSync(`src/${file}.tsx`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Intl,Date,structuredClone,crypto:{randomUUID:()=>`new-${++seq}`},require:id=>id==='react'?react:id==='react/jsx-runtime'?{jsx,jsxs:jsx}:id==='./session'?{requestApi:(url,body)=>new Promise((resolve,reject)=>requests.push({url,body,resolve,reject}))}:id==='./TeacherAccess'?{TeacherAccess:'teacher-access'}:id==='./TeacherPicker'?{TeacherPicker:'teacher-picker'}:id==='./timetables'?{DAYS:['lun'],HOURS:[1],norm,teacherSearchText:t=>[t.name,t.code||''].join(' ')}:{AdministrationLayout:'layout',Loading:'loading'}});
 const render=()=>{cursor=0;const nodes=[];const walk=n=>{if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;nodes.push(n);walk(n.props?.children);};walk(exports[file](props));effects.splice(0).forEach(fn=>fn());return nodes;};
 const button=text=>render().find(n=>n.type==='button'&&n.props.children===text);
 const input=text=>render().find(n=>n.type==='label'&&Array.isArray(n.props.children)&&n.props.children[0]===text).props.children[1];
 const submit=()=>render().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
 return{render,requests,button,input,submit};
}
async function loaded(doc=empty){const h=harness();h.render();h.requests.shift().resolve({revision:'v1',document:doc,people:{original,replacement},sources:{original},classCodes:{A041:'Scienze e tecnologie informatiche'}});await settle();return h;}
test('default screen lists active prolonged absences and assigns from their original cattedra',async()=>{
 const doc=structuredClone(empty);doc.absences=[{id:'absence',person:'original',start:'2020-01-01',end:null}];
 const h=await loaded(doc);assert.ok(h.button('Assegna supplente'));assert.ok(!h.render().some(n=>n.type==='select'));
 h.button('Assegna supplente').props.onClick();h.render().find(n=>n.type==='teacher-picker').props.onChange('replacement');h.submit();
 const request=h.requests.shift();assert.equal(request.url,'staffing/preview');assert.equal(request.body.document.appointments[0].source,'original');assert.equal(request.body.document.appointments[0].person,'replacement');assert.equal(request.body.document.absences[0].id,'absence');
 request.resolve(result());await settle();h.button('Conferma supplenza').props.onClick();assert.equal(h.requests[0].url,'staffing/apply');assert.equal(h.requests[0].body.revision,'v1');
});
test('new teacher shows code and discipline together and stores the selected code',async()=>{
 const h=await loaded();h.button('Docenti').props.onClick();h.render().find(n=>n.type==='teacher-access').props.onCreate();h.input('Nome e cognome').props.onChange({target:{value:'Giulia Bianchi'}});
 h.render().find(n=>n.props?.id==='staffing-cdc').props.onChange({target:{value:'informat'}});
 const option=h.render().find(n=>n.props?.role==='option');assert.equal(option.props.children[0],'A041');assert.match(option.props.children[1].props.children,/informatiche/);option.props.onClick();
 h.submit();const request=h.requests.shift();assert.equal(Object.values(request.body.document.people)[0].classe_concorso,'A041');request.resolve(result());await settle();assert.ok(h.button('Salva docente'));
});
test('absence creation is separate from replacement selection and conflicts preserve the draft',async()=>{
 const h=await loaded();h.button('Nuova assenza prolungata').props.onClick();h.render().find(n=>n.type==='teacher-picker').props.onChange('original');h.submit();
 const request=h.requests.shift();assert.equal(request.body.document.absences[0].person,'original');assert.equal(request.body.document.appointments.length,0);
 request.reject(new Error('Dati modificati'));await settle();assert.equal(h.render().find(n=>n.type==='teacher-picker').props.value,'original');h.submit();h.requests.shift().resolve(result({ready:false,issues:[{day:'2026-11-04',key:'x',message:'Assegnazione incompatibile'}]}));await settle();assert.equal(h.button('Conferma assenza prolungata').props.disabled,true);
});
test('existing cover is preserved information and does not require a checkbox',async()=>{
 const h=await loaded();h.button('Nuova assenza prolungata').props.onClick();h.render().find(n=>n.type==='teacher-picker').props.onChange('original');h.submit();h.requests.shift().resolve(result({records:[{day:'2026-11-04',person:'original',substitute:'replacement',group:'asg',hours:[2]}]}));await settle();
 assert.equal(h.button('Conferma assenza prolungata').props.disabled,false);
 assert.ok(!h.render().some(n=>n.props?.type==='checkbox'));
 assert.equal(h.render().find(n=>n.type==='details').props.open,undefined);
 const text=JSON.stringify(h.render());assert.match(text,/Registrazioni esistenti mantenute/);assert.match(text,/Anna Rossi/);assert.match(text,/Copertura: Marco Verdi/);assert.match(text,/già registrate saranno mantenute/);
 h.button('Conferma assenza prolungata').props.onClick();assert.equal(h.requests[0].url,'staffing/apply');
});
test('teacher picker searches names and codes, selects explicitly and supports keyboard navigation',()=>{
 let selected='';const props={id:'pick',label:'Cerca supplente',teachers:[original,replacement],value:'',onChange:id=>{selected=id;props.value=id;}};const h=harness('TeacherPicker',props);
 const input=()=>h.render().find(n=>n.type==='input');input().props.onChange({target:{value:'ver'}});assert.equal(selected,'');assert.equal(h.render().filter(n=>n.props?.role==='option').length,1);
 input().props.onKeyDown({key:'Enter',preventDefault(){}});assert.equal(selected,'replacement');assert.equal(input().props.value,'Marco Verdi');
 input().props.onChange({target:{value:'ros'}});assert.equal(selected,'');h.render().find(n=>n.props?.role==='option').props.onClick();assert.equal(selected,'original');
});
