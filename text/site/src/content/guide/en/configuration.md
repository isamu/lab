# Configuration

`chaff.yaml` fits genre, language and rule strength to your team.
You write only what differs from the defaults, and chaff runs without the file.

## Creating chaff.yaml

```bash
npx chaffjs init --genre legal/contract   create chaff.yaml for contracts
npx chaffjs init                          at a terminal, pick the genre from a numbered list
```

At a terminal, `init` without `--genre` lists every genre with what it is for and asks for a number or a name (Enter for `blog/tech`).
A script or CI is not asked and gets `blog/tech`.

This creates `chaff.yaml` and `.gitignore` here. A real run prints:

```
$ npx chaffjs init --genre legal/contract

Created:
  …/chaff.yaml  the team's rules; commit it
  …/.gitignore  created

The genre is legal/contract. If that is wrong, change genre in chaff.yaml.
  List: npx chaffjs genres

Next:
  npx chaffjs .            check every Markdown file here
```

The paths on the screen are shortened. The `chaff.yaml` it writes is:

```yaml
# chaff.yaml — this team's writing rules
#
# Write only what differs from the defaults; anything left out uses the default.
# chaff still runs if this file is deleted.
#
# A level is one of four words. No numbers needed.
#
#   strict    check closely
#   normal    the default
#   relaxed   check loosely
#   off       do not check
#
# Commands change it too, and leave the reason as a comment.
#
#   npx chaffjs relax bold-density --why "figure captions use a lot of bold"
#   npx chaffjs explain bold-density        read what the rule is for
#   npx chaffjs rules --json                give this to an AI that writes the settings

# The kind of document kept here (Contracts, terms of service and privacy policies). The others: npx chaffjs genres
genre: legal/contract

# The names your team writes (organisations, products). Each is read as one name, not as words to count.
# names:
#   - Bank of England

# This genre's guide: what a good document of this kind does. It comes before the findings, and an AI
# rewriting the text works to it. chaff ships one; replace it, add lines, or turn it off.
# guide:
#   legal/contract:
#     add:
#       - Does each amount say whether tax is included?

# Only what differs from the defaults.
rules:
```

The `.gitignore` written with it lists `.env*`.
If you put the API key for the checks that read meaning in `.env`, it will not be committed by accident.

## Choosing genre and language

The genre is the kind of document. It decides three things:

| What | How |
| --- | --- |
| Which rules run | A genre turns off the rules that only flag its form (a contract repeats its defined terms on purpose). A rule that reports on most human documents of that kind is turned off too, by measurement |
| Where the limits are | The same `normal` means a longer sentence for a statute or a paper than for an email |
| How the document is read | `legal/statute` reads with the knowledge of statutes (see below) |

A rule the genre turns off is listed under "did not run" with the genre as the reason, for example `ngram-repetition (the legal/contract genre does not check it)`.
`rules` in `chaff.yaml` wins over the genre, so `ngram-repetition: normal` turns it back on.
Every genre and what it changes is on the [Genres](../../genres/) page, and the table is in [Getting started](./getting-started).

Leave `genre` out and it is worked out from the file's front matter (`genre:` or `type:`), then the path, then the content.
Front matter sets one document apart; `genre` in `chaff.yaml` or a matching `by_path` entry wins over it.
Strongest first: `--genre`, `by_path`, `genre` in `chaff.yaml`, front matter, the path, the content.
`README.md`, `*-spec.md` and `docs/` are read as technical documents.
Where it came from is shown on the first line of the screen.

```
payment-spec.md   technical/spec · English   genre from the path
```

When nothing decides it, the document is checked as `blog/tech`, and when it looks like another kind the screen suggests one (`Looks like: Contract and terms. Try --genre legal/contract`).
The suggestion never changes the genre it is checked with.
When the genre is wrong, set `genre`.

`npx chaffjs genres` lists every genre with what it is for.

A genre that is not in this list stops chaff before it checks anything, and it says where the genre was written.
A `genre:` in a file's front matter that is not in the list is not used.
chaff says so and works the genre out as if it were not there.
The language is also worked out per file; set `language` to `ja` or `en` to fix it.
How the language is chosen, documents that mix both, and which rules run in which language are in [Languages](./languages).

## Choosing the kind of document

Some documents are written to fixed conventions, statutes for one.
A Japanese statute writes its addresses in kanji numerals (第二十二条第二項), and counting that as a long run of kanji would be wrong.
Knowledge like that lives in settings files bundled with chaff (`profiles/*.yaml`), and applies only to the documents it is chosen for.
The one bundled today is Japanese statutes (`statute`).

Leave it out and the genre chooses it (`legal/statute` reads with `statute`).
With no such genre, it is chosen from the content: three or more lines that start with an article, like `第一条　`, make a statute.
The choice is shown on the first line of `chaff tree`.

```
$ npx chaffjs tree draft.txt
(doc :language "ja" :path "draft.txt" :profile "statute" :line 1
…
```

When it is wrong, set `profile`. `none` stops it from being chosen from the content as well.
To change it per path, `by_path` takes `profile` too.
A profile that is not bundled stops chaff before it checks anything, and it says where the profile was written and which ones there are.

```yaml
profile: statute
```

## The rules that run by default

Most rules run with nothing in `chaff.yaml` and without `--experimental`.
Which ones run is decided by measuring how often each rule reports on real documents people wrote (see "Which rules run by default" in the [Reference](./reference)).

| Mark | How it runs |
| --- | --- |
| on by default | Seldom reports on human documents. It reports as it is |
| on by default (info) | Often reports on human documents too. Its findings are `info` and never fail the run |
| off for a genre | Reports on most documents of that genre. It is listed under "did not run", with the genre as the reason |
| experimental | A new rule not measured yet. It runs with `--experimental`, or with a strength under `rules` |

To hear less from an info rule, relax it or turn it off.

```bash
npx chaffjs relax ngram-repetition --why "we repeat phrases on purpose"
npx chaffjs off ngram-repetition --why "not checked in this team"
```

To run a rule a genre turns off, give it a strength under `rules` (`max-sentence-length: normal`).

## Changing how strict a rule is

Every rule you can set is listed, with examples, in the [Reference](./reference).
A rule's strength is one of four words under `rules`.

```yaml
rules:
  bold-density: relaxed
```

| Value | Meaning |
| --- | --- |
| `strict` | Check closely |
| `normal` | The default |
| `relaxed` | Check loosely |
| `off` | Do not check |

`explain` shows the numbers behind the words.

```
$ npx chaffjs explain max-sentence-length

  Sentence too long   (max-sentence-length)

  In a long sentence the reader loses the subject before reaching the verb.

  How to fix: Split it in two at the conjunction.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   up to 18 words in a sentence
  → normal   up to 25 words in a sentence
    relaxed  up to 35 words in a sentence
    off      not checked

  These numbers are for the default genre. technical / blog / blog/essay / business / business/email / docs / legal / legal/statute / docs/glossary / academic have numbers of their own.

  Now: normal.

  Change it:  npx chaffjs relax max-sentence-length --why "reason"
```

The same `normal` means a different number in a different genre.
You write a word rather than a number so that chaff can pick the number that fits the genre.

## Turning on one experimental rule

An experimental rule does not run by default.
Naming it under `rules` turns that rule on, and no other.
`--experimental` turns on every experimental rule at once.

```yaml
rules:
  announced-count-mismatch: normal
```

`enable` writes the same line, with a comment explaining the rule, as `relax` does.

```
$ npx chaffjs enable announced-count-mismatch
Set announced-count-mismatch to normal (…/chaff.yaml)
```

The check then names it once: `1 experimental rule turned on in the settings: announced-count-mismatch`.
`explain` on an experimental rule that is off shows the same command, and so does the list of rules that did not run.

## Rules with nothing to count

A gap in the numbering, or a weekday that does not match its date, is either there or not. There is no limit to count to.
For these rules the four words set how a finding is marked. At `relaxed` the finding does not go away; it is marked a step lower.

| Rules | `strict` | `normal` | `relaxed` |
| --- | --- | --- | --- |
| `numbering-gap` `dangling-reference` `date-weekday-mismatch` `total-mismatch` | (none) | error | warning |
| `duplicate-definition` `date-order` `doubled-word` `agreement-slip` `announced-count-mismatch` `dangling-figure-reference` `date-range-reversed` `percent-sum-mismatch` `unfilled-placeholder` | error | warning | note |

chaff fails when any error is left, and passes when there are only warnings and notes.
`explain` shows the marking in place of a number.

```
$ npx chaffjs explain numbering-gap --genre legal/statute
…
  Levels (there is no limit to count to; a level sets how a finding is marked):
  → normal   error
    relaxed  warning
    off      not checked
…
```

When a rule needs no checking, turn it `off`.
A number written for one of these rules only runs it at `normal`, and chaff says so when it reads the settings.

## When four words are not enough

The writing you want to hold up as a model can run longer than `relaxed` allows. Then write the limit as a positive number.

```yaml
rules:
  max-sentence-length: 260
```

A rule set with a number counts as `normal`.
`chaff rules --json`, described below, shows the number in effect.

## Making the team's spelling consistent

When the same thing is written two ways, "e-mail" and "email", the reader wonders whether they are different.
List the spelling to avoid and the one to use under `prefer`.

```yaml
prefer:
  e-mail: email
```

When `preferred-term` finds the left-hand spelling, it asks for the right-hand one.
With nothing under `prefer`, it says nothing.

## Deciding the team's jargon and required headings

`jargon` and `required_sections` are rules whose content your team decides.
chaff ships none of its own and reads only what `chaff.yaml` lists.
What counts as jargon, and which sections are required, differ from one organisation to the next.

```yaml
jargon:            # words only your team understands
  - circle back
  - boil the ocean

required_sections: # headings this kind of document must have
  - Risks
  - Costs
```

```
  1:1     error   No heading for "Risks"
                  required-sections
  3:1     warning "circle back" may only be understood inside your team (3 such words)
                  internal-jargon
```

| Setting | How it matches |
| --- | --- |
| `jargon` | As written, capital letters included; a single word also finds its other forms (`leverage` finds "leveraged") |
| `required_sections` | Part of a heading: `Risks` is met by "Risks and mitigations" too |

`required_sections` is an `error` by default.
It is not a matter of taste: the team decided on it and the document does not have it.

## Listing your team's names

An official name cannot be broken up: 「個人情報保護委員会」 is one name, however many kanji it runs to.
The dictionary splits such names into common nouns (厚生 + 労働省), so chaff cannot tell that they are names.
Your team knows which names are its own, so list them under `names`.

```yaml
names:
  - 個人情報保護委員会
  - Bank of England
  - Ministry of Land, Infrastructure, Transport and Tourism
```

A listed name matches as written, capital letters included, and these rules read it as one name:

| Rule | What happens to a listed name |
| --- | --- |
| `max-kanji-continuous` | The name inside a run of kanji is not counted. Kanji before or after it are measured as separate runs |
| `ngram-repetition` | Phrases that touch the name are not counted. Writing the name many times is not repeated phrasing |
| `undefined-acronym` | A listed name (`JAXA`), and an acronym inside one (`NTT` in `NTT Docomo`), need no expansion |
| `proper-noun-density` | A name split into several words counts as one proper noun. Names still count, so the density check stays |

Kanji outside the name are still counted: in 「個人情報保護委員会事務局総務課長補佐」 the rule measures 「事務局総務課長補佐」.
`names` is a list of names; a number such as `2025` is read as text. Anything else is skipped, and the run says so first.

A run of kanji that fills a 「」 or 『』 quotation exactly is not counted, even without `names`.
In 「英国大使館別荘記念公園」 the writer has marked it as one name. If the quotation also holds kana, the runs inside it are counted as before.

## Changing settings per path

One place can hold different kinds of documents. `by_path` changes the settings per path.

```yaml
genre: blog/tech

by_path:
  - files: ["business-ja/**/*.md"]
    genre: business/report
  - files: ["blog-en/**/*.md"]
    language: en
  - files: ["laws/**/*.txt"]
    profile: statute
```

The last match wins. Paths are matched from the folder that holds the settings file,
so the result is the same wherever you run it.
`by_path` is a list of entries with `files`. Any other shape, such as a folder mapped to a genre (`guides: docs/manual`), and an entry without `files` are not used, and chaff says so before it checks anything.

## Checking files other than Markdown

Given a folder, chaff checks the Markdown in it (`.md`, `.markdown`, `.mdx`).
`include` adds other files to that walk, by file-name glob. `--include` does the same for one run.

```yaml
include:
  - "*.yaml"
  - "*.txt"
```

```bash
npx chaffjs tests/fixtures/ --include "*.yaml"
```

A YAML file (`.yaml`, `.yml`) is checked by its string values.
Keys, quotes, comments, numbers and `true` are not prose, and each value is read on its own.
A finding points at the line and column in the file, so a `custom_rules` pattern finds `TODO:` in a test fixture's expected output.
A YAML file that cannot be parsed is read as plain text.
Any other file, such as `.txt`, is read as plain text.
A file named on the command line is checked whatever its extension.

## Setting the depth of a fix plan

A team can decide how deep the rewrites that `chaff fix-plan` plans may go.

```yaml
fix_plan:
  depth: light # light / structure / register
```

`light` rewrites words and sentences only, `structure` goes as far as reorganising sections, headings and paragraphs, and `register` as far as converting the style. A deeper depth includes the shallower.
Findings of a rule that reaches deeper than the depth are listed in the plan by name and spot count only.
`--depth` on the command line wins for that run.
Any other value stops `fix-plan` before it prints a plan, with the values it takes and what they mean.
Each rule's depth is in `npx chaffjs explain <rule>` and in `rewrite_depth` of `npx chaffjs rules --json`.
How the depths match the ways to rewrite is in [Making AI-sounding text sound human](./ai-sounding#setting-the-rewrite-depth).

## Changing the genre's guide

Each genre comes with a guide: what a good document of that kind does, as questions to check a draft against.
When the genre is set, chaff prints the guide before the findings, and `fix-plan` opens with it ([an example](./documents-contract#the-guide-that-comes-first)).
The bundled text is the default. A team changes it under `guide:`, keyed by a genre or by a group (`legal` covers every `legal/*` genre).

| Entry | What it does |
| --- | --- |
| `add:` | Puts lines after the current ones |
| `replace:` | Replaces the lines, in the languages it gives; the other language keeps its own |
| `off` | Leaves the genre, or every genre of the group, with no guide |

Write the lines as a list under `ja:` and `en:`, or as one line or a list alone for both languages.
`guide: off` turns every guide off.
This `chaff.yaml` adds a line to the contract guide and turns the guide off for manuals, FAQs and glossaries:

```yaml
genre: legal/contract

guide:
  legal/contract:
    add:
      en:
        - Does each payment say when it is due, counted from what?
  docs: off
```

<!-- chaff-screen: guide -->
```
$ npx chaffjs contract.md

Guide: Contract and terms (legal/contract)

  Before the findings below, check the draft against these.

  - Are the parties named the same way (as defined) from start to end?
  - Is each defined term defined once and used in exactly its defined form?
  - Can each obligation be read as who does what by when?
  - Do amounts, dates, periods and clause references agree across the clauses and the schedules?
  - Are termination, liability, governing law and dispute resolution covered?
  - Does each payment say when it is due, counted from what?

  Rules that matter most for this genre: dangling-figure-reference, dangling-reference, date-range-reversed, date-weekday-mismatch, defined-name-repeated, defined-term-form, duplicate-definition, numbering-gap, party-role-name, requirement-smell, total-mismatch, vague-deadline
  Written in: genres.yaml → chaff.yaml
  Change it with guide: in chaff.yaml; leave it out with --no-guide.

════════════════════════════════════════════════════════════

contract.md   legal/contract · English   genre from chaff.yaml
…
```

The "Written in" line names where the guide was written, so a reader can tell the team's lines from chaff's.
This one replaces the contract guide with the team's own checklist:

```yaml
genre: legal/contract

guide:
  legal/contract:
    replace:
      en:
        - Are the parties written as "the Client" and "the Contractor" throughout?
        - Does each payment say when it is due, counted from what?
        - Is the governing law the law of England and Wales?
```

<!-- chaff-screen: guide-replace -->
```
$ npx chaffjs contract.md

Guide: Contract and terms (legal/contract)

  Before the findings below, check the draft against these.

  - Are the parties written as "the Client" and "the Contractor" throughout?
  - Does each payment say when it is due, counted from what?
  - Is the governing law the law of England and Wales?

  Rules that matter most for this genre: dangling-figure-reference, dangling-reference, date-range-reversed, date-weekday-mismatch, defined-name-repeated, defined-term-form, duplicate-definition, numbering-gap, party-role-name, requirement-smell, total-mismatch, vague-deadline
  Written in: genres.yaml → chaff.yaml
  Change it with guide: in chaff.yaml; leave it out with --no-guide.

════════════════════════════════════════════════════════════

contract.md   legal/contract · English   genre from chaff.yaml
…
```

A guide can be changed in four places. A stronger place is applied later, so it can replace or add to what a weaker one wrote.

| Place | Strength |
| --- | --- |
| `guide:` in `chaff.yaml` | Strongest |
| `guide:` in the style chosen with `style:` | |
| `guide:` in a rule pack's manifest, or the `guide` export of a code plugin | |
| `genres.yaml`, bundled with chaff | Weakest |

Within one place, `guide: off` comes first, then the group's entry, then the genre's.
A genre or group chaff does not know, and an entry it cannot read, are reported on stderr; the rest still applies.
`npx chaffjs rules --json --genre legal/contract` shows the guide in effect under `guide`, with `from` listing each place that wrote it.

## Checking that the settings took effect

`chaff rules --json` shows the current settings.
It holds the value now, the values you can set, why a rule is `off` now, and the command to change it.
Give this output to an AI that writes the settings for you.

```bash
npx chaffjs rules --json         the current settings as JSON
```

The output is long, so here is one entry, with `max-sentence-length: 260` set (the path is shortened).

```json
{
  "id": "max-sentence-length",
  "layer": "L1",
  "status": "stable",
  "name": {
    "ja": "一文が長すぎる",
    "en": "Sentence too long"
  },
  "why": {
    "ja": "長い文は、読んでいるうちに主語を見失います。",
    "en": "In a long sentence the reader loses the subject before reaching the verb."
  },
  "how_to_fix": {
    "ja": "接続助詞のところで 2 文に割ってください。それだけで読めるようになります。",
    "en": "Split it in two at the conjunction."
  },
  "use_for": [
    "blog",
    "business",
    "technical",
    "legal",
    "docs",
    "academic",
    "literature",
    "speech"
  ],
  "level_sets": "limit",
  "levels": {
    "strict": 18,
    "normal": 25,
    "relaxed": 35
  },
  "levels_you_can_set": [
    "strict",
    "normal",
    "relaxed",
    "off"
  ],
  "your_setting": {
    "level": "normal",
    "limit": 260,
    "from": "…/chaff.yaml"
  },
  "now": {
    "level": "normal",
    "limit": 260,
    "set_as": "number"
  }
}
```

`now` is the value actually in effect.
`level_sets` says what a level changes: `limit` is a limit to count to, `severity` is how a finding is marked.
For a rule with nothing to count, `levels` and `now` hold a severity (`error` / `warning` / `info`) in place of a number.
For an experimental rule (a new one not measured yet), `now` says why it does not run and the command that turns it on alone:

```json
    "now": {
      "level": "off",
      "why_off": "experimental rules do not run by default",
      "turn_on_with": "npx chaffjs enable <rule>"
    }
```

Mistakes show on the screen too.
The check and `rules --json` warn on stderr about a rule name they do not know (usually a misspelling) and a value they cannot read.
Dropping them silently would let you believe a setting works when it does not.

```yaml
rules:
  max-sentense-length: strict
  bold-density: loose
```

<!-- chaff-screen: typo -->
```
$ npx chaffjs article.md
chaff: …/chaff.yaml: there is no rule named max-sentense-length (npx chaffjs rules --json lists them)
chaff: …/chaff.yaml: cannot read "loose" as the level of bold-density (strict / normal / relaxed / off, or a positive number)
…
```

When you see a warning, fix the spelling or the value in `chaff.yaml`.
