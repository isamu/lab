たとえば以下はほぼそのまま deterministic rule にできます。

```text
一文ごとに改行する
ダッシュを使わない
中黒を並列に使わない
太字は一節1〜2箇所まで
「重要なのは〜」を使わない
「多角的」「包括的」「総合的」を警告
「さらに」「また」「加えて」の連打
イ形容詞 + 「です」
AではなくB の多用
一文が長すぎる
段落長が均一すぎる
同じ文頭が連続する
同じn-gramが繰り返される
```

Gistでも、記号、文型、禁止表現、反復などがかなり具体的に規定されています。たとえばダッシュ禁止、中黒禁止、太字過多、LLMっぽい空句などです。([Gist][1])

これは textlint のカスタムルールで普通に実装できます。textlint は `Document`、`Paragraph`、`Str` などのASTノードをルールから走査し、任意の条件で `report()` できます。つまり単なるregexだけでなく、**文書全体や段落単位のルール**も書けます。([Textlint][2])

たとえば概念的には、

```ts
export default function(context) {
  const { Syntax, RuleError, report, getSource } = context;

  return {
      [Syntax.Str](node) {
            const text = getSource(node);

      if (/重要なのは/.test(text)) {
              report(node, new RuleError(
                        "主張を予告せず、そのまま書いてください"
                                ));
                                      }
                                          }
                                            };
                                            }
                                            ```

くらい。

---

ただ、Gistのルール全部が textlint の **deterministic rule** になるわけではありません。

ここが重要です。

### 3種類に分けるときれい

| 種類                  | 例                 | 実装                       |
| ------------------- | ----------------- | ------------------------ |
| Lexical / Syntactic | 禁止語、記号、文長、接続詞     | textlint                 |
| Structural          | 段落構成、反復、初出用語、見出し  | textlint/custom analyzer |
| Semantic            | 因果が成立しているか、論証が妥当か | LLM Judge                |

たとえばGistの、

> 一つの段落には一つのトピックだけを置く

は、単純なtextlintでは難しい。([Gist][1])

同様に、

> 因果を主張するときは、その機構を一文で示す

や、

> 挙げた例が実際に主張全体を支えているか

も意味理解が必要です。([Gist][1])

これは、

```text
textlint rule
    ↓
    semantic rule
        ↓
        LLM judge
        ```

にするのが自然です。

---

### でも「全部を rule として定義する」はできる

ここが面白いところで、**実行エンジンをtextlintに限定しなければ、全部同じrule体系にできる**と思います。

例えば、

```yaml
rules:

  no-empty-intensifier:
      type: lexical
          severity: warning
              patterns:
                    - 非常に重要
                          - 極めて重要
                                - 不可欠

  no-repeated-conjunction:
      type: structural
          severity: warning
              detector: repeated-conjunction
                  threshold: 3

  paragraph-single-topic:
      type: semantic
          severity: warning
              rubric: >
                    この段落が複数の独立した論点を扱っていないか判定する。

  causal-mechanism:
      type: semantic
          severity: error
              rubric: >
                    因果関係を主張している場合、その因果を説明する機構が
                          本文中に存在すること。
                          ```

この **rule definition をsource of truth** にする。

そして、

```text
                 natural-language-rules.yaml
                                            │
                                                         ┌─────────────┼─────────────┐
                                                                      ↓             ↓             ↓
                                                                                textlint      analyzer       LLM Judge
                                                                                             │             │             │
                                                                                                       lexical       structural     semantic
                                                                                                                    └─────────────┼─────────────┘
                                                                                                                                               ↓
                                                                                                                                                                     unified report
                                                                                                                                                                     ```

にする。

これが一番きれいだと思います。

---

特に `natural-japanese` はすでにこの途中まで来ています。

面白いのは、単なる手作りルールではなく、実際のhuman/AIコーパスで誤検知率を測ってルールを調整しています。たとえば「最後に」は人間48回、AI 2回だったためAI臭検出から外したり、「重要なのは」などは弱いシグナルに格下げしています。

さらに、検出器の閾値をコーパスで sweep する仕組みまで入っています。

つまりこれは、

```text
Style Guide
     ↓
     Rule
          ↓
          Detector
               ↓
               Corpus test
                    ↓
                    Threshold calibration
                         ↓
                         Lint
                         ```

まで来ている。

### 僕ならさらに一段抽象化します

**textlintをハーネスそのものにはしない**です。

textlintは、

> deterministic natural-language rule runner

として使う。

上位に、

```text
Natural Language Harness

Rule
 ├── deterministic
  │    ├── lexical
   │    ├── syntax
    │    └── structural
     │
      ├── statistical
       │    ├── repetition
        │    ├── similarity
         │    └── distribution
          │
           └── semantic
                 └── LLM Judge
                 ```

を置く。

そうすると最終的に、

```bash
nlh lint article.md
nlh test article.md
nlh eval article.md
```

みたいにできて、

```text
✓ no-em-dash
✓ no-empty-intensifier
⚠ repeated-conjunction
✓ paragraph-length-variance

✗ paragraph-single-topic
  paragraph 17 contains two independent claims

✗ causal-mechanism
  "X causes Y" is asserted without explaining the mechanism
  ```

までいけます。

つまり質問への答えは **「かなりの部分はtextlint ruleに落とせる。ただし最終形はtextlintそのものではなく、textlint的なrule abstractionを一段上に作るのがよい」** です。

これはかなり筋がいいと思います。コードでいう **ESLint + type checker + unit test + AI reviewer を、自然言語に持ち込む**感じになります。

[1]: https://gist.github.com/k16shikano/fd287c3133457c4fd8f5601d34aa817d "japanese-tech-writing/SKILL · GitHub"
[2]: https://textlint.org/docs/rule/?utm_source=chatgpt.com "Creating Rules | textlint"
~