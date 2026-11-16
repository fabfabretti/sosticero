const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {runInNewContext}=require('node:vm');
const ts=require('typescript');
const jsx=(type,props)=>({type,props});
function flatten(n){return Array.isArray(n)?n.flatMap(flatten):n&&typeof n==='object'?[n,...flatten(n.props?.children)]:[];}
function load(file,globals){const exports={};runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports,...globals});return exports;}
const notice={day:'2026-11-12',origin:'centrale',destination:'succursale',communicated:false,accepted:true,rows:[{h:4,c:'3B',aula:null},{h:3,c:'2A',aula:'12'}]};
test('notice orders hours, signs with current user and includes reminder',()=>{
 const {campusNoticeMessage}=load('src/CampusNoticeActions.tsx',{require:()=>({})});
 const text=campusNoticeMessage(notice,'Maria Rossi','Luca Bianchi');
 assert.match(text,/Gentile Professore\/Professoressa Luca Bianchi,/);
 assert.match(text,/per le ore 3ª e 4ª/);
 assert.match(text,/12\/11\/2026.*sede Succursale, anziché Centrale/);
 assert.ok(text.indexOf('3ª ora — classe 2A, aula 12')<text.indexOf('4ª ora — classe 3B, aula da verificare'));
 assert.match(text,/Ricordo, per favore, di verificare le sostituzioni effettivamente assegnate sul tabellone delle sostituzioni, e di firmare quelle svolte\./);
 assert.ok(text.endsWith('Cordiali saluti,\nMaria Rossi'));
});
test('controls enforce permission; copying gives feedback without toggling',async()=>{
 let feedback='',fail=false;const calls=[],copied=[];
 const mod=load('src/CampusNoticeActions.tsx',{require:id=>id==='react'?{useState:()=>[feedback,v=>feedback=v]}:{jsx,jsxs:jsx},navigator:{clipboard:{writeText:async v=>{if(fail)throw Error();copied.push(v);}}}});
 const props={notice,signature:'Maria Rossi',recipientName:'Luca Bianchi',busy:false,canAssign:false,onToggle:f=>calls.push(f)};
 const buttons=()=>flatten(mod.CampusNoticeActions(props)).filter(n=>n.type==='button');
 assert.equal(buttons()[0].props.disabled,true);buttons()[0].props.onClick();assert.equal(calls.length,0);
 assert.equal(buttons()[1].props['aria-pressed'],true);
 buttons()[2].props.onClick();await new Promise(r=>setImmediate(r));assert.equal(feedback,'Copiato');assert.equal(calls.length,0);assert.equal(copied.length,1);
 props.canAssign=true;buttons()[0].props.onClick();buttons()[1].props.onClick();assert.deepEqual(calls,['communicated','accepted']);
 fail=true;buttons()[2].props.onClick();await new Promise(r=>setImmediate(r));assert.match(feedback,/Copia non riuscita/);
});
test('group mutation sends group and assignment preconditions',()=>{
 const {preconditions}=load('src/concurrency.ts',{});
 const result=preconditions({records:{'asg|d|k':'a','campusNotice|d|k':'n'},dates:{}},'assignments',{day:'d',key:'k',campus_notice:true});
 assert.equal(result['asg|d|k'],'a');assert.equal(result['campusNotice|d|k'],'n');
});

test('campus refusal explicitly covers the whole notice and enforces permissions',()=>{
 let refused=0;
 const mod=load('src/CampusNoticeActions.tsx',{require:id=>id==='react'?{useState:()=>['',()=>{}]}:{jsx,jsxs:jsx}});
 const props={notice,busy:false,canAssign:true,onRefuse:()=>refused++};
 const button=()=>flatten(mod.CampusNoticeActions(props)).find(n=>n.props.className==='refuse');
 assert.match(button().props.children,/tutte le ore/);assert.match(button().props['aria-label'],/intera comunicazione/);
 button().props.onClick();assert.equal(refused,1);
 props.busy=true;assert.equal(button().props.disabled,true);button().props.onClick();
 props.busy=false;props.canAssign=false;button().props.onClick();assert.equal(refused,1);
});
