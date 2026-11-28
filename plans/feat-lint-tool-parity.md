# chaff vs markdownlint / textlint / Vale / remark-lint

Date: 2026-11-24. chaff as of `main` at 209ab43ea (lab-night checkout): 303 rules in `packages/chaff/rules/`.

## Sources

- markdownlint: `doc/Rules.md` and the markdownlint-cli2 README, both read word for word.
- textlint: the READMEs for preset-ja-technical-writing, preset-japanese, preset-ja-spacing and textlint-rule-prh; textlint.org docs (configuring, ignore); the allowlist filter README; the "Collection of textlint rule" wiki page, of which only the first ~60% came back word for word.
- Vale: docs.vale.sh (the `vale.sh/docs` URLs now redirect there): the 12 checks, vocabularies, scopes, `.vale.ini`, actions, packages and comment directives.
- remark-lint: the READMEs for the three presets and the main README.
- **retext plugins:** the descriptions below come from general knowledge, not from fetched pages. Treat that block as lower-confidence.

## How each item is classified

- **has**: a chaff rule or config key does it. Often it is a within-document consistency rule instead of a fixed choice; that is how chaff is supposed to do it.
- **partial**: chaff covers some of it. The note says what is missing.
- **missing — fits**: chaff does not have it, but it fits chaff's principles. The note sketches how.
- **does not fit**: one reason, from this set:
  - *rewrites*: chaff never fixes text.
  - *source-only*: the item is Markdown source layout that renders the same either way. chaff checks what the reader sees; a formatter such as Prettier handles source layout.
  - *taste*: a style choice with no within-document consistency form.
  - *bundled values list*: chaff ships no team's word list; a team can add one through `custom_rules`.
  - *network/model*: needs a model or a network call in the lint path.

chaff mechanisms the tables refer to:

- `stet` / `stet-section` / `stet-file`: HTML comments that name rule ids and give a reason after `—`. `chaff suppressions` lists them.
- chaff.yaml keys: `rules` (levels, or a number as the limit), `prefer` (avoid → use), `jargon`, `required_sections`, `names`, `style` (bundled house styles: koyobun, bunkacho, ieice, jis-z8301-2011, jis-z8301-2019), `options` (rule options), `by_path`, `custom_rules`, `plugins`, `include`, `genre`, `profile`, `language`, `guide`.
- `by_path` accepts **only** `genre`, `language` and `profile`. It cannot set rule levels.
- `custom_rules` has four types:
  - `words`: a list, or an avoid → use map whose replacement shows in the message.
  - `pattern`: a regex, with `ignore_case`; the regex is checked for safety and has a timeout.
  - `tokens`: matches on part of speech or base form.
  - `module`: a Node function.
  - Every type can carry `level`/`levels`, `use_for`, a bilingual name, why, message and how_to_fix, and an example. `plugin-test` checks the example.
- `plugins`: shared rule packs (npm packages or paths).
- Output: the default view, `--compact`, `--json` and `--sarif`. `--baseline` reports only new findings.
- Front matter is read, and `genre:` / `type:` in it sets the genre for that file.
- Walking a folder skips a fixed list: node_modules, dist, build, coverage, .git, .chaff-cache.
- There is no ignore file, no exclude globs, no severity filter flag, and no `--config` flag.

---

## 1. markdownlint (MD001–MD059, plus the mechanisms)

Retired IDs are absent: MD002, MD006, MD008, MD015, MD016, MD017, MD057. MD060 (table column alignment) is past the range asked for and is *source-only*.

| Item | chaff status | Note |
|---|---|---|
| MD001 heading-increment | **has** | `heading-level-skip` |
| MD003 heading-style (atx/setext) | **does not fit** | source-only: both render as the same heading |
| MD004 ul-style | **has** | `list-marker-mix` (consistency form; also covers `・`) |
| MD005 list-indent | **does not fit** | source-only (a formatter's job) |
| MD007 ul-indent | **does not fit** | source-only |
| MD009 no-trailing-spaces | **does not fit** | source-only |
| MD010 no-hard-tabs | **does not fit** | source-only |
| MD011 no-reversed-links `(text)[url]` | **missing — fits** | Renders as literal brackets, so the link is lost. A small rule in the family of `unrendered-emphasis`, say `reversed-link` |
| MD012 no-multiple-blanks | **does not fit** | source-only |
| MD013 line-length | **does not fit** | source wrapping. chaff measures the reader's unit instead: `max-sentence-length`, `max-paragraph-length` |
| MD014 commands-show-output (`$` with no output) | **partial** | `shell-prompt-mix` checks that `$` is used the same way throughout. Whether output is shown is taste |
| MD018 no-missing-space-atx `#Heading` | **missing — fits** | Renders as a paragraph, so the heading silently disappears; this is common in Japanese text as `#見出し`. Rule `heading-marker-no-space` |
| MD019 no-multiple-space-atx | **does not fit** | source-only |
| MD020 no-missing-space-closed-atx | **missing — fits** | Same defect as MD018; fold it into the same rule |
| MD021 no-multiple-space-closed-atx | **does not fit** | source-only |
| MD022 blanks-around-headings | **does not fit** | source-only |
| MD023 heading-start-left | **does not fit** | source-only (four spaces of indent would make it code, which is rare) |
| MD024 no-duplicate-heading | **has** | `duplicate-heading`: same text under the same parent, equal to markdownlint's `siblings_only: true` |
| MD025 single-title / single-h1 | **missing — fits** | Low value. "Two titles in one document" is often a pasted second document; it could be a structure rule. Concatenated docs are legitimate, so measure it first |
| MD026 no-trailing-punctuation (heading) | **has** | `heading-end-punctuation-mix` (consistency form, no fixed side) |
| MD027 no-multiple-space-blockquote | **does not fit** | source-only |
| MD028 no-blanks-blockquote | **does not fit** | source-only |
| MD029 ol-prefix | **partial** | `numbering-gap` catches skipped or repeated numbers. `1. 1. 1.` versus `1. 2. 3.` renders the same, so that part is source-only |
| MD030 list-marker-space | **does not fit** | source-only |
| MD031 blanks-around-fences | **does not fit** | source-only |
| MD032 blanks-around-lists | **does not fit** | source-only |
| MD033 no-inline-html | **does not fit** | taste (a format policy, not a reading problem) |
| MD034 no-bare-urls | **has** | `bare-url-mix` (flags a bare URL only when the document's other links are words) |
| MD035 hr-style | **does not fit** | source-only |
| MD036 no-emphasis-as-heading | **missing — fits** | A paragraph of only bold text used as a heading. AI and chat-pasted documents do this constantly, and it hides the outline from `required-sections`, `toc-heading-mismatch`, `empty-section` and others. `bold-label-list` covers only list items. Rule `pseudo-heading` |
| MD037 no-space-in-emphasis | **partial** | `unrendered-emphasis` covers `**` that cannot pair. `** bold **` does not render, so it probably falls under it; confirm with a test |
| MD038 no-space-in-code | **does not fit** | source-only |
| MD039 no-space-in-links | **does not fit** | source-only (renders with the space, trivially) |
| MD040 fenced-code-language | **has** | `code-fence-language-mix` (consistency form) |
| MD041 first-line-heading | **does not fit** | taste. `preamble-length` covers the reading problem |
| MD042 no-empty-links | **has** | `broken-link` ("no address") |
| MD043 required-headings | **partial** | `required_sections` with `required-sections` checks presence only. markdownlint also checks order and wildcards (`*` `+` `?`). An order check fits: "Risks" required after "Proposal" |
| MD044 proper-names | **partial** | `name-variant` points at the minority spelling. `prefer: {Github: GitHub}` works one variant at a time. Missing: "this listed name must be written exactly so" (see WP2) |
| MD045 no-alt-text | **has** | `image-alt-text` (plus `image-file-name-alt`) |
| MD046 code-block-style | **does not fit** | source-only |
| MD047 single-trailing-newline | **does not fit** | source-only |
| MD048 code-fence-style | **does not fit** | source-only |
| MD049 emphasis-style | **does not fit** | source-only |
| MD050 strong-style | **does not fit** | source-only |
| MD051 link-fragments | **has** | `broken-link` (missing heading), `cross-doc-broken-link` |
| MD052 reference-links-images (undefined label) | **has** | `broken-link` ("no definition") |
| MD053 link-image-reference-definitions (unused or duplicate) | **missing — fits** | An unused or duplicated `[x]: url` definition. Sibling of `footnote-mismatch` and `unused-definition`. Rule `link-definition-unused` |
| MD054 link-image-style | **does not fit** | taste, except bare URLs (`bare-url-mix`) |
| MD055 table-pipe-style | **does not fit** | source-only |
| MD056 table-column-count | **partial** | `table-row-overflow` catches rows with more cells than the header. Rows with fewer cells (a value silently missing) are not caught; extend the rule |
| MD058 blanks-around-tables | **does not fit** | source-only |
| MD059 descriptive-link-text | **has** | `vague-link-text` |
| *Mechanism:* inline disable / enable / disable-line / disable-next-line | **partial** | `stet` (next block), `stet-section`, `stet-file`, each with rule ids and a reason. Missing: an explicit begin/end range, and a quoted-passage form for all rules (see WP5) |
| *Mechanism:* capture / restore | **does not fit** | Not needed: a stet covers a bounded scope and never toggles state |
| *Mechanism:* configure-file (config inside the document) | **partial** | Front matter `genre:` / `type:` works per file. Rule levels in front matter do not; this needs a decision (WP23) |
| *Mechanism:* `noInlineConfig` | **partial** | `chaff suppressions` lists every stet and its reason, for audit. No switch ignores them; a CI flag could fit, low priority |
| *Mechanism:* per-directory config / `overrides` by glob | **partial** | `by_path` can set genre, language or profile per glob, but not rule levels (see WP1) |
| *Mechanism:* `extends` / shared config | **partial** | `plugins` (rule packs) and `style:` (bundled styles only). A team cannot point `style:` at its own file |
| *Mechanism:* globs / ignores / gitignore | **partial** | `include:` adds file types; the skip list is fixed. No exclude globs and no ignore file (WP11) |
| *Mechanism:* custom rules | **has** | `custom_rules` (words, pattern, tokens, module), `plugins` |
| *Mechanism:* front matter handling | **has** | front-matter.ts; front matter is not linted as prose and sets the genre |
| *Mechanism:* per-rule severity | **has** | levels → info / warning / error |
| *Mechanism:* `--fix` / `--format` | **does not fit** | rewrites |
| *Mechanism:* output formatters (json, sarif, junit, codequality, GitHub annotations) | **has** | `--json`, `--sarif`, `--compact`. JUnit and GitLab are not needed while SARIF exists |
| *Mechanism:* tags (switch groups of rules) | **partial** | Rules have groups (`rules` table), but chaff.yaml cannot set a level per group. Low priority |

## 2. textlint (presets, prh, core mechanisms, common ja/en rules)

### 2a. preset-ja-technical-writing (23) and preset-japanese (12; only its unique rule is listed)

| Item | chaff status | Note |
|---|---|---|
| sentence-length (100) | **has** | `max-sentence-length` (ja normal is 100; strict 70, relaxed 140; a number sets it directly) |
| max-comma (3) | **partial** | `max-ten` counts 、. A sentence that uses ， or English commas is not counted; `kutoten-consistency` only checks that one form is used |
| max-ten (3) | **has** | `max-ten` |
| max-kanji-continuous-len (6) | **has** | `max-kanji-continuous` (has an `allow` option) |
| arabic-kanji-numbers | **missing — fits** | Consistency form: the same counter written both ways (3つ / 三つ, 1人 / 一人) in one document, flagging the minority. The English counterpart is a small number written both as a word and a figure ("three files" / "3 files"). `number-style-consistency` covers only 1,000 vs 1000 (WP9) |
| no-mix-dearu-desumasu | **partial** | `no-mixed-desumasu` flags the minority register. textlint can also *require* a register per region (headings, body, lists). chaff deliberately does not choose one; a team-chosen option fits "the team decides" (WP17, needs a decision) |
| ja-no-mixed-period | **has** | `missing-final-period` (consistency form), `kutoten-consistency` |
| no-double-negative-ja | **has** | `double-negative` (ja and en) |
| no-dropping-the-ra | **has** | `ra-nuki` |
| no-doubled-conjunctive-particle-ga | **has** | `adversative-ga-repeat` |
| no-doubled-conjunction | **has** | `repeated-conjunction`, `sentence-initial-conjunction-run` |
| no-doubled-joshi | **has** | `no-doubled-joshi` |
| no-nfd | **has** | `lookalike-character` (copy-paste NFD dakuten) |
| no-invalid-control-character | **has** | `invisible-character` (control characters, tag characters) |
| no-zero-width-spaces | **has** | `invisible-character` |
| no-exclamation-question-mark | **does not fit** | taste as a ban. The consistency part is `exclamation-width-consistency`; a team that bans ！ uses a `words` custom rule |
| no-hankaku-kana | **has** | `hankaku-kana` |
| ja-no-weak-phrase (かもしれない, と思います) | **has** | `excessive-hedging`, as a density rule (stacked hedges) rather than every instance, by design |
| ja-no-successive-word | **has** | `doubled-word` |
| ja-no-abusage (適用/適応-type misuse) | **partial** | `idiom-misuse`, `misconversion`, `known-misspelling` cover the class. textlint's dictionary has entries chaff's lexicons lack; port the entries into the lexicons after a licence check (WP24) |
| ja-no-redundant-expression (することができる → できる) | **partial** | `redundant-expression` covers 一番最初 and the like. することができる is deliberately left out (`lang-ja/lexicons/translationese.yaml`: humans use it normally). The other textlint entries are worth comparing one by one |
| ja-unnatural-alphabet | **has** | `ime-residue` |
| no-unmatched-pair | **has** | `unbalanced-bracket` |
| (preset-japanese) no-kangxi-radicals | **has** | `lookalike-character` (its example is a Kangxi ⼭) |

### 2b. preset-ja-spacing (11)

| Item | chaff status | Note |
|---|---|---|
| ja-nakaguro-or-halfwidth-space-between-katakana | **missing — fits** | Consistency form: katakana compounds joined with ・ in some places, a space in others, nothing in others. `orthographic-variant` catches only the *same* compound written two ways. Low value (WP20) |
| ja-no-space-around-parentheses | **partial** | `stray-space` covers stray spaces inside Japanese phrases. Space around （ ） is not a rule of its own; fold it into WP19 |
| ja-no-space-around-slash | **missing — fits** | Fold into WP19 as a consistency form |
| ja-no-space-between-full-width | **has** | `stray-space` |
| ja-space-between-half-and-full-width (never) | **has** | `latin-spacing` (consistency form: spaced in some places, not in others). A team or style picks a side only through `style` |
| ja-space-after-exclamation | **missing — fits** | Consistency form: after a mid-paragraph ！, a full-width space in some places and none in others (WP19) |
| ja-space-after-question | **missing — fits** | Same, for ？ (WP19) |
| ja-space-around-code | **missing — fits** | Consistency form for inline code, extending `latin-spacing` (WP19) |
| ja-space-around-link | **missing — fits** | Same, for link text (WP19) |
| ja-space-around-emphasis (off by default) | **does not fit** | source-only: the emphasis markers vanish, and spacing around them is rarely seen |
| ja-space-around-strong (off by default) | **does not fit** | source-only |

### 2c. textlint-rule-prh

| Item | chaff status | Note |
|---|---|---|
| `expected` + `pattern(s)` (wrong form → right form) | **has** | `prefer:` + `preferred-term`. Also a `custom_rules` words map with the team's own message |
| `expected` alone (match any case or width of it: `Cookie` ⇒ `[CcＣｃ]…`) | **missing — fits** | "Write this term exactly so" with no variants to list: flag every case, width or hyphen variant. Same as MD044 and Vale.Terms (WP2) |
| regex patterns with `$1` in `expected` | **partial** | A `pattern` custom rule can flag the text but cannot put a capture in the suggested form, and `prefer` is literal only (WP18, decision) |
| `wordBoundary` | **partial** | English word boundaries are applied by the tokenizer; there is no per-entry switch. Low priority |
| `specs` (from/to tests in the dictionary) | **partial** | A custom rule's `example` before/after is checked by `plugin-test`. `prefer` entries have no tests |
| `imports` (split dictionaries) | **partial** | Rule packs via `plugins`. A `prefer` list cannot be imported from another file. Low priority |
| checkHeader / checkLink / checkBlockQuote / checkEmphasis / checkParagraph | **missing — fits** | Choose which parts of the document a rule reads. A `scope:` field on custom rules (WP6) |
| checkCodeComment (JS comments) | **does not fit** | chaff skips code by design; the proper home is a code linter |
| `--fix` | **does not fit** | rewrites |

### 2d. textlint core mechanisms

| Item | chaff status | Note |
|---|---|---|
| filter-rule-comments (`textlint-disable` / `textlint-enable`, per rule) | **partial** | `stet` scopes, with a reason. No begin/end range (WP5) |
| filter-rule-allowlist (strings or regexes never reported; `allowlistConfigPaths`) | **missing — fits** | `allow:` in chaff.yaml: literal or regex, global or per rule, **with a reason**, listed by `chaff suppressions` (WP4) |
| filter-rule-node-types (no findings inside BlockQuote and the like) | **missing — fits** | Part of WP6 (scope with negation, e.g. `~quote`) |
| severity error / warning / info | **has** | levels map to info / warning / error |
| presets and sharable configs (`--config module`) | **partial** | Genres, bundled styles and `plugins`. No `--config` flag and no team-authored style file |
| `.textlintignore` | **missing — fits** | WP11 |
| format plugins (html, Re:VIEW, rst, latex, asciidoc) | **partial** | Markdown, MDX and text, plus `include:` (yaml). Each other format is an adapter: fits, but large; a decision on which formats |
| `--fix` | **does not fit** | rewrites |

### 2e. Other common textlint rules (wiki)

| Item | chaff status | Note |
|---|---|---|
| ja-hiragana-keishikimeishi / ja-hiragana-hojodoushi | **has** | `kana-function-word` (side chosen by `style: koyobun`) |
| ja-hiragana-fukushi | **has** | `hiragana-fukushi` |
| ja-hiraku | **partial** | `kana-function-word` and `hiragana-fukushi` cover the official-style subset |
| no-mixed-zenkaku-and-hankaku-alphabet | **has** | `fullwidth-alnum-consistency` |
| no-insert-dropping-sa (さ入れ: 読まさせて) | **missing — fits** | ja-only like `ra-nuki`; detectable with the `tokens` adapter (WP13) |
| no-synonyms / ja-no-orthographic-variants | **has** | `orthographic-variant`, `katakana-long-vowel`, `cross-doc-term-variant` |
| joyo-kanji / ja-joyo-or-jinmeiyo-kanji / allowed-kanji | **missing — fits** | Taking a side, so it runs only through a named `style` (koyobun or bunkacho) or a team setting. Needs a decision, and has no English counterpart (WP15) |
| jis-charset | **missing — fits** | Characters outside JIS X 0208/0213 (machine-dependent ①, ㈱ in old systems). Low value today |
| first-sentence-length | **partial** | `max-sentence-length`, `no-lead`, `heading-echo` cover the reading problem |
| prefer-tari-tari | **has** | `tari-unpaired` |
| no-filler (ええと, あの, まあ) | **missing — fits** | Fillers left in minutes or notes made from a transcript, a common case with AI transcription. ja and en (um, uh, you know); off for `speech/transcript` (WP12) |
| ja-overlooked-typo (ス二ーカー: kanji 二 in katakana) | **partial** | `lookalike-character` covers lookalike code points. Whether it catches 二 vs ニ inside katakana is unverified; add a test |
| no-hoso-kinshi-yogo / ja-no-inappropriate-words | **does not fit** | bundled values list (a team adds its own via `custom_rules` words) |
| ja-yahoo-kousei / a3rt-proofreading | **does not fit** | network/model |
| use-si-units | **does not fit** | taste. `unit-mismatch` covers what can be checked |
| incremental-headers | **has** | `heading-level-skip` |
| max-appearence-count-of-words | **partial** | `ngram-repetition` |
| no-todo | **has** | `unfilled-placeholder` |
| ng-word | **has** | `custom_rules` words, `jargon` |
| no-dead-link | **partial** | `broken-link` / `cross-doc-broken-link` cover in-document and cross-file links. External liveness is network: does not fit |
| no-start-duplicated-conjunction | **has** | `repeated-conjunction`, `sentence-initial-conjunction-run` |
| period-in-list-item | **partial** | `list-item-form-mix` (phrases vs sentences). A trailing-period consistency among list items is a small gap |
| period-in-header | **has** | `heading-end-punctuation-mix` |
| date-weekday-mismatch | **has** | `date-weekday-mismatch` |
| no-surrogate-pair | **does not fit** | a legacy encoding constraint, not a reading problem |
| no-curly-quotes | **has** | `quote-style-consistency` (consistency form) |
| doubled-spaces (English, mid-sentence) | **partial** | `sentence-spacing-consistency` (between sentences), `stray-space` (ja). A double space between words in English is not covered; low priority |
| write-good | **has** | `weasel-word`, `agentless-passive`, `adverb-overuse`, `wordy-phrase`, `cliche`, `expletive-construction`, `very-adjective` |
| terminology | **has** | `prefer` + `preferred-term` (the team's list; chaff ships none) |
| common-misspellings | **has** | `known-misspelling` |
| spelling / en-spell / spellchecker | **partial** | `unknown-word` flags only words one letter from a dictionary word (for precision); `names:` accepts names. A full dictionary check is deliberately not done |
| unexpanded-acronym | **has** | `undefined-acronym` |
| abbr-within-parentheses | **partial** | `undefined-acronym`, `acronym-expansion-conflict` |
| en-capitalization (sentence start, etc.) | **partial** | `calendar-name-case`, `title-case-consistency`. A sentence opening in lower case is not covered (small) |
| en-max-word-count | **has** | `max-sentence-length` (en is counted in words) |
| stop-words | **partial** | `wordy-phrase` |
| languagetool | **does not fit** | network (an external server) |
| preset-slopless (LLM prose) | **has** | the "Signs of generated text" group (`ai-tell`, `contrast-framing`, `stock-transition`, … `ai-generated-composite`) |

## 3. Vale

| Item | chaff status | Note |
|---|---|---|
| check `existence` | **has** | `custom_rules` words / pattern; many built-in lexicon rules |
| check `substitution` (swap, with suggestion) | **has** | `prefer` / `preferred-term`, and the `words` avoid → use map (the suggestion is in the message). Regex swap with `$1` is missing (WP18) |
| check `occurrence` (max/min of a token per scope) | **partial** | Many built-in density rules exist, but a team cannot write "at most N per paragraph" or "at least one per section" without a `module` (WP16, decision) |
| check `repetition` | **has** | `doubled-word` |
| check `consistency` (`either:` pairs; the first form sets the expectation) | **partial** | Automatic for spellings (`orthographic-variant`, `spelling-consistency`, `katakana-long-vowel`). Missing: **team-listed pairs where either is right but not both** (顧客 / お客様, 申込 / 申し込み), flagging the minority. This is exactly chaff's "take no side" form (WP3) |
| check `conditional` (if A then B; acronym defined) | **partial** | `undefined-acronym`, `undefined-term`, `use-before-definition`. A generic team "if A appears, B must" type is missing; low priority |
| check `capitalization` ($title / $sentence on headings) | **has** | `title-case-consistency` (consistency form). Forcing one case is taste unless a team sets it |
| check `metric` (formula over counts) | **partial** | A fixed set of metrics (sentence, paragraph and section lengths, densities). Team formulas only through a `module` |
| check `readability` (FK, Fog, SMOG, Coleman-Liau, ARI) | **missing — fits** | Deterministic, but needs a Japanese counterpart to satisfy "ja and en both" (e.g. jReadability, or kanji ratio plus sentence length), and should be placed by `rules:measure`. Decision (WP14) |
| check `spelling` (Hunspell, custom dictionaries, ignore files) | **partial** | `unknown-word` (one-edit only, for precision); `names:` acts as the accept list |
| check `sequence` (POS token patterns) | **has** | `custom_rules` type `tokens` |
| check `script` (Tengo) | **has** | `custom_rules` type `module` (Node) |
| key `message` / `level` / `description` | **has** | Every rule and custom rule has a bilingual name, why, message, how_to_fix and levels |
| key `link` (guidance URL) | **partial** | `chaff explain`, plus `docs/samples/<lang>/<rule>.md`. Custom rules have no `link` field (small) |
| key `limit` (alerts per file) | **partial** | levels set a count before a rule reports; there is no cap on the number of alerts |
| key `exceptions` (per-rule allow regexes) | **missing — fits** | WP4 (`allow:` per rule) |
| actions replace / remove / edit / convert | **does not fit** | rewrites. The suggestion text itself is shown (`{preferred}`) |
| action `suggest` (spellings) | **partial** | `unknown-word` names the near dictionary word; nothing is applied |
| Vocab `accept.txt` (exceptions for every rule) | **partial** | `names:` (read as one name; exempt from `unknown-word` and kanji-run counts). Not an exception list for every rule |
| Vocab `reject.txt` / Vale.Avoid | **has** | `custom_rules` words; `jargon` for in-house words |
| Vale.Terms (enforce the exact case of accepted terms) | **missing — fits** | WP2 |
| Vale.Repetition | **has** | `doubled-word` |
| scopes (heading, table.cell, list, blockquote, alt, link, sentence, paragraph; `~` / `&`; `doc()` selectors) | **missing — fits** | `scope:` on custom rules (WP6). Built-in rules already know their scopes |
| `.vale.ini` glob sections with BasedOnStyles / per-rule settings | **partial** | `by_path` sets genre, language and profile; rule levels missing (WP1) |
| MinAlertLevel / `--minAlertLevel` | **missing — fits** | A `--min-severity` flag (WP21). Low priority |
| BlockIgnores / TokenIgnores (regex regions skipped) | **missing — fits** | WP4 (`allow:` regex) |
| comment `vale off` / `vale on` | **partial** | `stet` scopes; no on/off range (WP5) |
| comment `Rule = NO` / `Rule["match"] = NO` | **partial** | Per-rule stet exists; a stet for one matched word only does not (WP5) |
| comment `style = X` (switch styles in the document) | **does not fit** | Per-file styles belong in `by_path` / front matter; in-document style switching makes results hard to explain |
| conditional sections (`[*.md if .Meta.draft]`) | **partial** | Front matter `genre:` / `type:`; general conditions are missing. Low priority |
| Packages (Microsoft, Google, write-good, proselint, Readability, Hugo; `vale sync`) | **has** | `plugins` (npm or path rule packs), bundled `style:` |
| package write-good / proselint | **has** | See the write-good row in §2e; proselint's areas map to `cliche`, `redundant-expression`, `weasel-word`, `very-adjective`, `uncomparable-graded`, `nonstandard-word`, `hyphen-as-dash` |
| package Microsoft / Google (style guides) | **partial** | Their checkable parts are covered in consistency form (`contraction-consistency`, `oxford-comma-consistency`, `title-case-consistency`, `person-consistency`, `vague-link-text`). Fixed choices such as "use contractions" are taste |
| package alex / Joblint | **does not fit** | bundled values list (team words via `custom_rules`) |

## 4. remark-lint

### 4a. remark-preset-lint-recommended (13)

| Item | chaff status | Note |
|---|---|---|
| final-newline | **does not fit** | source-only |
| hard-break-spaces | **does not fit** | source-only |
| list-item-bullet-indent | **does not fit** | source-only |
| list-item-indent ('one') | **does not fit** | source-only |
| no-blockquote-without-marker | **does not fit** | source-only (lazy continuation renders the same) |
| no-duplicate-definitions | **missing — fits** | Same rule as MD053 (WP10a) |
| no-heading-content-indent | **does not fit** | source-only |
| no-literal-urls | **has** | `bare-url-mix` |
| no-shortcut-reference-image | **does not fit** | source-only (an undefined label is `broken-link`) |
| no-shortcut-reference-link | **does not fit** | source-only (same) |
| no-undefined-references | **has** | `broken-link` |
| no-unused-definitions | **missing — fits** | WP10a |
| ordered-list-marker-style ('.') | **partial** | `list-marker-mix` covers bullets, `heading-numbering-mix` covers headings. Ordered list and enumeration markers mixed at one level (1. / 1) / (1) / ① / 一、) are not covered; common in Japanese business documents (WP8) |

### 4b. remark-preset-lint-consistent (13)

| Item | chaff status | Note |
|---|---|---|
| blockquote-indentation | **does not fit** | source-only |
| checkbox-character-style | **does not fit** | source-only |
| code-block-style | **does not fit** | source-only |
| emphasis-marker | **does not fit** | source-only |
| fenced-code-marker | **does not fit** | source-only |
| heading-style | **does not fit** | source-only |
| link-title-style | **does not fit** | source-only |
| list-item-content-indent | **does not fit** | source-only |
| ordered-list-marker-style | **partial** | WP8 (rendered markers; `.` vs `)` in Markdown is the source-visible case) |
| ordered-list-marker-value | **partial** | `numbering-gap`. The value style is source-only |
| rule-style | **does not fit** | source-only |
| strong-marker | **does not fit** | source-only |
| table-cell-padding | **does not fit** | source-only |

### 4c. remark-preset-lint-markdown-style-guide (rules not already listed above)

| Item | chaff status | Note |
|---|---|---|
| definition-case | **does not fit** | source-only |
| definition-spacing | **does not fit** | source-only |
| fenced-code-flag | **has** | `code-fence-language-mix` (consistency form) |
| file-extension | **does not fit** | file naming, not document content |
| final-definition | **does not fit** | source-only |
| heading-increment | **has** | `heading-level-skip` |
| list-item-spacing | **does not fit** | source-only |
| maximum-heading-length | **has** | `title-length` |
| maximum-line-length (80) | **does not fit** | source-only |
| no-consecutive-blank-lines | **does not fit** | source-only |
| no-duplicate-headings | **has** | `duplicate-heading` |
| no-emphasis-as-heading | **missing — fits** | WP7 `pseudo-heading` |
| no-file-name-articles / -consecutive-dashes / -irregular-characters / -mixed-case / -outer-dashes | **does not fit** | file naming (five rules on one row) |
| no-heading-punctuation | **has** | `heading-end-punctuation-mix` |
| no-multiple-toplevel-headings | **missing — fits** | Same as MD025 (WP22, low) |
| no-shell-dollars | **has** | `shell-prompt-mix` (consistency form) |
| no-table-indentation | **does not fit** | source-only |
| table-pipe-alignment | **does not fit** | source-only |
| table-pipes | **does not fit** | source-only |
| unordered-list-marker-style | **has** | `list-marker-mix` |
| *Mechanism:* `<!--lint disable/enable/ignore-->` | **partial** | `stet` (WP5) |
| *Mechanism:* severity per rule, `.remarkrc` | **has** | levels in chaff.yaml |

### 4d. retext plugins (lower confidence: from general knowledge, pages not fetched)

| Item | chaff status | Note |
|---|---|---|
| retext-spell | **partial** | `unknown-word` (one-edit only) |
| retext-readability | **missing — fits** | WP14 |
| retext-equality | **does not fit** | bundled values list |
| retext-passive | **has** | `agentless-passive` |
| retext-simplify | **has** | `wordy-phrase` |
| retext-intensify | **has** | `empty-intensifier`, `weasel-word`, `excessive-hedging` |
| retext-profanities | **does not fit** | bundled values list |
| retext-repeated-words | **has** | `doubled-word` |
| retext-contractions (misplaced apostrophe: "does'nt") | **partial** | `contraction-consistency` checks that contractions are used one way throughout. A misplaced apostrophe is a small lexicon gap (could live in `known-misspelling`) |
| retext-quotes | **has** | `quote-style-consistency` |
| retext-sentence-spacing | **has** | `sentence-spacing-consistency` |
| retext-indefinite-article | **has** | `article-sound` |
| retext-diacritics (cafe / café) | **partial** | `orthographic-variant` might pair them; unverified |
| retext-redundant-acronyms ("ATM machine") | **has** | `redundant-expression` (the en lexicon has "ATM machine" and "PIN number") |
| retext-latin | **partial** | `latin-abbreviation-form` checks the form (e.g.). Replacing Latin with English is taste |

---

## Counts per tool

Each table row counts once; the five no-file-name rules count as one row.

| Tool | has | partial | missing — fits | does not fit | rows |
|---|---|---|---|---|---|
| markdownlint (52 rules + 13 mechanisms) | 15 | 13 | 6 | 31 | 65 |
| textlint (presets, prh, core, wiki rules) | 40 | 23 | 16 | 11 | 90 |
| Vale (checks, keys, vocab, scopes, config, packages) | 11 | 14 | 6 | 3 | 34 |
| remark-lint (3 presets, mechanisms, retext) | 18 | 8 | 5 | 32 | 63 |

(Recount with the command at the end of this file if the tables are edited.)

What the counts say:

- **markdownlint and remark-lint** are mostly Markdown source layout. chaff deliberately leaves that to a formatter.
- The markdownlint and remark-lint items that change what the **reader sees** are almost all covered already. The gaps are a bold line used as a heading, `#見出し` with no space, reversed links, unused link definitions, and table rows that are short.
- **textlint's Japanese presets** are nearly fully covered, often by consistency rules that take no side where textlint fixes one. The real gaps:
  - kanji vs Arabic numerals
  - さ入れ (no-insert-dropping-sa)
  - fillers
  - allowed-kanji sets
  - Japanese symbol spacing
  - an allowlist
- **Vale** shows where chaff's *mechanisms* are thinner than its *rules*:
  - scoped team rules
  - team consistency pairs
  - exact-form terms
  - an allowlist / exceptions
  - per-path rule levels
  - readability metrics

---

## Work packages (missing — fits), ranked

Each package is one rule or one mechanism, sized for one agent and one PR.

- ★ marks the highest value for business documents written or checked with AI.
- "Decision" means the maintainer has to choose something before an agent starts.
- Every package also updates the READMEs (en and ja), `packages/chaff/skills/chaff/SKILL.md` and the site guide, as CLAUDE.md requires for a user-visible change. A rule package also adds its planted cases and samples and is placed with `yarn rules:measure --apply`.

### Tier 1

1. ★ **WP2: team terms written exactly so** (MD044, Vale.Terms, prh `expected`-only)
   - A listed name or term (`GitHub`, `JavaScript`, `Claude Code`, `株式会社アオバ`) is flagged in any variant of case, width, hyphen or space (`Github`, `ＧｉｔＨｕｂ`, `Java Script`).
   - Why it matters: AI drafts get product and partner names subtly wrong all the time, and `name-variant` stays silent when the wrong form is the only one in the document.
   - Files:
     - new `rules/term-exact-form.yaml`
     - `src/detectors/registry/term-exact-form.ts`
     - a detector next to `src/detectors/orthography.ts`
     - `src/config/load.ts` (only if it gets a new key)
     - `test/test_term_exact_form.ts`
   - **Decision:** reuse `names:` (it already means "the team's names") or add a separate `terms:` key; and should a listed name in a lowercase common-noun use ("github action") still be flagged.
2. ★ **WP3: team consistency pairs** (Vale `consistency`)
   - `consistent:` (or `either:`) in chaff.yaml lists pairs or groups that are each fine: `[顧客, お客様]`, `[申込, 申し込み]`, `[sign in, log in]`. A document using more than one is flagged at the minority form, exactly the form of `orthographic-variant`.
   - Why it matters: this is the "take no side" principle as team data, and it catches synonym drift that AI introduces across sections.
   - Files:
     - `src/config/load.ts` (new key, with unreadable-value reporting like `names`)
     - new `rules/team-consistency.yaml`
     - registry file and detector, reusing the minority logic of `orthography.ts`
     - test file
   - **Decision:** the key name; and whether `cross-doc-term-variant` should also read these pairs across files.
3. ★ **WP1: rule levels per path** (markdownlint overrides, `.vale.ini` glob sections)
   - `by_path` entries accept `rules:` (levels or numbers), so a repository can hold contracts and manuals under one chaff.yaml.
   - Files:
     - `src/config/load.ts` (`toPathRule`)
     - `src/config/by-path.ts`, `by-path-problems.ts`
     - where the per-file config is resolved (the run path that applies `byPath`)
     - `src/render/rules-json.ts` (show the source as `by_path: <glob>`)
     - `test/test_by_path*.ts`
   - **Decision (small):** precedence. Proposed: `--genre` > by_path rules > top-level `rules:` > style > genre preset.
4. ★ **WP7: `pseudo-heading`** (MD036, remark no-emphasis-as-heading)
   - A paragraph that is only bold (or only bold plus a colon) standing where a heading would. Report it when the document also has real headings, or when the bold line is followed by body text and no heading of its own.
   - Why it matters: AI and chat pastes produce these constantly, and they hide the outline from `required-sections`, `toc-heading-mismatch` and `empty-section`.
   - Files:
     - `rules/pseudo-heading.yaml`
     - `src/detectors/registry/pseudo-heading.ts` plus the detector
     - `test/test_pseudo_heading.ts`
     - planted cases in `test/fixtures/planted/`
   - No decision: placement by measurement.
5. ★ **WP12: `filler-word`** (textlint no-filler)
   - ええと, あの, まあ, えー / um, uh, you know, kind of. Fillers left in minutes, notes or summaries made from a transcript.
   - Files:
     - `rules/filler-word.yaml` (`off_for` speech/transcript)
     - `packages/lang-ja/lexicons/filler.yaml`, `packages/lang-en/lexicons/filler.yaml`
     - registry file
     - test file
   - **Decision (small):** which genres it runs in. あの and まあ are ambiguous; the lexicon should list only unambiguous forms in sentence-initial position.
6. ★ **WP6: `scope:` on custom rules** (Vale scopes, prh check*, textlint node-types)
   - `scope: [heading]`, `[list, table]`, `[~quote]` limit where a `words`, `pattern` or `tokens` rule reads.
   - Example: "no 。 in headings", "no 弊社 in quoted customer text".
   - Files:
     - `src/custom/parse.ts`, `src/custom/dsl-fields.ts` (new field, checked)
     - `src/custom/load.ts` (filter the text given to the matcher)
     - `src/plugin.ts` (only if the scope must reach module rules)
     - `test/test_custom_rules*.ts`
   - **Decision:** the scope vocabulary (proposed: heading, paragraph, list, table, quote, link-text, alt, caption, with `~` negation), and whether `prefer` entries may carry a scope too.
7. ★ **WP4: `allow:` list** (textlint allowlist, Vale exceptions / TokenIgnores / BlockIgnores)
   - Literal strings or safe regexes, global or under a rule id, each with a reason. A finding whose matched text falls inside an allowed span is dropped and listed by `chaff suppressions`.
   - Files:
     - `src/config/load.ts`
     - new `src/allow.ts` beside `src/stet.ts`, reusing `src/custom/regex-safety.ts`
     - `src/render/suppressions.ts`, `src/commands/suppressions.ts`
     - test file
   - **Decision:** whether a reason is mandatory, as for stet; and whether a global allow covers all rules or only lexicon-matching ones.

### Tier 2

8. **WP8: `enumeration-marker-mix`** (remark ordered-list-marker-style)
   - Sibling items numbered 1. / 1) / (1) / ① / 一、 / (a) mixed at one level of one list or document, flagging the minority.
   - Files: `rules/enumeration-marker-mix.yaml`, registry file, detector (sharing code with `heading-numbering-mix` where it fits), test file.
   - No decision.
9. **WP9: `numeral-style-consistency`** (textlint arabic-kanji-numbers)
   - ja: the same counter written with kanji and Arabic numerals (三つ / 3つ, 一人 / 1人).
   - en: a small number written as a word in some places and a figure in others ("three days" / "3 days").
   - Fixed expressions (一般, 一つ一つ, 第一に, "one of") go in an exclusion lexicon.
   - Files: `rules/numeral-style-consistency.yaml`, ja and en lexicons, registry file, test file.
   - **Decision (small):** the name, or whether to extend `number-style-consistency` instead.
10. **WP10a: `link-definition-unused`** (MD053, remark no-unused-definitions / no-duplicate-definitions)
    - A `[label]: url` that nothing uses, or that is defined twice.
    - Files: `rules/link-definition-unused.yaml`, registry file, test file.
    - No decision.
11. **WP10b: `heading-marker-no-space`** (MD018 / MD020)
    - `#見出し` or `##Overview` at the start of a line, which renders as text. Exclude hashtags (`#tag` mid-line, or a line of several `#word`s).
    - Files: `rules/heading-marker-no-space.yaml`, registry file, test file.
    - No decision.
12. **WP10c: table rows with too few cells** (MD056): extend `table-row-overflow`, or add `table-row-short`.
    - Files: the rule YAML, its detector, test file.
    - No decision, other than the rule name.
13. **WP10d: `reversed-link`** (MD011): `(text)[https://…]`.
    - Files: rule YAML, registry file, test file.
    - No decision.
14. **WP13: `sa-ire`** (no-insert-dropping-sa)
    - さ入れ言葉 (読まさせて, 行かさせて). ja-only like `ra-nuki`, detected with the `tokens` adapter (a godan verb's 未然形 + させる).
    - Files: `rules/sa-ire.yaml`, registry file, test file.
    - No decision.
15. **WP5: stet ranges and match-specific stet** (textlint and markdownlint disable/enable, Vale `Rule["match"]`)
    - `<!-- stet-begin: rule-a, rule-b — reason -->` … `<!-- stet-end -->`
    - Optionally `<!-- stet: preferred-term["サーバー"] — reason -->`.
    - Files: `src/stet.ts`, `src/stet-block.ts`, `src/render/suppressions.ts`, `test/test_stet*.ts`.
    - **Decision:** whether to allow an all-rules form for a verbatim quotation (it cuts against "say why per rule"); range syntax.
16. **WP11: exclude globs** (`.textlintignore`, markdownlint `ignores`)
    - `exclude:` in chaff.yaml, or a `.chaffignore` file.
    - Files: `src/files.ts`, `src/config/load.ts`, test file.
    - **Decision:** a key or a file; whether to honour `.gitignore`.
17. **WP19: Japanese symbol spacing consistency** (preset-ja-spacing)
    - Spaces around （ ） and ／, after a mid-paragraph ！ / ？, and around inline code and link text, each in consistency form.
    - Either extend `latin-spacing` or add `ja-symbol-spacing-consistency` (one rule with kinds, the way `latin-spacing` has letter / before-digit / after-digit).
    - Files: the rule YAML, `src/detectors/orthography.ts` (the spacing code), test file.
    - **Decision (small):** extend or add.
18. **WP24: port ja-no-abusage and ja-no-redundant-expression entries** into the `idiom-misuse`, `misconversion` and `redundant-expression` lexicons.
    - Files: the `packages/lang-ja/lexicons/*.yaml` for those rules, plus the rule tests.
    - **Decision:** licence check and attribution (the textlint rules are MIT; per-entry review against the corpus).

### Tier 3 (needs a decision first, or low value)

19. **WP14: readability score** (Vale readability / metric, retext-readability)
    - en: Flesch-Kincaid grade or similar.
    - ja: a counterpart is needed (jReadability, or kanji ratio plus mean sentence length).
    - One rule, placed by `rules:measure`.
    - **Decision:** the formulas, whether it adds anything beyond `max-sentence-length` and `max-paragraph-length`, and how it fits "ja and en both".
20. **WP15: kanji outside the allowed set** (joyo-kanji)
    - Runs only under `style: koyobun` / `bunkacho`, or a team's `options`.
    - **Decision:** it takes a side, and has no English counterpart.
21. **WP17: team-chosen register for `no-mixed-desumasu`**
    - An option (body: desumasu, lists: dearu) that flags the other register even with no mix.
    - **Decision:** it moves chaff from "consistent" to "required", which is allowed only as the team's own choice.
22. **WP16: `count` custom rule type** (Vale occurrence)
    - max or min of a word or pattern per sentence, paragraph, section or document.
    - **Decision:** the DSL shape, and whether `min` (absence as a finding) is wanted.
23. **WP18: regex `prefer` with captures** (prh `$1`, Vale swap regex)
    - **Decision:** regex-safety limits and how the suggestion is shown.
24. **WP23: rule levels in front matter** (markdownlint configure-file)
    - **Decision:** whether in-document configuration is wanted at all. `stet-file` already covers most cases.
25. **WP22: `multiple-titles`** (MD025): more than one top-level heading. Low; measure before adding.
26. **WP21: `--min-severity`** (Vale MinAlertLevel). Low.
27. **WP20: katakana compound separator consistency** (・ / space / none). Low.
28. **jis-charset**: characters outside JIS X 0208/0213. Low.

## Recount command

```sh
awk '/^## [0-9]\./{t=$0} /^## Counts/{t=""} t!="" && /^\| /{ if($0 ~ /\*\*has\*\*/) h[t]++; else if($0 ~ /\*\*partial\*\*/) p[t]++; else if($0 ~ /missing — fits/) m[t]++; else if($0 ~ /does not fit/) d[t]++ } END{for(k in h) print k" has="h[k]" partial="p[k]" missing="m[k]" dnf="d[k]}' lint-parity.md
```
