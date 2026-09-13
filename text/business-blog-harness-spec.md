# Business / Blog Prose Harness — Spec

`nlh` (Natural Language Validation Harness) の rule pack として、ビジネス文書とブログ記事を検証する。

前提仕様: [natural-language-validation-harness-spec.md](./natural-language-validation-harness-spec.md)

作成日: 2026-09-08

---

## 1. 概要

既存 spec の `nlh` は技術文書 / 仕様書 / README を主対象としている。本 spec はその rule model をそのまま使い、**ビジネス文書とブログ記事という別ジャンル向けの rule pack を、独立した npm パッケージとして定義する**。

対象:

```text
ビジネス文書
  提案書 / 企画書
  社内報告書
  メール / チャットの長文
  プレスリリース
  議事録
  営業資料の本文

ブログ
  技術ブログ
  オウンドメディア記事
  個人ブログ / エッセイ
  リリースノートの解説記事
```

最終形:

```bash
npx nlh-prose lint article.md
```

インストール不要、API key 不要、1 コマンドで deterministic な検証が走ること。これを設計の最優先制約とする（§13）。

---

## 2. 位置づけ

`nlh` core と本 pack は別パッケージとする。

```text
nlh                      core harness
  rule model
  executor dispatch
  finding format
  profile 解決
  CLI (lint / test / eval / explain / init)

nlh-prose                rule pack (本 spec)
  business / blog の rule 定義
  custom detector
  profile と threshold
  corpus と calibration 結果
  zero-config runner (npx 用の bin)
```

分ける理由:

1. リリースサイクルが違う。core の rule model は安定させたいが、prose rule は corpus calibration のたびに threshold が動く。
2. 依存が違う。prose rule は形態素解析や textlint preset に依存するが、core にその依存を持ち込みたくない。
3. ジャンル別 pack を並列に増やせる。将来 `nlh-academic` や `nlh-legal` を同じ interface で追加できる。

逆に、finding format / severity / CLI / CI 連携は core の責務であり、本 pack では再定義しない。

---

## 3. なぜ技術文書と評価軸を分けるのか

同じ「良い文章」でも、ジャンルによって最適化対象が違う。

| ジャンル | 最適化対象 | 悪いとされるもの |
| --- | --- | --- |
| 技術文書 | 一意性・再現性 | 曖昧さ、暗黙の前提、揺れ |
| ビジネス文書 | 意思決定を進めること | 結論の後置、責任の所在不明、根拠なき数字、依頼の不明確さ |
| ブログ | 読み進めさせること | 単調さ、水増し、具体の欠如、テンプレ構成 |

このため、同じ検出でも severity が反転する。

```text
体言止め
  技術文書  : 許容
  ビジネス文書: warning（スライド文体の混入）
  ブログ    : 許容（リズムを作る手段）

一文ごとに改行
  技術文書  : 推奨（diff が読める）
  ブログ    : 非推奨（レンダリング後の見た目が崩れる）

「〜かもしれません」
  技術文書  : 曖昧さとして warning
  ブログ    : 誠実さとして許容
  ビジネス文書: 二重ヘッジのみ warning
```

profile を single source にして、rule の有効/無効と severity と threshold をジャンルごとに切り替える。rule 本体は共有する。

---

## 4. パッケージ構成

```text
nlh-prose/
  package.json          bin: nlh-prose
  src/
    pack.ts             definePack() エントリ
    profiles/
      business.yaml
      business.proposal.yaml
      business.email.yaml
      business.press-release.yaml
      business.meeting-notes.yaml
      blog.yaml
      blog.tech.yaml
      blog.essay.yaml
      blog.owned-media.yaml
    rules/
      business/*.yaml
      blog/*.yaml
      shared/*.yaml
    detectors/
      *.ts                custom detector 実装
    lexicons/
      hedging.yaml
      cushion.yaml
      ai-tell.yaml
      closing-cliche.yaml
    runner/
      cli.ts              zero-config runner (§13.2)
  corpus/
    manifest.yaml         取得元 URL + hash（本体は同梱しない, §17）
  tests/
    <rule-id>/valid.md
    <rule-id>/invalid.md
```

rule / profile / lexicon は YAML で持ち、TypeScript は detector と runner だけに限定する。理由は既存 spec §5.2 と同じで、rule definition を source of truth に保つため。

---

## 5. nlh core に要求する Plugin API

別パッケージにする以上、core 側の contract を先に決める必要がある。本 spec が core に要求する最小 API を定義する。

```ts
// nlh/pack
export interface NlhPack {
  id: string;
  packApiVersion: 1;
  profiles: Record<string, ProfileDefinition>;
  rules: Record<string, RuleDefinition>;
  detectors: Record<string, Detector>;
  lexicons?: Record<string, string[]>;
}

export declare const definePack: (pack: NlhPack) => NlhPack;
```

detector に渡す文書モデル:

```ts
export interface NlhDocument {
  readonly path: string;
  readonly source: string;
  readonly ast: MarkdownAst;          // textlint 互換 AST
  readonly sections: Section[];       // 見出しで区切られた範囲
  readonly paragraphs: Paragraph[];
  readonly sentences: Sentence[];     // 文分割済み（位置情報つき）
  readonly morph: MorphAnalyzer | null; // 未セットアップ時は null（§12）
}

export type Detector = (
  doc: NlhDocument,
  options: Readonly<Record<string, unknown>>,
) => Finding[];
```

core に求める性質:

- pack は core の内部実装ではなく `nlh/pack` の型だけに依存する。
- `packApiVersion` が一致しない pack は起動時に明示的なエラーで拒否する（暗黙に動かさない）。
- profile は `extends` による継承を持つ。`blog.tech` は `blog` を継承し、差分だけ書く。
- `morph` が `null` のとき、形態素解析を要求する rule は「失敗」ではなく `skipped` として報告される。sentence 分割は形態素解析なしでも動く必要がある。
- detector は純関数とする。fs / network / clock に触れない。core が I/O を済ませてから呼ぶ。

`morph === null` を `skipped` として扱う点は重要で、これがないと npx zero-install 体験が成立しない（§12）。

---

## 6. Profile 階層

```text
prose                     共通の下敷き
  business
    business/proposal
    business/report
    business/email
    business/press-release
    business/meeting-notes
  blog
    blog/tech
    blog/essay
    blog/owned-media
```

継承の例:

```yaml
# profiles/blog.tech.yaml
id: blog/tech
extends: blog

rules:
  max-sentence-length:
    max_chars: 100
  concrete-evidence-density:
    severity: warning
    min_evidence_per_section: 1
  first-person-experience:
    enabled: false
```

初期 threshold（corpus calibration 前の暫定値。§17 で更新する）:

| profile | max_sentence_chars | max_paragraph_sentences | bold_per_section | sentence_length_cv_min |
| --- | --- | --- | --- | --- |
| business/proposal | 90 | 5 | 2 | 0.25 |
| business/report | 100 | 6 | 2 | 0.25 |
| business/email | 70 | 4 | 1 | - |
| business/press-release | 90 | 4 | 1 | - |
| business/meeting-notes | 80 | 3 | 0 | - |
| blog/tech | 100 | 6 | 2 | 0.30 |
| blog/essay | 140 | 8 | 1 | 0.35 |
| blog/owned-media | 90 | 5 | 3 | 0.30 |

`sentence_length_cv_min` は文長の変動係数の下限で、下回ると「リズムが単調」と判定する（§8 `sentence-rhythm`）。

---

## 7. Rule Catalog — Business

### 7.1 構造と意思決定

| id | type | severity | 内容 |
| --- | --- | --- | --- |
| `conclusion-first` | structural + semantic | warning | 冒頭 N 文（既定 3）または最初のセクションに結論・依頼・推奨が出ているか |
| `required-sections` | structural | error | profile ごとの必須見出しの有無 |
| `preamble-length` | structural | warning | 本題に入る前の段落数・文字数の上限 |
| `actionable-ask` | structural + semantic | warning | 依頼に対して「誰が」「いつまでに」が書かれているか |
| `decision-owner` | semantic | warning | 意思決定を求める文書で、決裁者と決裁事項が特定できるか |
| `risk-disclosure` | semantic | warning | 提案に対してリスク・デメリット・不採用時の影響が述べられているか |

`required-sections` の例:

```yaml
required-sections:
  type: structural
  severity: error
  profiles:
    business/proposal:
      - 背景 | 現状 | 課題
      - 提案 | 施策 | 打ち手
      - 効果 | 期待効果 | 見込み
      - コスト | 費用 | 見積
      - リスク | 懸念
      - next action | 次のアクション | 依頼事項
    business/meeting-notes:
      - 決定事項
      - ToDo | アクションアイテム
```

見出しの表記揺れを許すため、各要素は正規表現の alternation として書く。

`actionable-ask` は two-stage（§10）で実装する。まず deterministic に「依頼表現を含む文」を抽出し、その文の前後 2 文以内に期限表現（`\d+/\d+`、`〜まで`、`来週`、曜日、`EOD` など）と担当表現が存在するかを判定する。両方そろっていれば finding を出さない。片方欠けている候補だけを LLM judge に回す。

### 7.2 主体と責任

| id | type | severity | 内容 |
| --- | --- | --- | --- |
| `agentless-passive` | syntactic | warning | 主語のない受動態（「〜が実施される」「〜される予定です」）の密度 |
| `nominalization` | syntactic | info | 動詞の名詞化（「実施を行う」「検討を進める」）の多用 |
| `excessive-hedging` | lexical | warning | 二重以上のヘッジ（「〜かと思われる可能性があります」） |
| `sasete-itadaku` | lexical | info | 「させていただく」の密度 |
| `double-keigo` | syntactic | warning | 二重敬語（「お伺いさせていただきます」） |

`agentless-passive` は形態素解析を要求する（助動詞「れる / られる」を、可能・尊敬・自発と区別する必要がある）。`morph === null` のときは skip する。

### 7.3 数値と根拠

| id | type | severity | 内容 |
| --- | --- | --- | --- |
| `unsourced-number` | lexical proxy + semantic | warning | 効果を主張する数値に、出典・期間・母数のいずれもない |
| `unqualified-superlative` | lexical | warning | 「業界初」「最高」「唯一」に限定条件がない |
| `causal-mechanism` | semantic | warning | 因果の主張に機構の説明がない（core rule を business profile で有効化） |

`unsourced-number` の deterministic proxy:

```text
候補条件 = 同一文中に
    数値表現       ( \d+% | \d+倍 | \d+割 | \d+件 | \d+円 )
  かつ
    効果動詞       ( 向上 | 改善 | 削減 | 増加 | 短縮 | 成長 )
  かつ
    根拠マーカーなし ( 出典 | 調査 | n= | 期間 | 自社調べ | 参考 | [1] )
```

この条件に合致した文だけを LLM judge に渡す。

### 7.4 文体

| id | type | severity | 内容 |
| --- | --- | --- | --- |
| `no-mixed-desumasu` | syntactic | error | ですます調とである調の混在（textlint 再利用） |
| `redundant-expression` | lexical | warning | 「することができる」等の冗長表現（textlint 再利用） |
| `list-parallelism` | structural | warning | 箇条書き項目の文末形（用言止め / 体言止め）と長さの不揃い |
| `taigen-dome-in-prose` | syntactic | info | 箇条書き外の本文における体言止め |
| `cushion-phrase-density` | lexical + statistical | info | クッション表現（「お忙しいところ」「取り急ぎ」）の密度 |
| `internal-jargon` | lexical | warning | ユーザー定義の社内語辞書との照合。社外向け profile でのみ有効 |
| `undefined-acronym` | structural | warning | 略語の初出時に展開がない |

`list-parallelism` は deterministic に判定できる。同一リスト内の各項目について、文末が `名詞` で終わるか `用言` で終わるかを分類し、混在していれば report する。文字数の変動係数が閾値を超えた場合も対象とする。形態素解析があれば精度が上がるが、なくても文末 1 文字の種別（漢字 / ひらがな / 記号）と語尾パターンでおおむね判定できる。

`undefined-acronym` は、`[A-Z]{2,}` および設定された社内語リストの初出位置を取り、同一文または直後の括弧内に展開形があるかを見る。全て deterministic。

---

## 8. Rule Catalog — Blog

### 8.1 AI 臭と定型

| id | type | severity | 内容 |
| --- | --- | --- | --- |
| `ai-tell` | lexical | info | AI 生成に頻出するが人間も使う表現。単独では弱いシグナル |
| `padded-intro` | lexical + structural | warning | 「近年〜が注目されています」型の水増し導入 |
| `closing-cliche` | lexical | warning | 「いかがでしたか」「まとめると」型の定型結び |
| `rule-of-three` | statistical | info | 並列と箇条書きが常に 3 項目になる傾向 |
| `heading-echo` | structural | warning | 見出しの文言を直後の文がほぼそのまま反復する |

`ai-tell` は severity を info 固定とし、単独では CI を落とさない。既存 spec §16 の calibration 方針に従い、`natural-japanese` が「最後に」を人間 48 回 / AI 2 回として検出対象から外したのと同じ手続きで語彙を選別する。初期辞書はあくまで候補であり、corpus 評価前は experimental として扱う（§18）。

`heading-echo` は deterministic に実装できる。見出しテキストと直後の文の bigram Jaccard 係数が閾値（既定 0.6）を超えたら report する。

`rule-of-three` は「文書内の箇条書きのうち 3 項目のものが占める割合」と「`A、B、C` 形式の 3 項並列の出現数」を見る。単体では弱いが、`ai-tell` や `section-length-uniformity` と同時に発火した場合に信頼度が上がるため、core の複合シグナル機能（§16）で扱う。

### 8.2 リズムと分布

| id | type | severity | 内容 |
| --- | --- | --- | --- |
| `sentence-rhythm` | statistical | warning | 文長の変動係数が低すぎる（単調） |
| `section-length-uniformity` | statistical | info | 各セクションの長さが均一すぎる |
| `repeated-sentence-head` | structural | warning | 同じ文頭の連続 |
| `repeated-conjunction` | structural | warning | 同じ接続詞から始まる段落の連続（core rule を再利用） |
| `ngram-repetition` | statistical | warning | 同一 n-gram の反復（core rule を再利用） |
| `paragraph-length-variance` | statistical | info | 段落長が均一すぎる |

`section-length-uniformity` は AI 生成記事に強く出る。各 H2 セクションの文字数を取り、変動係数が閾値（既定 0.15）を下回れば report する。人間が書いた記事は節ごとの厚みが揃わないという経験則に基づくが、これはまさに corpus で検証すべき仮説であり、初期状態は experimental とする。

### 8.3 具体と内容

| id | type | severity | 内容 |
| --- | --- | --- | --- |
| `concrete-evidence-density` | statistical proxy | warning | セクションあたりの具体物（固有名詞・数値・コード・引用・リンク）が閾値未満 |
| `empty-conclusion` | semantic | warning | 結びが本文の要約でしかなく、新しい情報も判断もない |
| `title-body-alignment` | semantic | warning | タイトルが約束した内容を本文が扱っていない |
| `lead-promise-kept` | semantic | info | リード文で提示した問いに本文が答えている |
| `first-person-experience` | statistical | info | 一人称の体験記述の不在（essay profile のみ） |

`concrete-evidence-density` は semantic な「具体例がない」を deterministic に近似する proxy であり、本 pack の中心的なアイデアの一つになっている。次を数える。

```text
具体物 =
    数値表現
  + コードブロック / インラインコード
  + 外部リンク
  + 引用ブロック
  + 未知語（辞書にない片仮名語・英字トークン。固有名詞の近似）
```

セクション内の具体物が 0 のとき、そのセクションだけを `empty-conclusion` や semantic judge の候補にする。全文を LLM に渡さずに済む。

### 8.4 表記

| id | type | severity | 内容 |
| --- | --- | --- | --- |
| `bold-density` | structural | warning | 1 セクションあたりの太字数の上限 |
| `emoji-density` | lexical | info | 絵文字・装飾記号の密度 |
| `no-em-dash` | lexical | warning | ダッシュの使用（shared, §9） |
| `no-nakaguro-parallel` | lexical | warning | 中黒の並列使用（shared, §9） |

---

## 9. Shared Rule

business と blog の両方で有効にする rule を指す。core が既に持つものは再利用し、本 pack では profile ごとの severity と threshold だけを与える。

| id | 出所 | 備考 |
| --- | --- | --- |
| `no-em-dash` | 本 pack | 全 profile で有効 |
| `no-nakaguro-parallel` | 本 pack | 「A・B・C」を「A、B、C」に |
| `max-sentence-length` | core | profile 別 threshold |
| `max-paragraph-length` | core | profile 別 threshold |
| `repeated-conjunction` | core | |
| `ngram-repetition` | core | |
| `no-doubled-joshi` | textlint | |
| `no-doubled-conjunction` | textlint | |

---

## 10. Semantic Rule の two-stage 設計

既存 spec §5.1 の「最も安い deterministic check を優先する」を、semantic rule の内部にも適用する。semantic rule を「文書全体を LLM に投げる」実装にはしない。

```text
Stage 1  Candidate Filter   deterministic
             |              全文から判定対象範囲を絞る
             |              出力: 段落 / 文 / セクションの部分集合
             v
Stage 2  Judge              LLM
             |              絞られた範囲だけを rubric で判定
             v
         Finding
```

各 semantic rule は candidate filter の定義を必須とする。filter を持たない semantic rule は受け付けない。

| semantic rule | candidate filter |
| --- | --- |
| `unsourced-number` | 数値 + 効果動詞 + 根拠マーカー欠如を含む文 |
| `causal-mechanism` | 因果表現（`ため`, `により`, `結果`, `つながる`）を含む文 |
| `actionable-ask` | 依頼表現を含み、期限表現または担当表現が近傍にない文 |
| `risk-disclosure` | 文書全体（ただし見出しに `リスク|懸念|デメリット` があれば skip） |
| `empty-conclusion` | 最終セクションのみ。かつ `concrete-evidence-density` が 0 のとき |
| `paragraph-single-topic` | 段落長が上位 20% かつ接続詞が 2 個以上の段落 |
| `title-body-alignment` | 文書全体（見出しリストのみを渡す。本文は渡さない） |

これによって、典型的な 5000 字の記事で LLM に渡すトークンが全文の 1/10 以下になることを設計目標とする。

judge 呼び出しの契約:

- 入力は candidate と rubric と最小限の周辺文脈のみ。
- 出力は `{ violated: boolean, confidence: number, reason: string }` の構造化出力に固定する。
- 同一 (rule, candidate, rubric, model) のハッシュで結果をキャッシュする。キャッシュは `.nlh-cache/` に置き、CI でも再利用できるようにする。
- `confidence` が profile の閾値未満の finding は info に降格する。

---

## 11. 既存 textlint 資産の再利用

deterministic rule を全て自作しない。textlint を executor として使い、既存ルールで足りるものはそれに dispatch する（既存 spec §22「textlint は harness ではなく executor」）。

2026-09-08 時点で npm 上に存在を確認したもの:

| package | version | 用途 |
| --- | --- | --- |
| `textlint` | 15.8.0 | executor 本体 |
| `textlint-rule-preset-ja-technical-writing` | 12.0.2 | 文長・助詞・接続詞の基礎ルール |
| `textlint-rule-preset-jtf-style` | 3.0.3 | 表記統一。パッケージ名は小文字 `jtf-style` |
| `textlint-rule-preset-ja-spacing` | 3.0.3 | 和欧間スペース |
| `textlint-rule-no-mix-dearu-desumasu` | 6.0.4 | 文体混在 |
| `textlint-rule-ja-no-redundant-expression` | 4.0.1 | 冗長表現 |
| `textlint-rule-ja-no-weak-phrase` | 2.0.0 | 弱い表現 |
| `textlint-rule-ja-no-abusage` | 3.0.0 | 誤用 |
| `textlint-rule-no-doubled-joshi` | 5.1.1 | 助詞の連続 |
| `textlint-rule-no-doubled-conjunction` | 3.0.1 | 接続詞の連続 |
| `textlint-rule-no-doubled-conjunctive-particle-ga` | 3.0.0 | 「が」の連続 |
| `textlint-rule-sentence-length` | 5.2.1 | 文長 |
| `textlint-rule-ja-hiragana-fukushi` | 1.3.0 | 副詞のひらがな化 |
| `textlint-rule-max-kanji-continuous-len` | 1.1.1 | 漢字連続 |
| `textlint-rule-ja-unnatural-alphabet` | 2.0.1 | 不自然な英字 |

方針:

- preset をそのまま有効化せず、rule 単位で選び、profile ごとに severity を割り当てる。preset の既定 severity は本 pack の severity 体系（既存 spec §14）と一致しない。
- `textlint-rule-preset-jtf-style` は翻訳文向けの表記ルールが多く、ブログには過剰。`business/press-release` と `business/report` でのみ有効にする。
- 本 pack 独自の rule は、既存 textlint rule で表現できないもの（構造・統計・複数文にまたがるもの）に限る。

---

## 12. 形態素解析の扱い

§7.2 の `agentless-passive` や `double-keigo` は形態素解析を必要とする。しかしこれは npx 体験と正面から衝突する。

npm 上の実測値（2026-09-08 時点、`dist.unpackedSize`）:

| package | unpacked size |
| --- | --- |
| `kuromoji` 0.1.2 | 41.3 MB |
| `@sglkc/kuromoji` 1.1.0 | 18.3 MB |
| `budoux` 0.9.1 | 2.7 MB |
| `textlint` 15.8.0 | 0.24 MB |

辞書を同梱すると、`npx nlh-prose` の初回ダウンロードが数十 MB になり、「1 コマンドで試せる」という前提が崩れる。既存 spec が挙げる SudachiPy は Python 依存であり、npx 単体ではさらに成立しない。

したがって階層を分ける。

```text
Tier 0  形態素解析なし  既定。npx 即実行。
          文分割        句点・改行・括弧を考慮した規則ベース
          分節          budoux（任意, 2.7MB）
          対象 rule     structural / lexical / statistical のすべて

Tier 1  形態素解析あり  opt-in
          nlh-prose setup   で辞書を ~/.cache/nlh-prose/ に取得
          --with-morph      で有効化
          対象 rule     syntactic rule（agentless-passive, double-keigo, taigen-dome, nominalization）

Tier 2  SudachiPy      任意。Python 環境がある場合のみ。
          精度が要る calibration 作業と eval で使う。lint の常用パスには入れない。
```

Tier 0 だけで本 spec の rule の約 8 割が動くように rule を設計する。これは制約ではなく設計目標であり、§8.3 の proxy 方式（具体物の密度で semantic を近似する）や §7.4 の `list-parallelism`（語尾の字種で近似する）はこの目標から導かれている。

`--with-morph` なしで syntactic rule を実行しようとした場合は、エラーではなく次を出す。

```text
3 rules skipped (require morphological analysis)
  agentless-passive, double-keigo, nominalization
  run `npx nlh-prose setup` to enable
```

黙って通さないこと。skip を黙認すると「lint が通った」という誤った安心を与える。

---

## 13. npx で動かすための設計

最終目標は `npx nlh-prose lint article.md` の一発実行。これを満たすための具体的な制約を先に決める。

### 13.1 予算

| 項目 | 目標 |
| --- | --- |
| 初回 `npx`（キャッシュなし、Tier 0） | 10 秒以内 |
| パッケージと依存の合計 unpacked size（Tier 0） | 15 MB 以内 |
| 5000 字 Markdown 1 本の lint | 500 ms 以内 |
| 2 回目以降の起動（npm cache あり） | 2 秒以内 |
| `lint` の外部通信 | なし |
| `lint` の API key | 不要 |

`textlint` 本体が 0.24 MB、rule 群が各数十 KB なので、Tier 0 の予算は現実的といえる。形態素解析辞書を外に出すことがこの予算を成立させている（§12）。

### 13.2 2 つの入り口

zero-config runner と、core への plugin としての利用を両方用意する。

```bash
# 1. zero-config runner。nlh core を同梱し、profile を自動推定して即実行
npx nlh-prose lint article.md
npx nlh-prose lint docs/ --profile business/proposal

# 2. plugin として。既存の nlh 設定に組み込む
npx nlh lint article.md          # .nlh.yaml の packs: [nlh-prose] を解決
```

1 の runner は `nlh` を dependency に持ち、profile 解決と CLI をそこに委譲する薄い層とする。CLI のロジックを二重に持たない。

### 13.3 実装上の制約

- Node.js 22 以上。ESM のみ。
- `postinstall` スクリプトを持たない。npx 実行時に任意コードを走らせない。
- ネイティブアドオン依存を持たない。プラットフォーム差でインストールが失敗する原因になる。
- 辞書などの実行時ダウンロードは `setup` サブコマンドの中だけで行い、暗黙にはしない。
- 起動時に rule / lexicon YAML を全部読まない。有効な profile が参照するものだけを遅延読み込みする。
- CLI の終了コードは core の規約に従う（error が 1 件でもあれば非 0）。

### 13.4 profile 自動推定

`--profile` 省略時の推定順:

```text
1. .nlh-prose.yaml の profile
2. front matter の profile / type
3. パス規約     docs/ blog/ posts/ articles/ proposals/ minutes/
4. 内容ヒューリスティック
     「拝啓」「お世話になっております」「ご査収」 -> business/email
     「決定事項」「出席者」                      -> business/meeting-notes
     「報道関係者各位」                          -> business/press-release
5. 既定 prose（shared rule のみ）
```

推定した profile は必ず出力の 1 行目に表示する。どの規範で検証されたのかが分からない結果は使えない。

---

## 14. 設定ファイル

```yaml
# .nlh-prose.yaml
profile: blog/tech

# パス別の上書き
overrides:
  - files: ["proposals/**/*.md"]
    profile: business/proposal
  - files: ["minutes/**/*.md"]
    profile: business/meeting-notes

rules:
  ai-tell:
    severity: off          # このリポジトリでは使わない
  bold-density:
    max_per_section: 3
  internal-jargon:
    lexicon: ./lexicons/our-company.yaml

semantic:
  enabled: true
  model: claude-sonnet-5
  confidence_threshold: 0.7
  cache: .nlh-cache

experimental: false        # experimental rule を有効にするか（§18）
```

`nlh-prose init` でこのファイルと `lexicons/` の雛形を生成する。

---

## 15. CLI と出力例

core の CLI をそのまま使う。サブコマンドは追加しない。

```bash
npx nlh-prose lint article.md              # deterministic のみ
npx nlh-prose test article.md              # semantic を含む
npx nlh-prose eval corpus/blog/            # rule の評価
npx nlh-prose explain concrete-evidence-density
npx nlh-prose init
npx nlh-prose setup                        # 形態素解析辞書の取得
```

lint 出力:

```text
$ npx nlh-prose lint article.md

article.md  [profile: blog/tech (inferred from path)]

   3:1   warning  「近年、AIの活用が注目されています」は水増しの導入です
                  padded-intro

  24:1   warning  見出し「キャッシュの仕組み」を直後の文がほぼ反復しています
                  heading-echo

  41:12  warning  太字がこのセクションに 6 箇所あります (上限 2)
                  bold-density

  58:1   warning  文長の変動係数 0.18 (下限 0.30)。文の長さが単調です
                  sentence-rhythm

  71:1   info     3 項目の箇条書きが 5 個中 5 個です
                  rule-of-three

  92:1   warning  セクション「まとめ」に数値・コード・リンク・引用がありません
                  concrete-evidence-density

5 warnings, 1 info
2 rules skipped (require morphological analysis): agentless-passive, taigen-dome-in-prose
  run `npx nlh-prose setup` to enable
```

test 出力:

```text
$ npx nlh-prose test proposal.md

proposal.md  [profile: business/proposal]

deterministic
  ✓ required-sections
  ✓ no-mixed-desumasu
  ✗ conclusion-first        結論が 7 段落目にあります (上限 3 文以内)
  ✗ undefined-acronym       "SLA" が初出時に展開されていません

semantic  (4 candidates from 118 sentences, 2 cached)
  ✗ unsourced-number        confidence 0.88
      「導入により工数が 40% 削減されます」
      40% の算出根拠、対象期間、比較対象が本文にありません

  ✗ risk-disclosure         confidence 0.74
      提案の不採用時の影響と、導入に伴うリスクが述べられていません

  ✓ actionable-ask
  ✓ causal-mechanism

2 errors, 2 warnings
```

---

## 16. Finding Format の拡張

既存 spec §10 が定める形をそのまま使い、本 pack が足すのは 2 フィールドだけである。

```json
{
  "rule": "concrete-evidence-density",
  "severity": "warning",
  "file": "article.md",
  "line": 92,
  "message": "セクション「まとめ」に数値・コード・リンク・引用がありません",
  "executor": "custom",
  "confidence": 1.0,
  "profile": "blog/tech",
  "signals": ["rule-of-three", "section-length-uniformity"]
}
```

- `profile`: どの規範で判定されたか。ジャンル別 pack では必須。
- `signals`: 同一範囲で同時発火した弱いシグナルの一覧。

`signals` は、複合シグナルを作るための最小の仕組みである。`ai-tell` / `rule-of-three` / `section-length-uniformity` / `sentence-rhythm` はいずれも単独では info だが、同一文書で 3 つ以上そろった場合に「AI 生成の疑い」として 1 件の warning に集約する。個別に 20 件の info を出すより読みやすく、かつ誤検知に強い。

集約ルール自体も rule として定義する。

```yaml
ai-generated-composite:
  type: composite
  severity: warning
  requires:
    min_signals: 3
    from:
      - ai-tell
      - rule-of-three
      - section-length-uniformity
      - sentence-rhythm
      - padded-intro
      - closing-cliche
```

---

## 17. Calibration と Corpus

ジャンル別 pack である以上、technical 文書のコーパスで測った threshold は使えない。business と blog それぞれで測り直す。

```text
corpus/
  business/
    human-good/     公開されている質の高いビジネス文書
    human-ordinary/ ふつうの社内文書（匿名化済み）
    ai/             LLM に同じ題目で書かせたもの
  blog/
    human-good/     人間が書いた技術記事・エッセイ
    human-ordinary/
    ai/
```

corpus 本体はリポジトリに含めない。`corpus/manifest.yaml` に取得元 URL、ライセンス、取得日、内容ハッシュを記録し、`nlh-prose eval --fetch` で取得する。著作物を再配布しないためと、hash によって「いつの corpus で calibration したか」を再現可能にするため。

収集候補:

| 種別 | 候補 |
| --- | --- |
| business / human-good | 官公庁の公開資料、上場企業の IR 資料とプレスリリース |
| business / human-ordinary | 利用者が自分のリポジトリから供給（同梱しない） |
| blog / human-good | 企業技術ブログ、著者が明示された個人記事 |
| ai | 同一プロンプトで複数モデルに生成させる。プロンプトを corpus に含めて再現可能にする |

測定する指標は既存 spec §16 と同じ。

```text
Human good FP rate
AI detection rate
Precision / Recall
```

目標:

| profile | Human good FP |
| --- | --- |
| business | 5% 未満 |
| blog | 5% 未満 |
| blog/essay | 3% 未満（表現の自由度が高いため厳しく） |

`eval` は rule ごとに threshold を sweep し、`rules/*.yaml` の threshold に対する推奨値と、現在値との差分を出力する。threshold の更新は自動適用せず、差分を PR として提示する。

---

## 18. Rule Status と CI

core の rule status（既存 spec §18）に従う。

```text
experimental   corpus 評価前。既定で無効。--experimental で有効化
stable         corpus 評価済み。FP 目標を満たす
deprecated     置き換え済み
```

本 spec で定義した rule のうち、初期状態で `stable` を目指すのは deterministic で反証しやすいものに限る。

```text
stable 候補（Phase 1 で目指す）
  no-em-dash, no-nakaguro-parallel, bold-density, heading-echo,
  undefined-acronym, required-sections, list-parallelism,
  no-mixed-desumasu, max-sentence-length

experimental 開始（corpus 評価が必要）
  ai-tell, rule-of-three, section-length-uniformity, sentence-rhythm,
  concrete-evidence-density, padded-intro, cushion-phrase-density
```

CI:

```yaml
- name: prose lint
  run: npx nlh-prose lint docs/ --changed-only

- name: prose semantic test
  run: npx nlh-prose test docs/ --changed-only
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

`lint` は fork PR でも動く（API key 不要）。`test` は key がある環境でのみ実行し、key がなければ finding を出さずに skip 件数を報告して成功する。

---

## 19. Rule 自体の Unit Test

core の規約（既存 spec §19）に従い、rule ごとに fixture を持つ。

```text
tests/
  heading-echo/
    valid.md
    invalid.md
    expected.json
```

business / blog 特有の注意点として、`valid.md` には「その rule が誤検知しやすい人間の正常な文章」を必ず 1 つ以上入れる。禁止語ルールでは、その語を正当に使っている実例を valid 側に置く。これがないと、fixture が rule の実装を追認するだけになる。

---

## 20. MVP と Roadmap

### Phase 1 — npx で動く Tier 0

目標: `npx nlh-prose lint article.md` が形態素解析も API key もなしで動く。

```text
core の plugin API 確定（§5）
profile 階層と継承（§6）
deterministic rule 15 本前後
  no-em-dash, no-nakaguro-parallel, bold-density, heading-echo,
  undefined-acronym, required-sections, list-parallelism,
  padded-intro, closing-cliche, repeated-sentence-head,
  concrete-evidence-density, section-length-uniformity,
  sentence-rhythm, rule-of-three, preamble-length
textlint 再利用 rule の dispatch（§11）
profile 自動推定（§13.4）
JSON / text output
GitHub Actions
```

### Phase 2 — 形態素解析（Tier 1）

```text
nlh-prose setup による辞書取得
morph === null の skip 表示
syntactic rule
  agentless-passive, double-keigo, nominalization, taigen-dome-in-prose
list-parallelism の精度向上
```

### Phase 3 — Semantic（two-stage）

```text
candidate filter の実装（§10）
LLM judge と構造化出力
キャッシュ
semantic rule
  unsourced-number, actionable-ask, risk-disclosure, decision-owner,
  conclusion-first, empty-conclusion, title-body-alignment
複合シグナル（§16）
```

### Phase 4 — Calibration

```text
corpus manifest と取得スクリプト
eval と threshold sweep
experimental -> stable への昇格
FP dashboard
```

---

## 21. Non-goals

- 文章の面白さ、読者の反応、SEO 順位の予測。
- ブランドボイスへの適合判定。これは組織ごとの lexicon で近似するにとどめる。
- 単一スコアによる記事品質の評価。既存 spec §21 と同じ理由。
- 自動書き換え。検出と修正の分離（既存 spec §5.4）を維持する。
- AI 生成文章の断定的な判別。§16 の複合シグナルは「疑い」を示すものであり、判定器ではない。
- 英語その他の言語。本 pack は日本語のみを対象とする。

---

## 22. 要決定事項

実装前に確定させる必要があるもの。

1. パッケージ名。`nlh-prose` は仮称。2026-09-08 時点で `nlh`, `nlh-prose`, `nlh-pack-prose`, `prose-lint`, `bizlint`, `proselint-ja` はいずれも npm 未取得。core の `nlh` と合わせて先に押さえるかどうか。
2. business と blog を 1 パッケージにするか 2 つに割るか。本 spec は 1 パッケージ 2 profile 系統で書いている。rule の 4 割が shared であり、分けると lexicon と detector の重複が出るため。
3. core の plugin API（§5）を core 側の spec に反映するタイミング。本 pack が core の設計を先に規定してしまう形になっているため、core 側で受け入れ可能か確認が要る。
4. `sentence-rhythm` と `section-length-uniformity` の仮説検証。人間の良い記事でも節の長さが揃う場合があり、corpus 評価の結果次第では rule ごと落とす。
5. 形態素解析器の選定。`@sglkc/kuromoji`（18.3 MB）を setup で取得するか、budoux（2.7 MB）による分節で済ませる rule 設計に寄せるか。
