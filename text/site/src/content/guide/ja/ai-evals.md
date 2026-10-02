# AI の評価（AI evals）に使う

chaff は、model の出力の採点役として、model による採点の横に置けます。
同じ出力にはいつも同じ結果を返し、一つ一つの指摘が行とルールを指し、どこにも何も送りません。
意味は読みません。答えが正しいかどうかは、これまでどおり model の採点か人が決めます。
このページでは、いま動くことを手順と実際の出力で示し、予定していることも書きます。

## 出力の何を確かめられるか

| 確かめたいこと | コマンド | 終了コード 1 になるとき |
| --- | --- | --- |
| 要約や書き換えで事実が落ちたか、作られたか | `npx chaffjs compare <元> <出力> --json` | 数・日付・URL・名前・引用などが落ちたか、足された |
| RAG の回答の引用が、本当に原文にあるか | `npx chaffjs cite <原文> <引用.json> --format json` | 引用がその番地に無い |
| 回答が自分と矛盾していないか | `npx chaffjs <出力> --experimental` | 合計が内訳の和と合わない、日付と曜日が合わない |
| 生成文らしい形や、読みにくさ | `npx chaffjs <出力> --experimental --sarif <path>` | `error` の指摘だけ。ほかは数として数えます |
| 作り直しの段で何を直させるか | `npx chaffjs fix-plan <出力> --experimental --json` | なりません。直す指示を出すだけです |

ふつうの検査には `--json` がありません。指摘は SARIF で読みます。下の「指摘を SARIF で受け取る」で説明します。

## 始める前に

Node.js 24 以上が要ります。`npx chaffjs` は、初めて使うときに chaff を取ってきます。
何度も回す評価では、`chaffjs` をプロジェクトの開発用の依存に入れておきます。
どの回も同じ版で動き、同じ出力には同じ結果が返るためです。
実行する場所に `chaff.yaml` があれば、どの検査にも効きます（[設定](./configuration)）。

## 初めての評価を回す

1. **出力を JSONL に並べます。** 1 行に 1 つの出力です。`id` と `output` は必須です。
   事実を元の文書と照らすときは `reference` を、引用を確かめるときは `source` と `citations` を足します。

   ```json
   {
     "id": "refund",
     "output": "商品が届いた日から 30 日以内なら返金を求められ、送料も戻ります（第2条第2項）。",
     "source": "# 返金の決まり\n\n第1条（対象）\n…",
     "citations": [{ "address": "2.1", "quote": "商品が届いた日から 30 日以内" }]
   }
   ```

2. **下のスクリプトを `eval-chaff.mjs` として保存します。** 1 行ずつ上のコマンドにかけ、結果を集めます。
3. **1 つのファイルに、または 2 つを並べてかけます。**
   `prompt-a.jsonl` と `prompt-b.jsonl` は、同じ 3 つの題に 2 つの prompt で答えさせた出力です。中身は下の例 1〜3 にあります。

   ```
   $ node eval-chaff.mjs prompt-a.jsonl prompt-b.jsonl
   {"run":"prompt-a.jsonl","id":"deploy","pass":true,"chars":137,"findings":0,"dropped":[],"added":[],"unsupported":0}
   {"run":"prompt-a.jsonl","id":"q3","pass":true,"chars":89,"findings":0,"dropped":[],"added":[],"unsupported":0}
   {"run":"prompt-a.jsonl","id":"refund","pass":true,"chars":50,"findings":0,"dropped":[],"added":[],"unsupported":0}
   {"run":"prompt-b.jsonl","id":"deploy","pass":true,"chars":230,"findings":5,"dropped":[],"added":[],"unsupported":0}
   {"run":"prompt-b.jsonl","id":"q3","pass":false,"chars":76,"findings":0,"dropped":["6 時間","2.5 時間","2026年7月14日"],"added":["2026年7月1日"],"unsupported":0}
   {"run":"prompt-b.jsonl","id":"refund","pass":false,"chars":40,"findings":0,"dropped":[],"added":[],"unsupported":1}
   rule (per 1000 chars)	prompt-a.jsonl	prompt-b.jsonl
   ai-generated-composite	0.0	2.9
   ai-tell	0.0	2.9
   closing-cliche	0.0	5.8
   padded-intro	0.0	2.9
   passed	3/3	1/3
   ```

4. **結果を読みます。** JSON の 1 行が 1 つの出力です。`dropped` と `added` は `compare` が見つけた事実です。
   `unsupported` は、`cite` が原文に見つけられなかった引用の数です。
   表は、ルールごとの指摘を、回全体の 1,000 字あたりにしたものです。長い出力と短い出力を同じ物差しで比べられます。
5. **合否を決めます。** このスクリプトでは、`error` の指摘、落ちた・足された事実、外れた引用のどれかがあれば落とします。
   形の指摘では落としません。prompt や model を比べるための数として使います。
   落ちた出力が一つでもあれば終了コード 1 で終わるので、CI で止められます。`pass` の行は評価に合わせて変えます。

```js
// node eval-chaff.mjs run-a.jsonl [run-b.jsonl ...]
// Each line: {"id", "output", "reference"?, "source"?, "citations"?}
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "chaff-eval-"));
const chaff = (...args) => spawnSync("npx", ["chaffjs", ...args], { encoding: "utf8" });
const save = (name, text) => {
  writeFileSync(join(dir, name), text);
  return join(dir, name);
};
const chars = (text) => text.replace(/\s+/g, "").length;

const lint = (id, file) => {
  const sarif = join(dir, `${id}.sarif`);
  chaff(file, "--experimental", "--sarif", sarif);
  const results = JSON.parse(readFileSync(sarif, "utf8")).runs[0].results;
  return results.map((result) => ({ rule: result.ruleId.replace("chaff/", ""), level: result.level }));
};

const compare = (id, reference, file) => {
  const facts = JSON.parse(chaff("compare", save(`${id}.ref.md`, reference), file, "--json").stdout);
  return { dropped: facts.dropped.map((fact) => fact.text), added: facts.added.map((fact) => fact.text) };
};

const cite = (id, source, citations) => {
  const args = ["cite", save(`${id}.src.md`, source), save(`${id}.quotes.json`, JSON.stringify(citations))];
  return JSON.parse(chaff(...args, "--format", "json").stdout).filter((check) => check.status !== "ok").length;
};

const grade = (item) => {
  const file = save(`${item.id}.md`, item.output);
  const findings = lint(item.id, file);
  const facts = item.reference ? compare(item.id, item.reference, file) : { dropped: [], added: [] };
  const unsupported = item.source ? cite(item.id, item.source, item.citations) : 0;
  const errors = findings.filter((finding) => finding.level === "error").length;
  const pass = errors === 0 && facts.dropped.length + facts.added.length + unsupported === 0;
  return { id: item.id, pass, chars: chars(item.output), findings, ...facts, unsupported };
};

const rates = (rows) => {
  const total = rows.reduce((sum, row) => sum + row.chars, 0);
  const counts = rows.flatMap((row) => row.findings).reduce((acc, { rule }) => ({ ...acc, [rule]: (acc[rule] ?? 0) + 1 }), {});
  return Object.fromEntries(Object.entries(counts).map(([rule, count]) => [rule, (count * 1000) / total]));
};

const runs = process.argv.slice(2).map((path) => {
  const rows = readFileSync(path, "utf8").split("\n").filter(Boolean).map((line) => grade(JSON.parse(line)));
  rows.forEach((row) => console.log(JSON.stringify({ run: path, ...row, findings: row.findings.length })));
  return { path, passed: rows.filter((row) => row.pass).length, total: rows.length, rates: rates(rows) };
});

const rules = [...new Set(runs.flatMap((run) => Object.keys(run.rates)))].sort();
console.log(["rule (per 1000 chars)", ...runs.map((run) => run.path)].join("\t"));
rules.forEach((rule) => console.log([rule, ...runs.map((run) => (run.rates[rule] ?? 0).toFixed(1))].join("\t")));
console.log(["passed", ...runs.map((run) => `${run.passed}/${run.total}`)].join("\t"));
process.exitCode = runs.every((run) => run.passed === run.total) ? 0 : 1;
```

スクリプトは chaff が書き出したファイルを読むので、コマンドで打つときと同じルールが動きます。
長さは空白を除いた字数で数えます。英語の出力なら、語の数で数えるほうが合います。

## 例 1: 要約は元の事実を守っているか

元の文書（`source.md`）は、短いサポートの報告です。2 つの model に要約させました。

```markdown
# サポート窓口の四半期報告

今期、サポート窓口は 4,812 件の問い合わせに答えました。
最初の返信までの時間の中央値は、6 時間から 2.5 時間に縮みました。
新しいヘルプセンターは 2026年7月14日に公開しました。
8月に 2 人が加わり、窓口は 11 人になりました。
```

model A の要約（`model-a.md`）は、数をすべて残しました。
model B の要約（`model-b.md`）は、返信の時間を落とし、日付を違えて書きました。

```markdown
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

```markdown
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

```json
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

## 例 3: 2 つの prompt を文章の形で比べる

同じ題「火曜日のデプロイが止まった理由を説明して」に、2 つの prompt で答えさせました。prompt A の答え（`prompt-a.md`）です。

```markdown
# デプロイが止まった理由

火曜日のデプロイは、データベースの段で止まりました。
移行で既定値つきの列を足したため、いちばん大きな表への書き込みが 4 分止まりました。
ヘルスチェックは 2 分で打ち切られ、リリースは元に戻りました。
次は既定値なしで列を足し、値はあとから少しずつ入れます。
```

prompt B の答え（`prompt-b.md`）です。

```markdown
# デプロイが止まった理由

近年、ソフトウェアの世界でデプロイは重要な役割を果たすと言えるでしょう。
本記事では、火曜日に何が起きたのかを深く掘り下げます。

**原因はコードではありません。データベースです。**
移行で既定値つきの列を足したため、いちばん大きな表への書き込みが 4 分止まりました。
ヘルスチェックは 2 分で打ち切られ、リリースは元に戻りました。

次は既定値なしで列を足し、値はあとから少しずつ入れます。地味に効く改善です。

いかがでしたか？参考になれば幸いです。
```

生成文の特徴を見るルールは試験中なので、`--experimental` を付けてかけます。

```
$ npx chaffjs prompt-a.md --experimental --compact

prompt-a.md   blog/tech · 日本語   ジャンルは既定から


指摘 0 件、動いていない rule 18 件
```

```
$ npx chaffjs prompt-b.md --experimental --compact

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

指摘 5 件、動いていない rule 18 件
```

たくさんの題で比べるときは、一つの出力ではなく率を比べます。手順 3 のスクリプトの表が、2 つを並べて出します。
動いていない 10 件は、英語だけのルールと、意味を読むルール 1 件です。`--compact` を外すと、理由と一緒に並びます。

指摘を作り直しの段に戻すときは、`fix-plan` で直す指示にします。
次は抜粋です。この後に、ルールごとの直す方向、例、見つけた箇所が続きます。

````
$ npx chaffjs fix-plan prompt-b.md --experimental
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
npx chaffjs prompt-b.rewritten.md --experimental
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

```markdown
# お見積もり

| 項目 | 金額 |
| --- | --- |
| 設計 | 40,000円 |
| 開発 | 120,000円 |
| 合計 | 150,000円 |

作業は 2026年10月6日（月）に始められます。
```

```
$ npx chaffjs answer.md --experimental --compact

answer.md   blog/tech · 日本語   ジャンルは既定から

  7:8     error   合計「150,000円」が、上の金額の和（160,000円）と合いません
                  total-mismatch
  9:5     error   「2026-10-06」は火曜日です（月曜日と書いてあります）
                  date-weekday-mismatch

指摘 2 件、動いていない rule 18 件
```

どちらも `error` なので終了コード 1 で終わり、スクリプトもこの出力を落とします。
これらのルールは試験中です。`--experimental` を付けないと動かず、最後の行がそう言います（`指摘 0 件、動いていない rule 66 件`）。

## 指摘を SARIF で受け取る

`--sarif` は、かけたファイルすべての指摘を 1 つの SARIF ファイルに書きます。画面の出力は変わりません。

```
$ npx chaffjs prompt-b.md --experimental --compact --sarif out/prompt-b.sarif
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

## 予定: `chaff grade` ほか（#488）

この節に書いたものは、まだ動きません。予定しているコマンドの使い方を示し、いま書く仕組みを後で移しやすくするためです。
設計は仕様書の 29 節にあり、作業は [#488](https://github.com/isamu/lab/issues/488) で追っています。

**`chaff grade`** は、上のスクリプトがしていることを 1 つのコマンドでします。入力は同じ形の JSONL です。
`sources` に原文を名前つきで複数並べ、引用ごとにどの原文から引いたかを書けるようにします。

```bash
npx chaffjs grade items.jsonl                       # 合否と率を画面に
npx chaffjs grade items.jsonl --out results.jsonl   # 出力ごとの結果を JSONL に
```

結果の 1 行には、指摘、ルールごとの率、動かなかったルールとその理由、落ちた・足された事実が入ります。
外れた引用、合否と落ちた理由、再現の印（`stamp`）も入ります。
終了コードは、すべて通れば 0、落ちた出力があれば 1、入力が読めなければ 2 です。

**採点の基準を `chaff.yaml` に書きます。** 何で落とすか、指摘 1 件が何点かを決めます。
点は減点の和で、一点ごとにどの指摘から来たかが付きます。
`grade:` を書かなければ点は出さず、合否と率だけを出します。

```yaml
grade:
  rules:
    total-mismatch: { max: 0 } # 1 件でもあれば落とす
    closing-cliche: { max: 0, weight: 3 } # 落とし、1 件 3 点
    ai-tell: { max_rate: 5, weight: 2 } # 1,000 字あたり 5 件を超えたら落とす
    max-sentence-length: { weight: 1 } # 落とさず、1 件 1 点
  required_sections: [結論, 根拠]
  facts: { dropped: 0, added: 0, allow_dropped: [heading] }
  citations: { failed: 0, required: true }
  penalty: 10 # 点の和がこれを超えたら落とす
```

**A/B と回帰。** `--baseline` で、前の回の結果と出力ごとに比べます（`id` で組にします）。
回帰とは、前に通った出力が落ちたこと、基準に書いたルールの指摘が増えたこと、点の和が増えたことです。
回帰があれば終了コード 1 なので、prompt や model の変更を CI で止められます。
2 つの回でルールか設定が違えば、比べません。その差は model から来たものではないためです。

```bash
npx chaffjs grade prompt-a.jsonl --out a.results.jsonl
npx chaffjs grade prompt-b.jsonl --baseline a.results.jsonl
```

**再現の印（`stamp`）** には、chaff の版、ルール一式のハッシュ、設定のハッシュを入れます。
ルール一式と設定が同じ結果どうしだけを比べます。

**ライブラリの関数** を用意し、同じプロセスで動く評価の仕組みからシェルを通さずに呼べるようにします。どこから出すかは未定です。

```js
import { grade } from "chaffjs/api";

const result = await grade(output, { reference: source, language: "ja" });
if (!result.pass) console.log(result.failedBecause);
```

**評価基盤への組み込み** は、`grade()` か `chaff grade` を呼ぶだけにし、基盤ごとの処理を chaff の中に持ちません。

| 基盤 | つなぎ方 |
| --- | --- |
| promptfoo | `javascript` の assertion から `grade()` を呼び、`pass`、通れば 1・落ちれば 0 の点、理由を返します |
| Inspect AI | scorer から `chaff grade` を呼び、結果の 1 行を `Score` とその説明にします |
| OpenAI Evals、LangSmith | 上の JSONL を受け渡しの形にし、結果の 1 行を feedback として載せます |
| GitHub Action | ワークフローで `chaff grade --baseline` を走らせ、回帰でジョブを止めます |

## ここで chaff がしないこと

- **model で採点しません。** 採点は決まった結果を返します。model に聞く `chaff test` は別のコマンドのままで、採点からは呼びません。
- **出力を書き換えません。** `fix-plan` は指示を出すだけで、書き直すのは作り直しの段です。
- **「AI が書いた」とは言いません。** `ai-generated-composite` は数えるための目印で、判定ではありません。
- **重みや満点を持ちません。** 指摘 1 件が何点かはチームが決め、`chaff.yaml` に書きます。
