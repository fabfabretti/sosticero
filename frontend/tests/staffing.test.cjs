const {test}=require('node:test'),assert=require('node:assert/strict');
const {readFileSync}=require('node:fs'),{runInNewContext}=require('node:vm'),ts=require('typescript');
const settle=()=>new Promise(r=>setImmediate(r));
const norm=s=>s.toLowerCase().replace(/[\s.-]/g,'');
const original={id:'original',name:'Anna Rossi',code:'ROS',role:'curricolare',classe_concorso:'A041'};
const replacement={id:'replacement',name:'Marco Verdi',code:'VER',role:'curricolare',classe_concorso:'A041'};
const empty={schema:1,people:{},sources:{},absences:[],appointments:[]};
const result=(extra={})=>({token:'reviewed',ready:true,removals:[],records:[],issues:[],dataset:{teachers:{},lessons:{}},...extra});
function harness(file='Staffing',props){
 const slots=[],effects=[],requests=[],exports={},copied=[];let cursor=0,seq=0;
 const react={useRef(initial){const i=cursor++;return slots[i]||(slots[i]={current:initial});},useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},useEffect(fn){const i=cursor++;if(!(i in slots)){slots[i]=true;effects.push(fn);}}};
 const jsx=(type,props)=>({type,props});
 runInNewContext(ts.transpileModule(readFileSync(`src/${file}.tsx`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Intl,Date,structuredClone,navigator:{clipboard:{writeText:async value=>copied.push(value)}},crypto:{randomUUID:()=>`new-${++seq}`},require:id=>id==='react'?react:id==='react/jsx-runtime'?{jsx,jsxs:jsx}:id==='./Auth'?{useAccount:()=>({name:'Firma Test'})}:id==='./session'?{requestApi:(url,body)=>new Promise((resolve,reject)=>requests.push({url,body,resolve,reject}))}:id==='./TeacherAccess'?{TeacherAccess:'teacher-access'}:id==='./TeacherPicker'?{TeacherPicker:'teacher-picker'}:id==='./timetables'?{DAYS:['lun'],HOURS:[1],norm,teacherSearchText:t=>[t.name,t.code||''].join(' ')}:{AdministrationLayout:'layout',Loading:'loading'}});
 const render=()=>{cursor=0;const nodes=[];const walk=n=>{if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;nodes.push(n);walk(n.props?.children);};walk(exports[file](props));effects.splice(0).forEach(fn=>fn());return nodes;};
 const button=text=>render().find(n=>n.type==='button'&&n.props.children===text);
 const input=text=>render().find(n=>n.type==='label'&&Array.isArray(n.props.children)&&n.props.children[0]===text).props.children[1];
 const submit=()=>render().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
 return{render,requests,button,input,submit,copied};
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
 const text=JSON.stringify(h.render());assert.doesNotMatch(text,/Registrazioni esistenti mantenute/);assert.match(text,/Anna Rossi/);assert.doesNotMatch(text,/Copertura: Marco Verdi/);assert.match(text,/Le coperture già assegnate restano invariate/);assert.match(text,/Le ore a pagamento saranno disabilitate nei giorni di assenza/);assert.match(text,/I saldi permessi restano personali/);
 h.button('Conferma assenza prolungata').props.onClick();assert.equal(h.requests[0].url,'staffing/apply');
});
test('teacher picker searches names and codes, selects explicitly and supports keyboard navigation',()=>{
 let selected='';const props={id:'pick',label:'Cerca supplente',teachers:[original,replacement],value:'',onChange:id=>{selected=id;props.value=id;}};const h=harness('TeacherPicker',props);
 const input=()=>h.render().find(n=>n.type==='input');input().props.onChange({target:{value:'ver'}});assert.equal(selected,'');assert.equal(h.render().filter(n=>n.props?.role==='option').length,1);
 input().props.onKeyDown({key:'Enter',preventDefault(){}});assert.equal(selected,'replacement');assert.equal(input().props.value,'Marco Verdi');
 input().props.onChange({target:{value:'ros'}});assert.equal(selected,'');h.render().find(n=>n.props?.role==='option').props.onClick();assert.equal(selected,'original');
});

test('appointment preview explicitly lists covers removed on confirmation',async()=>{
 const doc=structuredClone(empty);doc.absences=[{id:'absence',person:'original',start:'2020-01-01',end:null}];
 const h=await loaded(doc);h.button('Assegna supplente').props.onClick();h.render().find(n=>n.type==='teacher-picker').props.onChange('replacement');h.submit();
 h.requests.shift().resolve(result({removals:[{day:'2026-11-09',key:'original|2|5EB',person:'original',substitute:'replacement',hours:[2]}]}));await settle();
 assert.match(JSON.stringify(h.render()),/saranno rimosse/);assert.doesNotMatch(JSON.stringify(h.render()),/5EB/);assert.equal(h.button('Conferma supplenza').props.disabled,false);
});

test('paid covers to remove prominently identify notified and accepted teachers',async()=>{
 const h=await loaded();h.button('Nuova assenza prolungata').props.onClick();h.render().find(n=>n.type==='teacher-picker').props.onChange('original');h.submit();
 h.requests.shift().resolve(result({pausedPaid:[{person:'original',weekday:0,hours:[2]}],removals:[{day:'2026-11-04',key:'original|2|1A',person:'original',substitute:'replacement',hours:[2],category:"PAID",communicated:true,accepted:true},{day:"2026-11-04",key:"original|3|1A",person:"original",substitute:"replacement",hours:[3],category:"RP",communicated:true,accepted:false}]}));await settle();
 const text=JSON.stringify(h.render());assert.match(text,/Variazioni da comunicare/);assert.match(text,/Comunicato/);assert.match(text,/Accettata/);assert.doesNotMatch(text,/Disponibilità a pagamento sospese/);assert.match(text,/Marco Verdi/);assert.match(text,/Recupero permesso/);assert.doesNotMatch(text,/Non accettata/);const copy=h.render().find(n=>n.type==='button'&&n.props.title==='Copia avviso di variazione');copy.props.onClick();await settle();assert.match(h.copied[0],/\[Variazione supplenza\]/);assert.match(h.copied[0],/Marco Verdi/);assert.match(h.copied[0],/04\/11\/2026, 2ª ora, classe 1A/);assert.match(h.copied[0],/Cordiali saluti,\nFirma Test/);
});

test('replacement preview saves each non-lesson hour choice and refreshes verification',async()=>{
 const doc=structuredClone(empty);doc.absences=[{id:'absence',person:'original',start:'2020-01-01',end:null}];
 const h=await loaded(doc);h.button('Assegna supplente').props.onClick();h.render().find(n=>n.type==='teacher-picker').props.onChange('replacement');h.submit();
 const first=h.requests.shift(), appointment=first.body.document.appointments[0];assert.equal(Object.keys(appointment.activityHours).length,0);
 first.resolve(result({activityHours:{[appointment.id]:[{slot:'lun|1',codes:['POT'],disabled:false},{slot:'mar|3',codes:['RIT'],disabled:false}]}}));await settle();
 const button=h.render().find(n=>n.props?.['aria-label']==='Disabilita POT lun 1ª');assert.equal(button.props['aria-pressed'],false);button.props.onClick();
 const second=h.requests.shift();assert.equal(second.body.document.appointments[0].activityHours['lun|1'],true);assert.equal(h.button('Conferma supplenza').props.disabled,true);
 second.resolve(result({token:'new-token',activityHours:{[appointment.id]:[{slot:'lun|1',codes:['POT'],disabled:true},{slot:'mar|3',codes:['RIT'],disabled:false}]}}));await settle();
 assert.equal(h.render().find(n=>n.props?.['aria-label']==='Riattiva POT lun 1ª').props['aria-pressed'],true);h.button('Conferma supplenza').props.onClick();assert.equal(h.requests[0].body.token,'new-token');assert.equal(h.requests[0].body.document.appointments[0].activityHours['lun|1'],true);
});
