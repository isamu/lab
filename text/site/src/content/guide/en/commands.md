# Commands

Every chaff command and option, each with a word on what happens.
When you type one yourself, put `npx` in front: `npx chaffjs`.

## The commands

The list `npx chaffjs --help` prints, as a table.
`--help` after a command, as in `npx chaffjs init --help`, prints only that command's lines and runs nothing.

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
| `npx chaffjs enable <rule>` | Turns on one experimental rule alone (writes `<rule>: normal` in `chaff.yaml`). See [Configuration](./configuration#turning-on-one-experimental-rule) |
| `npx chaffjs baseline <dir>` | Shelves today's findings |
| `npx chaffjs suppressions <dir>` | Counts the findings silenced with `stet` |
| `npx chaffjs tree <file>` | Turns a document into a tree of addresses |
| `npx chaffjs cite <source> <quotes.json>` | Checks that quoted passages are in the source |
| `npx chaffjs compare <before> <after>` | Checks that a rewrite dropped no fact and added none (numbers, dates, URLs, code, names, quotations…) |
| `npx chaffjs facts <file>` | Lists the facts `compare` checks, as an inventory to keep before a rewrite |
| `npx chaffjs outline <file> [<after>]` | Shows the outline, measures its shape (headings, average section length, text in lists, bold) and scores its structure against human articles; two files side by side |
| `npx chaffjs fix-plan <file>` | Prints a plan for whoever rewrites the file: the findings by rule, how to rewrite each, and the checks to run after |
| `npx chaffjs grade <items.jsonl>` | Grades a JSONL file of model outputs: finding rates, facts, quotations, pass or fail. Sends nothing |
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
| `--dry-run` | With `test`, shows what would be sent to an AI, without calling the API |
| `--include <glob>` | In a folder, checks the files matching the glob besides Markdown (`--include "*.yaml"`). See [Configuration](./configuration) |

`tree` and `cite` are explained in [Structure and quotations](./structure), `--sarif` in [CI](./ci), and `grade` in [Using chaff for AI evals](./ai-evals).

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

3 findings, 53 rules not run
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

  Levels:
    strict   up to 18 words in a sentence
  → normal   up to 25 words in a sentence
    relaxed  up to 35 words in a sentence
    off      not checked

  These numbers are for the default genre. business/email / business/meeting-notes / business/proposal / business/press-release / blog/essay / blog/owned-media / legal / legal/statute / docs/glossary / academic have numbers of their own.

  Now: normal.

  Change it:  npx chaffjs relax max-sentence-length --why "reason"
```

## Changing a rule with a command

`relax`, `strict` and `off` change a rule's level without opening `chaff.yaml`.
`relax` loosens it, `strict` tightens it and `off` stops it.
A rule with nothing to count, such as a gap in the numbering, keeps its finding under `relax`, marked a step lower.
See [Rules with nothing to count](./configuration#rules-with-nothing-to-count).

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

<!-- chaff-screen: relaxed -->
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

<!-- chaff-screen: shelved -->
```
$ npx chaffjs docs/ --compact

docs/a.md   technical/readme · English   genre from the path   1 shelved


{counts}
```

To see the shelved ones too, add `--show-baseline`.

<!-- chaff-screen: shelved -->
```
$ npx chaffjs docs/ --show-baseline --compact

docs/a.md   technical/readme · English   genre from the path

  3:1     warning This sentence runs 43 words (limit 25)
                  max-sentence-length

{counts}
```

How to use it in CI is in [CI](./ci).

## Counting what was silenced

`suppressions` counts the findings silenced with `stet`.
If you keep silencing the same rule, it is time to change the rule instead.

<!-- chaff-screen: silenced -->
```
$ npx chaffjs suppressions docs/
  Silenced findings: 7

  bold-density                7  <- consider changing the setting instead
      docs/g1.md, docs/g2.md, docs/g3.md and 4 more files
      reasons: a glossary, so the bold is on purpose
      relax the whole rule: npx chaffjs relax bold-density --why "..."

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

The skill covers how to run chaff, how to read a finding, when to fix, `stet` or `relax --why`, setting things up
with `rules --json`, and `tree` and `cite`. Running it again replaces the skill with the new version. A file whose
contents differ may have been edited by hand, so it is replaced only with `--force`.

## Reporting a wrong or missed finding

When a finding is wrong, or chaff missed something, `feedback` drafts a report from your own document.
It keeps only the lines around the finding, and sends nothing itself.
`--missed --line N` reports something chaff should have said; `--with-config` adds all of `chaff.yaml`.
The draft, `.chaff-feedback.md`, holds the version and OS, the one finding with two lines on each side, and that rule's setting in `chaff.yaml`.
A report becomes a test and a fix.

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

Sometimes text that sounds like an AI wrote it needs a bold rewrite: sentences rebuilt, paragraphs moved, the throat-clearing cut.
An AI can do the rewriting. But the bolder the rewrite, the harder it is for a person to notice what changed.
A number goes missing, a date moves by a day, a URL falls out, or a figure appears that was never in the original.

`compare` is the guardrail that catches it. It reads the facts out of the text before and after the rewrite, the same way for both, and compares them.
The facts are numbers, dates, times, URLs, code, names, quotations, headings, references and footnotes.
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
npx chaffjs compare before.md after.md --distinct                 # a fact counts as kept if it is stated once
npx chaffjs compare before.md after.md --compact                  # one line per fact
npx chaffjs compare before.md after.md --json                     # for an AI to act on
```

The kinds are `number`, `date`, `time`, `url`, `code`, `name`, `quote`, `heading`, `reference` and `footnote`.
`--json` lists every dropped and added fact with its line, so it can go straight back to the AI that did the rewrite.

By default a fact is counted as often as it is stated, so cutting a summary that repeated the body reports each repeat as dropped.
With `--distinct`, a fact counts as kept when the other document states it at least once.
A fact stated nowhere in it is still dropped or added.
`--distinct` lets the rewrite state a fact more or less often than the original does; it checks only that each fact is there.

A heading counts as stated when the other document has a heading at the same level with the same wording.
So a cut heading is still listed when other headings of its level remain.

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

## Measuring the outline

A rewrite that smooths the sentences can leave the skeleton as it was: the same headings, the same lists, the same bold. `outline` shows the skeleton and measures it, so a restructure shows up as numbers, not as an impression.

It lists each heading, indented by depth, with its line and the length of its own text. It measures four things: the number of headings, the average section length, the share of the text in list items and the bold spans.
Lengths are characters for Japanese and words for English, and a section with no text of its own is left out of the average.

Below the outline comes the structure block.
It sets each structure measure against articles written before generated text was common, and says what share of them the value lies past.
Where a value lies past 90% of them, it also gives the human median and that line, marked ✗.

The measures are headings per 1000 words, sections of one or two paragraphs, section length variation, and headings in a stock form.
Then come headings split into three, introduction and conclusion headings, a closing that restates the body, and three-item lists.
Last come bold-label list items, emoji headings, and paired pros and cons.

The structure score is the count of ✗, out of the measures compared; nothing is weighted or hidden. A measure the document is too small for is listed as not measured, with the reason. The human percentiles are data, in `structure-baseline.yaml`.

Given two files, it shows both and how each measure moved, the structure score included.

<!-- chaff-screen: rewrite -->
```
$ npx chaffjs outline before.md after.md
before.md outline: headings 6, average section 47 words, in lists 19%, bold 8

  # Solving Our Flaky Test Problem — The Hidden Trap of Time Zones  (before.md:1)  25 words
    ## What Was Happening  (before.md:5)  64 words
    ## Investigating the Root Cause  (before.md:15)  84 words
    ## The Solution  (before.md:29)  52 words
    ## Results  (before.md:39)  14 words
    ## Conclusion  (before.md:43)  40 words

Structure score: 1 (measures past 90% of human articles, of 10 compared against 641 human articles)
  · headings: 17.9 per 1000 words  higher than 75% of human articles
  · sections of one or two paragraphs: 60% (mean 2.6 paragraphs)  higher than 55% of human articles
  · section length variation: 50%  more uniform than 60% of human articles
  · introduction / conclusion headings: 1 (closing)  higher than 65% of human articles
  ✗ list items opening with a bold label: 3  higher than 95% of human articles (human median 0, 90th percentile 0)
  · usual in human articles: headings in a stock form 0%, headings split into three 0, closing that restates the body 3% ("Conclusion"), headings with an emoji 0, pros / cons pairs 0
  not measured: three-item lists (fewer than three lists)

after.md outline: headings 5, average section 41 words, in lists 0%, bold 0

  # Our flaky test was a time zone problem  (after.md:1)  28 words
    ## What was happening  (after.md:5)  23 words
    ## Finding the cause  (after.md:9)  68 words
    ## The fix  (after.md:15)  49 words
    ## Results  (after.md:19)  38 words

Structure score: 1 (measures past 90% of human articles, of 9 compared against 641 human articles)
  · headings: 19.4 per 1000 words  higher than 80% of human articles
  ✗ sections of one or two paragraphs: 100% (mean 1.3 paragraphs)  higher than 90% of human articles (human median 50, 90th percentile 95)
  · section length variation: 39%  more uniform than 80% of human articles
  · usual in human articles: headings in a stock form 0%, headings split into three 0, introduction / conclusion headings 0, list items opening with a bold label 0, headings with an emoji 0, pros / cons pairs 0
  not measured: closing that restates the body (no closing section), three-item lists (fewer than three lists)

How the shape changed (before.md → after.md)
  headings: 6 → 5
  average section: 47 words → 41 words
  in lists: 19% → 0%
  bold: 8 → 0
  structure score: 1 → 1
  headings: 17.9 per 1000 words → 19.4 per 1000 words
  sections of one or two paragraphs: 60% (mean 2.6 paragraphs) → 100% (mean 1.3 paragraphs)
  section length variation: 50% → 39%
  headings in a stock form: 0% → 0%
  headings split into three: 0 → 0
  introduction / conclusion headings: 1 (closing) → 0
  closing that restates the body: 3% ("Conclusion") → —
  list items opening with a bold label: 3 → 0
  headings with an emoji: 0 → 0
  pros / cons pairs: 0 → 0
```

In this example the rewrite smoothed the sentences and dropped the lists and the bold, but kept almost every heading: the outline barely moved. `--compact` gives one section per line, then a line per file with the structure score and the measures past the line.
`--json` gives the outline, the shape and every structure measure with where it stands (`before` and `after` for two files). It only measures, so it ends with 0 whenever the files can be read.

## Planning a rewrite

`fix-plan` turns the findings into a plan for whoever rewrites the file, a person or an AI.
chaff still does not rewrite; the plan says how.

```bash
npx chaffjs fix-plan article.md --experimental           # the plan, as Markdown
npx chaffjs fix-plan article.md --experimental --json    # the same plan as JSON
```

The plan is written in the document's language. It starts with the constraints every rewrite keeps: no fact changed or added, ask the writer instead of inventing, two passes at most.
Next comes the recommended way to rewrite (Light, Bold or Full) and the document-level signals with the outline's numbers.
Then come the structure targets: the structure score, and a target for each measure past 90% of human articles. A score at its limit is itself a reason to recommend Full.

For each rule that found something, the plan gives its direction, what to keep, what to avoid, one before-and-after example and the spots.
It ends with the `chaff`, `compare` and `outline` commands to run on the rewrite.
The same file gives the same plan every time, and nothing is sent anywhere.
The page [Making AI-sounding text sound human](./ai-sounding) has an example that goes from the plan to the checks.

## Checks that read meaning

`chaff test` has an AI read what a machine cannot judge. It needs an API key. Without one it runs the machine
checks only and says so; it never passes in silence.

```bash
npx chaffjs test docs/
```

It never hands the whole document to the AI. The machine narrows the candidates first and the AI reads only those
passages. `risk-disclosure` does not even ask when a heading already names the risks.

| Rule | What it looks at | Narrowed to |
| --- | --- | --- |
| `risk-disclosure` | whether a proposal states its risks | nothing, when a heading names a risk section |
| `empty-conclusion` | whether the closing only summarises the body | only when the last section has no number, code or link the body did not have |
| `unsourced-number` | whether a number claiming an effect has a source | only when a number and an effect word share a sentence with no source |

The same question asked twice is answered from `.chaff-cache/`, so running it on every CI build is not billed again.

`--dry-run` shows what would be sent, without an API key and without calling the API:

```
$ npx chaffjs test proposal.md --genre business/proposal --dry-run
…
proposal.md   sends 2 passages out of 4 sentences (the API was not called)

      1 to send  Empty conclusion  (narrowed by machine)
      1 to send  No risk disclosed  (narrowed by machine)
      0 to send  Number without a source  (narrowed by machine)
…
  2 passages in all would be sent. With --dry-run the API was not called.
  Sent to: anthropic / claude-opus-5 (no credentials)
```

A team's own checks go in `checks.yaml`, written in plain language, not code.
With `look_at` (say, `look_at: sentences with "please confirm"`), only the sentences holding the quoted words are sent.
A check that cannot be narrowed sends the whole text, and the screen says so.

```yaml
checks:
  - name: A proposal names who decides
    use_for: business
    check: |
      A document that asks for a decision says who makes it.
      A job title or a name will do. If no one can be identified, it breaks the rule.
    level: normal
    how_to_fix: Name the person who decides, as in "approval from the head of finance".
```

The judge can be Anthropic or OpenAI. The rules and the shape the AI must answer in stay the same.

```yaml
ai_backend: openai     # anthropic by default
ai_model: gpt-5
```

| Backend | Credentials | Default model |
| --- | --- | --- |
| `anthropic` | `ANTHROPIC_API_KEY`, or `ant auth login` | `claude-opus-5` |
| `openai` | `OPENAI_API_KEY` | `gpt-5` |

The key can also be written in `.env`. A variable set in the shell wins, so you can try another key for one run.
Keep `.env` in `.gitignore`; the `.gitignore` that `chaff init` writes has it.
A Claude subscription (Pro or Max for Claude Code) does not work here.
The API is billed separately, and its credentials live elsewhere (`~/.claude` and `~/.config/anthropic`).

## Re-measuring the limits on your own documents

The default limits are a general guess. Whether they fit your writing can only be measured. `chaff eval` treats the
documents you give it as good writing that people published, and shows how many findings each limit would give.

```bash
npx chaffjs eval examples/blog-en/
```

```
  Measured 38 rules on 11 files as a corpus.

  The documents here are taken as good documents that people wrote and published.
  A rule that fires often on them may have a limit that does not fit real writing (target: under 5%).

  Note: the corpus has only 11 documents. Showing 5% takes at least 20.
     For now each share is either 0 or all, so read the density on the right (findings per 10,000 characters).

  Too many -ly adverbs   (adverb-overuse)

         8     9 docs ( 81.8%)     9 findings   3.6 per 10,000 characters
        10     9 docs ( 81.8%)     9 findings   3.6 per 10,000 characters
        11     8 docs ( 72.7%)     8 findings   3.2 per 10,000 characters
        13     8 docs ( 72.7%)     8 findings   3.2 per 10,000 characters
        15     6 docs ( 54.5%)     6 findings   2.4 per 10,000 characters  ← current
        19     4 docs ( 36.4%)     4 findings   1.6 per 10,000 characters
        23     1 doc  (  9.1%)     1 finding    0.4 per 10,000 characters
        25     1 doc  (  9.1%)     1 finding    0.4 per 10,000 characters
        30     1 doc  (  9.1%)     1 finding    0.4 per 10,000 characters
        45     0 docs (  0.0%)     0 findings   0.0 per 10,000 characters  ← recommended

    At the current limit 54.5% of the documents are hit, over the target (under 5%).
    Recommended: 45

    In chaff.yaml:  rules:
                      adverb-overuse: 45
```

It prints a recommended value and the line to put in `chaff.yaml`, but it never changes a limit itself.
The result answers for these documents, not for all writing, so a person decides.
With fewer than 20 documents each share swings between 0 and all, so read the density on the right instead.
