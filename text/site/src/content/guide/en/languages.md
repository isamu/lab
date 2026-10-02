# Languages

chaff checks Japanese and English writing. The language is worked out per file, so there is nothing to set.
A repository that mixes Japanese and English documents gets each one checked in its own language.

## Checking which language was chosen

The first line of the screen shows the language chosen for each file.
On `notes.md`, written in English:

```
$ npx chaffjs notes.md --compact

notes.md   blog/tech · English   genre from the default


0 findings, 69 rules not run
```

A Japanese file says 日本語 in the same place, and its screen is in Japanese:

```
$ npx chaffjs memo.md --compact

memo.md   blog/tech · 日本語   ジャンルは既定から


指摘 0 件、動いていない rule 66 件
```

When the language is wrong, fix it with `language: ja` or `language: en` in `chaff.yaml` ([Configuration](./configuration)).

The language is worked out from the body text. A list under a "References" or 「参考文献」 heading is not counted,
because a reference list is written in the language of the works it cites. A Japanese paper that cites many English
works is still read as Japanese.

## The language of the screen

The findings are shown in the document's language: Japanese for a Japanese document, English for any other.
When several files are checked, the closing line uses their language if they share one, and the rule below if they do not.
`chaff eval` reports in the language of the documents it measured, and does not measure documents of mixed languages together.

`chaff test` works the same way. The headings of the machine and AI checks are in the document's language, and so are
the AI's findings and the `--dry-run` preview. The closing lines (the totals, the notice when it could not run, the
note about the key) use the shared language. When the files differ, they follow the rule below.

Some output is tied to no document: `--help`, `genres`, `init`, `explain`, `relax`, `rules --json`, warnings about
the settings and so on. It uses `language` in `chaff.yaml`, then the terminal's locale (`LC_ALL`, `LC_MESSAGES`,
`LANG`), then English. Where the locale is `C`, as on CI, write `language: ja` in `chaff.yaml` to get Japanese.
The numbers in `explain` and `rules --json` are counted the way that language counts (characters for Japanese, words
for English).

## Documents that mix Japanese and English

One document can hold both languages, such as a Japanese paper with an English abstract.
In a Japanese document, an English paragraph is split into sentences at English full stops (. ? !).
Each English sentence is counted in words and compared with the English limit of `max-sentence-length`.
In an English document, a Japanese sentence is counted in characters and compared with the Japanese limit.

Other rules run in the document's language only, so the English-only rules do not check English sentences in a Japanese document.
To check them too, put the English part in a file of its own.

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
| `stray-space` | A space inside a phrase (「こころさんが 払った」, 「確認 しました」) |

`stray-space` also accepts spacing every phrase (分かち書き) as a way of writing.
It points at the spaces only when the document spaces less often than it does not.
The rule is experimental, so turn it on in `chaff.yaml`.

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
| `agreement-slip` | A determiner and a noun that differ in number ("a significant changes"), or "Your can" for "You can" |

The rules ending in `-consistency` do not decide which style is right.
They only check that one document is consistent, and point at the less common style.

`agreement-slip` reads parts of speech. It is experimental, so turn it on in `chaff.yaml`.

## Language packages

How each language ends its sentences, and its word lists, live in a language package.
Japanese is `@chaffjs/lang-ja`, English is `@chaffjs/lang-en`.

| Package | What it holds |
| --- | --- |
| `@chaffjs/lang-ja` | Where sentences end (`。！？`, `．` after a word, and ASCII `!?`), and the word lists |
| `@chaffjs/lang-en` | Where sentences end, and the word lists |

Both ship with chaff, so there is nothing to install separately.
`npx chaffjs` alone checks Japanese and English.

## Adding another language

For a language that does not ship with chaff, chaff looks for a package named `@chaffjs/lang-<language>`,
and if there is none, `chaff-lang-<language>`.
Official packages use the first name; anyone else can publish the second.
A package under any other name is not loaded, even if installed.
