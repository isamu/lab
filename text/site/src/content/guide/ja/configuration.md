# 設定

`chaff.yaml` は、ジャンル・言語・ルールの強さをチームに合わせるためのファイルです。
書くのは既定から変えたものだけで、このファイルが無くても chaff は動きます。

## chaff.yaml を作る

```bash
npx chaffjs init --genre legal/contract   契約書のための chaff.yaml を作る
npx chaffjs init                          端末なら、番号の付いた一覧からジャンルを選ぶ
```

端末で `--genre` を付けずに `init` を動かすと、ジャンルを何向けかと一緒に並べ、番号か名前を尋ねます（Enter で `blog/tech`）。
スクリプトや CI では尋ねず、`blog/tech` にします。

この場所に `chaff.yaml` と `.gitignore` ができます。実際に動かすと、次のように出ます。

```
$ npx chaffjs init --genre legal/contract

作成しました:
  …/chaff.yaml  規範の宣言。commit してください
  …/.gitignore  作成しました

ジャンルは legal/contract にしました。違う場合は chaff.yaml の genre を直してください。
  一覧: npx chaff genres

次:
  npx chaff .            この場所の Markdown を全部見る
```

画面のパスは短くしてあります。作られる `chaff.yaml` の中身は次のとおりです。

```yaml
# chaff.yaml — このチームの文章規範
#
# ここに書くのは「既定から変えたもの」だけです。書かなければ既定で動きます。
# このファイルを消しても chaff は動きます。
#
# 値は 4 つの言葉から選びます。数字を書く必要はありません。
#
#   strict    きびしく見る
#   normal    ふつう（既定）
#   relaxed   ゆるく見る
#   off       見ない
#
# コマンドでも変更できます。理由がコメントとして自動で残ります。
#
#   npx chaff relax bold-density --why "図の説明で太字を多用するため"
#   npx chaff explain bold-density        そのルールの意図を読む
#   npx chaff rules --json                AI に設定を書かせるときに渡す

# この場所に置く文書の種類（契約書・利用規約・プライバシーポリシー）。ほかの種類: npx chaffjs genres
genre: legal/contract

# チームが書く固有名詞（組織名・製品名）。1 つの名前として読み、漢字の連なりに数えない。
# names:
#   - 個人情報保護委員会

# 既定から変えたものだけを書く。
rules:
```

一緒にできる `.gitignore` には `.env*` が入っています。
意味を読む検査の API key を `.env` に書いても、うっかり commit しないためです。

## ジャンルと言語を決める

ジャンルは文書の種類です。次の 3 つを決めます。

| 何を | どう |
| --- | --- |
| 動かすルール | その種類の書き方を咎めるだけのルールを止めます（契約書は定義した言葉をわざと繰り返します）。人の書いたその種類の文書の大半に出るルールも、測って止めます |
| 閾値 | 同じ `normal` でも、法令や論文の一文はメールより長くてよい |
| 文書の読み方 | `legal/statute` は法令の書き方の知識で読みます（下の「文書の種類を決める」） |

ジャンルが止めたルールは、「動いていません」の一覧にジャンルを理由に出ます。たとえば `ngram-repetition（ジャンル legal/contract では見ないため）` です。
`chaff.yaml` の `rules` はジャンルより強いので、`ngram-repetition: normal` と書けば動きます。
どのジャンルが何を変えるかは[ジャンルのページ](../../genres/)に、一覧の表は[はじめかた](./getting-started)にあります。

`genre` を書かなければ、パスと内容から自動で決まります。
`README.md`、`*-spec.md`、`docs/` は技術文書として見ます。
決めた根拠は、画面の 1 行目に出ます。

```
chaff-spec.md   technical/spec · 日本語   ジャンルはパスから
```

どれでも決まらなければ `blog/tech` として見ます。別の種類に見えるときは、画面が見当を出します（「契約書・規約のようです。--genre legal/contract を試せます」）。
見当を出しても、見るジャンルは変えません。
違うときは `genre` に書きます。

一覧は `npx chaffjs genres` で、ジャンルごとに何向けかと一緒に見られます。
一覧に無いジャンルを書くと、chaff は何も検査せずに止まり、どこに書いたジャンルかを言います。
文書の front matter の `genre:` が一覧に無いときは使わず、そう言ってから、書いていないときと同じようにジャンルを決めます。
言語も自動で決まり、`language` に `ja` か `en` を書けば固定できます。
言語の決まり方、日英の混ざった文書、どのルールがどの言語で動くかは[言語](./languages)にあります。

## 文書の種類を決める

法令のように、書き方に決まりのある文書があります。
法令は番地を`第二十二条第二項`と漢数字で書くので、これを漢字の続けすぎと数えると誤りになります。
そうした種類ごとの知識は、chaff に同梱した設定ファイル（`profiles/*.yaml`）に書いてあり、選ばれた文書にだけ効きます。
いま同梱しているのは、日本語の法令（`statute`）です。

書かなければ、ジャンルが決めます（`legal/statute` は `statute` で読みます）。
ジャンルも決めていなければ、内容から決まります。「第一条　」のように条で始まる行が 3 行以上あれば、法令として読みます。
決まった種類は、`chaff tree` の 1 行目に出ます。

```
$ npx chaffjs tree draft.txt
(doc :language "ja" :path "draft.txt" :profile "statute" :line 1
…
```

違うときは `profile` に書きます。`none` と書くと、内容からも選びません。
パスごとに変えるときは、`by_path` にも `profile` を書けます。
同梱していない種類を書くと、chaff は何も検査せずに止まり、どこに書いた種類かと、使える種類を言います。

```yaml
profile: statute
```

## 既定で動くルール

ほとんどのルールは、`chaff.yaml` に何も書かず、`--experimental` も付けずに動きます。
どれを既定で動かすかは、人が書いた実際の文書でそのルールがどれだけ指摘を出すかを測って決めています（[リファレンス](./reference)の「どのルールが既定で動くか」）。

| 印 | どう動くか |
| --- | --- |
| 既定で動く | 人の文書にめったに出ないルールです。そのまま指摘します |
| 既定で動く（情報） | 人の文書にもよく出るルールです。指摘は `info`（情報）として出て、実行を失敗にしません |
| ジャンルで止める | そのジャンルの文書の大半に出るルールです。「動いていません」の一覧に、ジャンルを理由に出ます |
| 試験中 | まだ測っていない新しいルールです。`--experimental` か `rules` に強さを書くと動きます |

情報の指摘を減らしたいときは、ゆるくするか、止めます。

```bash
npx chaffjs relax ngram-repetition --why "言い回しの繰り返しは文体として許す"
npx chaffjs off ngram-repetition --why "このチームでは見ない"
```

ジャンルが止めたルールを動かすときは、`rules` に強さを書きます（`max-sentence-length: normal`）。

## ルールの強さを変える

どんなルールがあるかは、[リファレンス](./reference) に例と一緒に並べてあります。
ルールの強さは、`rules` の下に 4 つの言葉で書きます。

```yaml
rules:
  bold-density: relaxed
```

| 値 | 意味 |
| --- | --- |
| `strict` | きびしく見る |
| `normal` | ふつう（既定） |
| `relaxed` | ゆるく見る |
| `off` | 見ない |

言葉の裏にある数字は、`explain` で見られます。

```
$ npx chaffjs explain max-sentence-length

  一文が長すぎる   (max-sentence-length)

  長い文は、読んでいるうちに主語を見失います。

  直しかた: 接続助詞のところで 2 文に割ってください。それだけで読めるようになります。

  設定できる値:
    strict   一文 70 字まで
  → normal   一文 100 字まで
    relaxed  一文 140 字まで
    off      見ない

  この数字は 既定 のものです。ほかに business/email / business/meeting-notes / business/proposal / business/press-release / blog/essay / blog/owned-media / legal / legal/statute / legal/judgment / academic で別の数字を持っています。

  いまは normal です。

  変える:  npx chaff relax max-sentence-length --why "理由"
```

同じ `normal` でも、ジャンルによって数字が違います。
数字ではなく言葉で書くのは、ジャンルに合った数字を chaff に選ばせるためです。

## 試験中のルールを 1 つだけ動かす

試験中のルールは、既定では動きません。
`rules` に名前を書くと、そのルールだけが動きます。
`--experimental` は、試験中のルールをすべて一度に動かします。

```yaml
rules:
  announced-count-mismatch: normal
```

`enable` は、`relax` と同じように、ルールの説明のコメントを付けてこの行を書きます。

```
$ npx chaffjs enable announced-count-mismatch
announced-count-mismatch を normal にしました（…/chaff.yaml）
```

検査は、動かしたルールを一度だけ言います（`試験中の rule を 1 件、設定により有効にしています: announced-count-mismatch`）。
止まっている試験中のルールの `explain` と、動いていないルールの一覧にも、同じコマンドが出ます。

## 数えるもののないルール

番号の抜けや、日付と曜日の食い違いは、あるか無いかだけです。数える上限がありません。
こうしたルールでは、4 つの言葉が指摘の重さを変えます。`relaxed` にしても指摘は消えず、一段軽く出ます。

| ルール | `strict` | `normal` | `relaxed` |
| --- | --- | --- | --- |
| `numbering-gap` `dangling-reference` `date-weekday-mismatch` `total-mismatch` | （無い） | エラー | 注意 |
| `duplicate-definition` `date-order` `doubled-word` `agreement-slip` `announced-count-mismatch` `dangling-figure-reference` `date-range-reversed` `percent-sum-mismatch` `unfilled-placeholder` | エラー | 注意 | 参考 |

エラーが 1 件でも残ると、chaff は失敗で終わります。注意と参考だけなら成功で終わります。
`explain` でも、数字の代わりに重さが出ます。

```
$ npx chaffjs explain numbering-gap --genre legal/statute
…
  設定できる値（数える上限は無く、指摘の重さが変わります）:
  → normal   エラー
    relaxed  注意
    off      見ない
…
```

見なくてよいときは `off` で止めます。
数を書いても `normal` として動くだけなので、chaff は設定を読んだときにそう言います。

## 4 つで足りないとき

手本にしたい文章が `relaxed` より長いこともあります。そのときは、上限を正の数で書けます。

```yaml
rules:
  max-sentence-length: 260
```

数で書いたルールの強さは `normal` として扱われます。
いま効いている数は、後で説明する `chaff rules --json` で確かめられます。

## チームの表記を揃える

同じものを「サーバー」とも「サーバ」とも書くと、読み手は別のものかと迷います。
使わない書き方と使う書き方の組を、`prefer` に並べます。

```yaml
prefer:
  サーバー: サーバ
```

左の書き方を見つけると、`preferred-term` が右の書き方に直すよう指摘します。
`prefer` に何も書かなければ、何も言いません。

## 社内用語と必須の見出しを決める

`jargon` と `required_sections` は、チームが中身を決めるルールです。
chaff は中身を持たず、`chaff.yaml` に書いたものだけを見ます。
何が社内用語かも、何の節が必須かも、組織ごとに違うためです。

```yaml
jargon:            # 社内でしか通じない語
  - 横展開
  - 握る

required_sections: # この種類の文書に無いと困る見出し
  - リスク
  - 費用
```

```
  1:1     error   「リスク、費用」の見出しがありません
                  required-sections
  5:1     warning 「横展開」は社内でしか通じないかもしれません（そういう語が 3 箇所）
                  internal-jargon
```

| 項目 | 当たりかた |
| --- | --- |
| `jargon` | 辞書形（`握る`）でも語幹（`巻き取`）でも書けます。活用していても当たります |
| `required_sections` | 見出しとの部分一致です。`リスク` は「リスクと対策」でも満たされます |

`required_sections` の既定の重さは `error` です。
好みの問題ではなく、チームが決めたのに守られなかったことを表すからです。

## チームの固有名詞を並べる

組織の正式名称は、漢字が長く続いても割れません。「個人情報保護委員会」を「個人情報保護の委員会」とは書けません。
辞書は正式名称を普通の名詞に割って読むので（厚生＋労働省）、chaff には名前かどうかが分かりません。
何が自分たちの名前かはチームが知っているので、`names` に並べます。

```yaml
names:
  - 個人情報保護委員会
  - 国土交通省鉄道局総務課
  - Bank of England
```

並べた名前は、書かれたとおりの綴りで当たり（大文字と小文字は区別します）、次のルールで 1 つの名前として読みます。

| ルール | 並べた名前の扱い |
| --- | --- |
| `max-kanji-continuous` | 漢字の連なりの中の名前は数えません。名前の前後に続く漢字は、それぞれ別の連なりとして数えます |
| `ngram-repetition` | 名前にかかる語句は、繰り返しに数えません。名前を何度書いても言い回しの繰り返しにはなりません |
| `undefined-acronym` | 並べた名前（`JAXA`）と、名前の中の略語（`NTT Docomo` の `NTT`）には展開を求めません |
| `proper-noun-density` | 何語に割れても、1 つの名前を 1 つの固有名詞として数えます。名前は数えるので、密度の指摘は消えません |

名前の外に続く漢字は今までどおり数えます。「個人情報保護委員会事務局総務課長補佐」なら、「事務局総務課長補佐」を測ります。
`names` は名前の並びで書きます（`2025` のような数も文字として読みます）。並びでない値や、名前として読めない項目は、実行のはじめに理由を示して読み飛ばします。

鉤括弧でまるごとくくった漢字の連なり（「英国大使館別荘記念公園」）は、`names` に書かなくても数えません。
書き手が 1 つの名前として示しているからです。括弧の中にひらがなが混ざれば、中の連なりは今までどおり数えます。

## パスごとに変える

一つの場所に、種類の違う文書が混ざることもあります。`by_path` で、パスごとに設定を変えられます。

```yaml
genre: blog/tech

by_path:
  - files: ["business-ja/**/*.md"]
    genre: business/report
  - files: ["blog-en/**/*.md"]
    language: en
  - files: ["laws/**/*.txt"]
    profile: statute
```

後に書いたものが勝ちます。照合は設定ファイルのある場所からの相対です。
どこで実行しても、結果が変わりません。

## Markdown 以外のファイルも見る

フォルダを渡すと、chaff はその中の Markdown（`.md` `.markdown` `.mdx`）を検査します。
`include` に書いたファイル名の glob に合うファイルも、あわせて検査します。`--include` を付けると、その実行だけ同じことをします。

```yaml
include:
  - "*.yaml"
  - "*.txt"
```

```bash
npx chaffjs tests/fixtures/ --include "*.yaml"
```

YAML（`.yaml` `.yml`）は、文字列の値だけを読みます。
キー、引用符、コメント、数や `true` は文章ではありません。値は 1 つずつ別に読みます。
指摘はファイルの行と桁を指すので、`custom_rules` の pattern でテストの期待値に残った `TODO:` も見つけられます。
YAML として読めないファイルは、ただのテキストとして読みます。
`.txt` のようなほかのファイルも、ただのテキストとして読みます。
コマンドラインで名前を挙げたファイルは、拡張子にかかわらず検査します。

## 設定が効いているか確かめる

いまの設定は、`chaff rules --json` で確かめます。
今の値・使える値・なぜ今 `off` なのか・変更コマンドが 1 つに入っています。
AI に設定を書かせるときは、この出力を渡します。

```bash
npx chaffjs rules --json         いまの設定を JSON で出す
```

出力は長いので、ここでは `max-sentence-length: 260` と書いたときの 1 件を抜き出します。

```json
{
  "id": "max-sentence-length",
  "layer": "L1",
  "status": "stable",
  "name": {
    "ja": "一文が長すぎる",
    "en": "Sentence too long"
  },
  "why": {
    "ja": "長い文は、読んでいるうちに主語を見失います。",
    "en": "In a long sentence the reader loses the subject before reaching the verb."
  },
  "how_to_fix": {
    "ja": "接続助詞のところで 2 文に割ってください。それだけで読めるようになります。",
    "en": "Split it in two at the conjunction."
  },
  "use_for": [
    "blog",
    "business",
    "technical",
    "legal",
    "docs",
    "academic",
    "literature",
    "speech"
  ],
  "level_sets": "limit",
  "levels": {
    "strict": 70,
    "normal": 100,
    "relaxed": 140
  },
  "levels_you_can_set": [
    "strict",
    "normal",
    "relaxed",
    "off"
  ],
  "your_setting": {
    "level": "normal",
    "limit": 260,
    "from": "…/chaff.yaml"
  },
  "now": {
    "level": "normal",
    "limit": 260,
    "set_as": "number"
  }
}
```

`now` が、いま実際に効いている値です。
`level_sets` は、段階が何を変えるかです。`limit` は数える上限、`severity` は指摘の重さです。
数えるもののないルールでは、`levels` と `now` に数の代わりに重さ（`error` / `warning` / `info`）が出ます。
試験中のルール（まだ測っていない新しいルール）なら、`now` に動いていない理由と、そのルールだけを動かすコマンドが出ます。

```json
  "now": {
    "level": "off",
    "why_off": "experimental な rule は既定で動かさない",
    "turn_on_with": "npx chaffjs enable <rule>"
  }
```

書き間違いは、画面にも出ます。
知らないルール名（たいていは綴り違い）と読めない値は、検査と `rules --json` が stderr に警告します。
黙って捨てると、効いていない設定を効いていると思い込むためです。

```yaml
rules:
  max-sentense-length: strict
  bold-density: loose
```

<!-- chaff-screen: typo -->
```
$ npx chaffjs article.md
chaff: …/chaff.yaml: max-sentense-length というルールはありません（npx chaff rules --json で一覧が出ます）
chaff: …/chaff.yaml: bold-density の値 "loose" は読めません（strict / normal / relaxed / off か、正の数）
…
```

警告が出たら、`chaff.yaml` の綴りと値を直します。
