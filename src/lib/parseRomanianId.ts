export type ParsedRomanianId = {
  country?: string;
  serie?: string;
  number?: string;
  lastName?: string;
  firstName?: string;
  nationality?: string;
  nationalityNormalized?: string;
  sex?: string;
  birthPlace?: string;
  address?: string;
  issuedBy?: string;
  validity?: string;
  validityStart?: string;
  validityEnd?: string;
  rawLines?: string[];
};

function normalizeLine(s: string) {
  return s.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeForMatch(s: string) {
  return s.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toUpperCase();
}

function findLabelValue(lines: string[], labels: string[]) {
  const ulabels = labels.map((l) => normalizeForMatch(l));
  const labelKeywords = /\b(NUME|NOM|PRENUME|PRENOM|SEX|SEXE|CETATENIE|NATIONAL|NATIONALIT|DOMICILIU|DOMICILE|LOC NAST|LOC NA(S)?TER|EMISA|EMIS|VALAB|VALABILITATE|SERIA|NR|CNP)\b/;
  for (let i = 0; i < lines.length; i++) {
    const u = normalizeForMatch(lines[i]);
    for (const lab of ulabels) {
      if (u.includes(lab)) {
        const searchingForSex = ulabels.some((x) => /SEX/.test(x));
        for (let j = i + 1; j < lines.length; j++) {
          const raw = lines[j];
          const cand = normalizeLine(raw);
          if (!cand) continue;
          const ucand = normalizeForMatch(cand);

          // Determine if this line looks like a label
          const hasLabelKeyword = labelKeywords.test(ucand);
          const hasSlash = ucand.includes('/');

          // If the line has a slash but no label keywords, it's likely a multi-lang value (e.g. "Română / ROU") -> accept
          if (hasSlash && !hasLabelKeyword) return cand;

          if (searchingForSex) {
            // Prefer single-letter M/F (may appear one or two lines after label)
            if (/^\s*[MF]\s*$/i.test(cand)) return cand;
            // If this candidate looks like a label, skip it
            if (hasLabelKeyword) continue;
            // If candidate is short (1-3 chars) accept as possible sex token
            if (/^\s*\w{1,3}\s*$/.test(cand)) return cand;
            // otherwise keep scanning
            continue;
          }

          // For general labels: skip lines that have label keywords
          if (hasLabelKeyword) continue;
          // Accept this candidate as value
          return cand;
        }
        return undefined;
      }
    }
  }
  return undefined;
}

export function parseRomanianId(rawText: string): ParsedRomanianId {
  const rawLines = rawText.split(/\r?\n/).map((l) => normalizeLine(l)).filter(Boolean);
  const uLines = rawLines.map((l) => normalizeForMatch(l));

  const res: ParsedRomanianId = { rawLines };


  if (rawLines.length >= 3) res.country = rawLines[2];
  else {
    const idx = uLines.findIndex((l) => /(ROMA|ROMANIA|ROUMANIE|ROU)/.test(l));
    if (idx >= 0) res.country = rawLines[idx];
  }

  const joined = rawLines.join(" ");
  const uJoined = normalizeForMatch(joined);

  const seryNum = uJoined.match(/SERIA\s*([A-Z]{1,2})[^A-Z0-9\n]{0,6}NR\.?\s*([0-9]{4,7})/i);
  if (seryNum) {
    res.serie = seryNum[1];
    res.number = seryNum[2];
  } else {

    const sMatch = uJoined.match(/SERIA\s*([A-Z]{1,2})/i);
    const nMatch = uJoined.match(/\bNR\.?\s*([0-9]{4,7})/i);
    if (sMatch) res.serie = sMatch[1];
    if (nMatch) res.number = nMatch[1];
  }


  if (!res.serie || !res.number) {
    const mrz = uJoined.match(/\b([A-Z]{2})([0-9]{6})\b/);
    if (mrz) {
      if (!res.serie) res.serie = mrz[1];
      if (!res.number) res.number = mrz[2];
    }
  }

  // last name and first name
  const last = findLabelValue(rawLines, ["Nume", "NOM", "Last name", "NUME/NOM", "Nume/Nom", "Nume/Nom/Last name"]);
  const first = findLabelValue(rawLines, ["Prenume", "PRENOM", "First name", "Prenume/Prenom", "Prenume/Prenom/First name"]);
  if (last) res.lastName = last;
  if (first) res.firstName = first;

  // nationality
  const nat = findLabelValue(rawLines, ["Cetatenie", "Cetätenie", "Nationality", "Nationalite"]);
  if (nat) res.nationality = nat;
  else {
    // try to find a short token like ROMANA / ROU
    const n = rawLines.find((l) => /\b(ROMAN|ROMANA|ROU|ROMANIA|ROMANIE)\b/i.test(l));
    if (n) res.nationality = n;
  }

  // Normalize nationality: if it contains a slash (e.g. "Română / ROU"), pick the first token
  if (res.nationality) {
    const first = res.nationality.split('/')[0].trim();
    res.nationality = first;
    // also provide a normalized ASCII lowercase variant
    res.nationalityNormalized = first.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  }

  // sex
  const sex = findLabelValue(rawLines, ["Sex", "SEXE", "Sexe"]);
  if (sex) res.sex = sex.split(" ")[0];
  else {
    // find single-char M or F tokens
    const m = rawLines.find((l) => /^\s*[MF]\s*$/i.test(l));
    if (m) res.sex = m.trim();
  }

  // birth place
  const born = findLabelValue(rawLines, ["Loc nastere", "Lieu de naissance", "Place of birth", "Loc nastere/Lieu de naissance/Place of birth"]);
  if (born) res.birthPlace = born;

  // address / domiciliu: capture the line after label and up to two following lines until we hit another label-ish line
  const addrIndex = rawLines.findIndex((l) => /DOMICILIU|DOMICILIU|DOMICILE|ADDRESS|ADRESSE/i.test(normalizeForMatch(l)));
  if (addrIndex >= 0) {
    const parts: string[] = [];
    for (let i = addrIndex + 1; i < Math.min(rawLines.length, addrIndex + 4); i++) {
      const u = normalizeForMatch(rawLines[i]);
      if (/EMISA|VALABILITATE|CNP|SERIA|NR|NUME|PRENUME|LOC NASTER/i.test(u)) break;
      parts.push(rawLines[i]);
    }
    if (parts.length) res.address = parts.join(" ");
  } else {
    const addr = findLabelValue(rawLines, ["Domiciliu", "Domiciliu/Adresse/Address"]);
    if (addr) res.address = addr;
  }

  // issued by
  const issued = findLabelValue(rawLines, ["Emisa de", "Delivree par", "Issued by", "Emis de"]);
  if (issued) res.issuedBy = issued;

  // validity
  const val = findLabelValue(rawLines, ["Valabilitate", "Validite", "Validity"]);
  if (val) res.validity = val;

  // Parse validity range if present: formats like "17.01.17-06.05.2027" or "17.01.2017 - 06.05.2027"
  if (res.validity) {
    const m = res.validity.match(/(\d{1,2}\.\d{1,2}\.\d{2,4})\s*[\-–]\s*(\d{1,2}\.\d{1,2}\.\d{2,4})/);
    if (m) {
      const parseDateToken = (tok: string) => {
        const parts = tok.split('.').map((p) => p.trim());
        if (parts.length !== 3) return undefined;
        let [d, mo, y] = parts;
        if (y.length === 2) {
          const yy = parseInt(y, 10);
          const nowYY = new Date().getFullYear() % 100;
          // assume 19xx if yy > nowYY+10 else 20xx
          const full = yy > (nowYY + 10) ? 1900 + yy : 2000 + yy;
          y = String(full);
        }
        const iso = `${y.padStart(4, '0')}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
        return iso;
      };
      const s = parseDateToken(m[1]);
      const e = parseDateToken(m[2]);
      if (s) res.validityStart = s;
      if (e) res.validityEnd = e;
    }
  }

  return res;
}

export default parseRomanianId;
