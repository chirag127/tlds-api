# TLDs API

All 1,436 top-level domains in the IANA root zone — 309 country-code, 1,126 generic,
1 special-use — with the authoritative type per TLD and the Unicode form of all 151
internationalized domains, served as free static JSON.

No authentication. No server. No rate limit. The committed JSON is the database. Refreshed
automatically by GitHub Actions from IANA.

    curl https://chirag127.github.io/tlds-api/api/v1/tlds.json

## What you get

| Field | Example | Notes |
|---|---|---|
| `tld` | `"de"` | The root-zone TLD, lowercase; internationalized domains use their punycode label (`xn--p1ai`) |
| `type` | `"Country Code"` | The authoritative type from IANA's root zone database: `Country Code`, `Generic` or `Special Use` |
| `decoded` | `"рф"` | The Unicode form of an internationalized domain, decoded from punycode (RFC 3492); `null` for ASCII TLDs |
| `script` | `"Cyrl"` | The script column from IANA's root database (e.g. `Latn`, `Cyrl`, `Hani`, `Deva`), `null` when not listed |

## Endpoints

| Endpoint | Description | Size |
|---|---|---|
| `GET /api/v1/tlds.json` | All 1,436 records with the IANA version string | ~156 KB |
| `GET /api/v1/index.json` | Count per type plus the version string | <1 KB |
| `GET /data/tlds.json` | Same data as above (source of truth for the repo) | ~156 KB |

## How it stays fresh

The `update.yml` workflow runs monthly, fetches
[tlds-alpha-by-domain.txt](https://data.iana.org/TLD/tlds-alpha-by-domain.txt) and the
[IANA root zone database](https://www.iana.org/domains/root/db), regenerates the JSON and
commits only when the data changed. GitHub Pages serves the result.

## Data source and accuracy

The record set is the [IANA TLD list](https://www.iana.org/TLD/tlds-alpha-by-domain.txt) —
version 2026111000, 1,436 delegated TLDs. The type and script come from the same
[IANA root zone database](https://www.iana.org/domains/root/db) HTML table, which is the
authoritative registry: 309 country-code, 1,126 generic, 1 special-use (`arpa`). The 151
internationalized (IDN) domains carry their punycode label and the decoded Unicode form,
decoded with a RFC 3492 decoder verified against the IANA root database's own display names.

## Limits, stated plainly

- The alpha list only contains delegated TLDs; the root database also lists 5 "eligible" entries that are not yet in the DNS and are therefore excluded here.
- No registry or sponsor data is included — the root database's manager column is not carried over.
- Type is only as fresh as IANA's root database page; a very new TLD may briefly show as `Generic`-adjacent until the page is updated.
- The root database is an HTML table, so a redesign of the page would break the type enrichment — the build then falls back to a structural classification and logs a warning.

## Licence

Data: the IANA root zone database is published for informational use; this API republishes it
with attribution to IANA. Code: MIT.

---

## About the author

**Chirag Singhal** — building free, open APIs and tools. Everything here is free, no
authentication, no rate limits, no telemetry. If it saves you time and you want to work
together, that is exactly what this is for.

- **Email — the fastest way to reach me:** [chirag@oriz.in](mailto:chirag@oriz.in)
- **GitHub:** [github.com/chirag127](https://github.com/chirag127)
- **LinkedIn:** [linkedin.com/in/chirag127](https://www.linkedin.com/in/chirag127/)
- **X:** [x.com/singhal127](https://x.com/singhal127)
- **YouTube:** [@ChiragSinghal127](https://www.youtube.com/@ChiragSinghal127)
- **Instagram:** [chiragsinghal127](https://www.instagram.com/chiragsinghal127/)
- **Reddit:** [Far_Macaron_9910](https://www.reddit.com/user/Far_Macaron_9910/)
- **Buy me a coffee:** [buymeacoffee.com/chirag127](https://buymeacoffee.com/chirag127)

**Hiring?** I build developer tooling, data APIs and web platforms. Email me — I reply to
everything.
