<!-- yarn samples:update がルールの定義と見本から作ります。手で書き換えないでください。 -->

# chaff で直せる文章の見本

chaff が見つけるまちがいを、ルールごとに一つずつ見本にしました。
どの見本も、よくある文章、chaff の指摘、直した文章、直し方、設定の順に並んでいます。
指摘はどれも、その文章に chaff を実際にかけた出力です。

自分の文章で試すには、Node.js 24 以上で `npx chaffjs 文書.md` と打ちます。入れるものも、設定も要りません。
ブラウザで試すなら[プレイグラウンド](https://isamu.github.io/lab/ja/playground/)へ。

English samples: [../en/README.md](../en/README.md)

見本のあるルール: 229 / 272

## 読みやすさ

長すぎる文、詰めすぎた段落、読み手がつまずく書き方。

| ルール | 見つけるもの |
| --- | --- |
| [一文に逆接の「が」が二度](adversative-ga-repeat.md)（`adversative-ga-repeat`） | 「〜だが、〜するが、」のように、一文の中で逆接の「が」を二度使った所 |
| [太字の使いすぎ](bold-density.md)（`bold-density`） | 太字が多すぎて、どこが大事なのか分からなくなった所 |
| [括弧の中に括弧が重なっている](bracket-nesting.md)（`bracket-nesting`） | 「（注（a（b）））」のように、括弧の中に括弧が何重にも重なった文 |
| [一文に節がつながりすぎている](clause-chain.md)（`clause-chain`） | 「〜て、〜し、〜が、〜ので、」のように、一文の中で節を次々につないでいる所 |
| [指示語で始まる文の連続](demonstrative-opener-run.md)（`demonstrative-opener-run`） | 「これは」「その」「この」のような指示語で始まる文が、同じ段落の中で続く所 |
| [二重否定](double-negative.md)（`double-negative`） | 「〜ないわけではない」「〜しないことはない」のように、打ち消しを打ち消した言い方 |
| [絵文字が多い](emoji-density.md)（`emoji-density`） | 絵文字が多すぎて、飾りのほうが目立つ所 |
| [見出しの繰り返し](heading-echo.md)（`heading-echo`） | 見出しのすぐ後の文が、見出しをほぼそのまま繰り返している所 |
| [副詞は ひらがなで](hiragana-fukushi.md)（`hiragana-fukushi`） | 「殆ど」「勿論」のように、ひらがなのほうが読みやすい副詞を漢字で書いた所 |
| [漢字が続きすぎている](max-kanji-continuous.md)（`max-kanji-continuous`） | 「新規顧客獲得施策検討会議」のように、漢字だけが長く続く所 |
| [段落が長すぎる](max-paragraph-length.md)（`max-paragraph-length`） | 文を詰めこみすぎて、息をつく場所がない段落 |
| [一文が長すぎる](max-sentence-length.md)（`max-sentence-length`） | 読み終える前に主語を見失うほど長い一文 |
| [一文の読点が多すぎる](max-ten.md)（`max-ten`） | 一文の中に読点（、）がいくつも入り、細かく切れている所 |
| [同じ言い回しの繰り返し](ngram-repetition.md)（`ngram-repetition`） | 同じ言い回しが何度も出てきて、新しいことを言っていないように読める所 |
| [同じ助詞が入れ子で続いている](no-doubled-joshi.md)（`no-doubled-joshi`） | 「会社の部の課の方針」のように、同じ助詞が区切りなしに続く所 |
| [中黒で並べすぎている](no-nakaguro-parallel.md)（`no-nakaguro-parallel`） | 一つの文に「・」で並べた語が多すぎて、どれとどれが組なのか分からない所 |
| [一文だけの段落が続いている](one-sentence-paragraph-run.md)（`one-sentence-paragraph-run`） | 一文ごとに段落を分けた所が続き、どの文が同じ話なのかが見えない所 |
| [前の段落を言い直すだけの段落](paragraph-restatement.md)（`paragraph-restatement`） | 「つまり」「このように」で始まり、前の段落の語をほとんど繰り返すだけの段落 |
| [固有名詞が多い](proper-noun-density.md)（`proper-noun-density`） | 製品名・会社名・人名が詰まりすぎて、知らない人には文の形が見えない所 |
| [段落が同じ調子で始まり続ける](repeated-conjunction.md)（`repeated-conjunction`） | 「また、」「さらに、」のように、接続詞で始まる段落が続く所 |
| [同じ文末が続く](repeated-sentence-ending.md)（`repeated-sentence-ending`） | 「〜です。〜です。〜です。」のように、同じ形で終わる文が続く所 |
| [同じ書き出しの連続](repeated-sentence-head.md)（`repeated-sentence-head`） | 同じ言葉で始まる文が続き、文の切れ目がぼやける所 |
| [接続詞で始まる文が続いている](sentence-initial-conjunction-run.md)（`sentence-initial-conjunction-run`） | 「そして」「しかし」（And、But）で始まる文が続く所 |
| [体言止めが続いている](taigen-dome-in-prose.md)（`taigen-dome-in-prose`） | 名詞で終わる文（体言止め）が本文に続き、言いかけのように読める所 |
| [題や見出しが長すぎる](title-length.md)（`title-length`） | 一目で読めないほど長い題や見出し |
| [主題と述語が離れている](topic-predicate-distance.md)（`topic-predicate-distance`） | 「会議は」のように主題を出してから、文の終わりの述語まで長く待たせる文 |
| [略語が説明なしで出てくる](undefined-acronym.md)（`undefined-acronym`） | 「KGI」「PMF」のように、説明なしで出てくる略語 |

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

| ルール | 見つけるもの |
| --- | --- |
| [チャットの出典の名残](chat-citation-residue.md)（`chat-citation-residue`） | 「?utm_source=chatgpt.com」の付いたリンクのように、チャットの答えを貼ったときに残る印 |
| [「など」と「等」の重ね](doubled-nado.md)（`doubled-nado`） | 「書類等など」「and etc.」のように、「ほかにもある」を言う語を重ねた所 |
| [句読点が重なっている](doubled-punctuation.md)（`doubled-punctuation`） | 「。。」「、。」のように、句読点が二つ並んだ所 |
| [語を二度書いている](doubled-word.md)（`doubled-word`） | 「資料をを」「the the」のように、同じ語が続けて二度書かれている所 |
| [半角の片仮名がある](hankaku-kana.md)（`hankaku-kana`） | 「ｱｲｳ」のような半角の片仮名と、半角の句読点・鉤括弧・中黒 |
| [変換し損ねた英字](ime-residue.md)（`ime-residue`） | 「おもしrおい」「対応sた」のような、日本語の語の中に一字だけ残った英字 |
| [見えない字がある](invisible-character.md)（`invisible-character`） | ゼロ幅の空白、途中の BOM、ソフトハイフン、文字の向きの指定、制御文字、隠れたタグ文字のような、画面に出ない字 |
| [長い漢字の語の一字違い](kanji-compound-slip.md)（`kanji-compound-slip`） | 何度も書いた長い漢字の語を、一か所だけ一字違えて書いた所 |
| [よくある書き誤り](known-misspelling.md)（`known-misspelling`） | 「シュミレーション」「コミニュケーション」「ふいんき」のような、よくある書き誤り |
| [リンクの言葉の URL と行き先が違う](link-text-url-mismatch.md)（`link-text-url-mismatch`） | 見えている URL と、実際の行き先のサイトが違うリンク |
| [見た目が同じで別の字](lookalike-character.md)（`lookalike-character`） | 部首の字（⼈）、互換漢字、分かれた濁点（か＋゛）、長音に見えるダッシュ（ニュ－ス）など、同じに見える別の字 |
| [変換の誤り](misconversion.md)（`misconversion`） | 「以外と簡単」「始めて会う」「不可決」のような、仮名漢字変換の取り違え |
| [語句の途中に空白がある](stray-space.md)（`stray-space`） | 「確認 しました」のように、ひとつながりの語句の途中に空白が紛れこんだ所 |
| [括弧が組になっていない](unbalanced-bracket.md)（`unbalanced-bracket`） | 閉じ忘れた「（」や開きの無い「」」のように、組になっていない括弧と引用符 |
| [埋め忘れた空欄](unfilled-placeholder.md)（`unfilled-placeholder`） | 「【会社名】」「TODO」のように、雛形の空欄が埋まらないまま残っている所 |
| [URL のすぐ後ろに字が続いている](url-run-on.md)（`url-run-on`） | 「https://example.jp/をご覧ください」のように、URL のすぐ後ろに字が続き、リンクがそこまで伸びる所 |

## 表記の揃え

どちらで書いても正しいものが、一つの文書の中で混ざっている所。chaff はどちらが正しいかを決めず、少ないほうを指します。

| ルール | 見つけるもの |
| --- | --- |
| [同じ略語の二通りの展開](acronym-expansion-conflict.md)（`acronym-expansion-conflict`） | 同じ略語を、文書の中で違う名前に展開している所 |
| [同じ桁の金額を二通りに書いている](amount-scale-consistency.md)（`amount-scale-consistency`） | 「30万円」と「250,000円」のように、同じ桁の金額を「万」と数字だけの二通りで書いている所 |
| [言葉のリンクの中に URL がそのまま混ざっている](bare-url-mix.md)（`bare-url-mix`） | 言葉でリンクを書く文書の中に、「https://…」がそのまま書かれている所 |
| [括弧の全角と半角の混在](bracket-width-consistency.md)（`bracket-width-consistency`） | 日本語の文の中で、括弧の全角（（）［］）と半角（()[]）が混ざっている所 |
| [引用の書き方が揃っていない](citation-style-mix.md)（`citation-style-mix`） | 一つの論文の中で、[1] の引用と（山田, 2020）の引用のように、引用の書き方が混ざっている所 |
| [言語名の無いコードブロックが混ざっている](code-fence-language-mix.md)（`code-fence-language-mix`） | ほとんどのコードブロックに言語名があるのに、一部だけ無い所 |
| [ファイルによって書き方が違う語](cross-doc-term-variant.md)（`cross-doc-term-variant`） | 同じ語を、ファイルによって違う書き方で書いている所（サーバ／サーバー、e-mail／email） |
| [通貨の書き方が混ざっている](currency-notation-consistency.md)（`currency-notation-consistency`） | 「1,000円」と「¥1,000」のように、一つの文書で同じ通貨の金額を二通りに書いた所 |
| [日付の書き方が揃っていない](date-format-consistency.md)（`date-format-consistency`） | 「2026-10-02」と「2026年10月2日」のように、一つの文書で日付を二通りに書いている所 |
| [短い呼び名を定めた名前を、あとで正式の名前のまま書いている](defined-name-repeated.md)（`defined-name-repeated`） | 「株式会社みなと製作所（以下「甲」という。）」のあとで、甲を正式の名前のまま書いている所 |
| [定義した語を、定義と違う形で使っている](defined-term-form.md)（`defined-term-form`） | 契約や規程で、定義した語を、定義のあとで違う形（括弧付き、言い換え、長くした形）で書いた所 |
| [省略記号の書き方が混ざっている](ellipsis-consistency.md)（`ellipsis-consistency`） | 「……」と「・・・」、「…」と「...」のように、一つの文書で省略の記号を二通りに書いている所 |
| [！？ の全角と半角の混在](exclamation-width-consistency.md)（`exclamation-width-consistency`） | 日本語の文の中で、！？ の全角と半角（!?）が混ざっている所 |
| [英数字の全角と半角が混ざっている](fullwidth-alnum-consistency.md)（`fullwidth-alnum-consistency`） | 英字や数字を、全角（ＡＢＣ１２３）と半角（ABC123）で混ぜて書いている所 |
| [見出しの終わりの記号が揃っていない](heading-end-punctuation-mix.md)（`heading-end-punctuation-mix`） | 記号なしの見出しの中に「準備：」「確認。」のように記号で終わる見出しが混ざっている所（またはその逆） |
| [カタカナ語の語末の「ー」がそろっていない](katakana-long-vowel.md)（`katakana-long-vowel`） | カタカナ語の語末の「ー」を、同じ語で付けたり省いたりしている所（コンピューター、コンピュータ） |
| [句読点の書き方がそろっていない](kutoten-consistency.md)（`kutoten-consistency`） | 読点の「、」と「，」、句点の「。」と「．」が、一つの文書の中で混ざっている所 |
| [英数字の前後の空白がそろっていない](latin-spacing.md)（`latin-spacing`） | 日本語と英数字のあいだの空白が、文書の中で付いたり付かなかったりしている所 |
| [箇条書きの項目の形がそろっていない](list-item-form-mix.md)（`list-item-form-mix`） | 一つの箇条書きの中で、名詞で終わる項目と文で終わる項目（英語では動詞で始まる項目と名詞で始まる項目）が混ざっている所 |
| [箇条書きの記号が揃っていない](list-marker-mix.md)（`list-marker-mix`） | 一つのリストや一つの文書の中で、「-」「*」「+」「・」の箇条書きの記号が混ざっている所 |
| [「。」で終わらない段落](missing-final-period.md)（`missing-final-period`） | 「。」で終わる段落の多い文書で、「。」無しで終わった段落 |
| [同じ名前の書き分け](name-variant.md)（`name-variant`） | 同じ人・会社・製品の名前を、少しだけ違う形で書いている所（山田太郎 と 山田太朗、GitHub と Github） |
| [文末の調子が混ざっている](no-mixed-desumasu.md)（`no-mixed-desumasu`） | 「です・ます」の中に「だ・である」が混ざった文 |
| [数の書き方が混ざっている](number-style-consistency.md)（`number-style-consistency`） | 3件と三件、1,000 と 1000、10% と 10％ のように、一つの文書で数の書き方が混ざっている所 |
| [同じ語の書き方がゆれている](orthographic-variant.md)（`orthographic-variant`） | 「出来る」と「できる」のように、同じ語を一つの文書の中で二通りに書いている所 |
| [挙げた一覧に無い名前](outside-announced-list.md)（`outside-announced-list`） | 「対応 OS は Windows と macOS」と挙げたあとで、一覧に無い「Linux」に対応すると書いている所 |
| [当事者の呼び名を、ほかの所と逆の順に並べている](party-order.md)（`party-order`） | 「甲及び乙」と書く契約の中の「乙及び甲」 |
| [当事者を、定めた呼び名でなく立場の語で書いている](party-role-name.md)（`party-role-name`） | 当事者を「甲」「乙」と定めたあとで、「委託者」「受託者」のような立場の語で書いている所 |
| [自分や読み手の呼び方が揃っていない](person-consistency.md)（`person-consistency`） | 「私たち」と「弊社」、「私」と「筆者」のように、一つの文書が自分や読み手を二通りに呼んでいる所 |
| [範囲の記号が混ざっている](range-notation-consistency.md)（`range-notation-consistency`） | 「10〜20」と「10-20」のように、一つの文書で数の範囲を二通りの記号で書いている所 |
| [シェルのコマンドにプロンプトを付けたり付けなかったりしている](shell-prompt-mix.md)（`shell-prompt-mix`） | シェルのブロックで、「$」のプロンプトを付けたコマンドと付けないコマンドが混ざっている所 |
| [表の見出しの書き方が表ごとに違う](table-header-variant.md)（`table-header-variant`） | 同じ欄の見出しを、表によって「担当者」と「担当」のように書き分けている所 |
| [二通りに書いた画面の札](ui-label-variant.md)（`ui-label-variant`） | 太字や［］の画面の札で、大文字・小文字や空白、「を」「の」だけが違う二通りの書き方 |
| [定義した語の形で書いたのに、どこにも定義が無い](undefined-term.md)（`undefined-term`） | 「本業務」のように定義した語と同じ形なのに、定義しないまま使っている語（本成果物） |
| [数と単位の間の空白が混ざっている](unit-spacing-consistency.md)（`unit-spacing-consistency`） | 「5 GB」と「5GB」のように、一つの文書で数と単位記号の間を空けたり詰めたりしている所 |

## 構造

番号の抜け、無い条への参照、同じ語の二重定義、長い前置き。

| ルール | 見つけるもの |
| --- | --- |
| [言い切った決まりに、別の所で例外がある](absolute-exception.md)（`absolute-exception`） | 「すべての〜は…しなければならない」と言い切った決まりに、別の条や段落で「ただし…を除く」と例外を書いた所 |
| [要旨が長すぎる、または無い](abstract-length.md)（`abstract-length`） | 字数（英語は語数）の上限を超える要旨と、節を立てた論文で要旨が無いもの |
| [行き先の無いリンク](broken-link.md)（`broken-link`） | 行き先が空のリンク、文書に無い見出しを指すリンク、定義の無い参照の形のリンク |
| [具体物のない節がある](concrete-evidence-density.md)（`concrete-evidence-density`） | 数字もコードもリンクも無く、読み手が持ち帰れるものの無い節 |
| [ほかのファイルへの行き先の無いリンク](cross-doc-broken-link.md)（`cross-doc-broken-link`） | 一緒に見たほかのファイルへのリンクで、行き先のファイルか見出しが無いもの |
| [ファイルによって違う定義](cross-doc-duplicate-definition.md)（`cross-doc-duplicate-definition`） | 同じ語を、ファイルによって違う言葉で定義している所 |
| [参照先が無い](dangling-reference.md)（`dangling-reference`） | 「第5条に定める」と書いてあるのに、その第5条が文書に無い所 |
| [年の無い日付](date-without-year.md)（`date-without-year`） | 文書の日付が二つ以上の年にわたるときや年の変わり目をまたぐときの、年の無い日付 |
| [同じ語の二重定義](duplicate-definition.md)（`duplicate-definition`） | 同じ語を、文書の二か所で定義している所 |
| [同じ見出しが兄弟に二つある](duplicate-heading.md)（`duplicate-heading`） | 同じ親の見出しの下に、同じ言葉の見出しが二つある所 |
| [メールの挨拶か結びが無い](email-greeting-closing.md)（`email-greeting-closing`） | 仕事のメールで、書き出しの挨拶か終わりの結びが無いもの |
| [件名が空か長すぎる](email-subject-length.md)（`email-subject-length`） | 「件名：」の行がある仕事のメールで、件名が空か、字数の上限を超えるもの |
| [中身の無い箇条書きの項目](empty-list-item.md)（`empty-list-item`） | 「担当：」のように見出しの語だけで値の無い項目と、記号だけの項目 |
| [中身の無い節](empty-section.md)（`empty-section`） | 見出しのすぐ後ろに同じ深さか浅い見出しが来て、何も書かれていない節 |
| [表の空欄](empty-table-cell.md)（`empty-table-cell`） | ほかの行がすべて埋めている列で、一つの行だけが空いている表のセル |
| [図や表を参照する順番と位置](figure-reference-order.md)（`figure-reference-order`） | 図2を図1より先に参照する、図を載せた節より後で初めて参照する、一度も参照しない図や表 |
| [注の無い注の印と、印の無い注](footnote-mismatch.md)（`footnote-mismatch`） | 本文の「※3」「[^3]」に対応する注が無い所と、本文のどこも指さない注 |
| [見出しの深さが飛んでいる](heading-level-skip.md)（`heading-level-skip`） | 「##」の次に「####」が来るように、見出しの深さが一段以上飛んでいる所 |
| [見出しの番号の付け方が揃っていない](heading-numbering-mix.md)（`heading-numbering-mix`） | 「1. 概要」「手順」「3. 費用」や「1.」「2.」「3）」のように、兄弟の見出しで番号の付け方が混ざっている所 |
| [画像に代替テキストが無い](image-alt-text.md)（`image-alt-text`） | 「![](図.png)」のように、代替テキストの無い画像 |
| [画像の代替テキストがファイル名](image-file-name-alt.md)（`image-file-name-alt`） | 「![IMG_1234.png](…)」のように、代替テキストがファイル名のままの画像 |
| [同じ行為への逆の決まり](modal-conflict.md)（`modal-conflict`） | 同じ主語の同じ行為を、ある文では義務や許可に、別の文では禁止にしている所 |
| [題の後の段落が題を言い直しているだけ](no-lead.md)（`no-lead`） | 題のすぐ後の段落が、題を言い直すだけで何も足していない所 |
| [単位の無い数](number-without-unit.md)（`number-without-unit`） | 同じ列や同じ見出しの語のほかの値には単位があるのに、数だけを書いた値 |
| [札と番号だけの見出し](numbered-generic-heading.md)（`numbered-generic-heading`） | 「メリット1」「ポイント2」「Benefit 3」のように、札と番号だけで中身を言わない見出しが並ぶ所 |
| [番号の抜け・重なり](numbering-gap.md)（`numbering-gap`） | 第1条の次が第3条、(a) の次が (c) のように、番号が飛んだり重なったりしている所 |
| [本題に入るまでが長い](preamble-length.md)（`preamble-length`） | 最初の見出しまでの前置きが長く、本題になかなか入らない所 |
| [手順の後に書いた前提](prerequisite-after-step.md)（`prerequisite-after-step`） | 節の番号付きの手順より後にある、「作業を始める前に」「始める前に」で始まる文 |
| [必須の条件を歓迎の条件にも挙げている](required-listed-as-preferred.md)（`required-listed-as-preferred`） | 求人で、必須に挙げた資格や経験を歓迎にも挙げている所 |
| [無い手順を指す参照](step-reference-missing.md)（`step-reference-missing`） | 「手順5を参照」のように、文書の手順の最後の番号を超える手順を指す参照 |
| [表の行のセルが見出しの行より多い](table-row-overflow.md)（`table-row-overflow`） | 見出しの行より多いセルを持つ表の行（多い分は表示されない） |
| [見出しの無い目次の項目](toc-heading-mismatch.md)（`toc-heading-mismatch`） | 目次（「目次」「Contents」の見出しの下の箇条書き）の項目のうち、文書のどの見出しとも合わないもの |
| [閉じていないコードブロック](unclosed-code-fence.md)（`unclosed-code-fence`） | 「```」で始めたまま閉じていないコードブロック（後ろがすべてコードになる） |
| [一覧に無い材料や道具を手順で使っている](unlisted-item-used.md)（`unlisted-item-used`） | 手順で使う材料や道具が、材料・用意するものの一覧に無い所 |
| [太字にならずに見える「**」](unrendered-emphasis.md)（`unrendered-emphasis`） | 対にならず、太字にならないまま記号として見える「**」「__」 |
| [定義したのに使っていない語](unused-definition.md)（`unused-definition`） | 定義した語が、本文のどこにも出てこない所 |
| [定義より前で使っている語](use-before-definition.md)（`use-before-definition`） | 文の途中で括弧に入れて定義した語を、その定義より前で使っている所 |
| [図や表、箇条を「上記の図」のように指している](vague-figure-reference.md)（`vague-figure-reference`） | 図や表、条に番号を付けた文書で、「上記の図」「下の表」「以下の箇条」のように置き場所で指している所 |
| [行き先を言わないリンクの言葉](vague-link-text.md)（`vague-link-text`） | 「[こちら](…)」「[ここをクリック](…)」のように、言葉だけでは行き先の分からないリンク |

## 事実の食い違い

日付と曜日、日付の順番、合計と内訳のように、暦や計算で確かめられる食い違い。

| ルール | 見つけるもの |
| --- | --- |
| [金額の範囲の上限が下限より小さい](amount-range-reversed.md)（`amount-range-reversed`） | 「月給30万円〜25万円」のように、金額の範囲の終わりが始まりより小さい所 |
| [予告した数と箇条書きの数が合わない](announced-count-mismatch.md)（`announced-count-mismatch`） | 「以下の3点」と書いたのに、下の箇条書きの数が違う所 |
| [着が発より前](arrival-before-departure.md)（`arrival-before-departure`） | 旅程の便や列車で、着の時刻が発の時刻より前の所 |
| [添付に触れているのに、添付が見当たらない](attachment-not-attached.md)（`attachment-not-attached`） | 本文が「添付します」と書いているのに、添付の欄もファイル名も無い送ったメール |
| [増減率が二つの値と合わない](change-rate-mismatch.md)（`change-rate-mismatch`） | 「1,000社から20%増えて1,200社」のように、一つの文や表の一行の二つの値と増減率が合わない所 |
| [期末の残高が、期首の残高に入金を足し出金を引いた額と合わない](closing-balance-mismatch.md)（`closing-balance-mismatch`） | 当月末残高が、前月末残高 ＋ 入金合計 − 出金合計 と合わない所 |
| [移動の時間より短い乗り継ぎ](connection-time-short.md)（`connection-time-short`） | 旅程で、次の予定までの間が文書に書いた移動の時間より短い所 |
| [連絡先の書き違い](contact-variant.md)（`contact-variant`） | 同じメールアドレスや住所が、一か所だけ違って書かれている所（hibari-lab と hibarilab） |
| [定員より多い申込の人数](count-over-capacity.md)（`count-over-capacity`） | 「定員90名」の案内に、それより多い申込の人数が書いてある所 |
| [累計が当月の値より小さい](cumulative-below-current.md)（`cumulative-below-current`） | 給与明細や月報で、累計が当月の値より小さい所 |
| [日程の順番が前後している](date-order.md)（`date-order`） | 旅程や予定表、変更履歴の見出しで、一つだけ日付の順番が前後している所 |
| [書いた期間の外の日付](date-outside-period.md)（`date-outside-period`） | 旅程や会期のように書いた期間の外にある、日程の日付 |
| [期間の終わりが始まりより前](date-range-reversed.md)（`date-range-reversed`） | 「4月1日〜3月31日」のように、期間の終わりが始まりより前の所 |
| [制定日が改定日より後](date-stamp-order.md)（`date-stamp-order`） | 規約やポリシーの末尾で、制定の日付が改定の日付より後になっている所 |
| [日付と曜日の食い違い](date-weekday-mismatch.md)（`date-weekday-mismatch`） | 「2026年10月1日（金）」のように、日付と曜日が暦と合っていない所 |
| [申込締切が催しの日より後](deadline-after-event.md)（`deadline-after-event`） | 案内状やお知らせで、申込や出欠の返信の締め切りが催しの日より後の所 |
| [納品数量が発注数量より多い](delivered-over-ordered.md)（`delivered-over-ordered`） | 表の同じ行で、納品数量が発注数量より多い所 |
| [割引率が定価と単価から出る率と合わない](discount-rate-mismatch.md)（`discount-rate-mismatch`） | 価格表で、割引率が定価と単価から出る率と合わない所 |
| [期限が発行日より前](due-before-issue.md)（`due-before-issue`） | 支払期限や締切など、後に来るはずの日付が先の日付より前の所 |
| [始まりと期間から計算した終わりが、書いた終わりと合わない](duration-mismatch.md)（`duration-mismatch`） | 「4月1日から3か月間（7月31日まで）」のように、始まりに期間を足しても書いた終わりにならない所 |
| [起点の年から数えた年数が、文書の日付と合わない](elapsed-years-mismatch.md)（`elapsed-years-mismatch`） | 「2015年創業」と「創業5年」のように、起点の年や生年月日から計算した年数・年齢と合わない所 |
| [暦に無い日付](impossible-date.md)（`impossible-date`） | 「2月30日」「2023年2月29日」のような暦に無い日付と、和暦と西暦の年が食い違う日付 |
| [時計に無い時刻](impossible-time.md)（`impossible-time`） | 「午後13時」「13 PM」「10時75分」のように、時計に無い時刻 |
| [回数×毎回の額と合わないお支払総額](installment-total-mismatch.md)（`installment-total-mismatch`） | 「60回、毎月32,800円」とお支払総額が合わない支払いの案内 |
| [利息が残高に利率を掛けた額と合わない](interest-mismatch.md)（`interest-mismatch`） | 預金の明細で、利息が残高に利率を掛けた額と合わない所 |
| [数量×単価が金額と合わない](line-amount-mismatch.md)（`line-amount-mismatch`） | 見積書や請求書の明細で、数量×単価がその行の金額と合わない所 |
| [差引額が、総額から控除合計を引いた額と合わない](net-amount-mismatch.md)（`net-amount-mismatch`） | 差引支給額が、総支給額 − 控除合計 と合わない所 |
| [正味重量が総重量より重い](net-over-gross.md)（`net-over-gross`） | 表の同じ行で、正味重量が総重量より重い所 |
| [文字で書いた数と括弧の数字が違う](number-word-figure-mismatch.md)（`number-word-figure-mismatch`） | 「三（4）か月」「金参拾万円（30,000円）」のように、文字で書いた数と後ろの括弧の数字が違う所 |
| [内訳の割合を足しても 100% にならない](percent-sum-mismatch.md)（`percent-sum-mismatch`） | 構成比や内訳の百分率を足しても 100% にならない所 |
| [全体の期間より長い、その一部の期間](period-part-exceeds-whole.md)（`period-part-exceeds-whole`） | 「保証期間（12か月）のうち無料交換期間は18か月」のような全体より長い一部の期間 |
| [電話番号の数字の入れ違い](phone-number-variant.md)（`phone-number-variant`） | 同じ文書で、電話番号の隣り合う数字が一か所だけ入れ違っている所（0120-123-456 と 0120-123-465） |
| [量の範囲の上限が下限より小さい](quantity-range-reversed.md)（`quantity-range-reversed`） | 「使用温度範囲：-10〜-40℃」のように、測った量の範囲の終わりが始まりより小さい所 |
| [利益率が二つの値の割り算と合わない](ratio-mismatch.md)（`ratio-mismatch`） | 表や文の「営業利益率」が、営業利益 ÷ 売上高 と合わない所 |
| [「3日後の10月5日」の日付が、基準の日付から数えた日と合わない](relative-date-mismatch.md)（`relative-date-mismatch`） | 「3日後の10月6日」のように、相対で書いた日付が基準の日付から数えた日と合わない所 |
| [残高が前の行から計算した値と合わない](running-balance-mismatch.md)（`running-balance-mismatch`） | 返済表や明細の残高が、前の行の残高からの足し引きと合わない所 |
| [製造番号やロットの範囲の終わりが始まりより小さい](serial-range-reversed.md)（`serial-range-reversed`） | 「製造番号：A2400〜A1800」のように、番号の範囲の終わりが始まりより小さい所 |
| [負担額が合計に負担の割合を掛けた額と合わない](share-amount-mismatch.md)（`share-amount-mismatch`） | 医療費の明細で、負担額が合計の3割（30%）などと合わない所 |
| [100% を超える一部の割合](share-over-hundred.md)（`share-over-hundred`） | 「回答者の120%」のように、集まりの一部の割合なのに 100% を超える百分率 |
| [所要時間が、手順に書いた時間の和と合わない](step-time-sum-mismatch.md)（`step-time-sum-mismatch`） | レシピや手順書で、所要時間が手順の時間の和と合わない所 |
| [税額が小計に税率を掛けた額と合わない](tax-mismatch.md)（`tax-mismatch`） | 請求書の消費税や価格表の税込価格が、税率で計算した額と合わない所 |
| [時刻の範囲の終わりが始まりより前](time-range-reversed.md)（`time-range-reversed`） | 「15:15〜14:15」のように、時刻の範囲の終わりが始まりより前の所 |
| [合計が内訳の和と合わない](total-mismatch.md)（`total-mismatch`） | 見積もりや請求書、契約書で、合計が内訳に並べた金額の和と合わない所 |
| [予算と決算の差が、増減の列と合わない](variance-mismatch.md)（`variance-mismatch`） | 予算額と決算額の差が、書いた増減と合わない行 |
| [説明の版とコードの版が違う](version-mismatch.md)（`version-mismatch`） | コードブロックのすぐ上の説明が名指す版と、コードの版が違う所 |
| [版の並びが前後している](version-order.md)（`version-order`） | 変更履歴の見出しや版の一覧で、一つだけ順番から外れた版 |
| [距離と合わない徒歩の分数](walk-time-distance-mismatch.md)（`walk-time-distance-mismatch`） | 「徒歩3分（約600m）」のように、徒歩の分数が書いた距離と合わない所 |

まだ見本の無いルール: `annual-holidays-mismatch`, `annual-pay-mismatch`, `backorder-mismatch`, `bmi-mismatch`, `capacity-runtime-mismatch`, `citation-reference-mismatch`, `cross-doc-fact-conflict`, `currency-column-mix`, `dangling-figure-reference`, `deductible-exceeds-limit`, `default-value-mismatch`, `deprecated-option-used`, `duration-product-mismatch`, `fact-conflict`, `formula-amount-mismatch`, `gpa-mismatch`, `heading-command-missing`, `interval-count-mismatch`, `layout-code-mismatch`, `meter-usage-mismatch`, `parameter-table-mismatch`, `period-label-conflict`, `period-multiple-mismatch`, `product-exceeds-maximum`, `quote-unnamed-speaker`, `quote-without-source`, `range-band-mismatch`, `reference-flag-mismatch`, `reference-number-repeated`, `reference-number-variant`, `reference-title-mismatch`, `reference-topic-missing`, `reference-unit-mismatch`, `rent-multiple-mismatch`, `return-type-mismatch`, `revision-direction-mismatch`, `scaled-quantity-mismatch`, `summary-fact-mismatch`, `table-unit-mix`, `tier-threshold-mismatch`, `time-order`, `undefined-function-call`, `unit-mismatch`

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

| ルール | 見つけるもの |
| --- | --- |
| [社内でしか通じない言葉](internal-jargon.md)（`internal-jargon`） | 「横展開」「握る」のように、社内でしか通じない言葉。chaff.yaml の jargon に書いた語だけを見ます |
| [チームの表記と違う](preferred-term.md)（`preferred-term`） | チームで決めた表記と違う書き方（「サーバー」と決めたのに「サーバ」）。chaff.yaml の prefer で決めます |
| [必要な見出しが無い](required-sections.md)（`required-sections`） | チームが必須と決めた見出し（「リスク」「費用」など）が無い文書。chaff.yaml で決めます |
| [規定の文末が、決めた書き方と違う](requirement-modal.md)（`requirement-modal`） | 規格・規程の文末が、チームの選んだ決まり（JIS Z 8301 など）と違う所（選んだときだけ） |

意味を読む検査は `npx chaffjs test` で AI に尋ねて動くので、決まった出力を見せるこの見本には入れていません: `empty-conclusion`, `generic-opening`, `risk-disclosure`, `unsourced-number`
