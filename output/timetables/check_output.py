"""Source-based checks for this extraction. Run from repository root."""
import collections
import csv
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from backend.domain import normalize_dataset

root, output = map(Path, sys.argv[1:])
data = json.loads((output/'orari.json').read_text())
ds = normalize_dataset(data)
rows = list(csv.reader((root/'orario.TXT').read_text(encoding='cp1252').splitlines()))
by_code = {t['sigla_untis']: t['id'] for t in data['docenti'] if t['sigla_untis']}
slots = {(l['docente'], l['giorno'], l['ora']): l for l in data['orario']}
days = ['lun','mar','mer','gio','ven']
expected_porco = {(by_code[r[2]], days[int(r[5])-1], int(r[6])):r[1] for r in rows if r[2]=='POR'}
assert len(expected_porco) == 18
assert collections.Counter(r['attivita_riconosciute'][0].replace('.', '') for k,r in slots.items() if k[0]==by_code['POR']) == {'UTC':11, 'UTS':7}
for key, activity in expected_porco.items():
    assert [v.replace('.', '') for v in slots[key]['attivita_riconosciute']] == [activity.replace('.', '')]
    assert slots[key]['classi'] == []
# Curricular slots now follow the PDF, including its empty cells.
comparison = json.loads((output/'untis-comparison.json').read_text())
ids = {t['sigla_untis'] for t in data['docenti'] if t['ruolo'] != 'sostegno'}
expected = {(by_code[l['code']],l['day'],l['hour']) for l in comparison['pdf_slots'] if l['code'] in ids}
assert {k for k in slots if k[0] in {by_code[c] for c in ids}} == expected
for pdf_lesson in comparison['pdf_slots']:
    if pdf_lesson['code'] in ids:
        expected_classes = { {'1GST':'1GS','5AES':'5AE'}.get(c,c) for c in pdf_lesson['classes'] }
        assert set(slots[by_code[pdf_lesson['code']],pdf_lesson['day'],pdf_lesson['hour']]['classi']) == expected_classes
assert all(l['fonte'][0]['file']=='DOCENTI Definitivo-2.pdf' for l in data['orario'] if l['docente'] in {by_code[c] for c in ids})
assert {k[1:] for k,l in slots.items() if k[0]==by_code['PAT'] and l['attivita_riconosciute']==['DI.S']} == {('lun',2),('gio',1),('ven',1)}
assert not any('POT' in l['attivita_riconosciute'] for k,l in slots.items() if k[0]==by_code['PAT'])
assert slots[by_code['TAC'],'mer',1]['classi'] == slots[by_code['TAC'],'mer',2]['classi'] == ['2CE']
assert slots[by_code['BEV'],'mer',6]['classi'] == ['2CE']
assert (by_code['TAC'],'mer',6) not in slots and (by_code['AUR'],'mer',1) not in slots
assert all(all(c[0] in '12345' for c in l['classi']) for l in data['orario'])
assert len(slots) == len(data['orario']) == len(ds['lessons'])
assert len([t for t in data['docenti'] if t['nome_originale']=='Ianzano']) == 1
assert slots[next(t['id'] for t in data['docenti'] if t['nome_originale']=='Ianzano'),'gio',2]['classi'] == ['1CE']
assert slots[by_code['PUR'],'lun',7]['classi'] == ['2FST']
print('PASS: import schema, all PDF curricular slots, all 18 Porco hours, activity/class separation, current Ianzano and Purgato schedules')

existing = json.loads((Path(__file__).parent/'existing-teachers.json').read_text())
for t in existing:
    matches = [v for v in data['docenti'] if v['nome_originale'] == t['name']]
    if matches: assert matches[0]['id'] == t['id'], t['name']
assert by_code['ROS'] != by_code['ROSS'] != by_code['RSN']
assert by_code['MLL'] != next(t['id'] for t in data['docenti'] if t['nome_originale']=='Martinelli Andrea')
print('PASS: stable existing IDs, distinct Rossato/Rossin identities, distinct Martinelli identities')

assert {t['id'] for t in data['docenti']} == {t['id'] for t in existing}
for code, name in {'B016': 'DILEO IGNAZIO PASQUALE', 'SAV': 'Spillari Davide (Savelli)',
                   'VAL': 'ADRIANILLI FRANCESCA', 'LAV': 'Lavorato (Lazzaro) Vinc'}.items():
    teacher = next(t for t in data['docenti'] if t['sigla_untis'] == code)
    assert teacher['nome_originale'] == name
    assert teacher['id'] == next(t['id'] for t in existing if t['code'] == code)
print('PASS: all existing teacher IDs retained, confirmed replacements and Lavorato display name')

for code, day, hour, label in [('DAL','ven',2,'STU'),('DAL','ven',3,'STU'),
                              ('DAL','gio',2,'INC.'),('DAL','gio',3,'INC.'),('LDS','mer',3,'INC.')]:
    assert slots[by_code[code],day,hour]['attivita_riconosciute'] == [label]
print('PASS: five additional support-teacher activities retained alongside PDF lessons')

comparison_path = output/'untis-comparison.json'
if comparison_path.exists():
    comparison = json.loads(comparison_path.read_text())
    pdf = {(l['code'],l['day'],l['hour']):l for l in comparison['pdf_slots']}
    assert len(comparison['pdf_header_counts']) == 153
    assert set(comparison['pdf_header_counts'].values()) == {1}
    assert {key[1:] for key,l in pdf.items() if key[0]=='PAT' and l['activities']==['DIS']} == {('lun',2),('gio',1),('ven',1)}
    assert not any('POT' in l['activities'] for key,l in pdf.items() if key[0]=='PAT')
    assert pdf['TAC','mer',1]['classes'] == pdf['TAC','mer',2]['classes'] == ['2CE']
    assert len(comparison['unnamed_export_rows']) == 18
    assert all(l['named_components'] for l in comparison['unnamed_export_rows'])
    print('PASS: PDF teacher matching, Pati DIS/no POT, Tacchella merged lesson, all 18 unnamed rows have named components')

assert sum(w['tipo']=='articolazione_da_verificare' for w in data['anomalie']) == 24
assert not any(l['aula'] and l['aula'] in l['attivita_riconosciute'] for l in data['orario'])
assert not any(w['tipo']=='referente_non_verificato' and w['docente'] in {by_code['DSV'],by_code['FST']} for w in data['anomalie'])
print('PASS: 24 split-class issues retained, rooms excluded from activities, Bevilacqua/Tacchella references resolved')
