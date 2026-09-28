# Configuration

`chaff.yaml` fits genre, language and rule strength to your team.
You write only what differs from the defaults, and chaff runs without the file.

## Creating chaff.yaml

```bash
npx chaffjs init                 create chaff.yaml
```

This creates `chaff.yaml` and `.gitignore` here. A real run prints:

```
$ npx chaffjs init

Created:
  …/chaff.yaml  the team's rules; commit it
  …/.gitignore  created

The genre is blog/tech. If that is wrong, change genre in chaff.yaml.
  List: npx chaff genres

Next:
  npx chaff .            check every Markdown file here
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
#   npx chaff relax bold-density --why "figure captions use a lot of bold"
#   npx chaff explain bold-density        read what the rule is for
#   npx chaff rules --json                give this to an AI that writes the settings

# The kind of document kept here.
genre: blog/tech

# Only what differs from the defaults.
rules:
```

The `.gitignore` written with it lists `.env*`.
If you put the API key for the checks that read meaning in `.env`, it will not be committed by accident.

## Choosing genre and language

The genre decides which rules run and where their limits are.
Leave it out and it is worked out from the path and the content.
`README.md`, `*-spec.md` and `docs/` are read as technical documents.
Where it came from is shown on the first line of the screen.

```
payment-spec.md   technical/spec · English   genre from the path
```

When it is wrong, set `genre`. These are the genres:

| Genre | What kind of document |
| --- | --- |
| `technical/spec` | A specification |
| `technical/readme` | A README or technical document |
| `blog/tech` | A technical blog post |
| `blog/essay` | An essay |
| `blog/owned-media` | Owned media (a company's own content site) |
| `business/proposal` | A proposal |
| `business/report` | A report |
| `business/email` | An email |
| `business/press-release` | A press release |
| `business/meeting-notes` | Meeting notes |

`npx chaffjs genres` lists them too.
The language is also worked out per file; set `language` to `ja` or `en` to fix it.

## Choosing the kind of document

Some documents are written to fixed conventions, statutes for one.
A Japanese statute writes its addresses in kanji numerals (第二十二条第二項), and counting that as a long run of kanji would be wrong.
Knowledge like that lives in settings files bundled with chaff (`profiles/*.yaml`), and applies only to the documents it is chosen for.
The one bundled today is Japanese statutes (`statute`).

Leave it out and it is chosen from the content: three or more lines that start with an article, like `第一条　`, make a statute.
The choice is shown on the first line of `chaff tree`.

```
$ npx chaffjs tree draft.txt
(doc :language "ja" :path "draft.txt" :profile "statute" :line 1
```

When it is wrong, set `profile`. `none` stops it from being chosen from the content as well.
To change it per path, `by_path` takes `profile` too.

```yaml
profile: statute
```

## Changing how strict a rule is

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

  Levels (unit: words):
    strict   18
  → normal   25
    relaxed  35
    off      not checked

  These numbers are for the default genre. business/email / business/meeting-notes / business/proposal / business/press-release / blog/essay / blog/owned-media have numbers of their own.

  Now: normal.

  Change it:  npx chaff relax max-sentence-length --why "reason"
```

The same `normal` means a different number in a different genre.
You write a word rather than a number so that chaff can pick the number that fits the genre.

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

rules:
  preferred-term: normal
```

When `preferred-term` finds the left-hand spelling, it asks for the right-hand one.
With nothing under `prefer`, it says nothing.
The rule is experimental, so give it a strength under `rules` to turn it on.

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
  3:1     warning "circle back" may only work inside (3 such words)
                  internal-jargon
```

| Setting | How it matches |
| --- | --- |
| `jargon` | As written, capital letters included; a single word also finds its other forms (`leverage` finds "leveraged") |
| `required_sections` | Part of a heading: `Risks` is met by "Risks and mitigations" too |

Both are experimental, so give `internal-jargon` and `required-sections` a strength under `rules` as well.

`required_sections` is an `error` by default.
It is not a matter of taste: the team decided on it and the document does not have it.

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
    "technical"
  ],
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
For an experimental rule, `now` says why it does not run and how to turn it on.

```json
    "now": {
      "level": "off",
      "why_off": "experimental rules do not run by default",
      "turn_on_with": "npx chaff lint --experimental"
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

```
$ npx chaffjs article.md
chaff: …/chaff.yaml: there is no rule named max-sentense-length (npx chaff rules --json lists them)
chaff: …/chaff.yaml: cannot read "loose" as the level of bold-density (strict / normal / relaxed / off, or a positive number)
```

When you see a warning, fix the spelling or the value in `chaff.yaml`.
