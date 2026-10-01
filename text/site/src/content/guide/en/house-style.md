# Define your team's writing rules

Every team has writing rules it wants kept: a journal's author guidelines, a company's style guide.
With chaff you write those rules in `chaff.yaml`, and a machine checks them. No code is needed.
The features on this page are in chaff 0.18.0 and later.

There are three ways to set them.

| What you want | Where | Example |
| --- | --- | --- |
| Use a well-known style as a whole | `style:` | IEICE's rules for papers in Japanese |
| Decide which way one rule goes | `options:` | Drop the final ー of katakana words |
| Add a rule of your own | `custom_rules:` | "email", not "e-mail" |

## Pick a style by name

Write a style's name under `style:`, and chaff's rules follow it.
For example, IEICE papers drop the final long-vowel mark ー from katakana words of three morae or more (コンピュータ, プリンタ).

```yaml
style: ieice
```

That is enough for chaff to point at such words that keep their ー:

```
  3:4     warning 「サーバー」は語末の「ー」を省いて「サーバ」と書きます（3 音以上の語）
                  katakana-long-vowel
```

The finding is in Japanese because the document is. There are five styles for now. A misspelt name stops chaff before it checks anything, and it lists the names.

| Name | What it decides | Source |
| --- | --- | --- |
| `ieice` | Drop the final ー from words of three morae or more | IEICE, submission guide for papers in Japanese, 2.4 |
| `jis-z8301-2011` | The same (the 2019 edition dropped this rule) | JIS Z 8301:2011, Table G.3 |
| `bunkacho` | Keep the final ー (コンピューター) | 外来語の表記, the 1991 Cabinet notice |
| `jis-z8301-2019` | No すべきである and no closing できる in a provision | JIS Z 8301:2019, 7.3 to 7.5 |
| `koyobun` | A Japanese sentence of at most 60 characters, no mixing of です・ます with である, and the final ー kept | 公用文作成の考え方 (Council for Cultural Affairs, 2022), III-3 a, III-1 b, I-3 d |

Morae are counted as コ・ン・ピュ・ー・タ・ー. A small ャ, ュ or ョ joins the kana before it.
Every one of these styles keeps the ー on two-mora words such as カー and キー.

A plugin can ship styles too. A style from a plugin listed under `plugins:` is chosen with the plugin's name in front
(`style: example/careful`). [Writing a plugin](./writing-plugins) shows how to make one.

## Decide which way one rule goes

You can also decide one rule's direction without a style.
Under `options:`, write the rule's name and what to decide.

```yaml
rules:
  katakana-long-vowel: normal
options:
  katakana-long-vowel:
    ending: drop      # or keep
    min_morae: 3      # the shortest word checked
    except: [カー]     # words left alone
```

Without `ending`, chaff takes no side.
It only points at a word written both ways in one document (サーバー and サーバ).

`chaff.yaml`'s own settings are the strongest, then the style's, then the genre's defaults.
`explain` shows where each value came from.

```bash
npx chaffjs explain katakana-long-vowel     this rule's settings, and where each came from
```

```
  Options (set under options in chaff.yaml):
    ending: drop   (from style: ieice)
      Which way the final ー goes
        consistent No side taken; only checks that the document is consistent
      → drop       Drop the final ー on words of min_morae morae or more (IEICE; JIS Z 8301 up to 2011)
```

## Add a rule of your own

List your team's rules under `custom_rules:`. There are three kinds.

| `type:` | What it finds | Good for |
| --- | --- | --- |
| `words` | Words you listed | "email", not "e-mail" |
| `pattern` | Matches of a regular expression | No "TBD" left in a document |
| `tokens` | A run of parts of speech and base forms | "make a decision" can be "decide" |

Every rule has a name, a reason, a way to fix it and an example.
Whoever reads a finding should understand why to change it.

```yaml
custom_rules:
  - id: team-email
    type: words
    words:
      e-mail: email
      log-in: log in
    name: The team's spelling
    why: Our style guide spells these one way, so a search finds every mention.
    how_to_fix: Change it to "{preferred}".
    example:
      before: Send the log-in details by e-mail.
      after: Send the log in details by email.

  - id: team-tbd
    type: pattern
    pattern: '\b(TBD|TODO)\b'
    level: error
    name: Something is still undecided
    why: A document sent with TBD in it reads as if the thing were decided.
    how_to_fix: Write who decides it and by when.
    example:
      before: The launch date is TBD.
      after: The launch date is 1 October (Sam confirms it by 20 September).

  - id: team-make-decision
    type: tokens
    tokens:
      - base: make
      - pos: DET
      - surface: decision
    level: info
    name: A verb hidden in a noun
    message: '"{matched}" can be "decide"'
    why: "\"Make a decision\" says in three words what \"decide\" says in one."
    how_to_fix: Use the verb.
    example:
      before: We will make a decision on Friday.
      after: We will decide on Friday.
```

`level` is how serious a finding is: `error`, `warning` or `info`. Without it, a rule's findings are warnings.
A `tokens` rule reads the words' base forms, so "made a decision" matches "make a decision".

Save this plan as `plan.md` and check it.

```markdown
# Launch plan

We made a decision to move the launch. The new date is TBD.

Send questions by e-mail.
```

```bash
npx chaffjs plan.md --compact     each finding on two lines
```

```
plan.md   blog/tech · English   genre from the default

  3:4     info    "made a decision" can be "decide"
                  team-make-decision
  3:56    error   Something is still undecided: "TBD"
                  team-tbd
  5:19    warning Write "email", not "e-mail"
                  team-email

3 findings, 40 rules not run
```

chaff treats your rules like its own. `explain` shows the reason and the example you wrote.

```bash
npx chaffjs explain team-tbd     what the team's rule is for, with its example
```

```
  Something is still undecided   (team-tbd)

  A document sent with TBD in it reads as if the thing were decided.

  How to fix: Write who decides it and by when.

  Example:  The launch date is TBD.
      →  The launch date is 1 October (Sam confirms it by 20 September).

  The team defined this rule under custom_rules in chaff.yaml.
```

`npx chaffjs relax team-tbd` makes its findings one step lighter.
`<!-- stet: team-tbd — reason -->` silences it in one place.

## When a rule is written wrong

If a rule is missing something, chaff stops before it reads any document and says what is missing.
A rule that silently did not run would make a document look clean.

```
chaff: …/chaff.yaml: custom_rules team-tbd: example.before is missing
chaff: …/chaff.yaml: custom_rules team-tbd: example.after is missing
```

The path is shortened here.

Regular expressions are checked before they run. A repeat inside a repeat, such as `(a+)+`, is refused, since on a long line it may never finish.
So are more than three `*` or `+`, and backreferences (`\1`).
A pattern that still takes over a second on one document is stopped, and the rule is listed as not run, with the reason.

## Parts of speech

Under `tokens`, `pos` takes everyday names (noun, verb, adjective, adverb, preposition, determiner) or the tags themselves (`NOUN`, `VERB`, `DET`).
For Japanese documents it also takes 名詞, 動詞, 助詞 and the like.
`base` is the base form (make), and `surface` is the word as written (decision). One token may have any of the three.

Rules written as a Node function (`type: module`) are not supported yet. chaff stops and says so.
