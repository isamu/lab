# Languages

chaff checks Japanese and English writing. The language is worked out per file, so there is nothing to set.
A repository that mixes Japanese and English documents gets each one checked in its own language.

## Checking which language was chosen

The first line of the screen shows the language chosen for each file.
On `notes.md`, written in English:

```
$ npx chaffjs notes.md --compact

notes.md   blog/tech · English   genre from the default


0 findings, 37 rules not run
```

A Japanese file says 日本語 in the same place, and its screen is in Japanese:

```
$ npx chaffjs memo.md --compact

memo.md   blog/tech · 日本語   ジャンルは既定から


指摘 0 件、動いていない rule 34 件
```

When the language is wrong, fix it with `language: ja` or `language: en` in `chaff.yaml` ([Configuration](./configuration)).

## Rules that work in any language

The rules on sentence length, repeated headings and the like are the same in Japanese and English.
Sentence length is counted in characters in Japanese and in words in English.

`agentless-passive`, which finds a passive that never says who did it, reads parts of speech and works in both languages.

The rule on intensifiers that stress without saying what matters is shared too.
There is one detector, and only the word lists are per language.
Adding a language takes more than a word list, though: it needs a language package that knows how sentences end (see "Adding another language" below).

## Japanese-only rules

Some Japanese-only rules read parts of speech and some do not.
The part-of-speech dictionary ships with chaff, so there is nothing to download or set up.

These read parts of speech:

| Rule | What it looks at |
| --- | --- |
| `no-mixed-desumasu` | です・ます mixed with だ・である |
| `no-doubled-joshi` | Chains of 「の」, as in 「弊社の新製品の販売の計画」 |
| `taigen-dome-in-prose` | Runs of sentences that end on a noun, in running text |

Loading the dictionary takes about two seconds, and it is skipped when none of these rules runs.
For a language without part-of-speech tagging, such a rule does not pass silently.
It is listed as not run, with the reason "part-of-speech tagging is not available for this language".

These do not:

| Rule | What it looks at |
| --- | --- |
| `double-keigo` | Double honorifics (おっしゃられました) |
| `sasete-itadaku` | 「させていただく」 piled up |
| `hiragana-fukushi` | Adverbs written in uncommon kanji (殆ど・勿論) |
| `max-kanji-continuous` | Long runs of kanji (情報処理推進機構認定試験) |
| `no-nakaguro-parallel` | Many 「・」 lists in one sentence |
| `latin-spacing` | Mixing a space and no space between Japanese and Latin letters or digits |

`latin-spacing` accepts both styles.
When one document mixes them, it points at the less common one.
The rule is experimental, so turn it on in `chaff.yaml`.

## English-only rules

| Rule | What it looks at |
| --- | --- |
| `adverb-overuse` | How dense -ly adverbs are |
| `expletive-construction` | There is / It is ... that |
| `sentence-initial-conjunction-run` | Runs of sentences starting with And / But / So |
| `title-case-consistency` | Whether headings are capitalised the same way throughout |
| `oxford-comma-consistency` | Whether lists use the serial comma the same way throughout |
| `contraction-consistency` | Whether contractions are used the same way throughout |

The rules ending in `-consistency` do not decide which style is right.
They only check that one document is consistent, and point at the less common style.

## Language packages

How each language ends its sentences, and its word lists, live in a language package.
Japanese is `@chaffjs/lang-ja`, English is `@chaffjs/lang-en`.

| Package | What it holds |
| --- | --- |
| `@chaffjs/lang-ja` | Where sentences end (`。！？` and ASCII `!?`), and the word lists |
| `@chaffjs/lang-en` | Where sentences end, and the word lists |

Both ship with chaff, so there is nothing to install separately.
`npx chaffjs` alone checks Japanese and English.

## Adding another language

For a language that does not ship with chaff, chaff looks for a package named `@chaffjs/lang-<language>`,
and if there is none, `chaff-lang-<language>`.
Official packages use the first name; anyone else can publish the second.
A package under any other name is not loaded, even if installed.
