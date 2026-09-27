---
name: chaff
description: "Check prose with chaff (npx chaffjs): run it on Markdown or text, read each finding, fix the text or record why not, and tune chaff.yaml with rules --json and relax --why. Use when asked to lint, proofread or tighten documents, or to set up a team's writing rules."
---

# Checking writing with chaff

chaff finds what makes writing hard to read — long sentences, padding, mixed styles, broken references in a
contract — and never rewrites anything. Reading the findings and changing the text is your part. Japanese and
English documents both work; the language is detected per file.

## Run it

```sh
npx chaffjs <file|dir|glob>...     # human-readable, one block per finding
npx chaffjs . --compact            # one line per finding: line:col severity message / rule id
npx chaffjs <file> --experimental  # also the experimental rules
```

The exit code is 1 only when a finding is an `error`. A run that finds no Markdown fails rather than passing
silently. The list of rules that did not run, and why, is printed after the findings: read it before saying a
document is clean.

## For each finding, choose one of three

| | When | How |
| --- | --- | --- |
| Fix the text | The finding is right | Edit the sentence. Keep the meaning, the facts and the numbers; change only how it is said. |
| Silence that spot | Right in general, wrong here (a quotation, a term that must repeat) | `<!-- stet: rule-id — reason -->` before it; `stet-section` / `stet-file` for wider scope. Always give the reason. |
| Change the rule | Wrong for this team or genre | `npx chaffjs relax <rule-id> --why "reason"` (or `strict` / `off`). The reason and date are written into `chaff.yaml`. |

`npx chaffjs explain <rule-id>` shows why a rule exists, its levels and the current one. Read it before
relaxing a rule.

## Tune chaff.yaml

- `npx chaffjs init` writes a commented `chaff.yaml` (and adds `.chaff-cache/` and `.env*` to `.gitignore`).
- `npx chaffjs rules --json` prints every rule with its levels, the setting in effect (`now`) and why a rule is
  off. Read it instead of guessing rule names or limits.
- A level is `strict` / `normal` / `relaxed` / `off`; when even `relaxed` is too tight, a positive number is the
  limit itself (`max-sentence-length: 260`).
- `prefer:` maps spellings to the team's (`e-mail: email`); `preferred-term: normal` turns the rule on.
- Unknown rule names and unreadable values are reported on stderr — read stderr after editing `chaff.yaml`.
- `genre:` sets the kind of document (`npx chaffjs genres` lists them); `--genre` overrides it for one run.

## Structured documents

- `npx chaffjs tree <file>` shows a contract or specification as a tree of addresses (`3.2` for 第3条第2項 or
  Section 3.2). `--experimental` adds the structure rules: references to missing provisions, numbering gaps,
  terms defined twice.
- `npx chaffjs cite <source> <quotes.json>` checks that quotations (`[{ "address", "quote" }]`) are really in
  the source; exit 1 if any is not. Use it to back every quotation you put in an answer or a summary.

## Do not

- Do not change what a document says to satisfy a rule. If a finding cannot be fixed without changing the
  meaning, leave it and say so.
- Do not turn a rule off to make a run pass; relax it with a reason the team would accept.
- Do not report "no findings" without reading the not-run list.
