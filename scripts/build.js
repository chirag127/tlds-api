#!/usr/bin/env node
// Regenerates data/ and api/v1/ from IANA's TLD list.
// No timestamp in the output: unchanged source data must produce byte-identical
// files, or the "commit only if changed" step in update.yml never settles.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SOURCE_URL = 'https://data.iana.org/TLD/tlds-alpha-by-domain.txt';
// The alpha list carries no type metadata, so the authoritative type comes from
// IANA's root zone database page (HTML table). If that page is unreachable the
// build falls back to the structural classification at the bottom.
const ROOT_DB_URL = 'https://www.iana.org/domains/root/db';
const ROOT = path.join(__dirname, '..');

// RFC 3492 punycode decoder — Node's built-in punycode module was deprecated
// and removed from the stable public API, and IANA's list only carries the
// xn-- form, so the Unicode form is decoded here. Mirrors mathiasbynens/punycode.js:
// generalized variables are inserted at position i (output.splice), not appended.
function decodePunycode(input) {
  const base = 36;
  const tMin = 1;
  const tMax = 26;
  const skew = 38;
  const damp = 700;
  const initialBias = 72;
  const initialN = 128;

  const adapt = (delta, numPoints, firstTime) => {
    delta = firstTime ? Math.floor(delta / damp) : delta >> 1;
    delta += Math.floor(delta / numPoints);
    let k = 0;
    while (delta > ((base - tMin) * tMax) >> 1) {
      delta = Math.floor(delta / (base - tMin));
      k += base;
    }
    return k + Math.floor(((base - tMin + 1) * delta) / (delta + skew));
  };

  const digitOf = (code) => {
    if (code >= 48 && code <= 57) return code - 22; // 0-9
    if (code >= 65 && code <= 90) return code - 65; // A-Z
    if (code >= 97 && code <= 122) return code - 97; // a-z
    return base;
  };

  const output = [];
  let i = 0;
  let n = initialN;
  let bias = initialBias;

  let basic = input.lastIndexOf('-');
  if (basic < 0) basic = 0;
  for (let j = 0; j < basic; ++j) {
    if (input.charCodeAt(j) >= 0x80) throw new Error('bad punycode');
    output.push(input.charCodeAt(j));
  }

  for (let index = basic > 0 ? basic + 1 : 0; index < input.length; ) {
    const oldi = i;
    let w = 1;
    for (let k = base; ; k += base) {
      if (index >= input.length) throw new Error('bad punycode');
      const digit = digitOf(input.charCodeAt(index++));
      if (digit >= base) throw new Error('bad punycode digit');
      i += digit * w;
      const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
      if (digit < t) break;
      w *= base - t;
    }
    const out = output.length + 1;
    bias = adapt(i - oldi, out, oldi === 0);
    // `i` wraps around from `out` to 0, incrementing `n` each time.
    n += Math.floor(i / out);
    i %= out;
    output.splice(i++, 0, n);
  }

  return String.fromCodePoint(...output);
}

// Rows of the root DB table: each <tr> has a TLD cell (href + display name),
// status, type, manager, script, writing system. The href is the ASCII form;
// for IDN entries the display name is the Unicode form.
function parseRootDb(html) {
  const start = html.indexOf('<table id="ddtable"');
  const end = html.indexOf('</table>', start);
  if (start === -1 || end === -1) throw new Error('Root DB table not found');
  const body = html.slice(start, end);
  const rows = {};
  for (const row of body.split('<tr>').slice(1)) {
    const href = row.match(/href="\/domains\/root\/db\/([^"]+)"/);
    if (!href) continue;
    const cells = row.split('<td').slice(1);
    if (cells.length < 3) continue;
    // split on '<td' leaves a '>' prefix on every cell
    const text = (c) => c.replace(/<[^>]*>/g, '').replace(/^[^>]*>/, '').replace(/\s+/g, ' ').trim();
    const tld = href[1].toLowerCase();
    const displayName = text(cells[0].replace(/<[^>]*>/g, '').replace(/^\s*\.?/, '').replace(/\s+/g, ' '));
    rows[tld] = { type: text(cells[2]), status: text(cells[1]), script: text(cells[4]) ?? null, displayName };
  }
  return rows;
}

// Fallback when the root DB page is unreachable: two ASCII letters = ccTLD,
// "arpa" = infrastructure, everything else = gTLD.
function classify(tld) {
  if (tld === 'arpa') return 'Special Use';
  if (/^[a-z]{2}$/.test(tld)) return 'Country Code';
  return 'Generic';
}

async function main() {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText} for ${SOURCE_URL}`);
  }
  const text = await res.text();

  // First line is the "# Version ..." comment; the rest is one TLD per line,
  // uppercased by IANA. Lowercase them for normal use.
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const versionLine = lines.find((l) => l.startsWith('#'));
  const version = versionLine ? versionLine.replace('# Version ', '').split(',')[0] : null;
  const tlds = lines
    .filter((l) => !l.startsWith('#'))
    .map((l) => l.toLowerCase());
  if (new Set(tlds).size !== tlds.length) throw new Error('Duplicate TLDs in source');

  let rootDb;
  try {
    const dbRes = await fetch(ROOT_DB_URL);
    if (!dbRes.ok) throw new Error(`HTTP ${dbRes.status}`);
    rootDb = parseRootDb(await dbRes.text());
  } catch (err) {
    console.warn(`Root DB unavailable (${err.message}) — falling back to structural classification`);
    rootDb = null;
  }

  const records = tlds
    .map((tld) => {
      const isIdn = tld.startsWith('xn--');
      const decoded = isIdn ? decodePunycode(tld.slice(4)) : null;
      const db = rootDb ? rootDb[tld] : null;
      return {
        tld,
        type: db ? db.type : classify(tld),
        decoded: decoded || null,
        script: db ? db.script : null,
      };
    })
    .sort((a, b) => a.tld.localeCompare(b.tld));

  const write = (rel, data) => {
    const file = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  };

  const document = {
    generatedFrom: SOURCE_URL,
    typeSource: ROOT_DB_URL,
    version,
    count: records.length,
    records,
  };
  write('data/tlds.json', document);
  write('api/v1/tlds.json', document);
  write('api/v1/index.json', {
    generatedFrom: SOURCE_URL,
    count: records.length,
    version,
    byType: [...new Set(records.map((r) => r.type))].sort().map((t) => ({
      type: t,
      count: records.filter((r) => r.type === t).length,
    })),
  });

  const counts = records.reduce((m, r) => ((m[r.type] = (m[r.type] || 0) + 1), m), {});
  console.log(
    `tlds-api: ${records.length} TLDs written — ` +
      Object.entries(counts).map(([t, c]) => `${t} ${c}`).join(', ') +
      `; ${records.filter((r) => r.decoded).length} IDN decoded; version ${version}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
