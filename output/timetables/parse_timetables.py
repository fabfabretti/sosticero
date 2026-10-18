#!/usr/bin/env python3
"""Convert authoritative Untis and Sostegno PDFs, using CSV teacher metadata; needs pdfplumber.
Run from the repository root: python parse_timetables.py INPUT_DIR OUTPUT_DIR
No database access. Existing output files are never overwritten.
"""
import collections
import csv
import json
from pathlib import Path
import re
import sys
import unicodedata

import pdfplumber

DAYS = ['lun', 'mar', 'mer', 'gio', 'ven']
# Preserve the class names used by the previous importer.
ALIASES = {'1GST': '1GS', '5AES': '5AE', 'A22C': '1AE', '3AES': '3AE', '3DER': '3DE', '3CER': '3CE', '4AES': '4AE', '4CER': '4CE', '5CER': '5CE'}


def canonical_class(value):
    value = re.sub('[^A-Z0-9]', '', value.upper())
    return ALIASES.get(value, value)


def name_key(value):
    value = unicodedata.normalize('NFKD', value.upper())
    return re.sub('[^A-Z0-9]', '', value)


def csv_rows(root, filename):
    raw = (root / filename).read_bytes()
    try:
        text = raw.decode('utf-8-sig')
    except UnicodeDecodeError:
        text = raw.decode('cp1252')
    return list(csv.reader(text.splitlines()))


def parse(root):
    teachers, slots, warnings = {}, {}, []
    class_rows = csv_rows(root, 'classi.TXT')
    classes = {canonical_class(r[0]): r for r in class_rows if re.fullmatch(r'[1-5][A-Z]+\.?', r[0]) or r[0] == 'A22C'}
    sites = {c: 'succursale' if r[3].endswith('S') else 'centrale' for c, r in classes.items()}
    warnings.append(dict(tipo='alias_classe', originale='A22C', classe='1AE', motivo='Untis usa A22C; il PDF docenti e il PDF sostegno riportano 1AE.'))
    for r in csv_rows(root, 'GPU004.TXT'):
        code, surname, cdc, first = r[0], r[1], r[22], r[28]
        if code in teachers:
            raise ValueError(f'Duplicate teacher code: {code}')
        teachers[code] = dict(id=code, sigla_untis=code, nome_originale=f'{surname} {first}'.strip(),
                              classe_concorso=cdc, ruolo='sostegno' if cdc in ('SOS', 'ADSS') else 'ITP' if cdc.startswith('B') else 'curricolare',
                              cognome_originale=surname, fonte={'file': 'GPU004.TXT'})
    # Read whole filled lesson rectangles, expanding merged cells over every hour.
    # Exports supply identities/class metadata only; PDF determines every assignment.
    pdf_name = 'DOCENTI Definitivo-2.pdf'
    headers = collections.Counter()
    with pdfplumber.open(root / pdf_name) as pdf:
        for page in pdf.pages:
            words = page.extract_words(x_tolerance=1, y_tolerance=1)
            for header in words:
                code = {'CAS': 'CAST', 'PAC': 'PACC'}.get(header['text'], header['text'])
                if code not in teachers or min(abs(header['x0']-x) for x in (67.789, 322.36)) > 1:
                    continue
                if min(abs(header['top']-(24.28+262.95*b)) for b in range(3)) > 2:
                    continue
                if code == 'ROS' and any(w['text'] == 'Rossin' and abs(w['top']-header['top'])<4 and header['x0']<w['x0']<header['x0']+100 for w in words):
                    code = 'ROSS'
                headers[code] += 1
                gx, gy = header['x0']+33.1735, 71.3209+262.95*round((header['top']-24.28)/262.95)
                for rect in page.rects:
                    if not rect['fill'] or not 35 < rect['width'] < 40 or rect['height'] < 15:
                        continue
                    day = round((rect['x0']-gx)/38.94277)
                    start = round((rect['top']-gy)/24.49397)
                    count = round((rect['height']+1.4)/24.49397)
                    if not (0 <= day < 5 and 0 <= start < 7 and 1 <= count <= 7-start):
                        continue
                    if abs(rect['x0']-(gx+day*38.94277))>2 or abs(rect['top']-(gy+start*24.49397))>2:
                        continue
                    ww = [w for w in words if rect['x0']<(w['x0']+w['x1'])/2<rect['x1'] and rect['top']<(w['top']+w['bottom'])/2<rect['bottom']]
                    tokens = [w['text'] for w in ww]
                    cc = sorted({canonical_class(t) for t in tokens if canonical_class(t) in classes})
                    activities = [] if cc else list(dict.fromkeys(t for t in tokens if not re.fullmatch(r'A\d+[ABCS]?|PA[123]|LAB\.?T|L\.?M\.?C?|XB\d+', t, re.I)))
                    if not tokens:
                        raise ValueError(f'Empty lesson rectangle: {code}, page {page.page_number}')
                    campus = {sites[c] for c in cc}
                    site = next(iter(campus)) if len(campus) == 1 else None
                    color = rect['non_stroking_color']
                    if 'POT' in activities and isinstance(color, (tuple, list)) and len(color)==3 and color[1]>.95 and color[2]<.4:
                        site = 'succursale' if color[0]>.95 else 'centrale' if color[0]<.1 else None
                    if any(t.replace('.', '') == 'UTC' for t in activities): site = 'centrale'
                    if any(t.replace('.', '') == 'UTS' for t in activities): site = 'succursale'
                    rooms = {t for t in tokens if re.fullmatch(r'A\d+[ABCS]?|PA[123]|LAB\.?T|L\.?M\.?C?|XB\d+', t, re.I)}
                    for hour in range(start+1, start+count+1):
                        key = code, DAYS[day], hour
                        if key in slots:
                            raise ValueError(f'Overlapping PDF lessons: {key}')
                        slots[key] = dict(docente=code, giorno=key[1], ora=hour, classi=cc,
                                          aula=next(iter(rooms)) if len(rooms)==1 else None, sede=site,
                                          attivita_originale=' '.join(tokens), attivita_riconosciute=activities,
                                          compresenze=[], fonte=[dict(file=pdf_name, pagina=page.page_number,
                                          bbox=[rect['x0'], rect['top'], rect['x1'], rect['bottom']],
                                          ora_inizio_cella=start+1, durata_cella=count, riempimento=color)])
            print(f'Untis PDF page {page.page_number}', flush=True)
    expected_headers = {code for code,t in teachers.items() if t['nome_originale'].strip()}
    if set(headers) != expected_headers or any(n != 1 for n in headers.values()):
        raise ValueError('Missing or duplicate PDF teacher headers.')
    # Keep split-class disagreements as diagnostics, never as extra PDF assignments.
    export_classes = collections.defaultdict(set)
    for r in csv_rows(root, 'orario.TXT'):
        c = canonical_class(r[1])
        if r[2] and c in classes:
            export_classes[r[2], DAYS[int(r[5])-1], int(r[6])].add(c)
    for key, item in slots.items():
        printed = set(item['classi'])
        if printed and printed < export_classes[key]:
            warnings.append(dict(tipo='articolazione_da_verificare', docente=key[0], giorno=key[1], ora=key[2],
                                 classi_pdf=item['classi'], classi_export=sorted(export_classes[key])))
    support_names = []
    pdf_name = 'ORARIO DEFINITIVO SOSTEGNO 26-27.pdf'
    with pdfplumber.open(root / pdf_name) as pdf:
        for page in pdf.pages:
            found = 0
            for table in page.find_tables():
                grid = table.extract()
                if not grid or grid[0][1:] != ['LUN', 'MAR', 'MER', 'GIO', 'VEN']:
                    continue
                found += 1
                name = grid[0][0]
                if name == 'CATTEDRA':
                    continue
                if len(grid) != 8 or [r[0] for r in grid[1:]] != ['1', '2', '3', 'I' if name == 'ROSSIN ELISA' else '4', '5', '6', '7']:
                    raise ValueError(f'Unexpected support grid: {name}')
                candidates = [t for t in teachers.values() if t['ruolo'] == 'sostegno' and name_key(name) in (name_key(t.get('cognome_originale', t['nome_originale'])), name_key(t['nome_originale']))]
                if len(candidates) == 1:
                    teacher = candidates[0]
                elif len(candidates) > 1:
                    raise ValueError(f'Ambiguous support teacher: {name}')
                else:
                    # Keep unconfirmed identities separate; the report requires review.
                    code = 'sostegno_' + name_key(name)
                    teacher = dict(id=code, sigla_untis=None, nome_originale=name, classe_concorso='ADSS', ruolo='sostegno', fonte={'file': pdf_name, 'pagina': page.page_number})
                    teachers[code] = teacher
                    warnings.append(dict(tipo='identita_sostegno_da_confermare', nome=name, docente=code))
                code = teacher['id']
                support_names.append(name)
                for hour, row in enumerate(grid[1:], 1):
                    for day, cell in enumerate(row[1:]):
                        if cell is None:
                            raise ValueError(f'Merged/missing support cell: {name}, {day}, {hour}')
                        text = ' '.join(cell.split())
                        if not text:
                            continue
                        matches = list(re.finditer(r'(?<![A-Z0-9])([1-5])\s*([A-Z]{1,4})(?![A-Z0-9])', text.upper()))
                        cc = list(dict.fromkeys(canonical_class(m[1]+m[2]) for m in matches))
                        if any(c not in classes for c in cc):
                            raise ValueError(f'Unknown support class: {name}: {text}')
                        ref = re.sub(r'(?<![A-Z0-9])[1-5]\s*[A-Z]{1,4}(?![A-Z0-9])', '', text.upper()).strip(' -')
                        campus = {sites[c] for c in cc}
                        key = code, DAYS[day], hour
                        if key in slots:
                            warnings.append(dict(tipo='sostegno_pdf_conflitto_untis_pdf', record_untis=slots[key]))
                        slots[key] = dict(docente=code, giorno=key[1], ora=hour, classi=cc, aula=None,
                                          sede=next(iter(campus)) if len(campus) == 1 else None,
                                          attivita_originale=text, attivita_riconosciute=[] if cc else [text],
                                          docente_referente_originale=ref, compresenze=[],
                                          fonte=[dict(file=pdf_name, pagina=page.page_number, bbox=table.rows[hour].cells[day+1])])
            if found != 4:
                raise ValueError(f'Expected 4 support tables on page {page.page_number}, got {found}')
    for item in slots.values():
        if teachers[item['docente']]['ruolo'] != 'sostegno' or 'docente_referente_originale' not in item:
            continue
        ref = name_key(item['docente_referente_originale'])
        ref = {'GHIBELLINI': 'GIBELLINI', 'CRMELITI': 'CARMELITI', 'DALLALIBERA': 'DELLALIBERA'}.get(ref, ref)
        candidates = [t for t in teachers.values() if t['ruolo'] != 'sostegno' and (ref == name_key(t.get('cognome_originale', '')) or name_key(t['nome_originale']).startswith(ref) and len(ref) > 3)] if ref else []
        matching = [t['id'] for t in candidates if (other := slots.get((t['id'], item['giorno'], item['ora']))) and set(other['classi']) & set(item['classi'])]
        if len(matching) == 1:
            item['compresenze'] = matching
            other = slots[matching[0], item['giorno'], item['ora']]
            other['compresenze'].append(item['docente'])
            item['aula'] = other['aula']
        elif item['classi']:
            warnings.append(dict(tipo='referente_non_verificato', docente=item['docente'], giorno=item['giorno'], ora=item['ora'], classi=item['classi'], referente=item['docente_referente_originale'], candidati=matching))
    for item in slots.values():
        if item['sede'] is None:
            warnings.append(dict(tipo='sede_non_determinata', docente=item['docente'], giorno=item['giorno'], ora=item['ora'], testo=item['attivita_originale']))
    return dict(docenti=list(teachers.values()), orario=list(slots.values()), anomalie=warnings), support_names


def preserve_identities(result, catalogue):
    """Reuse existing IDs by full name; codes alone cannot distinguish old ROS records."""
    confirmed = {'FAZIO FEDE': 'Fazio F. Federico', 'MARTINELLI': 'Martinelli Andrea', 'IANZANO': 'Ianzano'}
    # User-confirmed operational replacements; each name reads "supplente (titolare)".
    replacements = {'B016': 'DILEO IGNAZIO PASQUALE', 'BEN': 'Gamb.tto Silvia (Benedetti)',
                    'CLR': 'Binotto Rosaria (Cavallaro)', 'SAV': 'Spillari Davide (Savelli)',
                    'VAL': 'ADRIANILLI FRANCESCA', 'LAV': 'Lazzaro Vinc (Lavorato)'}
    mapping, merged = {}, {}
    for teacher in result['docenti']:
        old_id = teacher['id']
        name = replacements.get(teacher['sigla_untis'], confirmed.get(teacher['nome_originale'], teacher['nome_originale']))
        matches = [t for t in catalogue if name_key(t['name']) == name_key(name) and t['role'] == teacher['ruolo']]
        if not name.strip():
            if any(l['docente'] == old_id for l in result['orario']):
                raise ValueError(f'Unnamed teacher has lessons: {old_id}')
            continue
        if not matches:
            matches = [t for t in catalogue if t['code'] == teacher['sigla_untis'] and t['role'] == teacher['ruolo'] and name_key(name).startswith(name_key(t['name']))]
        if len(matches) > 1:
            raise ValueError(f'Ambiguous existing identity: {name}')
        new_id = matches[0]['id'] if matches else 'untis_' + old_id
        mapping[old_id] = new_id
        teacher = dict(teacher, id=new_id, nome_originale=name)
        if new_id in merged:
            # Fazio's PDF-only label and the empty Untis identity are the same person.
            if old_id != 'sostegno_FAZIOFEDE':
                raise ValueError(f'Duplicate identity: {name}')
        else:
            merged[new_id] = teacher
    for item in result['orario']:
        item['docente'] = mapping[item['docente']]
        item['compresenze'] = list(dict.fromkeys(mapping[v] for v in item['compresenze']))
    result['docenti'] = list(merged.values())
    result['anomalie'] = [w for w in result['anomalie'] if w['tipo'] != 'identita_sostegno_da_confermare']
    for warning in result['anomalie']:
        if 'docente' in warning:
            warning['docente'] = mapping[warning['docente']]
        if 'candidati' in warning:
            warning['candidati'] = [mapping[v] for v in warning['candidati']]
        if 'record_untis' in warning:
            warning['record_untis']['docente'] = mapping[warning['record_untis']['docente']]
    return result


def main():
    root, out = map(Path, sys.argv[1:])
    out.mkdir(parents=True, exist_ok=True)
    targets = [out / 'orari.json', out / 'validation.json']
    if any(p.exists() for p in targets):
        raise FileExistsError('Output already exists; choose a new directory.')
    result, names = parse(root)
    result = preserve_identities(result, json.loads((Path(__file__).parent / 'existing-teachers.json').read_text()))
    # This validator is pure: no app initialization or database access.
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from backend.domain import normalize_dataset
    ds = normalize_dataset(result)
    report = dict(fonte_orario='PDF Untis + PDF Sostegno', docenti=len(ds['teachers']), ore=len(ds['lessons']), sostegno=names,
                  ore_per_docente={t['nome_originale']: sum(l['docente']==t['id'] for l in result['orario']) for t in result['docenti']},
                  anomalie_per_tipo=dict(collections.Counter(w['tipo'] for w in result['anomalie'])))
    targets[0].write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    targets[1].write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k != 'ore_per_docente'}, ensure_ascii=False))


if __name__ == '__main__':
    main()
