# 参考文献

chaff のルールが何を根拠にしているかを、論文と規格ごとにまとめました。
どの文献も、論文誌や出版元などの元のページを開き、書誌と中身を確かめてから載せています。
各項目には、その文献が見つけたことと、chaff での使いみちを書きました。

## このページの読みかた

文献は話題ごとに分けてあります。一つの項目は次の 3 つでできています。

| 部分 | 中身 |
| --- | --- |
| 書誌 | 著者、年、題名、載った所、元のページへのリンク |
| 分かったこと | その文献が示したことを 1、2 文で |
| chaff では | 裏付けにしているルール。直接は使っていない文献は【背景】と書き、なぜ使わないかを添えます |

読みやすさの公式も、AI の文章を見分ける方法も、文章の良し悪しを決めるものではありません。
どちらも統計で傾向を示すだけです。
そのため chaff は、点数で文書を裁かず、直す場所を 1 つずつ示します。
ルールの一覧は [リファレンス](./reference) にあります。

## 日本語の読みやすさ

- **柴崎秀子・玉岡賀津雄（2010）** [doi.org](https://doi.org/10.15077/jjet.KJ00006063558)
  - 「国語科教科書を基にした小・中学校の文章難易学年判定式の構築」
  - 載った所：日本教育工学会論文誌、33 巻 4 号、449–458 頁。
  - 分かったこと：国語の教科書 205 編から、文章が何年生向けかを当てる式を作りました。
    効いたのは、ひらがなの割合と、一文に入る述語の数の 2 つでした。
  - chaff では：[`max-kanji-continuous`](../../rules/max-kanji-continuous/) と
    [`max-sentence-length`](../../rules/max-sentence-length/) の裏付けです。
- **李在鎬（2016）** [jhlee.sakura.ne.jp (PDF)](http://jhlee.sakura.ne.jp/papers/lee2016.pdf)
  - 「日本語教育のための文章難易度に関する研究」
  - 載った所：早稲田日本語教育学、第 21 号、1–16 頁。
  - 分かったこと：平均の文の長さと、漢語・和語・動詞・助詞の割合から、学習者にとっての難しさを 6 段階で出す式です。
    文章の難しさを測るサイト jReadability は、この式をもとにしています。
  - chaff では：漢語が多いほど難しくなるという結果が、`max-kanji-continuous` を支えます。
- **Sato, Matsuyoshi, Kondoh（2008）** [aclanthology.org](https://aclanthology.org/L08-1230/)
  - Automatic Assessment of Japanese Text Readability Based on a Textbook Corpus
  - 載った所：LREC 2008。
  - 分かったこと：小学 1 年から大学までの教科書を集め、文字の出かただけで文章の学年を当てました。
    読みやすさを測る道具「帯（Obi）」のもとです。単語に区切らなくても測れます。
  - chaff では：【背景】chaff は学年を出さず、読みにくい所を指します。
- **佐藤理史（2011）** [cir.nii.ac.jp](https://cir.nii.ac.jp/crid/1050845762830703616)
  - 「均衡コーパスを規範とするテキスト難易度測定」
  - 載った所：情報処理学会論文誌、52 巻 4 号、1777–1789 頁。
  - 分かったこと：文章の難しさを、世の中で書かれた日本語の文章全体に対して、どの辺りにあるかで示しました。
  - chaff では：【背景】文書の種類ごとに上限を変える、chaff のジャンルと同じ考えかたです。
- **出入国在留管理庁・文化庁（2020）** [bunka.go.jp (PDF)](https://www.bunka.go.jp/seisaku/kokugo_nihongo/kyoiku/pdf/92484001_01.pdf)
  - 『在留支援のためのやさしい日本語ガイドライン』
  - 分かったこと：外国の人に伝わる日本語の書きかたです。
    一文を短くする、二重否定と受け身を避ける、です・ます で揃える、漢字を多くしすぎない、と挙げています。
    一文の字数の上限は書いていません。
  - chaff では：`max-sentence-length`、[`no-mixed-desumasu`](../../rules/no-mixed-desumasu/)、
    [`agentless-passive`](../../rules/agentless-passive/) の裏付けです。
- **庵功雄（2016）** [iwanami.co.jp](https://www.iwanami.co.jp/book/b243840.html)
  - 『やさしい日本語―多文化共生社会へ』
  - 載った所：岩波新書。
  - 分かったこと：やさしい日本語が、阪神・淡路大震災のあとに生まれた経緯と、誰に向けた日本語かを説明しています。
  - chaff では：【背景】ルールの数値ではなく、短く平らに書く理由を知るための本です。

## 英語の読みやすさと、平易な英語

- **Flesch（1948）** [doi.org](https://doi.org/10.1037/h0057532)
  - A new readability yardstick
  - 載った所：Journal of Applied Psychology、32 巻 3 号、221–233 頁。
  - 分かったこと：文の長さと、1 語あたりの音節の数から、0 から 100 の「読みやすさ」を出す式です。
    70 で「やさしい」、30 で「とても難しい」としています。
  - chaff では：【背景】文の長さはどの公式にも入っています。chaff はそれを `max-sentence-length` で直接見ます。
- **Kincaid ほか（1975）** [eric.ed.gov](https://eric.ed.gov/?id=ED108134)
  - Derivation of New Readability Formulas ... for Navy Enlisted Personnel
  - 載った所：米海軍 Research Branch Report 8-75。
  - 分かったこと：海軍の兵員 531 人に読ませた結果から、読みやすさの式を学年で答える形に作り直しました。
    いま Flesch–Kincaid の学年として広く使われている式です。
  - chaff では：【背景】学年は読み手の層を決めないと意味を持たないので、chaff は出しません。
- **Dale, Chall（1948）** [files.eric.ed.gov (PDF)](https://files.eric.ed.gov/fulltext/ED506404.pdf)
  - A Formula for Predicting Readability
  - 載った所：Educational Research Bulletin、27 巻 1 号、11–20, 28 頁。リンク先は、この論文を再録した ERIC の PDF です。
  - 分かったこと：よく知られた 3,000 語に入らない語の割合と、文の長さで読みやすさを測る式です。
  - chaff では：【背景】chaff は語の一覧を持ちません。通じない語は、チームが `chaff.yaml` に書きます。
- **Redish（2000）** [doi.org](https://doi.org/10.1145/344599.344637)
  - Readability formulas have even more limitations than Klare discusses
  - 載った所：ACM Journal of Computer Documentation、24 巻 3 号、132–137 頁。
  - 分かったこと：読みやすさの公式は、読みにくい理由も直しかたも教えてくれません。
    子ども向けの教科書で作った式が、大人向けの技術文書に当てはまるかは分からない、と書いています。
  - chaff では：chaff が点数を出さず、直す場所と理由を示す根拠です。
- **Crossley, Skalicky, Dascalu（2019）** [doi.org](https://doi.org/10.1111/1467-9817.12283)
  - Moving beyond classic readability formulas: new methods and new models
  - 載った所：Journal of Research in Reading、42 巻 3–4 号、541–561 頁。
  - 分かったこと：人が読んで理解した度合いを集めました。
    言葉の特徴を多く使う模型のほうが、Flesch–Kincaid のような古い式より当たりました。
  - chaff では：【背景】学習した模型は、同じ文に同じ結果を返す chaff の検査には入れません。
- **PLAIN（2011）** [wid.org (PDF)](https://wid.org/wp-content/uploads/2022/03/FederalPLGuidelines.pdf)
  - Federal Plain Language Guidelines
  - 載った所：米国連邦政府の平易な文章の手引き。政府のサイトから PDF が消えたため、リンク先は wid.org にある写しです。
  - 分かったこと：能動態で書く、同じものは同じ語で呼ぶ、略語を減らす、二重否定を避ける、と挙げています。
    義務には shall でなく must を使い、文と段落を短くする、とも書いています。字数の上限は書いていません。
  - chaff では：`agentless-passive`、[`preferred-term`](../../rules/preferred-term/)、
    [`undefined-acronym`](../../rules/undefined-acronym/) の裏付けです。
- **Government Digital Service（英国政府）** [guidance.publishing.service.gov.uk](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/)
  - Use clear language
  - 載った所：GOV.UK content and publishing guidance。
  - 分かったこと：25 語を超える文は分ける、1 段落は 5 文まで、と数で書いています。
  - chaff では：英語の `max-sentence-length` の normal（25 語）と、
    [`max-paragraph-length`](../../rules/max-paragraph-length/) の normal（5 文）がこれと同じです。
- **ISO 24495-1:2023** [cdn.standards.iteh.ai (PDF)](https://cdn.standards.iteh.ai/samples/78907/d194fac21d6a45f38bfcfec9657f7498/ISO-24495-1-2023.pdf)
  - Plain language — Part 1: Governing principles and guidelines
  - 載った所：ISO。リンク先は、販売元の iTeh が出している見本の PDF です。
  - 分かったこと：平易な文章を、読み手が必要なことを見つけ、分かり、使えるかで定めた国際規格です。
    公式のような機械的な尺度ではなく、読み手が使えたかで測る、と書いています。
  - chaff では：Redish と同じく、chaff が点数で裁かない根拠です。

## 表記と書式の決まり

- **文化審議会（2022）** [bunka.go.jp (PDF)](https://www.bunka.go.jp/seisaku/bunkashingikai/kokugo/hokoku/pdf/93651301_01.pdf)
  - 「公用文作成の考え方」
  - 載った所：文化審議会の建議、令和 4 年 1 月 7 日。
  - 分かったこと：役所の文書の書きかたです。一文が 50～60 字ほどになったら、読みにくくないか気にする、としています。
    外向けの文書は です・ます で書き、外来語の語末の「ー」は付け（コンピューター）、全角と半角を揃えます。
  - chaff では：`max-sentence-length`、`no-mixed-desumasu`、
    [`katakana-long-vowel`](../../rules/katakana-long-vowel/)、[`latin-spacing`](../../rules/latin-spacing/) の裏付けです。
- **内閣告示（1991）** [bunka.go.jp](https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/gairai/honbun06.html)
  - 「外来語の表記」
  - 載った所：平成 3 年 内閣告示第 2 号。
  - 分かったこと：英語の語末の -er、-or、-ar などは、原則として「ー」を付けて書くとしています。
    慣用で省いてもよいとも書いています。
  - chaff では：`chaff.yaml` に `style: bunkacho` と書くと、この決まりで `katakana-long-vowel` が動きます。
- **JIS Z 8301:2019** [webdesk.jsa.or.jp](https://webdesk.jsa.or.jp/books/W11M0090/index/?bunsyo_id=JIS+Z+8301%3A2019)
  - 「規格票の様式及び作成方法」
  - 載った所：日本規格協会。
  - 分かったこと：規格の書きかたです。要求・禁止・推奨・許可を表す文末を決め、「すべきである」は使いません。
    「上記の図」のような曖昧な参照を避け、略語は全体で同じにします。
    2011 年版は、3 音以上の外来語では語末の「ー」を省いていました。
  - chaff では：`undefined-acronym` と [`dangling-reference`](../../rules/dangling-reference/) の裏付けです。
    `style: jis-z8301-2011` と書くと、2011 年版の書きかたで `katakana-long-vowel` が動きます。
- **共同通信社 編著（2022）** [kyodo.co.jp](https://www.kyodo.co.jp/publish/%E8%A8%98%E8%80%85%E3%83%8F%E3%83%B3%E3%83%89%E3%83%96%E3%83%83%E3%82%AF%E3%80%80%E6%96%B0%E8%81%9E%E7%94%A8%E5%AD%97%E7%94%A8%E8%AA%9E%E9%9B%86%E3%80%80%E7%AC%AC%EF%BC%91%EF%BC%94%E7%89%88/)
  - 『記者ハンドブック 新聞用字用語集 第 14 版』
  - 分かったこと：新聞の用字と用語の決まりを集めた本です。報道のほか、広報やウェブの書き手にも使われています。
  - chaff では：chaff は語の決まりを持ちません。この本に合わせる語は、`chaff.yaml` の `prefer` に書くと
    `preferred-term` が見ます。
- **日本翻訳連盟（JTF）** [jtf.jp](https://www.jtf.jp/tips/styleguide)
  - 『JTF 日本語標準スタイルガイド（翻訳用）』
  - 分かったこと：基本の決まりが 12 あり、どれも機械で確かめられます。
    です・ます と である を混ぜない、語末の「ー」を省かない、全角と半角の間に空白を入れない、などです。
  - chaff では：`no-mixed-desumasu`、`katakana-long-vowel`、`latin-spacing` の 3 つが、この決まりに近い所を確かめます。
    空白を入れるかどうかは決めず、一つの文書の中で揃っているかだけを見ます。

## 文章の自動評価と、誤りの検出

- **Attali, Burstein（2006）** [ejournals.bc.edu](https://ejournals.bc.edu/index.php/jtla/article/view/1650)
  - Automated Essay Scoring With e-rater V.2
  - 載った所：Journal of Technology, Learning, and Assessment、4 巻 3 号。
  - 分かったこと：試験の小論文を採点する仕組みです。少ない数の、意味の分かる特徴で採点できることを示しました。
  - chaff では：【背景】chaff は文書に点数を付けません。
- **Ke, Ng（2019）** [doi.org](https://doi.org/10.24963/ijcai.2019/879)
  - Automated Essay Scoring: A Survey of the State of the Art
  - 載った所：IJCAI-19。
  - 分かったこと：小論文の自動採点の研究を 50 年分まとめ、まだ解けていない問題だとしています。
  - chaff では：【背景】採点が難しいことは、chaff が点数ではなく箇所を示す理由の一つです。
- **Ng ほか（2014）** [aclanthology.org](https://aclanthology.org/W14-1701/)
  - The CoNLL-2014 Shared Task on Grammatical Error Correction
  - 載った所：CoNLL 2014。
  - 分かったこと：英語学習者の作文で文法の誤りを直す共通課題です。前年の 5 種から、すべての種類の誤りに広げました。
  - chaff では：【背景】chaff は文法の誤りを直す道具ではなく、書き換えもしません。
- **Bryant ほか（2023）** [aclanthology.org](https://aclanthology.org/2023.cl-3.4/)
  - Grammatical Error Correction: A Survey of the State of the Art
  - 載った所：Computational Linguistics、49 巻 3 号、643–701 頁。
  - 分かったこと：文法の誤りを直す方法が、規則から統計、機械翻訳へと移ってきた流れをまとめています。
  - chaff では：【背景】規則で見つかる誤りだけを chaff が受け持つ、という線引きの参考です。
- **Mizumoto ほか（2011）** [aclanthology.org](https://aclanthology.org/I11-1017/)
  - Mining Revision Log of Language Learning SNS for Automated Japanese Error Correction of Second Language Learners
  - 載った所：IJCNLP 2011。
  - 分かったこと：語学学習の SNS である Lang-8 の添削記録から、日本語学習者の誤りを集めた大きなコーパスを作りました。
  - chaff では：【背景】学習者の誤りを直す研究で、chaff の対象とは読み手が違います。
- **Koyama ほか（2020）** [aclanthology.org](https://aclanthology.org/2020.lrec-1.26/)
  - Construction of an Evaluation Corpus for Grammatical Error Correction for Learners of Japanese as a Second Language
  - 載った所：LREC 2020。
  - 分かったこと：Lang-8 は評価に使うには誤りが多いため、評価に使える日本語のコーパス TEC-JL を作りました。
  - chaff では：【背景】直しかたの評価には、人が確かめた正解が要ることを示す例です。
- **山本和英・鄭育昌（2015）** [anlp.jp (PDF)](https://www.anlp.jp/proceedings/annual_meeting/2015/html/paper/WS_PNN12_j-proofreading.pdf)
  - 「Project Next 日本語校正タスク」
  - 載った所：言語処理学会 第 21 回年次大会、ワークショップ。
  - 分かったこと：日本語の校正の道具が見ている誤りを整理しました。
    助詞の抜け、同じ助詞の連続、呼応の誤りは機械で見つけやすく、文脈で決まる誤りは難しい、としています。
  - chaff では：[`no-doubled-joshi`](../../rules/no-doubled-joshi/) の裏付けです。

## 生成された文章の特徴

この節の文献は、生成された文章にどんな特徴が出やすいかを調べたものです。
chaff はこれをもとに言い回しや書式を指しますが、「AI が書いた」とは言いません。
人の文章を AI の文章と取り違える例が多いことも、下の文献が示しています。

- **Gehrmann, Strobelt, Rush（2019）** [aclanthology.org](https://aclanthology.org/P19-3019/)
  - GLTR: Statistical Detection and Visualization of Generated Text
  - 載った所：ACL 2019 System Demonstrations。
  - 分かったこと：語がどれだけ予想しやすいかを色で見せると、人が生成文を見分ける正解率が 54% から 72% に上がりました。
  - chaff では：【背景】言語モデルの確率を使うので、chaff の検査には入れません。
- **Liang ほか（2023）** [arxiv.org](https://arxiv.org/abs/2304.02819)
  - GPT detectors are biased against non-native English writers
  - 載った所：Patterns。
  - 分かったこと：よく使われる AI 判定の道具は、英語が母語でない人の文章を、AI が書いたものと取り違えがちでした。
  - chaff では：chaff が書き手を判定せず、言い回しだけを指す理由です。
- **Wu ほか（2025）** [aclanthology.org](https://aclanthology.org/2025.cl-1.8/)
  - A Survey on LLM-Generated Text Detection: Necessity, Methods, and Future Directions
  - 載った所：Computational Linguistics、51 巻 1 号、275–338 頁。
  - 分かったこと：生成文を見分ける方法を、透かし、統計、学習した分類器、人の判断の 4 つに分けてまとめています。
  - chaff では：【背景】この分け方でいえば、chaff は表面の数え上げだけを使います。
- **Reinhart ほか（2025）** [arxiv.org](https://arxiv.org/abs/2410.16107)
  - Do LLMs write like humans? Variation in grammatical and rhetorical styles
  - 載った所：PNAS。
  - 分かったこと：指示に従うよう調整したモデルは、分詞の節や名詞化を人の何倍も使い、名詞を並べる書きかたも多いと示しました。
  - chaff では：[`rule-of-three`](../../rules/rule-of-three/) の裏付けです。
- **Kobak ほか（2025）** [arxiv.org](https://arxiv.org/abs/2406.07016)
  - Delving into LLM-assisted writing in biomedical publications through excess vocabulary
  - 載った所：Science Advances、11 巻 27 号。
  - 分かったこと：医学論文の要旨 1,500 万件あまりを調べました。
    2024 年に delves、underscores、showcasing、pivotal などの語が急に増えています。
  - chaff では：[`ai-tell`](../../rules/ai-tell/) が英語で見る語の裏付けです。
- **Liang ほか（2024）** [proceedings.mlr.press](https://proceedings.mlr.press/v235/liang24b.html)
  - Monitoring AI-Modified Content at Scale: A Case Study on the Impact of ChatGPT on AI Conference Peer Reviews
  - 載った所：ICML 2024。
  - 分かったこと：学会の査読の文章で、commendable、meticulous、intricate などの形容詞が大きく増えました。
  - chaff では：`ai-tell` の裏付けです。1 語だけでは言わず、重なったときに言う理由でもあります。
- **Zhang ほか（2024）** [arxiv.org](https://arxiv.org/abs/2409.11704)
  - From Lists to Emojis: How Format Bias Affects Model Alignment
  - 載った所：arXiv（査読前）。
  - 分かったこと：人の評価者も AI の評価者も、箇条書き、太字、絵文字、長い答えを、中身と関係なく高く評価しがちでした。
    モデルがそうした書式を多く使う理由の一つです。
  - chaff では：[`bold-density`](../../rules/bold-density/)、[`emoji-density`](../../rules/emoji-density/)、
    `rule-of-three` は、この偏りが文章に出た所を指します。
- **Freeburg（2026）** [arxiv.org](https://arxiv.org/abs/2603.27006)
  - The Last Fingerprint: How Markdown Training Shapes LLM Prose
  - 載った所：arXiv（査読前）。
  - 分かったこと：12 のモデルを比べ、ダッシュ（—）を使う頻度がモデルによって大きく違うことを示しました。
  - chaff では：[`no-em-dash`](../../rules/no-em-dash/) の裏付けです。1 つで言わず、頻度で見る理由でもあります。
- **Zaitsu, Jin（2023）** [doi.org](https://doi.org/10.1371/journal.pone.0288453)
  - Distinguishing ChatGPT(-3.5, -4)-generated and human-written papers through Japanese stylometric analysis
  - 載った所：PLOS ONE、18 巻 8 号。
  - 分かったこと：日本語の論文で、機能語の割合や読点の打ちかたを数えると、人と ChatGPT の文章をよく分けられました。
  - chaff では：【背景】分けるのに学習した分類器を使うので、chaff には入れません。
- **Zaitsu ほか（2025）** [doi.org](https://doi.org/10.1371/journal.pone.0335369)
  - Stylometry can reveal artificial intelligence authorship, but humans struggle
  - 載った所：PLOS ONE、20 巻 10 号。
  - 分かったこと：7 つのモデルが書いた日本語の文章は、数え上げで見分けられました。
    人の判定者はあまり当てられず、文末や接続詞、句読点のような表面の手がかりに頼っていました。
  - chaff では：【背景】人の勘より数え上げが確かだという、chaff の立場を支える結果です。
- **林美佐・相澤彰子（2026）** [anlp.jp (PDF)](https://www.anlp.jp/proceedings/annual_meeting/2026/pdf_dir/B9-17.pdf)
  - 「LLM による日本語生成におけるモデル固有表現パターンの分析」
  - 載った所：言語処理学会 第 32 回年次大会、B9-17。
  - 分かったこと：モデルごとに決まった書き出しと結びがあります。
    「結論から申し上げますと」「ステップバイステップで説明します」などを挙げています。
  - chaff では：[`assistant-residue`](../../rules/assistant-residue/) が見る、会話の返事の名残と同じ種類の言い回しです。
- **岩本海風・宮本友樹・内海彰（2026）** [anlp.jp (PDF)](https://www.anlp.jp/proceedings/annual_meeting/2026/pdf_dir/P9-11.pdf)
  - 「大規模言語モデルで生成された文学テキストの検出と有効な識別的特徴の探求」
  - 載った所：言語処理学会 第 32 回年次大会、P9-11。
  - 分かったこと：詩、歌詞、俳句、短編のどれでも、生成された文章は文の長さのばらつきが小さく出ました。
  - chaff では：[`sentence-rhythm`](../../rules/sentence-rhythm/) の裏付けです。

## 要件の書きかたと、矛盾の検出

- **ISO/IEC/IEEE 29148:2018** [standards.ieee.org](https://standards.ieee.org/ieee/29148/6937/)
  - Systems and software engineering — Life cycle processes — Requirements engineering
  - 分かったこと：良い要件とは何かを定めた国際規格です。抜け道になる言い回しや曖昧な副詞など、避ける言葉も挙げています。
  - chaff では：【背景】下の Femmer ほかが、この規格の言葉の決まりを機械の検査にしています。
- **Berry, Kamsties, Krieger（2003）** [cs.uwaterloo.ca (PDF)](https://cs.uwaterloo.ca/~dberry/handbook/ambiguityHandbook.pdf)
  - From Contract Drafting to Software Specification: Linguistic Sources of Ambiguity
  - 分かったこと：契約書と仕様書で、読みかたが割れる言葉を集めた手引きです。
    and/or、all と each、only の位置、何を指すか分からない代名詞などを挙げています。
  - chaff では：【背景】ここに並ぶ言葉の多くは、まだ chaff のルールになっていません。
- **Femmer ほか（2017）** [doi.org](https://doi.org/10.1016/j.jss.2016.02.047)
  - Rapid quality assurance with Requirements Smells
  - 載った所：Journal of Systems and Software、123 巻、190–213 頁。
  - 分かったこと：要件の文に出る悪い兆しを、機械で探しました。
    主観的な言葉、曖昧な副詞、抜け道、最上級、比較、否定、曖昧な代名詞、不完全な参照です。
    指摘のうち当たりは平均 59%、悪い兆しのうち見つけた割合は平均 82% でした。
  - chaff では：[`unqualified-superlative`](../../rules/unqualified-superlative/)、
    [`excessive-hedging`](../../rules/excessive-hedging/)、`dangling-reference` の裏付けです。
    機械の指摘は人が確かめる、という chaff の考えとも同じです。
- **Gervasi, Zowghi（2005）** [doi.org](https://doi.org/10.1145/1072997.1072999)
  - Reasoning about inconsistencies in natural language requirements
  - 載った所：ACM Transactions on Software Engineering and Methodology、14 巻 3 号、277–330 頁。
  - 分かったこと：自然言語で書いた要件を論理に直し、互いに矛盾する要件を自動で見つけました。
  - chaff では：【背景】文を論理に直す部分は、chaff の範囲を超えます。
- **de Marneffe, Rafferty, Manning（2008）** [aclanthology.org](https://aclanthology.org/P08-1118/)
  - Finding Contradictions in Text
  - 載った所：ACL-08。
  - 分かったこと：文章の矛盾には、否定、反対語、数の食い違いのように見つけやすいものと、世の中の知識が要るものがあります。
  - chaff では：[`total-mismatch`](../../rules/total-mismatch/) や [`date-order`](../../rules/date-order/) のように、
    数と日付の食い違いを機械で見る裏付けです。
- **Mavin ほか（2009）** [doi.org](https://doi.org/10.1109/RE.2009.9)
  - Easy Approach to Requirements Syntax (EARS)
  - 載った所：RE'09。
  - 分かったこと：要件を 5 つの決まった型のどれかで書くと、曖昧さなどのよくある問題が減ることを示しました。
  - chaff では：【背景】型に合っているかを見るルールは、まだありません。
