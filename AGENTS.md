This repo is a free static-JSON API for every top-level domain in the IANA root zone — 1,436
TLDs (309 country-code, 1,126 generic, 1 special-use) with the authoritative type per TLD and
the Unicode form of all 151 internationalized domains. Served on GitHub Pages at
https://chirag127.github.io/tlds-api/. The monthly `update.yml` workflow re-fetches the IANA
TLD list and the IANA root zone database, and commits only when the regenerated output
differs. Never edit the JSON under `data/` or `api/v1/` by hand — regenerate with
`node scripts/build.js`.
