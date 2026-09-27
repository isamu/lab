# chaff のドキュメントサイト

issue: #118（文書のハーネス #109 の最後）

## 何のためか

chaff を使う人が、入り方・設定・ルール一つ一つの意味を日本語と英語で読める場所を作る。

## 決めたこと

- **Astro で作り、GitHub Pages に置く**（`https://isamu.github.io/lab/`）。`text/site/` に独立したパッケージとして置き、依存も CI も本体と分ける。本体の eslint / prettier は `site/` を見ない。
- **ルールの一覧はルールの定義ファイルから作る。** `packages/chaff/rules/*.yaml` が名前・理由・指摘の文・直し方・段階を日英で持っているので、ビルドのときに chaff 自身の読み込み（`rule-load.ts` の `loadRules`）で言語ごとに読み、1 ルール 1 ページにする。段階・重さ・状態は chaff が使うものがそのまま出る。読めないルールがあればビルドが止まる。
- **日本語と英語を同じ道筋で並べる**（`/ja/...` と `/en/...`）。どのページにも反対の言語への切り替えを置く。
- **見た目は Tailwind のユーティリティだけ。** スタイルシートは Tailwind を読み込む一枚だけ。

## 段階

1. 骨組み、切り替え、ルールの一覧と各ルールのページ、CI でのビルド（この PR）
2. 手引きのページ（はじめかた、設定、CLI、構造と引用、言語の追加、CI での使い方）。mulmoterminal の文書ハーネス（規約 → 作る）で書き、chaff で確かめる
   - 日本語: `src/content/guide/ja/` に 6 ページ。規約（`chaff.yaml` と `STYLE.md`）は README を手本に「規約をつくる」で作り、本文は「作る」で書いた。資料から取った文は `chaff cite` で原文にあることを確かめている
   - Markdown の段落の中の改行は空白になるので、日本語どうしの改行は取り除く（`src/lib/joinCjkLines.ts`、remark の手順）
   - もう一方の言語にまだ無いページでは、言語の切り替えはその言語のトップに行く。手引きが無い言語では、上の「手引き」を出さない
   - 英語: 次に書く
3. GitHub Pages への公開: `.github/workflows/chaff-site-deploy.yml` が main に入ったサイトを作って置く。リポジトリの Pages は「GitHub Actions から」に設定する

## 確かめ方

- `yarn typecheck`（astro check）と `yarn build` が通る。
- 実際のブラウザで、ルールのページ・一覧・トップを明暗と電話幅で開き、表示と横スクロールが無いことを確かめる。
