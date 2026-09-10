# chaff — Prose Validation Harness Spec

言語に依存しない文章検証ハーネス。ビジネス文書とブログ記事を第一の対象とする。

前提仕様: [natural-language-validation-harness-spec.md](./natural-language-validation-harness-spec.md)

本 spec は [business-blog-harness-spec.md](./business-blog-harness-spec.md) を置き換える。前版は日本語専用として設計していたが、rule を層に分けた結果、日本語に本質的に依存するのは全体の 1/5 程度であることが分かったため、言語を直交軸として切り出した。

作成日: 2026-09-08

---

## 0. 名前について

`chaff` は籾殻。脱穀したあとに残る、栄養のない外皮のこと。

この名前は **`lint` とまったく同じ命名論理**による。lint は布から出る繊維くずであり、ESLint はそれを名前にしている。linter は「取り除くべきカス」の名を負う道具である、という慣習がすでにある。自然言語版がその慣習を継ぐなら chaff になる。

```bash
npx chaff article.md
```

選定の根拠:

| 基準 | 評価 |
| --- | --- |
| 短さ | 5 文字 1 音節。npx で打ちやすく、口に出して言える |
| 比喩 | 「麦と籾殻をより分ける」。ツールの仕事が一語で伝わる |
| 言語中立性 | 聖書由来で多くの言語に等価な慣用句がある（籾殻 / Spreu / paja / balle / ivraie）。特定言語の文化に依存しない |
| 意味の適合 | 「取り除くべきもの」を名指しており、「ツールが直す」を含意しない。検出と修正の分離（§25）と矛盾しない |
| 既知のリスク | 軍事用語（レーダー欺瞞用の金属片）と同綴り。検索性でやや不利になる |

パッケージ名前空間:

```text
chaff                  harness core（npx の入口）
@chaff/lang-ja
@chaff/lang-en
@chaff/business
@chaff/blog
```

`chaff` は 2026-09-08 時点で npm 未取得。実装着手前に取得すること。

### 0.1 検討して外した候補

記録として残す。同じ検討を繰り返さないため。

| 候補 | 外した理由 |
| --- | --- |
| `stet` | 製品名にしない。校正記号 stet は「この指摘は無視してよい」の意であり、finding 抑制ディレクティブ（§20.3）に予約する |
| `corrigenda` | 意味は全候補中もっとも正確（ラテン語「訂正されるべき事項」＝ finding list の定義）だが、10 文字で口に出しにくい。キャッチーではなく上品 |
| `prosebench` `textbench` `plainprose` `bluepencil` | 明快だがキャッチーではない。定着した開発ツール名はほぼ 4〜6 文字 1〜2 音節の具体名詞であり、説明的な複合語はこの型から外れる |
| `corrigo` | Corrigo Inc.（JLL 傘下の SaaS）と商標衝突 |
| `emendo` `migaku` `akapen` | 「ツールが直してくれる」印象。§25 の検出と修正の分離と矛盾 |
| `strunk` `zinsser` | 英文作法の代名詞であり、言語非依存のハーネス名としてミスリード。実在の人名でもある |
| `crucible` | Atlassian Crucible（コードレビュー製品）と衝突 |
| `nutgraph` | 米ジャーナリズムの内輪語。global 方針と噛み合わない |
| 日本語ローマ字全般 | `suikou` `toishi` `migaku` ほか。global 方針により対象外 |

4 文字の英単語は npm でほぼ枯れている。`taut` `pare` `cull` `crux` `pith` `gist` `nib` `kern` `widow` `orphan` `sift` `winnow` はいずれも取得済み。この帯で空いていて実用に耐えたのは `chaff` `quoin` `ibid` のみだった。

---

## 1. 概要

自然言語の文章に対して、lint / unit test / review に相当する検証を行う。既存 spec が定めた rule model、finding format、severity、検証レイヤーをそのまま継承し、次の 2 点を追加する。

1. **言語を直交軸として切り出す。** 言語知識は `LanguageAdapter` に閉じ込め、rule 本体と genre profile は言語を知らない。
2. **ジャンル別 rule pack を別パッケージにする。** business と blog を第一の対象とする。

最終形:

```bash
npx chaff lint article.md
```

インストール不要、API key 不要、言語の指定不要（自動検出）。これを設計の最優先制約とする（§17）。

---

## 2. 既存 spec との関係

既存 spec（`nlh`）は概念仕様であり、対象を技術文書に置いていた。本 spec はその rule model を実装可能な形に落とし、対象をビジネス文書とブログに広げ、言語軸を追加する。

継承するもの:

```text
Rule を source of truth にする         既存 §5.2
Linter と Judge を分離する             既存 §5.3
検出と修正を分離する                   既存 §5.4
deterministic first                    既存 §22
finding format                         既存 §10
severity (error / warning / info)      既存 §14
rule status (experimental / stable)    既存 §18
corpus calibration                     既存 §16
textlint は harness ではなく executor  既存 §22
```

変更するもの:

```text
既存 §15 Profile
  ジャンルだけを切り替える単一軸だった
  → 言語 / ジャンル / 検証レイヤーの三軸に分解する（§3）

既存 §7.2 SudachiPy
  日本語形態素解析を前提に置いていた
  → LanguageAdapter の capability の一つに一般化する（§7, §16）

既存 §21 Non-goals
  「日本語のみ」を含んでいた
  → 削除する（§25）
```

---

## 3. 三つの直交軸

rule の振る舞いは三つの軸の積で決まる。

```text
        Language                Genre                  Layer
        言語                    ジャンル                検証レイヤー

        ja                      business/proposal      structural
        en                      business/email         lexical
        ...                     blog/tech              syntactic
                                blog/essay             statistical
                                                       semantic

        LanguageAdapter         GenrePack              Executor
        が提供                   が提供                  が実行
```

一つの rule は次のように分解される。

```text
rule "excessive-hedging"

  Layer     lexical           共通の phrase-density detector を使う
  Language  ja / en           語彙表を adapter から取る
  Genre     business = warning / blog/essay = info
```

この分解により、次が成立する。

- 新しい言語を足すとき、adapter を 1 つ書けば既存 rule の大半がそのまま動く。
- 新しいジャンルを足すとき、profile を 1 つ書けば既存 rule がそのまま動く。
- rule を足すとき、どの層に属するかを決めれば、言語とジャンルへの展開は自動。

---

## 4. Rule の四層モデル

言語依存の度合いで rule を四層に分ける。これが本 spec の中核。

```text
L1  Universal Detector          言語知識ゼロ
      文書構造と統計のみを見る。adapter の sentenceSplit だけに依存する。
      例: 太字の密度、セクション長の均一さ、文長の変動係数

L2  Lexicon-parameterized       detector 共通、語彙表が言語別
      共通の照合エンジンに、adapter が提供する語彙表を渡す。
      例: 空虚な強調、水増し導入、AI 臭、ヘッジ表現

L3  Language-specific           その言語の形態論・正書法に依存
      adapter が detector ごと提供する。capability が足りなければ skip。
      例: ですます / である混在、二重敬語、中黒の並列、英語の受動態

L4  Semantic                    LLM judge
      rubric を言語別に翻訳して持つ。判定自体は言語非依存。
      例: 結論が根拠に支えられているか、依頼に期限と担当があるか
```

本 spec が定義する rule の内訳:

| 層 | 本数 | 新言語追加時のコスト |
| --- | --- | --- |
| L1 Universal | 16 | ゼロ |
| L2 Lexicon | 11 | 語彙表を書く |
| L3 Language-specific | 言語ごとに 8 前後 | detector を実装する |
| L4 Semantic | 9 | rubric を訳す |

新しい言語のサポートは、L2 の語彙表と L4 の rubric 翻訳だけで 36 本中 27 本が動く状態から始められる。

重要な点として、**L3 の rule でも概念は普遍であることが多い**。`agentless-passive`（主語のない受動態）と `nominalization`（動詞の名詞化）は、日本語では形態素解析、英語では品詞タグという別々の detector を要するが、指摘している悪癖は同一である。したがって rule id は共有し、実装だけを adapter 別に持つ（§6）。

---

## 5. パッケージ構成

```text
chaff                  harness core
  rule model / executor dispatch / finding format
  L1 universal detector
  L2 照合エンジン
  L4 judge runner と candidate filter 基盤
  言語検出
  CLI (lint / test / eval / explain / init / setup)

@chaff/lang-ja         日本語アダプタ
  文分割 / 分節 / 形態素解析ブリッジ
  ja lexicon (L2)
  ja 固有 detector (L3)
  textlint ja rule への dispatch

@chaff/lang-en         英語アダプタ
  文分割 / トークナイズ / 品詞タグ
  en lexicon (L2)
  en 固有 detector (L3)

@chaff/business        ビジネス文書 genre pack
  profile (proposal / report / email / press-release / meeting-notes)
  business 固有の L1 rule と L4 rubric
  required-sections の見出し定義（言語別）

@chaff/blog            ブログ genre pack
  profile (tech / essay / owned-media)
  blog 固有の L1 rule と L4 rubric
```

genre pack を core から分ける理由は前版と同じ。リリースサイクルが違い（core の rule model は安定させたいが threshold は calibration のたびに動く）、依存が違い（genre pack は adapter に依存しない）、ジャンルを並列に増やせるため。

`@chaff/business` と `@chaff/blog` は **adapter に依存しない**。これが四層モデルの帰結であり、「ビジネス文書の書き方」が言語を越えて共通であるという主張でもある。

---

## 6. Plugin API

core が公開する contract。genre pack と language adapter はこの型だけに依存する。

```ts
// chaff/plugin

export interface GenrePack {
  readonly kind: "genre";
  readonly id: string;
  readonly apiVersion: 1;
  readonly profiles: Record<string, ProfileDefinition>;
  readonly rules: Record<string, RuleDefinition>;
  readonly detectors: Record<string, Detector>;   // L1 のみ
}

export interface LanguageAdapter {
  readonly kind: "language";
  readonly id: string;                 // BCP 47 の primary subtag: "ja", "en"
  readonly apiVersion: 1;
  readonly capabilities: AdapterCapabilities;
  detect(source: string): number;      // この言語である確度 0..1
  segment(text: string): Segmentation;
  lexicons: Record<string, Lexicon>;   // L2
  rules: Record<string, RuleDefinition>;  // L3
  detectors: Record<string, Detector>;    // L3
}

export interface AdapterCapabilities {
  readonly sentenceSplit: true;   // 必須
  readonly wordSplit: boolean;
  readonly pos: boolean;          // 品詞
  readonly lemma: boolean;
  readonly lengthUnit: "char" | "word";
}
```

rule 定義は必要な capability を宣言する。

```yaml
agentless-passive:
  description: 主語のない受動態
  layer: L3
  requires:
    pos: true
  implementedBy:
    ja: ja/agentless-passive
    en: en/agentless-passive
  severity:
    business: warning
    blog: info
```

`implementedBy` に文書の言語のエントリがなければ、その rule は `unsupported` として報告される。`requires` を満たさなければ `skipped` として報告される。いずれも silent pass にはしない（§17.4）。

detector に渡す文書モデル:

```ts
export interface ProseDocument {
  readonly path: string;
  readonly source: string;
  readonly ast: MarkdownAst;         // textlint 互換 AST
  readonly language: string;         // 検出結果
  readonly adapter: LanguageAdapter;
  readonly sections: Section[];
  readonly paragraphs: Paragraph[];
  readonly sentences: Sentence[];
  readonly lists: ListBlock[];
}

export type Detector = (
  doc: ProseDocument,
  options: Readonly<Record<string, unknown>>,
) => Finding[];
```

core に求める性質:

- detector は純関数とする。fs / network / clock に触れない。core が I/O を済ませてから呼ぶ。
- `apiVersion` が一致しない plugin は起動時に明示的なエラーで拒否する。
- profile は `extends` による継承を持つ。
- L1 detector は `doc.adapter` の `segment` 以外を使ってはならない。これを lint で強制する（§23）。

---

## 7. LanguageAdapter の contract

adapter が最低限提供するもの:

```ts
export interface Segmentation {
  readonly sentences: Span[];
  readonly words?: Span[];     // wordSplit が true のとき
  readonly tokens?: Token[];   // pos が true のとき
}

export interface Token {
  readonly span: Span;
  readonly surface: string;
  readonly pos: string;        // Universal POS tag
  readonly lemma?: string;
}
```

品詞タグは Universal Dependencies の UPOS に統一する。adapter ごとに独自の品詞体系を露出させない。日本語の形態素解析器も英語の POS tagger も UPOS に写像してから返す。これがないと L3 detector が adapter の実装詳細に結合する。

`lengthUnit` の存在理由:

```text
max-sentence-length は L1 rule だが、
  日本語 100 文字  ≒  英語 25 語
であり、閾値の単位が言語で違う。

adapter が lengthUnit を宣言し、
profile は言語別の閾値を持つ（§9）。
```

### 7.1 MVP で実装する adapter

| adapter | sentenceSplit | wordSplit | pos | lengthUnit |
| --- | --- | --- | --- | --- |
| `lang-ja` Tier 0 | 規則ベース（句点・改行・括弧） | budoux（任意） | false | char |
| `lang-ja` Tier 1 | 同上 | 形態素解析 | true | char |
| `lang-en` Tier 0 | 規則ベース（略語辞書つき） | 空白 + 句読点 | false | word |
| `lang-en` Tier 1 | 同上 | 同上 | true | word |

英語は Tier 0 と Tier 1 の差が小さい。日本語は形態素解析辞書のサイズが npx 体験に直撃するため差が大きい（§16）。

---

## 8. 言語検出

`--lang` 省略時の決定順:

```text
1. 設定ファイルの language
2. front matter の lang / language
3. ファイル名の言語サフィックス   README.ja.md, guide.en.md
4. パス規約                       docs/ja/, content/en/
5. 内容による検出
     各 adapter の detect() を呼び、最大スコアを取る
     ja: ひらがな・カタカナ・漢字の出現率
     en: Latin script 比率と空白密度と機能語の出現
6. 決まらなければエラー。推測で走らせない
```

補足:

- コードブロック、インラインコード、URL、front matter は検出から除外する。技術文書は英語のコードを大量に含むため、除外しないと日本語文書が英語と判定される。
- 混在文書はセクション単位で判定し、セクションごとに adapter を切り替える。多言語 README のように言語別セクションを持つ文書は実在する。
- 検出結果と判定根拠を出力の 1 行目に必ず表示する。どの言語規範で検証されたか分からない結果は使えない。

---

## 9. Genre Profile

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

profile は言語を知らないが、閾値だけは言語別に持つ必要がある（§7 `lengthUnit`）。

```yaml
# @chaff/blog/profiles/blog.tech.yaml
id: blog/tech
extends: blog

rules:
  max-sentence-length:
    by_language:
      ja: { max: 100, unit: char }
      en: { max: 25,  unit: word }
      default: { max: 25, unit: word }

  concrete-evidence-density:
    severity: warning
    min_evidence_per_section: 1

  first-person-experience:
    enabled: false
```

初期閾値（calibration 前の暫定値。§21 で更新する）:

| profile | 文長 ja / en | 段落あたり文数 | 太字/節 | 文長 CV 下限 |
| --- | --- | --- | --- | --- |
| business/proposal | 90 char / 22 word | 5 | 2 | 0.25 |
| business/report | 100 char / 25 word | 6 | 2 | 0.25 |
| business/email | 70 char / 18 word | 4 | 1 | - |
| business/press-release | 90 char / 22 word | 4 | 1 | - |
| business/meeting-notes | 80 char / 20 word | 3 | 0 | - |
| blog/tech | 100 char / 25 word | 6 | 2 | 0.30 |
| blog/essay | 140 char / 35 word | 8 | 1 | 0.35 |
| blog/owned-media | 90 char / 22 word | 5 | 3 | 0.30 |

---

## 10. Rule Catalog — L1 Universal

言語知識を使わない。adapter の `sentences` と Markdown AST だけを見る。新しい言語で無条件に動く。

| id | 見るもの | genre | 既定 severity |
| --- | --- | --- | --- |
| `bold-density` | 1 セクションあたりの強調数 | 両方 | warning |
| `heading-echo` | 見出しと直後の文の character trigram Jaccard | 両方 | warning |
| `section-length-uniformity` | セクション長の変動係数 | blog | info |
| `sentence-rhythm` | 文長の変動係数の下限 | blog | warning |
| `paragraph-length-variance` | 段落長の変動係数 | blog | info |
| `repeated-sentence-head` | 同じ先頭 N 文字で始まる文の連続 | 両方 | warning |
| `ngram-repetition` | character n-gram の反復 | 両方 | warning |
| `rule-of-three` | 3 項目の箇条書きが占める割合 | blog | info |
| `concrete-evidence-density` | 数値・コード・リンク・引用の密度 | blog | warning |
| `max-sentence-length` | 文長 | 両方 | warning |
| `max-paragraph-length` | 段落あたり文数 | 両方 | warning |
| `required-sections` | 必須見出しの有無 | business | error |
| `preamble-length` | 本題前の段落数 | business | warning |
| `undefined-acronym` | 略語の初出時の展開 | business | warning |
| `emoji-density` | 絵文字・装飾記号の密度 | blog | info |
| `list-length-variance` | 箇条書き項目の長さのばらつき | business | info |

設計上の注意:

`heading-echo` と `ngram-repetition` は **character n-gram** を使う。word n-gram にすると `wordSplit` capability を要求することになり L2 に落ちる。character trigram なら日本語でも英語でも同じ実装で動き、精度も実用的。

`required-sections` の見出し定義は genre pack が言語別に持つ。

```yaml
required-sections:
  layer: L1
  severity: error
  sections:
    business/proposal:
      ja:
        - 背景 | 現状 | 課題
        - 提案 | 施策 | 打ち手
        - 効果 | 期待効果
        - コスト | 費用 | 見積
        - リスク | 懸念
        - next action | 次のアクション | 依頼事項
      en:
        - background | context | problem
        - proposal | recommendation
        - impact | expected outcome
        - cost | budget | estimate
        - risk | tradeoff
        - next steps | ask
```

detector は言語を知らず、profile から渡された正規表現の配列を照合するだけ。

`concrete-evidence-density` は「具体例がない」という semantic な指摘を deterministic に近似する proxy であり、本 spec の中心的な仕掛けの一つ。数える対象は次のとおり。

```text
具体物 =
    数値表現
  + コードブロック / インラインコード
  + 外部リンク
  + 引用ブロック
```

セクション内の具体物が 0 のとき、そのセクションだけを L4 judge の候補に渡す（§14）。全文を LLM に渡さずに済む。前版では「未知語（固有名詞の近似）」も数えていたが、これは辞書を要するため L2 に移した。

---

## 11. Rule Catalog — L2 Lexicon-parameterized

detector は core が持ち、語彙表を adapter から取る。新しい言語では語彙表を書くだけで動く。

| id | detector | genre | 既定 severity |
| --- | --- | --- | --- |
| `empty-intensifier` | phrase-match | 両方 | warning |
| `excessive-hedging` | phrase-density + 近接共起 | business | warning |
| `cushion-phrase-density` | phrase-density | business | info |
| `unqualified-superlative` | phrase-match + 限定句の不在 | business | warning |
| `unsourced-number` | pattern-cooccurrence | business | warning |
| `internal-jargon` | phrase-match（ユーザー辞書） | business | warning |
| `repeated-conjunction` | 段落先頭の語彙照合 | 両方 | warning |
| `ai-tell` | weighted phrase-match | blog | info |
| `padded-intro` | phrase-match（冒頭限定） | blog | warning |
| `closing-cliche` | phrase-match（末尾限定） | blog | warning |
| `proper-noun-density` | 未知語率 | blog | info |

共通 detector は 4 種類しかない。

```text
phrase-match           語彙表との照合。位置制約（冒頭 / 末尾 / 見出し直後）を取る
phrase-density         単位長あたりの出現率が閾値を超える
pattern-cooccurrence   複数条件の同一文内共起、および除外条件
weighted phrase-match  各エントリの weight を合算し、文書スコアを出す
```

lexicon の形式:

```yaml
# @chaff/lang-en/lexicons/ai-tell.yaml
id: ai-tell
language: en
entries:
  - pattern: "delve into"
    weight: 0.8
  - pattern: "it's not just \\w+, it's"
    type: regex
    weight: 0.9
  - pattern: "tapestry"
    weight: 0.6
  - pattern: "in today's fast-paced world"
    weight: 0.9
```

```yaml
# @chaff/lang-ja/lexicons/ai-tell.yaml
id: ai-tell
language: ja
entries:
  - pattern: "重要なのは"
    weight: 0.4
  - pattern: "見ていきましょう"
    weight: 0.7
  - pattern: "ではないでしょうか"
    weight: 0.5
```

`weight` は corpus calibration で決める（§21）。人間も高頻度で使う表現は weight を下げるか、語彙表から外す。`natural-japanese` が「最後に」を人間 48 回 / AI 2 回の実測により検出対象から外したのと同じ手続きを、言語ごとに繰り返す。

`unsourced-number` の共起パターン:

```yaml
unsourced-number:
  layer: L2
  detector: pattern-cooccurrence
  scope: sentence
  require:
    - lexicon: numeric-expression     # 言語別。数値の書式が違う
    - lexicon: effect-verb            # 向上/改善/削減 | improve/reduce/increase
  exclude:
    - lexicon: evidence-marker        # 出典/調査/n= | source/survey/n=
  then: candidate_for_semantic        # L4 judge に渡す（§14）
```

---

## 12. Rule Catalog — L3 Language-specific

adapter が detector ごと提供する。rule id は言語間で共有し、実装だけを差し替える。

### 12.1 言語横断で概念が共通のもの

| id | ja の detector | en の detector | genre |
| --- | --- | --- | --- |
| `agentless-passive` | 助動詞「れる/られる」の受動用法かつ動作主なし | AUX + VERB(past participle) かつ by 句なし | business |
| `nominalization` | サ変名詞 + 「を行う/を実施する」 | 動詞由来名詞 + 軽動詞（make / conduct / perform） | business |
| `sentence-fragment` | 述語のない文 | 定動詞のない文 | 両方 |
| `list-parallelism` | 項目末尾の品詞の混在 | 項目先頭の品詞の混在 | business |

`agentless-passive` と `nominalization` は Orwell の "Politics and the English Language" が挙げる悪癖と、日本語ビジネス文書で責任の所在が曖昧になる現象が同一のものであることを示す例。rule として一本化する価値がある。

### 12.2 日本語固有

| id | 内容 | requires |
| --- | --- | --- |
| `no-mixed-desumasu` | ですます調とである調の混在 | pos |
| `double-keigo` | 二重敬語 | pos |
| `sasete-itadaku` | 「させていただく」の密度 | - |
| `taigen-dome-in-prose` | 箇条書き外の体言止め | pos |
| `no-nakaguro-parallel` | 中黒の並列使用 | - |
| `no-doubled-joshi` | 助詞の連続 | pos |
| `hiragana-fukushi` | 副詞のひらがな化 | pos |
| `max-kanji-continuous` | 漢字の連続 | - |

### 12.3 英語固有

| id | 内容 | requires |
| --- | --- | --- |
| `adverb-overuse` | -ly 副詞の密度 | pos |
| `expletive-construction` | there is / there are / it is ... that | pos |
| `oxford-comma-consistency` | 文書内での一貫性（有無自体は問わない） | - |
| `sentence-initial-conjunction-run` | And / But / So で始まる文の連続 | - |
| `contraction-consistency` | 短縮形の使用が文書内で一貫しているか | - |
| `title-case-consistency` | 見出しの大文字化規則の一貫性 | - |

英語固有 rule は「どちらが正しいか」を決めず、**文書内の一貫性**だけを見るものを優先する。Oxford comma の是非のようにスタイルガイドで割れる論点に立場を取ると、rule が使われなくなる。

### 12.4 記号

`no-em-dash` は記号なので L1 に置けるが、許容度が言語で大きく違うため genre profile 側で言語別 severity を持つ。

```yaml
no-em-dash:
  layer: L1
  severity:
    ja: warning        # 日本語組版でダッシュは扱いが難しい
    en: info           # 英語では正当な用法が多い。ただし現在は AI tell としても強い
```

英語における em dash の多用は、2026 年時点で最も知られた AI 生成のシグナルの一つ。ただし人間の熟練した書き手も多用するため、単独では info とし、複合シグナル（§20.2）で扱う。

---

## 13. Rule Catalog — L4 Semantic

LLM judge が判定する。rubric を言語別に持つ以外は言語非依存。

| id | genre | severity | rubric の要点 |
| --- | --- | --- | --- |
| `conclusion-first` | business | warning | 結論・依頼・推奨が冒頭に置かれているか |
| `actionable-ask` | business | warning | 依頼に対して担当と期限が特定できるか |
| `decision-owner` | business | warning | 決裁者と決裁事項が特定できるか |
| `risk-disclosure` | business | warning | リスク・デメリット・不採用時の影響が述べられているか |
| `unsourced-number` | business | warning | 効果を主張する数値に根拠があるか |
| `causal-mechanism` | 両方 | warning | 因果の主張に機構の説明があるか |
| `paragraph-single-topic` | 両方 | warning | 一段落に独立した複数の論点がないか |
| `empty-conclusion` | blog | warning | 結びに本文の要約以上のものがあるか |
| `title-body-alignment` | blog | warning | タイトルが約束した内容を本文が扱っているか |

rubric は adapter ではなく genre pack が持つ。ビジネス文書の規範はジャンルの性質であって言語の性質ではないため。

```yaml
risk-disclosure:
  layer: L4
  severity: warning
  rubric:
    ja: |
      提案を行っている文書について、次のいずれかが本文に存在すること。
      施策のリスク、想定される副作用、不採用時の影響。
      「課題」の記述はリスクの記述として扱わない。
    en: |
      For a document making a proposal, at least one of the following
      must be present: risks of the proposed action, expected side
      effects, or the consequence of not acting.
      A description of the current problem does not count as a risk.
```

judge の出力言語は文書の言語に合わせる。日本語の文書に英語の指摘が返ると使われない。

---

## 14. Semantic の two-stage 設計

既存 spec §5.1「最も安い deterministic check を優先する」を、semantic rule の内部にも適用する。文書全体を LLM に投げる実装は禁止する。

```text
Stage 1  Candidate Filter   deterministic (L1 / L2)
             |              全文から判定対象範囲を絞る
             |              出力: 段落 / 文 / セクションの部分集合
             v
Stage 2  Judge              LLM
             |              絞られた範囲だけを rubric で判定
             v
         Finding
```

**candidate filter を持たない L4 rule は受け付けない。** これを plugin の読み込み時に検証する。

| L4 rule | candidate filter | filter の層 |
| --- | --- | --- |
| `unsourced-number` | 数値 + 効果動詞 + 根拠マーカー欠如を含む文 | L2 |
| `causal-mechanism` | 因果表現を含む文 | L2 |
| `actionable-ask` | 依頼表現を含み、期限表現も担当表現も近傍にない文 | L2 |
| `decision-owner` | 依頼表現を含む文があり、かつ人物・役職の言及がない | L2 |
| `risk-disclosure` | 文書全体。ただし `required-sections` がリスク節を検出したら skip | L1 |
| `empty-conclusion` | 最終セクションのみ。かつ `concrete-evidence-density` が 0 | L1 |
| `paragraph-single-topic` | 段落長が上位 20% かつ接続詞が 2 個以上の段落 | L1 + L2 |
| `title-body-alignment` | タイトルと見出しリストのみを渡す。本文は渡さない | L1 |
| `conclusion-first` | 冒頭 N 段落のみ | L1 |

設計目標は、5000 字相当の文書で LLM に渡すトークンを全文の 1/10 以下にすること。

judge 呼び出しの契約:

- 入力は candidate と rubric と最小限の周辺文脈のみ。
- 出力は `{ violated: boolean, confidence: number, reason: string }` の構造化出力に固定する。
- `(rule, candidate, rubric, model)` のハッシュでキャッシュする。キャッシュは `.chaff-cache/` に置き、CI でも再利用できるようにする。
- `confidence` が profile の閾値未満の finding は info に降格する。

---

## 15. 既存資産の再利用

deterministic rule を全て自作しない。言語 adapter は、その言語で既に存在する linter を executor として dispatch する（既存 spec §22「textlint は harness ではなく executor」）。

### 15.1 lang-ja

2026-09-08 時点で npm 上に存在とバージョンを確認したもの:

| package | version | 用途 |
| --- | --- | --- |
| `textlint` | 15.8.0 | executor 本体 |
| `textlint-rule-preset-ja-technical-writing` | 12.0.2 | 文長・助詞・接続詞 |
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

- preset をそのまま有効化せず、rule 単位で選び、genre profile ごとに severity を割り当てる。preset の既定 severity は本 spec の severity 体系と一致しない。
- `textlint-rule-preset-jtf-style` は翻訳文向けの表記ルールが多くブログには過剰。`business/press-release` と `business/report` でのみ有効にする。
- 本 spec 独自の L3 detector は、既存 textlint rule で表現できないものに限る。

### 15.2 lang-en

英語には成熟した既存資産があるが、いずれも本 spec の rule model には直接載らない。

```text
Vale          rule 定義が YAML で、思想が近い。ただし Go 実装で npx 経由の同梱に向かない
proselint     Python 実装。同じ理由
write-good    Node 実装で軽量。L3 の一部を dispatch できる
retext        Node 実装の自然言語処理基盤。unified エコシステム
```

MVP では `write-good` と `retext` 系の rule を評価し、載るものだけ dispatch する。Vale の rule 定義形式は L2 lexicon の設計上の参考にするが、実行時依存にはしない。

---

## 16. Analyzer Tier

L3 rule の多くは `pos` capability を要求する。しかし品詞解析の導入コストは言語で大きく違い、日本語では npx 体験に直撃する。

npm 上の実測値（2026-09-08 時点、`dist.unpackedSize`）:

| package | unpacked size |
| --- | --- |
| `kuromoji` 0.1.2 | 41.3 MB |
| `@sglkc/kuromoji` 1.1.0 | 18.3 MB |
| `budoux` 0.9.1 | 2.7 MB |
| `textlint` 15.8.0 | 0.24 MB |

日本語辞書を同梱すると `npx chaff` の初回ダウンロードが数十 MB になり、「1 コマンドで試せる」という前提が崩れる。既存 spec が挙げる SudachiPy は Python 依存であり、npx 単体ではさらに成立しない。

そこで tier を adapter の capability として一般化する。

```text
Tier 0   pos: false     既定。npx 即実行
           lang-ja  規則ベースの文分割。budoux は任意
           lang-en  規則ベースの文分割と空白トークナイズ
           動く rule  L1 全部 + L2 全部 + L4 全部

Tier 1   pos: true      opt-in
           chaff setup <lang>  で解析器を ~/.cache/chaff/ に取得
           動く rule  L3 を含む全部

Tier 2   高精度         任意。eval と calibration 専用
           lang-ja  SudachiPy (Python)
           lang-en  spaCy (Python)
           lint の常用パスには入れない
```

Tier 0 だけで rule の 36 本中 27 本（75%）が動く。これは制約ではなく設計目標であり、§10 の character n-gram 採用や §11 の proxy 方式はこの目標から導かれている。

英語は Tier 0 と Tier 1 の差が小さく、辞書サイズの問題もないため、`lang-en` は Tier 1 を既定にできる可能性がある。MVP では計測してから決める。

---

## 17. npx で動かすための設計

最終目標は `npx chaff lint article.md` の一発実行。

### 17.1 予算

| 項目 | 目標 |
| --- | --- |
| 初回 `npx`（キャッシュなし、Tier 0） | 10 秒以内 |
| パッケージと依存の合計 unpacked size（core + adapter 1 つ + genre pack 1 つ、Tier 0） | 15 MB 以内 |
| 5000 字 Markdown 1 本の lint | 500 ms 以内 |
| 2 回目以降の起動（npm cache あり） | 2 秒以内 |
| `lint` の外部通信 | なし |
| `lint` の API key | 不要 |

`textlint` 本体が 0.24 MB、rule 群が各数十 KB なので Tier 0 の予算は現実的。品詞解析器を外に出すことがこの予算を成立させている。

### 17.2 既定の依存構成

```text
npx chaff          core のみ
  adapter と genre pack は optionalDependencies ではなく、
  実行時に必要になったものだけを npx が解決する
```

問題は、`npx chaff article.md` の時点ではまだ言語もジャンルも分からないこと。そこで core は次の順で動く。

```text
1. core だけを起動する
2. 軽量な言語検出（文字種ヒストグラム）で言語を推定する
   これは adapter を必要としない。core が持つ
3. 必要な adapter と genre pack を解決する
   ローカルに無ければ、確認のうえ取得する
4. lint を実行する
```

3 の取得を暗黙に行わない。次を表示して同意を取る。

```text
chaff needs @chaff/lang-ja and @chaff/blog (2.9 MB).
Install? [Y/n]
```

`--yes` と CI 環境（`CI=true`）では確認を省略する。

### 17.3 実装上の制約

- Node.js 22 以上。ESM のみ。
- `postinstall` スクリプトを持たない。npx 実行時に任意コードを走らせない。
- ネイティブアドオン依存を持たない。プラットフォーム差でインストールが失敗する原因になる。
- 解析器の実行時ダウンロードは `setup` サブコマンドの中だけで行い、暗黙にはしない。
- rule / lexicon YAML を起動時に全部読まない。有効な profile が参照するものだけを遅延読み込みする。
- CLI の終了コードは error が 1 件でもあれば非 0。

### 17.4 skip と unsupported を黙認しない

capability 不足や adapter 不在で rule が走らなかった場合、成功として扱わない。

```text
3 rules skipped (require POS tagging)
  agentless-passive, double-keigo, taigen-dome-in-prose
  run `npx chaff setup ja` to enable

1 rule unsupported for language "ko"
  oxford-comma-consistency
```

黙って通すと「lint が通った」という誤った安心を与える。`--strict` で skip を error に昇格できるようにする。

---

## 18. 設定ファイル

```yaml
# .chaff.yaml
genre: blog/tech
# language: ja        # 省略時は自動検出（§8）

overrides:
  - files: ["proposals/**/*.md"]
    genre: business/proposal
  - files: ["minutes/**/*.md"]
    genre: business/meeting-notes
  - files: ["docs/en/**/*.md"]
    language: en

rules:
  ai-tell:
    severity: off
  bold-density:
    max_per_section: 3
  internal-jargon:
    lexicon: ./lexicons/our-company.yaml

semantic:
  enabled: true
  model: claude-sonnet-5
  confidence_threshold: 0.7
  cache: .chaff-cache

strict: false          # skip を error に昇格するか
experimental: false    # experimental rule を有効にするか（§22）
```

`chaff init` でこのファイルと `lexicons/` の雛形を生成する。

---

## 19. CLI と出力例

```bash
npx chaff lint article.md              # deterministic のみ（L1 / L2 / L3）
npx chaff test article.md              # L4 semantic を含む
npx chaff eval corpus/ja/blog/         # rule の評価
npx chaff explain concrete-evidence-density
npx chaff init
npx chaff setup ja                     # 形態素解析器の取得
npx chaff setup en
```

lint 出力:

```text
$ npx chaff lint article.md

article.md  [ja · blog/tech]  language detected from content (0.97)

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
2 rules skipped (require POS tagging): agentless-passive, taigen-dome-in-prose
  run `npx chaff setup ja` to enable
```

英語文書:

```text
$ npx chaff lint proposal.md

proposal.md  [en · business/proposal]  language from front matter

   1:1   error    required section missing: risk | tradeoff
                  required-sections

  14:3   warning  "It is important to note that" adds no information
                  empty-intensifier

  22:1   warning  agentless passive: "a decision was made"
                  agentless-passive

  31:8   warning  nominalization: "conduct an evaluation" -> "evaluate"
                  nominalization

  47:1   info     em dash used 11 times in 620 words
                  no-em-dash

1 error, 3 warnings, 1 info
```

test 出力:

```text
$ npx chaff test proposal.md

proposal.md  [ja · business/proposal]

deterministic  (L1: 16, L2: 11, L3: 8)
  ✓ required-sections
  ✓ no-mixed-desumasu
  ✗ conclusion-first        結論が 7 段落目にあります (上限 3 文以内)
  ✗ undefined-acronym       "SLA" が初出時に展開されていません

semantic       (4 candidates from 118 sentences, 2 cached)
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

## 20. Finding Format

既存 spec §10 の形式に 3 フィールドを追加する。

```json
{
  "rule": "concrete-evidence-density",
  "severity": "warning",
  "file": "article.md",
  "line": 92,
  "message": "セクション「まとめ」に数値・コード・リンク・引用がありません",
  "executor": "custom",
  "confidence": 1.0,
  "language": "ja",
  "genre": "blog/tech",
  "layer": "L1",
  "signals": ["rule-of-three", "section-length-uniformity"]
}
```

- `language` / `genre`: どの規範で判定されたか。三軸モデルでは必須。
- `layer`: どの層の rule か。コストと再現性の見積もりに使う。
- `signals`: 同一範囲で同時発火した弱いシグナルの一覧。

### 20.2 複合シグナル

`ai-tell` / `rule-of-three` / `section-length-uniformity` / `sentence-rhythm` / `no-em-dash` はいずれも単独では info だが、同一文書で 3 つ以上そろった場合に 1 件の warning に集約する。個別に 20 件の info を出すより読みやすく、誤検知に強い。

```yaml
ai-generated-composite:
  layer: L1
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
      - no-em-dash
```

集約 rule 自体も rule として定義する。言語別に有効なシグナルが違う（英語では `no-em-dash` が強く、日本語では弱い）ため、`from` は genre profile で言語別に上書きできる。

### 20.3 抑制ディレクティブ

校正記号 stet（ラテン語で「そのままにせよ」）を採用する。

```markdown
<!-- stet: ai-tell -->
この段落では「重要なのは」を意図的に使っています。

<!-- stet-file: bold-density, emoji-density -->
```

理由なしの抑制を減らすため、`--require-stet-reason` で理由の記述を必須にできる。

```markdown
<!-- stet: no-em-dash — 引用元の原文を改変しないため -->
```

---

## 21. Calibration と Corpus

閾値と語彙表の weight は **言語 × ジャンル** ごとに測り直す。日本語のブログで測った `sentence-rhythm` の下限は、英語のビジネス文書には使えない。

```text
corpus/
  ja/
    business/{human-good, human-ordinary, ai}
    blog/{human-good, human-ordinary, ai}
  en/
    business/{human-good, human-ordinary, ai}
    blog/{human-good, human-ordinary, ai}
```

corpus 本体はリポジトリに含めない。`corpus/manifest.yaml` に取得元 URL、ライセンス、取得日、内容ハッシュを記録し、`chaff eval --fetch` で取得する。著作物を再配布しないためと、hash によって「いつの corpus で calibration したか」を再現可能にするため。

収集候補:

| 種別 | 候補 |
| --- | --- |
| ja / business / human-good | 官公庁の公開資料、上場企業の IR 資料とプレスリリース |
| en / business / human-good | SEC filings、政府機関の plain-language ガイドに準拠した文書 |
| ja / blog / human-good | 企業技術ブログ、著者が明示された個人記事 |
| en / blog / human-good | 著名な技術ブログ、Creative Commons の記事 |
| human-ordinary | 利用者が自分のリポジトリから供給。同梱しない |
| ai | 同一プロンプトで複数モデルに生成させる。プロンプトも corpus に含めて再現可能にする |

測定する指標:

```text
Human good FP rate
AI detection rate
Precision / Recall
```

目標:

| 対象 | Human good FP |
| --- | --- |
| business（全言語） | 5% 未満 |
| blog | 5% 未満 |
| blog/essay | 3% 未満（表現の自由度が高いため厳しく） |

`eval` は rule ごとに threshold を sweep し、現在値との差分を出す。threshold の更新は自動適用せず、差分を PR として提示する。

---

## 22. Rule Status と CI

```text
experimental   corpus 評価前。既定で無効。--experimental で有効化
stable         corpus 評価済み。FP 目標を満たす
deprecated     置き換え済み
```

status は **言語ごとに独立**して持つ。`sentence-rhythm` が日本語で stable でも、英語の corpus で評価するまでは英語では experimental のままとする。

```yaml
sentence-rhythm:
  status:
    ja: stable
    en: experimental
```

初期状態で stable を目指すもの（deterministic で反証しやすいもの）:

```text
L1  bold-density, heading-echo, required-sections, undefined-acronym,
    max-sentence-length, max-paragraph-length, preamble-length
L2  empty-intensifier, repeated-conjunction
L3  no-mixed-desumasu, no-nakaguro-parallel (ja) / oxford-comma-consistency (en)

experimental 開始（corpus 評価が必要）
    ai-tell, rule-of-three, section-length-uniformity, sentence-rhythm,
    concrete-evidence-density, padded-intro, cushion-phrase-density,
    proper-noun-density
```

CI:

```yaml
- name: prose lint
  run: npx chaff lint docs/ --changed-only --yes

- name: prose semantic test
  run: npx chaff test docs/ --changed-only --yes
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

`lint` は fork PR でも動く（API key 不要）。`test` は key がある環境でのみ実行し、key がなければ finding を出さずに skip 件数を報告して成功する。

---

## 23. Rule の Unit Test

rule ごとに fixture を持つ。言語別に用意する。

```text
tests/
  heading-echo/
    ja/valid.md
    ja/invalid.md
    en/valid.md
    en/invalid.md
    expected.json
```

規約:

- `valid.md` には「その rule が誤検知しやすい正常な文章」を必ず 1 つ以上入れる。禁止語 rule では、その語を正当に使っている実例を valid 側に置く。これがないと fixture が実装を追認するだけになる。
- L1 rule は **全 adapter で同一の期待結果**になることをテストする。言語を変えて結果が変わる L1 rule は、L1 ではない。
- L1 detector が `doc.adapter` の `segment` 以外を参照していないことを、静的解析で検査する（§6）。

---

## 24. MVP と Roadmap

### Phase 1 — npx で動く Tier 0 / lang-ja

目標: `npx chaff lint article.md` が品詞解析も API key もなしで動く。

```text
core の plugin API 確定（§6）
言語検出（§8）
L1 universal detector 16 本
L2 照合エンジン 4 種
@chaff/lang-ja  Tier 0（規則ベース文分割 + budoux + ja lexicon）
@chaff/business  profile と required-sections
@chaff/blog      profile
textlint dispatch（§15.1）
JSON / text output
GitHub Actions
```

### Phase 2 — lang-en

目標: 言語軸が本当に直交していることを、2 つ目の adapter で証明する。

```text
@chaff/lang-en  Tier 0 / Tier 1
en lexicon（L2 を 11 本）
en 固有 L3 detector
L1 rule が両言語で同一結果になることの検証（§23）
genre pack を一切変更せずに en が動くことの確認
```

Phase 2 が genre pack の変更を必要としたら、四層モデルの切り分けが間違っている。これは設計の検証点として意図的に置く。

### Phase 3 — Tier 1（品詞解析）

```text
chaff setup <lang> による解析器取得
UPOS への写像
L3 rule（ja 8 本 / en 6 本）
skip と unsupported の表示（§17.4）
```

### Phase 4 — Semantic

```text
candidate filter の実装（§14）
LLM judge と構造化出力
キャッシュ
L4 rule 9 本と言語別 rubric
複合シグナル（§20.2）
抑制ディレクティブ（§20.3）
```

### Phase 5 — Calibration

```text
corpus manifest と取得スクリプト
eval と threshold sweep
言語別の experimental -> stable 昇格
FP dashboard
```

---

## 25. Non-goals

- 文章の面白さ、読者の反応、SEO 順位の予測。
- ブランドボイスへの適合判定。組織ごとの lexicon で近似するにとどめる。
- 単一スコアによる品質評価。既存 spec §21 と同じ理由。
- 自動書き換え。検出と修正の分離（既存 spec §5.4）を維持する。
- AI 生成文章の断定的な判別。§20.2 の複合シグナルは「疑い」を示すものであり、判定器ではない。
- 機械翻訳の品質評価。訳文の検証は原文との対応を要し、本 spec の文書単体モデルに載らない。
- **全言語のサポート。** MVP で adapter を実装するのは `ja` と `en` のみ。他言語は adapter を書けば動く設計にするが、同梱しない。

---

## 26. 要決定事項

1. **npm の名前取得。** `chaff` と `@chaff` scope は 2026-09-08 時点で未取得（§0）。実装着手前に押さえる。
2. **`nlh` との関係。** 既存 spec を本 spec で置き換えるのか、`nlh` を概念仕様として残すのか。
3. **`lang-en` を MVP に含めるか。** 本 spec は Phase 2 に置いているが、言語軸が直交している証明は早いほうがよく、Phase 1 と同時に着手する選択もある。ただし en の corpus calibration まで含めると MVP が倍になる。
4. **`section-length-uniformity` と `sentence-rhythm` の仮説検証。** 「AI 生成記事は節の長さと文の長さが揃う」は未検証の仮説。corpus 評価の結果次第では rule ごと落とす。
5. **日本語の品詞解析器。** `@sglkc/kuromoji`（18.3 MB）を setup で取得するか、budoux（2.7 MB）による分節で済ませる rule 設計に寄せるか。
6. **英語 adapter の Tier 既定。** en は品詞解析が軽いため Tier 1 を既定にできる可能性がある。Phase 2 で計測してから決める。
