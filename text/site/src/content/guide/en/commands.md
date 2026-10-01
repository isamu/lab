# Commands

Every chaff command and option, each with a word on what happens.
When you type one yourself, put `npx` in front: `npx chaffjs`.

## The commands

The list `npx chaffjs --help` prints, as a table.

| Command | What happens |
| --- | --- |
| `npx chaffjs <file\|dir\|glob>...` | Checks. No settings and no API key needed |
| `npx chaffjs .` | Checks every Markdown file here |
| `npx chaffjs init` | Creates `chaff.yaml` (asks for the genre at a terminal; `--genre` chooses it) |
| `npx chaffjs explain <rule>` | Shows what a rule is for, and why |
| `npx chaffjs genres` | Lists the genres and what each is for |
| `npx chaffjs --version` | Prints the version of chaffjs and of its bundled language packages |
| `npx chaffjs rules` | Every rule as a table, by group, with the level it runs at now |
| `npx chaffjs rules --json` | The current settings and what each rule is, as JSON, to give to an AI |
| `npx chaffjs relax\|strict\|off <rule>` | Changes a rule's level, with `--why "reason"` |
| `npx chaffjs baseline <dir>` | Shelves today's findings |
| `npx chaffjs suppressions <dir>` | Counts the findings silenced with `stet` |
| `npx chaffjs tree <file>` | Turns a document into a tree of addresses |
| `npx chaffjs cite <source> <quotes.json>` | Checks that quoted passages are in the source |
| `npx chaffjs compare <before> <after>` | Checks that a rewrite dropped no fact and added none (numbers, dates, URLs, code, names, quotations…) |
| `npx chaffjs facts <file>` | Lists the facts `compare` checks, as an inventory to keep before a rewrite |
| `npx chaffjs skill` | Installs the Claude Code skill |
| `npx chaffjs feedback <file> --rule <rule>` | Drafts a report of a wrong or missed finding |
| `npx chaffjs test <file\|dir>...` | Also runs the checks that read meaning. Needs an API key |
| `npx chaffjs eval <dir>` | Re-measures the limits on your own documents |

These options go with a check.

| Option | What happens |
| --- | --- |
| `--compact` | One short entry per finding, for engineers |
| `--watch` | Re-checks on every save and prints only what changed |
| `--experimental` | Runs the experimental rules too |
| `--genre <genre>` | The genre for this run only; it wins over `chaff.yaml` |
| `--show-baseline` | Shows the shelved findings too |
| `--sarif <path>` | Writes the findings as SARIF, to show them on the lines of a GitHub PR |

`tree` and `cite` are explained in [Structure and quotations](./structure), `--sarif` in [CI](./ci).

## One short entry per finding

`--compact` gives each finding two lines.
The first is "line:column", the severity and the message; the second is the rule.

```
$ npx chaffjs sample.md --compact

sample.md   blog/tech · English   genre from the default

  21:1    warning This sentence runs 31 words (limit 25)
                  max-sentence-length
  21:177  warning This sentence runs 27 words (limit 25)
                  max-sentence-length
  142:1   warning The first sentence repeats the heading "agentFunctionInfo"
                  heading-echo

3 findings, 45 rules not run
```

The last line counts the findings and the rules that did not run.

## Checking while you write

`--watch` re-checks on every save and prints only what changed.
Printing everything again would hide what changed.

```
$ npx chaffjs article.md --watch
  Watching 1 file. 2 findings now.
  Each save prints only what changed. Ctrl-C to stop.

08:21:10  article.md  ✓ 2 → 1 finding   (-1 max-sentence-length)
08:21:15  article.md  ✗ 1 → 2 findings   (+1 max-sentence-length)
```

`✓` means the findings went down, `✗` that they went up.
The parentheses name the rules that came or went.

## Running the experimental rules too

Experimental rules do not run by default. `--experimental` runs them too.

```bash
npx chaffjs report.md --experimental
```

An experimental rule joins the defaults only when all three hold:

1. It fired on documents that were really published
2. Reading its findings, they were judged right
3. It meets the target of `npx chaffjs eval` (a false-positive rate under 5%)

A rule that has never fired does not join the defaults.
Working on made-up documents shows it is not broken,
but that is not evidence it should run for everyone.

## Reading what a rule does

`explain` shows what a rule looks at and why.
It also shows the numbers behind `strict`, `normal` and `relaxed`, and the level now.

```
$ npx chaffjs explain max-sentence-length

  Sentence too long   (max-sentence-length)

  In a long sentence the reader loses the subject before reaching the verb.

  How to fix: Split it in two at the conjunction.

  Levels (unit: words):
    strict   18
  → normal   25
    relaxed  35
    off      not checked

  These numbers are for the default genre. business/email / business/meeting-notes / business/proposal / business/press-release / blog/essay / blog/owned-media / legal / legal/statute / docs/glossary / academic have numbers of their own.

  Now: normal.

  Change it:  npx chaff relax max-sentence-length --why "reason"
```

## Changing a rule with a command

`relax`, `strict` and `off` change a rule's level without opening `chaff.yaml`.
`relax` loosens it, `strict` tightens it, and `off` stops it.
For a rule with nothing to count, such as a gap in the numbering, `relax` keeps the finding and marks it a step lower ([Rules with nothing to count](./configuration#rules-with-nothing-to-count)).

```
$ npx chaffjs relax bold-density --why "figure captions use a lot of bold"
Set bold-density to relaxed (…/chaff.yaml)
```

`chaff.yaml` gets a comment explaining the rule, and the date, the reason and a name.
The name is your user name (the `USER` environment variable); `writer` here is an example.

```yaml
rules:
  # Too much bold
  # Bold marks what matters. Used everywhere, it marks nothing.
  bold-density: relaxed # 2026-09-28 figure captions use a lot of bold / writer
```

Comments already in `chaff.yaml` are kept.
Changing a rule that already has a reason needs a new one with `--why`.
That way the old reason is never left standing next to a new value.

```
$ npx chaffjs off bold-density
bold-density already has a reason:
  2026-09-28 figure captions use a lot of bold / writer
To change the level, give a new reason with --why.
```

## Listing the genres

`genres` lists the genres (the kinds of document) you can pick, by group, with what each is for.

```
$ npx chaffjs genres

  Pick the genre (the kind of document) and chaff checks it the way that kind is written:

  Technical
    technical/spec          Specifications, RFCs and design documents, written so the reader cannot get it wrong
    technical/readme        READMEs and documentation for developers

  Blog
    blog/tech               Technical articles; the genre used when none is set
    blog/essay              Personal essays posted on a blog
    blog/owned-media        Articles an organisation publishes for its readers

  Business
    business/proposal       Proposals, plans and pitches
    business/report         Reports, white papers and internal documents
    business/email          Work email and letters
    business/press-release  Press releases and public notices
    business/meeting-notes  Minutes and meeting notes

  Legal
    legal/contract          Contracts, terms of service and privacy policies
    legal/statute           Statutes, regulations and internal rules
    legal/judgment          Court judgments and opinions
    legal/patent            Patent specifications and claims

  Documentation
    docs/manual             User guides, how-to pages and help
    docs/faq                Pages of questions and answers
    docs/glossary           Lists of terms and what they mean

  Academic
    academic/paper          Papers and abstracts

  Literature
    literature/fiction      Novels and stories
    literature/essay        Literary essays; a blog essay is blog/essay
    literature/poetry       Poems and verse
    literature/play         Plays and scripts

  Speech
    speech/address          Speeches and addresses written to be read aloud
    speech/transcript       Verbatim records of what was said (press conferences, parliamentary debates)

  For one run:       npx chaffjs --genre legal/contract contract.md
  For this folder:   npx chaffjs init --genre legal/contract   (writes genre in chaff.yaml)
```

`--genre` sets the genre for one run and wins over `chaff.yaml`; the first line then says `genre from --genre`.
To set it for good, create `chaff.yaml` with `npx chaffjs init --genre <genre>`, or write `genre` in `chaff.yaml`.
What each genre leaves out and adds is on the [Genres](../../genres/) page.

## Shelving today's findings

A repository with many documents gets many findings on its first run.
Fixing them all before starting is not realistic, so `baseline` shelves today's findings.

```
$ npx chaffjs baseline docs/
  Checked 1 file.

  Recorded 1 finding in .chaff-baseline.json.
  They will not be reported again; only new ones will.

  Commit .chaff-baseline.json.
```

From then on the shelved findings are not reported. The first line counts them.

```
$ npx chaffjs docs/ --compact

docs/a.md   technical/readme · English   genre from the path   1 shelved


0 findings, 30 rules not run
```

To see the shelved ones too, add `--show-baseline`.

```
$ npx chaffjs docs/ --show-baseline --compact

docs/a.md   technical/readme · English   genre from the path

  3:1     warning This sentence runs 43 words (limit 25)
                  max-sentence-length

1 finding, 30 rules not run
```

How to use it in CI is in [CI](./ci).

## Counting what was silenced

`suppressions` counts the findings silenced with `stet`.
If you keep silencing the same rule, it is time to change the rule instead.

```
$ npx chaffjs suppressions docs/
  Silenced findings: 7

  bold-density                7  <- consider changing the setting instead
      docs/g1.md, docs/g2.md, docs/g3.md and 4 more files
      reasons: a glossary, so the bold is on purpose
      relax the whole rule: npx chaff relax bold-density --why "..."

  Silenced without a reason: 1
      docs/x.md
```

Places silenced without a reason are listed here too.

## Installing the Claude Code skill

`skill` installs a Claude Code skill that runs chaff on what you are writing.
Without `--global` it goes into this repository's `.claude/skills/chaff/`; with it, into `~/.claude/`.

```
$ npx chaffjs skill
Wrote the Claude Code skill: …/.claude/skills/chaff/SKILL.md
Reopen Claude Code and it is available as /chaff.
```

## Reporting a wrong or missed finding

When a finding is wrong, or chaff missed something, `feedback` drafts a report from your own document.
It keeps only the lines around the finding, and sends nothing itself.
`--missed --line N` reports something chaff should have said; `--with-config` adds all of `chaff.yaml`.

```
$ npx chaffjs feedback sample.md --rule heading-echo --line 142
  Wrote a draft report to .chaff-feedback.md. From the document it includes only the lines around 142. Read it before sending, and delete anything you do not want to share.

  To send it (either):
    gh issue create -R isamu/lab --title 'False positive: heading-echo — The first sentence repeats the heading "agentFunctionInfo"' --body-file .chaff-feedback.md
  In a browser (paste the contents of .chaff-feedback.md into the page):
    https://github.com/isamu/lab/issues/new?title=False%20positive%3A%20heading-echo%20%E2%80%94%20The%20first%20sentence%20repeats%20the%20heading%20%22agentFunctionInfo%22

  chaff has not sent anything.
```

## Checking that a rewrite kept its facts

Sometimes you want text that sounds like an AI wrote it rewritten boldly, so it reads as a person's: sentences rebuilt, paragraphs moved, the throat-clearing cut.
An AI can do the rewriting. But the bolder the rewrite, the harder it is for a person to notice that a number went missing, a date moved by a day, a URL fell out, or a figure appeared that was never in the original.

`compare` is the guardrail that catches it. It reads the facts out of the text before and after the rewrite the same way — numbers, dates, times, URLs, code, names, quotations, headings, references and footnotes — and compares them.
Position does not matter, so a fact that moved with its paragraph is fine. No AI makes the call: the same two documents always give the same result. chaff only compares; it never rewrites.

```
$ npx chaffjs compare before.md after.md
before.md → after.md

✗ 2 facts dropped (in before.md, not in after.md)
  number: 25%  (before.md:3)
  URL: https://example.com/price  (before.md:3)

i 2 facts written another way
  heading: Pricing update → What changes in pricing  (line 1 → line 1)
  date: April 1, 2026 → 2026-04-01  (line 3 → line 3)

Facts checked: 7 → 5: numbers 3→2, dates 1→1, times 0→0, URLs 1→0, code 0→0, names 0→0, quotations 0→0, headings 1→1, references 1→1, footnotes 0→0
2 facts dropped, 0 facts added
```

- A **dropped** fact and an **added** fact are failures: either one ends the run with 1. Even a bold rewrite must not invent facts.
- A fact **written another way** is information: 1,000 and 1000, ５ and 5, April 1, 2026 and 2026-04-01, a reworded heading.
- The last lines count each kind before and after, zeros included, so "nothing dropped" never reads as "nothing looked at". A kind that could not be read (no part-of-speech tagger, say) is listed with the reason.

To let an intended cut through, name its kind with `--allow-dropped`; for an intended addition, `--allow-added`. What they let through is still listed.

```bash
npx chaffjs compare before.md after.md --allow-dropped url        # the URL may go
npx chaffjs compare before.md after.md --allow-dropped url,quote  # several kinds, with commas
npx chaffjs compare before.md after.md --compact                  # one line per fact
npx chaffjs compare before.md after.md --json                     # for an AI to act on
```

The kinds are `number`, `date`, `time`, `url`, `code`, `name`, `quote`, `heading`, `reference` and `footnote`.
`--json` lists every dropped and added fact with its line, so it can go straight back to the AI that did the rewrite.

## Listing the facts before a rewrite

A rewrite from scratch starts from what the document says, not from its sentences. `facts` lists that: every fact `compare` will check, kind by kind, with the line each is on.
It uses `compare`'s own reader, so the list is exactly what the rewrite will be held to.

```
$ npx chaffjs facts before.md
before.md: 7 facts (numbers 3, dates 1, times 0, URLs 1, code 0, names 0, quotations 0, headings 1, references 1, footnotes 0)

numbers: 3
  - [ ] 10  (before.md:3)
  - [ ] 12.50  (before.md:3)
  - [ ] 25%  (before.md:3)

dates: 1
  - [ ] April 1, 2026  (before.md:3)

URLs: 1
  - [ ] https://example.com/price  (before.md:3)

headings: 1
  - [ ] Pricing update  (before.md:1)

references: 1
  - [ ] Section 4.2  (before.md:3)

After rewriting, npx chaffjs compare before.md <rewritten> checks that every fact on this list is still there
```

`--compact` gives one fact per line. `--json` gives every fact with its kind, key, text and line, for an AI to keep as its inventory while it writes.

## Checks that read meaning, and re-measuring the limits

This guide only names these two.

| Command | What happens |
| --- | --- |
| `npx chaffjs test <dir>` | Has an AI read what a machine cannot judge. Needs an API key |
| `npx chaffjs eval <dir>` | Re-measures whether the limits fit, on your own documents |
