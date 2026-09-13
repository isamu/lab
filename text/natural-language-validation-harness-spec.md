# Natural Language Validation Harness — Spec

## 1. 概要

自然言語の文章に対して、ソフトウェア開発における **lint / unit test / integration test / review** に相当する検証を行うためのハーネスを構築する。

対象は主に以下。

- 技術文書
- 仕様書
- README / Markdown
- レポート
- 記事
- AI が生成・修正した文章
- Prompt / Skill / Agent 向け自然言語定義

目的は、文章品質を人間の感覚だけに依存させず、**再現可能・自動化可能なルールとして検証すること**。

最終的には、自然言語で書かれた文章規範やスタイルガイドを、実行可能な rule に変換し、CI で継続的に検証できる状態を目指す。

---

## 2. 背景

ソフトウェアでは、品質を以下のような複数のレイヤーで検証している。

- Linter
- Type checker
- Unit test
- Integration test
- Static analysis
- Code review
- Human review

一方、自然言語文書では、多くの場合、

- スタイルガイド
- 執筆ルール
- レビュー観点
- 人間による校正

として存在しており、実行可能な検証ルールにはなっていない。

しかし、自然言語のルールにも以下のように機械判定可能なものが多い。

- 禁止語
- 禁止表現
- 文長
- 段落長
- 同一表現の反復
- 接続詞の多用
- Markdown 構造
- 用語統一
- 表記揺れ
- 文体の偏り

さらに、LLM を Judge として利用すれば、

- 1 段落 1 トピックになっているか
- 因果関係に説明があるか
- 結論が根拠に支えられているか
- 曖昧な表現になっていないか

といった semantic な検証も可能になる。

---

## 3. 参考となる既存アプローチ

### 3.1 日本語技術文書の文章規範

https://gist.github.com/k16shikano/fd287c3133457c4fd8f5601d34aa817d

自然言語で記述された文章規範を指す。

以下のような内容はルール化しやすい。

- 記号の使用制限
- 文体
- 段落構成
- 空虚な言い回し
- 強調表現
- 接続表現
- LLM 特有のパターン

---

### 3.2 natural-japanese

https://github.com/coji/natural-japanese

AI が生成した日本語の不自然さを検出・修正する Agent Skill である。

特徴:

- SudachiPy による形態素解析
- deterministic な lint
- 禁止フレーズ
- 翻訳調
- 文リズム
- n-gram repetition
- 段落構造
- コーパスを使った閾値 calibration
- 人間文章と AI 文章の false positive 比較
- semantic な判断は Agent / Human に委ねる

特に重要なのは、

> 検出は機械、判断は人間または Agent

という形で分離する。

---

## 4. 課題

### 4.1 自然言語ルールは判定可能性が異なる

すべての文章ルールを同じ仕組みでは検証できない。

例えば、

```text
「非常に重要」を禁止する
```

は deterministic に判定できる。

一方、

```text
この段落には複数の独立した論点を含めない
```

は意味理解を必要とする。

そのため、ルールを種類別に扱う必要がある。

---

### 4.2 LLM Judge は非決定的

LLM による semantic 判定には以下の問題がある。

- 実行ごとに結果が変わる
- モデル変更の影響を受ける
- コストが高い
- latency がある
- false positive / false negative の calibration が難しい

したがって、**deterministic に判定できるものを LLM に判定させない**ことが重要。

---

### 4.3 Style Guide と実行ルールが分離している

現状、多くの文章規範は Markdown やドキュメントとして存在しているだけである。

例:

```text
同じ接続詞を連続して使わない
```

これを CI で検証するには、実行可能な rule に変換する必要がある。

つまり、

```text
Style Guide
    ↓
Rule Definition
    ↓
Detector
    ↓
Test
    ↓
CI
```

という変換を要する。

---

### 4.4 誤検知

自然言語では、絶対的な禁止ルールが成立しないケースが多い。

例えば、

```text
「重要なのは」
```

という表現は AI が頻繁に使う可能性があるが、人間も普通に使う。

そのため、

- error
- warning
- info

の severity を要する。

また、ルールによってはジャンル別 threshold を要する。

---

### 4.5 文書ジャンルによる差

以下では自然な文章スタイルが大きく異なる。

- 技術文書
- ビジネス文書
- ブログ
- エッセイ
- 論文
- 議事録
- 仕様書

したがって profile を持てる構造が望ましい。

---

## 5. 設計原則

### 5.1 最も安い deterministic check を優先する

検証レイヤーは以下の順番とする。

```text
Structural
    ↓
Lexical
    ↓
Syntactic
    ↓
Statistical
    ↓
Semantic
    ↓
Human
```

下に行くほど柔軟だが、

- コスト
- latency
- 非決定性

が高くなる。

---

### 5.2 Rule を Source of Truth にする

textlint、Python script、LLM prompt を直接ルール定義にしない。

上位に共通の Rule Definition を置く。

```text
rules/
  style.yaml
  technical-writing.yaml
  ai-writing.yaml
```

各 rule を適切な executor に dispatch する。

---

### 5.3 Linter と Judge を分離する

自然言語ハーネス全体を LLM Judge にしない。

```text
Natural Language Harness
        |
        +-- deterministic
        |
        +-- statistical
        |
        +-- semantic
```

とする。

---

### 5.4 検出と修正を分離する

Rule は原則として問題を指摘する。

自動修正は別機能とする。

理由:

- 文脈を壊す可能性がある
- false positive がある
- 同じ表現でも意図的な場合がある

---

## 6. Rule の分類

### 6.1 Lexical Rule

単語・フレーズ単位。

例:

```text
「非常に重要」を避ける
「包括的」を多用しない
「見ていきましょう」を使わない
```

実装:

- string match
- regex
- textlint

---

### 6.2 Syntactic Rule

文法・品詞・構文を見る。

例:

```text
イ形容詞 + です
体言止めの過剰使用
冗長な可能表現
```

実装:

- textlint
- SudachiPy
- AST / Morphological Analyzer

---

### 6.3 Structural Rule

文書構造を見る。

例:

```text
段落が長すぎる
同じ接続詞から始まる段落が多い
見出し構造が不正
同じ文頭が続く
一文ごとに改行されていない
```

実装:

- textlint AST
- Markdown parser
- custom analyzer

---

### 6.4 Statistical Rule

文章全体の分布を見る。

例:

```text
文長が均一すぎる
段落長が均一すぎる
同一 n-gram が多い
特定構文の出現率が高い
```

実装:

- custom TypeScript
- Python
- SudachiPy
- statistical detector

---

### 6.5 Semantic Rule

意味を理解しないと判定できないもの。

例:

```text
1 段落に複数の独立したトピックを含めない
因果を主張する場合、その機構を説明する
結論が本文の根拠によって支持されている
曖昧な主語を避ける
例が主張を本当に支えている
```

実装:

- LLM Judge
- rubric-based evaluation

---

## 7. 使用ツール

### 7.1 textlint

役割:

**Natural Language ESLint**

担当:

- lexical
- syntactic
- structural

用途:

- Markdown / plain text
- custom rule
- AST-based validation
- CI

textlint 自体をハーネス全体にはせず、deterministic executor の一つとして使う。

---

### 7.2 SudachiPy

役割:

**日本語の形態素解析**

担当:

- 品詞
- tokenization
- 語形
- 文パターン
- n-gram
- 日本語構文の補助解析

`natural-japanese` がこの方式を採用している。

TypeScript だけで完結させたい場合は別 analyzer も検討可能だが、初期実装では Python subprocess でもよい。

---

### 7.3 Promptfoo

役割:

**Semantic Unit Test / LLM Evaluation Harness**

担当:

- LLM-as-a-Judge
- rubric
- model comparison
- regression test
- threshold

特に semantic rule の executor として利用できる。

---

### 7.4 Custom TypeScript Harness

プロジェクト全体の orchestrator にあたる。

担当:

- Rule 読み込み
- executor dispatch
- 結果統合
- CLI
- CI
- output format
- baseline
- severity
- configuration

想定:

```text
Node.js / TypeScript
```

---

### 7.5 Optional

将来的な候補。

- Giskard
- DeepEval
- embedding similarity
- GiNZA
- LanguageTool
- Vale

ただし MVP では依存を増やしすぎない。

---

## 8. Architecture

```text
                         Rule Definitions
                               |
                     rules/*.yaml or json
                               |
                               v
                     Natural Language Harness
                               |
          +--------------------+--------------------+
          |                    |                    |
          v                    v                    v
       textlint           custom analyzer       LLM Judge
          |                    |                    |
     lexical/syntax       statistical         semantic
     structural           morphology
          |                    |                    |
          +--------------------+--------------------+
                               |
                               v
                         Unified Findings
                               |
                  +------------+------------+
                  |                         |
                  v                         v
                 CLI                       CI
```

---

## 9. Rule Definition

例:

```yaml
rules:

  no-empty-intensifier:
    description: 空虚な強調表現を避ける
    type: lexical
    severity: warning
    patterns:
      - 非常に重要
      - 極めて重要
      - 不可欠

  repeated-conjunction:
    description: 同じ接続詞の反復を検出する
    type: statistical
    severity: warning
    detector: repeated-conjunction
    threshold: 3

  sentence-length:
    description: 一文が長すぎる
    type: structural
    severity: warning
    max_chars: 120

  paragraph-single-topic:
    description: 一段落一トピック
    type: semantic
    severity: warning
    rubric: |
      この段落に複数の独立した論点が含まれていないこと。
      単一の主張を補足する説明や例は別トピックとは扱わない。

  causal-mechanism:
    description: 因果関係の説明
    type: semantic
    severity: error
    rubric: |
      X が Y を引き起こすと主張している場合、
      その因果関係を説明する機構または根拠が本文に存在すること。
```

---

## 10. Finding Format

すべての executor の出力を統一する。

```json
{
  "rule": "repeated-conjunction",
  "severity": "warning",
  "file": "docs/spec.md",
  "line": 42,
  "column": 1,
  "message": "「また」で始まる段落が4回続いています",
  "executor": "textlint",
  "confidence": 1.0
}
```

semantic rule の例:

```json
{
  "rule": "paragraph-single-topic",
  "severity": "warning",
  "file": "docs/spec.md",
  "line": 80,
  "message": "認証方式と料金体系の2つの独立した論点が含まれています",
  "executor": "llm-judge",
  "confidence": 0.82
}
```

---

## 11. CLI

仮称:

```bash
nlh
```

Natural Language Harness。

### lint

deterministic rule のみ。

```bash
nlh lint README.md
```

対象:

- textlint
- regex
- structure
- morphology
- statistical rule

特徴:

- 高速
- 原則 deterministic
- ローカルで頻繁に実行

---

### test

semantic rule を含む。

```bash
nlh test README.md
```

対象:

- lint
- semantic rule
- LLM Judge

---

### eval

ルール自体を評価する。

```bash
nlh eval corpus/
```

目的:

- false positive
- true positive
- threshold calibration
- rule quality

---

### explain

Rule の説明を指す。

```bash
nlh explain paragraph-single-topic
```

---

### init

```bash
nlh init
```

生成:

```text
.nlh.yaml
rules/
```

---

## 12. 出力例

```text
$ nlh lint article.md

article.md

  18:1  warning  「非常に重要」は空虚な強調表現です
        no-empty-intensifier

  42:1  warning  「また」で始まる段落が4回続いています
        repeated-conjunction

  88:1  warning  文長 154 characters
        max-sentence-length

3 problems
```

semantic:

```text
$ nlh test article.md

✓ no-empty-intensifier
✓ repeated-conjunction
✓ max-sentence-length

✗ paragraph-single-topic
  paragraph 12 contains two independent topics:
  - authentication
  - pricing

✗ causal-mechanism
  "AI導入により生産性が向上する" と主張しているが、
  その機構または根拠が説明されていない。
```

---

## 13. CI

GitHub Actions 例。

```yaml
- name: Natural language lint
  run: npx nlh lint docs/

- name: Natural language semantic tests
  run: npx nlh test docs/ --changed-only
```

Pull Request では変更された Markdown のみを対象にする。

---

## 14. Severity

```text
error
warning
info
```

### error

明確に violation。

例:

- 禁止文字
- 必須 section 不足
- specification の schema violation

CI fail。

---

### warning

文脈依存だが問題の可能性が高い。

例:

- 空虚な表現
- 文長
- 反復
- semantic issue

原則 CI pass。

---

### info

弱い signal。

例:

- AI に多いが人間も普通に使う表現

---

## 15. Profile

ジャンル別に rule / threshold を変更可能にする。

```yaml
profile: technical
```

候補:

```text
technical
business
report
essay
blog
spec
meeting-notes
```

例:

```yaml
profiles:

  technical:
    max_sentence_chars: 100

  essay:
    max_sentence_chars: 160
```

---

## 16. Calibration

自然言語ルールでは誤検知の測定が重要になる。

以下の corpus を用意する。

```text
corpus/
  human-good/
  human-bad/
  ai/
```

各 rule について、

```text
Human False Positive Rate
AI / Bad Document Detection Rate
Precision
Recall
```

を測る。

目標例:

```text
Human good FP < 5%
```

`natural-japanese` のように、実コーパスによって rule の threshold や severity を変更する。

---

## 17. Rule Lifecycle

```text
Natural Language Guideline
          ↓
Rule Candidate
          ↓
Detector Implementation
          ↓
Fixture Test
          ↓
Corpus Evaluation
          ↓
Threshold Calibration
          ↓
Stable Rule
```

---

## 18. Rule の状態

```text
experimental
stable
deprecated
```

experimental rule は default では CI failure に使用しない。

---

## 19. Unit Test

rule 自体にも test を持つ。

```text
rules/
tests/
  no-empty-intensifier/
    valid.md
    invalid.md
```

例:

```text
invalid.md
```

```text
この機能は非常に重要です。
```

期待:

```text
1 warning
```

---

## 20. MVP

最初の実装では以下に限定する。

### Phase 1

TypeScript CLI。

実装:

- Markdown input
- Rule YAML
- regex
- phrase match
- sentence length
- paragraph length
- repeated phrase
- repeated conjunction
- textlint integration
- JSON output
- GitHub Actions

---

### Phase 2

日本語 analyzer。

実装:

- SudachiPy bridge
- morphological rule
- n-gram
- sentence rhythm
- paragraph statistics

---

### Phase 3

Semantic Rule。

実装:

- Promptfoo
- LLM Judge
- rubric
- confidence
- caching

---

### Phase 4

Rule Evaluation。

実装:

- corpus
- calibration
- regression
- false positive dashboard

---

## 21. Non-goals

初期段階では以下を目標にしない。

- 完全な文章品質評価
- AI生成文章の完全判定
- 自動修正の完全自動化
- 人間レビューの完全な代替
- 単一スコアによる文章品質評価

目的は、

> 問題を可能な限り早く、安く、再現可能に検出すること。

---

## 22. 重要な設計判断

### textlint は harness ではなく executor

textlint を中心的なツールとして利用するが、アーキテクチャ全体を textlint に依存させない。

理由:

semantic rule や statistical rule は textlint の責務を超える。

---

### Rule Definition を一段上に置く

```text
Rule
  ↓
Executor
```

という構造にすることで、

```text
textlint
SudachiPy
custom TS
Promptfoo
LLM Judge
```

を同じ rule model の下で利用可能にする。

---

### deterministic first

```text
regex で判定できるものを
LLM に聞かない。
```

これは、

- 再現性
- コスト
- latency
- CI stability

の観点から最も重い。

---

## 23. 検証レイヤー

最終的な検証モデル。

```text
                Human Review
                     ↑
                 LLM Judge
                     ↑
              Semantic Check
                     ↑
            Statistical Check
                     ↑
             Syntactic Check
                     ↑
              Lexical Check
                     ↑
            Structural Check
```

上に行くほど、

- flexible
- contextual

になる。

下に行くほど、

- deterministic
- reproducible
- cheap
- fast

になる。

---

## 24. コンセプト

このプロジェクトは、

> ESLint + Type Checker + Unit Test + AI Reviewer を自然言語に持ち込む

ものと考える。

単なる文章校正ツールではなく、

**Natural Language CI / Natural Language Validation Harness**

として設計する。

