# ハーネス / Skill / ルーター 関連記事・論文まとめ

作成日: 2026-11-22

---

## 0. 起点の記事

### Introducing FrontierHarness Eval v1.1（Runta）
- URL: https://runta.com/blog/introducing-frontierharness-eval-v1-1/
- 公開: 2026-11-17 / 著者: Shilin Zhu
- 概要: 22ハーネス × 5モデル × 62タスク × 各4回、計27,280実行、約830億トークンの規模で、コーディングエージェントのハーネスをモデルごとに比較した。コスト効率が一番良いハーネスはモデルごとに違う（例: GLM-5.3はCodex CLI、DeepSeekはZCode）。モデルを固定しても、ハーネスによってコストは1.8〜5.0倍違う。コストの約93%はモデルで決まり、ステップ数がコストと相関する。全コストの64.5%は不合格の実行に使われていた。結論は「モデルを切り替えるときはハーネスも見直すべき」。
- 関連: FrontierHarness ダッシュボード https://frontierharness.org

---

## 1. ハーネス比較（同じモデル・違うハーネス）

### 比較ボード・解説記事

| タイトル | URL | サマリー |
|---|---|---|
| Harness Leaderboard 紹介記事（日本語） | https://pasqualepillitteri.it/ja/news/30857/harness-leaderboard-haanesu-hikaku | Joël Niklaus（Hugging Face）のボードの紹介。オープンモデル3つ × ハーネス9つの比較で、平均スコアはOpenClawの27.3%からmini-swe-agentの51.4%まで開き、上位5つは同率首位。2026-11-05公開。 |
| DeepSeek Harness の Terminal-Bench 問題（The New Stack） | https://thenewstack.io/deepseek-harness-cleanup-benchmark/ | 上のボードの続報。DeepSeek Harnessは総合では同率首位なのに、Terminal-Benchでは6位。タスク終了時にバックグラウンドプロセスを止める挙動が原因だった。 |
| Coding Agent Harness Benchmark: Same Model, 17.5x Cost Gap（Developers Digest） | https://www.developersdigest.tech/blog/coding-agent-harness-benchmark-cost-per-pass-frontierharness-2026 | FrontierHarness v1.0の解説。ハーネス選びはコストに効く要素で、測ることもできるが、どのハーネスが「優れている」かまでは言えない。バージョン更新が速いので、日付つきのスナップショットとして扱うよう注意している。 |
| A coding agent's harness can triple its cost...（VentureBeat） | https://venturebeat.com/orchestration/a-coding-agents-harness-can-triple-its-cost-without-making-it-more-accurate-study-finds | 山東大学の研究（下の「What Does a Harness Buy?」）の紹介。同じモデルでもタスクあたりのコストはハーネスによって最大3倍違い、精度は上がらない。ベンダーが自社モデルに自社ハーネスを使っても、スコア上の優位はない。 |
| The Model Doesn't Matter. The Harness Does.（dev.to） | https://dev.to/michaeltuszynski/the-model-doesnt-matter-the-harness-does-599 | SWE-bench ProでOpus 4.5を4つのフレームワークで動かすと45.9〜55.4%（9.5ポイントの差）。良いスキャフォールドを使ったSonnet 4.5がOpus 4.5を上回った例も紹介している。 |

### 論文

| タイトル | URL | サマリー |
|---|---|---|
| What Does a Harness Buy? Tokens, Mostly | https://arxiv.org/pdf/2610.04433 | 同じモデルで52.1%と57.8%の差があり、スコアが低いほうは入力トークンを65倍使っていた。ハーネスで買えるのは主にトークン消費であって、精度ではない。 |
| The Scaffold Effect in Coding Agents（ICML 2026） | https://arxiv.org/pdf/2607.22585 / https://icml.cc/virtual/2026/82739 | ハーネスは比較で見落とされがちな変数。Goose、OpenHands-SDK、OpenCodeにはそれぞれ固有の失敗パターンがあり、2つのモデルで再現された。トークン・レイテンシの予算内での合格率で、ハーネスとモデルの組み合わせを選ぶよう勧めている。 |
| ハーネス非開示のスコア比較を批判するポジション論文 | https://arxiv.org/html/2605.23950 | ハーネスだけ変えるとTerminal-Bench 2のpass@1は69.7%から77.0%に上がり、SWE-bench Verifiedでは最大15ポイント変わる。ハーネスを固定するか、要因を組み合わせて比較する設計でないと、モデル間の比較は成り立たないと主張。 |
| Harness-Bench | https://arxiv.org/html/2605.27922 | 106のサンドボックス化されたタスクで5,194件の実行軌跡を分析。完了率、プロセスの質、効率、失敗の仕方はモデルとハーネスの組み合わせで大きく変わるので、能力は組み合わせの単位で報告すべきとしている。 |
| Same Model, Different Harness: Different Coding-Agent Results | https://huggingface.co/papers/2608.26218 | 重みを固定しても、ハーネスを変えるとタスクの成功率が変わる。モデルとハーネスを1つの「ソルバー」として評価すべきと主張。 |

### リーダーボード・ツール

| 名前 | URL | サマリー |
|---|---|---|
| Terminal-Bench 2.1 Leaderboard（tbench.ai） | https://www.tbench.ai/leaderboard/terminal-bench/2.1 | エージェントとモデルの組み合わせごとに並ぶ公式リーダーボード。 |
| Terminal-Bench 2.1（Snorkel） | https://snorkel.ai/leaderboard/terminal-bench-2-1/ | 同上のSnorkel版。Codex CLI、Claude Code、Terminus 2などの組み合わせが掲載されている。 |
| Artificial Analysis Coding Agent Index（日本語） | https://artificialanalysis.ai/ja/agents/coding-agents | コスト、トークン数、実行時間も含めて、エージェント・モデル・設定ごとに性能を比べられる。 |
| OpenBench（GitHub） | https://github.com/minghinmatthewlam/openbench | codex、pi、opencode、cursorなどを、同じモデル・同じタスクで比べるベンチマーク。 |

---

## 2. Skill × モデル ベンチマーク

| タイトル | URL | サマリー |
|---|---|---|
| SkillsBench | https://arxiv.org/abs/2602.12670 | 86タスク・11ドメインを「Skillなし／キュレーションしたSkill／自作Skill」の3条件で評価し、7構成で7,308件の実行を集めた。キュレーションしたSkillで平均+16.2ポイント。ただしソフトウェア開発は+4.5、医療は+51.9と差が大きく、16タスクでは下がった。自作Skillは効果なし。2〜3モジュールに絞ったSkillのほうが網羅的なものより良く、Skillがあれば小さいモデルでも大きいモデルに並べる。 |
| SkillsBenchへの反論（UCSB, Skill-Usage） | https://arxiv.org/abs/2604.04323 | SkillsBenchのSkillはタスクに合わせて作り込まれていて、条件が理想的すぎると指摘。大量のSkillから自分で探して使う現実的な条件では、効果はSkillなしの水準近くまで落ちる。 |
| SWE-Skills-Bench | https://arxiv.org/abs/2603.15401 | ソフトウェア開発に特化した評価。公開Skill 49個のうち39個は合格率の改善ゼロ。 |
| SkillTester | https://arxiv.org/abs/2603.28815 | Skillの有用性（ありとなしの比較）とセキュリティ（別のプローブ群）の両面から評価するツール。 |
| OpenSkillEval | https://arxiv.org/abs/2605.23657 | 600件以上のタスクと30個のオープンSkillで評価。エージェントが実際にSkillを読んだのは約48%で、読んでも従わないことが多い。Skillの活かし方はフレームワークによって大きく違う。Skill×モデル×ハーネスの3軸を見ている。 |
| Agentic Skills Evaluation Framework | https://benchmarklist.com/benchmarks/agentic_skills_evaluation_framework/ | 実在する500個のSkillから1,000タスクを作り、19のエージェント×モデル構成を評価。Skill作者が自分で評価タスクを作る方法も示している。 |
| Agent Skill Evaluation and Evolution（サーベイ） | https://arxiv.org/abs/2606.11435 | Skill評価の枠組みとベンチマークを整理したサーベイ。6カテゴリのベンチマークを分析し、どこが手薄かを指摘している。 |
| 7 learnings from running 880 evals（Tessl） | https://dev.to/tessl-io/anthropic-openai-or-cursor-model-for-your-agent-skills-7-learnings-from-running-880-evals-5gh6 | 9モデル（Opus 4.7、Sonnet 4.6、gpt-5.4、Composer-2など）で880回評価した実務寄りの記事。2026年はモデル選びよりSkill選びのほうが効くかもしれない、という内容。 |
| Evaluate Agent Skills Before Publication（NVIDIA） | https://docs.nvidia.com/skills/evaluating-agent-skills | 公開前の評価ガイド。Skillあり・なしの2回実行で差を測る。Skillを使わないのが正しいネガティブケースも入れるよう勧めている。 |
| Context-Bench Skills（Letta） | https://letta.com/blog/context-bench-skills | Skillを「コンテキストマウンティング」（選ぶ→読み込む→実行する→外す）として捉えた解説と評価。 |

---

## 3. Skill ルーター

| タイトル | URL | サマリー |
|---|---|---|
| SkillRouter | https://arxiv.org/abs/2603.22455 / コード: https://github.com/zhengyanzhao1997/SkillRouter | 約8万個のSkillから検索と再ランキングで選ぶ。名前と説明だけで選ばせるとルーティング精度が31〜44ポイント下がるので、本文が重要な手がかりになる。progressive disclosure方式の前提に疑問を投げかけている。 |
| Beyond Top-k Skill Retrieval | https://arxiv.org/pdf/2609.05824 | 1個ずつ独立に採点する従来のルーターではなく、多様性を考えてSkillの組み合わせを選ぶ方式を提案。 |
| Skill Is Not Document | https://arxiv.org/pdf/2606.03565 | Skillを文書検索と同じように扱わず、クエリとの相性で選ぶべきという研究。 |
| The Router Within | https://arxiv.org/pdf/2609.15982 | 外部ルーターを使わず、凍結したLLM自身にルーティングさせる研究。CodexはSkillのメタデータをコンテキストの2%に制限しており、Skillの数が増えると精度が対数的に落ちるという問題意識から出発している。 |
| A Comprehensive Survey on Agent Skills | https://arxiv.org/pdf/2605.07358 | Skillのサーベイ。選び方を「文脈に応じた動的選択／組み合わせ／コストと効用を考えた選択／フィードバックによる並べ替え」の4つに整理している。 |

---

## 4. モデル（LLM）ルーター

| タイトル | URL | サマリー |
|---|---|---|
| LLMRouterBench（ACL 2026 Findings） | https://arxiv.org/abs/2601.07206 / コード: https://github.com/ynulihao/LLMRouterBench | 21データセット・33モデル・40万件以上の大規模ベンチマーク。モデルごとに得意不得意はあるが、ルーティング手法の性能は似たり寄ったり。モデルを増やすより厳選するほうが効く。 |
| RouterArena（ICLR 2026） | https://arxiv.org/abs/2510.00202 | ルーターを比べるオープンなプラットフォーム。精度とコスト、正解できる中で一番安いモデルを選べたか、判断のぶれにくさ、ルーター自体の遅延で比較する。 |
| LiteLLM Auto Router Public Benchmarks | https://docs.litellm.ai/docs/auto_router/benchmarks | Terminal-Bench 2.0の21タスクで、ルーターもOpus-5単体も16問正解と同じ正答率で、総コストは27%安い（14.34ドル対19.74ドル）。規模が小さく、ベンダー自身による評価なので注意。 |

---

## 読む順番のおすすめ

1. 起点の FrontierHarness v1.1 → Harness Leaderboard 紹介記事（日本語）
2. What Does a Harness Buy? → Scaffold Effect（ハーネスの分析を詳しく）
3. SkillsBench → UCSBの反論 → OpenSkillEval（Skillの効果）
4. SkillRouter → LLMRouterBench（ルーティング）

全体の傾向: 性能もコストも「モデル × ハーネス × Skill（× ルーター）」の組み合わせで決まり、単体の数字だけで判断するのは危ない、という方向で研究がまとまってきている。
