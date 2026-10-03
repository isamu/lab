# chaff

chaff は、プログラミングでよく使われている二つの仕組みを、ふつうの文章のために作り直した道具です。

- **linter（リンター）**: プログラムが決まり（ルール）に沿って書かれているかを、機械で確かめる仕組み。
- **unit test（ユニットテスト）**: プログラムを変えるたびに、想定どおりに動くかを確かめる仕組み。

chaff は、契約書、ブログ、技術文書などを、この二つのやり方で確かめます。
ルールに沿っているか（一文が長すぎないか、同じ語を二通りに書いていないか、書いてあることが食い違っていないか）は lint で見ます。
書き直しても大事なことが崩れていないか（数字や日付が落ちていないか、引用が原文にあるか、チームの決まりを守っているか）は、
`chaff compare`、`chaff cite`、`chaff test` で確かめます。どれも終了コードを返すので、CI に入れればプログラムと同じく変更のたびに回せます。

日本語と英語の文書をそのまま読み、同じ文章なら何度かけても同じ結果を出します。文章は書き換えません。直すのは書いた人（または、その人が頼んだ AI）です。
インストールも、AI の利用登録も、言語の指定も要りません。

## 使ってみる

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

  ⚠  見出しの繰り返し

     見出し「キャッシュの仕組み」を直後の文がほぼそのまま繰り返しています
     見出しで言ったことを次の文が繰り返すと、読者はそこで何も受け取れません。

     → 見出しが約束したことの中身から書き始めてください。

     このルールをゆるめる:  npx chaffjs relax heading-echo
```

読み方は次のとおりです。

1. 1 行目は、調べたファイル、文書の種類（ジャンル）、言語です。
2. 「5 行目」の下に、指摘された文がそのまま引かれます。
3. `⚠` の行が、何が起きているかです（ここでは、見出しを次の文が繰り返している）。
4. その下が、なぜ読みにくいかです。
5. `→` の行が、どう直すかです。
6. 最後の行は、この指摘がチームの方針に合わないときに、ルールのほうをゆるめるコマンドです。

出力の最後には、指摘の数と、今回動かなかったルールの一覧が理由付きで出ます。「指摘なし」を「全部見て問題なし」と取り違えないためです。

見るのは誤字脱字より、文章の組み立てです。たとえば次のようなところです。

- 一文が長すぎて、読んでいるうちに主語を見失う
- 太字が多すぎて、どこも目立たなくなっている
- 見出しと同じことを、その直後の文が繰り返している
- 「近年、〜が注目されています」など、どの記事にも当てはまる書き出し
- 「いかがでしたか」で終わる、読者に何も残さない結び

画面は文書の言語で出るので、英語の文書には英語で返ってきます。

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
  ai-tell: normal              # 試験中のルールも、名指しすれば動く
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

`npx chaffjs init` でひな形を作れます。いま効いている設定は `npx chaffjs rules` で一覧になり、`npx chaffjs explain <ルール>` で一つずつ確かめられます。
いくつものリポジトリで同じプリセットを使いたいときは、ルールとスタイルをプラグインのパッケージにまとめ、`plugins:` と `style: <名前>/<スタイル>` で読み込みます（下の「ほかにできること」）。
書き方の詳しい説明は手引きの「[設定](https://isamu.github.io/lab/ja/guide/configuration/)」と「[チームの表記ルール](https://isamu.github.io/lab/ja/guide/house-style/)」にあります。

## 指摘されたら

応じ方は 3 つです。指摘がもっともなら文章を直します。指摘は正しいがそこは意図して書いたのなら、`<!-- stet: rule-id — 理由 -->` でその箇所だけ黙らせます。
自分たちの方針に合わないなら、`npx chaffjs relax rule-id --why "理由"` でルールのほうを変えます。
強さは `strict` `normal` `relaxed` `off` の 4 語から選び、足りなければ上限を数で書けます（`max-sentence-length: 260`）。

## ほかにできること

```bash
npx chaffjs .                     この場所の Markdown を全部
npx chaffjs article.md --watch    保存のたびに、変わったところだけ出す
npx chaffjs explain bold-density  ルールの意図と根拠を読む
npx chaffjs baseline docs/        既にある指摘を棚上げする
npx chaffjs suppressions docs/    stet で黙らせている指摘を数える
npx chaffjs rules --json          いまの設定を JSON で出す（AI に渡す用）
npx chaffjs tree contract.txt     文書を番地の付いた木にする（条・項・定義・参照）
npx chaffjs cite 原文 引用.json   引用が原文にあるかを確かめる
npx chaffjs fix-plan 前.md        指摘をルールごとにまとめ、直す方向と確かめのコマンドを付けた「直す計画」を出す
npx chaffjs facts 前.md           compare が照合する事実を一覧にする（書き直す前の控え）
npx chaffjs outline 前.md 後.md   見出しの構成と形（見出しの数・節の平均・箇条書きの割合・太字）を前と後で並べる
npx chaffjs compare 前.md 後.md   書き換えで事実（数・日付・URL・名前など）が落ちても足されてもいないかを確かめる
npx chaffjs skill                 Claude Code の skill を入れる（--global でホームに）
```

言語のアダプタ（`@chaffjs/lang-ja` と `@chaffjs/lang-en`）は同梱しているので、別に入れる必要はありません。
新しい言語のアダプタは誰でも出せます。公式は `@chaffjs/lang-<言語>`、第三者は `chaff-lang-<言語>` と名乗ります。
`@typescript-eslint/*` と `eslint-plugin-*` の関係と同じで、chaff は公式、第三者の順に探して読みます。

ルールは Node の関数でも書けます。一つのチームのルールは `chaff.yaml` の `custom_rules` に `type: module` で、いくつものチームで使うものはプラグインのパッケージ `chaff-plugin-<名前>` にまとめます。
型と `defineRule` / `definePlugin` は `chaffjs/api` から読み込みます。プラグインのルールは `<名前>/<ルール>` と呼ばれ、chaff のルールと同じに `explain`・`relax`・`stet`・SARIF で扱えます。
読み込むとそのコードが動くので、信頼できるものだけを入れてください。作り方は手引きの「[プラグインを作る](https://isamu.github.io/lab/ja/guide/writing-plugins/)」にあります。

## ドキュメント

手引きとルールの一覧は [日本語のサイト](https://isamu.github.io/lab/ja/) と [英語のサイト](https://isamu.github.io/lab/en/) にあります。
ソースは https://github.com/isamu/lab/tree/main/text です。

## In English

chaff brings two habits from programming to ordinary writing. A linter checks that code follows rules; a unit test
checks that a change did not break what must hold. chaff lints contracts, blog posts and technical documents for
readability, consistency and contradictions. Its `compare`, `cite` and `test` commands check that a rewrite kept the
facts, the quotations and the team's requirements.

Every command returns an exit code, so it runs in CI on every change.
It reads Japanese and English and never rewrites the text.

Your own preset is a `chaff.yaml` in the repository: rules and
their levels, a style, your preferred spellings and your own rules. The guide and the reference of every rule are at
https://isamu.github.io/lab/en/

MIT
