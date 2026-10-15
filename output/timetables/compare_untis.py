"""Compare actual filled Untis PDF rectangles with exported teacher slots (no DB)."""
import collections
import importlib.util
import json
from pathlib import Path
import re
import sys
import pdfplumber

root, out = map(Path, sys.argv[1:])
spec = importlib.util.spec_from_file_location('parser', Path(__file__).with_name('parse_timetables.py'))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
people = {r[0]: {'name': (r[1]+' '+r[28]).strip(), 'role':r[22]} for r in m.csv_rows(root, 'GPU004.TXT')}
classes = {m.canonical_class(r[0]) for r in m.csv_rows(root, 'classi.TXT') if re.fullmatch(r'[1-5][A-Z]+\.?', r[0])} | {'1AE'}
def cls(s):
    return m.canonical_class(s)
def activity(s):
    s = re.sub(r'[.\s]', '', s).upper()
    return {'STAFF_C':'STAF','STAFF_S':'STAF','DISE':'DIS','DISS':'DIS','POTS':'POT','MON':'MONT','EINA':'EINAUDI','SOS':'SOST','GM':'GMARC','LPIN':'LPIND','FRA':'FRACAST','ALFC':'ALF','ALFS':'ALF','CAN':'CANG','FER':'FERR','SILV':'SILVA','SRI':'SRICCI','CPO':'CPOT'}.get(s,s)
pdf_slots = {}; headers = collections.Counter(); unknown = []
with pdfplumber.open(root/'DOCENTI Definitivo-2.pdf') as pdf:
    for page in pdf.pages:
        words = page.extract_words(x_tolerance=1,y_tolerance=1)
        rects = page.rects
        for w in words:
            code={'CAS':'CAST','PAC':'PACC'}.get(w['text'],w['text'])
            if code not in people or min(abs(w['x0']-x) for x in (67.789,322.36))>1 or min(abs(w['top']-(24.28+262.95*b)) for b in range(3))>2:
                continue
            # The PDF reuses ROS for Rossato and Rossin; the export distinguishes ROSS.
            if code == 'ROS' and any(t['text'] == 'Rossin' and abs(t['top']-w['top'])<4 and w['x0']<t['x0']<w['x0']+100 for t in words):
                code = 'ROSS'
            headers[code]+=1
            gx=w['x0']+33.1735; gy=71.3209+262.95*round((w['top']-24.28)/262.95)
            for rect in rects:
                if not rect['fill'] or not 35<rect['width']<40 or rect['height']<15: continue
                day=round((rect['x0']-gx)/38.94277)
                start=round((rect['top']-gy)/24.49397)
                count=round((rect['height']+1.4)/24.49397)
                if not (0<=day<5 and 0<=start<7 and 1<=count<=7-start):continue
                if abs(rect['x0']-(gx+day*38.94277))>2 or abs(rect['top']-(gy+start*24.49397))>2:continue
                ww=[t for t in words if rect['x0']<(t['x0']+t['x1'])/2<rect['x1'] and rect['top']<(t['top']+t['bottom'])/2<rect['bottom']]
                tokens=[t['text'] for t in ww]
                cc=sorted({cls(t) for t in tokens if cls(t) in classes})
                acts=[]
                if not cc:
                    # Only compare activity cells whose text is legible and known.
                    acts=sorted({activity(t) for t in tokens if re.fullmatch(r'[A-Z][A-Z._-]*',t)})
                    if not acts:
                        unknown.append(dict(code=code,page=page.page_number,day=m.DAYS[day],hour=start+1,tokens=tokens))
                        continue
                for hour in range(start+1,start+count+1):
                    key=(code,m.DAYS[day],hour)
                    value=dict(classes=cc,activities=acts,page=page.page_number,text=' '.join(tokens),bbox=[rect['x0'],rect['top'],rect['x1'],rect['bottom']])
                    if key in pdf_slots and pdf_slots[key]!=value:raise ValueError(f'Overlapping rectangles {key}')
                    pdf_slots[key]=value
        print('page',page.page_number,flush=True)
export={}; unnamed=[]; allrows=m.csv_rows(root,'orario.TXT')
for line,r in enumerate(allrows,1):
    if not r[2]:
        peers=[v for v in allrows if v[0]==r[0] and v[5:7]==r[5:7] and v[2]]
        unnamed.append(dict(line=line,lesson=r[0],subject=r[3],day=m.DAYS[int(r[5])-1],hour=int(r[6]),named_components=[dict(teacher=v[2],class_name=cls(v[1]),subject=v[3]) for v in peers]))
        continue
    key=r[2],m.DAYS[int(r[5])-1],int(r[6]);item=export.setdefault(key,dict(classes=[],activities=[]))
    c=cls(r[1]);field,value=('classes',c) if c in classes else ('activities',activity(r[1] or r[3]))
    if value and value not in item[field]:item[field].append(value)
for item in export.values():
    for f in item:item[f].sort()
differences=[]
for key in sorted(pdf_slots.keys()|export.keys()):
    code,day,hour=key
    if people[code]['role'] in ('ADSS','SOS'):continue
    a=pdf_slots.get(key);b=export.get(key)
    if a and b and (a['classes'],a['activities'])==(b['classes'],b['activities']):continue
    differences.append(dict(code=code,name=people[code]['name'],day=day,hour=hour,pdf=a,export=b))
report=dict(pdf_header_counts=dict(headers),pdf_slots=[dict(code=k[0],day=k[1],hour=k[2],**v) for k,v in pdf_slots.items()],differences=differences,unparsed_pdf_cells=unknown,unnamed_export_rows=unnamed)
out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('DIFFERENCES',len(differences),'TEACHERS',len({d['code'] for d in differences}),'UNKNOWN CELLS',len(unknown))
