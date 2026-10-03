# Adding a rule: for AI and engineers

This page shows how to turn a team's writing rules into something chaff can check.
You can hand it as it is to an AI or an engineer.
There are four ways, from the easiest to the most powerful.

## Four ways

| Way | When it fits | Where it goes | Available |
| --- | --- | --- | --- |
| Set an option on a built-in rule | A rule chaff has already covers it (a limit, a spelling, in-house words, required headings) | `chaff.yaml` | now |
| A words or regular-expression rule | A fixed phrase or pattern, flagged with the team's own message (no "our company" in external copy) | `custom_rules` in `chaff.yaml` | 0.18.0 |
| A morphology rule | Writing decided by part of speech or inflection | `custom_rules` in `chaff.yaml` | 0.18.0 |
| A Node function rule | Counting, comparing, anything the three above cannot say | a `.mjs` file and `custom_rules` | 0.19.0 |

Rules to share with other teams can be packed into a plugin package; see [Writing a plugin](./writing-plugins).

First, check whether a rule chaff already has is enough.
The [Reference](./reference) lists every rule with an example.
In a terminal, these commands list them.

```bash
npx chaffjs rules          every rule as a table, by group
npx chaffjs rules --json   the same list, in the form an AI reads (JSON)
```

## Writing chaff.yaml from a style note

These are the steps for an AI. Give it the output of `npx chaffjs rules --json`.
For each rule it holds what the rule finds (`summary`) and what a level means (`level_meaning`).
It also holds an example, and how the rule stands in each genre (`genres`).
The AI then has no need to guess a rule's name or numbers.

| Step | What the AI does |
| --- | --- |
| 1 | Split the team's style note into single requirements |
| 2 | For each requirement, pick the rule whose `summary` and `level_meaning` match. For a number, compare it with the rule's levels, and pick a level or write the number itself |
| 3 | If the kind of document is known, set `genre`, and check in `genres` that the rule runs in it |
| 4 | Put spellings under `prefer`, in-house words under `jargon`, and required headings under `required_sections` |
| 5 | Leave out anything at its default. Then check with `explain` and a short sample that follows the note |

The same steps are in `rules --json`, under `how_to_write_settings_from_a_style_note`.
The JSON alone is enough to give the AI.

## Example: "polite endings, sentences of at most 80 characters"

Say a team's Japanese technical documents must use polite endings (です・ます), with sentences of at most 80
characters. With `language: ja` in `chaff.yaml`, `max-sentence-length` in `rules --json` reads like this (in part).
The numbers are counted the way the language counts (characters for Japanese, words for English), so look in the language of the rules.

```json
{
  "id": "max-sentence-length",
  "summary": { "en": "A sentence so long that the reader loses the subject before the verb" },
  "level_meaning": { "ja": "一文 {limit} 字まで", "en": "up to {limit} words in a sentence" },
  "levels": { "strict": 70, "normal": 100, "relaxed": 140 }
}
```

80 matches none of the levels, so the number itself is written.
Polite endings are checked by `no-mixed-desumasu`.
That rule does not decide which register is right; it points only at sentences that differ from the rest.
A document written wholly in the plain register is not reported, and the team should know that.

```yaml file=chaff.yaml
language: ja
genre: technical/spec

rules:
  # sentences of at most 80 characters
  max-sentence-length: 80
  # polite endings (report a plain ending mixed in)
  no-mixed-desumasu: normal
```

Make one sample that breaks both requirements, and run it. This is the real output.

```
$ npx chaffjs sample.md --compact

sample.md   technical/spec · 日本語   ジャンルは chaff.yaml から

  3:1     info    この文は 84 文字あります（80 文字まで）
                  max-sentence-length
  5:31    info    この文だけ他と文末の調子が違います（本文の中で 1 文）
                  no-mixed-desumasu

{counts}
```

Both requirements were reported, so the settings work.
When a finding does not appear, check in the `npx chaffjs rules` table that the rule is not `off`.

## Setting an option on a built-in rule

This is the easiest way. Only `chaff.yaml` changes; chaff's code is not touched.

| To change | Write |
| --- | --- |
| How strict a rule is | One of `strict`, `normal`, `relaxed`, `off` under `rules` |
| The limit itself | A number under `rules` (`max-sentence-length: 80`) |
| Turn an experimental rule on | A level under `rules` (`doubled-word: normal`) |
| One spelling for the team | Pairs under `prefer`: the spelling to avoid, then the one to use |
| In-house words | A list under `jargon` |
| Required headings | A list under `required_sections` |

The details are in [Configuration](./configuration).
Afterwards, the `npx chaffjs rules` table shows the level each rule now runs at.

## Options on a rule (0.18.0)

Besides its level, a rule can take its own settings under `options`.
The rule that has them now is `katakana-long-vowel`, which checks the final ー of katakana loanwords.
IEICE's house style, for one, drops the final ー from words of three morae or more, which reads like this.

```yaml
rules:
  katakana-long-vowel: normal
options:
  katakana-long-vowel:
    ending: drop      # no final ー (コンピュータ, メモリ)
    min_morae: 3      # only words of three morae or more
    except: [カー]     # never reported, either way
```

The single line `style: ieice` sets the same.
`npx chaffjs explain katakana-long-vowel` and `rules --json` list each option and the values it takes.
[Define your team's writing rules](./house-style) has the details.

## A words or regular-expression rule (0.18.0)

A rule that flags a fixed phrase or pattern with the team's own words, written under `custom_rules` in
`chaff.yaml`. `words` is a list of words, or pairs of the spelling to avoid and the one to use; `pattern` is a
regular expression. Every rule has a `name`, a `why`, a `how_to_fix` and an `example` (before and after), so whoever
reads a finding knows why to change it.

```yaml
custom_rules:
  - id: no-our-company
    type: words
    words: [our company]
    name: '"Our company" in external copy'
    message: 'Write "we", not "{matched}"'
    why: External documents speak as "we".
    how_to_fix: Write "we".
    example:
      before: Our company ships on Friday.
      after: We ship on Friday.
  - id: date-with-slash
    type: pattern
    pattern: '\d{4}/\d{1,2}/\d{1,2}'
    name: A date written with slashes
    message: 'Write "{matched}" as "1 October 2026"'
    why: One way of writing dates saves the reader a moment on every one.
    how_to_fix: Write the day, the month's name and the year.
    example:
      before: The deadline is 2026/10/1.
      after: The deadline is 1 October 2026.
```

`words` matches the words as written; for inflected words, use a morphology rule.
Like a built-in rule, a team rule takes a level under `rules`, and `stet` silences one spot.
Add `ignore_case: true` to a `pattern` rule to match regardless of case.
A regular expression is checked before it runs, and shapes that can run away on a long line (`(a+)+`) are refused.

## A morphology rule (0.18.0)

A rule that matches words by part of speech or by dictionary form.
"Is able to" for "can" takes one pattern per inflection when written as text ("was able to", "are able to").
As a sequence of analysed words it takes one. A condition is `pos`, `base` (also written `lemma`) or `surface`.

```yaml
custom_rules:
  - id: able-to
    type: tokens
    tokens:
      - { lemma: be }
      - { surface: able }
      - { surface: to }
    name: '"Is able to" where "can" will do'
    message: 'Write "can" instead of "{matched}"'
    why: '"Is able to" says in three words what "can" says in one.'
    how_to_fix: Use "can".
    example:
      before: The team is able to ship on Friday.
      after: The team can ship on Friday.
```

How a sentence is split depends on the sentence. Check the rule on samples it must match and samples it must not.

## A Node function rule (0.19.0)

Counting, comparing, anything none of the above can say, is written as a Node function.
The function takes the document and returns a list of findings.
In `chaff.yaml` the rule has a name, a reason, a fix and an example like any other.
It adds `type: module`, and `module`: where the function's file is, relative to `chaff.yaml`.

```yaml
custom_rules:
  - id: team-no-tbd-dates
    type: module
    module: ./chaff-rules/no-tbd-dates.mjs
    level: warning
    name: A date left undecided
    why: A reader plans around a date.
    how_to_fix: Write the date, or who decides it and by when.
    example:
      before: The launch date is TBD.
      after: The launch date is 1 October.
```

The file default-exports the function. A finding is a place in the document (`start` and `end`).

```js
// chaff-rules/no-tbd-dates.mjs
export default (doc) =>
  doc.sentences.flatMap((sentence) => {
    const at = sentence.text.indexOf("TBD");
    return at === -1 ? [] : [{ start: sentence.span.start + at, end: sentence.span.start + at + 3 }];
  });
```

A rule that reads parts of speech writes `requires: [pos]`; one that reads a word list writes `word_list`.
What the function is given and returns, how to test it and what a broken one prints are in
[Writing a plugin](./writing-plugins).
A file outside the folder `chaff.yaml` is in is read only when written as an absolute path, since loading it runs its code.

## Writing a team rule the way chaff's own rules are written

A rule under `custom_rules` (or in a plugin) may also write the fields chaff's own rule files have.
Each is optional; leave it out and the rule reads as a team rule always has.

```yaml
custom_rules:
  - id: no-tbd
    type: words
    words: [TBD]
    name: { ja: TBD が残っている, en: TBD left in }
    why: { ja: 読み手が動けません。, en: A reader cannot act on it. }
    how_to_fix: { ja: 決めたことを書きます。, en: Write what was decided. }
    levels: { strict: error, normal: warning, relaxed: info }
    use_for: [business]
    group: slips
    summary: { ja: 決めずに残した TBD, en: A TBD nobody resolved }
    example:
      ja: { before: 期限は TBD。, after: 期限は 5 月 1 日。 }
      en: { before: Due TBD., after: Due 1 May. }
    rewrite:
      depth: light
      en:
        direction: Replace TBD with the decision, or ask the writer.
        pairs: [{ before: Due TBD., after: "Due [date]." }]
        keep: [the rest of the sentence]
        avoid: [inventing a date]
```

| Field | What it does | Without it |
| --- | --- | --- |
| `levels` | A severity for `strict`, `normal` and `relaxed`; `normal` is required. Use it or `level`, not both. A team rule reports places, so a number is refused | `level`, else `warning` |
| `use_for` | The genres the rule is for, or their first part (`business`) | every genre |
| `group` | Where the rule is listed among chaff's groups (`slips`, `wording`, …) | `team` |
| `summary` | What the rule finds, in one line | the name |
| `example` | `{ before, after }`, or one pair per language | required, in either form |
| `rewrite` | What `chaff fix-plan` tells a rewriter, with its `depth` ([Making AI-sounding text sound human](./ai-sounding#setting-the-rewrite-depth)) | `how_to_fix` |

chaff's own rules, a team's rules and a plugin's rules are checked in one place, so all three get the same message for the same mistake.
A value chaff does not know (a `group` it has no group for, a `use_for` that names no genre, a depth that is not one) stops the run, and the message names the value.

## Adding a rule to chaff itself

A rule that helps any team can go into chaff itself.
chaff's own rule is that a rule decides by machine alone. Anything that needs the meaning to decide belongs to
`chaff test`. These are the files a new rule needs.

| What | Where | Contents |
| --- | --- | --- |
| The rule's definition | `packages/chaff/rules/<id>.yaml` | Name, reason, message, how to fix and levels, in Japanese and English. Also the reader's fields: `group`, `summary`, `example`, `not_flagged`, and `level_meaning` when its levels are numbers that change. A rule that rests on a paper or a standard lists it under `sources`, by its anchor in the [bibliography](./bibliography), and its page links there. A rule that flags spots people rewrite (signs of generated text, readability) also has `rewrite`: per language, a `direction`, two or three self-written before/after `pairs`, what to `keep`, and what to `avoid` (the mistakes a rewriter tends to make) |
| What finds it | `packages/chaff/src/detectors/` | A function that takes the document and returns findings. It is registered by a file of its own, `detectors/registry/<how_to_find>.ts`, that exports it as `detector`; no shared list of detectors is edited |
| Word lists | `packages/lang-ja/lexicons/` and `packages/lang-en/lexicons/` | Only for a rule that finds words from a list. One per language |
| Tests | `test/test_<id>.ts` | Examples it must report and examples it must not |
| A planted mistake | `test/fixtures/bench/plants/<id>.yaml` and a module in `scripts/bench-plants/` | One mistake put into a clean sample, to measure whether the rule finds it. The YAML file holds `planted: [ja, en]` (the languages it is planted in) or `not_planted:` with why none can be planted; the module exports `MUTATIONS`, the mistakes it plants. Neither is a shared list |
| ChangeLog | `Unreleased` in `docs/ChangeLog.md` | What chaff can now find |

A rule that compares the files of one run (a word spelled one way in one file and another way in the rest) has a detector of another kind.
It takes every document of the run and returns findings, each with the path of the file it is in (the type `CrossDetector`).
It is registered by `detectors/cross-registry/<how_to_find>.ts`, and its rule file says `requires: [documents]`.
chaff runs it only when it is given two or more files, or a folder; on one file it is listed among the rules that did not run, with that reason.
Each finding points at a line and column of its own file, so stet, the baseline and SARIF treat it like any other.
Its `example` adds `other:`, a third file checked in the same run as `before` and `after`.

Which genres a rule runs in is written in its own file too. `use_for` names the groups and genres it is for.
To turn it off for a genre that writes that way on purpose (legal drafting's "make a payment"), name the group or genre under `off_for`, with why.

```yaml
use_for: [business, legal, docs]
off_for:
  legal: 'Drafting writes "in the event that" and "for the purpose of" on purpose.'
```

A rule turned off this way is listed under "did not run" with the genre as the reason.
`genres.yaml` holds only what is about the genre itself (its name, summary, profile, how it is suggested, and the experimental rules it turns on); a new rule does not edit it.
`yarn rules:measure --apply` writes a group it measured the rule off for into `off_for` as `measured by yarn rules:measure`.

The guide's screens do not copy out what changes with every new rule.
A screen writes `{not-run}` where chaff lists the rules that did not run (the hint under the list comes with it), and `{counts}` where `--compact` ends with its tally.
To show one rule's line of such a list, write `{not-run: <rule>}`: chaff pads the list to its longest id, so a copied line changes with every new rule.
The site fills them all in from chaff's output when it is built.

`yarn test` runs every screen on its documents and stops when one differs from what chaff prints.
The documents are the page's `file=` blocks and the files in `site/src/screens/<lang>/<page>/`.
`node scripts/guide-screens.ts --check en/<page>.md` shows the difference.
When a new rule changes a guide screen, run `yarn screens:update` and read the diff.
It rewrites each screen to what chaff prints now, and keeps the `…` lines where they stand as far as it can.
Name pages to rewrite only those (`yarn screens:update en/commands.md`).
A screen listed in `UNCHECKED` in `scripts/guide-screens.ts` is not run, so it is left as it is.
When a screen gains a finding, also update what the page says about it.

`yarn test` stops when a rule file lacks a reader's field that the rule needs.
It also stops when an `example`'s `before` is not reported, or its `after` is.
That keeps the reference from showing an example that does not work.

Last, check the rule on real documents.

```bash
yarn test     run every test
yarn bench    measure whether the rules find the mistakes planted in the samples
yarn corpus   run on the collected real documents and compare with corpus/expected/
```

Read every new finding from `yarn corpus`. If one is wrong, add its shape to the tests as an example and fix it.
When the new findings are confirmed right, `yarn corpus --update` updates `corpus/expected/`.

It holds one file per rule (`<id>.txt`, a count per document) and the list of documents (`_documents.txt`).
A new rule adds its own file and changes no line that another rule's PR changes.
The samples work the same way: `yarn bench --update` updates `test/fixtures/bench/expected/`, one file per rule.
Each file holds the rule's row of the table and its planted mistakes' results, so a new rule adds its own file there too.
