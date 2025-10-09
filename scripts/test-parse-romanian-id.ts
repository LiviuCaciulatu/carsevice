import fs from 'fs';
import path from 'path';
import parse, { ParsedRomanianId } from '../src/lib/parseRomanianId';

const sample = `ROUMANIE
ROMANIA
ROMANIA
CARTE
CARTE DE IDENTITATE
IDENTITY
D'IDENTITE
SERIA RK NR 028132
CARD
CNP 1890506430036
S4H4Z
Nume/Nom/Last name
CACIULATU
Prenume/Prenom/First name
LIVIU-MARIUS
Cetätenie/Nationalite/Nationality
Sex/Sexe/Sex
Română / ROU
M
Loc nastere/Lieu de naissance/Place of birth
Mun.Bucuresti Sec.3
Domiciliu/Adresse/Address
Mun.București Sec.3
Str.Ilioara nr.19A ap.14
838 eup B
Emisa de/Delivree par/Issued by
Valabilitate/Validite/Validity
S.P.C.E.P. Sector 3
17.01.17-06.05.2027
IDROUCACIULATU<<LIVIU<MARIUS<<<<<<<<
RK028132<5R0U8905064M270506614300369`;

const out = parse(sample);
console.log('Parsed:', JSON.stringify(out, null, 2));

// write output for manual inspection
fs.writeFileSync(path.join(process.cwd(), 'tmp', 'parse-output.json'), JSON.stringify(out, null, 2));
console.log('Wrote tmp/parse-output.json');
