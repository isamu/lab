# プラグインを作る

chaff のルールを Node の関数で書き、パッケージにまとめて配る方法です。
語や正規表現で書けるルールなら、コードは要りません。先に [ルールを足す](./adding-rules) を見てください。
コードを書くのは、数える・比べるなど、それでは書けないときだけです。

## 2 つの形

| 形 | 向いているとき | 書く場所 |
| --- | --- | --- |
| 関数のルール | 一つのチームが、一つのルールを足す | `chaff.yaml` の `custom_rules` に `type: module` |
| プラグイン | ルール・語の一覧・スタイルをまとめて、いくつものチームで使う | パッケージ `chaff-plugin-<名前>` か、手元のファイル |

どちらも、ルールの中身は同じ関数です。文書を受け取り、指摘の一覧を返します。
型と補助の関数は `chaffjs/api` から読み込みます。

```js
import { API_VERSION, defineRule, definePlugin } from "chaffjs/api";
```

## 関数に渡るもの

関数は `(doc, options) => 指摘の一覧` の形です。`doc` には次のものが入っています。
位置はすべて `doc.source` の中の位置（UTF-16 の何文字目か）です。

| 名前 | 中身 |
| --- | --- |
| `source` `path` `language` | 文書の全文、ファイルの場所、文書の言語（`ja` か `en`） |
| `sentences` | 文の一覧。文ごとに `span`（始まりと終わり）と `text` |
| `sentences[].tokens` | 語の一覧。`pos`（品詞。UPOS の `NOUN` `VERB` など）と `lemma`（原形）。`requires: [pos]` のときだけ入る |
| `paragraphs` `sections` | 段落と、見出しで分けた節。節は `depth`（見出しの深さ）と `heading` を持つ |
| `lists` `listItems` | 箇条書きと、その項目 |
| `links` `markup` | リンクの場所と、記法（見出し・画像・リンクの行き先） |
| `lexicons` | 語の一覧。名前で引く |

`options.lexicon` には、ルールの `word_list` に書いた語の一覧が、文書の言語のぶんだけ入ります。
`doc` は凍らせてあり、書き換えられません。一つのルールが、次のルールの見るものを変えないためです。

## 返すもの

指摘は `{ start, end, values }` の一覧です。`end` と `values` は書かなくても構いません。
chaff が行と桁を数え、その位置の文を引用し、ルールの `message` の `{matched}` に `start` から `end` までの文字を入れます。
`values` に書いた値も、`message` の `{名前}` に入ります。
何も見つからなければ、空の一覧を返します。

## 手順：プラグインを作る

例として、日付を「未定」のまま残した文を指すプラグインを作ります。
同じものが [examples/chaff-plugin-example](https://github.com/isamu/lab/tree/main/text/examples/chaff-plugin-example) にあります。

1 つめに、フォルダと `package.json` を作ります。パッケージの名前は `chaff-plugin-<名前>` にします。

```json
{
  "name": "chaff-plugin-example",
  "type": "module",
  "main": "index.mjs",
  "peerDependencies": { "chaffjs": ">=0.19.0" }
}
```

2 つめに、ルールの関数を書きます。関数は文書だけを読み、同じ文書には同じ指摘を返します。

```js
// rules/no-tbd-dates.mjs
export const noTbdDates = (doc) =>
  doc.sentences.flatMap((sentence) =>
    [...sentence.text.matchAll(/未定|TBD/gu)].map((match) => ({
      start: sentence.span.start + match.index,
      end: sentence.span.start + match.index + match[0].length,
    })),
  );
```

3 つめに、`index.mjs` で `definePlugin` を `export default` します。
ルールには、`custom_rules` と同じく名前・理由・直し方・例を書きます。chaff のルールが持つほかの欄（`levels`、`use_for`、`group`、`summary`、`rewrite`）も書けます（[ルールを足す](./adding-rules#チームのルールを-chaff-のルールと同じ形で書く)）。
`name` はパッケージの名前から決まります（`chaff-plugin-example` なら `example`）。

```js
// index.mjs
import { definePlugin } from "chaffjs/api";
import { noTbdDates } from "./rules/no-tbd-dates.mjs";

export default definePlugin({
  name: "example",
  rules: [
    {
      id: "no-tbd-dates",
      level: "warning",
      name: { ja: "未定のままの日付", en: "A date left undecided" },
      why: { ja: "読み手は日付をもとに予定を立てます", en: "A reader plans around a date" },
      how_to_fix: { ja: "日付か、決める人と期限を書きます", en: "Write the date, or who decides it" },
      example: { before: { ja: "公開日は未定です。", en: "It is TBD." }, after: { ja: "公開日は 10 月 1 日です。", en: "It is on 1 October." } },
      detect: noTbdDates,
    },
  ],
});
```

4 つめに、使う側の `chaff.yaml` に書きます。ルールの名前には、プラグインの名前が前に付きます。

```yaml
plugins: [chaff-plugin-example]
rules:
  example/no-tbd-dates: strict
```

指摘、`explain`、`rules --json`、`relax`、`stet`、baseline、SARIF は、chaff のルールと同じに扱います。
`<!-- stet: example/no-tbd-dates -->` で一か所だけ黙らせられます。

## 語の一覧とスタイル

語の一覧は `lexicons` に言語ごとに書き、ルールの `word_list` で名前を書きます。
関数には `options.lexicon` で、文書の言語の一覧が渡ります。
その言語の一覧が無い文書では、ルールは「動いていない」一覧に理由付きで並びます。

```js
lexicons: { weasel: { ja: ["と言われている", "一般的に"], en: ["some say", "arguably"] } },
```

スタイルは、ルールの段階をまとめて決めます。書き方は chaff のスタイル（`styles/*.yaml`）と同じです。
使う側は `style: example/careful` と書きます。

```js
styles: [{ id: "careful", name: "日付に厳しく", summary: "未定の日付を誤りにします", source: { title: "社内の決まり", url: "https://example.com/style" }, rules: { "example/no-tbd-dates": "strict" } }],
```

## テストする

ルールの関数は文書を受け取るだけの関数なので、chaff を動かさずにテストできます。
文書の、関数が読むところだけを作って渡し、返ったものを比べます。

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { noTbdDates } from "../rules/no-tbd-dates.mjs";

test("未定の日付を指す", () => {
  const text = "公開日は未定です。";
  const doc = { source: text, sentences: [{ span: { start: 0, end: text.length }, text }] };
  assert.deepEqual(noTbdDates(doc), [{ start: 4, end: 6 }]);
});
```

chaff を通した確かめは、見本の文書を置いたフォルダで `npx chaffjs 見本.md` を動かします。
指摘すべき見本と、指摘してはいけない見本の両方で確かめます。

## 壊れたときの出力

読み込めないものは、文書を見る前に止まります（終了コード 1）。どれも、ルールかプラグインとファイルの名前を言います。

```
chaff: chaff.yaml: custom_rules の team-broken: module のファイル ./chaff-rules/nothing.mjs がありません
chaff: chaff.yaml: plugins の chaff-plugin-missing: 見つかりません。パッケージなら chaff.yaml のあるフォルダで yarn add chaff-plugin-missing を実行してください
```

ファイルが無いとき、読み込めないとき、版が違うとき、ルールの欄が欠けているときも、このように止まります。
`export default` が関数でもプラグインでもないときも同じです。黙って動かないルールは、きれいな文書に見えてしまうためです。

文書を見ている途中で関数がエラーを投げたときや、指摘の形が違うときは、そのルールだけが止まります。
ほかのルールは最後まで動き、止まったルールは「動いていない」一覧に理由付きで並びます。

```
      team-broken（./chaff-rules/broken.mjs の検出器がエラーを投げた（Cannot read properties of undefined (reading 'length')）ため）
```

## 版

`chaffjs/api` の形は、プラグイン API の版（`API_VERSION`）で決まります。いまは 1 です。
`definePlugin` と `defineRule` は、作ったときの版を付けます。
chaff は、版が違うプラグインを読み込まずに止まります。

```
chaff: chaff.yaml: custom_rules の team-broken: ./chaff-rules/broken.mjs はプラグイン API 2 向けです。この chaff のプラグイン API は 1 です
```

関数だけを `export default` したルールは版を持たず、動かしている chaff の版で読みます。
版を決めておきたいときは `defineRule({ detect })` で包みます。

## 安全

プラグインと関数のルールを読み込むと、そのコードが動きます。chaff を動かすたびに、`chaff.yaml` が名指ししたものを読み込みます。
信頼できるプラグインだけを入れてください。
`chaff.yaml` と同じフォルダより外にあるファイルは、絶対パスで書いたときだけ読みます。
ほかから写した `chaff.yaml` が、`../../` で思わぬ場所のコードを読まないためです。

## 決まり

- 同じ文書には、同じ指摘を返します。時刻・乱数・ファイル・ネットワークを読みません。chaff はこれを確かめられないので、書く人が守ります。
- 文書を書き換えません。直すのは書いた人です。
- 終わらない関数を書きません。chaff は関数を途中で止められません。
- 関数の外に何も残しません。関数は chaff と同じプロセスで動きます。タイマーやプロセスの終了、組み込みのオブジェクトの書き換えまでは、chaff は守れません。
- 意味を読まないと決まらないものは書きません。それは `chaff test` の側に置きます。

## 公開する

[examples/chaff-plugin-example](https://github.com/isamu/lab/tree/main/text/examples/chaff-plugin-example) を写して始めると早いです。
パッケージの名前を `chaff-plugin-<名前>`（組織なら `@scope/chaff-plugin-<名前>`）にし、`definePlugin` の `name` を合わせます。
`chaffjs` は `peerDependencies` に置き、使う側の chaff を使わせます。
`main` か `exports` の `"."` で入口のファイルを指します。`exports` を `import` の条件だけで書くと見つかりません。
最後に `npm publish` で公開します。
