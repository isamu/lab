---
name: chaff
description: "Check prose with chaff (npx chaffjs): pick the genre preset for the kind of document (contract, statute, manual, FAQ, paper, fiction, transcript…), run it on Markdown or text, read each finding, fix the text or record why not, and tune chaff.yaml with rules --json and relax --why. Use when asked to lint, proofread or tighten documents, or to set up a team's writing rules."
---

# Checking writing with chaff

chaff finds what makes writing hard to read — long sentences, padding, mixed styles, broken references in a
contract — and never rewrites anything. Reading the findings and changing the text is your part. Japanese and
English documents both work; the language is detected per file.

## Pick the genre first

A genre is a preset for one kind of document: which rules run, where their limits are, and how the document is
read. A contract checked as a blog post gets wrong findings, so choose the genre before reading any finding.

1. Name the kind from the document itself. `npx chaffjs genres` lists every genre with what it is for:
   `legal/contract`, `legal/statute`, `docs/manual`, `docs/faq`, `academic/paper`, `literature/fiction`,
   `speech/transcript`, `business/report`, `technical/spec`, …
2. Unsure? Run once without `--genre`. When the file looks like another kind, the line under the header says so
   (`Looks like: Contract and terms. Try --genre legal/contract`); use that genre if it fits.
3. Run with it: `npx chaffjs --genre legal/contract contract.md`. For a folder of one kind,
   `npx chaffjs init --genre legal/contract` writes it into `chaff.yaml` (always pass `--genre`: without it,
   `init` asks at a terminal).
4. The header's first line shows the genre used and where it came from. Check it before trusting the findings.

A rule the genre turns off is listed under "did not run" with the genre as the reason. That is the preset's
choice, not a gap; turn it back on (`rules:` in `chaff.yaml`) only when the person asks.

## Run it

```sh
npx chaffjs --genre <genre> <file|dir|glob>...   # human-readable, one block per finding (a folder or glob picks up .md / .markdown / .mdx; name a .txt file directly)
npx chaffjs . --compact                          # two lines per finding: line:col severity message, then the rule id
npx chaffjs <file> --experimental                # also the experimental rules
```

A run exits 1 when a finding is an `error`. It also exits 1 when it could not check anything: no file to
check, an unknown `--genre`, no package for the language. So a clean exit means the files were checked.

After the findings comes the list of rules that did not run, and why. Only the default output shows it;
`--compact` gives just their number. Read it before saying a document is clean.

A run over several files prints only the files that have findings. To call one file clean, run chaff on that
file alone and read its list.

## For each finding, choose one of three

| | When | How |
| --- | --- | --- |
| Fix the text | The finding is right | Edit the sentence. Keep the meaning, the facts and the numbers; change only how it is said. |
| Silence that spot | Right in general, wrong here (a quotation, a term that must repeat) | `<!-- stet: rule-id — reason -->` before it; `stet-section` / `stet-file` for wider scope. Always give the reason. |
| Change the rule | Wrong for this team or genre | `npx chaffjs relax <rule-id> --why "reason"` (or `strict` / `off`). The reason and date are written into `chaff.yaml`. |

`npx chaffjs explain <rule-id>` shows why a rule exists, its levels and the current one. Read it before
relaxing a rule.

## Tune chaff.yaml

- `npx chaffjs init --genre <genre>` writes a commented `chaff.yaml` for that genre when there is none (an
  existing one is left as it is), and adds `.chaff-cache/` and `.env*` to `.gitignore`.
- `npx chaffjs rules --json [--genre <genre>]` prints every rule with its levels, the setting in effect (`now`,
  the genre's preset included) and why a rule is off. Read it instead of guessing rule names or limits.
  `npx chaffjs rules` shows the same as a table, grouped, with the level each rule runs at now.
- A level is `strict` / `normal` / `relaxed` / `off`; when even `relaxed` is too tight, a positive number is the
  limit itself (`max-sentence-length: 260`).
- `prefer:` maps spellings to the team's (`e-mail: email`); `preferred-term: normal` turns the rule on.
- Unknown rule names and unreadable values are reported on stderr — read stderr after editing `chaff.yaml`.
- `genre:` sets the kind of document; `by_path` sets one per folder; `--genre` overrides both for one run.
  `rules:` wins over the genre's preset.

## Turn a team's style note into chaff.yaml

When the person gives house rules ("polite endings, sentences of at most 80 characters"), do not guess rule
names or numbers:

1. Read `npx chaffjs rules --json`. Each rule has `summary` (what it finds), `level_meaning` (what a level's
   number means), `levels`, `example`, `not_flagged`, and `genres` (whether it runs in each genre).
2. Split the note into single requirements; map each to the rule whose `summary` and `level_meaning` fit. A
   number between levels is written as the number itself (`max-sentence-length: 80`). Spellings go under
   `prefer`, in-house words under `jargon`, required headings under `required_sections`.
3. Say plainly what no rule covers. For example, `no-mixed-desumasu` flags a register mixed into a document, but
   does not require a particular one; a document wholly in the other register is not reported.
4. Write only what differs from the default, then check before committing: `npx chaffjs explain <rule-id>`, a
   short sample that breaks each requirement (each must be reported), and `npx chaffjs rules` (the table shows the
   level each rule now runs at).

## Adding a team rule

Pick the easiest way that can say the requirement:

| Requirement | Use |
| --- | --- |
| An existing rule covers it | A level, a number, `prefer`, `jargon` or `required_sections` in `chaff.yaml` |
| A fixed phrase or pattern, with the team's own message | `custom_rules` of type `words` or `pattern` (coming in the next release) |
| Decided by part of speech or inflection | `custom_rules` of type `tokens` (coming in the next release) |
| Counting or comparing that the above cannot express | a Node function, `type: module` (a later release) |

Test a new team rule the same way: `explain`, then a sample it must report and a sample it must not, before
committing `chaff.yaml`. The guide page "Adding a rule" covers each way and how to add a rule to chaff itself.

## Structured documents

- `npx chaffjs tree <file>` shows a contract or specification as a tree of addresses (`3.2` for 第3条第2項 or
  Section 3.2). `--experimental` adds the structure rules: references to missing provisions, numbering gaps,
  terms defined twice.
- `npx chaffjs cite <source> <quotes.json>` checks that quotations (`[{ "address", "quote" }]`) are really in
  the source; exit 1 if any is not. Use it to back every quotation you put in an answer or a summary.

## When chaff is wrong

If a finding is wrong for the text (a false positive), or chaff missed something it should catch, draft a report
for the chaff project:

```sh
npx chaffjs feedback <file> --rule <rule-id> [--line N]   # a wrong finding
npx chaffjs feedback <file> --missed --line N             # something missed
```

It writes `.chaff-feedback.md`: chaff's version, Node and OS, the file name, the one finding, the two lines on
each side of it, and the reported rule's setting in `chaff.yaml` (all of `chaff.yaml` only with `--with-config`).
When a rule has several findings in the file, add `--line` to pick one. It prints how to send the draft
(`gh issue create …`, or a link that carries the title only). It sends nothing. Show the draft to the person and let
them decide; their document may be private.

## Do not

- Do not change what a document says to satisfy a rule. If a finding cannot be fixed without changing the
  meaning, leave it and say so.
- Do not turn a rule off to make a run pass; relax it with a reason the team would accept.
- Do not report "no findings" without reading the not-run list.
