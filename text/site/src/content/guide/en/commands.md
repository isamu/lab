# Commands

Every chaff command and option, each with a word on what happens.
When you type one yourself, put `npx` in front: `npx chaffjs`.

## The commands

The list `npx chaffjs --help` prints, as a table.

| Command | What happens |
| --- | --- |
| `npx chaffjs <file\|dir\|glob>...` | Checks. No settings and no API key needed |
| `npx chaffjs .` | Checks every Markdown file here |
| `npx chaffjs init` | Creates `chaff.yaml` |
| `npx chaffjs explain <rule>` | Shows what a rule is for, and why |
| `npx chaffjs genres` | Lists the genres |
| `npx chaffjs rules --json` | The current settings as JSON, to give to an AI |
| `npx chaffjs relax\|strict\|off <rule>` | Changes a rule's level, with `--why "reason"` |
| `npx chaffjs baseline <dir>` | Shelves today's findings |
| `npx chaffjs suppressions <dir>` | Counts the findings silenced with `stet` |
| `npx chaffjs tree <file>` | Turns a document into a tree of addresses |
| `npx chaffjs cite <source> <quotes.json>` | Checks that quoted passages are in the source |
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

3 findings, 33 rules not run
```

The last line counts the findings and the rules that did not run.

## Checking while you write

`--watch` re-checks on every save and prints only what changed.
Printing everything again would hide what changed.

```
$ npx chaffjs article.md --watch
  Watching 1 file. 2 findings now.
  Each save prints only what changed. Ctrl-C to stop.

13:27:56  article.md  ✓ 2 → 1 findings   (-1 max-sentence-length)
13:28:01  article.md  ✗ 1 → 2 findings   (+1 max-sentence-length)
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

  These numbers are for the default genre. business/email / business/meeting-notes / business/proposal / business/press-release / blog/essay / blog/owned-media have numbers of their own.

  Now: normal.

  Change it:  npx chaff relax max-sentence-length --why "reason"
```

## Changing a rule with a command

`relax`, `strict` and `off` change a rule's level without opening `chaff.yaml`.
`relax` loosens it, `strict` tightens it, and `off` stops it.

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

`genres` lists what you can write as `genre` in `chaff.yaml`.

```
$ npx chaffjs genres
  Genres:
    technical/spec
    technical/readme
    blog/tech
    blog/essay
    blog/owned-media
    business/proposal
    business/report
    business/email
    business/press-release
    business/meeting-notes

  Set one with genre in chaff.yaml, or with --genre.
```

`--genre` sets the genre for one run and wins over `chaff.yaml`; the first line then says `genre from --genre`.
To set it for good, write `genre` in `chaff.yaml`.
What each genre is for is in the table in [Configuration](./configuration).

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


0 findings, 22 rules not run
```

To see the shelved ones too, add `--show-baseline`.

```
$ npx chaffjs docs/ --show-baseline --compact

docs/a.md   technical/readme · English   genre from the path

  3:1     warning This sentence runs 43 words (limit 25)
                  max-sentence-length

1 findings, 22 rules not run
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

## Checks that read meaning, and re-measuring the limits

This guide only names these two.

| Command | What happens |
| --- | --- |
| `npx chaffjs test <dir>` | Has an AI read what a machine cannot judge. Needs an API key |
| `npx chaffjs eval <dir>` | Re-measures whether the limits fit, on your own documents |
