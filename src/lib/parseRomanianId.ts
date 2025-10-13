export type ParsedRomanianId = {
  country?: string;
  serie?: string;
  number?: string;
  lastName?: string;
  firstName?: string;
  nationality?: string;
  nationalityNormalized?: string;
  cnp?: string;
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

        try {
          const origLine = lines[i];
          const idx = normalizeForMatch(origLine).indexOf(lab);
          if (idx >= 0) {
            const after = origLine.substring(idx + lab.length).trim();
            if (after) {
              const normAfter = normalizeForMatch(after);
              if (!labelKeywords.test(normAfter)) return normalizeLine(after);
            }
          }
        } catch (e) {
        }
        for (let j = i + 1; j < lines.length; j++) {
          const raw = lines[j];
          const cand = normalizeLine(raw);
          if (!cand) continue;
          const ucand = normalizeForMatch(cand);


          const hasLabelKeyword = labelKeywords.test(ucand);
          const hasSlash = ucand.includes('/');


          if (hasSlash && !hasLabelKeyword) return cand;

          if (searchingForSex) {
            if (/^\s*[MF]\s*$/i.test(cand)) return cand;

            if (hasLabelKeyword) continue;

            if (/^\s*\w{1,3}\s*$/.test(cand)) return cand;

            continue;
          }


          if (hasLabelKeyword) continue;

          return cand;
        }
        return undefined;
      }
    }
  }
  return undefined;
}

function extractLabelStrict(
  lines: string[],
  labels: string[],
  maxLines = 3,
  opts: { skipNoiseLines?: RegExp | null; allowOneLabelSkip?: boolean; skipPatterns?: RegExp[] } = { skipNoiseLines: null, allowOneLabelSkip: false, skipPatterns: undefined }
) {
  const ulabels = labels.map((l) => normalizeForMatch(l));
  const labelKeywords = /\b(NUME|NOM|PRENUME|PRENOM|SEX|SEXE|CETATENIE|NATIONAL|NATIONALIT|DOMICILIU|DOMICILE|LOC NAST|LOC NA(S)?TER|EMISA|EMIS|VALAB|VALABILITATE|SERIA|NR|CNP)\b/;
  for (let i = 0; i < lines.length; i++) {
    const u = normalizeForMatch(lines[i]);
    for (const lab of ulabels) {
      if (u.includes(lab)) {
        try {
          const origLine = lines[i];
          const nOrig = normalizeForMatch(origLine);
          const idx = nOrig.indexOf(lab);
          if (idx >= 0) {
            const after = origLine.substring(idx + lab.length).trim();
            // If the label line itself is a multi-language label (contains many
            // label tokens or starts with a '/'), don't treat the remainder as a value.
            const labelCount = ulabels.reduce((c, l) => (nOrig.includes(l) ? c + 1 : c), 0);
            if (after && !after.startsWith('/') && labelCount <= 1) {
              // If remainder contains translations separated by '/', try to
              // pick the first segment that does NOT look like a label.
              if (after.includes('/')) {
                const segs = after.split('/').map((s) => s.trim()).filter(Boolean);
                for (const seg of segs) {
                  const useg = normalizeForMatch(seg);
                  if (ulabels.some((lab2) => useg.includes(lab2))) continue;
                  if (labelKeywords.test(useg)) continue;
                  return normalizeLine(seg);
                }
                // none of the segments looked like a value; fall through
              } else {
                const normAfter = normalizeForMatch(after);
                if (!labelKeywords.test(normAfter)) return normalizeLine(after);
              }
            }
          }
        } catch (e) {}

        const parts: string[] = [];
        let skippedLabel = false;
        for (let j = i + 1; j < Math.min(lines.length, i + 1 + maxLines + (opts.allowOneLabelSkip ? 1 : 0)); j++) {
          const candRaw = lines[j];
          let cand = normalizeLine(candRaw);
          if (!cand) continue;
          const ucand = normalizeForMatch(cand);

          // skip noise lines (like a solitary 'M' after nationality)
          if (opts.skipNoiseLines && opts.skipNoiseLines.test(cand)) {
            continue;
          }

          // skip any candidate that matches one of the provided skip patterns
          if (opts.skipPatterns) {
            let skipIt = false;
            for (const p of opts.skipPatterns) {
              if (p.test(cand)) {
                skipIt = true;
                break;
              }
            }
            if (skipIt) continue;
          }

          // If the candidate contains any of the requested label tokens (e.g. the
          // translations of the same label), skip it — this prevents returning
          // '/Lieu de naissance/Place of birth' as the value for birthPlace.
          if (ulabels.some((lab) => ucand.includes(lab))) {
            continue;
          }

          if (labelKeywords.test(ucand)) {
            if (opts.allowOneLabelSkip && !skippedLabel) {
              // record skipping one label, but continue to the next line
              skippedLabel = true;
              continue;
            }
            break;
          }
          // Stop if we hit machine-readable zone (MRZ) or obvious ID blobs
          const mrzLike = /<<|<[A-Z0-9<]{6,}|IDROU|ID[A-Z0-9]{3,}/i;
          if (mrzLike.test(cand)) break;

          // avoid pushing consecutive duplicates (normalized)
          const last = parts.length ? normalizeForMatch(parts[parts.length - 1]) : null;
          const now = normalizeForMatch(cand);
          if (last !== now) parts.push(cand);
        }
        if (parts.length) {
          // dedupe parts by normalized form while preserving order
          const seen = new Set<string>();
          const uniq: string[] = [];
          for (const p of parts) {
            const key = normalizeForMatch(p);
            if (!seen.has(key)) {
              seen.add(key);
              uniq.push(p);
            }
          }
          return uniq.join(" ");
        }
        return undefined;
      }
    }
  }
  return undefined;
}

export function parseRomanianId(rawText: string, opts: { debug?: boolean } = {}): ParsedRomanianId {
  const rawLines = rawText.split(/\r?\n/).map((l) => normalizeLine(l)).filter(Boolean);
  const uLines = rawLines.map((l) => normalizeForMatch(l));

  const res: ParsedRomanianId = { rawLines };
  const debug = !!opts.debug;
  const log = (label: string, value: string | undefined) => {
    if (!debug) return;
    try {
      console.log(`[parseRomanianId] ${label} =>`, value);
    } catch (e) {
      // ignore logging errors
    }
  };


  if (rawLines.length >= 3) res.country = rawLines[2];
  else {
    const idx = uLines.findIndex((l) => /(ROMA|ROMANIA|ROUMANIE|ROU)/.test(l));
    if (idx >= 0) res.country = rawLines[idx];
  }
  log('country', res.country);

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
  log('serie', res.serie);
  log('number', res.number);


  if (!res.serie || !res.number) {
    const mrz = uJoined.match(/\b([A-Z]{2})([0-9]{6})\b/);
    if (mrz) {
      if (!res.serie) res.serie = mrz[1];
      if (!res.number) res.number = mrz[2];
    }
  }


  const last = findLabelValue(rawLines, ["Nume", "NOM", "Last name", "NUME/NOM", "Nume/Nom", "Nume/Nom/Last name"]);
  const first = findLabelValue(rawLines, ["Prenume", "PRENOM", "First name", "Prenume/Prenom", "Prenume/Prenom/First name"]);
  if (last) res.lastName = last;
  if (first) res.firstName = first;
  log('lastName', res.lastName);
  log('firstName', res.firstName);


  const nat = extractLabelStrict(rawLines, ["Cetatenie", "Cetätenie", "Nationality", "Nationalite"], 3, { skipNoiseLines: /^\s*[MF]\s*$/i, allowOneLabelSkip: true });
  if (nat) res.nationality = nat;
  else {

    const n = rawLines.find((l) => /\b(ROMAN|ROMANA|ROU|ROMANIA|ROMANIE)\b/i.test(l));
    if (n) res.nationality = n.split('/')[0].trim();
  }


  if (res.nationality) {
    const first = res.nationality.split('/')[0].trim();
    res.nationality = first;

    res.nationalityNormalized = first.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  }
  log('nationality', res.nationality);


  const cnpLabel = findLabelValue(rawLines, ["CNP"]);
  if (cnpLabel) {
    const m = cnpLabel.match(/(\d{13})/);
    if (m) res.cnp = m[1];
  } else {
    const globalMatch = joined.match(/\b(\d{13})\b/);
    if (globalMatch) res.cnp = globalMatch[1];
  }
  log('cnp', res.cnp);


  const born = extractLabelStrict(rawLines, ["Loc nastere", "Lieu de naissance", "Place of birth", "Loc nastere/Lieu de naissance/Place of birth"], 3, { skipNoiseLines: null, allowOneLabelSkip: true });
  if (born) res.birthPlace = born;
  log('birthPlace', res.birthPlace);


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
  log('address', res.address);


  const issued = extractLabelStrict(rawLines, ["Emisa de", "Delivree par", "Issued by", "Emis de"], 3, { skipNoiseLines: null, allowOneLabelSkip: true, skipPatterns: [/\d{1,2}\.\d{1,2}\.\d{2,4}/] });
  if (issued) res.issuedBy = issued;
  log('issuedBy', res.issuedBy);


  const val = extractLabelStrict(rawLines, ["Valabilitate", "Validite", "Validity"], 3);
  if (val) {
    // If the validity contains a date-range, trim to the first date-range found
    const mrange = val.match(/(\d{1,2}\.\d{1,2}\.\d{2,4})\s*[\-–]\s*(\d{1,2}\.\d{1,2}\.\d{2,4})/);
    if (mrange) {
      res.validity = `${mrange[1]}-${mrange[2]}`;
    } else {
      res.validity = val;
    }
  }
  log('validity', res.validity);

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
    log('validityStart', res.validityStart);
    log('validityEnd', res.validityEnd);
  }

  return res;
}

export default parseRomanianId;
