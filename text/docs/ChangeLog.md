# chaff ChangeLog

Newest first.

## Unreleased

### The weekly corpus run reports dead sources and upstream changes (#170)

The weekly workflow now refetches every document kept as a URL, not only the ones that may not be redistributed. A
committed document is fetched into a temporary directory and compared with the committed copy, which is never
rewritten; a difference is reported as "source changed upstream". A fetch that times out or gets a 5xx or 429 is
retried with backoff; one that still fails, or gets a 404, is reported with its error instead of being skipped with a
warning. Any of these, or a drifted result, fails the run and opens or comments on one issue. `yarn corpus:health` runs
the same check locally.

### English: a curly apostrophe is read like a straight one (#170)

The English tagger split a contraction written with a curly apostrophe: `that’s` became `that` / `’` / `s`, with `s`
read as a noun, while `that's` was read correctly. Published text (GOV.UK, 18F, anything from a word processor) uses
the curly form, so every rule that reads parts of speech saw a broken sentence: `oxford-comma-consistency` reported a
list that was not there, `agentless-passive` and `expletive-construction` missed `It’s written` and `There’s`, and the
stray pieces counted as words in `adverb-overuse` and `proper-noun-density`. A `’` between a letter or digit and a
letter (`don’t`, `team’s`, `1990’s`) and every `ʼ` (U+02BC) are now read as `'`. A `’` with no letter after it stays a
closing quote (`‘like this’`), so a plural possessive (`the users’ files`) is still read as a quote. Spans still point
at the source as written; a word's surface is the straight form, so a lexicon entry such as `in today's fast-paced
world` (`padded-intro`) also matches `In today’s fast-paced world`. `contraction-consistency` compares the text itself
and does not yet treat `don’t` as `don't`.

### 「前契約の第9条」 is another document's article, the same as 「前契約第9条」 (#153)

`dangling-reference` reported 「乙は、前契約の第9条に従う。」 because the article was looked up in this document: a
document name was recognised only when it touched the article number. A name joined to the reference by 「の」 now names
the document too (原契約の第8条, 旧規程の第3条, 同契約の第7条, 個人情報の保護に関する法律の第3条), and a chapter or a
following 「及び第10条」 goes with it. The particle is data, in the new `name-joiner` lexicon; the name must still end
with a word from `document-kind`.

A name that starts with 本, 当 or この (本契約の第9条, この契約の第9条, この法律の第9条) or is a kind word alone
(契約の第9条) still points into this document and is still reported when the article is missing. この is new in
`self-prefix`, so 「この法律第9条」 without 「の」 is now read as this document's article too.

### `oxford-comma-consistency` reads fewer non-lists as lists (#170)

A participle phrase, an appositive and a coordination inside one item of a list were read as a list of three:
"It comes from Latin, meaning ship or boat", "He was found guilty by the judge, sitting without a jury, and
sentenced", "two HPV types, HPV16 and HPV18, that account", "prohibition of unreasonable searches and seizures, and
the Eighth's ban". Now:

- An item that opens with a participle starts a participle phrase, not a list item, unless the first item holds the
  same kind of participle or the other items open with verbs. A list inside the phrase is still judged
  ("programs, including the grants office, the help desk and the travel team"). Words the tagger reads as nouns but
  that open such a phrase ("meaning") are in the new lang-en lexicon `participle-word`.
- "Noun, X and Y," with no comma before "and" and no verb in X or Y is an appositive. A real list of three in the
  same shape is left unjudged; with a comma before "and" it is still a list.
- An "and" followed by ", and" (or ", or") and an item of the same shape joins words inside one item; followed by
  a clause ("apples, pears and plums, and went home") it still ends the list. A list closed by "and" is not continued
  by the items after it.

English -ing verbs now carry `VerbForm=Ger`, so a present participle is told apart from a past one.

### `title-case-consistency` does not count acronyms as Title Case (#170)

A word in capitals ("PR", "FCPs") is capitalised in either style, so it is no longer evidence of Title Case.
"Opening a PR" and "Proposed FCPs" are left unjudged; "Using the API Client" is still Title Case.

### The corpus HTML converter reads a table of sentences (#170)

A glossary, a list of infection routes or a report's footnotes written as an HTML table disappeared from the stored
text, because every table was dropped. A table where at least half of the rows end a sentence in some cell is now
read: each cell becomes a paragraph of its own (like a term and its definition in a `<dl>`), the caption comes
first, a row of nothing but header cells goes, and a cell that starts with a number and ends no sentence (a row
number, a range of figures) goes. Any other table (figures, dates, names) is dropped as before; a point inside a
cell ("H.Con.Res. 218") is not a sentence's end. Documents fetched from HTML change when they are fetched again.

### The corpus HTML converter keeps U+3000 and drops text written for a screen reader (#170)

The converter behind `yarn corpus:fetch` collapsed every run of whitespace, U+3000 included, so 「2　学士」 was stored
as 「2 学士」 and a clause number lost the full-width space that marks it. Only markup's own spacing collapses now.
It also drops text that a sighted reader never sees: an element whose class follows a screen-reader convention
(`sr-only`, `visually-hidden`, `govuk-visually-hidden`, `screen-reader-text`, or exactly `hidden`), unless a variant
such as `md:block` shows it on some screens, and a skip link's target (an anchor with no `href` and `tabindex="-1"`
alone on its line, such as 「ここから本文です。」). A block of nothing but links to other pages that closes the page (「一覧に戻る」) is dropped
like the menus above the title (a link to a file, such as an appendix in PDF, stays), so a site's trailing `## 新着記事` no longer follows a speech as its only heading. Documents fetched
from HTML change when they are fetched again.

A heading numbered like a statute's paragraph (`## 4　適用除外`) is now read as a chapter number, never as a
paragraph of an open article, so `numbering-gap` no longer reports a guideline's chapters as gaps in a paragraph list.

### `names:` in chaff.yaml: the team lists its own names (#170)

`max-kanji-continuous` reported official names such as 個人情報保護委員会 and 国土交通省鉄道局総務課, and the dictionary
cannot say they are names: it splits them into common nouns (厚生 + 労働省). A team now lists its own names under `names:`
in chaff.yaml, as it lists its jargon. A listed name matches as written and is read as one name:

- `max-kanji-continuous` does not count it; kanji before or after it are measured as separate runs, so
  「個人情報保護委員会事務局総務課長補佐」 still reports 「事務局総務課長補佐」;
- `ngram-repetition` does not count a phrase that touches it;
- `undefined-acronym` does not ask to expand it, or an acronym inside it (`NTT` in `NTT Docomo`);
- `proper-noun-density` counts it as one proper noun however many words it splits into.

`names` must be a list of names (a number such as `2025` is read as text); any other value, or an entry that is not a
name, is skipped with a message in both languages. A name wrapped across a line in the source still matches. `chaff init` shows the key, commented out. chaff ships no names of its own.

`max-kanji-continuous` also leaves out a run of kanji that fills a 「」 or 『』 quotation exactly
(「英国大使館別荘記念公園」), even without `names`: the brackets mark it as one quoted name, the same trade-off
`latin-spacing` and `no-doubled-joshi` make for quotations. A quotation that also holds kana is measured as before.

### doubled-word does not count a Japanese verb or adjective repeated in its continuative or imperative form (#170)

Fiction, plays and poems repeat a word to press it: 「流せ流せ」「待て待て」「死ね死ね」「長く長く」. The analyser
splits these into two identical verbs or adjectives, and doubled-word reported them as a word written twice. An
independent verb or adjective repeated in a form that does not end the sentence (continuative 連用形 or imperative
命令形) is now read as reduplication. Still reported: a repeated terminal form, a non-independent word
(「くださいください」), a one-character word (「確認ししました」), and a repeat followed by an ending
(「確認できできます」), which is a stem written twice.

### doubled-word does not count Japanese mimetics, 畳語 written without 々, or 「売り売りて」 (#170)

The analyser splits a kana mimetic it does not know into whatever words match its sounds (すうすう → 吸う + 吸う,
しだいしだい → two suffixes, たんたらたら → a noun and two auxiliaries), and a 畳語 written without 々 (家家, 朝朝)
into two nouns; doubled-word reported them as a word written twice. Now read as reduplication:

- a whole hiragana word repeated where an adverb stands, before と or に or at a line end
  (「きしきしと」「ちょんちょんと」「すうすうと」「しだいしだいに」「あはれあはれ」); a verb read there counts only
  with a two-mora root, the shape of a mimetic (すう);
- two identical auxiliaries with no predicate before them that read together as one adverb (「たんたらたら」);
- a one-kanji noun doubled, when the kanji takes 々: the analyser's dictionary reads 家々 as one word, and the new
  `iteration-kanji` word list holds those it does not know (朝々, 神々);
- a 五段 verb's continuative repeated before て (「売り売りて」「行き行きて」); 「日毎日毎」 joins 「毎日毎日」 in the
  doubled-word word list.

Still reported: particles and auxiliaries after a predicate (「のの」「をを」「着いたらたら」), a suffix attached to a
noun (「田中さんさん」), a kana word that does not stand as an adverb (「まとめまとめを」「まとめまとめ、」), a
katakana word (「ユーザーユーザー」), a longer kana verb (「できるできると」), a one-kanji noun that has no
々 form (「法法の」, and 「金金と」, which only emphasis tells from a slip), a doubled two-kanji noun (「確認確認」), and
「くださいください」 and 「できできて」.

### A tenth round of corpus kinds: fiction, essays, poetry and plays in Japanese and English, and more (#170)

The corpus adds, committed as public domain: 夏目漱石「夢十夜」, 寺田寅彦「天災と国防」, 石川啄木「一握の砂」 and
岸田國士「紙風船」 from 青空文庫, and Gilman's The Yellow Wallpaper, Thoreau's Civil Disobedience, Frost's A Boy's
Will and Wilde's The Importance of Being Earnest from Project Gutenberg. URL only: a J-STAGE abstract page, a
Japanese Wikipedia talk page, the minutes of a 厚生労働省 council, 東京大学学位規則, and a MyPlate recipe. A Project
Gutenberg eBook (format `gutenberg`) is stored as the work alone, without Project Gutenberg's header and licence.

### Japanese `agentless-passive` leaves descriptive and legal passives alone (#290)

The rule is about a passive that hides who is responsible (「二次被害は確認されていません」「〜が検討されています」). On
the corpus's business documents most of its findings were passives where no one is hiding: a rule's scope
(「次の各号が適用される」「法令上定められていない」), what a document says (「ガイドラインに記載されている」「図に示されて
いる」), a classification (「3 つに分類されている」). These are no longer reported:

- `stative-passive-verb` in `@chaffjs/lang-ja` now holds rule, document-content and state verbs (適用, 規定, 定める,
  分類, 構成, 位置付ける, 記載, 示す, 言及 …). A サ変 noun is matched before する. An event in the past
  (「割引が適用されました」「新しい規程が定められた」) is still reported. 求める and 認める are left out:
  「一定の協力が求められます」 hides that the writer's organisation is the one asking, and 「不正アクセスは認められて
  いません」 hides who looked.
- A passive in a conditional clause (「立証されれば」「整理されていると、」) or followed by a tendency word
  (「理解されやすい」「解釈され得る」) is not reported. 「見直されなければなりません」 is an obligation and still is.
- A れる attached directly to an ichidan verb (a ら抜き form, or a typo the parser read as passive) and an ichidan
  られる followed directly by ない or ず (「他人は変えられない」, a potential) are not passives.

The rule stays experimental: most of what remains on business documents is a generic action (「使用されます」「行われ
ます」) that morphology cannot tell from a hidden actor.

### `sasete-itadaku` lets the number of uses its message allows pass (#170)

The message says 「3 回あります（3 回まで）」: three uses are allowed. The rule nevertheless reported a document with
exactly three, so it spoke at the limit its own message allows. It now reports only when a document uses the form
more often than the limit; at `strict` one use passes, as the rule's reason (once is polite) says. A numeric setting
such as `sasete-itadaku: 3` now means three are allowed, as it does for the other rules whose message states a limit.

Every other rule whose message states its limit already agreed: a value equal to an upper limit ("N まで", "limit N",
"N% allowed") passes, and so does a value equal to a lower limit ("N% 以上ほしい", "want N%"). A new test holds this
for every such rule in both languages.

### `excessive-hedging` reports hedges stacked in one sentence (#290)

The rule measured only hedges per 1000 characters and skipped documents under 500 characters, so a short report
with 「〜という状況であると考えられます」 got nothing, and on the corpus it had never fired. It now also reports a
sentence that stacks two or more hedging devices in one clause (「〜という状況であると考えられます」「〜かもしれないと思われます」
「〜かと思われる可能性があります」, "may possibly", "it could perhaps be argued"), on a document of any length. At least one device
must be a hedge; the others may be words that soften without hedging on their own, from the new lexicons `hedge-frame`
(「という状況だ」「かと」, may, might, could). Hedges that say where a claim holds rather than how sure the writer is
(`hedge-scope`: 「場合がある」, "in some cases") never stack. Punctuation and a conjunction such as "and" end a clause, and a
hedge in a quotation is the speaker's. A sentence reported this way is not reported again by the density check. The
Japanese hedges are matched by their base form, so 「と思われる」 also finds 「と思われます」 and 「と思われた」; English gains
"perhaps", "possibly", "presumably", "conceivably", "apparently" and "seemingly". A rule can now give a message per way
of finding (`messages`, chosen by a finding's `variant`), and the rule reference shows both.

`excessive-hedging` stays experimental. On the corpus the stacked check fires seven times, and each finding was read and
judged right; on `examples/` it fires never. Seven findings, one of them Japanese, are too few to show a false-positive
rate under 5%, and promoting the rule would also turn on its density check, which still has not fired on a real
document. Pass `--experimental` to run it.

### A paragraph written one per line is counted line by line (#170)

Text that puts each paragraph on one line with no blank line between them (青空文庫 texts, minutes, HTML that breaks
lines with `<br>`) was read as one huge paragraph, so `max-paragraph-length` reported a whole essay or a whole set of
minutes as a single paragraph. Such a paragraph is now split at the line breaks where a sentence ends, and each part
is counted as a paragraph. Sentences are not changed: a sentence that runs over a line break stays whole, and a
speaker's name on its own line stays with what they said.

Only a paragraph of that shape is split. At least half of its lines must end a sentence, so a paragraph wrapped at a
fixed width stays whole. Several lines must each hold two or more whole sentences, so a paragraph written one sentence
per line (a common Markdown style, in English above all) stays whole and is still reported when it is long. The rules
that count paragraphs (`paragraph-length-variance`, `preamble-length`) see the same parts.

### `unqualified-superlative` leaves an English amount or a restricted superlative alone (#170)

"The most" followed directly by a noun names an amount, not a boast: "the most work", "the most students", "for the
most part". A superlative that a clause or a word after it restricts already says what it is the most of: "the best we
have measured", "the threats that we have seen", "the most scalable option discussed", "the best possible outcome",
"the most restrained manner possible". None of these is reported any more.

"The most powerful tool", "the best solution on the market" and "the best solution ever" are still reported. The
words come from four new English lists: `superlative-amount`, `relative-word`, `subject-pronoun` and
`superlative-bound`. Japanese has none of them, and its findings are unchanged.

### `latin-spacing` leaves dates and clock times out of the count (#290)

「9月」「8月」 were counted as digits packed against the next Japanese character, so a report that spaced its counts
(「412 件」「6.2 時間」) was told its month names were the odd ones out. A date or a time written with units is packed by
convention, so the inside of one no longer counts for or against either habit: the space between a number and its
unit, and between one unit and the next number (「2026年9月30日」「10時5分」, also when written 「2026 年 9 月」). What
makes a date is read from the words after the number, with three lexicons in `@chaffjs/lang-ja`: `calendar-unit`
(月, 時, 時半: the number names a month or an hour on its own), `calendar-year-unit` (年, 年度, after a number of four
digits) and the existing `date-time-unit`, now in order from the largest unit, which joins 日, 分 and 秒 to a date when
they follow a larger unit (「10月1日」「15時30分」). A length stays a count: 「3ヶ月」「3 時間」「3日間」 are other words,
and 「5日で」「5分」「3年」「5分30秒」 standing alone cannot be told from a length, so they count as before. The space
before a date (「は 9月」) is the writer's habit before any number and still counts. A year after an era name
(「令和8年」 on its own) still counts.

### A report or a proposal is checked for a padded opening and an empty closing (#290)

`--genre business/report` checked less than naming no genre at all. `padded-intro` (「近年、」, "in today's fast-paced
world") ran only on blog posts, so a report that opened with filler was reported under the default `blog/tech` and not
once it was called a report. `padded-intro` now runs on `business/report` and `business/proposal` too, and
`empty-conclusion` (a closing that only restates the body) is listed for `chaff test` there. Press releases, e-mails and
meeting notes are left out: their first lines give a reason or the business at hand (a fee notice's 「昨今の人件費の上昇のため」
was the only place the rule fired on a business document in the corpus), and their last lines are greetings.

`agentless-passive` and `excessive-hedging` stay experimental. On the corpus's business documents `agentless-passive` is
mostly wrong (descriptive, legal and relative-clause passives such as 「適用される」「分類されています」, "is assigned"), and
`excessive-hedging` has never fired on a real document, which is not yet evidence that it is right. Pass
`--experimental` to run them.

### English messages agree with their counts (#170)

An English message said "(1 such words)", "appears 1 times" or "1 of 1 sections" when the count was one. A rule's
message can now choose a form by a value. `{count|word|words}` gives "word" for exactly one and "words" for anything
else. So `{count} such {count|word|words}` reads "1 such word" and "2 such words". A verb agrees the same way
(`{count|has|have}`).

Every English rule message that carries a count uses it. The rule reference on the site shows each form as its
plural. The command line agrees too: `--watch` says "2 → 1 finding". A contract whose numbering could not be read says
"only 1 was read as a numbered line". Japanese messages are unchanged.

### `concrete-evidence-density` leaves the entries of a glossary alone (#170)

A glossary or an A to Z style guide was reported entry by entry, because a definition carries no number, code or link.
Entries are now recognised by structure: headings of a single letter (`## A`, `## B`, `## あ`, `## い`) with nothing under
them but deeper headings, two or more of them in a row and in the order of their letters, divide an index when most of
the headings right under them start with their letter (case, accents and voicing marks aside, katakana read as
hiragana). Every section under such a divider is an entry, and entries are neither reported nor counted in the section
total. The rest of the document (the introduction, "how to suggest a change") is checked as before, and so are FAQs,
sections headed by a single word or phrase, and sections merely grouped under `## A` / `## B`. An index divided by `あ行`,
or whose entries sit at the same heading level as the letters, is not recognised.

### A document profile chaff does not bundle stops the run instead of turning profiles off (#170)

A `profile` in `chaff.yaml`, or in one of its `by_path` entries, that names no bundled profile (`profile: statue`)
chose nothing and also stopped the profile from being chosen from the content, so it acted as `none` without a word:
a statute lost its addresses and article captions. It now stops before checking anything, and says where the profile
was written and which profiles there are, `none` included. Profiles come only from the bundled `profiles/*.yaml`, so
there is nothing else a name could mean. The commands that read no document (`genres`, `init`, `rules`, `explain`,
`relax`, `strict`, `off`, `skill`) still run with such a `chaff.yaml`.

### `chaff test` speaks English to English documents (#170)

`chaff test` printed its screens in Japanese whatever the document, `chaff.yaml` or the terminal said: the banners over
the machine and AI findings, the AI findings themselves, the `--dry-run` plan and its total, the notice when the checks
that read meaning could not run, the hint on setting a key, and the closing tally. Each file's banners, findings and
plan now follow that file's language. The closing lines (the total, the notice, the key hint and the tally) follow the
files' language when they share one and otherwise `chaff.yaml`'s `language`, then the terminal's locale, as lint's
closing line does. "No Markdown found" follows `chaff.yaml`'s `language`, then the locale. The Japanese text is
unchanged.

### The corpus's converters decode every HTML character reference name and read an attribute value that holds markup (#170)

A named character reference outside the converters' short list stayed in the text as written: `Vissing-J&oslash;rgensen`
in the FOMC minutes, `records&thinsp;[1]` in a Federal Register notice, `2,088人&divide;814,793` in a MHLW Q&A. The
HTML and wikitext converters now decode every name of the HTML standard (the `character-entities` table, already in
the workspace under the Markdown parser and now a root dev dependency), matched as written: `&Oslash;` is Ø and
`&oslash;` is ø, a name with digits (`&frac12;`) is read, and a name that is not in the table (`&NBSP;`,
`&constructor;`) stays as written. A named space (`&nbsp;`, `&thinsp;`, `&ensp;`) is a plain space, as `&nbsp;`
already was; a numeric one (`&#160;`) keeps its character.

An attribute value holding markup, such as GOV.UK's history banner
(`title="This was published under the <span lang=&quot;en&quot;>…</span>"`), ended its tag at the first `>` inside
the value and left a stray `…government">` line. Before anything else reads the page, the HTML converter now writes
each `<` and `>` inside a quoted attribute value as a character reference, which means the same in a value, so every
tag scanner reads the whole tag. A quote opens a value only after `=`; a comment, a script and a style are not read as
tags, and a `<!--` inside a value no longer opens a comment. Converted again, the corpus's pages change only where such a reference stood.

## 0.15.0 — 2026-09-30

chaff reads more kinds of text without stumbling. A file with Windows or classic Mac line breaks, a byte order mark, an
emoji after a number or one very long line is read as the writer sees it, and a genre chaff does not know stops the run
instead of checking nothing. `chaff eval` speaks the documents' language, and English no longer counts a sentence's first word as a name. Many false reports found on real documents are
gone: `undefined-acronym` leaves domain names, date placeholders, name numerals, HTTP methods and document numbers alone;
`agentless-passive` knows Japanese honorific れる/られる and 「〜と呼ばれる」; `latin-spacing` and `heading-echo` skip
quotations; `date-order` stays silent on a list sorted by name; a reference wrapped across lines, or to a hyphenated tag
the document lists, names the other document. The corpus gains more rounds of kinds — parliamentary minutes,
regulations, patents, court decisions, specifications, style guides, glossaries, a speech and more — and `yarn bench`
plants mistakes for more rules.

📦 [`chaffjs@0.15.0`](https://www.npmjs.com/package/chaffjs/v/0.15.0) ·
[`@chaffjs/lang-ja@0.14.0`](https://www.npmjs.com/package/@chaffjs/lang-ja/v/0.14.0) ·
[`@chaffjs/lang-en@0.13.0`](https://www.npmjs.com/package/@chaffjs/lang-en/v/0.13.0)

### A word capitalised only because it starts the sentence is no longer counted as a proper noun in English (#170)

The English tagger marks every capitalised noun and adjective as a proper noun, so the first word of a sentence
(`Containers start in seconds.`, `Traditional servers were slow.`, `Use the scheduler.`) was counted as a name, and
`proper-noun-density` reported handbooks and guides whose names were few. `@chaffjs/lang-en` now reads the first word
of a sentence again in lower case when it is written with one leading capital, the tagger tagged it as a proper noun,
and the tagger's own vocabulary knows the lower-case word and never as a name. It takes the part of speech the tagger
gives the lower-case word in the same sentence. A word the vocabulary does not know (`Kubernetes`, `Congress`), a word
it also knows as a name (`May`), a word in capitals (`API`) and a capitalised word inside a sentence stay proper nouns.
In the corpus this only moves `proper-noun-density`: its density falls on most English documents and the finding goes
away where common words had pushed it over the limit.

### A genre chaff does not know stops the run instead of checking nothing (#170)

A `genre` in `chaff.yaml`, or in one of its `by_path` entries, that is not in `npx chaff genres` matched no rule: chaff
reported no findings, listed no rule as not run, and exited 0. It now stops before checking anything, as `--genre`
already did, and says where the genre was written and which genres there are (`--genre`'s message lists them too now).
A front matter `genre:` that is not a genre is not an error, since front matter often belongs to another tool: the file
falls back to the path, the content or the default as before, and chaff now says on standard error, in the document's
language, that the value was not read. The commands that do not read a genre (`genres`, `init`, `tree`, `cite`, `relax`, `strict`, `off`, `skill`)
still run with such a `chaff.yaml`.

### `chaff eval` speaks English to English documents (#170)

`chaff eval` printed its whole report in Japanese, whatever the language of the documents it measured and whatever
`chaff.yaml` or the terminal said. The report now follows the documents' language, as lint's screen does (eval
measures one language at a time, so there is one). Its refusals (no Markdown found, languages or genres mixed, no such
rule) follow `chaff.yaml`'s `language`, then the terminal's locale. The Japanese text is unchanged.

### `undefined-acronym` on HTTP methods, document numbers, "=" definitions, ONLY and series numbers (#170)

Five kinds of capitals were reported as acronyms with nothing to expand:

- **HTTP methods** (GET, POST, "non-GET requests"): words, not abbreviations. They come from a new `http-method` word
  list in each language package.
- **Document numbers**: the capital word right before a hyphenated number with a part of three digits or more is part
  of the number (SP 800-61, NSF 19-582, IEC 19757-2). The word before it is still counted (NIST in "NIST SP
  800-61"), and so is a word before a number with no hyphen (RFC 9110), a version (SDK 3.1), a range of years
  (FY 2024-25), two numbers of the same width going up (SLO 100-200, SLA 500-599), which are a range, or two-digit
  parts (BOD 25-01), which cannot be told from a range, a score or a date (SRE 1-2, 01-02).
- **Symbols defined with "="**: "where N = number of cases, EH = total hours worked" defines EH after it is used.
  A value (EH = 2,000, EH = 40h) or another acronym (EH = SRE) is not a definition. A word as the value
  (SRE = enabled) reads as a one-word definition: a capital name given a value is a setting, with nothing to expand.
- **ONLY** in capitals for emphasis joins `emphasis-word` next to NOT and AND.
- **Series numbers**: a Roman numeral of I, V and X that stands alone with a period at the start of a sentence or
  after the end of one ("… Filter. VII. Water-Bearing Objects", "Euclid. II. The VIS Instrument") is a number.
  After a bracket ("(MEGAFLOW) XII.") it is still counted, since "(adult dose) IV" is written the same way.

### `agentless-passive` leaves Japanese honorific れる/られる and 「〜と呼ばれる」 alone (#170)

Honorific れる/られる names the person who acts as the subject, so no actor is hidden. lang-ja now drops
`Voice=Pass` where the form shows it is honorific: after おる (「参加をしておられました」), and after an intransitive verb,
which has no passive that makes the one acted on the subject (「町へ来られ」「熱心に取り組まれ」「委員を辞任され」「参加されていて」). A glossary's naming
passive 「〜とも呼ばれています」 is dropped too: it gives a name, it does not hide who called it so. The verbs are lexicons in
`@chaffjs/lang-ja` (`intransitive-verb`, `naming-verb`). Real passives stay: 「方針が決定された」「〜と判断されました」
「若松謙維君が選任されました」「会議に呼ばれた」「連れてこられた」, and so does an honorific of a transitive verb
(「林参考人も言われました」「お客様が受けられた」): IPADIC does not mark honorific or transitivity, and a person as the subject
is as often the one acted on. お・ご・御 before される is not read as honorific either (「お会いされた」): the humble
「ご用意する」 has the same form in its passive (「資料がご用意されました」). Accepted limit: an intransitive verb's
adversative passive (「突然、家に来られて困った」) has the honorific's form and is no longer reported. Found in a 紀美野町 mayor's message, a 国会 transcript and
総務省's cyber security glossary in the corpus.

### A file with Windows or classic Mac line breaks, or a byte order mark, is read as the writer sees it (#170)

A file whose lines end in a lone `\r` (classic Mac) was read as one line: every finding pointed at line 1, and `chaff
tree` found no articles in a statute. A file that starts with a byte order mark had every quote and every masked span
one character off, so a quoted sentence lost its last character. Front matter in a file with `\r\n` line breaks, or
after a byte order mark, was not read, and the genre it names fell back to the default. chaff now drops a leading byte
order mark and reads `\r\n` and `\r` as `\n` whenever it reads a document (lint, `tree`, `cite`, `test`, `eval`,
`feedback`). Line and column numbers are the file's own.

### A Zenn article's `type: "tech"` is no longer taken for a genre that no rule checks (#170)

The genre in front matter was read as the raw text after `genre:` or `type:`. A Zenn article says `type: "tech"`
(its kind of article, not a chaff genre), so the genre became `"tech"`, quotes included; no rule is meant for that
genre, and without a `chaff.yaml` the article was reported as having no findings while nothing had been checked.
Front matter now names a genre only when its value, without quotes or a trailing `# comment`, is one of the genres
`chaff genres` lists; `genre: "business/report"` still counts, and a `genre:` line wins over a `type:` line wherever
they stand. Any other value is ignored, and the genre is guessed from the path or falls back to the default, which the
header says.

### Japanese text with an emoji close after a number no longer crashes chaff (#170)

To read the unit after "３ 年", chaff reads a few characters after the space again. When those characters ended in the
middle of an emoji, the Japanese analyser was handed half of it and threw, and `chaff tree`, `chaff cite` and lint with
`--experimental` stopped with a stack trace ("期間は３ 年のうち半分は😀です。"). The analyser is now always handed
well-formed text; a half character counts as one unknown character in the same place.

### A very long line, or a Japanese text file with no blank lines, no longer stalls chaff (#170)

Three costs grew with the square of the length of the text. The Japanese analyser slows down on a run with no `、` or
`。`, so such a run is now handed to it in pieces, cut after a space where there is one; a text whose runs are short
is handed over whole, as before. The English analyser slows down on one long run of non-space characters (a hash or an
encoded blob, not a word), so a run longer than any word is left out of its reading, as a URL already is. And each
Japanese sentence looked through every token of its paragraph, which a `.txt` file with no blank lines makes one long
paragraph; a sentence now finds its own tokens directly.

### `latin-spacing` does not count the spacing inside a quotation in 「」『』 (#170)

A title or a quotation in 「」 or 『』 keeps the spacing of its source: 「AI原則実践のためのガバナンス・ガイドライン ver.
1.1」, 『絵師100人展 16』, 「…ガイドライン CXG79-2012」. The writer cannot change it, so it was wrong to report it as
the odd one out in a document that packs Latin text. A boundary with both sides inside the brackets is now left out
of the count entirely, so a quotation neither is reported nor decides which way the document usually writes. The
same place outside the brackets (「手引き」を IDで引く) is still reported, and a bracket that does not close counts as
before. This is the reading `no-doubled-joshi` already gives a quotation.

### `heading-echo` does not count a quoted variant of the heading; a ninth round of corpus kinds (#170)

A style guide or glossary entry names its term in the heading and then quotes the spellings not to use:
"## data centre" followed by `Not “datacentre”.` was reported as a sentence that repeats its heading. Text in
quotation marks (“…”, ‘…’, "…", '…', 「…」, 『…』) is a word being talked about, not the heading said again, so it
no longer counts toward the overlap unless it is the heading itself (`「利用規約への同意」へお進みください` still
counts). An apostrophe (organisation’s, don't) does not open or close a quotation. A sentence that repeats the
heading outside quotes is still reported.

The corpus adds the A to Z of GOV.UK style, the U.S. Bureau of Labor Statistics glossary, the api.data.gov developer
manual, cloud.gov's security incident response guide, a 首相官邸 speech transcript, a 環境省 national park guide,
総務省's cyber security glossary and explainer, and 国立国会図書館's service guide (committed, licence named in the
manifest), and an arXiv listing of abstracts (URL only).

### A hyphenated tag the document lists, "of [HTTP-CACHING]", names another document (#170)

A bracketed tag after a reference named another document only when it was capitals and digits ("[HTTP]"), so that a
contract's placeholder ("[BUYER-1]") is not taken for one. "Section 4.2.3 of [HTTP-CACHING]" was therefore looked up
in this document and reported by `dangling-reference`. The two are written alike; what tells them apart is whether the
document lists the tag: a line that opens with "[HTTP-CACHING]" and then ends, or leaves two spaces or a tab before
the entry, as a reference list is laid out. A hyphenated tag the document lists now names another document, after the
reference or just before it ("[HTTP-CACHING], Section 4"); one it never lists, or only opens a sentence with
("[BUYER-1] pays …"), is still looked up here. Found on draft-ietf-httpapi-ratelimit-headers-10.

### `date-order` stays silent on a list sorted by something other than its dates (#170)

A release list in board minutes, sorted by release name (`widget-1.10.4`, `widget-2.1.3`, `widget-3.0.0`, …), was read
as a schedule and one release was reported as out of order, although the list never meant to follow the dates. The
direction of a list is still taken from most of its steps, but the list is now checked only when more than half of
its dates can stay in that direction. A schedule with a slip or two keeps the rest of its dates in order and is still
checked; a list sorted by a name or a version does not, and nothing is said.

### `undefined-acronym` leaves domain names, date placeholders and a numeral after a name alone, and reads `(ON RRP)` as one acronym (#170)

Four kinds of capitals were reported as acronyms without an expansion:

- A name joined by `.` with no space: `GOV.UK`, `SAM.gov`, `README.md`, `CLAUDE.md`, `ASP.NET`. Its capitals are
  part of a domain or file name. Each part must be all capitals or all lower case (digits and `-` allowed), so a
  sentence that lost its space (`the IRS.Then`, `Mr.HAWLEY`) is not read as a name, and an acronym before a sentence
  full stop (`…by the IRS. Then`) is still counted. The same acronym outside the name (`the SAM record`) still counts.
- A date or time placeholder: one capital letter repeated where a number goes. It is a placeholder when joined by
  `/`, `:`, `-` or `.` (full-width `／` and `：` too) to another such run or to a number (`MM/DD/YYYY`, `YYYY-MM-DD`,
  `HH：MM`, `2026/MM/DD`), or when a date or time unit follows it (`令和YY年MM月DD日`, `HH時MM分`). The units are the
  new `date-time-unit` lexicon: 年, 月, 日, 時, 分 and 秒 in `@chaffjs/lang-ja`, and none in `@chaffjs/lang-en`, which
  writes its templates with separators. `AI時代`, `CI/CD` and `TCP/IP` are still acronyms: they are not one letter
  repeated.
- A Roman numeral written with I, V and X right after a capitalised word: `Senior System Engineer II`, `World War
  II`, `Leopold III`. It numbers the name. When no letter comes before the word in the sentence (`Start IV fluids`, a
  list item `1. Give IV fluids`), the capital marks the start of the sentence rather than a name, and `IV` is still
  counted; so is a numeral with C, D, L or M (`Audio CD`, `Washington DC`, `Pipeline CI`), which is more often an
  acronym, and one after a word in capitals (`AES IV`) or in lower case (`the IV line`).
- An acronym written as two or more words inside brackets: `overnight reverse repurchase agreement (ON RRP)`. Its
  letters do not match the initials of the name (`ON` is *overnight*), so it is read as expanded when its letters can
  be picked in order from the English words before the brackets, starting at the start of one of them; `ON` and
  `RRP` are then both expanded. Acronyms listed with spaces (`The regulators (SEC FINRA)`), a Japanese name (whose
  letters cannot be checked), a bracket with a lower-case word (`(see ON RRP)`) or a comma (`(EPA, FDIC)`) are not,
  and a run before brackets (`AWS KMS (Key Management Service)`) expands only the word next to them, as before.

Found on GOV.UK's pages (`GOV.UK`), a CRS report (`SAM.gov`), the FOMC minutes (`ON RRP`, `Senior System Engineer
II`), the Congressional Record (`World War II`) and e-Tax's e-mail templates (`令和YY年MM月DD日 HH：MM`). With the four
placeholders gone, the e-mail templates have fewer bare acronyms than the rule's level and are no longer reported.

### A reference wrapped before its "of [HTTP]" names the other document (#170)

A plain-text RFC is hard-wrapped at about 72 columns, so a reference into another document is often split across a
line: "…advised in Section 16.3.2\n   of [HTTP]." or "…from Section 3 of\n   [SF] to specify…". Each line was read on its own, so "Section 16.3.2" looked like a
reference into this document and `dangling-reference` reported it. The reference reader now also sees the next line,
joined by one space in place of the line break and its indentation, when it looks for the "of [DOC]" / "of RFC 9110" /
"of the Master Agreement" after a reference; the same holds for a wrapped Markdown paragraph. A reference with nothing
after the wrap, or "of this Agreement", is still looked up in this document; a blank line ends the join and a heading
does not run on into the next line; findings keep their place on the line. Found on draft-ietf-httpapi-ratelimit-headers-10.

### `doubled-word` does not count an article before "a priori" (#170)

"the a priori approach" was reported as two articles in a row. The "a" of "a priori", "a posteriori", "a fortiori",
"a la carte", "a la mode" and "a cappella" belongs to a fixed phrase that acts as one adjective, and the tagger gives no
sign of a foreign word there ("priori" is a noun to it). An article pair is no longer reported when the second word
opens a phrase from lang-en's new `fixed-phrase` word list. "the a report" and "a a priori" are still reported, and
so is any doubled article before the phrase ("the the a priori"). Japanese has no articles and no such list.

### `unqualified-superlative` does not report the name of a measured quantity (#170)

最大風速, 最高気温 and 最大値 name a quantity that is measured; they do not claim that anything is the greatest. A
superlative noun joined directly to the next noun, with no particle or space between (the parts of speech say so), is
now read as such a name when the compound ends in a noun for a measured quantity (風速, 気温, 値, 台数 ...). Those nouns
come from each language package's new `quantity-noun` word list, which the rule declares; a compound ending in any
other noun (最高品質, 最速配送, 最高精度, 最高満足度) is still a claim and still reported, as are 最大の効果 and 最も速い.
English writes a space between a superlative and its noun, so its list is empty and nothing changes there.

### `concrete-evidence-density` sees a relative link, a spelled-out count and a reference the structure tree read (#170)

The rule says a section has "no number, code or link", but it only saw a link written as `https://…`. A Markdown
link to another page of the same site (`[guide](/handbook/meetings/)`), to another section (`[results](#results)`),
to an address (`mailto:`), or a reference-style link (`[guide][g]`) is now a link too; an image is not. In English,
a spelled-out number counting a plural noun right after it (`five minutes`, `more than two days`) is now a number,
as a kanji numeral already was in Japanese; `one of`, `two-way` and `one-on-one meetings` are not. A reference,
quantity or date the structure tree read inside the section (`See Section VI`) also counts. The tree is built only
when the document would otherwise be reported. lang-en now marks a plural noun with `Number=Plur`.

### A version number that starts a sentence is not a section number (#170)

Meeting minutes and release reports list releases newest first, one per line: `3.11.0 was released on 2024-10-17.`,
`3.10.0 was released on 2024-08-13.`, or in Japanese `3.11.0 を公開しました。`. Each line was read as a numbered
section, so `numbering-gap` reported every older release as out of order. On a line of body text, a dotted number
followed by a sentence (it ends with a full stop, `。`, `?` or `!`) that starts with a lowercase word, or in Japanese
with a particle (read with the morphological analyser), is now a number inside a sentence and not a section number.
Headings, a capitalised title (`3.1 Scope`, `4.2 The Supplier shall`), a noun title (`3.1 適用範囲`) and a lowercase
title that is not a sentence (`3.1 overview`, `4.2.1.  about:blank`) are still read as sections. Found on the Apache
Software Foundation board minutes.

### The corpus adds a letter template, board and committee minutes, a government roadmap, team week notes, a minister's press conference, e-mail templates and company releases (#170)

Committed with their licence named in the manifest: an Acas letter template, a GOV.UK policy paper and a GDS blog's
week notes (OGL v3.0), and FOMC minutes (public domain, per the Federal Reserve Board's website). Kept URL only: the
Apache Software Foundation board minutes (Apache-2.0), デジタル庁's press conference summary (the reporters' questions
are theirs), e-Tax's e-mail templates (each carries an all-rights-reserved notice) and 小林製薬's releases (no licence
to redistribute).

### `agentless-passive` leaves Japanese れる/られる that is not a passive alone (#170)

Japanese れる/られる is also spontaneous, honorific and potential, and IPADIC does not say which. lang-ja now drops
`Voice=Pass` where the form alone shows it is not a passive: after a verb that reads as spontaneous
(「〜と考えられる」「〜と思われる」, the guidelines' and judgments' 「〜と解される」) unless the predicate is past, after a verb that names a relation
rather than an act (「外国人も含まれる」「対症療法に限られる」), and inside an honorific address (「参考人におかれましては」
「各学校設置者におかれては」). The verbs and the address are lexicons in `@chaffjs/lang-ja` (`spontaneous-verb`,
`stative-passive-verb`, `honorific-formula`). Real passives stay: 「方針が決定された」「予算案が承認されました」
「一定の協力が求められます」, and so do a past 「会議で考えられました」, 「〜と言われる」 and 「〜とされている」, which hide who
thought or said so, 「予算に見込まれていない」, and an honorific after
an auxiliary verb (「務めてこられた」), which has the form of a passive after one (「連れてこられた」). Found on
デジタル庁 and 厚生労働省 pages, a 文部科学省 notice, a 最高裁 judgment, a 国会 transcript and the 個人情報保護委員会
guidelines in the corpus.

### `yarn bench` plants mistakes for more rules: a preamble, stock phrasing, repeated openers and team spellings (#170)

The seeded-mistake benchmark now also plants a preamble made by leaving out the first section heading
(`preamble-length`), a closing 「いかがでしたか。」 / "Thanks for reading." on a blog post (`closing-cliche`), a
padded opening sentence after the first one (`padded-intro`), an empty 「これは非常に重要です。」 / "This is extremely
important." after the first statement of the body (`empty-intensifier`), consecutive paragraphs that all open with
「また、」 / "Also," (`repeated-conjunction`), sentences chained with "And" (`sentence-initial-conjunction-run`), and a
spelling the team has ruled out, such as 打合せ for 打ち合わせ or e-mail for email (`preferred-term`; the bench passes the
team's `prefer` as `chaff.yaml` would). The clean samples are unchanged and none of these rules reports on them.

### `undefined-acronym` does not count a reference key in square brackets (#170)

Specifications point to their references with a bracketed key: `[HPACK]`, `[RFC9110]`, `[SECURING-WEB]`,
`[POWERFUL-NEW-FEATURES]`. The key names an entry of the reference list, where the reader goes to find it, so it is not
an acronym waiting for an expansion; the capitals inside it (`MIX`, `WEB`, `NEW`, `SF`) were reported as undefined. A
bracketed single word starting with a letter is now read as a key and its capitals are not counted. The same acronym
outside the brackets is still counted, a bracket after a letter (`List[SF]`) is not read as a key, and neither is a
Markdown link (`[DRI](/url)`, `[DRI][ref]`), a reference definition (`[DRI]: /url`), an image or a bracket holding
several words (`[the FBI]`). Found on the W3C Secure Contexts specification and an IETF Internet-Draft; RFC 9457 in the
corpus loses its bracketed keys (`[TAG]`, `[WEB-LINKING]`, `[ABOUT]`, `[JSON-SCHEMA]`) from the report.

### The corpus adds GOV.UK guidance, a W3C specification, an Internet-Draft, a help-center article, an FTC guide, a Tokyo newsletter article, a university notice for students, a JMA FAQ, an incorporated administrative agency's notice and a library notice (#170)

Committed with their licence named in the manifest: GOV.UK guidance (OGL v3.0), the Nextcloud user manual (CC BY 3.0),
FTC consumer advice (public domain), 気象庁 and 国立国会図書館 (PDL1.0), 統計センター (政府標準利用規約 2.0). Kept URL
only: the W3C specification (a notice-bearing permissive licence), the Internet-Draft (IETF Trust), 広報東京都 and the
University of Tokyo's utelecon (no licence to redistribute).

### `ngram-repetition` no longer reports a repeated name as phrasing (#170)

A document repeats the names of what it is about (`the NSF Proposal & Award Policies & Procedures Guide (PAPPG)`, `the
Learning & Development team`, `the Location Object`), and the tagger sometimes reads a capitalised word inside such a
name as a verb (`Guide`, `Learning`, `Object`), which made the name count as phrasing. In English, a capitalised word
after the first word of the sentence, next to another such word (`&` and brackets in between are fine), is now read as
part of a name, not as a predicate. A verb cut by the edge of the repeated window (`ed in the NSF Propos`, `ed by
Applicable Law`) no longer counts either when everything else the window holds is a name or a function word: only the
verb's ending repeats, and the verb itself differs each time (`contained in`, `identified in`; `prohibited by`, `required
by`). A whole verb still counts (`use the Cloud Service`, `Select Save (if applicable)`), and so does a cut verb next to an
ordinary word (`the same participant described`). Found on NSF's REU solicitation, a GitLab job description, RFC 3693 and
Common Paper's cloud service agreement.

### The corpus HTML converter keeps a `<pre>` block's lines, and fences code (#170)

A `<pre>` block became one paragraph, its lines run together: the Zen of Python in PEP 20, a poem of short lines,
was reported as one paragraph far over `max-paragraph-length`, and a JSON example in a Chrome blog post was read as
a long sentence. A `<pre>` is now read by its markup. One holding a single `<code>` element, or whose own class or
that of the elements wrapping it directly names a language (`language-json`, `lang-sh`, Sphinx's
`highlight-pycon`), is code and becomes a fenced code block with its lines and indentation, which chaff does not read
as prose; the fence is longer than any run of backticks inside. Any other `<pre>` (a poem, an address, a plain-text
notice, or one marked `highlight-text`, `language-none` and the like) keeps its lines, each one a paragraph. A `<pre>`
inside a heading stays that heading's text, and one inside dropped chrome goes with it. The Congressional Record
converter, which reads its page's `<pre>` by indentation, is unchanged.

### English: a capital `(A)` under a roman `(i)`, and a label alone on its line, as US regulations number (#170)

A US regulation goes down `(a)`, `(1)`, `(i)`, `(A)`, and below `(A)` numbers again with `(1)` or `(i)`. lang-en did
not read `(A)` at all, so the `(1)`, `(2)` under a `(C)` were taken for the paragraphs beside `(4)`: the next `(6)` was
reported as following `(2)`, and `(3)` as following `(3)`. A capital letter is now an item when it opens right under a
roman item with `(A)`, or continues an open capital; a first `(1)` or `(i)` right under a capital, and a first `(A)`
right under a roman item, open a level below it. `(I)` first under a roman item is a capital roman numeral, as in the
US Code's subclauses, and `(II)` continues it; after an open `(H)` it is the letter I. A capital `(A)` anywhere else —
the recitals of a contract, a list under a numbered paragraph — is text, as before.

A label with nothing after it on its line — the eCFR writes `(5)` alone and starts its text with `(i)` on the next
line — is now an item when it is the next number of an open list (`(5)` after `(4)`), so `§ 310.4(a)(5)(i)` resolves.
A lone `(1)`, or a label that repeats or skips a number, stays text. Found on 16 CFR Part 310 in the corpus.

A reference now reaches these levels: `§ 310.4(b)(1)(iii)(B)` points at `(B)`, and `(a)(1)(i)(A)(1)` is read to its
end. A capital part is read only after a roman one, as the tree reads it; `section 5(A)` still points at section 5. A
dotted number in a list of references (`§§ 310.4(b) and 310.5`) is no longer read as its head (`310`), which was
reported as missing.

### `undefined-acronym` accepts a name and an acronym joined by a colon in brackets (#170)

Japanese guidelines and white papers expand an acronym as `（single nucleotide polymorphism：SNP）` or
`（Information-technology Promotion Agency：IPA）`: the name, a colon (full-width or half-width), then the acronym as the
last item in the brackets. This form now counts as spelled out when the initials of the name are exactly the acronym,
and so does the other order, `(SNP: single nucleotide polymorphism)`, where the colon is one more separator after the
acronym as the first item. The initials are those of the capitalised words (`Data Retention and Reuse Act`) or, for a
name written in lower case, of every word (`single nucleotide polymorphism`); the second reading also applies to the
existing forms with `;`, `,` or `、`. A name containing a separator is a list and is not read (`(EPA, FDIC: GSA)`,
`(Legal, Finance: LF)`), and neither is an example marker (`（例：AWS）`) or a Japanese name, whose initials cannot be
checked. Found on 個人情報保護委員会's guidelines (SNP, STR).

### `latin-spacing` reads a number joined by full-width hyphens as a code, like one joined by `-` (#170)

A Japanese circular (通達) numbers each provision at the head of a line with full-width hyphens: `5－1－1 法第2条…`.
Only the half-width `-` joined the groups of a code, so the space after `5－1－1` was counted as a writer who spaces
after a number, and every provision of the 消費税法基本通達 was reported against the document's usual touching style.
The full-width hyphen `－`, the hyphens `‐` and `‑`, and the minus sign `−` now join digits wherever `-` does: three or
more groups are a code and are not counted, a postal code or telephone number with a group starting with 0 is a name,
and an address number after a ward or town may use them. A range of two groups (`3－5 日`) is still counted. The long
vowel mark `ー` and the dashes (`–`, `—`) do not join digits.

### `doubled-word` accepts the spoken reduplications of the Diet minutes (#170)

Three repeats in a committee's minutes were reported as slips. 「段階段階のところを」 means "at each stage", like
「場面場面で」: 段階 joins the nouns that double to mean "each" (`distributive-noun`), so a particle must still follow
(「段階段階を踏む」 is reported). 「繰り返し繰り返し来る」 repeats a verb as an adverb, which the analyser reads as two
verbs, the same as 「見る見る」: it joins the `doubled-word` list. 「労働者ががんがんじゃなくて」 is the adverb がんがん, which
the analyser reads as the noun がん twice only because of the が before it. `@chaffjs/lang-ja` now reads two adjacent
equal content words again as one string, and marks the second `Echo=Rdp` when the analyser reads that string as a
single adverb. Function words are not read again, since the slip 「行ったたので」 would read as the adverb たた. Minutes
keep the rule: every repeat found there is explained by the words, and a transcript can still carry a real slip.

### `doubled-word` reads 「法法第64条」 as the name of a statute (#170)

Tax circulars abbreviate 法人税法 as 法法 (beside 所法, 消法, 措法), and the analyser splits it into 法 + 法, which
`doubled-word` reported as a slip. The structure reader already names the document a reference cites (「法法第64条の2」
cites 法法). A doubled word is now left alone when the two words are the whole of that name and the second is a
one-character document-kind word (`document-kind`: 法, 令): the name is an abbreviation, a head character and the kind.
No abbreviation is listed. 「法法の規定」 with no address after it, a doubled word that is not a kind word
(「民法民法第709条」), a two-character kind word (「規則規則第3条」), a doubling inside a longer name
(「就業規則規則第3条」) and a doubled word before an address that names no document (「資料資料第3条」) are still reported.
Found on 国税庁's 消費税法基本通達.

### The corpus HTML converter drops buttons and a heading's link to itself, and keeps a heading that is a link (#170)

A `<button>` is a control, not prose: its label (`Close`, `Share`, `Cite this publication`, `See All Comments`) no
longer becomes a line of the document. A button inside a heading stays, since that is how an accordion draws its
section's title. An element with the `hidden` attribute is not shown and goes too (a bookmark tooltip inside a
blog post's `<h1>`), except `hidden="until-found"`, which the browser opens when its text is searched for; `aria-hidden`
and a class named `hidden` are unchanged. A link to the heading's own section — its target is the heading, something
inside it, or an element enclosing it with no other heading opening in between — goes when it stands just after the
heading (`Copy link to Context`), or inside it as a mark without words (`Scope ¶`). Linked words inside a heading are
its title and stay: a heading is never navigation, so a Python PEP's section headings, each a link back to the table
of contents, and the National Weather Service's expandable headings are no longer dropped. Found on the OECD's
report, a Chrome for Developers post, GSA's and the Library of Congress's pages and the PEPs.

The corpus adds PEP 20, The Zen of Python (placed in the public domain, as the document states), to show a PEP's
section headings read. Its aphorisms, set in a `<pre>` block, still run together as one paragraph, since the converter
reads a `<pre>` as prose.

### An English `(i)` right under `(1)` is a roman numeral, as US regulations number (a)(1)(i) (#170)

A US regulation goes down `(a)`, `(1)`, `(i)`. lang-en read an `(i)` as roman only right under a lettered item, so the
`(i)` under a `(1)` became the letter i beside `(a)`: its `(ii)`, `(iii)` hung under it, the next `(b)` was reported as
following `(i)`, and every reference such as `§ 310.3(a)(1)(i)` pointed at an address the tree did not have. An `(i)`,
`(v)` or `(x)` right under `(1)` is now roman, as it is under `(a)`. The letter i after an open `(h)` stays a letter,
also when a `(1)` is open under the `(h)`. An open item now keeps the reading it was given (its position in the
sequence), instead of being read again from the item above it. Found on 16 CFR Part 310 in the corpus.

### `undefined-acronym` reads a hyphenated acronym as one word, and knows Q&A, R&D and M&A (#170)

Acronyms joined by a hyphen (`RT-PCR`, `CA-FATC`, `USDA-OCFO`) are now one acronym, as acronyms joined by `&`
already were. Split, `RT` was reported as an acronym of its own, and an expanded compound — "Financial and
Administrative Terms and Conditions (CA-FATC)" — left both halves reported. A compound is explained when it is expanded
as written, or when every part is common or expanded elsewhere (`US-EU`); otherwise the compound is reported. A hyphen
next to a lower-case word (`SRE-led`) or a single capital (`T-SQL`) does not join, and a compound with a digit
(`COVID-19`, `SARS-CoV-2`) is still an identifier. An expansion in square brackets or after a separator now matches
the initials of a compound too.

A pair of capitalised words is shouting, not two acronyms, when one of them is longer than an acronym can be
(`BILLING CODE 3510-13-P`); three or more such words already were. Only the pair itself is left out, so an acronym
after it (`NEW GUIDELINES: SRE`) is still read, and a pair of short capitalised words (`AWS KMS`, `NIST SP`) is still
read as two acronyms.

`common-acronym` (Japanese and English) has `Q&A`, `R&D` and `M&A`, which business documents use without expansion.
Other `&` acronyms (`S&OP`, `F&A`) are still reported unless expanded.

### Japanese: a counter after a number does not start a run of kanji (#170)

`max-kanji-continuous` counted the counter of a number written in digits as the first kanji of the compound that
follows it: `平成2年3月2日日本弁護士連合会臨時総会決議` was reported as `日日本弁護士連合会臨時総会決議`, starting in the
middle of the date. The digits show where the counter belongs, so the reader does not have to find that boundary. A
counter (`NounType=Class`) directly after a number, or after a number and one space (`2 日`), is no longer part of the
run it opens (`2日`, `第76回`, `24時間`, `2026年度`); the run and the word shown start after it. A number written in
kanji is itself part of the run (`第三回情報処理推進機構`) and is counted as before, and a word the analyser does not read
as a counter (`2021会計年度`) stays in the run. Whether a run is an address or one name is decided on what follows the
counter (`1日日本銀行` is the name `日本銀行`). A run that appears twice in one sentence is now read at each of its
places, not both at the first one; to keep those places, a masked statute address is blanked to its own length rather
than to one space. Found on a judgment of 最高裁判所 and several government pages.

### The corpus's converters drop a heading drawn as an image and keep the words a layout template wraps (#170)

An HTML heading that holds only images — a site logo, a section banner, a photo placed in an `<h2>` — left an empty
`#` line. The converter keeps no image's alt text in prose, and such a heading now goes whole the same way, unless the
images' alt text is the page's own `<title>`: a title set as a picture keeps its words as the heading. A heading with
any text beside the image is unchanged. Found on 国土地理院's and 国土交通省's pages (a logo and a banner above the
real title) and an Inside GOV.UK post (a picture in an `<h2>`).

A Wikisource page now keeps the text its layout templates wrap: `{{center}}` (and `{{c}}`), `{{block center}}` (and
`{{bc}}`), `{{right}}`, `{{left}}` and `{{quote}}` as paragraphs of their own, the way the page sets them apart from
the text beside them (inline on a heading or list line, which a break would cut), and `{{larger}}`, `{{smaller}}` and
`{{resize}}` inline. Only the words stay: a second value is an offset or a size (the text of `{{resize}}` when it has
two), and a quotation's author and source are left out because the wikis number them differently. An older judgment centres its 主文 and 理由 with `{{center}}` and sets the
judges' names with `{{right}}`; both were dropped, and so was the colloquy quoted in Gideon v. Wainwright. A centred
line stays a line of text, not a heading. The corpus adds a 最高裁判所 judgment of 1982 written this way (not subject
to copyright under 著作権法第13条第3号).

### The corpus has parliamentary minutes, regulations, guidelines, design proposals and an international report (#170)

A debate from the US Congressional Record (public domain), a committee meeting of the 参議院 from the 国会会議録検索
システム API (URL only: each speech's copyright is its speaker's), a part of the eCFR pinned to a date (public
domain), a chapter of 消費税法基本通達 and the 個人情報保護委員会 guideline 通則編 (a 通達 and a 告示, not subject to
copyright under 著作権法第13条第2号), an Ethereum Improvement Proposal (CC0), an architecture decision record of the
Federal Audit Clearinghouse (CC0) and one of GOV.UK (MIT, URL only), a Chrome for Developers blog post in English and in
Google's AI translation into Japanese (URL only: the prose is CC BY 4.0 but the code samples are Apache-2.0), and the executive summary of an OECD report (CC BY 4.0). Two new
corpus formats read what the HTML converter cannot: `kokkai` turns the API's JSON into the meeting's speeches in
order, dropping the roster of members present; `congressional-record` reads the Record's `<pre>` page, where only
indentation marks a title, a paragraph, quoted matter or the names of a roll call, and joins a paragraph that a page
marker (`[[Page S2257]]`) splits. The UK Hansard and the OECD's own pages refuse automated requests, and Python PEPs
lose their section headings in the HTML converter, so none of them is in the corpus yet.

### Japanese: a 条 reference in a document with no 条 is not looked up there (#170)

A guideline or a 通達 numbers its own parts with headings (`## 1 目的`, `## 2 定義`) and cites the statute it
explains by article (`法第17条`, `規則第18条第4項`). `dangling-reference` looked such references up in the guideline
itself and reported every one whose number the headings did not reach, and silently matched the others to the
wrong heading. A Japanese article reference now names the unit it counts in (`:unitWord "条"` in `chaff tree`), and
it is not looked up in a document none of whose articles is written with that unit. A document that has 第N条
articles is checked as before, and English references, which name no unit word, are unchanged.

### English: a surname in capitals after an honorific is not an acronym (#170)

A transcript prints the speaker's surname in capitals (`Mr. HAWLEY.`, `Mrs. CAPITO.`, `Mr BLAKE`), and
`undefined-acronym` counted each one as an acronym without an expansion. A word in capitals right after an honorific
from the new `honorific` lexicon (Mr., Mrs., Ms., Dr., Miss, Madam, with or without the full stop) is now read as a
name. The honorific is matched as written, so `MR. HAWLEY` and an acronym elsewhere in the sentence still count.

### English: a page title is not compared with the section headings (#170)

`title-case-consistency` reported a Title Case page title over sentence-case section headings (CDC's
`# Carbon Monoxide Poisoning Basics` over `## What it is`), a common and consistent house style: the title is a name.
When the first heading is the document's only top-level heading, it is now left out of the comparison and never
reported. It still decides an even split among the section headings, where the style the author chose for the title is
the likelier house style. A document with several top-level headings has no title in this sense (the first may be a
chapter), so all of its headings are compared as before; real inconsistencies among section headings are reported as
before.

### Japanese: a line break inside a Markdown paragraph no longer splits a word (#170)

A judgment copied from its PDF, or a paragraph wrapped by hand, has line breaks in the middle of a sentence. Markdown
shows such a paragraph as one line, and a line break between two full-width characters shows as nothing at all (the
rule browsers follow), but chaff passed it to the morphological analyser, which read it as a word boundary: 「に関\nする」
became two words, a 「の」 chain continuing onto the next line was cut there (`no-doubled-joshi`), and the excerpt of a
long sentence showed 「関 する」. chaff now removes such a line break before the analysis when the line clearly continues: the analyser finds a
word across it, or the line ends in a particle, a conjunction or a comma. Every word and finding is mapped back to the
source, so line, column and offset still point at the text as written. A line that ends in a noun or a bracket keeps its
break, because it may be a numbered heading (「2.1 注文の登録」) or one item of an address or signature written one per
line, which Markdown also runs together; `max-kanji-continuous` joins only a line break inside a word. A line break next
to a Latin letter or a digit, a hard line break (two spaces or a backslash), a blank line, a full-width indent and a line
break next to inline code stay as they were, and so does a plain-text document, whose lines are shown as they are (a
statute puts one item on each line).

### Japanese: a long run of kanji that is one proper name is not reported (#170)

`max-kanji-continuous` no longer reports a run of kanji that is one name, since the writer cannot change a name: a
word the dictionary reads as a single proper noun (新東京国際空港公団, 動力炉核燃料開発事業団) or a person's family and
given name (田中太郎). The Japanese adapter now tells persons and organisations apart the way it already told places:
IPADIC's 固有名詞,人名 becomes UD `NameType=Sur` (family name), `Giv` (given name) or `Prs`, and 固有名詞,組織 becomes
`NameType=Com`. A proper noun followed by common nouns (武蔵野美術大学造形構想学部, 新東京国際空港公団総務部) is still
reported, as is a run of names (田中一郎山田花子佐藤次郎): both are the way unreadable compounds are built. Most official
names are not in the dictionary as proper nouns: kuromoji splits 個人情報保護委員会 and 日本経済団体連合会 into common
nouns, and they stay reported. No finding in the corpus changes.

### English: a curly or single closing quotation mark stays with its sentence (#170)

After a question or exclamation mark, the sentence splitter ended the sentence before a curly closing quotation mark
(`“Is it done?” Nobody answered.`, `‘…?’`) or a straight single one (`'What if?'`), so the next sentence began with
`”`. That stray mark was counted as a word by `max-sentence-length`, a quoted question on its own became a sentence of
one mark, which made a section look longer to `concrete-evidence-density`, and a quotation in the middle of a sentence
(`the room “How do we grade?”, which met twice`) split the sentence in two. A closing quotation mark (or bracket) that
opens a sentence directly after a full stop, question or exclamation mark now goes back to the end of that sentence.
When a space and a capital letter follow, the two stay separate sentences; when nothing follows, the quotation ends
the paragraph; when lower case, a number or punctuation follows, the quotation was mid-sentence and the two are one
sentence, as with straight double quotes. Opening marks (`“`, `‘`) and a word-initial apostrophe (`’Tis`, `’90s`) are
never moved. Found on 18F's handbook, an arXiv workshop report, a Federal Register notice, a Library of Congress blog
post and GitLab's handbook.

### The corpus has patent specifications and court decisions (#170)

A US patent (the sealed crustless sandwich, public domain), a Japanese published patent application (特開, URL only:
the applicant holds its copyright), a US Supreme Court opinion (Gideon v. Wainwright) and two judgments of 最高裁判所
(not subject to copyright under 著作権法第13条第3号), one of them hard-wrapped at a fixed width the way a judgment
copied from its PDF is. Patents come from Google Patents as archived by the Internet Archive; a new corpus format,
`google-patents`, keeps only the abstract, the description and the claims and drops Google's metadata, citation and
family tables. Opinions and judgments come from Wikisource at a pinned revision; the wikitext converter now also drops
links in the Japanese names of the file and category namespaces (`[[カテゴリ:日本の判例]]`, `ファイル:`, `画像:`,
`メディア:`). The courts' own sites publish full judgments only as PDF, which the corpus cannot convert.

### English: a sentence that closes inside a quotation ends there (#170)

American usage puts the full stop inside the closing quotation mark (`…to a "fair trial." Plainly, the rule…`), and
the sentence splitter did not end a sentence there: the next sentence was read as part of it. `max-sentence-length`
reported the two as one long sentence, `max-paragraph-length` counted too few sentences, and a passive with its actor
in the following sentence was read as having one. A full stop, question or exclamation mark directly before a closing
quotation mark now ends the sentence when a space and a capital letter (after an opening bracket or quotation mark, if
any) follow. It does not when the word before the full stop is an abbreviation or initials (`the "U.S." Army`,
`"Dr." Smith`, `"J."`), when a bracket is still open, or when the next word is lower case or a number
(`"Is it right?" asked the clerk`, `"no." 316 U.S. at 462`). Found on a Supreme Court opinion, CRS reports, an NSF
solicitation and GitLab's handbook.

### The corpus HTML converter drops more of a site header and footer by their shape (#170)

Three shapes before the page's `<h1>` now count as a menu for the site-header rule, so the innermost block holding
one, with no sentence beside it, goes whole: a definition list whose definition is a breadcrumb trail (`現在位置`:
`トップ > 教育 > …`), a list whose items hold no words (a text-size switch drawn as images, with its label
`文字サイズ変更`), and a block of links and nothing else, even a single one (`English`, `サイトマップ`). A trail with
only one link, a definition beside prose, a list with words, an empty list, a link with words or a sentence beside
it, a card, and any of these after the title are kept.

A copyright notice closing the page no longer needs a year when it opens with the © sign or `Copyright ©` /
`Copyright (c)` (`Copyright © Ministry of Health, Labour and Welfare, All Right reserved.`); `(c)` alone opens an
enumerated paragraph and `Copyright` alone a sentence, so neither counts without a year. An `<address>` whose nearest
enclosing block holds nothing else but copyright notices, with nothing but them after it, is the site's contact line
and goes with them. An address beside a label or any other text (`Send comments to:`), outside any block, with
anything else after it, or with nothing after it, is kept.

Found on 文部科学省's, 国土地理院's and 厚生労働省's pages. NWS's `Safety` / `National Program` beside the title is
left as it is: two short paragraphs without links before the `<h1>`, the same shape as a press release's dateline or
a notice's agency and docket number, set apart only by its class name.

### `no-doubled-joshi` does not count particles inside a quoted title (#170)

A title quoted in 「」 is the name of something, not the writer's phrasing: 「食品中のウイルスの制御のための食品衛生一般原則の適用
に関するガイドライン」 was reported for its chain of の, which the writer cannot rephrase without misquoting it. A quotation
in 「」 or 『』 is now read as one noun: the particles inside it are not counted, and the chain around it goes on through it,
so 「弊社の「新製品」の販売の計画」 is reported where the brackets used to break it. A chain outside a short quotation
(「「2 ページ表示」での各ページのサイズの揃え方の設定」) is still reported, a comma after the quotation still breaks the chain,
and an unclosed bracket quotes nothing. Found on 厚生労働省's Q&A on norovirus.

### `latin-spacing` does not count the space after a postal code or an address number (#170)

The space in 「〒100-8916 東京都千代田区」 was counted as a space between a number and Japanese, because only a code with a
part starting with 0 (〒102-0094) was read as a code. The 〒 mark now marks the number after it as a label, as ※ and 「
already did. A hyphenated number right after a place that has come down below the prefecture to a city, ward or town
(「千代田区紀尾井町1-3 東京ガーデンテラス」) is an address number, not a range, and is not counted either; the prefecture units
come from the `prefecture-unit` list. A range stays a quantity: after a region or a prefecture alone (「北海道2-3 営業日」
「東京都2-3 営業日」), after no place at all (「3-5 営業日」), with no hyphen (「千代田区23 番」), or with a counter after it
(「1-3 日」). Found on 厚生労働省's call for public
comment and デジタル庁's privacy policy.

### `doubled-word` accepts 「早め早め」 (#170)

「早め早めの避難行動を心がけてください」 repeats 早め for emphasis, but the analyser reads 早め as an ordinary noun, the
same as 資料 in the slip 「資料資料」, so neither the part of speech nor the particle after it tells the two apart. 「早め早め」
joins 「毎日毎日」 and 「一つ一つ」 in the Japanese list of repeats that are not slips; three in a row (「早め早め早め」) is still
reported. No other repeated form in the corpus is reported, and the common ones need no entry: 「ゆっくりゆっくり」 is an
adverb and 「少しずつ少しずつ」 is not two adjacent words. Found on 気象庁's page on emergency warnings.

## 0.14.0 — 2026-09-29

Japanese read more closely by morphology: 「3つ」「三つ」 are a number and a counter, a line opening with 「1.5 万人」 is a
quantity rather than a section, and lang-ja now carries each word's reading, so 「下さい」 and 「ください」 are the same
polite ending. `no-mixed-desumasu` judges a run of numbered paragraphs on its own, `undefined-acronym` reads a Roman
numeral after Part or Section as a number and 「といいます」 as a definition, and `preamble-length` counts only paragraphs
with a sentence in them. The corpus gains a fourth round of kinds — health, weather, education, transport and
public-comment documents — its converters drop more page chrome by structure, and a weekly run now compares the
documents kept only as URLs.

📦 [`chaffjs@0.14.0`](https://www.npmjs.com/package/chaffjs/v/0.14.0) ·
[`@chaffjs/lang-ja@0.13.0`](https://www.npmjs.com/package/@chaffjs/lang-ja/v/0.13.0) ·
[`@chaffjs/lang-en@0.12.0`](https://www.npmjs.com/package/@chaffjs/lang-en/v/0.12.0)

### The corpus HTML converter drops a site header that has no landmark (#170)

A page without `<main>`, `role="main"` or a sole `<article>` was read whole, and its site header survived the menus
inside it: the tagline beside the menu and the labels of the text-size and contact boxes. The innermost block (`div`,
`section`, `header` or `dl`) that closes before the page's `<h1>` opens and holds a menu, with nothing but labels
beside it, now goes whole. A menu is a list the navigation rule already drops, or a definition list whose every
definition is only links (`文字サイズの変更`: `標準` `大`). A block before the title without a menu, such as a notice's
agency and docket number, is kept, and so is text sharing an outer block with a menu block, a block where a sentence
stands beside the menu (`Comments are due by May 1.`), one that contains the title and one that comes after it. Found
on 厚生労働省's call for public comment. The Federal Register's "Document Headings" help box is left as it is: it sits
beside the agency and docket number and differs from them only by its class names and wording.

### `undefined-acronym` reads a Roman numeral after Part or Section as a number, and a polite 「といいます」 as a definition (#170)

A Roman numeral written in its proper form (I to MMMM) right after the name of a division of a document — `Part II`,
`Section VIII`, `Title IV`, `Chapter XI`, `Appendix III`, or the name in capitals (`PART II`) — is the division's
number, not an acronym. The names come from a new word list in each language package, `numbered-division`, which the
rule declares. Acronyms that are also Roman numerals (CD, CI, DC, MD, CV, MIX, IV) are still reported anywhere else,
and so are a malformed numeral (`Section IIII`), a numeral glued to more letters (`Section CIA`) and a lowercase name
in running text (`part II`). A plural name or a list of numerals (`Chapters II and III`) is not read yet. Found on
NSF's REU solicitation and an arXiv workshop report.

An acronym defined with the verb conjugated — `（以下、「GSS」といいます。）`, `と呼びます`, `と称します`, `といいました` —
now counts as defined, as `という` did. The last verb is matched by its base form from morphological analysis, so the
rule now uses part of speech when it can; without it only the forms in `definition-verb` are read. `definition-verb`
gains `と言う` and `と称す`, the base forms the analyser gives 言います and 称します. Found on デジタル庁's notice of the
GSS incident.

### Japanese: 「3つ」「三つ」「２つ」 are a number and a counter (#170)

IPADIC reads the つ after an Arabic numeral as the classical perfective auxiliary (the つ of 行きつ戻りつ) and 「三つ」
「２つ」 as one ordinary noun, so a count written with つ was neither a quantity in the structure tree nor a number and a
counter in the tokens. lang-ja now reads both as a numeral (`NumType=Card`) and the counter つ (`NounType=Class`),
the same way it reads 「三人」. The perfective つ after a verb, 「三つ巴」 and the kana 「ひとつ」 are unchanged. A count
followed by 目 or め (「3つ目」「2回目」「1 行目」「二日目」「一つめ」「3つめ」) is a position, not an amount, and is no longer a quantity, like
「第3条」.
What moves: a sentence ending in a count (「理由は3つ。」) is a noun ending for `taigen-dome-in-prose` rather than a
plain-style predicate for `no-mixed-desumasu`, and a heading that opens with a count (「## 4 つで足りないとき」) is no
longer read as numbered article 4, which also removes the `dangling-reference` that reading caused.

### `no-mixed-desumasu` reads 「〜下さい」 as polite, like 「〜ください」 (#170)

A polite request written with the kanji 下さい (「ご意見をお寄せ下さい。」) was read as plain: the analyser gives its
dictionary form as 下さる, not くださる, so it matched neither the written form nor the dictionary form in the polite word
list, and a です・ます list of such requests was reported. lang-ja tokens now carry the analyser's reading, and a word is
polite when its reading and part of speech are those of a one-word entry in the list: 下さい and ください are both
クダサイ. 「来て下さる。」 (クダサル) stays plain, and a noun or a word read the same way with another part of speech does not
match. 頂きます, 致します and 御座います needed no change: their ます already makes them polite. A document that wrote
下さい throughout may now have its real plain sentences reported, where the 下さい sentences had hidden them among a
larger plain count. Found on 厚生労働省's call for public comment.

### A weekly run compares the documents kept as URLs (#170)

A scheduled workflow (`chaff corpus (URL-only documents)`) fetches every document the corpus keeps only as a URL and
compares it with `corpus/expected.txt`, which pull requests cannot do. A changed result opens an issue, or comments on the
open one, with the changed lines; a document that cannot be fetched is skipped and named in a warning.

### `no-mixed-desumasu` judges a run of numbered paragraphs on its own, like a list (#170)

A procedure guide states the conditions of a rule as paragraphs that open with a number, `（1）…であること。`
`（2）…を受けていること。`, in plain form inside です・ます prose: the same convention as a bulleted list, written without
list markup. Paragraphs that open with a line the language package reads as a numbered item, separated only by blank
lines and holding at least two numbered lines, are now judged against each other and not against the prose, as a list
is. A number followed at once by a particle (`（1）の金額は…`) points at an item and opens prose, not an enumeration. A
mix inside such a run is still reported. A single numbered paragraph, or one cut off from the next by prose or a
heading, is still judged with the prose, and so is a numbered paragraph inside an article, where it may be one of the
article's own paragraphs. Found on 国税庁's タックスアンサー.

### `no-nakaguro-parallel` does not count a 「・」 that opens a line (#170)

Japanese notices often write a list with 「・」 as the bullet, one item per line (`・ 水分を補給すること`). When the
items end without 。, the whole list reads as one sentence, and each bullet was counted as a middle dot joining items.
A 「・」 at the start of a line or a sentence, after nothing but spaces, is now read as a bullet and not counted; middle
dots inside an item (`通気性・透湿性`) still count. Found on 文部科学省's notice to schools.

### `duplicate-definition` does not read a heading as a definition (#170)

A heading such as `## 「特別警報」とは` names the term its section goes on to define; it is not the definition. It was
recorded as one, so the body's `「特別警報」とは、…` became a second definition. Definitions are no longer read from
heading lines, in either language; references and quantities in a heading still are. Found on 気象庁's explanation of
special warnings.

### The corpus has a fourth round of document kinds (#170)

Health and safety information (a 厚生労働省 Q&A, CDC), weather and disaster guidance (気象庁, the National Weather
Service, Ready.gov), a notice to schools (文部科学省), a transport press release (国土交通省), calls for public comment
(厚生労働省, a NIST request for information in the Federal Register), a course syllabus (MIT OpenCourseWare, URL
only) and a library newsletter (Library of Congress, URL only). The URL-only agenda of TC39 had not been re-run since
`preamble-length` stopped counting paragraphs without a sentence; its expected line now matches what chaff says.

### `preamble-length` counts only paragraphs with a sentence in them (#170)

A paragraph before the first subheading in which no sentence closes with a full stop, question or exclamation mark is
a label, not a preamble the reader has to get through: a category tag under a press release's date, the names and
affiliations on a report's title page, a template directive or a link to the next page. Those are no longer counted,
the same way date stamps are not. A paragraph with one closed sentence counts as before. Found on 経済産業省's press
releases, an arXiv workshop report and the 18F handbook.

### The corpus HTML converter drops more page chrome by structure (#170)

A link that runs a script instead of going anywhere (`href="javascript:…"`, a print button) is dropped when it stands
alone on its line, and keeps its text inside a sentence. A list above the page's `<h1>` of two or more link-only items
ending in that title is a breadcrumb and is dropped; the same list below the title is kept. A page with neither
`<main>` nor `role="main"` but exactly one outermost `<article>`, and no `<h1>` outside it, is read from that article,
which leaves out a site banner, a header and a licence box around it.

### `latin-spacing` does not count the number of a note in a numbered run of notes (#170)

A white paper lists its notes one per line, each opening with its number and a space (`9 首相にそっくりの…`,
`10 日本経済新聞…`, `11 …`). The space is the note's layout, not a choice between `3 回` and `3回`. A number that
opens a line is now read as a note number when the nearest line before or after that also opens with a number carries
the number one less or one more, unless a word bound to numbers follows it, as for any label (`1 回目`, `2 回目` still count); a conjunction does
not bind a note number (`31 ただし、…`). A number opening a line on its own
(`223 言語に対応`) still counts, as before. Found on 総務省's 情報通信白書 chapters.

### A line that opens with `1.5 万人` or `2.1 億円` is a quantity, not a section (#170)

The Japanese structure reader took a decimal number followed by 万 or 億 at the start of a line for a dotted section
number, so `1.5 万人が参加した。` became section 1.5 headed `万人が参加した。`, could open a false `numbering-gap`,
and its quantity was read as 1万人. The number and the magnitude word are now read as one quantity (15000人), also
without a unit (`1.5 万を超える`). Words that only begin with the character (`万葉集`, `万全`, `万博`, `億劫`), `万一`,
and the words the dictionary splits into a magnitude and a counter (`万葉の世界`, `万年筆`, listed in lang-ja's
`not-magnitude` word list) are not magnitudes, and real sections (`1.5 適用範囲`, `2.1 注文の登録`) stay sections. 兆 and
千 are not read this way yet.

## 0.13.0 — 2026-09-29

Guarded against regressions: CI now compares the committed corpus (statutes included) and the bench on every pull
request, so a change in what chaff says about an existing document fails the build unless it is accepted on purpose. The
corpus gains a third round of kinds — incident reports, research articles, solicitations, press releases, correction
notices, procedure guides, recruitment and sightseeing notices, changelogs — and its converters keep the words a ruby or
a template carried. Fewer false positives in `no-mixed-desumasu` (noun endings, lists judged on their own),
`latin-spacing` (numbers that are names or codes, `Phase 1 は`, masked markup), `max-kanji-continuous` (addresses whose
town the dictionary splits) and `undefined-acronym` (notes after an acronym in brackets). `undefined-acronym`'s notation
words moved into word lists, and every list a rule reads is declared.

📦 [`chaffjs@0.13.0`](https://www.npmjs.com/package/chaffjs/v/0.13.0) ·
[`@chaffjs/lang-ja@0.12.0`](https://www.npmjs.com/package/@chaffjs/lang-ja/v/0.12.0) ·
[`@chaffjs/lang-en@0.11.0`](https://www.npmjs.com/package/@chaffjs/lang-en/v/0.11.0)

### `yarn bench`'s Japanese design sample plants a dropped gloss the rule is meant to catch (#170)

The dropped-gloss plant in the Japanese design sample left one acronym without an expansion besides the planted one
(SAML), below `undefined-acronym`'s `normal` limit, so the miss was the limit working as designed (at `strict` the
rule reports the planted SLA). The English twin reached the limit through "HR system", which the Japanese sample had
translated as 人事システム. The Japanese sample now says HRシステム like its twin, and the plant is found; the clean
sample still gets no finding.

### `latin-spacing` does not count the space after a number written as a label or an identifier (#170)

The space in `「3.1 リサーチの原則」`, `※1 特定の条件`, `2.1 注文の登録` at the head of a line, or after a code with a
part starting with 0 (a postal code `〒102-0094 東京都`, a two-part phone number) separates a label from its title or
from the next item; it is not the choice between `3 回` and `3回`. Those numbers are no longer counted on
either side. A number followed by a counter, a numeral or a particle is still counted wherever it stands (`「10 回」`,
`3-5 日`, `2.1 で`), and so is a number without levels at the head of a line (`223 言語`), which usually counts things,
and so is a number of two hyphen-joined parts without a leading zero (`3-5 営業日`, `1-3`), which may be a range.
The Japanese adapter now reads a counter written after a number and one space (`10 回`, `3 日`, `26.7 万行`) as a
counter, as it does when the two touch; before, the analyser read `日` there as the place name Japan. Found on
デジタル庁's council minutes and 紀美野町's notices.

### The corpus has a third round of document kinds (#170)

Incident reports (Inside GOV.UK, デジタル庁), a research-news article (NIH), a workshop report from arXiv, a funding
solicitation (NSF), changelogs (cloud.gov, NeeView), ministry press releases and a correction notice (経済産業省), a tax
procedure guide (国税庁), a staff recruitment notice and a sightseeing notice (紀美野町).

### `max-kanji-continuous` recognises an address whose town name the dictionary splits (#170)

A municipality the dictionary does not know is split by morphological analysis: 紀美野町 into a personal name and a
place name, 南伊勢町 into a common noun and a place name, 北海道虻田郡 into two place names. Such an address was
reported as a long compound. A single piece between a unit and the next unit (郡 … 町), and two place names closed by
a unit below the prefecture (郡・市・町), now count as one place name. Three or more place names in a row, or two
closed by 都・道・府・県, are still a list (京都奈良大阪神戸市, 北海道神奈川県), and an address followed by an ordinary
word (紀美野町役場総務課) is still reported. The prefecture units come from lang-ja's word list `prefecture-unit`,
which the rule declares; without it the rule is skipped with that reason. Official names of organisations,
programmes and exams stay reported: the analyser tags almost none of them as names, and their shape is the same as a
compound the writer can break.

### `undefined-acronym` accepts an acronym expanded with a note after it in the brackets (#170)

An acronym written as the first item in brackets, followed by a semicolon, comma or 、 and a note, now counts as
spelled out when the words right before the brackets spell it (`Tax Relief Act (TRA; P.L. 1-1)`,
`Data Retention Rule (DRR, effective 2030)`), or when the words after the separator do, up to the closing bracket
(`データ保持規則（DRR、Data Retention Rule）`). The initials are required because the same shape also opens a list
(`(MR, handbook, etc.)`, `(EPA, FDIC, GSA)`), which is still reported, and so are `(see TRA; …)`, where the acronym is
not the first item, and a Japanese name followed by only a year (`（DRR、2030年施行）`). Found on a CRS report
(American Recovery and Reinvestment Act (ARRA; P.L. 111-5)) and 総務省's white paper (オリジネータープロファイル（OP、Originator Profile）).

### `undefined-acronym`'s notation words are word lists, and the rule declares every list it reads (#170)

The words `undefined-acronym` leaves alone next to a number or on their own moved from code into word lists in each
language package: `meridiem` (AM, PM), `time-zone` (UTC, JST, ET …), `currency-code` (USD, EUR, JPY …),
`us-state-code` (the postal codes, read only in an address) and `emphasis-word` (a lone NOT or AND). Japanese
documents get the same lists, since they carry `10:00 JST` and `USD 1,000` too. The contents and the results are
unchanged: the old and new rule were run side by side over generated documents in both languages, over the examples
and over the corpus, with the same findings. The rule now declares these lists and `definition-marker` /
`definition-verb` in `extra_word_lists`. A language package that lacks one of them no longer runs the rule with that
part missing — which reported `3:30 PM`, or an acronym defined with hereinafter, as undefined — but says which list is
missing and does not run it. A language with nothing to list ships the list empty.

### `latin-spacing` reads `Phase 1 は` as a name, and skips codes and markup (#170)

A number after a Latin word and a space (`Phase 1 は`, `iOS 17以上`, `JIS X 0301 和暦`, `Node.js 22 以上`) is part of
the name, so the boundary after it is counted with the letters, as `H30 等` already was; a lone letter before a number
(`1ファイル x 1シート`) is a sign, not a name, and still counts with the numbers. An identifier outside backticks
(`confidence=0 で`) is read as one run. Three or more digit groups joined by hyphens (a phone number `073-489-5909`, a
date `2026-06-02`, a figure number `Ⅰ-4-1-3`) are not a quantity and neither side is counted; a range (`1-3ヶ月`)
still is. A space that only stands for hidden markup, such as the bracket of a link or a footnote reference
(`稼働させた[Google…](…)`, `1on1[^1on1]を`), is no longer read as a space the writer typed. Found on the Japanese
corpus (EchoNote requirements, デジタル庁's machine-readability pages, the Kubernetes overview, a city notice).

### The corpus's converters keep the words a ruby or a template carried (#170)

An HTML page's ruby is read as its base text: the reading and the brackets around it are dropped, also where the page
omits their closing tags, as HTML allows (「隆(たか)一(いち議員」 is now 「隆一議員」). A Wikivoyage page keeps the
quantities, prices, phone numbers and listings that its templates carried: `{{km}}` and `{{ha}}` as a number and unit,
`{{JPY}}` as a yen amount, `{{phone}}` as the number, and `{{vCard}}` as a listing's name and description, where
before each left a hole in the sentence (「全長の道のりです」「1日に約歩く」).

### CI fails when a committed document's result changes (#170)

`chaff ci` now runs `yarn corpus` and `yarn bench`. The corpus compares the committed documents (statutes and
`corpus/docs`) with `corpus/expected.txt`, and statutes are now compared too instead of only printed; documents kept
as URLs are compared locally after `yarn corpus:fetch`. A change that is intended is accepted with `--update` in the
same PR.

### `no-mixed-desumasu` judges only endings with a predicate, and each list on its own (#170)

A sentence whose ending has no predicate — a lead-in such as `出力するファイルは以下の通り。`, a gloss such as
`円錐形の麦わら帽子。`, a sentence cut short before `から` — is neither です・ます nor である, and no longer counts as
plain. `以下の通りである。` still does, and so does a requirement written `予約できること。`, where the verb before the
dependent noun carries the ending. A `！` or `？` followed at once by a particle (`導入しませんか？が断られた`,
`作っていた！！という人`) is inside a sentence, and the text before it is not judged. Prose is now judged against
prose, and each bulleted list (with its nested items) against itself: a です・ます article whose list is written
throughout in plain form, the usual way to write bullets, is consistent, while a list that mixes `記載します。` and
`記載する。` is still reported, and so is a plain sentence in です・ます prose. Found on ja.wikivoyage, dwango's design document and デジタル庁's guides.

## 0.12.0 — 2026-09-29

More kinds of document, checked without judgement: the corpus now has press releases, FAQs, privacy policies,
how-tos, notices, letters, agendas, job descriptions, travel guides, design and requirements documents in both
languages. A new experimental rule, `doubled-word`, catches a word written twice ("our the", をを). Word lists carry
more of the knowledge that was in code — the acronyms a reader knows, the words that qualify a superlative — and a rule
that needs a word list its language lacks says so instead of running. Fewer false positives from page furniture (in-page
navigation, date stamps, empty headings), English proper nouns and adjectival participles, and acronyms defined with
以下 / hereinafter or written beside a time or an amount.

📦 [`chaffjs@0.12.0`](https://www.npmjs.com/package/chaffjs/v/0.12.0) ·
[`@chaffjs/lang-ja@0.11.0`](https://www.npmjs.com/package/@chaffjs/lang-ja/v/0.11.0) ·
[`@chaffjs/lang-en@0.10.0`](https://www.npmjs.com/package/@chaffjs/lang-en/v/0.10.0)

### `doubled-word`: a word written twice (#170)

A new experimental rule. It reports a word written twice in a row — `the the`, `is is`, 「資料をを」, 「確認確認」 —
across a line break and regardless of case, and in English two determiners where one belongs (`our the platform`,
`a the`). Same word means the same surface and the same part of speech, so `that that` (a conjunction and a
demonstrative) is left alone; the determiners are the articles and the possessives, which `@chaffjs/lang-en` now
marks with the Universal Dependencies features `PronType=Art` and `Poss=Yes` (the articles are a lexicon, `article`;
"her", an object as often as a possessive, is a lexicon `object-or-possessive` and not marked). A capitalised word
inside a sentence followed by the same word in lower case is a name and the next word ("Payment for May may be
delayed"). Interjections, adverbs, proper nouns, numbers and symbols are not counted: repeating them is emphasis or a
name (「そうそう」, "very very", "Walla Walla"). A Japanese noun of a unit or an occasion doubled to mean "each" and
followed by a particle (「会社会社で」「部署部署の」「場面場面で」) is marked `Echo=Rdp` by `@chaffjs/lang-ja` and left
alone; the nouns and the particles are lexicons (`distributive-noun`, `distributive-particle`), so 「資料資料の」 is
still reported. Other repeats a language allows are a lexicon (`doubled-word`) in each language package: "had had",
"do do", "her her", "sign in in advance", 「一つ一つ」. The position is the second word. The rule needs parts of speech
and says so when a language has none. Found on cloud.gov's API v2 notice in the corpus ("our the platform").

### A superlative that states its scope is not reported (#170)

`unqualified-superlative` no longer reports a superlative that says what it is the most of: a name and で before it
(日本で最も有名な, トヨタで最も), a noun joined to it (国内最大, 業界最速, 世界唯一の), or in / of and a noun phrase after its
noun phrase ("the best pizza in Chicago", "the most famous of the sculptures", "the best of the three"). The rule reads
the parts of speech, and the scope words come from each language package's `superlative-scope` word list, where each
word says which side of the superlative it stands on (`position: before` or `after`). A common noun before で is a means, not a scope (最少の費用で最大の効果 is still
reported), and so are 「最も効果的です」 and "the best solution" with nothing around them. Found on ja.wikivoyage and on
GitLab's and 18F's handbooks.

### The words that give a superlative its comparison are a word list (#170)

`unqualified-superlative`'s words that name a comparison (より, に比べる, のうち / among, than, compared, based on,
according) moved from a regular expression in code into each language package's `comparison-marker` word list, matched
word by word like every other list: "thanks", "accordingly", "amongst" and そのうち no longer count as a comparison, and
「に比べると」 still does. A digit in the sentence still qualifies it. A rule can now declare the lists it reads besides its
`word_list` (`extra_word_lists`); a language package without one of them does not run the rule and says why.

### `undefined-acronym` accepts an acronym defined in brackets with 以下 or hereinafter (#170)

An acronym written as a definition inside brackets now counts as spelled out: `Human Resource(以下、HR)`,
`人事部（以下「HR」という。）`, `Service Level Agreement（以下「SLA」）`, `Service Level Agreement (hereinafter "SLA")`,
`(the "SLA")`, `(aka the "GDPR")`. The words come from two new word lists in each language package,
`definition-marker` (before the acronym: 以下, the, hereinafter, aka …) and `definition-verb` (after it: という, と称する
…); a language without them keeps the older forms only. The brackets must hold nothing but those words, quotes and the
acronym, so `（以下のSRE手順）` or `(the SRE team)` still report SRE. Found on 総務省's white paper, NTT Com's onboarding
handbook and Automattic's privacy policy.

### `latin-spacing` reads a name ending in a digit as a Latin word (#170)

A run that starts with a letter and ends in a digit (`H30 等`, `EC2 で`, `IPv6アドレス`, `v1.2の`) is now counted with
the letters, not with the numbers: a writer spaces it the way they space `API を`, whatever they do after `3日`. Before,
a document that spaces Latin words and glues numbers had `H30 等` reported as a spaced number. A run that starts with a
digit (`3GBの`) still counts with the numbers. Found on デジタル庁's specification of the machine-readability checker.

### The corpus has travel guides, an onboarding handbook, a design document, a requirements document, manuals and a town's notices (#170)

`yarn corpus` now also runs on two ja.wikivoyage articles (四国八十八箇所巡礼, 下田市), NTT Com's onboarding handbook,
dwango's design of its Kubernetes manifest generator, a requirements document for a note-taking app, a 国土地理院 how-to
(URL only), two guides of デジタル庁's machine-readability checker (公共データ利用規約（第1.0版）with attribution), and a
mayor's report and a notice of 紀美野町 (committed: its site terms follow 政府標準利用規約（第2.0版）, with attribution). The
HTML converter reads the element marked `role="main"` when a page has no `<main>`, so a town CMS's menus and text-size
buttons are not read as the page's preamble.

### The list of acronyms a reader knows is a word list (#170)

`undefined-acronym`'s list of acronyms that need no spelling out (API, URL, CEO …) moved from code into each language
package's `common-acronym` word list, so it can differ by language (NG is understood in Japanese documents). The
contents are unchanged. The rule declares the list, so a language package without it does not run the rule and says why,
instead of reporting API and URL.

### A heading with no title is not a heading (#170)

A heading with no letter or digit in it — `###` alone, `## ---`, `### ** **`, `## ※`, a heading holding only an
attribute or an image — is a separator (often an empty `<h3>` left by a converter), not the start of a section a
reader can find. chaff no longer counts it as a heading: the text on both sides stays in one section for every rule
that reads sections, and `chaff tree` opens no untitled section for it. `preamble-length` therefore no longer takes an
empty `###` for the start of the body: a press release whose only deeper heading is empty has no subheading, and gets
no finding. Found on a GSA press release in the corpus.

### `undefined-acronym` leaves times, amounts, US addresses and emphasised NOT / AND alone (#170)

Capitals that belong to a fixed notation next to a number are no longer taken as acronyms: AM / PM and a time zone
after a clock time (`3:30 PM`, `2pm ET`, `16:00 UTC`), a major currency code before or after an amount
(`USD 1,000,000`, `250 EUR`), and a US state code in a postal address (`Kansas City, MO 64108`). Away from the number
they are still reported, because the same letters are also real acronyms (PM for project manager, CA for certificate
authority). A lone `NOT` or `AND` written in capitals is emphasis. TIP (a callout label, like NOTE) and USA (like US)
join the common acronyms. A capitalised ordinary word such as CASH, FAIL or a template placeholder (LINK) is still
reported: nothing in the text tells it apart from a real acronym that spells a word (CREDIT, SAFE, HUB).

### `preamble-length` does not count a page's date stamp (#170)

A paragraph that is only a date (`2025年6月20日`, `April 23, 2026`), a label and a date (`Updated 2026-03-03`,
`最終更新日：2025年6月20日`), or a label ending in a colon followed by a date-only paragraph (「最終更新日:」 then the
date) is page metadata, not preamble, and is no longer counted before the first heading. A date inside a sentence still
counts. Dates are read by the language package's date reader, and the labels are a lexicon (`date-stamp-label`) in
each language package. Found on every デジタル庁 page in the corpus.

### `agentless-passive` leaves an English participle that describes a state alone (#170)

"We are delighted to offer", "The report is based on a survey", "you are entitled to", "while you are logged in to
your account" are no longer reported: be + past participle there names a state, and there is no hidden actor to name.
The participles are a lexicon (`stative-participle`) in `@chaffjs/lang-en`, together with the adverbs of degree
(`degree-adverb`: "very surprised") that only a state takes. Real passives stay: "The decision was
made.", "No additional approvals are required.", "Errors are logged in the console." Found on offer letters, privacy
policies, contracts and handbooks in the corpus.

### `heading-echo` leaves a sentence that introduces a list alone (#170)

A first sentence that hands over to the list or table below it — one ending in a colon (`The following expenses
require receipts:`), or one with the language's hand-over phrase (「次のとおりとする。」, "as follows") — is no longer
reported, even when it repeats the heading's words: what the heading promised is in the list. One with nothing after
it in its section is still reported. The phrases are a lexicon (`lead-in`) in each language package. Found on FAQs, privacy
policies, specifications and 就業規則 in the corpus.

### The corpus has press releases, FAQs, privacy policies, how-tos, notices, letters, agendas and job descriptions (#170)

`yarn corpus` now also runs on a GSA news release, the TTS travel FAQ, a cloud.gov how-to and service notice, and
デジタル庁's announcement, privacy policy, recruitment FAQ and recruitment notice (committed: public domain, CC0, or
公共データ利用規約（第1.0版）with attribution), and on Automattic's privacy policy and offer letter, a TC39 meeting agenda,
a GitLab job description and a Japanese README (URL only).

### In-page navigation is not prose (#170)

A Markdown paragraph made only of links into the same page (`](#…)`, or a reference link whose definition points to
`#…`) and marks such as ▲ ↑ | ・ — a "back to contents" line after every section, or the entries of a table of
contents — is page navigation, not prose, and is no longer read as sentences. A list made only of such entries is not
counted as a list either (`rule-of-three`). This stopped `repeated-sentence-head` from firing on a repeated
`[▲ 目次に戻る](#目次)`, and a table of contents no longer sets the document's spacing majority for `latin-spacing` or
counts as the first use of an acronym. A paragraph where a link sits among other words, and links to other pages, are
still read.

### lang-en only counts capitalised words as proper nouns (#170)

The English tagger marks words it does not know as proper nouns, so `proper-noun-density` counted lowercase words
(linters, json, the e of e.g.) and marks (—, $). lang-en now checks the tag against the spelling: an English proper
noun is capitalised, so a tagged word with no capital is a common noun, and one with no letters is a number, a symbol
or punctuation. Names such as Chicago and acronyms such as HTTP are still proper nouns.

## 0.11.0 — 2026-09-29

Brushed up against real documents: a corpus of Japanese and English reports, minutes, specifications, contracts,
itineraries and internal notes, and a bench that plants mistakes and measures what chaff misses. Japanese checks now
rest on morphological analysis — word lists match by base form, and addresses, numbers written in kanji and place
names are recognised by part of speech rather than by pattern lists. False positives fell across `undefined-acronym`,
`ngram-repetition`, `repeated-sentence-head`, `oxford-comma-consistency` and `agentless-passive`, and `chaff --version`
prints the installed packages.

📦 [`chaffjs@0.11.0`](https://www.npmjs.com/package/chaffjs/v/0.11.0) ·
[`@chaffjs/lang-ja@0.10.0`](https://www.npmjs.com/package/@chaffjs/lang-ja/v/0.10.0) ·
[`@chaffjs/lang-en@0.9.0`](https://www.npmjs.com/package/@chaffjs/lang-en/v/0.9.0)

### Word lists are matched by words and their base forms (#170)

The rules that read a word list (`sasete-itadaku`, `double-keigo`, `excessive-hedging`, `cushion-phrase-density`,
`padded-intro`, `closing-cliche`, `empty-intensifier`, `unqualified-superlative`, `ai-tell`, `hiragana-fukushi`,
`repeated-conjunction`) now split each entry with the same morphological analyser as the document and match it
word by word instead of as a substring. A verb or auxiliary written in its base form matches every conjugation
(させていただく matches させていただきました); a form written inflected matches only that form ("could" does not match
"can"). An entry no longer matches inside another word (また in またいで, 念のため in 概念のため, 最大 in 最大限,
"in addition" in "gain additional"), and a phrase broken across a line is found. The entries that were cut short to
catch every ending (させていただ, おっしゃられ, 果たし, 掘り下げ) are written in their base form. The rules declare `uses: [pos]`; without
the analyser they match the text as before, with runs of whitespace taken as one space.

### The corpus's HTML conversion drops more page chrome (#170)

Converting a fetched page now also drops navigation marked by `role="navigation"` or a breadcrumb label, a breadcrumb
trail of links joined by `>`, a block made only of links (previous/next links, a menu without a list), a line of
in-page links and marks such as `▲`, and a copyright notice closing the page. Each is recognised by structure, not by a
site's class names or wording; a block of card links that carry a title and a summary is kept.

### `oxford-comma-consistency` judges only real lists (#170)

An introductory comma (`After the review, the team fixed the bug and shipped it.`) or a comma joining two clauses is
no longer read as a list. A sentence counts only when at least two comma-separated items come before the final
and / or and share the shape of the item after it; commas inside parentheses, adjectives stacked before a noun and a
subject split from its verb do not make items.

### `agentless-passive` leaves English passives in relative clauses alone (#170)

`the report that was published last week` describes the report; it does not hide who acted in the sentence. As in
Japanese, a passive that only modifies a noun is not reported, while `The decision was made.` still is. English
past participles now also carry `VerbForm=Part`.

### `max-kanji-continuous` recognises an address by morphology (#170)

The regular-expression list that told an address (東京都港区新橋二丁目) from a long compound is replaced by morphological
analysis: lang-ja marks place names and their suffixes (IPADIC 固有名詞,地域 and 接尾,地域) with the UD feature
`NameType=Geo` (units such as 都 and 区 as `GeoUnit`, counters such as 丁目 as `NounType=Class`), and a run of kanji made only of place words, numbers and a counter after a number is an address; places listed without units (東京大阪名古屋) are not. An
organisation name that starts with a place (日本経済団体連合会) is still a long compound. The rule declares
`uses: [pos]`; without tagging it counts every run, as it did before addresses were exempt.

### `total-mismatch` adds a table column of bare numbers (#170)

A table column whose cells hold only numbers, with the unit in its header (`| Room | Hours booked |`), is now added up
against its total row. It is added only when every cell above the total is a number and the total is larger than each
item. A column headed with %, or holding only same-width numbers written without commas (years, IDs), is left alone,
as is a column mixing bare numbers and amounts with a unit; lists are read as before. A negative total is shown with its
sign.

### English sentences end after a number (#170)

"We opened in 2026. We shipped in May." is now two sentences. sentence-splitter read any number followed by a period
as a list number and never ended a sentence there, so `max-sentence-length` reported long sentences that were two, and
per-paragraph sentence counts came out low. A number that starts its line ("1. First item"), or is followed by a
lowercase word, is still not a sentence end.

### `concrete-evidence-density` counts numbers written in kanji (#170)

A section that gives `二割`, `十五分`, `一件` or `一万円` now counts as holding a concrete number, like one with digits.
lang-ja marks a word its morphological analysis reads as a number (IPADIC 名詞,数, written in number characters) with the
UD feature `NumType=Card`, and the rule looks for that feature in any language. Set phrases the dictionary holds as one
word (一人ひとり, 二人三脚, 三日坊主, 十分) are not numbers, and neither are 数年 or 何人.

A rule can now declare `uses: [pos]`: part-of-speech tagging is prepared when such a rule runs, but unlike
`requires`, the rule still runs without it. `concrete-evidence-density` and `ngram-repetition` use it, so their
morphology-based judgement no longer depends on some other tagging rule happening to be on.

### `yarn bench` plants mistakes for more rules, in more kinds of document (#170)

The seeded-mistake benchmark now also plants a joined paragraph, a heading echoed by its first sentence, heavy bold,
emoji and dashes, team jargon, a dropped required section, glued kanji, a middle-dot list, doubled honorifics,
overused 「させていただく」, kanji adverbs, agentless passives, expletive openings, a flipped Oxford comma and a recased
heading. New self-written samples in both languages cover a press release, an email, a proposal, a report with a
table of figures, a README and a blog post. A mistake is planted only where its rule runs (its languages and genres),
and the bench passes the team's jargon and required sections as `chaff.yaml` would.

### Japanese government reports, minutes, plans and specifications in the corpus (#170)

The corpus now holds pages from 総務省's 情報通信白書 (URL only) and デジタル庁's annual report, council minutes, policy
plans and data specifications (committed under 公共データ利用規約（第1.0版）with attribution). `yarn corpus:fetch` reads a
page in the encoding it declares (Shift_JIS as well as UTF-8), and the HTML conversion reads only `<main>` when there is
one and drops asides, footers, forms, XML declarations and lists made only of links.

### `repeated-sentence-head` leaves list items alone (#170)

Items of a list are written in parallel on purpose (`1. SRE に関するカンファレンス…`, `2. SRE に関する…`, "Take a look
at …"), so a run of sentences opening the same way no longer continues from one item to the next. Prose before and
after a list does not join into one run either. Inside one item's paragraph, or in running prose, runs are reported as
before.

### `ngram-repetition` counts phrasing, not the name of the subject (#170)

A long report naturally repeats its subject (`state and local tax`, `the HTTP status code`, `the Disclosing Party`), and
that was reported as repeated phrasing. With part-of-speech tagging, a repeated phrase now counts only if the part of
the sentence it covers holds a verb or an auxiliary (`ることができます`, `it is important to`). In English a verb right
before a noun or adjective is a modifier (`the upcoming fiscal year`), not a predicate. Without tagging, the rule
behaves as before. Found across the corpus's reports, RFCs and contracts.

### The corpus's wikitext conversion closes the gaps left by dropped templates (#170)

A Wikivoyage template the converter drops no longer leaves a space before punctuation (`Airport , but`) or a double
space in the text chaff reads.

### Japanese 「3.2節」「第3章」「3.2.1項」 are references (#170)

`dangling-reference` now reads a section, chapter or clause written in Arabic numerals in Japanese prose (「3.2節」,
「3.2 節」, 「３．２節」, 「第3章」, 「3章」, 「3.2.1項」) and reports it when the document has no such heading. A chapter
matches `## 第3章` (also under a `#` title) or `## 3. …`. Counts (「全3章」, 「3章構成」), other words (「3.2節約」,
「3項目」), versions, dates and a heading's own number are not read. Statute addresses in kanji (第三章, 第二節) keep
their own path.

### `undefined-acronym` no longer counts shouting, requirement words, identifiers or licence names (#170)

A run of capitalised words (a disclaimer, “AS IS”), the RFC 2119 words (MUST, SHOULD, MAY …), identifiers joined to
digits (`AC-2`, `MS.TEAMS.1.1v1`) and `CC BY` are not acronyms. `ATT&CK` and `M&IE` are one word. An expansion may
also be `Tax Cuts and Jobs Act [TCJA]`, carry quotes (`(“MNDA”)`), or sit next to any use, not only the first.
`concrete-evidence-density` names a section without a heading by its opening words, not by a fixed Japanese word.

### Page headers and footers of a paged text are not prose (#170)

A plain-text document copied from paper, such as an RFC, repeats a footer and a header around every page break
(`\f`). They are no longer read as sentences, so they stop counting as a repeated phrase or a long sentence. Markdown
documents are unchanged. Found on RFC 3693 in the corpus.

### `--compact` ends with a tally in the document's language (#173)

On a Japanese document, the last line of `--compact` now reads `指摘 6 件、動いていない rule 33 件` instead of
`6 findings, 33 rules not run`, like the rest of the screen. The severity word on each line (`warning`, `error`) stays in
English, because tools read it. English documents are unchanged.

### The corpus has English reports, requirements, contracts, itineraries and internal docs (#170)

`yarn corpus` now also runs on CRS reports, requirement and design documents (a CISA baseline, an F Prime SDD, a
requirements RFC), standard contracts (Common Paper, Bonterms), Wikivoyage itineraries, and 18F handbook and guide
pages. Public-domain ones are committed; the others keep only a pinned URL. A manifest entry can name its source
`"format"` (`wikitext` or `html`); `yarn corpus:fetch` stores such a source converted to Markdown.

### `yarn bench` measures what chaff misses (#170)

Self-written samples in Japanese and English (itinerary, quote, minutes, design doc, requirements, policy, note) get one
planted mistake at a time: a wrong weekday, swapped rows, a dropped item, a broken reference, a skipped number, a second
definition, joined sentences, a mixed register, nested 「の」, a dropped acronym expansion. Per rule, it counts which ones
chaff finds near their line and what it reports on the clean samples, against `test/fixtures/bench/expected.txt`
(`yarn bench --update` accepts a change).

### `chaff --version` (#174)

`chaff --version` (or `-v`) prints the version of chaffjs and of the language packages it bundles, one per line, and
exits 0. Before, `--version` was taken for a file to check.

### A plain-text specification's top-level sections are read (#170)

In a `.txt` document written like an RFC, a top-level heading such as `5.  Security Considerations` (a number, a dot,
two spaces and a short title that is not a sentence) is now a section, so `See Section 5` finds it. Markdown documents
are unchanged: a one-level number there is still a section only in a heading. Found on RFC 9457 in the corpus.

### lang-ja reads 「1.2 万円」 as 12000 yen (#170)

A number written with a space before 万, 億 or 兆 (`1.2 万円`, `26.7 万行`, `3 億円`) was read as two numbers, so the
amount became 10000. It is now one number. Without part-of-speech tagging, `1.2万円` was also read twice (1.2 万円 and 10000
yen); it is now one amount. This matters to `total-mismatch`, which adds such amounts.

### `undefined-acronym` knows more common acronyms (#170)

Acronyms most readers know without an expansion — DNS, IP, TCP, SSH, TLS, UTF, PC, IT, SDK, PNG, GB, CEO, US, EU and
similar — are no longer reported. Field and in-house acronyms (KEP, SIG, EMEA, APAC) still are. Found on the Kubernetes
docs and the GitLab Handbook in the corpus.

### `max-kanji-continuous` does not count a postal address (#170)

An address such as 東京都港区新橋二丁目 is written the only way it can be, so it is no longer reported as a long run of
kanji. lang-ja names what cannot be split in a new word list, `unsplittable`; a run of kanji is exempt only when the whole run matches, starting with a prefecture, or a
city, ward, town or village ending in 丁目. Other long compounds (東京都知事選挙管理委員会事務局) are still reported.

### `no-mixed-desumasu` counts 「〜ください」 as polite (#170)

「〜ください」 was read by its dictionary form 「くださる」, which is not in the polite word list, so a polite document
ending with 「詳しくは〜をご覧ください。」 had those sentences reported as the odd ones out, and a plain document hid a
polite 「〜してください。」. A sentence ending is now matched by how it is written as well as by its dictionary form, and
only the ending is read: a polite phrase quoted mid-sentence (「ご覧ください」という表現を使う。) no longer makes a plain
sentence polite. Found on the Kubernetes Japanese docs in the corpus.

### lang-ja places words where they are written (#170)

kuromoji's word positions drift after a cluster of symbols (`)、`, `**、`) or an emoji, so from there on every word in
the paragraph carried a position one or more characters too early. A word from the next sentence could land in the
previous one, and numbers and dates were read from the wrong characters (`2026年8月1日` came out as `06-08`). lang-ja now
places each word by matching its text against the paragraph. Found on the Kubernetes Japanese docs in the corpus.

### English reads bracketed citation tags as another document (#170)

A reference written with a citation tag in capitals, as RFCs cite, is no longer looked up in this document:
`Section 15 of [HTTP]`, `[HTTP], Section 12.1`, `[URI], Section 5`. Found by running chaff on RFC 9457 in the corpus.

## 0.10.0 — 2026-09-28

Consistency and arithmetic: three experimental rules check what a schedule or a quote says against itself — a weekday
beside the wrong date, a date out of order, a total that is not the sum of its items. Sentence splitting stays fast on
one long paragraph, English screens read naturally, and more statute knowledge moved out of code into the `statute`
profile and lang-ja's word lists.

📦 [`chaffjs@0.10.0`](https://www.npmjs.com/package/chaffjs/v/0.10.0) ·
[`@chaffjs/lang-ja@0.9.0`](https://www.npmjs.com/package/@chaffjs/lang-ja/v/0.9.0) ·
[`@chaffjs/lang-en@0.8.0`](https://www.npmjs.com/package/@chaffjs/lang-en/v/0.8.0)

### lang-ja reads other documents' names from word lists (#151)

The words that make another document's name (`民法第709条`, `契約書第6条`) — the kinds of document, the law titles that
contain kana, the promulgation note after a title, and 本/当 for this document — moved from lang-ja's code into its word
lists (`document-kind`, `kana-title-kind`, `name-note`, `self-prefix`). They stay in the language package, not the
`statute` profile, because contracts and other documents cite laws too. Output is unchanged.

### Old-style paragraphs come from the statute profile (#151)

Old statutes number no paragraph after the first; an indented line inside an article whose line carries body text is
the next paragraph. lang-ja used to decide that on its own; the `statute` profile now states it
(`unnumbered: { indent, inside, depth }`), and core applies it. The tree is unchanged for documents read as statutes.
A document without the `statute` profile (fewer than three article lines and no `profile:` setting) now reads such a
line as body text of the article. Set `profile: statute` for a short excerpt.

### The 読み替え rule comes from the statute profile (#151)

A reference inside a 読み替え quote (「第九十九条」とあるのは「第百条」) belongs to the text being read in, not to
this document. lang-ja used to decide that on its own; the `statute` profile now states it once
(`relative.substitution`, with a new `document` field naming what such references point to), and core applies it.
Two visible differences: a quote after 「とあるのは、」 (with the comma) is now read as a 読み替え too, as it already was
for 前条 and 同項; and a document without the `statute` profile (fewer than three article lines and no `profile:`
setting) no longer treats these quotes specially. Set `profile: statute` for a short excerpt.

### `total-mismatch`: a total that is not the sum of its items (#142)

A new experimental rule. In a list or a table, a line starting with a total word (`合計`, `小計`, `Total`, `Subtotal`)
is compared with the amounts above it in the same unit and column, and a total that matches no way of adding them up
is an `error` (`The total $1,600.50 is not the sum of the amounts above it ($1,500.50)`). A subtotal followed by tax
and a total, and a grand total of subtotals, are accepted. Discounts written `-$50` or `▲50,000円` are taken away.
Amounts in parentheses, a column with another unit, and a line with two amounts in one column leave the total
unjudged. The total words are a `total-label` word list in each language package.

### Sentence splitting stays fast on one long paragraph (#141)

A long paragraph with no blank lines (a `.txt` file, a long list) no longer makes sentence splitting slow down with
the square of its length. Both language packages now cut the paragraph where sentence-splitter has closed a sentence
and holds no open bracket, and split each piece on its own. The sentences and their offsets are the same as before;
this is checked against the splitter itself over generated text in `test/test_sentence_split_chunks.ts`.

### `date-order`: a date out of order in a schedule (#142)

A new experimental rule. In consecutive list items or table rows that each hold one date, a date that goes against
the direction of the rest is a `warning` (`2026-04-15 breaks the order of the dates around it (after 2026-05-01)`). The direction is taken
from most of the steps, so a newest-first history is a right order; a sequence with as many steps each way, a line
with two dates, dates of different precision, and dates in running text are not judged. It reads the dates the language
packages already normalise, so it works the same in any language.

### `date-weekday-mismatch`: a date and its weekday disagree (#142)

A new experimental rule. A date written with its year and its weekday (`2026年10月1日（金）`, `Friday, 1 October 2026`)
is checked against the calendar, and a wrong weekday is an `error` that says which day it really is. A date without a
year, and a weekday that is not right beside a date, are not checked. The language packages read the weekday
(`（木）`, `木曜日`, `Thursday`, `Thu`, `(Thursday)`), and name the days in a `weekday` word list; core compares.

For adapter authors: a date mention may carry `weekday` (0 = Sunday), and a `weekday` lexicon names the days.

### English screens read naturally (#158)

On an English document, words chaff lists are joined with `, ` instead of `、` (`No heading for "Risks, Costs"`);
`internal-jargon` says a phrase "may only be understood inside your team"; jargon is matched regardless of case, so a
phrase at the start of a sentence is found; and the compact tally says `1 finding` and `1 rule not run`.

## 0.9.0 — 2026-09-28

What statutes and contracts showed once chaff read them whole: knowledge of a kind of document now lives in YAML
(a bundled `statute` profile), relative references like `前条` and `同項` are read and checked, English reference
lists and Part-level definitions are read as written, and a document chaff could not read says so instead of passing.

📦 [`chaffjs@0.9.0`](https://www.npmjs.com/package/chaffjs/v/0.9.0) ·
[`@chaffjs/lang-ja@0.8.0`](https://www.npmjs.com/package/@chaffjs/lang-ja/v/0.8.0) ·
[`@chaffjs/lang-en@0.7.0`](https://www.npmjs.com/package/@chaffjs/lang-en/v/0.7.0)

### A document whose numbered clauses could not be read says so (#140)

Contracts taken out of PDFs often have their clauses indented deeper than a numbered line, or run into the text,
so the tree held almost none of them and the structure rules reported nothing — which read as "checked and fine".
When the text has at least five clause numbers (`11.3. Liability Cap`, or `1.   TERM` at the start of a line) and the
tree read fewer than a quarter of them, `dangling-reference`, `numbering-gap` and `duplicate-definition` are listed as
not run, with both counts. A clause number in running text counts only after a sentence break, so `Version 1.2
Released` and `Figure 2.1 Revenue` do not. Many of CUAD's SEC-filed contracts (not committed) are now reported this
way; none of the committed documents is.

### English: a definition "In this Part" is compared within the Part (#140)

Definitions after `In this Part—` were held to their own section, so a word defined twice inside one Part, in two
sections, went unreported. They are now compared within the Part (`In this Chapter` within the Chapter); two Parts
may still define the same word. Definitions in sections that declare no scope are compared across the document, as
before. A document with no Part heading keeps the section as the scope.

For adapter authors: `StructurePatterns.definitionScopeDepth` is new and optional (the depth of the unit a scope
line covers).

### English: every member of a reference list is checked (#140)

In `Sections 1, 2 and 9`, only `Sections 1` was a reference, so a missing Section 9 went unnoticed. Each member is now
a reference with the list's numbering and document (`sections 5(7), 29(2) and 9 of the X Act` all point into that
Act). A member that is only parentheses stands beside the part written the same way: `45(3)(b) and (5)` is 45.5,
`58(2)(c) to (g)` is 58.2.g. After a singular word, a number is a member only where the list goes on or ends, so
`Section 3 and 4 days` does not name Section 4. A member with a letter (`45A`) is not read, as the reference itself
would not be.

### English: inserted subsections `(A1)` and `(2A)` are read (#140)

An amendment inserts a subsection between two others and numbers it `(A1)` or `(2A)`. lang-en did not read these,
so the lettered items under `(A1)` became the section's own and `(1)` nested under `(b)`. They are now subsections
outside the sequence (no ordinal, so `(1)` after `(A1)` is still the first, and no numbering gap is reported). The
three UK Acts in the corpus get their subsections right; lint output is unchanged.

### Relative references are read and checked, in a statute (#138)

With the `statute` profile, `前条` `次項` `同号` `本条` `前各項` `前二項` `前条第二項` and an address written without
its article (`第一項`, `第二号`) get an address from where they are written, so `dangling-reference` checks them like
`第二十条第一項`. `前・次` count within the same article or paragraph (articles across the whole document); `同` is the
last address named at that depth, so `前項` does not change what `同条` means. A bare address continues a list
(`第三十三条第七項若しくは第九項`, `第二十七条（第四項を除き、第五項…）`). Inside a 読み替え quote they are not read,
and one that cannot be placed (the `前条` of the first article, one after `別表第一第一号`) is left out rather than
guessed. The words, units and list joiners are all in the profile's `relative` section. A reference into another law
written with an abbreviation in its law-number note (`…（平成十三年法律第百四十号。以下「X」という。）第二条`) is now read
as that law's.

### A caption line before an article is its heading, in a statute (#138)

A statute puts an article's caption on the line above it (`（解雇の予告）` then `第二十条　…`). With the `statute`
profile, that line becomes the article's `:heading` in `chaff tree`, when the article has none of its own. The shape
of a caption is the profile's `caption` pattern, so the code knows nothing about brackets. An article written
`第1条（目的）` keeps its own heading, and old-style paragraphs under a captioned article are still read.

### Document profiles: knowledge of a document type lives in YAML (#146)

What is true only of one kind of document now lives in `packages/chaff/profiles/*.yaml`, not in code. The first
profile is `statute` (Japanese). It holds the address grammar that `max-kanji-continuous` skips (#139): the pattern
of `第二十二条第二項` and the words that join addresses. A profile is chosen by `by_path` → `profile`, then
`profile:` in `chaff.yaml`, then the profile's own `detect` pattern (for `statute`, three or more lines shaped like
`第一条　`). `profile: none` turns it off, and `chaff tree` shows the choice as `:profile`. A Japanese document that is
not a statute no longer has its addresses skipped; name the profile to get that.

### `前二項` and `前三条` are not quantities (#138)

A statute's `前二項` means "the two preceding paragraphs": an address, not the quantity 2 項. The `statute` profile
lists `前` + kanji numeral + a statute unit (`条 項 号 章 節 款 目 編`) as an address, and a number inside any profile
address is not a quantity. `前二年` (the previous two years) still is. Without a profile, `前二項` is read as 2 項.

### `max-kanji-continuous` does not count legal addresses (#139)

`第二十二条第二項` and `第五十二条の二第一項` are how a statute writes an address, in kanji numerals, and cannot be
broken up; `第` and `条` / `項` / `号` already show where the words break. An address made of `第`, a kanji numeral and
a unit (`条 項 号 章 節 款 目 編`, with an optional `の` branch number) is no longer counted, and splits the run it sits
in — when what follows is not kanji, another address, or a word statutes attach to one (`各号`, `及`, `本文`, `後段`, …).
`第一条件` and `第十項目` are words, not addresses, and are still counted. A long compound beside an address
(`独立行政法人等情報公開法第五条`) is still flagged.

### Report a wrong or missed finding from your own document (#133)

`npx chaffjs feedback <file> --rule <rule-id> [--line N]` (a wrong finding) or `--missed --line N` (something
chaff should have said) writes an issue draft to `.chaff-feedback.md`: chaff's version, Node and OS, the file
name, language and genre, one finding and its message, only the two lines on each side of it — never the whole
document — and the reported rule's own setting in `chaff.yaml` (all of it only with `--with-config`). When a rule
has several findings in the file, `--line` picks one. It prints a shell-safe `gh issue create …` and a link that
carries the title only, and sends nothing itself. The Claude Code skill points an agent to it when the person disagrees with a finding.

### The structure rules read English statutes

Three UK Acts from legislation.gov.uk — the Data Protection Act 2018, the Consumer Rights Act 2015 and the
Arbitration Act 1996 — join the corpus (Open Government Licence v3.0), and the corpus test now covers each
document in its own language. The English adapter reads them without false positives:

- lowercase references (`section 86(7)`) are read, as statutes write them;
- a list of references ending in another law's name (`Article 58(2)(c) to (g) and (j) of the UK GDPR`,
  `sections 5(7), 29(2) and 9 of …`), a gloss before the name (`section 4(2)(a) (exception …) of the … Act`),
  and `of that Act` all point into the other law, as do references inside a gloss after such a reference;
- a document numbered by Sections is not searched for an `Article` it cites (a reference whose numbering word never
  heads a line is into another document). References carry the word as `:numbering` in `chaff tree`;
- definitions after `In this section—`, `In this Part, …` or `This section applies where …` hold only in that
  section, and `"X" has the meaning given in …` points at a definition instead of making one.

For adapter authors: `StructurePatterns.opensDefinitionScope` and `NumberedLine.numbering` are new and optional.

### `latin-spacing` no longer counts article numbers

`第3条` and `第4条第2項` are how an address is written, not a spacing choice. They were counted, so a page citing many
articles made its ordinary spaced `2 か所` look like the odd one out. A number right after `第` is now not counted.

## 0.8.0 — 2026-09-28

What an English user's first run and four real statutes showed: chaff now speaks English to an English
document, reads the way statutes are actually written without false positives, and ships a Claude Code skill.

📦 [`chaffjs@0.8.0`](https://www.npmjs.com/package/chaffjs/v/0.8.0) ·
[`@chaffjs/lang-ja@0.7.0`](https://www.npmjs.com/package/@chaffjs/lang-ja/v/0.7.0)

`@chaffjs/lang-ja` is 0.7.0 (the statute patterns live in it) and `chaffjs` depends on exactly that version.
`@chaffjs/lang-en` stays at 0.6.0; only its README changed.

### The structure rules read real statutes (#130)

Four statutes from the e-Gov law API — 労働基準法, 個人情報の保護に関する法律, 民法, 会社法 — are now in the repository
(`corpus/laws/`, public domain under Article 13 of the Copyright Act), and a test requires the structure rules to
find nothing in them, since a statute in force is consistent. On the first run they reported hundreds of false
positives; each pattern is now read the way a statute writes it:

- items (一, 二) of an unnumbered first paragraph are addressed `article.1.item`, so they no longer collide with
  paragraph 2, and paragraphs and items are separate numbering sequences;
- an old statute's unnumbered later paragraphs (a line indented with a full-width space) are paragraphs;
- deleted articles written as a range (「第四十三条から第五十五条まで　削除」, 「第五百十六条及び第五百十七条　削除」);
- references into another statute written with its number (「…法（昭和二十三年法律第百二十号）第三条」), and the
  references that continue such a list (「…第百条第一項、第百一条、第百二条の二」), even past a parenthetical;
- references inside 「」, which in a statute quote the text of another (読み替え);
- definitions scoped to their article (「前項に規定する『反対株主』とは」).

`yarn corpus:fetch` refreshes the statutes from e-Gov; `yarn corpus` prints what the structure rules find in them.
In `chaff tree`, an item directly under an article is now `3.1.1` rather than `3.1`.

### A Claude Code skill ships with chaff

`npx chaffjs skill` writes `.claude/skills/chaff/SKILL.md` in the current folder (`--global` writes it under
`~/.claude/skills/`), so Claude Code knows how to run chaff, read a finding, choose between fixing the text,
`stet` and changing the rule, and tune `chaff.yaml` through `rules --json` and `relax --why`. Running it again
updates the skill; a copy that differs — perhaps edited by hand — is kept unless `--force` is given. The skill is
in the npm package under `skills/`.

### chaff speaks English to an English document (#123)

The screen around the findings was Japanese whatever the document: the divider, "relax this rule", the
summary, the list of rules that did not run, the header. It now follows the document's language — Japanese for
a Japanese document, English for any other — and a run over several files ends with one summary in their
language, or in the terminal's when they differ.

Output that is not about one document — `--help`, `genres`, `init` (and the `chaff.yaml` it writes), `explain`,
`relax` / `strict` / `off`, `rules --json`, `baseline`, `suppressions`, `tree`, `cite` and the warnings about
settings — follows `language` in `chaff.yaml`, then the terminal's locale (`LC_ALL`, `LC_MESSAGES`, `LANG`),
then English. `explain`, `rules --json` and `relax` used to assume Japanese when `chaff.yaml` named no
language; they now use the same choice, so an English user sees limits counted in words.

Not yet in English: `chaff test` (the checks that read meaning) and `chaff eval`.

### The reason a rule did not run, and `--genre` for a check (#123)

An experimental rule that needs parts of speech (`adverb-overuse`, `expletive-construction`) was listed as
not run because "the adapter returned no parts of speech". The real reason was that it is experimental and
off: the tagger is only prepared for rules that run. The missing-tags reason is now given only after the
rule's level has been checked, so it says "still experimental" (or "turned off in the settings").

`--genre <genre>` now sets the genre for a check, as `chaff genres` has always said; before, only `init`
read it. It wins over `chaff.yaml` for that run, the header says the genre came from `--genre`, and an
unknown genre stops with the way to list them. It reaches `test` and `eval` too, and an unknown genre is refused before any command runs. The value after
`--genre`, `--sarif` or `--rule` is no longer taken for a file to check.

### Third-party language packages are loaded (#122)

The READMEs have always said an official adapter is `@chaffjs/lang-<lang>` and a third-party one is
`chaff-lang-<lang>`, but chaff only ever tried the first, so a third-party package was never loaded. chaff
now tries `@chaffjs/lang-<lang>` and then `chaff-lang-<lang>`. An installed package that fails to load is
reported as it is, without falling through to the next; when neither is installed, the message names both.

## 0.7.0 — 2026-09-27

What building a house style from real model texts showed chaff was missing: a way to keep a rule when the
models run past its loosest level, notice of settings that do nothing, headings read without their
attributes, and two orthography rules a style needs.

📦 [`chaffjs@0.7.0`](https://www.npmjs.com/package/chaffjs/v/0.7.0)

`@chaffjs/lang-ja` and `@chaffjs/lang-en` stay at 0.6.0. Nothing in them changed.

### A rule's limit can be a number, and a setting that does nothing is reported (#115)

When the four levels are not enough — a style whose model sentences run past the loosest level —
`chaff.yaml` can give a rule its limit as a positive number (`max-sentence-length: 260`); the level
counts as `normal` and `chaff rules --json` shows the number in effect. A rule name chaff does not know
(usually a typo) and a value it cannot read are now reported on standard error by `lint` and
`rules --json`, instead of being dropped while the writer believes the setting applies.

### Heading attributes are not part of the heading (#116)

A heading that carries a kramdown or pandoc attribute list (`## Install {#install}`, `## Notes {: .note}`)
is now read without it. `heading-echo` missed a sentence that merely repeats such a heading, and the tree
put `{#a3}` into an article's heading. Braces that are words (`## {name} の設定`) are kept.

### Two orthography rules (#117)

- `preferred-term` — the team lists spellings under `prefer` in chaff.yaml (`サーバー: サーバ`), and each
  avoided spelling is reported with the one to use. An avoided spelling that is part of the preferred one
  (`ユーザ` inside `ユーザー`) is not. With nothing listed it says nothing.
- `latin-spacing` (Japanese) — whether Japanese and Latin letters or digits are separated by a space is a
  choice either way; mixing both in one document is what this reports, pointing at whichever the document
  uses less. Letters, the space before a digit and the space after one are counted separately, since
  `を 3回` (space before the number, none before its counter) is ordinary. A unit written after a number
  (`3GBの`, `10ms 待つ`) counts with the number, not as a Latin word.

Both are experimental, so a style turns them on in chaff.yaml.

## 0.6.0 — 2026-09-27

Documents with structure — contracts, statutes, specifications, manuals — become a tree with addresses,
and three things that tree makes checkable now run: references to provisions that are not there,
numbering that skips or repeats, and answers whose citations are not in the source. chaff still only
reports; nothing is rewritten.

📦 [`chaffjs@0.6.0`](https://www.npmjs.com/package/chaffjs/v/0.6.0) ·
[`@chaffjs/lang-ja@0.6.0`](https://www.npmjs.com/package/@chaffjs/lang-ja/v/0.6.0) ·
[`@chaffjs/lang-en@0.6.0`](https://www.npmjs.com/package/@chaffjs/lang-en/v/0.6.0)

All three packages ship at 0.6.0 and `chaffjs` depends on exactly that version of both adapters: the
adapters gained `structure`, and an older adapter would leave `chaff tree` refusing Japanese and English.

### `chaff tree`: a document as a tree with addresses (#110)

Contracts, specifications and manuals have structure that a reader navigates by: Article 3,
paragraph 2, item (a). `chaff tree <file>` prints that structure as an S-expression, or as JSON with
`--format json`. It shows sections, numbered articles and items, and the definitions,
cross-references, obligations and quantities inside them. Addresses are normalised: 第3条第2項 is `3.2`,
and Section 4.2(a) is `4.2.a`. A reference carries the same address form as the tree, so its target can be looked up.

It reads `.txt` as well as Markdown, because contracts rarely come with headings. Code blocks and inline
code are never read as numbers or references.

How a language numbers its articles lives in the adapter (`structure`, an optional field; the API stays
at version 1). Japanese and English ship with it. A language without one is refused with a reason
rather than answered with an empty tree. An adapter that chaff does not bundle is looked up as
`@chaffjs/lang-<language>`, so a language can be added by installing its package.

### Japanese by morphology, chapters and dates (#111)

Parts, chapters and sections (第1編・第2章・第3節, PART I, CHAPTER 2) nest above articles, and dates are
read as leaves (`2024年4月1日` and `April 1, 2024` are both `2024-04-01`). Japanese quantities are read by
morphological analysis: a number followed by a counter is a quantity, so 8割 and 5件 are read without a
unit table. A dotted number followed by a unit (`1.5 倍`, `2.5 days`) is an amount, not section 1.5.
Mid-sentence "May" is the month, not the permission. Fifteen sample documents in Japanese and English
(contracts, terms, work rules, statutes, specifications, manuals, papers, and prose that must not be
misread) are compared whole against trees that were read and checked by hand.

### Structure rules (#112)

Three experimental lint rules read the tree:

- `dangling-reference` — a reference to an article or section that is not in the document. A reference
  naming another document (民法第709条, Section 9 of the Master Agreement) is not looked up, and
  第4条第1項 resolves to article 4 when its first paragraph carries no number, as Japanese statutes write it.
- `numbering-gap` — Article 5 right after Article 3, two paragraphs numbered 2. Only siblings are
  compared, so Section 101 / 201 across chapters is fine; a list restarting at 1 begins a new sequence.
- `duplicate-definition` — the same term defined twice. Whether the two definitions conflict is not
  decided; the second place and the first line are shown.

They work on `.txt` contracts as well as Markdown, a language whose adapter cannot read structure skips
them with a reason, the tree is built only when one of them runs, and `chaff eval` does not calibrate
them for a language that cannot run them.

### Long documents (#113)

Finding a finding's line no longer scans every line for every finding. A long contract with many
findings was paying lines × findings.

### `chaff cite`: check an answer's citations (#114)

`chaff cite <source> <claims.json>` checks citations `[{ "address", "quote" }]` against the source: the
address must be in the tree and the quote written within it. A quote from the wrong place reports where
it actually is; a changed number or a paraphrase is not found. Whitespace and line breaks are ignored
and characters compared under NFKC per grapheme (３０ = 30, ｶﾞ = ガ). Code in a section can be quoted.
Any failed citation exits 1, so an answer can be checked like a unit test.

### Guide (#107, #108)

A guide in English and Japanese, including what chaff reads and what to do when it will not run.

## 0.5.1 — 2026-09-13

A patch. Nothing new runs; three things stop being reported. All three were found by pointing chaff
at its own documents through the SARIF output that 0.5.0 added.

📦 [`chaffjs@0.5.1`](https://www.npmjs.com/package/chaffjs/v/0.5.1)

`@chaffjs/lang-ja` and `@chaffjs/lang-en` stay at 0.5.0. Nothing in them changed.

### The output found its own mistakes (#101, #104)

In a terminal the 45 findings on chaff's own repository were lines nobody scrolled to. On the Security
tab the breakdown was readable, and the largest entry turned out to be the tool's own error rather
than the documents'.

### `concrete-evidence-density` asked specifications for numbers (#101)

A section headed `error`, saying what `error` means, needs no number, no code and no link. The rule's
reasoning — nothing to take away — does not describe a definition.

The spec had scoped this rule to `blog`. The implementation widened it to `business` and `technical`,
and only the `business` half was ever justified in writing. `technical` is out again. `business`
stays, where a section of principles with nothing concrete in it really is a problem.

Seventeen findings on chaff's own specifications, gone.

### A trailing cross-reference is not the end of the sentence (#104)

```
これを設計の最優先制約とする（§17）。
```

The predicate is とする, not 17. Specifications hang cross-references off the end of sentences.
Counting them put the end of every sentence inside a bracket, and `taigen-dome-in-prose` read the lot
as noun-ending prose. 87 sentences became 60.

A sentence with nothing left once the bracket is removed keeps it, because there the bracket is the
content.

### A term with one particle is not a phrase (#104)

```
7  "etectorは"     ← detectorは
5  "はadapter"
4  "adapterを"
```

`ngram-repetition` accepted any eight-character window containing one hiragana as phrasing. A
technical term with a particle attached clears that bar, and a specification repeats its terms on
purpose.

Measured on real documents, genuine phrasing carries around seven hiragana; a term plus a particle
carries one or two. The bar is three. The true positive that motivated the rule (`ではありません。`,
eight times) still reports.

### Also

chaff's own documents now pass chaff. Sixty noun-ending sentences were given predicates, one long
sentence was split, and the rule count in the README was wrong (42 where there are 45).

`examples/` was left alone. Those are published articles, and rewriting them would destroy the one
thing they are there for.

## 0.5.0 — 2026-09-13

Findings reach the pull request. 17 of 42 rules now run by default, against a written bar that
requires evidence from real documents. A wider corpus and an external review found eleven defects,
one of them in a rule that had shipped since 0.0.1.

📦 [`chaffjs@0.5.0`](https://www.npmjs.com/package/chaffjs/v/0.5.0) ·
[`@chaffjs/lang-ja@0.5.0`](https://www.npmjs.com/package/@chaffjs/lang-ja/v/0.5.0) ·
[`@chaffjs/lang-en@0.5.0`](https://www.npmjs.com/package/@chaffjs/lang-en/v/0.5.0)

### SARIF (#86)

```bash
npx chaffjs . --sarif report/chaff.sarif
```

Uploaded to GitHub code scanning, a finding lands on the changed line of the pull request, where the
person who wrote it is already looking. A finding in a log has to be gone and fetched.

Each rule ships its rationale and its fix with the message, so opening a finding tells you what to do
about it. Pointing at a problem without that leaves the writer nowhere to go.

Two things were fixed while building it.

The message was rendered in the config's language, not the file's, so English documents carried
Japanese text. `by_path` puts two languages in one repository, so the language has to come from
the file.

The version was also nearly written as a constant. scoria did exactly that in its 0.1.1 and shipped
findings attributed to a release that never produced them.

### The bar for running by default (#92)

The default surface was 10 rules of 42. Moving a rule there now requires:

1. it fired on the 20 published articles in `examples/`
2. the findings were read one by one and judged correct
3. `chaff eval` puts it under the 5% false-positive target

**A rule that has never fired does not qualify.** Working on a synthetic fixture proves it is not
broken. It does not prove it should speak by default, and zero findings does not tell a good rule
from a broken one.

Seven rules passed. Three were held back by it.

`agentless-passive` is right four times in five, which is not enough for a default.
`title-case-consistency` and `contraction-consistency` miss the eval target at every threshold, and
ignoring your own instrument is not an option.

`eval` itself was measuring rules that could never run — it checked `use_for` but not `languages`,
`requires` or `from`. Sweeping a rule that cannot fire makes "zero at every threshold" look like
careful writing.

### What eleven articles showed that two did not (#91)

The English corpus went from 281 lines to 3328. `heading-echo`, `stable` since 0.0.1, was firing on
**72.7%** of it.

```
"ToolsAgent"           → "GraphAI provides ToolsAgent components that use LLMs to dynamically invoke…"
"Cinematic Animations" → "In addition to slide-based presentations, you can create cinematic effects…"
```

The heading's words are present and the sentence adds a great deal. The rule's own reasoning — the
reader gains nothing by reading on — does not hold here. It now measures what is left once the
heading is removed: six words in English, twenty characters in Japanese.

It was also comparing case-sensitively, so `Generating` and `generated` were different words and real
echoes went unreported.

Bare `https://…` URLs were never masked either. Without the GFM autolink extension mdast leaves them
as plain text, so a heading matched identifiers inside a link.

At two articles all of this looked fine.

### Rules the team writes (#77 shipped in 0.4.0, extended here)

```yaml
jargon:            [横展開, 握る, 巻き取]
required_sections: [リスク, 費用]
```

chaff holds no list of its own. Which words are internal, and which sections a proposal must have,
differ by organisation. **A tool that decides that for you gets switched off by everyone it decided
wrong for.** With nothing listed these rules say nothing, and they never ask to be filled in.

### Composite signals and `no-em-dash` (#88)

`ai-generated-composite` fires only when three or more weak signals coincide, and still does not say
the text was generated — it marks a place to reread. It **adds** a finding rather than replacing the
contributing ones, because two of the seven inputs are stable warnings that stand on their own.

It reads other rules' results, so it runs as a second pass rather than as a detector.

`no-em-dash` carries a different severity per language. `warning` in Japanese, where the typography
is awkward. `info` in English, where the dash is a legitimate tool. It is also one of the
better-known marks of generated text.

Severity can now be written per language anywhere, reusing the fold that `levels` already had.

### `contraction-consistency` (#89)

The last entry in the spec's rule catalog. It needed `Lexicon` to express a pair.

```yaml
- pattern: "don't"
  instead_of: do not
```

Counting one side alone cannot tell a deliberately formal register from an inconsistency. Matching is
on word boundaries: `it isn't` contains `it is`, and substring matching put contraction-using
sentences in the "spelled out" column.

### Eleven defects found by review (#94, #95, #96)

`codex` was pointed at the whole tree and reported nine. Every one was reproduced before being fixed,
and one was reproduced and then declined.

**Offsets were wrong after any emoji.** chaff covers non-prose with same-length spaces so offsets stay
aligned with the source; everything else rests on that. A `u`-flagged regex matches by code point, so
a surrogate pair became one space and the document shrank by one. The line table counted the same way.
Every finding after an emoji pointed one character off — and `emoji-density` had just made emoji-heavy
documents a likely target.

**Three things returned zero instead of failing.** An adapter could declare `pos: true`, return no
tokens, and quietly answer "no passives here" for all nine POS rules. An adapter with `apiVersion: 2`
loaded.

An L4 rule with a typo'd filter name fell through to whole-document. It sent the entire document to
the model, straight past the two-stage design that exists to prevent that.

**Four detection errors.** Predicate detection read past the comma, so `仕様は変更され、担当者が確認した。`
reported nothing. The most ordinary English acronym form, `Continuous Integration (CI)`, was not
recognised as an expansion. A conjunction between "was" and the participle broke passive detection.
One heading of each style was called "the minority".

One was left alone. `was fully and finally approved` is missed because the tagger labels `approved`
VBD rather than VBN; accepting VBD would make `The team was here and approved it` a passive. The
limitation is recorded where the next reader will find it.

A malformed rule file also used to crash without naming the file.

### Breaking

- Eleven more rules run without `--experimental`, so existing users see findings they did not before.
- `heading-echo` reports differently in both languages.
- All three packages move to 0.5.0; the adapters were at 0.3.0.

### Not in this release

`chaff test` has still never completed a round trip against a live API. Authentication, 401 and 429
are confirmed against the real service; the account had no credits.

## 0.4.0 — 2026-09-13

Three rules whose content **chaff does not hold**. It reads what the team wrote in `chaff.yaml` and
nothing else. Rules: 39 → 42, which completes the L1/L2 catalog.

📦 [`chaffjs@0.4.0`](https://www.npmjs.com/package/chaffjs/v/0.4.0)

`@chaffjs/lang-ja` and `@chaffjs/lang-en` stay at 0.3.0. Nothing in them changed, so they were not
republished.

### Rules the team writes (#77)

```yaml
jargon:            # words that only work inside
  - 横展開
  - 握る
  - 巻き取

required_sections: # headings this kind of document needs
  - リスク
  - 費用
```

```
1:1   error   「リスク、費用」の見出しがありません
5:1   warning 「横展開」は社内でしか通じないかもしれません（そういう語が 3 箇所）
```

Which words are internal, and which sections a proposal must have, differ by organisation.
**A tool that decides this for you gets switched off by everyone it decided wrong for.**

With nothing listed, these rules say nothing. They also never ask to be filled in: a linter that
nags about its own configuration is one more thing to ignore.

### Matching what people actually write

Teams list the dictionary form (`握る`). Documents contain the inflected one (`握った`). The first
implementation compared surfaces and matched neither, which the first run showed immediately.

Matching is now on the **surface or the lemma**. With part-of-speech available the inflected form is
caught; without it the surface still works. The rule therefore declares no capability requirement —
it degrades rather than disappearing.

Compound verbs stay out of reach. They split into morphemes, so the dictionary form is never present:

```
巻き取ります → 巻き[巻く] + 取り[取る]
```

A stem (`巻き取`) matches on the surface, and the rule's own `how_to_fix` says so. Someone who lists
a word that never fires can see why without reading the source.

### `required-sections` does not police wording

Matching is by substring, so `リスク` is satisfied by a heading called 「リスクと対策」. The team
decides which sections exist; how they are phrased belongs to the writer.

It is the only rule defaulting to `error`. Every other finding is a matter of taste; this one is a
decision the team already made and then did not keep.

The spec had this list living in genre packs, per language. That design is still in the spec,
alongside the reason it was not taken.

### `proper-noun-density` needed no dictionary

The spec called for an unknown-word rate, which is why the rule had been deferred. Part-of-speech
analysis arrived in 0.3.0, and counting `PROPN` turns out to be enough.

```
1000 語あたり 71 個の固有名詞があります（40 個まで）
```

A run of product and company names hides the shape of a sentence. It hides it from anyone who does
not already know the names, which is exactly what the author cannot see.

### Still open

`contraction-consistency` needs `Lexicon` to express a pair ("don't" ↔ "do not"). Widening that
contract can wait for a second rule that needs it.

`list-length-variance` stays dropped. Measured across 27 real bullet lists the coefficient of
variation runs 11–56% with a median of 21: **bullet lists are supposed to be uniform**. Lowering the
threshold until the rule went quiet would not have taught it anything.

`chaff test` has still never completed a round trip against a live API.

## 0.3.0 — 2026-09-13

The largest release so far. **25 rules become 39.** Part-of-speech analysis arrives with nothing to
install, thresholds follow the genre, and the LLM judge takes a second provider.

📦 [`chaffjs@0.3.0`](https://www.npmjs.com/package/chaffjs/v/0.3.0) ·
[`@chaffjs/lang-ja@0.3.0`](https://www.npmjs.com/package/@chaffjs/lang-ja/v/0.3.0) ·
[`@chaffjs/lang-en@0.3.0`](https://www.npmjs.com/package/@chaffjs/lang-en/v/0.3.0)

### Part-of-speech, with nothing to install (#52)

The spec had put the Japanese dictionary behind an opt-in (`chaff setup`). It weighs 18 MB and the
budget said 15. The budget was removed, so the machinery that existed to satisfy it went too.

Four analysers were run on Node 24 before choosing. `lindera-js` is the smallest at 9.1 MB and still
had to go. It is a wasm-pack **bundler** target with no `main` or `exports`, so Node cannot resolve
it. `wink-pos-tagger` reports 0.14 MB on npm and pulls 13 MB through `wink-lexicon`. The package
figure alone would have picked the wrong one.

What survives the removal is the **time** budget, which is why capability and payment are separate:

```
capabilities.pos = true     what the adapter can do if asked
adapter.prepare()           what it costs. 2.2s, and only when a rule needs it
```

A lint with no such rule takes 0.22s; with them, 0.50s. A rule that cannot run says why rather than
reporting zero findings.

`agentless-passive` has **one rule definition for both languages**. Japanese れる/られる and English
be + past participle look nothing alike, but they hide the same thing: who acted. The adapter folds
that judgement into a UD feature (`Voice=Pass`), so the detector never learns a language.

The rule was wrong twice before it was right. It first flagged 14 spots in real documents, 10 of them
noise. A passive that modifies a noun ("開催される BootCamp") names a thing; it hides no actor.

The fix went into the core detector, and **English broke**. "No noun follows" is a fact about Japanese
word order; English runs the other way. Moving the judgement into the adapter made both correct.

### Fourteen L1/L2 rules, and three that were measured and dropped (#72, #73, #74)

| layer | rules |
| --- | --- |
| L1 structure | `max-paragraph-length` `paragraph-length-variance` `section-length-uniformity` `rule-of-three` `preamble-length` |
| L1 signals | `ngram-repetition` `emoji-density` `undefined-acronym` `concrete-evidence-density` |
| L2 lexicon | `excessive-hedging` `cushion-phrase-density` `unqualified-superlative` `repeated-conjunction` `ai-tell` |

`list-length-variance` was measured across 27 real bullet lists: coefficient of variation median 21%,
range 11–56. The first threshold flagged **more than half of what humans wrote**. Bullet lists are
supposed to be uniform — that is what a list is for. Lowering the threshold until it went quiet would
have silenced the rule without teaching it to tell good writing from bad. Dropped, with the numbers.

`contraction-consistency` needs to know "don't" and "do not" are one word in two registers. `Lexicon`
holds `{pattern, weight}` and cannot express a pair; widening the contract can wait for a second rule
that needs it.

`ai-tell` is the first rule to use `weight`. Each phrase is ordinary alone, so only the sum is
reported. Both the message and the rationale say it is never a verdict on its own.

### Japanese and English L3 (#57, #58, #59)

Nine Japanese rules and five English ones. The first three Japanese rules were reported as unshippable
and then shipped, because two of the three diagnoses were wrong.

"Nested の cannot be told from parallel の without dependency parsing" was false: **punctuation
separates them**. The first implementation collected particles and ignored the commas between them.

```
3  弊社の新製品の販売の計画                            fires
1  サービスの運営や、ドキュメントの作成、イベントの運営   does not
```

"Where 体言止め is acceptable is a matter of taste" was also too strong. The false positives were
dependent nouns (名詞,非自立) — 「回るのか。」 is a question, not a noun-ending sentence — and that is
decided mechanically.

What remained was not about the rules at all. Things that parse as paragraphs are not always
sentences: a bare name under a heading, a citation line, a title. `no-mixed-desumasu` reported exactly
three false positives in one document, and that document held exactly three fragments. "Is this a
sentence" now lives in one file, because writing it per rule means one definition of "not prose" per
rule.

English rules avoid taking sides where style guides disagree: `title-case-consistency` and
`oxford-comma-consistency` only ask whether one document is consistent with itself.

### Thresholds follow the genre (#60)

```
business/email   warning この文は 76 文字あります（70 文字まで）
blog/tech        0 findings
blog/essay       0 findings
```

The same sentence. The spec put these numbers in profile files. They went next to the rule instead,
because a threshold separated from its rationale is a number that drifts.

`explain` and `rules --json` both say when a value came from the genre. Showing the default would make
a correct setting look broken, and `rules --json` is what an AI reads to write the config.

### `ai_backend` — Anthropic or OpenAI (#64)

```yaml
ai_backend: openai
ai_model: gpt-5
```

What differs between providers is the envelope. The JSON schema producing `{violated, confidence,
reason}` is shared, because a verdict that changes shape when you change vendor is a verdict that
changes meaning. Both shapes were read out of the installed SDK types rather than recalled.

**A Claude subscription does not work here.** The SDK resolves an API key, an auth token, a Console
OAuth profile, or OIDC federation. Claude Code's credentials live in `~/.claude` and are none of those.

Driving the `claude` CLI as the judge was measured, not assumed. **46,906 tokens for one verdict**,
because Claude Code carries its own system prompt and tool definitions into every call. Roughly a
hundred times the API path.

### `.env`, and telling apart three ways of failing (#67, #68)

Keys can live in `.env`, read through Node's own loader with no dependency. **The shell still wins**,
so a different key can be tried without editing anything.

Both fixes in this area came from running against a live API, and neither was reachable from a stub.

A key that is present but rejected used to report "no credentials found", sending the reader back to
set a key they had already set. A 429 used to arrive as a Node stack trace. Only 401 was caught, so
"you have no credits remaining" came out as a core dump. Failures are sorted into auth / quota /
other, each saying what to do next. The provider's own text is passed through, because translating it
would drop the billing URL.

`.env` was also not in `.gitignore`, and neither was `.env~`, which held a real key.

### `--dry-run` and `look_at` (#61, #62)

```
doc.md   全 6 文のうち 5 箇所を送ります（API は呼んでいません）

      1 箇所  リスクが書かれていない  （機械で絞り込み済み）
      2 箇所  依頼には期限と担当がある  （「お願いします」 「ご確認ください」 を含む文）
      1 箇所  議事録に決定事項がある  （絞り込めず全文）
```

Never sending the whole document has been a principle since 0.1.0. This is the first release where it
can be verified, and **without an API key**.

Until now `look_at` was prose that nothing could act on, so every user-written check sent the whole
document. Writers quote the words they mean, so the quotes are the filter — no model, no dialogue,
nothing inferred. What cannot be narrowed still goes whole, and the output says so with the fix on the
next line.

### Fixed

`**` was never masked. The analyser read `**。` as one noun, the sentence lost its terminator and
swallowed the next one. Emphasis markers are covered now; the emphasised words stay.
Findings on the example corpus fell from 19 to 18.

`bold-density` rose instead. 18 bold spans had been adding 72 characters of markup to their own
denominator.

`isClosed` had no ASCII period, so **no English sentence was ever "finished"**. Written for the
Japanese rules and never exercised in English, it surfaced when an English rule shipped and fired
nothing.

`repeated-sentence-head` compared six characters in every language, so English output quoted
`"Wecont"`. It compares three words where the unit is words, which also removed a false positive on a
URL.

A malformed rule file crashed without naming the file. `:::` directives (Zenn, Docusaurus, VitePress)
counted as prose.

### Breaking

- Runtime dependencies grow by about 40 MB. The spec's size budget is gone; the time budget stays,
  which is why the dictionary loads only when a rule needs it.
- `repeated-sentence-head` reports differently in English.
- `bold-density` counts more on heavily emphasised text.
- `docs/` was already `technical/readme` as of 0.2.0; no genre changes in this release.

### Not in this release

`chaff test` has still never completed a round trip against a live API. Authentication, 401 and 429
are confirmed against the real service, but the account had no credits. Tracked separately.
`internal-jargon`, `proper-noun-density` and `required-sections` each need machinery that does not
exist yet.

## 0.2.0 — 2026-09-12

Calibration. 0.0.1 and 0.1.0 built the rules; this release measures whether they are right, against
real published documents. On a corpus of 8 real articles (1525 lines), findings went from **63 to
17**. Every one of the 46 that disappeared was a false positive.

📦 [`chaffjs@0.2.0`](https://www.npmjs.com/package/chaffjs/v/0.2.0) ·
[`@chaffjs/lang-ja@0.2.0`](https://www.npmjs.com/package/@chaffjs/lang-ja/v/0.2.0) ·
[`@chaffjs/lang-en@0.2.0`](https://www.npmjs.com/package/@chaffjs/lang-en/v/0.2.0)

### Bold in tables and headings is not emphasis (#38)

Found by running the published 0.1.0 on chaff's own specifications. A table whose first column is
bold labels was reported as "3 bold spans in this section (2 allowed)".

The rule's own rationale — bold stops the reader's eye, so using it everywhere stops nothing — does
not apply to a table cell label. Bold inside headings and code blocks is excluded for the same
reason. On the specs this alone cut findings from 14 to 1.

Still reported, and deliberately: a list whose items open with a bold lead-in. That one is a matter
of taste, and the answer to it is `relax`, not a change to the rule.

### `examples/` — real documents in the repository (#40)

Building rules against invented examples means the false positives are found by users. Eight
published documents now live in the repository: three Japanese technical articles and two English
ones from zenn.dev/singularity, three organisational documents from singularitysociety.org.

```bash
yarn example              # compact
yarn example:friendly     # the default output
```

CI runs them on every push. It never fails on the number of findings, because prose is a matter of
taste. It fails only when chaff does not finish, judged by whether the summary line appears.

`by_path` was implemented in the same PR because splitting the examples into three genres required
it. It had been in the spec since the beginning and was never built.

```yaml
by_path:
  - files: ["business/**/*.md"]
    genre: business/report
  - files: ["blog-en/**/*.md"]
    language: en
```

Later entries win. Globs are matched relative to the config file, so the result does not depend on
the directory the command is run from. The first bug in it: `**/` has to match **zero** directories,
or `docs/**/*.md` misses `docs/a.md`.

### `chaff eval` — thresholds measured against your own writing (#42)

Default thresholds are a general guess. Whether they fit a particular team's writing is a question
that has to be measured, and #40 supplied the corpus to measure against.

```
  太字の使いすぎ   (bold-density)

        17     2 文書 ( 66.7%)   指摘   2 件   1万字あたり 0.8
        20     1 文書 ( 33.3%)   指摘   1 件   1万字あたり 0.4  ← 現在
        25     0 文書 (  0.0%)   指摘   0 件   1万字あたり 0.0  ← 推奨
```

The standard applied is spec §21's own. The corpus is writing a human wrote and published, so a rule
that fires across it has a threshold that does not match reality. The target is a hit rate below 5%.

It **never rewrites the config**. A calibration is an answer about one corpus, not a truth — the
proposal is printed and the decision stays with the person.

It earned its place the day it landed. It reported that `bold-density` missed the target *at every
threshold*, and that the rule itself was likely wrong. Which it was:

### `bold-density` counts density, not occurrences (#44)

```
  1095 chars / 2 bold   →  "few" by count      actually 1 per 548 chars (sparse)
   557 chars / 9 bold   →  "many" by count     actually 1 per  62 chars (dense)
```

Counting per section means a long section is always guilty — the opposite of what the reader
perceives. The rule had been named `bold-density` from the start; the implementation was the thing
that was wrong.

It now measures spans per 1000 characters (`strict 10 / normal 20 / relaxed 40`). Sections under 200
characters are not measured at all, because 1 span in 43 characters computes to "23 per 1000" and the
density becomes noise. Findings on the corpus: 32 → 1.

### Sentence length measured as the reader reads it (#46)

`max-sentence-length` was 38 of 44 findings on the corpus. Reading them showed most were not long
sentences at all. Three separate causes:

**Masked whitespace was counted.** Non-prose is covered with spaces of the same length, so that
offsets stay aligned. Counting those spaces made a sentence holding one URL measure 245 characters.
The reader reads 104. The measurement lived in four call sites and is now in `measure.ts`.

**Fragments were merged across line breaks.** The merge exists to close mis-splits *within* a line
(`Dr. 田中`). Crossing a line break joined the English and the Japanese halves of a blockquote into
one 134-character "sentence".

**Blockquotes were counted as the writer's own prose.** They are masked now, alongside code and
tables. chaff can say "split this in two", and nobody can do that to a quotation. Pointing at text
the writer cannot change leaves them nowhere to go. The longest "sentences" in the corpus were
English quotations measured against the Japanese threshold.

Findings: 44 → 17, `max-sentence-length` 38 → 10. What remains is 104–128 characters and genuinely
long.

### `technical` — a specification is not a blog post (#47)

chaff's own specs were detected as `blog/tech`. The original nlh spec had a `technical` profile;
chaff had only business and blog.

A spec or a README is written to prevent misunderstanding, not to be read for pleasure. It needs no
hook, no closing and no rhythm: `padded-intro`, `closing-cliche`, `sentence-rhythm` and
`empty-conclusion` do not run. `max-sentence-length`, `heading-echo`, `bold-density`,
`empty-intensifier` and `repeated-sentence-head` do. Ambiguity is worse in a specification than
anywhere else.

<!-- stet: empty-intensifier — quoting the phrase the rule catches -->

And "extremely important" in a spec is emptier than it is in an article.

Detected from `README.md`, `*-spec.md`, `spec/` and `docs/`.

### Breaking

- `docs/` is detected as `technical/readme` instead of `blog/tech`. A team keeping user-facing
  articles in `docs/` will find the blog rules stop running there.
- `bold-density` thresholds changed meaning: occurrences per section → spans per 1000 characters.
  Any numeric value set by hand has to be re-read.

### Not in this release

Per-genre thresholds are still missing. Genre selects only *which* rules run, not their numbers,
where spec §9 gives a profile its own thresholds. Also absent: L3 part-of-speech rules, and the
conversion of `checks.yaml`'s natural-language `look_at` into a real candidate filter.

## 0.1.0 — 2026-09-12

`chaff test` — the half of the tool that reads meaning. 0.0.1 could only measure what a machine can
count; this release adds checks that require reading the text, judged by Claude.

📦 [`chaffjs@0.1.0`](https://www.npmjs.com/package/chaffjs/v/0.1.0) ·
[`@chaffjs/lang-ja@0.1.0`](https://www.npmjs.com/package/@chaffjs/lang-ja/v/0.1.0) ·
[`@chaffjs/lang-en@0.1.0`](https://www.npmjs.com/package/@chaffjs/lang-en/v/0.1.0)

### The semantic layer (#34)

Three built-in rules, plus `checks.yaml` for checks written in plain language.

| rule | what it checks |
| --- | --- |
| `risk-disclosure` | a proposal states its risks |
| `empty-conclusion` | the closing adds something beyond a summary of the body |
| `unsourced-number` | a number claiming an effect carries its basis |

Output separates the two kinds of judgement under their own headings. A reader who does not know a
finding can move between runs will be whipsawed by a false positive. Only AI findings carry a
confidence figure, and each one names two ways out: silence this spot, or relax the rule.

### The whole document is never sent

Two stages. A deterministic filter narrows the text first; only what survives is read. **An L4 rule
without a filter cannot be registered** — without that constraint every article would cost a
full-document read.

`risk-disclosure` is skipped entirely when a heading already names risk. `empty-conclusion` only
fires when the last section contains no number, code or link. `unsourced-number` only fires when a
number and an effect verb share a sentence carrying no basis.

The first test to fail while building that filter is the reason the design exists:

```
Headcount fell 40% after adoption (Apr–Jun 2026, year over year).
```

The sentence carries its basis and was still being queued for the model — "year over year" was not
recognised as evidence. Catching that is exactly what stage one is for.

Identical questions hit `.chaff-cache/` on the second run, so repeated CI runs cost nothing.

### Credentials are checked before the call, not after

With no credentials the SDK throws a plain `Error` — not `AuthenticationError`, not `APIError` — so
the failure cannot be identified by type afterwards. chaff now checks the documented resolution order
first (`ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, identity tokens, the `ant auth login` profile).
Looking only at `ANTHROPIC_API_KEY` would tell someone who authenticated with `ant auth login` that
they have no key.

### The verdict shape is fixed

`output_config.format` constrains the response to `{violated, confidence, reason}`; free text is
never parsed after the fact. Findings below the confidence threshold (0.7 by default) drop to `info`.
The system prompt says: when in doubt, do not flag — a false positive costs more than a miss.

### Fixed

`chaff lint` claimed "no detector" for semantic rules. It now says they run under `chaff test`.

Two regexes were rewritten: `\d+\s*(?:%|倍|…)` backtracks on `\s*`, and the evidence-marker
alternation exceeded the complexity limit — it is a word list now.

### Note

Runtime dependencies grew from 2.6 MB to 11.8 MB (the Anthropic SDK), still inside the 15 MB budget
the spec sets for `npx`.

### Not in this release

L3 (part-of-speech rules) and `eval` (threshold calibration against a corpus) are absent. So is the
conversion of `checks.yaml`'s natural-language `look_at` into an actual filter, so user checks
currently pass the whole document.

## 0.0.1 — 2026-09-12

First release. `npx chaffjs article.md` finds what is hard to read, with no install, no API key and
no language flag — and never rewrites the text.

📦 [`chaffjs@0.0.1`](https://www.npmjs.com/package/chaffjs/v/0.0.1) ·
[`@chaffjs/lang-ja@0.0.1`](https://www.npmjs.com/package/@chaffjs/lang-ja/v/0.0.1) ·
[`@chaffjs/lang-en@0.0.1`](https://www.npmjs.com/package/@chaffjs/lang-en/v/0.0.1)

### The monorepo and the language adapters (#8)

`text/` became a yarn workspaces root alongside `coding/`, which holds scoria. CI is scoped by
`paths:` and `working-directory:`, so a change to one project does not run the other's gates.

The first real code was the sentence splitting, because `sentence-rhythm` and `max-sentence-length`
take sentence length as input and a bad split moves the metric directly. English needs no help from
`sentence-splitter`: `Dr.`, `e.g.`, `U.S.` and `$3.50` are all handled. Japanese is broken by the
same library, which treats `.` as a terminator and splits `、Dr. 田中は` in two. The `AbbrMarker`
option does not fix it, because the cause is not abbreviation protection. Japanese sentences end in
`。！？`, so the adapter joins any fragment that does not.

Cross-package imports are types only. Adapters do not depend on chaff's values and run on their own.

### The MVP: lint that works with no configuration (#16)

Five L1 rules, the four-word model, the non-engineer output format, `--compact`, `chaff rules --json`
for handing the current state to an AI, and comment-preserving write-back of `chaff.yaml`.

Non-prose is not cut out of the document — it is **covered with spaces of the same length**. Offsets
stay aligned with the original text, so line numbers and quoted excerpts remain exact.

Three things were found by building it:

- Splitting sentences across the whole document let a line without a full stop swallow a masked
  table and code block up to the next one. The specs produced a 954-character "sentence". Sentences
  are now split per paragraph, a boundary a sentence cannot cross.
- `heading-echo` cannot be measured with a Jaccard coefficient. A sentence that contains the whole
  heading and then continues scores 44% simply because it is longer, which misses the most typical
  repetition. Containment scores it 100%. The spec was corrected to match (#22).
- Genre detection fired on documents that merely *mention* 決定事項. It now looks at headings and
  line starts only.

### Directories, `init` and `explain` (#18)

One file at a time is not enough for a real repository. `chaff .`, `chaff docs/ README.md`, globs.
`node_modules`, `dist`, `build` and `coverage` are skipped. **Zero matched files is a failure** — a
run that silently checks nothing keeps CI green while verifying nothing.

`explain` exists because the default output says "relax this rule" while offering no way to read what
the rule is for.

### Locale-independent ordering (#20)

`localeCompare` without an explicit locale follows the machine's default, so Windows CI ordered
`one.md` before `README.md` and the suite failed. Finding order reaches CI logs and the baseline
file; it must not move between machines. The locale is now pinned, the assertion compares sets, and
a separate test asserts that output order does not depend on input order.

### Answering a finding: `stet`, `baseline`, `suppressions` (#21)

Of the three ways to answer a finding, the second was missing. A finding that is right in general but
deliberate in one spot then leaves only "switch the rule off". That accumulates until the whole tool
is ignored.

```markdown
<!-- stet: bold-density — a glossary, so the bold is deliberate -->
<!-- stet-section: bold-density — the list below -->
<!-- stet-file: ai-tell, rule-of-three — heavy quoting -->
```

Suppression applies forward only; reaching backwards would silently widen what it covers.

`baseline` shelves what already exists so a repository with hundreds of articles can adopt the tool
without fixing everything first. Findings are identified by content hash rather than line number, so
adding a paragraph does not unshelve them.

`suppressions` is the bridge from the second answer to the third. Silencing the same rule five times
means the standard, not the text, is what does not fit.

### L2: the lexicon layer (#23)

`empty-intensifier`, `padded-intro` and `closing-cliche`. The detector is shared; only the lexicon is
per-language.

This validated the four-layer model. The spec had set it as a checkpoint: if adding a second adapter
requires changing the genre packs, the split is wrong. The same three rules ran in English with no
change to the rule definitions or the detector — only the lexicon was swapped.

`where` narrows the scope, because the same phrase means different things in different places.
A closing cliche in the middle of a piece is just an ordinary connective.

### `--watch` (#24)

Reprinting every finding on each save makes it impossible to see what changed. Only the difference is
printed. When one rule loses a finding and another gains one, the total is unchanged. Marking that as
an improvement would be a lie, so the check mark appears only when the count falls.

### Publishing (#25, #26, #29)

`@chaff` has belonged to another user since 2019, and npm rejects the unscoped name `chaff` as too
close to `chai`, `chalk` and `charm`. The package is `chaffjs`; the binary is still `chaff`, since
the two names are independent.

Official adapters live under `@chaffjs/`, third-party ones under `chaff-lang-*` — the same split as
`@typescript-eslint/*` and `eslint-plugin-*`. The scope protects the name; the unscoped prefix keeps
the ecosystem open, which is the whole reason adapters are separate packages.

The adapters are dependencies of `chaffjs` rather than being fetched at runtime. The spec describes
lazy resolution, but until that exists an adapter missing from the dependency tree makes the
published CLI fail on startup.

### Not in this release

L3 (part-of-speech rules), L4 (meaning-based checks via an LLM and `checks.yaml`), `eval`, and corpus
calibration. `sentence-rhythm` ships as experimental and off by default: "AI-written articles have
uniform sentence length" is still an untested hypothesis.
