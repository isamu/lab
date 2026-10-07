# chaff

chaff は、プログラミングでよく使われている二つの仕組みを、ふつうの文章のために作り直した道具です。

- **linter（リンター）**: プログラムが決まり（ルール）に沿って書かれているかを、機械で確かめる仕組み。
- **unit test（ユニットテスト）**: プログラムを変えるたびに、想定どおりに動くかを確かめる仕組み。

chaff は、契約書、ブログ、技術文書などを、この二つのやり方で確かめます。
ルールに沿っているか（一文が長すぎないか、同じ語を二通りに書いていないか、書いてあることが食い違っていないか）は lint で見ます。
書き直しても大事なことが崩れていないか（数字や日付が落ちていないか、引用が原文にあるか、チームの決まりを守っているか）は、
`chaff compare`、`chaff cite`、`chaff test` で確かめます。どれも終了コードを返すので、CI に入れればプログラムと同じく変更のたびに回せます。

日本語と英語の文書をそのまま読み、同じ文章なら何度かけても同じ結果を出します。文章は書き換えません。直すのは書いた人（または、その人が頼んだ AI）です。

**ブラウザで試す:** [プレイグラウンド（日本語）](https://isamu.github.io/lab/ja/playground/) ·
[Playground (English)](https://isamu.github.io/lab/en/playground/)。インストールせずに、貼った文章にその場でかけられます。

## 使ってみる

Node.js 24 以上があれば、インストールせずにかけられます。設定ファイルも API key も言語の指定も要りません。
たとえば、次の `article.md` があるとします。

```markdown
# キャッシュを使う

## キャッシュの仕組み

キャッシュの仕組みについて説明します。一度読んだデータを手元に置き、二度目からはそこから返します。
```

これに chaff をかけます。

```bash
npx chaffjs article.md
```

画面には次のように出ます（実際の出力の前半です）。

```text
article.md   blog/tech · 日本語   ジャンルは既定から

─── 5 行目 ───────────────────────────────────────────────────

    キャッシュの仕組みについて説明します。

  ·  見出しの繰り返し

     見出し「キャッシュの仕組み」を直後の文がほぼそのまま繰り返しています
     見出しで言ったことを次の文が繰り返すと、読者はそこで何も受け取れません。

     → 見出しが約束したことの中身から書き始めてください。

     このルールをゆるめる:  npx chaffjs relax heading-echo
```

読み方は次のとおりです。

1. 1 行目は、調べたファイル、文書の種類（ジャンル）、言語です。
2. 「5 行目」の下に、指摘された文がそのまま引かれます。
3. 記号の付いた行が、何が起きているかです（ここでは、見出しを次の文が繰り返している）。記号は指摘の重さで、`✖` が誤り、`⚠` が注意、`·` が参考です。
4. その下が、なぜ読みにくいかです。
5. `→` の行が、どう直すかです。
6. 最後の行は、この指摘がチームの方針に合わないときに、ルールのほうをゆるめるコマンドです。

出力の最後には、指摘の数と、今回動かなかったルールの一覧が理由付きで出ます。「指摘なし」を「全部見て問題なし」と取り違えないためです。
画面は文書の言語で出るので、英語の文書には英語で返ってきます。

プロジェクトに入れて版を固定するなら、開発用の依存として足します（`npm install --save-dev chaffjs`、`yarn add -D chaffjs` など）。
コマンドの名前は `chaffjs` と `chaff` のどちらでも動きます。

```bash
npx chaffjs .                     この場所の Markdown を全部見る
npx chaffjs docs/ README.md       ディレクトリもファイルも glob も混ぜてよい
npx chaffjs article.md --watch    保存のたびに、変わったところだけ出す
npx chaffjs init                  chaff.yaml を作る（端末ならジャンルを一覧から選ぶ）
npx chaffjs --help                コマンドとオプションの一覧
```

## 文書の種類を選ぶ

契約書、法令、マニュアル、論文、小説、発言録は、それぞれの書き方で書かれます。種類（ジャンル）を選ぶと、設定を書かずにその書き方に合わせて見ます。
決めていない文書が別の種類に見えるときは、「契約書・規約のようです。--genre legal/contract を試せます」と画面が教えます。

```bash
npx chaffjs --genre legal/contract 契約書.md    この実行だけ、契約書として見る
npx chaffjs init --genre legal/contract         この場所の chaff.yaml に書く
npx chaffjs genres                              ジャンルの一覧と、それぞれ何向けか
```

| 群 | ジャンル |
| --- | --- |
| 技術文書 | `technical/spec` `technical/readme` |
| ブログ | `blog/tech`（既定） `blog/essay` `blog/owned-media` |
| ビジネス文書 | `business/proposal` `business/report` `business/email` `business/press-release` `business/meeting-notes` |
| 法務 | `legal/contract` `legal/statute` `legal/judgment` `legal/patent` |
| 説明書 | `docs/manual` `docs/faq` `docs/glossary` |
| 学術 | `academic/paper` |
| 文学 | `literature/fiction` `literature/essay` `literature/poetry` `literature/play` |
| 話し言葉 | `speech/address` `speech/transcript` |

### ジャンルの指針

ジャンルを決めると、結果の最初にそのジャンルの指針が出ます。その種類のよい文書が満たすことを、原稿を確かめる問いの形で並べ、特に効くルールを添えたものです。
ルールでは確かめられないことが多いので、指摘より先に読みます。推測したジャンルや既定のジャンルには出しません。

- 一度だけ外すときは `--no-guide` を付けます。
- チームは `chaff.yaml` の `guide:` で、指針を置き換え・追加・停止できます（[ジャンルの指針を変える](https://isamu.github.io/lab/ja/guide/configuration/#ジャンルの指針を変える)）。
- `fix-plan` も指針から始まり、AI はそれに沿って書き直します。

## 既定で動くルール

設定を書かなくても、ほとんどのルールはジャンルに合わせた強さで動きます。動かないのは次の 3 種類です。

| 種類 | 動かし方 |
| --- | --- |
| 試験中のルール（まだ測っていない新しいルール） | `--experimental` で全部、`npx chaffjs enable <ルール>` で一つずつ |
| チームの言葉が要るルール（社内用語、必須の見出し、表記） | `chaff.yaml` の `jargon` `required_sections` `prefer` に書く |
| 意味を読む検査 | `npx chaffjs test`（API key が要る） |

どのルールがいまどの強さで動くかは、`npx chaffjs rules` が表にします。「default」の列が設定なしで動くルールです。
一つのルールの意図と根拠は `npx chaffjs explain <ルール>` で読めます。ルールの一覧は [ルールのページ](https://isamu.github.io/lab/ja/rules/) にもあります。

## 自分たちの決まり（プリセット）を作る

ジャンルや `style:` は、同梱のプリセットです。チームの決まりは、リポジトリに置く `chaff.yaml` に書けば、それがそのままチームのプリセットになります。
どのルールを、どの強さで動かすか、チームの言葉づかい、チーム独自のルールを、一つのファイルにまとめます。

```yaml
# chaff.yaml（リポジトリの一番上に置く）
genre: blog/tech              # 土台にするジャンル
style: koyobun                # 同梱の表記スタイル（公用文作成の考え方）を重ねる

rules:                        # ルールごとの強さ: strict / normal / relaxed / off、または上限の数
  max-sentence-length: 80
  bold-density: off
  ai-tell: strict              # 名指しして強さを変える（ほとんどのルールは既定で動く）
  preferred-term: normal

prefer:                       # チームの表記（左を見つけたら右を勧める）
  サーバ: サーバー
  ユーザ: ユーザー

custom_rules:                 # チーム独自のルール（コードは要らない）
  - id: team-no-tbd
    type: pattern
    pattern: 'TBD|未定'
    level: error
    name: 未定のまま
    why: 未定のまま出すと、読む人が決まったことと取り違えます。
    how_to_fix: 決まっていることを書くか、決める人と期日を書いてください。
    example: { before: 締切は TBD です。, after: 締切は 10 月 5 日です。 }
```

`npx chaffjs init` でひな形を作れます。いま効いている設定は `npx chaffjs rules` で一覧になります。
AI に設定を書かせるときは、`npx chaffjs rules --json` の出力を渡します。いまの値、使える値、なぜいま `off` なのかが一つに入っています。
書き方の詳しい説明は手引きの「[設定](https://isamu.github.io/lab/ja/guide/configuration/)」と「[チームの表記ルール](https://isamu.github.io/lab/ja/guide/house-style/)」にあります。

## 指摘されたら

応じ方は 3 つです。指摘がもっともなら文章を直します。指摘は正しいがそこは意図して書いたのなら、`<!-- stet: rule-id — 理由 -->` でその箇所だけ黙らせます。
自分たちの方針に合わないなら、`npx chaffjs relax rule-id --why "理由"` でルールのほうを変えます。
強さは `strict` `normal` `relaxed` `off` の 4 語から選び、足りなければ上限を数で書けます（`max-sentence-length: 260`）。
黙らせている箇所は `npx chaffjs suppressions docs/` が数えます。

## チーム独自のルールとルールの束

一つのチームのルールは、上の例のように `chaff.yaml` の `custom_rules` に書きます。語（`type: words`）、正規表現（`type: pattern`）、品詞の並び（`type: tokens`）、Node の関数（`type: module`）で書けます。
書き方は「[ルールを足す](https://isamu.github.io/lab/ja/guide/adding-rules/)」にあります。

いくつものチームで使うルールは、プラグインのパッケージ `chaff-plugin-<名前>` にまとめます。ルール・語彙表・スタイルを YAML だけで書く束なら、コードは要りません。

```bash
npx chaffjs init --plugin <名前>     YAML だけのルールの束のひな形 chaff-plugin-<名前>/ を作る
npx chaffjs plugin-test <フォルダ>    束の各ルールを、そのルールの例にかけて確かめる
```

`chaff.yaml` の `plugins:` に足すと、束のルールは `<名前>/<ルール>` として、chaff のルールと同じに `explain`・`relax`・`stet`・SARIF で扱えます。
ルールを関数で書く束は `detect` を使い、型と `defineRule` / `definePlugin` は `chaffjs/api` から読み込みます。
読み込むとそのコードが動くので、信頼できるものだけを入れてください。作り方は「[プラグインを作る](https://isamu.github.io/lab/ja/guide/writing-plugins/)」にあります。

## 直す計画（fix-plan）と書き直しの深さ

`fix-plan` は、指摘をルールごとにまとめ、直す方向、変えてはいけないもの、直す前と後の例、勧める直し方、直したあとにかけるコマンドを並べた「直す計画」を出します。
人が直すときも AI に頼むときも、この計画を読んで書き直します。chaff 自身は何も送りません。

```bash
npx chaffjs fix-plan article.md                    直す計画を出す（--json で AI に渡す形）
npx chaffjs fix-plan article.md --depth light      構成は残し、語と文だけを直す計画にする
npx chaffjs compare article.md after.md            書き直しで事実（数・日付・URL・名前など）が落ちても足されてもいないかを確かめる
```

深さは `light`（語と文）、`structure`（節・見出し・段落の組み替えまで）、`register`（文体の変換まで）の 3 つで、深いものは浅いものを含みます。
決めた深さより深いルールの指摘は、名前と箇所の数だけが計画に載ります。毎回同じ深さにするなら `chaff.yaml` に `fix_plan: { depth: light }` と書きます。
深さを決めなければ、chaff が直し方を勧め、その深さを計画に書きます。
詳しくは手引きの「[AIっぽさを直す](https://isamu.github.io/lab/ja/guide/ai-sounding/)」と「[直す計画の深さを決める](https://isamu.github.io/lab/ja/guide/configuration/#直す計画の深さを決める)」にあります。

## AI らしさの簡易判定（chaff ai-score）

`chaff ai-score <file>` — AI らしさの簡易判定（低・中・高）。生成文に多い目印のうち、同じジャンルの人の文書にはめったに出ないものを数えます。書いたのが AI かどうかの判定ではありません。

```bash
npx chaffjs ai-score article.md                  低・中・高と、出ていた目印
npx chaffjs ai-score article.md --format json    同じものを JSON で
```

短すぎる文書は測らず、そう言います。

## AI の評価に使う（chaff grade）

`chaff grade` は、モデルの出力を JSONL のまま採点します。1 行に 1 つの出力で、`id` と `output` が要ります。
ルールの指摘の率、`compare` による事実の照合、`cite` による引用の照合をまとめ、出力ごとに合否を付けます。何も送りません。

```bash
npx chaffjs grade outputs.jsonl                         採点して、まとめを出す
npx chaffjs grade outputs.jsonl --out results.jsonl     出力ごとの結果を JSONL に書く
```

不合格の出力があれば 1 で終わるので、CI でプロンプトやモデルの変更を確かめられます。
入力の書き方と、二つのプロンプトの比べ方は「[AI の評価（AI evals）に使う](https://isamu.github.io/lab/ja/guide/ai-evals/)」にあります。

## ブラウザで使う（chaffjs/browser）

`chaffjs/browser` は、ファイルシステムもサーバーも無いウェブページの中で chaff を動かす入口です。ページがかける文章はどこにも送られません。

```ts
import { check, setupBrowser } from "chaffjs/browser";

setupBrowser({
  files: async (packageName) => loadFilesOf(packageName), // chaffjs、@chaffjs/lang-ja、@chaffjs/lang-en のファイル（パス → 中身）
  kuromojiDictionaryUrl: "https://example.com/kuromoji/", // kuromoji の辞書を置いた URL（絶対 URL、/ で終わる）
});

const result = await check(text, { genre: "business/report" });
// result.findings（指摘）、result.notRun（動かなかったルールと理由）、result.aiScore（AI らしさ）
```

- package.json の `browser` フィールドと `import.meta.glob` を読むバンドラー（Vite）が要ります。
- `vite dev` で使うときは、`optimizeDeps.exclude` に `chaffjs` を入れてください。
- 日本語の辞書は、日本語の文章を初めてかけたときに取りに行きます。

[プレイグラウンド](https://isamu.github.io/lab/ja/playground/) がこの入口で動いています。ファイルと辞書の置き方の実例は、そのソース（リポジトリの `text/site/src/lib/playground.ts` と `text/scripts/browser-files.ts`）にあります。`check()` の値と結果の中身は、手引きの「[ブラウザでかける](https://isamu.github.io/lab/ja/guide/browser/)」にあります。

## ほかにできること

```bash
npx chaffjs baseline docs/        既にある指摘を棚上げする（CI に入れるとき）
npx chaffjs . --sarif out.sarif   指摘を SARIF で書き出す（GitHub の PR に出す）
npx chaffjs tree contract.txt     文書を番地の付いた木にする（条・項・定義・参照）
npx chaffjs cite 原文 引用.json   引用が原文のその番地にあるかを確かめる
npx chaffjs facts 前.md           compare が照合する事実を一覧にする（書き直す前の控え）
npx chaffjs outline 前.md 後.md   見出しの構成と形、構成の AI らしさを前と後で並べる
npx chaffjs test docs/            意味を読む検査も動かす（API key が要る。--dry-run で送るものだけを見る）
npx chaffjs skill                 Claude Code の skill を入れる（--global でホームに）
npx chaffjs feedback a.md --rule <ルール> --line 42    誤った指摘の報告の下書きを作る（何も送らない）
```

言語のアダプタ（`@chaffjs/lang-ja` と `@chaffjs/lang-en`）は同梱しているので、別に入れる必要はありません。
新しい言語のアダプタは誰でも出せます。公式は `@chaffjs/lang-<言語>`、第三者は `chaff-lang-<言語>` と名乗り、chaff は公式、第三者の順に探して読みます。

## ドキュメント

手引きとルールの一覧は [日本語のサイト](https://isamu.github.io/lab/ja/) と [英語のサイト](https://isamu.github.io/lab/en/) にあります。

- [はじめかた](https://isamu.github.io/lab/ja/guide/getting-started/)
- [コマンド](https://isamu.github.io/lab/ja/guide/commands/)
- [設定](https://isamu.github.io/lab/ja/guide/configuration/)
- [文書の種類ごとにできること](https://isamu.github.io/lab/ja/guide/documents/)
- [AIっぽさを直す](https://isamu.github.io/lab/ja/guide/ai-sounding/)
- [AI の評価（AI evals）に使う](https://isamu.github.io/lab/ja/guide/ai-evals/)
- [CI](https://isamu.github.io/lab/ja/guide/ci/)
- [ルールの一覧](https://isamu.github.io/lab/ja/rules/)

ソースは [GitHub の isamu/lab の text/](https://github.com/isamu/lab/tree/main/text) にあります。

## In English

chaff brings two habits from programming to ordinary writing. A linter checks that code follows rules; a unit test
checks that a change did not break what must hold. chaff lints contracts, blog posts and technical documents for
readability, consistency and contradictions. Its `compare`, `cite` and `test` commands check that a rewrite kept the
facts, the quotations and the team's requirements.

Every command returns an exit code, so it runs in CI on every change. It reads Japanese and English, gives the same
result for the same text every time, and never rewrites it.

**Try chaff in your browser:** [the playground](https://isamu.github.io/lab/en/playground/).

**First run.** With Node.js 24 or later, `npx chaffjs article.md` checks a file with no install, no config and no API
key; on an English document the screen is in English. `npx chaffjs .` checks every Markdown file here, and
`npx chaffjs --help` lists every command.

**Genres.** `--genre legal/contract` (or `genre:` in `chaff.yaml`) checks a document the way its kind is written;
`npx chaffjs genres` lists them. With a genre set, the report opens with that genre's guide: what a good document of
the kind does, as questions to check the draft against, and the rules that matter most. `--no-guide` leaves it out for
one run, and `guide:` in `chaff.yaml` replaces, adds to or turns off a team's guide.

**Rules on by default.** Most rules run with no settings, at the level the genre sets. Experimental rules run with
`--experimental` (or one at a time with `npx chaffjs enable <rule>`), rules on a team's words need their lists in
`chaff.yaml`, and the checks that read meaning run with `npx chaffjs test`. `npx chaffjs rules` shows which rule runs at
what level now.

**Your own preset** is a `chaff.yaml` in the repository: a genre, a `style`, rules and their levels, your preferred
spellings, the genre's guide and your own rules under `custom_rules` (`words`, `pattern`, `tokens` for part-of-speech
patterns, or `module` for a Node function). `npx chaffjs init --plugin <name>` starts a YAML-only rule pack, `chaff-plugin-<name>/`,
and `npx chaffjs plugin-test` checks each of its rules on the rule's own example.

**Fix plans.** `npx chaffjs fix-plan article.md` is a plan for whoever rewrites the file, a person or an AI: findings by
rule, how to rewrite each, and the checks to run after. `--depth light|structure|register` (or `fix_plan: { depth }`
in `chaff.yaml`) sets how deep the rewrite may go.

**AI score.** `chaff ai-score <file>` — a quick AI-likeness score (low, medium, high): counts the signs of generated
text that human documents of the same genre rarely show. It is not a verdict on whether AI wrote it.

**AI evals.** `npx chaffjs grade outputs.jsonl --out results.jsonl` grades a JSONL file of a model's outputs (`id` and
`output` on each line) with the rules, `compare` and `cite`, and fails when an output fails. How is in
[Using chaff for AI evals](https://isamu.github.io/lab/en/guide/ai-evals/).

**In a browser.** `chaffjs/browser` exports `setupBrowser({ files, kuromojiDictionaryUrl })` and `check(text, options)`.
`chaffjs/browser` needs a bundler that reads package.json's `browser` field and `import.meta.glob` (Vite). With
`vite dev`, put `chaffjs` in `optimizeDeps.exclude`. The Japanese dictionary is fetched on the first Japanese check.
The options of `check()` and what it returns are in [Checking in a browser](https://isamu.github.io/lab/en/guide/browser/).

The guide and the reference of every rule are on [the English site](https://isamu.github.io/lab/en/):
[Getting started](https://isamu.github.io/lab/en/guide/getting-started/),
[Commands](https://isamu.github.io/lab/en/guide/commands/),
[Configuration](https://isamu.github.io/lab/en/guide/configuration/),
[Making AI-sounding text sound human](https://isamu.github.io/lab/en/guide/ai-sounding/).

MIT
