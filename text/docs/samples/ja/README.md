<!-- yarn samples:update がルールの定義と見本から作ります。手で書き換えないでください。 -->

# chaff で直せる文章の見本

chaff が見つけるまちがいを、ルールごとに一つずつ見本にしました。
どの見本も、よくある文章、chaff の指摘、直した文章、直し方、設定の順に並んでいます。
指摘はどれも、その文章に chaff を実際にかけた出力です。

自分の文章で試すには、Node.js 24 以上で `npx chaffjs 文書.md` と打ちます。入れるものも、設定も要りません。
ブラウザで試すなら[プレイグラウンド](https://isamu.github.io/lab/ja/playground/)へ。

English samples: [../en/README.md](../en/README.md)

見本のあるルール: 3 / 272

## 読みやすさ

長すぎる文、詰めすぎた段落、読み手がつまずく書き方。

| ルール | 見つけるもの |
| --- | --- |
| [漢字が続きすぎている](max-kanji-continuous.md)（`max-kanji-continuous`） | 「新規顧客獲得施策検討会議」のように、漢字だけが長く続く所 |

まだ見本の無いルール: `adversative-ga-repeat`, `bold-density`, `bracket-nesting`, `clause-chain`, `demonstrative-opener-run`, `double-negative`, `emoji-density`, `heading-echo`, `hiragana-fukushi`, `max-paragraph-length`, `max-sentence-length`, `max-ten`, `ngram-repetition`, `no-doubled-joshi`, `no-nakaguro-parallel`, `one-sentence-paragraph-run`, `paragraph-restatement`, `proper-noun-density`, `repeated-conjunction`, `repeated-sentence-ending`, `repeated-sentence-head`, `sentence-initial-conjunction-run`, `taigen-dome-in-prose`, `title-length`, `topic-predicate-distance`, `undefined-acronym`

## 言葉づかい

中身を言わずに強める言い方、決まり文句、誰がしたのかを書かない受け身。

このグループの見本はまだありません。

まだ見本の無いルール: `adverb-without-negation`, `agentless-passive`, `baito-keigo`, `cliche`, `closing-cliche`, `colloquial-opener`, `comparative-without-baseline`, `connective-hierarchy`, `cushion-phrase-density`, `double-keigo`, `empty-intensifier`, `excessive-hedging`, `humble-for-others`, `idiom-misuse`, `kana-function-word`, `katakana-density`, `nado-closed-list`, `nominalization`, `nonstandard-word`, `obligation-without-deadline`, `ordinal-suffix-mismatch`, `padded-intro`, `ra-nuki`, `redundant-expression`, `request-without-deadline`, `requirement-smell`, `sasete-itadaku`, `tari-unpaired`, `teki-overuse`, `toki-as-condition`, `uncomparable-graded`, `unqualified-superlative`, `vague-deadline`, `vague-word-density`, `very-adjective`, `warning-without-action`, `weasel-word`, `wordy-phrase`, `yori-as-from`

## 書き損じ

書き換えの途中で残った語や空白。

このグループの見本はまだありません。

まだ見本の無いルール: `chat-citation-residue`, `doubled-nado`, `doubled-punctuation`, `doubled-word`, `hankaku-kana`, `ime-residue`, `invisible-character`, `kanji-compound-slip`, `known-misspelling`, `link-text-url-mismatch`, `lookalike-character`, `misconversion`, `stray-space`, `unbalanced-bracket`, `unfilled-placeholder`, `url-run-on`

## 表記の揃え

どちらで書いても正しいものが、一つの文書の中で混ざっている所。chaff はどちらが正しいかを決めず、少ないほうを指します。

| ルール | 見つけるもの |
| --- | --- |
| [文末の調子が混ざっている](no-mixed-desumasu.md)（`no-mixed-desumasu`） | 「です・ます」の中に「だ・である」が混ざった文 |

まだ見本の無いルール: `acronym-expansion-conflict`, `amount-scale-consistency`, `bare-url-mix`, `bracket-width-consistency`, `citation-style-mix`, `code-fence-language-mix`, `cross-doc-term-variant`, `currency-notation-consistency`, `date-format-consistency`, `defined-name-repeated`, `defined-term-form`, `ellipsis-consistency`, `exclamation-width-consistency`, `fullwidth-alnum-consistency`, `heading-end-punctuation-mix`, `katakana-long-vowel`, `kutoten-consistency`, `latin-spacing`, `list-item-form-mix`, `list-marker-mix`, `missing-final-period`, `name-variant`, `number-style-consistency`, `orthographic-variant`, `outside-announced-list`, `party-order`, `party-role-name`, `person-consistency`, `range-notation-consistency`, `shell-prompt-mix`, `table-header-variant`, `ui-label-variant`, `undefined-term`, `unit-spacing-consistency`

## 構造

番号の抜け、無い条への参照、同じ語の二重定義、長い前置き。

このグループの見本はまだありません。

まだ見本の無いルール: `absolute-exception`, `abstract-length`, `broken-link`, `concrete-evidence-density`, `cross-doc-broken-link`, `cross-doc-duplicate-definition`, `dangling-reference`, `date-without-year`, `duplicate-definition`, `duplicate-heading`, `email-greeting-closing`, `email-subject-length`, `empty-list-item`, `empty-section`, `empty-table-cell`, `figure-reference-order`, `footnote-mismatch`, `heading-level-skip`, `heading-numbering-mix`, `image-alt-text`, `image-file-name-alt`, `modal-conflict`, `no-lead`, `number-without-unit`, `numbered-generic-heading`, `numbering-gap`, `preamble-length`, `prerequisite-after-step`, `required-listed-as-preferred`, `step-reference-missing`, `table-row-overflow`, `toc-heading-mismatch`, `unclosed-code-fence`, `unlisted-item-used`, `unrendered-emphasis`, `unused-definition`, `use-before-definition`, `vague-figure-reference`, `vague-link-text`

## 事実の食い違い

日付と曜日、日付の順番、合計と内訳のように、暦や計算で確かめられる食い違い。

このグループの見本はまだありません。

まだ見本の無いルール: `amount-range-reversed`, `announced-count-mismatch`, `annual-holidays-mismatch`, `annual-pay-mismatch`, `arrival-before-departure`, `attachment-not-attached`, `backorder-mismatch`, `bmi-mismatch`, `capacity-runtime-mismatch`, `change-rate-mismatch`, `citation-reference-mismatch`, `closing-balance-mismatch`, `connection-time-short`, `contact-variant`, `count-over-capacity`, `cross-doc-fact-conflict`, `cumulative-below-current`, `currency-column-mix`, `dangling-figure-reference`, `date-order`, `date-outside-period`, `date-range-reversed`, `date-stamp-order`, `date-weekday-mismatch`, `deadline-after-event`, `deductible-exceeds-limit`, `default-value-mismatch`, `delivered-over-ordered`, `deprecated-option-used`, `discount-rate-mismatch`, `due-before-issue`, `duration-mismatch`, `duration-product-mismatch`, `elapsed-years-mismatch`, `fact-conflict`, `formula-amount-mismatch`, `gpa-mismatch`, `heading-command-missing`, `impossible-date`, `impossible-time`, `installment-total-mismatch`, `interest-mismatch`, `interval-count-mismatch`, `layout-code-mismatch`, `line-amount-mismatch`, `meter-usage-mismatch`, `net-amount-mismatch`, `net-over-gross`, `number-word-figure-mismatch`, `parameter-table-mismatch`, `percent-sum-mismatch`, `period-label-conflict`, `period-multiple-mismatch`, `period-part-exceeds-whole`, `phone-number-variant`, `product-exceeds-maximum`, `quantity-range-reversed`, `quote-unnamed-speaker`, `quote-without-source`, `range-band-mismatch`, `ratio-mismatch`, `reference-flag-mismatch`, `reference-number-repeated`, `reference-number-variant`, `reference-title-mismatch`, `reference-topic-missing`, `reference-unit-mismatch`, `relative-date-mismatch`, `rent-multiple-mismatch`, `return-type-mismatch`, `revision-direction-mismatch`, `running-balance-mismatch`, `scaled-quantity-mismatch`, `serial-range-reversed`, `share-amount-mismatch`, `share-over-hundred`, `step-time-sum-mismatch`, `summary-fact-mismatch`, `table-unit-mix`, `tax-mismatch`, `tier-threshold-mismatch`, `time-order`, `time-range-reversed`, `total-mismatch`, `undefined-function-call`, `unit-mismatch`, `variance-mismatch`, `version-mismatch`, `version-order`, `walk-time-distance-mismatch`

## AIっぽさ

生成された文章にありがちな特徴。どれも、それだけで生成されたとは言いません。読み返す場所の目印です。

| ルール | 見つけるもの |
| --- | --- |
| [結びで励ます・請け合う文が重なる](closing-exhortation.md)（`closing-exhortation`） | 「ぜひ〜してみてください」「きっと〜はず」のように、結びで読み手を励ます文が重なった所 |

まだ見本の無いルール: `ai-generated-composite`, `ai-structure`, `ai-tell`, `announcing-opener`, `assistant-residue`, `bold-emphasis`, `bold-label-list`, `cold-open`, `colon-lead-in`, `contrast-framing`, `emoji-heading`, `figurative-density`, `honesty-marker`, `no-em-dash`, `paragraph-length-variance`, `rule-of-three`, `section-length-uniformity`, `sentence-rhythm`, `stock-transition`, `translationese-density`, `unprompted-denial`

## チームの表記

chaff.yaml にチームが書いた表記・社内用語・必須の見出しだけを見るルール。書かなければ何も言いません。

このグループの見本はまだありません。

まだ見本の無いルール: `internal-jargon`, `preferred-term`, `required-sections`, `requirement-modal`

意味を読む検査は `npx chaffjs test` で AI に尋ねて動くので、決まった出力を見せるこの見本には入れていません: `empty-conclusion`, `generic-opening`, `risk-disclosure`, `unsourced-number`
