<!-- yarn samples:update がルールの定義と見本から作ります。手で書き換えないでください。 -->

# chaff で直せる文章の見本

chaff が見つけるまちがいを、ルールごとに一つずつ見本にしました。
どの見本も、よくある文章、chaff の指摘、直した文章、直し方、設定の順に並んでいます。
指摘はどれも、その文章に chaff を実際にかけた出力です。

自分の文章で試すには、Node.js 24 以上で `npx chaffjs 文書.md` と打ちます。入れるものも、設定も要りません。
ブラウザで試すなら[プレイグラウンド](https://isamu.github.io/lab/ja/playground/)へ。

English samples: [../en/README.md](../en/README.md)

見本のあるルール: 44 / 272

## 読みやすさ

長すぎる文、詰めすぎた段落、読み手がつまずく書き方。

| ルール | 見つけるもの |
| --- | --- |
| [漢字が続きすぎている](max-kanji-continuous.md)（`max-kanji-continuous`） | 「新規顧客獲得施策検討会議」のように、漢字だけが長く続く所 |

まだ見本の無いルール: `adversative-ga-repeat`, `bold-density`, `bracket-nesting`, `clause-chain`, `demonstrative-opener-run`, `double-negative`, `emoji-density`, `heading-echo`, `hiragana-fukushi`, `max-paragraph-length`, `max-sentence-length`, `max-ten`, `ngram-repetition`, `no-doubled-joshi`, `no-nakaguro-parallel`, `one-sentence-paragraph-run`, `paragraph-restatement`, `proper-noun-density`, `repeated-conjunction`, `repeated-sentence-ending`, `repeated-sentence-head`, `sentence-initial-conjunction-run`, `taigen-dome-in-prose`, `title-length`, `topic-predicate-distance`, `undefined-acronym`

## 言葉づかい

中身を言わずに強める言い方、決まり文句、誰がしたのかを書かない受け身。

| ルール | 見つけるもの |
| --- | --- |
| [打ち消しを伴わない「全然」「決して」](adverb-without-negation.md)（`adverb-without-negation`） | 「全然大丈夫です」のように、打ち消しと組む副詞を打ち消し無しで使った所 |
| [誰がしたのか書かれていない](agentless-passive.md)（`agentless-passive`） | 「〜が決定されました」のように、受け身で書いて、誰がしたのかが書かれていない所 |
| [バイト敬語](baito-keigo.md)（`baito-keigo`） | 「〜でよろしかったでしょうか」「こちらになります」のように、接客の場で広まった誤りとされる敬語 |
| [使い古された決まり文句](cliche.md)（`cliche`） | 「今さら聞けない」「徹底解説」や「at the end of the day」のような、使い古された決まり文句 |
| [定型の結び](closing-cliche.md)（`closing-cliche`） | 「いかがでしたか」「参考になれば幸いです」のように、何も残さない決まり文句の結び |
| [文頭の話し言葉の接続詞](colloquial-opener.md)（`colloquial-opener`） | 「なので、」「でも、」のような話し言葉の接続詞で始まる文 |
| [比べる相手の無い比較](comparative-without-baseline.md)（`comparative-without-baseline`） | 「より良い」「さらに高速」のように、比べる相手が書かれていない比較 |
| [内の段の無い「並びに」「若しくは」](connective-hierarchy.md)（`connective-hierarchy`） | 「及び」の無い文の「並びに」、「又は」の無い文の「若しくは」 |
| [クッション言葉が多い](cushion-phrase-density.md)（`cushion-phrase-density`） | 「恐れ入りますが」「念のため」のようなクッション言葉が多く、用件が埋もれている所 |
| [二重敬語](double-keigo.md)（`double-keigo`） | 「おっしゃられる」のように、同じ種類の敬語を二重にかけた所 |
| [空虚な強調](empty-intensifier.md)（`empty-intensifier`） | 「非常に重要」「言うまでもなく」のように、何が大事かを言わずに強めるだけの言い方 |
| [逃げの表現が多い](excessive-hedging.md)（`excessive-hedging`） | 「〜の可能性があるかもしれません」のように、逃げの表現を重ねて、何が言いたいのか分からない所 |
| [謙譲語を相手の動作に使っている](humble-for-others.md)（`humble-for-others`） | 「伺ってください」「拝見してください」「申される」のように、謙譲語を読み手や第三者の動作に使った所 |
| [慣用句の誤用](idiom-misuse.md)（`idiom-misuse`） | 「的を得る」「汚名挽回」のように、取り違えたと決まっている慣用句 |
| [公用文でかなで書く補助動詞・形式名詞](kana-function-word.md)（`kana-function-word`） | 公用文でかなで書く語（〜て下さい、〜する事）を漢字で書いた所（style が koyobun のとき） |
| [カタカナ語が多い](katakana-density.md)（`katakana-density`） | 「アジェンダ」「エビデンス」のようなカタカナ語が、人の書いた技術記事より多い文書 |
| [「等」で開いた一覧を限っている](nado-closed-list.md)（`nado-closed-list`） | 「自転車等に限ります」のように、「等」「など」で開いた一覧を「限り」「のみ」で閉じている所 |
| [動詞を名詞にして回りくどく書いている](nominalization.md)（`nominalization`） | 「調査を実施した」「確認を行う」のように、動詞を名詞にして別の動詞に運ばせた言い方が、文書の長さに対して多い所 |
| [標準的でない語](nonstandard-word.md)（`nonstandard-word`） | 「違かった」「すいません」「irregardless」のように、書き言葉では標準的でない語 |
| [時を決めてする義務に、期限が無い](obligation-without-deadline.md)（`obligation-without-deadline`） | ほかの義務に期限を書いた契約で、支払う・引き渡す・返還する・通知する義務に期限を書いていない所 |

まだ見本の無いルール: `ordinal-suffix-mismatch`, `padded-intro`, `ra-nuki`, `redundant-expression`, `request-without-deadline`, `requirement-smell`, `sasete-itadaku`, `tari-unpaired`, `teki-overuse`, `toki-as-condition`, `uncomparable-graded`, `unqualified-superlative`, `vague-deadline`, `vague-word-density`, `very-adjective`, `warning-without-action`, `weasel-word`, `wordy-phrase`, `yori-as-from`

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
| [生成文の特徴がそろっている](ai-generated-composite.md)（`ai-generated-composite`） | 生成された文章の特徴がいくつも一つの文書にそろっている所（生成だと決めつけはしません） |
| [構成が人の記事から外れている](ai-structure.md)（`ai-structure`） | 見出しの多さや節の揃い方など、構成の項目がいくつも人の記事から外れている文書 |
| [生成文にありがちな言い回し](ai-tell.md)（`ai-tell`） | 「大きな可能性を秘める」「と言えるでしょう」のような、生成された文章にありがちな言い回しが重なった所 |
| [予告で始まる文が多い](announcing-opener.md)（`announcing-opener`） | 「重要なのは、」「ポイントは、」「正直に言うと、」のように、中身の前に予告する文頭が重なっている所 |
| [会話の返事の名残](assistant-residue.md)（`assistant-residue`） | 「私の知識は」「お役に立てれば幸いです」のような、チャットの返事を貼ったときに残る言葉 |
| [太字の強調が文書じゅうに散っている](bold-emphasis.md)（`bold-emphasis`） | 文の途中の太字が文書じゅうに散り、どこが大事なのか分からなくなった所 |
| [太字の札で始まる箇条書きが多い](bold-label-list.md)（`bold-label-list`） | 太字の札（**速さ**：）や太字の一文で始まる項目が続く箇条書き |
| [結びで励ます・請け合う文が重なる](closing-exhortation.md)（`closing-exhortation`） | 「ぜひ〜してみてください」「きっと〜はず」のように、結びで読み手を励ます文が重なった所 |
| [状況も例もなく始まる書き出し](cold-open.md)（`cold-open`） | 短い願い・語の引き直し・難所の予告が重なる書き出し |
| [コロンで箇条書きへ渡す文が多い](colon-lead-in.md)（`colon-lead-in`） | 「以下の通りです：」のように、コロンで終わる文から箇条書きへ渡す形が続き、説明が箇条書きの前置きだけになっている所 |
| [対比の枠が多い](contrast-framing.md)（`contrast-framing`） | 「単なる X ではなく Y」のような対比が重なり、誰も言っていない X を打ち消し続ける所 |
| [絵文字の付いた見出しが続く](emoji-heading.md)（`emoji-heading`） | 「## 🚀 はじめに」のように、見出しごとに絵文字が付いている所 |
| [飾りのたとえが多い](figurative-density.md)（`figurative-density`） | 「まるで魔法のように」「呪文のような」「おまじない」のような、仕組みの代わりのたとえが多い所 |
| [「正直」と前置きする](honesty-marker.md)（`honesty-marker`） | 「正直、」「正直に言うと」のように、本音だと前置きする言い回し |
| [ダッシュが多い](no-em-dash.md)（`no-em-dash`） | ダッシュ（——）が多すぎる所。英語では、生成された文章のよく知られた印の一つでもあります |
| [段落の長さが揃いすぎている](paragraph-length-variance.md)（`paragraph-length-variance`） | どの段落もほぼ同じ長さで、型に流しこんだように見える所 |
| [3 項目の箇条書きばかり](rule-of-three.md)（`rule-of-three`） | 箇条書きがどれも三つの項目で、数を合わせて並べたように見える所 |
| [節の長さが揃いすぎている](section-length-uniformity.md)（`section-length-uniformity`） | どの節もほぼ同じ長さに埋めてあり、ひな形を埋めたように見える所 |
| [文の長さが単調](sentence-rhythm.md)（`sentence-rhythm`） | どの文もほぼ同じ長さで、読むリズムが単調な所 |
| [決まった接ぎで始まる文が多い](stock-transition.md)（`stock-transition`） | 「さらに」「加えて」「このように」で始まる文が多く、何がどう繋がるのかを言わずに並べている所 |
| [翻訳調が多い](translationese-density.md)（`translationese-density`） | 「〜を可能にする」「重要な役割を果たす」「あなたは」のような、英語の構文を写した言い回しが多い所 |
| [誰も言っていない前提の打ち消しが多い](unprompted-denial.md)（`unprompted-denial`） | 「〜の話ではありません」のように、誰も言っていない前提を打ち消して終わる文 |

## チームの表記

chaff.yaml にチームが書いた表記・社内用語・必須の見出しだけを見るルール。書かなければ何も言いません。

このグループの見本はまだありません。

まだ見本の無いルール: `internal-jargon`, `preferred-term`, `required-sections`, `requirement-modal`

意味を読む検査は `npx chaffjs test` で AI に尋ねて動くので、決まった出力を見せるこの見本には入れていません: `empty-conclusion`, `generic-opening`, `risk-disclosure`, `unsourced-number`
