# chaff

[![npm](https://img.shields.io/npm/v/chaffjs)](https://www.npmjs.com/package/chaffjs)
[![license](https://img.shields.io/npm/l/chaffjs)](#license)
[![scoria · text](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/isamu/lab/badges/scoria-text.json)](https://github.com/isamu/lab/actions/workflows/quality.yml)
[![scoria · coding](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/isamu/lab/badges/scoria-coding.json)](https://github.com/isamu/lab/actions/workflows/quality.yml)

chaff checks writing the way a linter checks code. It reports what will slow a reader down, what
the document contradicts about itself and what a rewrite quietly changed. It reads English and
Japanese, returns the same findings for the same text every time, and never rewrites what you
wrote.

**Try it with nothing installed:** [playground (English)](https://isamu.github.io/lab/en/playground/) ·
[playground (日本語)](https://isamu.github.io/lab/ja/playground/)

*This repository is named `lab`. Alongside chaff it holds [scoria](#scoria), a code quality assay
for TypeScript and JavaScript. 日本語の案内は [isamu.github.io/lab/ja](https://isamu.github.io/lab/ja/) にあります。*

## First run

With Node.js 24 or later, nothing to install, no config file, no API key, no language to declare:

```bash
npx chaffjs article.md     # one file
npx chaffjs .              # every Markdown file here
npx chaffjs --help         # every command
```

Here is a run against a draft written to sound like generated text:

```text
$ npx chaffjs --compact draft.md

draft.md   blog/tech · English   genre from the default

  3:1     warning "it is important to note that" emphasises without saying anything
                  empty-intensifier
  3:86    info    "paradigm shift" is a cliché
                  cliche
  7:1     info    This sentence runs 43 words (limit 40)
                  max-sentence-length
  15:1    warning Closes with "in conclusion"
                  closing-cliche

4 findings, 67 rules not run
```

Without `--compact`, each finding carries why it matters, what to write instead and the command
that relaxes the rule if you disagree:

```text
─── line 3 ───────────────────────────────────────────────────

    It is important to note that the benefits of this change are not merely incremental.

  ⚠  Empty intensifier

     "it is important to note that" emphasises without saying anything
     "Extremely important" does not say what matters or why. It only feels emphatic.

     → Say what matters and why. If you cannot, the sentence can go.

     Relax this rule:  npx chaffjs relax empty-intensifier
```

The marks are the weight of a finding: `✖` an error, `⚠` a warning, `·` for information.

## Numbers and dates that disagree with each other

The largest group of rules does not read style at all. It reads the document's own arithmetic and
calendar, and most of what it finds is invisible to a careful reader:

```text
$ npx chaffjs --compact invoice.md

  9:30    error   The amount $1,900 is not quantity × unit price (2 × $900 = $1,800)
                  line-amount-mismatch
  12:26   warning The period "1 November 2026 to 20 October 2026" ends before it starts
                  date-range-reversed
  14:24   error   1 October 2026 is a Thursday, not a Friday
                  date-weekday-mismatch
  14:43   error   "13 PM" is not a time (with AM or PM, the hour runs to 12)
                  impossible-time
```

Along the same lines:

- a total that is not the sum of its items
- a tax line that does not match the rate
- a share of a group over 100%
- a deadline that falls after the event it is for
- a net figure that is not the gross minus the deductions
- a year-to-date figure below this period's
- a meter reading whose difference is not the usage billed

## The second version of a document

A linter reads one document. The harder problem arrives when a model rewrites it, because what
comes back is a document you did not write and nothing records what moved.

`facts` takes an inventory before the rewrite. `compare` reads it back afterwards.

```bash
npx chaffjs facts report.md
npx chaffjs compare report.md report-short.md
```

```text
report.md → report-short.md

✗ 9 facts dropped (in report.md, not in report-short.md)
  heading: Breakdown  (report.md:11)
  number: 60%  (report.md:15)
  number: 30  (report.md:15)
  number: 25%  (report.md:16)
  number: 12  (report.md:16)
  number: 16%  (report.md:17)
  number: 8  (report.md:17)
  heading: Timeline  (report.md:19)
  number: 48  (report.md:32)

Facts checked: 23 → 14: numbers 16→9, dates 1→1, headings 6→4, …
9 facts dropped, 0 facts added
```

That run asked a model to halve a quarterly report. Nothing was invented and nine things went: the
breakdown table, and the basis for "60 documents next quarter", which was "up from 48 this
quarter". The conclusion that rested on those numbers stayed. The rewrite reads correctly, which
is why reading it again does not catch this.

A fact rewritten into another form, "14 days" into "two weeks", reads as one fact dropped and
another added. Headings are matched through a rephrasing; numbers are not.

## Use it from Claude Code, Codex or Cursor

```text
/plugin marketplace add isamu/lab
/plugin install chaff@lab
```

Then ask it to check a document. The skill picks the genre for the kind of document, runs chaff
and reads each finding back to you. It changes nothing on its own. Codex and Cursor load the same
[`SKILL.md`](text/packages/chaff/skills/chaff/SKILL.md) directly.

## What it checks

Close to three hundred rules, in eight groups. The largest of them is the first, and `rules` prints
the current list with the level each one runs at here:

| Group | What it reads |
|---|---|
| Facts that disagree | totals, dates, times and quantities the document contradicts |
| Consistency | one spelling, one date format, one notation throughout |
| Wording | clichés, padding, empty intensifiers, hedges |
| Structure | headings, lists, paragraphs, how a section opens and closes |
| Readability | sentence length, clause distance, repeated endings |
| Slips | the mistakes of typing rather than of writing |
| Signs of generated text | the marks that human documents of the genre rarely show |
| Your team's words | the lists in your own `chaff.yaml` |

Most rules read both languages; a few dozen are specific to one.

A genre decides which rules run and how strictly, because a contract is not written like a blog
post:

```bash
npx chaffjs --genre legal/contract nda.md
npx chaffjs genres                        # what is available
npx chaffjs rules                         # which rule runs at what level now
npx chaffjs explain empty-intensifier     # more on one rule
npx chaffjs relax empty-intensifier       # or strict / off / enable
```

A `chaff.yaml` at the top of the repository holds a project's genre and style, its preferred
spellings, the levels it has chosen, and its own rules written as word lists, patterns,
part-of-speech patterns or a Node function.

## It reports; you decide

Two kinds of tool already exist for this. A classifier tells you a text looks generated, which you
cannot act on. A rewriter fixes the text for you, which removes the author from their own document.

chaff does neither. It reports, and the person who wrote the text decides what to change — or the
AI they asked, working from a plan they can read first:

```bash
npx chaffjs fix-plan article.md
npx chaffjs fix-plan --depth light|structure|register article.md
```

The plan lists the findings by rule, how to rewrite each one, and the checks to run afterwards.
`--depth` sets how far the rewrite may go.

## In CI

Every command returns an exit code, so a document is checked the way code is:

```yaml
- run: npx chaffjs .
```

Findings already in the repository can be shelved with a baseline, so a new one fails the build and
the old ones do not block it. [CI](https://isamu.github.io/lab/en/guide/ci/).

## What it does not do

It does not judge whether a document is any good. Whether an argument persuades, whether an example
is the right one, whether the piece was worth writing — none of that is in here.

It does not infer a total that the document has not labelled. "48 documents: 30 new features, 12
revisions and 8 investigation notes" passes, because nothing in it claims to be a sum. Label the
total and `total-mismatch` reads it.

`ai-score` gives an AI-likeness reading of low, medium or high by counting the signs of generated
text that human documents of the same genre rarely show. It is not a verdict on whether AI wrote
the text, and it is not meant to be one.

The checks that read meaning rather than form are a separate command:

```bash
npx chaffjs test
```

Those send the text to a model, so that command alone needs `ANTHROPIC_API_KEY` or
`OPENAI_API_KEY` and bills for what it uses. Everything above it runs on the machine the text was
written on and sends nothing anywhere.

## Documentation

- [Getting started](https://isamu.github.io/lab/en/guide/getting-started/)
- [Commands](https://isamu.github.io/lab/en/guide/commands/)
- [Configuration](https://isamu.github.io/lab/en/guide/configuration/)
- [Making AI-sounding text sound human](https://isamu.github.io/lab/en/guide/ai-sounding/)
- [Using chaff for AI evals](https://isamu.github.io/lab/en/guide/ai-evals/)
- [Checking in a browser](https://isamu.github.io/lab/en/guide/browser/)
- [CI](https://isamu.github.io/lab/en/guide/ci/)
- [Every rule](https://isamu.github.io/lab/en/rules/)

The whole guide is at [isamu.github.io/lab](https://isamu.github.io/lab/)
([English](https://isamu.github.io/lab/en/), [日本語](https://isamu.github.io/lab/ja/)).
[How to use chaff](text/packages/chaff/README.md) · [how to work on it](text/README.md).

## scoria

[`coding/`](coding/) holds **scoria**, a code quality assay harness for TypeScript and JavaScript.
[How to use it](coding/packages/scoria/README.md) · [the workspace](coding/README.md).

## Working in this repository

- [`text/`](text/): the chaff workspace, published on npm as
  [`chaffjs`](https://www.npmjs.com/package/chaffjs) with the language packages
  [`@chaffjs/lang-en`](https://www.npmjs.com/package/@chaffjs/lang-en) and
  [`@chaffjs/lang-ja`](https://www.npmjs.com/package/@chaffjs/lang-ja).
- [`coding/`](coding/): the scoria workspace.
- [`plans/`](plans/): plans written before larger changes to chaff and scoria.

## The badges

Both workspaces are measured by [scoria](coding/packages/scoria/README.md) on every push to `main`.

The number is this repository's own score and nothing else. scoria's scales are uncalibrated and
its rubrics change between versions, so holding it against another project's badge means nothing.
The colour is the part that carries information: **green** when no dimension fell since the
recorded baseline, **orange** when one did, **blue** when there is no baseline yet.

## License

MIT
