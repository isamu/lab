# Adding a rule: for AI and engineers

This page shows how to turn a team's writing rules into something chaff can check.
You can hand it as it is to an AI or an engineer.
There are four ways, from the easiest to the most powerful.

## Four ways

| Way | When it fits | Where it goes | Available |
| --- | --- | --- | --- |
| Set an option on a built-in rule | A rule chaff has already covers it (a limit, a spelling, in-house words, required headings) | `chaff.yaml` | now |
| A words or regular-expression rule | A fixed phrase or pattern, flagged with the team's own message (no "our company" in external copy) | `custom_rules` in `chaff.yaml` | next release |
| A morphology rule | Writing decided by part of speech or inflection | `custom_rules` in `chaff.yaml` | next release |
| A Node function rule | Counting, comparing, anything the three above cannot say | a `.js` file | a later release |

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

```yaml
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

sample.md   technical/spec · 日本語   ジャンルはchaff.yamlから

  3:1     warning この文は 84 文字あります（80 文字まで）
                  max-sentence-length
  5:31    warning この文だけ他と文末の調子が違います（文書の中で 1 文）
                  no-mixed-desumasu
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

## Options on a rule (next release)

> Coming in the next release (#380). The shape may change.

Besides its level, a rule will take its own settings under `options`.
The first is `katakana-long-vowel`, which checks the final ー of katakana loanwords.
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

`npx chaffjs explain katakana-long-vowel` and `rules --json` list each option and the values it takes.

## A words or regular-expression rule (next release)

> Planned for the next release. The shape below is the plan and may change.

A rule that flags a fixed phrase or pattern with the team's own message, written under `custom_rules` in
`chaff.yaml`. `words` is a list of words, matched in any inflection; `pattern` is a regular expression.

```yaml
custom_rules:
  - id: no-our-company
    type: words
    words: [our company]
    message:
      en: Write "we" in external documents
  - id: date-with-slash
    type: pattern
    pattern: '\d{4}/\d{1,2}/\d{1,2}'
    message:
      en: Write dates as "1 October 2026"
```

Like a built-in rule, a team rule takes a level under `rules`, and `stet` silences one spot.

## A morphology rule (next release)

> Planned for the next release. The shape below is the plan and may change.

A rule that matches words by part of speech or by dictionary form.
"Is able to" for "can" takes one pattern per inflection when written as text ("was able to", "are able to").
As a sequence of analysed words it takes one.

```yaml
custom_rules:
  - id: able-to
    type: tokens
    tokens:
      - { lemma: be }
      - { surface: able }
      - { surface: to }
    message:
      en: Write "can" instead of "is able to"
```

How a sentence is split depends on the sentence. Check the rule on samples it must match and samples it must not.

## A Node function rule (a later release)

> `type: module` is reserved by name and does not run yet.

Counting, comparing, anything none of the above can say, is planned as a Node function.
It takes the document and returns a list of findings, the same shape as chaff's own detectors
(`packages/chaff/src/detectors/`).

```yaml
custom_rules:
  - id: max-list-items
    type: module
    module: ./chaff-rules/max-list-items.js
```

## Adding a rule to chaff itself

A rule that helps any team can go into chaff itself.
chaff's own rule is that a rule decides by machine alone. Anything that needs the meaning to decide belongs to
`chaff test`. These are the files a new rule needs.

| What | Where | Contents |
| --- | --- | --- |
| The rule's definition | `packages/chaff/rules/<id>.yaml` | Name, reason, message, how to fix and levels, in Japanese and English. Also the reader's fields: `group`, `summary`, `example`, `not_flagged`, and `level_meaning` when its levels are numbers that change |
| What finds it | `packages/chaff/src/detectors/` | A function that takes the document and returns findings, registered by name in `detectors/index.ts` |
| Word lists | `packages/lang-ja/lexicons/` and `packages/lang-en/lexicons/` | Only for a rule that finds words from a list. One per language |
| Tests | `test/test_<id>.ts` | Examples it must report and examples it must not |
| A planted mistake | `scripts/bench-mutations*.ts` and `test/fixtures/bench/plants.yaml` | One mistake put into a clean sample, to measure whether the rule finds it. When none can be planted, say why |
| ChangeLog | `Unreleased` in `docs/ChangeLog.md` | What chaff can now find |

`yarn test` stops when a rule file lacks a reader's field that the rule needs.
It also stops when an `example`'s `before` is not reported, or its `after` is.
That keeps the reference from showing an example that does not work.

Last, check the rule on real documents.

```bash
yarn test     run every test
yarn bench    measure whether the rules find the mistakes planted in the samples
yarn corpus   run on the collected real documents and compare with corpus/expected.txt
```

Read every new finding from `yarn corpus`. If one is wrong, add its shape to the tests as an example and fix it.
When the new findings are confirmed right, `yarn corpus --update` updates `corpus/expected.txt`.
The samples work the same way: `yarn bench --update` updates `test/fixtures/bench/expected.txt`.
