# ルールを足す：AI やエンジニアに頼むとき

チームの書き方の決まりを、chaff が確かめられる形にする方法をまとめました。
AI やエンジニアに頼むときは、このページをそのまま渡せます。
道は 4 つあり、上から順にやさしく、下ほど細かいことができます。

## 4 つの道

| 道 | 向いているとき | 書く場所 | 使える時期 |
| --- | --- | --- | --- |
| 組み込みルールの設定を変える | 既にあるルールで足りる（上限、表記の組、社内用語、必須の見出し） | `chaff.yaml` | いま |
| 語や正規表現のルール | 決まった語句や文字の並びに、チームの言葉で指摘を付けたい（「弊社」を社外向けに使わない、など） | `chaff.yaml` の `custom_rules` | 0.18.0 |
| 形態素解析のルール | 品詞や活用で決まる書き方（名詞のあとの「する」など） | `chaff.yaml` の `custom_rules` | 0.18.0 |
| Node の関数のルール | 数える・比べるなど、上の 3 つで書けないもの | `.mjs` のファイルと `custom_rules` | 0.19.0 |

ほかのチームとも使うルールは、プラグインのパッケージにまとめて配れます。[プラグインを作る](./writing-plugins) にあります。

まず、既にあるルールで足りないかを確かめます。
どんなルールがあるかは、[リファレンス](./reference) に例と一緒に並べてあります。
端末では、次のコマンドで一覧が出ます。

```bash
npx chaffjs rules          ルールの一覧を、グループごとに表で出す
npx chaffjs rules --json   同じ一覧を、AI が読む形（JSON）で出す
```

## 書き方の決まりから chaff.yaml を作る

AI に頼むときの手順です。AI には `npx chaffjs rules --json` の出力を読ませます。
この出力には、ルールごとに、見つけるもの（`summary`）、段階の意味（`level_meaning`）、
例、ジャンルごとの動き（`genres`）が入っています。推測でルールの名前や数を書かせないためです。

| 順番 | AI がすること |
| --- | --- |
| 1 | チームの決まりを、一つずつに分けて読む |
| 2 | 決まりごとに、`summary` と `level_meaning` が合うルールを選ぶ。数の決まりは、段階の数と比べて段階を選ぶか、数をそのまま書く |
| 3 | 文書の種類が分かれば `genre` を決め、`genres` でそのジャンルで動くかを確かめる |
| 4 | 表記の組は `prefer`、社内用語は `jargon`、必須の見出しは `required_sections` に書く |
| 5 | 既定と同じものは書かない。書いたら `explain` と、決まりに沿った短い見本で確かめる |

同じ手順は、`rules --json` の `how_to_write_settings_from_a_style_note` にも入っています。
AI に渡すのは、JSON だけでも足ります。

## 例：「です・ます、1文80字まで」

技術資料の決まりが「です・ます、1文80字まで」だとします。
`chaff.yaml` に `language: ja` を書いてから `rules --json` で `max-sentence-length` を見ると、次のように出ます（一部）。
数は言語で数え方が違うので、決まりの言語で見ます（英語なら語で数えます）。

```json
{
  "id": "max-sentence-length",
  "summary": { "ja": "読み終える前に主語を見失うほど長い一文" },
  "level_meaning": { "ja": "一文 {limit} 字まで" },
  "levels": { "strict": 70, "normal": 100, "relaxed": 140 }
}
```

80 字はどの段階とも違うので、数をそのまま書きます。
「です・ます」は `no-mixed-desumasu` が見ます。
ただし、このルールは、どちらの調子が正しいかを決めず、混ざった文だけを指します。
全部を だ・である で書いた文書は指しません。この違いは、チームに伝えておきます。

```yaml file=chaff.yaml
language: ja
genre: technical/spec

rules:
  # 1文80字まで
  max-sentence-length: 80
  # です・ます（だ・である が混ざったら指摘する）
  no-mixed-desumasu: normal
```

決まりに沿わない見本を一つ作って、かけてみます。実際の出力です。

```
$ npx chaffjs sample.md --compact

sample.md   technical/spec · 日本語   ジャンルは chaff.yaml から

  3:1     info    この文は 84 文字あります（80 文字まで）
                  max-sentence-length
  5:31    info    この文だけ他と文末の調子が違います（本文の中で 1 文）
                  no-mixed-desumasu

{counts}
```

どちらの決まりも指摘されたので、設定が効いています。
指摘が出ないときは、`npx chaffjs rules` の表で、そのルールがいま `off` になっていないかを見ます。

## 組み込みルールの設定を変える

いちばんやさしい道です。書くのは `chaff.yaml` だけで、chaff のコードには触りません。

| 変えたいこと | 書き方 |
| --- | --- |
| ルールの強さ | `rules` に `strict` `normal` `relaxed` `off` のどれかを書く |
| 上限の数 | `rules` に数を書く（`max-sentence-length: 80`） |
| 試験中のルールを動かす | `rules` に段階を書く（`doubled-word: normal`） |
| 表記を揃える | `prefer` に「使わない書き方: 使う書き方」の組を書く |
| 社内用語を指す | `jargon` に語を並べる |
| 必須の見出し | `required_sections` に見出しを並べる |

書き方の細かいところは [設定](./configuration) にあります。
書いたあとは `npx chaffjs rules` の表で、そのルールがいまどの段階で動くかを確かめます。

## ルールの細かい設定（0.18.0）

段階のほかに、ルールごとの設定（`options`）を書けます。
いま設定を持つのは、カタカナ語の語末の長音を見る `katakana-long-vowel` です。
たとえば「IEICE 準拠」なら、3 音以上の語は語末に「ー」を付けない決まりなので、次のように書きます。

```yaml
rules:
  katakana-long-vowel: normal
options:
  katakana-long-vowel:
    ending: drop      # 語末の「ー」を付けない（コンピュータ、メモリ）
    min_morae: 3      # 3 音以上の語だけ
    except: [カー]     # この語はどちらの書き方でも指さない
```

`style: ieice` と 1 行書けば、同じ設定になります。
どの設定があり、どの値を書けるかは、`npx chaffjs explain katakana-long-vowel` と `rules --json` に出ます。
詳しくは [チームの表記ルールを決める](./house-style) にあります。

## 語と正規表現のルール（0.18.0）

決まった語句や文字の並びを、チームの言葉で指摘するルールです。`chaff.yaml` の `custom_rules` に書きます。
`words` は語の一覧か「使わない書き方: 使う書き方」の組です。`pattern` は正規表現です。
どのルールにも `name`（名前）、`why`（理由）、`how_to_fix`（直し方）、`example`（直す前と後）を書きます。
指摘を読む人が、なぜ直すのかを分かるようにするためです。

```yaml
custom_rules:
  - id: no-heisha
    type: words
    words: [弊社]
    name: 社外向けの文書で「弊社」と書いている
    why: 社外向けの文書では「当社」と書くと決めています。
    how_to_fix: 「当社」に直してください。
    example:
      before: 弊社の新製品をご紹介します。
      after: 当社の新製品をご紹介します。
  - id: date-with-slash
    type: pattern
    pattern: '\d{4}/\d{1,2}/\d{1,2}'
    name: 日付を「/」で書いている
    message: 「{matched}」は「2026年10月1日」の形で書きます
    why: 日付の書き方をそろえると、読み手が迷いません。
    how_to_fix: 「年」「月」「日」を使って書いてください。
    example:
      before: 締め切りは 2026/10/1 です。
      after: 締め切りは 2026年10月1日です。
```

`words` は書いたとおりの語に当たります。活用する語は、次の形態素解析のルールで書きます。
書いたルールは、組み込みのルールと同じく `rules` で強さを変えられ、`stet` で一か所だけ黙らせられます。
`pattern` に `ignore_case: true` を添えると、大文字と小文字を区別せずに当てます。
正規表現は動かす前に確かめ、長い行で止まらなくなる形（`(a+)+` など）は断ります。

## 形態素解析のルール（0.18.0）

語の品詞や、活用する前の形（原形）で当てるルールです。
「〜することができる」を「〜できる」に、のような決まりは、文字だけでは活用のたびに書き分けが要ります。
形態素解析で分けた語の並びで書けば、一つで足ります。
条件は `pos`（品詞）、`base`（原形。`lemma` とも書けます）、`surface`（書かれたままの形）です。

```yaml
custom_rules:
  - id: suru-koto-ga-dekiru
    type: tokens
    tokens:
      - { lemma: する }
      - { surface: こと }
      - { surface: が }
      - { lemma: できる }
    name: 「することができる」は「できる」で足りる
    message: 「{matched}」は「できる」で足ります
    why: 「確認することができます」は「確認できます」と同じ意味で、語が増えるだけです。
    how_to_fix: 「〜できる」に書き換えてください。
    example:
      before: 画面で確認することができます。
      after: 画面で確認できます。
```

どう分かれるかは文によって違います。書いたら、当てたい文と当てたくない文の見本で確かめます。

## Node の関数のルール（0.19.0）

数える・比べるなど、上のどれでも書けないものは、Node の関数で書きます。
関数は文書を受け取り、指摘の一覧を返します。`chaff.yaml` には、ほかのルールと同じく名前・理由・直し方・例を書き、
`type: module` と、関数のファイルの場所（`module`）を書きます。場所は `chaff.yaml` から見た相対パスです。

```yaml
custom_rules:
  - id: team-no-tbd-dates
    type: module
    module: ./chaff-rules/no-tbd-dates.mjs
    level: warning
    name: 未定のままの日付
    why: 読み手は日付をもとに予定を立てます。
    how_to_fix: 日付を書くか、決める人と期限を書きます。
    example:
      before: 公開日は未定です。
      after: 公開日は 10 月 1 日です。
```

ファイルは、関数を `export default` します。指摘は、文書の中の位置（`start` と `end`）で返します。

```js
// chaff-rules/no-tbd-dates.mjs
export default (doc) =>
  doc.sentences.flatMap((sentence) => {
    const at = sentence.text.indexOf("未定");
    return at === -1 ? [] : [{ start: sentence.span.start + at, end: sentence.span.start + at + 2 }];
  });
```

品詞を読むルールは `requires: [pos]` を、語の一覧を読むルールは `word_list` を書きます。
関数に渡るもの、返すもの、テストの書き方、壊れたときの出力は [プラグインを作る](./writing-plugins) にあります。
`chaff.yaml` と同じフォルダより外にあるファイルは、絶対パスで書いたときだけ読みます。読み込むと、そのコードが動くためです。

## チームのルールを chaff のルールと同じ形で書く

`custom_rules` のルール（プラグインのルールも）は、chaff のルールのファイルが持つ欄も書けます。
どれも省けます。省けば、これまでのチームのルールと同じに読みます。

```yaml
custom_rules:
  - id: no-tbd
    type: words
    words: [TBD]
    name: { ja: TBD が残っている, en: TBD left in }
    why: { ja: 読み手が動けません。, en: A reader cannot act on it. }
    how_to_fix: { ja: 決めたことを書きます。, en: Write what was decided. }
    levels: { strict: error, normal: warning, relaxed: info }
    use_for: [business]
    group: slips
    summary: { ja: 決めずに残した TBD, en: A TBD nobody resolved }
    example:
      ja: { before: 期限は TBD。, after: 期限は 5 月 1 日。 }
      en: { before: Due TBD., after: Due 1 May. }
    rewrite:
      depth: light
      ja:
        direction: TBD を決めたことに置き換えます。決まっていなければ書き手に聞きます。
        pairs: [{ before: 期限は TBD。, after: 期限は［日付］。 }]
        keep: [文のほかの部分]
        avoid: [日付を作る]
```

| 欄 | 決めること | 書かなければ |
| --- | --- | --- |
| `levels` | `strict`・`normal`・`relaxed` ごとの重さ。`normal` は必須です。`level` とどちらか一つにします。チームのルールは箇所を出すので、数は書けません | `level`、それも無ければ `warning` |
| `use_for` | このルールを使うジャンル、またはその頭（`business`） | すべてのジャンル |
| `group` | chaff の分類のどこに並べるか（`slips`、`wording` など） | `team` |
| `summary` | 何を見つけるかを一行で | 名前 |
| `example` | `{ before, after }` か、言語ごとの組 | どちらかの形で必須 |
| `rewrite` | `chaff fix-plan` が直す人に渡す方向と、その深さ `depth`（[AIっぽさを直す](./ai-sounding#書き直しの深さを決める)） | `how_to_fix` |

chaff のルール、チームのルール、プラグインのルールは一か所で確かめるので、同じ間違いには同じ文が出ます。
chaff の知らない値（無い分類の `group`、どのジャンルでもない `use_for`、深さでない `depth`）は実行を止め、その値を名指しします。

## chaff 本体にルールを足す

どのチームにも役立つルールは、chaff 本体に足せます。
chaff の決まりで、ルールは機械で決まるものだけです。意味を読まないと決まらないものは、`chaff test` の側に置きます。
足すときに書くものは、次のとおりです。

| 書くもの | 場所 | 中身 |
| --- | --- | --- |
| ルールの定義 | `packages/chaff/rules/<id>.yaml` | 名前・理由・指摘の文・直し方・段階を日本語と英語で。読み手向けの `group` `summary` `example` `not_flagged` も書く。段階が数で変わるルールは `level_meaning` も。論文や規格に拠るルールは、[参考文献](./bibliography) の項目の印を `sources` に並べる。ルールのページから、その項目へリンクが張られる。書き直される箇所を指すルール（AIっぽさ、読みやすさ）は `rewrite` も書く。言語ごとに、直す方向（`direction`）、自分で書いた直す前と後の組を 2〜3 個（`pairs`）、変えてはいけないもの（`keep`）、書き直す人がやりがちな間違い（`avoid`） |
| 見つける処理 | `packages/chaff/src/detectors/` | 文書を受け取って指摘を返す関数。登録は専用のファイル `detectors/registry/<how_to_find>.ts` で、関数を `detector` という名前で出す。検出器の共有の一覧は書き換えない |
| 語の一覧 | `packages/lang-ja/lexicons/` と `packages/lang-en/lexicons/` | 語の一覧で見つけるルールだけ。言語ごとに書く |
| テスト | `test/test_<id>.ts` | 指摘すべき例と、指摘してはいけない例の両方 |
| 見本への仕込み | `test/fixtures/bench/plants/<id>.yaml` と `scripts/bench-plants/` のモジュール | きれいな見本に誤りを一つ入れて、見つかるかを測る。YAML には `planted: [ja, en]`（仕込む言語）か、仕込めない理由の `not_planted:` を書く。モジュールは仕込む誤りを `MUTATIONS` として出す。どちらも共有の一覧ではない |
| ChangeLog | `docs/ChangeLog.md` の `Unreleased` | 何が見つかるようになったか |

一度に渡した複数のファイルどうしを比べるルール（あるファイルだけ違う書き方の語など）は、別の種類の関数で書きます。
関数は、その回の文書をすべて受け取り、指摘を、それがあるファイルのパスと一緒に返します（型は `CrossDetector`）。
登録は `detectors/cross-registry/<how_to_find>.ts` で、ルールの定義には `requires: [documents]` を書きます。
chaff は、ファイルを二つ以上かフォルダを渡したときだけこのルールを動かします。一つだけのときは、その理由を添えて「動いていないルール」に並べます。
指摘はどれも自分のファイルの行と桁を指すので、stet、baseline、SARIF はほかの指摘と同じに扱います。
`example` には、`before` と `after` と同じ回に渡す三つ目のファイル `other:` を書きます。

手引きの画面に、ルールが増えるたびに変わる行は書き写しません。
画面には、動いていないルールを並べる所に `{not-run}`（一覧の下のヒントも含みます）、`--compact` が最後に出す集計の行に `{counts}` と書きます。
一覧のうち一つのルールの行だけを見せるときは `{not-run: <rule>}` と書きます。一覧はいちばん長い id に合わせて詰めるので、書き写した行はルールが増えるたびに変わります。
サイトを作るときに、chaff の出力からどれも入れます。

`yarn test` は、どの画面もその文書にかけ直し、chaff の出力と違えば止まります。
文書は、ページの `file=` の付いた塊と、`site/src/screens/<言語>/<ページ>/` のファイルです。
違いは `node scripts/guide-screens.ts --check ja/<ページ>.md` で見られます。
新しいルールが画面を変えたときは、`yarn screens:update` を走らせ、ページの差分を読みます。
画面を chaff の今の出力に書き直し、「…」の行はできるだけ元の場所に残します。
ページを指定すると、そのページだけを直します（`yarn screens:update ja/commands.md`）。
`scripts/guide-screens.ts` の `UNCHECKED` に挙げた画面はかけられないので、そのまま残します。
画面に指摘が増えたなら、ページの説明もあわせて直します。

ルールの定義に、そのルールに要る読み手向けの欄が欠けていると、`yarn test` が止まります。
`example` の `before` が指摘されないとき、`after` が指摘されるときも止まります。
リファレンスのページに、動かない例が載らないためです。

最後に、実際の文書で確かめます。

```bash
yarn test     テストをすべて動かす
yarn bench    見本に仕込んだ誤りを、ルールが見つけるかを測る
yarn corpus   集めた実際の文書にかけて、corpus/expected/ からの増減を見る
```

`yarn corpus` で増えた指摘は、一つずつ読みます。誤った指摘なら、その形を例にしてテストに足し、直します。
増えた指摘が正しいと確かめたら、`yarn corpus --update` で `corpus/expected/` を更新します。
ルールごとに 1 ファイル（`<id>.txt`、文書ごとの件数）と、文書の一覧（`_documents.txt`）に分けてあります。新しいルールは自分のファイルを足すだけで、ほかのルールの PR と同じ行を書き換えません。
見本の結果も同じで、`yarn bench --update` で `test/fixtures/bench/expected/` を更新します。ルールごとに 1 ファイル（表の行と、仕込んだ誤りの結果）なので、新しいルールはここでも自分のファイルを足すだけです。
