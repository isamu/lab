# ブラウザでかける

chaff は、ウェブページの中でも動きます。ルールも指摘の文も、コマンドラインと同じです。
文章はページの中で確かめ、どこにも送りません。
このページでは、このサイトの「試す」のページと、自分のページに chaff を組み込む入口 `chaffjs/browser` を説明します。

## 「試す」のページ

[試す](../../playground/)のページでは、何も入れずに文章をかけられます。

1. 見本を選ぶか、自分の文章を貼ります。
2. 言語とジャンルを選びます。選ばなければ chaff が決めます。ジャンルを決めないときは、設定の無いファイルをコマンドラインでかけたときと同じく、技術ブログとして読みます。
3. 「チェックする」を押します。

指摘は行ごとに並び、どれにもルールの名前、理由、直し方が付きます。
AI らしさの簡易判定と、動かなかったルールとその理由も出ます。

ページが読み込むのは、chaff のコードとルール、それに日本語を初めて確かめるときの辞書だけです。辞書は大きいので、日本語の最初の一回は少し待ちます。

このページでしないことは、次のとおりです。

- `chaff.yaml` が無いので、チームの語、表記、ルールの強さは使いません。それは手元で確かめます。
- 文章を一つだけかけるので、ファイルどうしを比べるルール（`cross-doc-` で始まるもの）は動きません。
- 意味を読む検査（`chaff test`）はしません。

同じ文章をファイルに保存し、`npx chaffjs --genre <ジャンル> <ファイル>` を手元で走らせると、同じ指摘が出ます。

## 自分のページに組み込む（`chaffjs/browser`）

`chaffjs/browser` は、ファイルシステムもサーバーも無いウェブページの中で、文章を確かめる入口です。「試す」のページも、これで動いています。

```ts
import { check, setupBrowser } from "chaffjs/browser";

setupBrowser({
  files: async (packageName) => loadFilesOf(packageName), // chaffjs、@chaffjs/lang-ja、@chaffjs/lang-en のファイル（パス → 中身）
  kuromojiDictionaryUrl: "https://example.com/kuromoji/", // kuromoji の辞書を置いた URL（絶対 URL、/ で終わる）
});

const result = await check(text, { genre: "business/report" });
// result.findings（指摘）、result.notRun（動かなかったルールと理由）、result.aiScore（AI らしさ）
```

`setupBrowser()` は、最初の `check()` より前に一度だけ呼びます。
`files` は、コマンドラインならディスクから読む、各パッケージのルール、ジャンル、語の一覧を渡します。
ページは、確かめるのに要るときにだけ、それを取りに行きます。

`check(text, options)` は、次の値を受け取ります。どれもコマンドラインと同じ働きです。

| 値 | 中身 |
| --- | --- |
| `language` | `ja` か `en`。書かなければ文章から決めます |
| `genre` | ジャンル。`--genre` と同じです |
| `config` | 読み込んだ `chaff.yaml` の中身。書かなければ chaff の既定のままです |
| `path` | 文書の名前。Markdown のためのルールは、名前が `.md` のときだけ動きます。書かなければ `document.md` です |
| `experimental` | 試験中のルールも動かします。`--experimental` と同じです |

`config` のうち、ファイルを読む設定（`plugins`、`include`、`by_path`）はページの中では使えません。
使わずに、その理由を添えて `notRun` に並べます。

結果には、使った言語とジャンル、`findings`、`notRun`、`aiScore` が入ります。
指摘には、ルール、強さ、行と桁、指摘の文、ルールの名前、理由、直し方、指摘した箇所の文が入ります。

package.json の `browser` の欄と `import.meta.glob` を読むバンドラー（Vite など）が要ります。
`vite dev` で使うときは、`optimizeDeps.exclude` に `chaffjs` を入れます。
ファイルと辞書の置き方は、「試す」のページのソース（[`site/src/lib/playground.ts`](https://github.com/isamu/lab/blob/main/text/site/src/lib/playground.ts) と [`scripts/browser-files.ts`](https://github.com/isamu/lab/blob/main/text/scripts/browser-files.ts)）が実例です。

## 次に読むページ

- 設定を書かずに手元のファイルにかけるやり方は、[はじめかた](./getting-started)にあります。
- `chaff.yaml` でチームに合わせるやり方は、[設定](./configuration)にあります。
- モデルの出力を `grade()` でプログラムの中から確かめるやり方は、[AI の評価（AI evals）に使う](./ai-evals)にあります。
- ルールごとの例と実際の出力は、[リファレンス](./reference)にあります。
