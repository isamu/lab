# AI の評価（AI evals）に使う

chaff は、model の出力の採点役として、model による採点の横に置けます。
同じ出力にはいつも同じ結果を返し、一つ一つの指摘が行とルールを指し、どこにも何も送りません。
意味は読みません。答えが正しいかどうかは、これまでどおり model の採点か人が決めます。
このページでは、そのやり方を手順と実際の出力で示します。
扱うのは順に、出力をまとめた採点、基準の書き方、2 つの回の比べ方、関数からの呼び出し、評価基盤へのつなぎ方です。

## 出力の何を確かめられるか

| 確かめたいこと | コマンド | 終了コード 1 になるとき |
| --- | --- | --- |
| 要約や書き換えで事実が落ちたか、作られたか | `npx chaffjs compare <元> <出力> --json` | 数・日付・URL・名前・引用などが落ちたか、足された |
| RAG の回答の引用が、本当に原文にあるか | `npx chaffjs cite <原文> <引用.json> --format json` | 引用がその番地に無い |
| 回答が自分と矛盾していないか | `npx chaffjs <出力>` | 合計が内訳の和と合わない、日付と曜日が合わない |
| 生成文らしい形や、読みにくさ | `npx chaffjs <出力> --sarif <path>` | `error` の指摘だけ。ほかは数として数えます |
| 上のすべてを、たくさんの出力に | `npx chaffjs grade <items.jsonl> --out <results.jsonl>` | 落ちた出力がある（入力が読めなければ 2） |
| 作り直しの段で何を直させるか | `npx chaffjs fix-plan <出力> --json` | なりません。直す指示を出すだけです |

たくさんの出力には、下の `chaff grade` を使います。ふつうの検査には `--json` が無いので、指摘は SARIF で読みます（「指摘を SARIF で受け取る」）。

## 始める前に

Node.js 24 以上が要ります。`npx chaffjs` は、初めて使うときに chaff を取ってきます。
何度も回す評価では、`chaffjs` をプロジェクトの開発用の依存に入れておきます。
どの回も同じ版で動き、同じ出力には同じ結果が返るためです。
実行する場所に `chaff.yaml` があれば、どの検査にも効きます（[設定](./configuration)）。

## `chaff grade` で初めての評価を回す

1. **出力を JSONL に並べます。** 1 行に 1 つの出力です。`id` と `output` は必須です。
   出力の元になった文書と事実を照らすときは `reference` を足します。
   引用を確かめるときは、`sources`（原文の名前と本文）と `citations` を足します。
   原文が一つなら、引用の `source` は省けます。

   ```json
   {
     "id": "refund",
     "output": "商品が届いた日から 30 日以内なら返金を求められ、送料も戻ります（第2条第2項）。",
     "sources": { "policy": "# 返金の決まり\n\n第1条（対象）\n…" },
     "citations": [
       { "address": "2.1", "quote": "商品が届いた日から 30 日以内" },
       { "address": "2.2", "quote": "送料も全額を返金する。" }
     ]
   }
   ```

   回答のどの文が引用なのかを、chaff は推測しません。引用は、回答と一緒に返すよう model に頼みます。
   `language` と `genre` は出力ごとに書けます。書かなければ、ふつうのファイルと同じに決まります。

2. **ファイルを採点します。** `prompt-a.jsonl` と `prompt-b.jsonl` は、同じ 3 つの題に 2 つの prompt で答えさせた出力です。中身は下の例 1〜3 にあります。
   `--out` は出力ごとの結果を書き出し、画面には要約が出ます。

   ```
   $ npx chaffjs grade prompt-b.jsonl --out b.results.jsonl
   出力ごとの結果を書きました: b.results.jsonl（3 行）
   prompt-b.jsonl: 3 件の出力、1 件が通り、2 件が落ちた

   落ちた出力
     ✗ q3: facts.dropped 3 > 0, facts.added 1 > 0
     ✗ refund: citations.failed 1 > 0

   ルールごとの率（1,000 字あたり、指摘のあった出力の数）
     ai-generated-composite  3.0  1 件
     ai-tell                 3.0  1 件
     closing-cliche          6.0  1 件
     padded-intro            3.0  1 件

   事実: 落ちた 3（date 1, number 2）、足された 1（date 1）
   引用: 2 件を照らし、1 件が外れた
   AI らしさ: 低 0、中 0、高 0、測っていない 3（書いたのが AI かどうかの判定ではありません。合否には入りません）

   …
     {not-run: cite}
   …
     {not-run: compare}
   …
   ```

3. **結果を読みます。** 次のどれかがあれば、その出力は落ちます。
   - `error` の指摘
   - `reference` に対して落ちた事実、足された事実
   - 原文に見つからない引用

   形の指摘で落ちることはありません。1,000 字あたり（英語なら 1,000 語あたり）の率として、prompt や model を比べるのに使います。
   「動かなかったもの」は、何を確かめていないかとその理由です。指摘 0 件を「確かめて問題なし」と読ませないためです。
   `--compact` は 1 出力 1 行で、CI のログ向けです。`--json` は要約を JSON で出します。

   ```
   $ npx chaffjs grade prompt-b.jsonl --compact
   q3	fail	facts.dropped 3 > 0, facts.added 1 > 0
   refund	fail	citations.failed 1 > 0
   deploy	pass
   prompt-b.jsonl: 3 件の出力、1 件が通り、2 件が落ちた
   ```

4. **終了コードを使います。** すべて通れば 0、落ちた出力があれば 1 です。
   入力か `chaff.yaml` が読めなければ 2 です。JSON でない行、`id` の欠けや重なり、知らない言語などがこれに当たります。
   CI の門は、2 を見れば「出力が悪い」のではなく「採点が動いていない」と分かります。

`b.results.jsonl` の 1 行には、1 つの出力の指摘、率、動かなかったルール、事実、引用が入ります。
合否とその理由、再現の印も入ります。1 行目の始めはこうです。

```json
{"id":"q3","language":"ja","genre":"blog/tech","size":{"unit":"char","value":73},"findings":[],"rates":{},"notRun":[…],
 "facts":{"dropped":[{"kind":"number","key":"6 時間","text":"6 時間","line":4,"allowed":false},…],"added":[…],"reformed":1},
 "citations":null,"aiScore":{"level":null,"notScored":"too-short","signs":0,"compared":22,"shown":[]},
 "pass":false,"failedBecause":["facts.dropped 3 > 0","facts.added 1 > 0"],"stamp":{…}}
```

`aiScore` は AI らしさの簡易判定です（[AIっぽさを直す](./ai-sounding#ai-らしさを簡易判定する)）。
`level` は `low`・`medium`・`high` のどれかで、測らなかったときは `null` にし、`notScored` に理由（`too-short` か `no-baseline`）を入れます。
`signs` は数えた目印の数、`compared` は人の文書と比べた項目の数、`shown` は数えた目印です。
この例の回答は短いので測っていません。書いたのが AI かどうかの判定ではなく、合否にも入りません。
要約には段階ごとの出力の数が、variant の表には「AI らしさ 低/中/高」の行が出ます。prompt や model で生成文の形がどれだけ増えたかを比べるのに使います。

再現の印（`stamp`）には、chaff の版と、ルールのハッシュと、設定のハッシュが入ります。ハッシュが 2 つとも同じ回どうしなら比べられます。

## 採点の基準を chaff.yaml に書く

`chaff.yaml` に `grade:` を書くと、書いたものだけで合否を決め、出力ごとに減点を数えます。

```yaml
grade:
  rules:
    total-mismatch: { max: 0 } # 1 件でもあれば落とす
    closing-cliche: { max: 0, weight: 3 } # 落とし、1 件 3 点
    ai-tell: { max_rate: 5, weight: 2 } # 1,000 字（英語は語）あたり 5 件を超えたら落とす
  facts: { dropped: 0, added: 0, allow_dropped: [heading] }
  citations: { failed: 0, required: true } # required: sources があって citations が無い出力を落とす
  penalty: 10 # 点の和がこれを超えたら落とす
```

<!-- chaff-screen: rubric -->
```
$ npx chaffjs grade prompt-b.jsonl --compact
q3	fail	penalty 0	facts.dropped 3 > 0, facts.added 1 > 0
refund	fail	penalty 0	citations.failed 1 > 0
deploy	fail	penalty 8	rules.closing-cliche 2 > 0
prompt-b.jsonl: 3 件の出力、0 件が通り、3 件が落ちた
```

点は減点の和で、満点からの点数ではありません。一点ごとに、どの指摘から来たかが分かります（`deploy` の結果の行）。

```json
"score": { "penalty": 8, "items": [
  { "points": 2, "rule": "ai-tell", "line": 3 },
  { "points": 3, "rule": "closing-cliche", "line": 12 },
  { "points": 3, "rule": "closing-cliche", "line": 12 } ] }
```

`grade:` が無ければ点は出ません。`grade:` に読めない値があれば、場所を示して終了コード 2 で止まります。
chaff の知らないルールの名前は、そう言ったうえで「動かなかったもの」に並べます。
`max_rate` の単位は出力の言語で決まります。上の例では、英語の出力は 1,000 語あたり、日本語の出力は 1,000 字あたりの 5 件です。

## 2 つの回を比べる（`--baseline`）

前の prompt の出力を `--out` 付きで採点し、新しい prompt の出力をそれと比べます。組は `id` で作ります。

```
$ npx chaffjs grade prompt-a.jsonl --out a.results.jsonl
$ npx chaffjs grade prompt-b.jsonl --baseline a.results.jsonl
…上と同じ要約…

a.results.jsonl と比べた: 3 件の出力が組になった

ルールごとの率（1,000 字あたり、前 → 後）
  ai-generated-composite  0.0 → 3.0  (+3.0)  増えた: deploy
  ai-tell                 0.0 → 3.0  (+3.0)  増えた: deploy
  closing-cliche          0.0 → 6.0  (+6.0)  増えた: deploy
  padded-intro            0.0 → 3.0  (+3.0)  増えた: deploy

新しく落ちた: q3, refund
新しく通った: なし

新しく落ちた・足された事実と、新しく外れた引用
  q3: 落ちた number 6 時間, number 2.5 時間, date 2026年7月14日、足された date 2026年7月1日
  refund: 落ちた なし、足された なし、外れた引用 policy 2.2

回帰 2 件
  ✗ q3: passed, now fails
  ✗ refund: passed, now fails
```

回帰とは、次のどれかです。
- 前は通った出力が落ちた
- `grade.rules` に書いたルールの指摘が、どれかの出力で増えた
- 点の和が増えた

`--baseline` を付けると、回帰があれば終了コード 1、無ければ 0 です。prompt や model の変更を CI で止められます。
`grade.rules` に無いルールの増減は表に出しますが、回帰には数えません。

2 つの回は、ルールと設定が同じでなければなりません。違えば比べずに止まります。設定の違いを model の違いと読ませないためです。

```
$ npx chaffjs grade prompt-b.jsonl --baseline a.results.jsonl
a.results.jsonl とは比べません: 設定が違います。ルールか設定が変わった差を、prompt や model の差として読まないため（--allow-stamp-mismatch で比べる）
```

終了コード 2 で終わります。前の回のあとで `chaff.yaml` の `rules:` を書き換えたので、設定が違います。

## prompt や model を並べて比べる（variant）

`--baseline` は、前の回と今回を比べます。同じ回の中で複数の prompt や model を比べるときは、すべての出力を 1 つのファイルに入れ、行ごとにどの variant かを書きます。
同じ題の行には同じ `id` を付けます。variant の名前は `variant` の欄に書くか、`--variant-key` で別の欄を指します。

```json
{"id": "q3", "prompt": "prompt-a", "output": "# 要点\n\n問い合わせ 4,812 件に答え、最初の返信までの時間の中央値は 6 時間から 2.5 時間に縮みました。\n…", "reference": "# サポート窓口の四半期報告\n…"}
{"id": "q3", "prompt": "prompt-b", "output": "# 要点\n\n問い合わせ 4,812 件に答え、最初の返信は大幅に速くなりました。\n…", "reference": "# サポート窓口の四半期報告\n…"}
```

`prompts-ja.jsonl` は、例 1〜3 の 3 つの題に 2 つの prompt で答えさせた出力です。どの行も `prompt` の欄に名前があります。
`prompt-a` の返金の回答は、2 つめの引用を条文どおり「送料は返金しない。」と書いています。
いつもの要約のあとに、variant を並べた表が出ます。

```
$ npx chaffjs grade prompts-ja.jsonl --variant-key prompt
prompts-ja.jsonl: 6 件の出力、4 件が通り、2 件が落ちた

落ちた出力
  ✗ q3 (prompt-b): facts.dropped 3 > 0, facts.added 1 > 0
  ✗ refund (prompt-b): citations.failed 1 > 0
…

2 つの variant を並べた: どの variant にもある id の出力 3 件
                      prompt-a     prompt-b
  通った              3/3（100%）  1/3（33.3%）
  落ちた事実          0            3
  足された事実        0            1
  外れた引用          0/2          1/2
  AI らしさ 低/中/高  0/0/0（3）   0/0/0（3）

ルールごとの率（1,000 字あたり）
                          prompt-a  prompt-b
  ai-generated-composite  0.0       3.0
  ai-tell                 0.0       3.0
  closing-cliche          0.0       6.0
  padded-intro            0.0       3.0

合否が分かれた出力 2 件
  ✗ q3: 通った prompt-a、落ちた prompt-b（facts.dropped 3 > 0, facts.added 1 > 0）
  ✗ refund: 通った prompt-a、落ちた prompt-b（citations.failed 1 > 0）
```

読み方:
- どの列も同じ題を数えます。比べるのは、すべての variant にあり、言語とジャンルが同じ `id` だけです。それ以外の `id` は「比べなかった id」に、無かった variant と並びます。
- 「外れた引用」は、照らした数のうち外れた数です。事実は要約と同じに数え、`grade:` で許した種類は数えません。
- 出力に `contexts` があれば、「一節に無い事実」の行が足されます。照らした事実のうち、検索で取ったどの一節にも無かった数です。
- `chaff.yaml` に `grade:` があれば、「減点の和」の行が足されます。
- 「AI らしさ 低/中/高」は、段階ごとの出力の数で、かっこの中は測らなかった出力の数です。
- 通った割合は出力の割合で、点ではありません。満点のある点は、ここでも出しません。

`--variant-key` を渡すと、どの行にもその欄が要ります。`variant` の欄を使うときも、一行にでもあれば全行に要ります。
名前の無い行や、同じ variant に同じ `id` が二度ある行があれば、終了コード 2 で止まります。
終了コードはほかは variant が無いときと同じです。`--baseline` は、前の回の同じ `id` と同じ variant を組にします。

CI のログには、`--compact` が合否の分かれた題を 1 行ずつ足します。

```
$ npx chaffjs grade prompts-ja.jsonl --variant-key prompt --compact
…
disagree	q3	pass prompt-a	fail prompt-b
disagree	refund	pass prompt-a	fail prompt-b
合否が分かれた出力 2 件
```

PR のコメントには、`--format markdown` が同じ表を Markdown で書きます。`--format json` は要約に `variants` の欄を足します。

```
$ npx chaffjs grade prompts-ja.jsonl --variant-key prompt --format markdown
## chaff grade: prompts-ja.jsonl

6 件の出力、4 件が通り、2 件が落ちた
…
### 2 つの variant を並べた: どの variant にもある id の出力 3 件

|  | prompt-a | prompt-b |
| --- | --- | --- |
| 通った | 3/3（100%） | 1/3（33.3%） |
| 落ちた事実 | 0 | 3 |
| 足された事実 | 0 | 1 |
| 外れた引用 | 0/2 | 1/2 |
…
```

評価の仕組みの中からは、`grade()` に `variant` を渡し、結果を `compareVariants()` に渡します。返るのは、`--format json` が `variants` に入れるものと同じです。

```js
import { compareVariants, grade } from "chaffjs/grade";

const results = [
  await grade(answerA, { id: "q3", variant: "prompt-a", reference }),
  await grade(answerB, { id: "q3", variant: "prompt-b", reference }),
];
const { columns, disagreements } = compareVariants(results);
console.log(columns.map((column) => `${column.variant} ${column.passed}/${column.outputs}`)); // [ 'prompt-a 1/1', 'prompt-b 0/1' ]
```

`compareVariants({ "prompt-a": resultsA, "prompt-b": resultsB })` のように、variant ごとに分けた結果も渡せます。

## 例 1: 要約は元の事実を守っているか

元の文書（`source.md`）は、短いサポートの報告です。2 つの model に要約させました。

```markdown file=source.md
# サポート窓口の四半期報告

今期、サポート窓口は 4,812 件の問い合わせに答えました。
最初の返信までの時間の中央値は、6 時間から 2.5 時間に縮みました。
新しいヘルプセンターは 2026年7月14日に公開しました。
8月に 2 人が加わり、窓口は 11 人になりました。
```

model A の要約（`model-a.md`）は、数をすべて残しました。
model B の要約（`model-b.md`）は、返信の時間を落とし、日付を違えて書きました。

```markdown file=model-b.md
# 要点

問い合わせ 4,812 件に答え、最初の返信は大幅に速くなりました。
ヘルプセンターを 2026年7月1日に公開し、8月に 2 人が加わって 11 人の体制です。
```

`compare` は、2 つの文書から同じ読み方で事実を取り出し、無くなったものと増えたものを並べます。

```
$ npx chaffjs compare source.md model-a.md
source.md → model-a.md

i 書き方だけ変わった事実 1 件
  見出し: サポート窓口の四半期報告 → 要点  (1 行目 → 1 行目)

照合した事実 8 件 → 8 件: 数 6→6、日付 1→1、時刻 0→0、URL 0→0、コード 0→0、固有名詞 0→0、引用 0→0、見出し 1→1、条項の参照 0→0、脚注 0→0
落ちた事実も足された事実もありません
```

```
$ npx chaffjs compare source.md model-b.md
source.md → model-b.md

✗ 落ちた事実 3 件（source.md にあって model-b.md に無い）
  数: 6 時間  (source.md:4)
  数: 2.5 時間  (source.md:4)
  日付: 2026年7月14日  (source.md:5)

✗ 足された事実 1 件（model-b.md にだけある）
  日付: 2026年7月1日  (model-b.md:4)

i 書き方だけ変わった事実 1 件
  見出し: サポート窓口の四半期報告 → 要点  (1 行目 → 1 行目)

照合した事実 8 件 → 6 件: 数 6→4、日付 1→1、時刻 0→0、URL 0→0、コード 0→0、固有名詞 0→0、引用 0→0、見出し 1→1、条項の参照 0→0、脚注 0→0
落ちた事実 3 件、足された事実 1 件
```

1 つめは終了コード 0、2 つめは 1 で終わります。`--json` を付けると、事実ごとに種類・文字・行が付きます。
要約では、ある種類の事実をわざと省くことがあります。`--allow-dropped name,url` で、その種類は落ちても失敗にしません。
詳しくは [コマンド](./commands) の `compare` にあります。

## 例 2: RAG の回答の引用は原文にあるか

原文（`policy.md`）は、条と項のある返金の決まりです。

```markdown file=policy.md
# 返金の決まり

第1条（対象）
この決まりは、ウェブストアで受けた注文に適用する。

第2条（返金）
お客様は、商品が届いた日から 30 日以内に返金を求めることができる。
２　送料は返金しない。
３　返金は、注文に使ったカードに 10 営業日以内に行う。
```

回答は 2 か所を引きました。引用は、回答と一緒に JSON で返すよう model に頼みます（`quotes.json`）。
回答のどの文が引用なのかを、chaff は推測しません。

```json file=quotes.json
[
  { "address": "2.1", "quote": "商品が届いた日から 30 日以内" },
  { "address": "2.2", "quote": "送料も全額を返金する。" }
]
```

```
$ npx chaffjs cite policy.md quotes.json
✓ 2.1「商品が届いた日から 30 日以内」: 一致
✗ 2.2「送料も全額を返金する。」: 引用文が原文のどこにもありません
```

終了コード 1 で終わります。`--format json` なら、引用ごとに `status`（一致は `ok`）と見つかった行が付きます。
空白や全角・半角の違いは問いませんが、言葉が一つ違えば外れます。番地の読み方は [構造と引用](./structure) にあります。

## RAG の回答は、検索で取った一節に拠っているか（`contexts`）

`citations` は、回答が示した引用を照らします。回答が引用を示さないことも多く、手元にあるのは検索が model に渡した一節だけ、ということがあります。
その一節を `contexts` に入れると、chaff は回答の事実を一節の中に探します。照らすのは数・日付・時刻・URL・コード・固有名詞・引用です。
事実は `compare` と同じ読み方で取り出すので、1,200 円と１,２００円のように書き方が違っても同じ事実です。
引用（「」の中）は、どれかの一節に一字一句あるときだけ支えられたとします。

`rag-ja.jsonl` は、同じ 2 つの一節を渡して答えさせた 2 つの回答です。

```json
{"id": "料金", "output": "チームプランは 1 人あたり月 1,200 円で、100 GB の保存領域が付きます。サポートは 4 営業時間以内に返信します。", "contexts": ["# 料金\n\nチームプランは 1 人あたり月 1,200 円で、年払いです。\n1 人あたり 100 GB の保存領域が付きます。", "# サポート\n\nチームプランのサポートは 4 営業時間以内に返信します。\nヘルプセンターは 2026年3月3日に移りました。"]}
{"id": "料金-誤り", "output": "チームプランは 1 人あたり月 1,500 円で、100 GB の保存領域が付きます。資料には「サポートは 1 時間以内に返信します」とあります。多くのチームに向いています。", "contexts": ["…同じ 2 つの一節…"]}
```

```
$ npx chaffjs grade rag-ja.jsonl --out rag-ja.results.jsonl
出力ごとの結果を書きました: rag-ja.results.jsonl（2 行）
rag-ja.jsonl: 2 件の出力、1 件が通り、1 件が落ちた

落ちた出力
  ✗ 料金-誤り: contexts.unsupported 3 > 0

事実: 落ちた 0、足された 0
引用: 0 件を照らし、0 件が外れた
contexts: 2 件の出力の事実 11 件を照らし、3 件がどの一節にも無かった（number 2, quote 1）
…
  {not-run: contexts}
…
```

`料金-誤り` の結果の行には、どの事実がどの一節（0 から数える）にあり、どれが無かったかが入ります。

```json
"contexts": {"passages":2,"checked":6,
 "supported":[{"kind":"number","text":"1 人","line":1,"passage":0},{"kind":"number","text":"100","line":1,"passage":0},{"kind":"name","text":"GB","line":1,"passage":0}],
 "unsupported":[{"kind":"number","key":"1500 円","text":"1,500 円","line":1,"allowed":false},
                {"kind":"number","key":"1 時間","text":"1 時間","line":1,"allowed":false},
                {"kind":"quote","key":"サポートは 1 時間以内に返信します","text":"「サポートは 1 時間以内に返信します」","line":1,"allowed":false}],
 "uncheckedSentences":1}
```

- 1,500 円と 1 時間はどの一節にも無く、引用は一字一句の形でどの一節にもありません。`grade:` が無ければ、一つでもあれば落ちます。
- `contexts` を空の配列 `[]` にすると「一節が取れなかった」で、照らした事実はすべて一節に無いことになります。`contexts` を書かないのとは違います。書かなければ照合は動かず、「動かなかったもの」にそう出ます。
- 「多くのチームに向いています。」には、chaff が照らせる事実がありません。`uncheckedSentences` に数え、「動かなかったもの」に `contexts` として出します。一節に支えられているかは、読まないと分かりません。
- 数が一節にあることは、主張が正しいことではありません。一節の数を別の物の数として書いた回答も、この照合は通ります。意味の照合は model か人に任せます。

採点の基準では、`contexts` に上限を書きます。

```yaml
grade:
  contexts:
    unsupported: 0 # どの一節にも無くてよい事実の数
    allow_unsupported: [name] # 数えない種類
    required: true # contexts の無い出力を落とす
```

`grade()` にも `contexts` で一節を渡せます: `await grade(answer, { contexts: passages })`。

## 例 3: 2 つの prompt を文章の形で比べる

同じ題「火曜日のデプロイが止まった理由を説明して」に、2 つの prompt で答えさせました。prompt A の答え（`prompt-a.md`）です。

```markdown file=prompt-a.md
# デプロイが止まった理由

火曜日のデプロイは、データベースの段で止まりました。
移行で既定値つきの列を足したため、いちばん大きな表への書き込みが 4 分止まりました。
ヘルスチェックは 2 分で打ち切られ、リリースは元に戻りました。
次は既定値なしで列を足し、値はあとから少しずつ入れます。
```

prompt B の答え（`prompt-b.md`）です。

```markdown file=prompt-b.md
# デプロイが止まった理由

近年、ソフトウェアの世界でデプロイは重要な役割を果たすと言えるでしょう。
本記事では、火曜日に何が起きたのかを深く掘り下げます。

**原因はコードではありません。データベースです。**
移行で既定値つきの列を足したため、いちばん大きな表への書き込みが 4 分止まりました。
ヘルスチェックは 2 分で打ち切られ、リリースは元に戻りました。

次は既定値なしで列を足し、値はあとから少しずつ入れます。地味に効く改善です。

いかがでしたか？参考になれば幸いです。
```

生成文の特徴を見るルールも、設定を書かなくても動きます。

```
$ npx chaffjs prompt-a.md --compact

prompt-a.md   blog/tech · 日本語   ジャンルは既定から


{counts}
```

```
$ npx chaffjs prompt-b.md --compact

prompt-b.md   blog/tech · 日本語   ジャンルは既定から

  3:1     info    「重要な役割を果たす、と言えるでしょう、深く掘り下げる、本記事では、地味に効く」が揃っています（点 29、18 まで）
                  ai-tell
  3:1     warning 「近年」は、どの記事にも当てはまる書き出しです
                  padded-intro
  3:1     warning 「ai-tell、padded-intro、closing-cliche」が同じ文書にそろっています（3 種、3 種から）
                  ai-generated-composite
  12:1    warning 「いかがでしたか」で締めています
                  closing-cliche
  12:9    warning 「参考になれば幸いです」で締めています
                  closing-cliche

{counts}
```

たくさんの題で比べるときは、一つの出力ではなく率を比べます。`chaff grade` がルールごとの率を出し、`--baseline` が 2 つの回を並べます。
動いていないのは、英語だけのルール、ジャンル blog/tech では見ないルール、表題より下の見出しが要るルール 1 件、意味を読むルール 1 件です。`--compact` を外すと、理由と一緒に並びます。

指摘を作り直しの段に戻すときは、`fix-plan` で直す指示にします。
次は抜粋です。この後に、ルールごとの直す方向、例、見つけた箇所が続きます。

````
$ npx chaffjs fix-plan prompt-b.md
# 直す計画: prompt-b.md

言語 ja、ジャンル blog/tech

chaff が機械で見つけた箇所と、それぞれの直す方向です。chaff は書き直しません。書き直すのは、この計画を読む人か AI です。直したら、最後の確かめのコマンドを実行してください。

## 守ること

1. 事実、数、日付、条件、名前を変えない。
2. 元の文書に無い事実、人、数、原因、例を足さない。
3. 直すのに文書に無い具体（誰が、いつ、どれだけ）が要るときは、作らずに［ ］で空けて書き手に聞く。
4. 書き直しは 2 回まで。指摘を消すためだけに書き直しを繰り返さない。

## 勧める直し方: 全面書き直し（Full）

ai-generated-composite が出ています。文の言い回しを直しても、生成文の骨組みが残ります。
…
## 直したあとの確かめ

書き直したものを prompt-b.rewritten.md に保存して、次を実行します。

```bash
npx chaffjs prompt-b.rewritten.md
npx chaffjs compare prompt-b.md prompt-b.rewritten.md --distinct --allow-dropped heading --allow-added heading
npx chaffjs outline prompt-b.md prompt-b.rewritten.md
```
…
````

`--json` を付けると同じ計画を JSON で出すので、次の prompt に入れられます。
最後の確かめの `compare` で、作り直した文章が事実を守ったかを確かめます。
計画から書き直す手順は [AIっぽさを直す](./ai-sounding) にあります。

## 例 4: 自分と矛盾する回答

model が書いた見積もり（`answer.md`）です。合計が内訳の和と合わず、日付と曜日も合っていません。

```markdown file=answer.md
# お見積もり

| 項目 | 金額 |
| --- | --- |
| 設計 | 40,000円 |
| 開発 | 120,000円 |
| 合計 | 150,000円 |

作業は 2026年10月6日（月）に始められます。
```

```
$ npx chaffjs answer.md --compact

answer.md   blog/tech · 日本語   ジャンルは既定から

  7:8     error   合計「150,000円」が、上の金額の和（160,000円）と合いません
                  total-mismatch
  9:5     error   「2026-10-06」は火曜日です（月曜日と書いてあります）
                  date-weekday-mismatch

{counts}
```

どちらも `error` なので終了コード 1 で終わり、`chaff grade` もこの出力を落とします。

## 指摘を SARIF で受け取る

`--sarif` は、かけたファイルすべての指摘を 1 つの SARIF ファイルに書きます。画面の出力は変わりません。

```
$ npx chaffjs prompt-b.md --compact --sarif out/prompt-b.sarif
  SARIF を書きました: out/prompt-b.sarif（5 件）

prompt-b.md   blog/tech · 日本語   ジャンルは既定から

  3:1     info    「重要な役割を果たす、と言えるでしょう、深く掘り下げる、本記事では、地味に効く」が揃っています（点 29、18 まで）
                  ai-tell
…
```

指摘は `runs[0].results` に 1 件ずつ入り、ルール・重さ・場所が付きます。次はその 1 件目です。

```json
{
  "ruleId": "chaff/ai-tell",
  "level": "note",
  "message": {
    "text": "「重要な役割を果たす、と言えるでしょう、深く掘り下げる、本記事では、地味に効く」が揃っています（点 29、18 まで）"
  },
  "locations": [
    {
      "physicalLocation": {
        "artifactLocation": {
          "uri": "prompt-b.md"
        },
        "region": {
          "startLine": 3,
          "startColumn": 1
        }
      }
    }
  ]
}
```

重さは `error`、`warning`、`note`（chaff の `info`）です。同じファイルで PR の行に指摘を出せます（[CI](./ci)）。

## 評価の仕組みの中から呼ぶ（`grade()` と採点役の形）

`chaffjs/grade` は 1 つの出力をその場で採点し、`--out` の 1 行と同じ結果を返します。
`chaff.yaml` を読むのは `config` で名指したときだけで、ファイルに書くことはありません。

```js
import { grade, toScorer } from "chaffjs/grade";

const result = await grade(output, { id: "q3", reference, config: "chaff.yaml" });
console.log(result.pass, result.failedBecause); // false [ 'facts.dropped 2 > 0' ]

const scored = toScorer(result);
console.log(scored.score, scored.reason); // 0 failed: facts.dropped 2 > 0 — no findings
```

`toScorer()` は、多くの評価基盤が受け取る形に直します。
- `name`
- `score`: 通れば 1、落ちれば 0
- `pass`
- `reason`: 落ちた条件、ルールごとの指摘、点の和の順
- `metadata`: 結果のすべて

chaff は満点を持たないので、点の和を 0〜1 に写すことはしません。段階のある数が欲しい評価基盤は、`metadata.score.penalty` を読んで自分で写します。
`chaff grade` が終了コード 2 で断る入力では、`GradeInputError` を投げます。

## 評価基盤への組み込み

どの例も `grade()` か `chaff grade` を呼ぶだけで、chaff の中に基盤ごとの処理は持ちません。
例は [`examples/evals`](https://github.com/isamu/lab/tree/main/text/examples/evals) にあります。
基盤は自分のプロジェクトに入れてください。chaff の依存にはなりません。

| 基盤 | 例 | つなぎ方 |
| --- | --- | --- |
| promptfoo | `promptfoo/chaff-assertion.cjs` | `javascript` の assertion が `pass`・`score`・`reason` を返す |
| autoevals、Braintrust | `autoevals/chaff-scorer.mjs` | 採点の関数 `({ output, expected }) => { name, score, metadata }` |
| evalite | `evalite/chaff.eval.ts` | `createScorer` で作る採点役 |
| Langfuse | `langfuse/push-score.mjs` | trace に `langfuse.score.create()` で点を付ける |
| DeepEval | `deepeval/chaff_metric.py` | CLI を呼ぶ `BaseMetric` |
| Ragas | `ragas/chaff_with_faithfulness.py` | `Faithfulness` の横に chaff の事実の照合を置く |
| Inspect AI | `inspect/chaff_scorer.py` | CLI を呼ぶ `@scorer` |
| OpenAI Evals | `openai-evals/` | `samples.jsonl`（`input`・`ideal`）と生成した出力を、`chaff grade` の入力に変える |
| GitHub Actions | `README.md` | workflow の一段で `chaff grade --baseline` を走らせる |

promptfoo の assertion、autoevals の採点役、OpenAI Evals の変換は、このリポジトリで試験しています。
どの試験も、通信も API key も使いません。

```yaml
# promptfooconfig.yaml
tests:
  - vars:
      reference: "The team answered 4,812 tickets this quarter."
    assert:
      - type: javascript
        value: file://chaff-assertion.cjs
```

## 評価の中での chaff の持ち場

model による採点は意味を読みます。答えが正しいか、問いに合っているか、元の文書に忠実かを見ます。
ただ、同じ出力でも回ごとに点が揺れることがあり、理由は文章で返ります。
chaff は同じ出力にいつも同じ結果を返し、落ちた理由はすべて行とルールを指します。
答えるのは、機械で決まることだけです。
- 元の文書の事実を守っているか
- 引用が本当に原文にあるか
- 合計と曜日が合っているか
- チームの決まりを守っているか、形の指摘がどれだけあるか

model の採点や人の目の代わりにではなく、その横に置いて使います。

## ここで chaff がしないこと

- **model で採点しません。** 採点は決まった結果を返します。model に聞く `chaff test` は別のコマンドのままで、採点からは呼びません。
- **出力を書き換えません。** `fix-plan` は指示を出すだけで、書き直すのは作り直しの段です。
- **「AI が書いた」とは言いません。** `ai-generated-composite` は数えるための目印で、判定ではありません。
- **重みや満点を持ちません。** 指摘 1 件が何点かはチームが決め、`chaff.yaml` に書きます。
