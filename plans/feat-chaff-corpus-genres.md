# Corpus of many document kinds (#170)

## Goal

Run chaff on real documents of every kind people write — design docs, specs, requirements, internal docs, minutes,
reports, contracts, travel plans — and use what it gets wrong to improve it.

## Shape

- `corpus/manifest.json`: statutes as before; other documents have `source: "url"`, `genre`, `language`, `url`
  (pinned to a commit where possible), `license` and `redistribute`.
- `yarn corpus:fetch`: redistributable documents into `corpus/docs/` (committed), the rest into `corpus/.cache/`; Markdown sources are stored as `.source` so that `chaff .` over the repository does not lint them
  (git-ignored). Only the URL of a non-redistributable document is committed.
- `yarn corpus`: statutes checked by the structure rules as before; other documents run through every rule
  (as `--experimental`) for their genre, summarised per rule, compared with `corpus/expected.txt`.
  `--update` accepts the current summary. Documents not fetched are skipped and keep their line.

## Steps

1. The mechanism and a first set: PEP 8 (committed, public domain), a KEP, a Rust RFC, RFC 9457, Kubernetes
   docs (en/ja), React ja docs, two GitLab Handbook pages, Rust lang team minutes.
2. More genres: requirements, reports, contracts, travel plans, Japanese minutes and internal documents.
3. The improvement loop: review each document's findings, fix false positives by pattern, re-run.
4. Self-written samples with planted mistakes, and `yarn bench`.
