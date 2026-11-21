<!-- yarn samples:update がルールの定義と見本から作ります。手で書き換えないでください。 -->

# chaff で直せる文章の見本

chaff が見つけるまちがいを、ルールごとに一つずつ見本にしました。
どの見本も、よくある文章、chaff の指摘、直した文章、直し方、設定の順に並んでいます。
指摘はどれも、その文章に chaff を実際にかけた出力です。

自分の文章で試すには、Node.js 24 以上で `npx chaffjs 文書.md` と打ちます。入れるものも、設定も要りません。
ブラウザで試すなら[プレイグラウンド](https://isamu.github.io/lab/ja/playground/)へ。

English samples: [../en/README.md](../en/README.md)

見本のあるルール: 85 / 272

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
| [数に合わない序数の字](ordinal-suffix-mismatch.md)（`ordinal-suffix-mismatch`） | 「3th」「22th」「11st」のように、英語の序数の字が数と合わない所 |
| [水増しの導入](padded-intro.md)（`padded-intro`） | 「近年、〜が注目されています」のように、どの文書にも当てはまる書き出し |
| [ら抜き言葉](ra-nuki.md)（`ra-nuki`） | 「見れる」「食べれる」「来れる」のような、ら抜き言葉 |
| [重言](redundant-expression.md)（`redundant-expression`） | 「頭痛が痛い」「一番最初」「後で後悔」のような、同じ意味の語の重なり |
| [期限も担当も無い依頼](request-without-deadline.md)（`request-without-deadline`） | 「ご確認ください」「Please send …」のような依頼で、その文にも次の文にも期限と担当が無いもの |
| [要求の文に、決めきれない言い方がある](requirement-smell.md)（`requirement-smell`） | 仕様書や契約書の要求の文にある「可能な限り」「必要に応じて」「等」「及び／又は」 |
| [「させていただく」が多い](sasete-itadaku.md)（`sasete-itadaku`） | 「させていただく」を繰り返して、誰が決めて何が起きるのかがぼやけた所 |
| [対にならない「〜たり」](tari-unpaired.md)（`tari-unpaired`） | 「本を読んだり、映画を見ます」のように、「〜たり」が一つで止まって対になっていない所 |
| [「〜的」の多用](teki-overuse.md)（`teki-overuse`） | 一文に「効果的」「具体的」「積極的」のような「〜的」がいくつも重なった所 |
| [条件を言う「時」](toki-as-condition.md)（`toki-as-condition`） | 「認定を受けた時は」のように、条件を「とき」でなく「時」で書いた所 |
| [比べられない形容詞に付けた程度](uncomparable-graded.md)（`uncomparable-graded`） | 「より最適な」「とても完璧」のように、程度の無い語に付けた程度 |
| [比べる相手のない最上級](unqualified-superlative.md)（`unqualified-superlative`） | 「最速」「最高の品質」のように、何と比べたのかを書いていない最上級 |
| [期限を「速やかに」のような語で残している](vague-deadline.md)（`vague-deadline`） | ほかの期限を日数で書いた契約で、一部の期限だけを「速やかに」「遅滞なく」と書いた所 |
| [あいまいな語が多い](vague-word-density.md)（`vague-word-density`） | 「適宜」「必要に応じて」のように、どこまでを読み手に決めさせる語が多い所 |
| [「とても + 形容詞」（very + 形容詞）の多用](very-adjective.md)（`very-adjective`） | 「とても便利」「非常に危険」（very important）のような強め + 形容詞が、文書の長さのわりに多い所 |
| [することの書かれていない注意書き](warning-without-action.md)（`warning-without-action`） | 「注意」「警告」で始まる段落で、危険だけを書き、読み手のすること（〜してください、〜しないこと）が無いもの |
| [出所を言わない「多くの専門家」](weasel-word.md)（`weasel-word`） | 「〜と言われています」「ある研究によると」のように、主張を名前の無い誰かに預ける言い方 |
| [回りくどい言い回し](wordy-phrase.md)（`wordy-phrase`） | 「することが可能」「現時点において」のように、一語で言えることに何語もかける所 |
| [起点を言う「より」](yori-as-from.md)（`yori-as-from`） | 「4月1日より開始」のように、起点を「から」でなく「より」で書いた所 |

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

| ルール | 見つけるもの |
| --- | --- |
| [予告した数と箇条書きの数が合わない](announced-count-mismatch.md)（`announced-count-mismatch`） | 「以下の3点」と書いたのに、下の箇条書きの数が違う所 |
| [着が発より前](arrival-before-departure.md)（`arrival-before-departure`） | 旅程の便や列車で、着の時刻が発の時刻より前の所 |
| [添付に触れているのに、添付が見当たらない](attachment-not-attached.md)（`attachment-not-attached`） | 本文が「添付します」と書いているのに、添付の欄もファイル名も無い送ったメール |
| [移動の時間より短い乗り継ぎ](connection-time-short.md)（`connection-time-short`） | 旅程で、次の予定までの間が文書に書いた移動の時間より短い所 |
| [連絡先の書き違い](contact-variant.md)（`contact-variant`） | 同じメールアドレスや住所が、一か所だけ違って書かれている所（hibari-lab と hibarilab） |
| [日程の順番が前後している](date-order.md)（`date-order`） | 旅程や予定表、変更履歴の見出しで、一つだけ日付の順番が前後している所 |
| [期間の終わりが始まりより前](date-range-reversed.md)（`date-range-reversed`） | 「4月1日〜3月31日」のように、期間の終わりが始まりより前の所 |
| [日付と曜日の食い違い](date-weekday-mismatch.md)（`date-weekday-mismatch`） | 「2026年10月1日（金）」のように、日付と曜日が暦と合っていない所 |
| [申込締切が催しの日より後](deadline-after-event.md)（`deadline-after-event`） | 案内状やお知らせで、申込や出欠の返信の締め切りが催しの日より後の所 |
| [割引率が定価と単価から出る率と合わない](discount-rate-mismatch.md)（`discount-rate-mismatch`） | 価格表で、割引率が定価と単価から出る率と合わない所 |
| [期限が発行日より前](due-before-issue.md)（`due-before-issue`） | 支払期限や締切など、後に来るはずの日付が先の日付より前の所 |
| [始まりと期間から計算した終わりが、書いた終わりと合わない](duration-mismatch.md)（`duration-mismatch`） | 「4月1日から3か月間（7月31日まで）」のように、始まりに期間を足しても書いた終わりにならない所 |
| [暦に無い日付](impossible-date.md)（`impossible-date`） | 「2月30日」「2023年2月29日」のような暦に無い日付と、和暦と西暦の年が食い違う日付 |
| [時計に無い時刻](impossible-time.md)（`impossible-time`） | 「午後13時」「13 PM」「10時75分」のように、時計に無い時刻 |
| [数量×単価が金額と合わない](line-amount-mismatch.md)（`line-amount-mismatch`） | 見積書や請求書の明細で、数量×単価がその行の金額と合わない所 |
| [文字で書いた数と括弧の数字が違う](number-word-figure-mismatch.md)（`number-word-figure-mismatch`） | 「三（4）か月」「金参拾万円（30,000円）」のように、文字で書いた数と後ろの括弧の数字が違う所 |
| [内訳の割合を足しても 100% にならない](percent-sum-mismatch.md)（`percent-sum-mismatch`） | 構成比や内訳の百分率を足しても 100% にならない所 |
| [電話番号の数字の入れ違い](phone-number-variant.md)（`phone-number-variant`） | 同じ文書で、電話番号の隣り合う数字が一か所だけ入れ違っている所（0120-123-456 と 0120-123-465） |
| [「3日後の10月5日」の日付が、基準の日付から数えた日と合わない](relative-date-mismatch.md)（`relative-date-mismatch`） | 「3日後の10月6日」のように、相対で書いた日付が基準の日付から数えた日と合わない所 |
| [税額が小計に税率を掛けた額と合わない](tax-mismatch.md)（`tax-mismatch`） | 請求書の消費税や価格表の税込価格が、税率で計算した額と合わない所 |
| [時刻の範囲の終わりが始まりより前](time-range-reversed.md)（`time-range-reversed`） | 「15:15〜14:15」のように、時刻の範囲の終わりが始まりより前の所 |
| [合計が内訳の和と合わない](total-mismatch.md)（`total-mismatch`） | 見積もりや請求書、契約書で、合計が内訳に並べた金額の和と合わない所 |

まだ見本の無いルール: `amount-range-reversed`, `annual-holidays-mismatch`, `annual-pay-mismatch`, `backorder-mismatch`, `bmi-mismatch`, `capacity-runtime-mismatch`, `change-rate-mismatch`, `citation-reference-mismatch`, `closing-balance-mismatch`, `count-over-capacity`, `cross-doc-fact-conflict`, `cumulative-below-current`, `currency-column-mix`, `dangling-figure-reference`, `date-outside-period`, `date-stamp-order`, `deductible-exceeds-limit`, `default-value-mismatch`, `delivered-over-ordered`, `deprecated-option-used`, `duration-product-mismatch`, `elapsed-years-mismatch`, `fact-conflict`, `formula-amount-mismatch`, `gpa-mismatch`, `heading-command-missing`, `installment-total-mismatch`, `interest-mismatch`, `interval-count-mismatch`, `layout-code-mismatch`, `meter-usage-mismatch`, `net-amount-mismatch`, `net-over-gross`, `parameter-table-mismatch`, `period-label-conflict`, `period-multiple-mismatch`, `period-part-exceeds-whole`, `product-exceeds-maximum`, `quantity-range-reversed`, `quote-unnamed-speaker`, `quote-without-source`, `range-band-mismatch`, `ratio-mismatch`, `reference-flag-mismatch`, `reference-number-repeated`, `reference-number-variant`, `reference-title-mismatch`, `reference-topic-missing`, `reference-unit-mismatch`, `rent-multiple-mismatch`, `return-type-mismatch`, `revision-direction-mismatch`, `running-balance-mismatch`, `scaled-quantity-mismatch`, `serial-range-reversed`, `share-amount-mismatch`, `share-over-hundred`, `step-time-sum-mismatch`, `summary-fact-mismatch`, `table-unit-mix`, `tier-threshold-mismatch`, `time-order`, `undefined-function-call`, `unit-mismatch`, `variance-mismatch`, `version-mismatch`, `version-order`, `walk-time-distance-mismatch`

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
