---
title: "ハーネスとは「モデル以外のすべて」——公式定義と実装6例を読む"
emoji: "🪢"
type: "tech" # tech: 技術記事 / idea: アイデア
topics: ["ClaudeCode", "Codex", "AIエージェント", "LLM"]
published: true
publication_name: "singularity"
---

LLM 単体は、テキストを受け取ってテキストを返すだけの関数です。記憶もなければ、ファイルを開く手段も、次に何をするか決める仕組みもありません。**ハーネス（harness）とは、そのモデルの周りに巻きつけて「エージェント」に仕立て上げる実行機構**のことです。馬具の harness——制御して仕事をさせるための装具——がそのまま比喩になっています。

この言葉、ここ1年で急に一次情報が増えました。定義を公式ドキュメントで確認したうえで、実装を6つ開けて中身を比べてみます。

---

## 1. 公式ドキュメントは何と言っているか

### OpenAI

[Codex as a platform](https://developers.openai.com/blog/codex-as-a-platform) が、いちばん具体的に書いています。

> A capable agent is more than a prompt and a model response. It needs a way to understand a task, maintain context over time, inspect relevant information, call tools, expose progress, handle failures, request human approval when necessary, and return a useful result.

> We built the Codex harness to manage conversation state, stream execution, use tools, enforce configured sandbox and approval policies, and carry work across turns.

会話状態の管理、実行のストリーミング、ツール使用、**設定されたサンドボックスと承認ポリシーの強制**、ターンをまたいだ作業の継続——これがハーネスの職掌だ、という定義です。さらに OpenAI はこれを設計する営みを **harness engineering** と名付け、[一つの規律に格上げしました](https://openai.com/index/harness-engineering/)。

### Anthropic

[Building agents with the Claude Agent SDK](https://claude.com/blog/building-agents-with-the-claude-agent-sdk) は、Claude Agent SDK 自体を「汎用のエージェント・ハーネス」と呼んでいます。中核にあるのはループの定義です。

> Agents often operate in a specific feedback loop: gather context -> take action -> verify work -> repeat.

文脈を集める → 行動する → **成果を検証する** → 繰り返す。3番目が独立した工程として置かれているのがこの定義の特徴です。

### Martin Fowler

[Harness engineering for coding agent users](https://martinfowler.com/articles/harness-engineering.html) の定義がいちばん短い。

> ハーネスとは、AI エージェントのうち**モデル以外のすべて**。

そのうえで内側と外側に分けます。この区別が実務ではいちばん効きます。

```
┌──────────────────────────────────────────────┐
│ 外側ハーネス — あなたが書く                  │
│                                              │
│   ┌────────────────────────────────────┐     │
│   │ 内側ハーネス — ベンダー製          │     │
│   │                                    │     │
│   │      ┌──────────────┐              │     │
│   │      │   モデル     │              │     │
│   │      └──────────────┘              │     │
│   │                                    │     │
│   │  ループ / ツール / 隔離 / 圧縮     │     │
│   └────────────────────────────────────┘     │
│                                              │
│  AGENTS.md / lint / テスト / CI / evals      │
└──────────────────────────────────────────────┘
```

ベンダーが作る**内側ハーネス**（ループ・ツール・サンドボックス・圧縮）と、利用者が自分のリポジトリのために書く**外側ハーネス**（AGENTS.md・lint・テスト・CI・evals）は、投資判断が別物です。ベンダーを乗り換えても外枠は残ります。

> A well-built outer harness serves two goals: it increases the probability that the agent gets it right in the first place, and it provides a feedback loop that self-corrects as many issues as possible before they even reach human eyes.

### 3者に共通するもの

**ハーネスは「賢さ」ではなく「制御」の話だ**、という点です。何を見せるか、何を触らせるか、いつ止めるか、誰が承認するか。モデルを差し替えても残るのはこの層です。

---

## 2. 用語の揺れ——harness と scaffold は同義ではない

調べるうえで最初に引っかかるのがここです。Hugging Face の[用語集](https://huggingface.co/blog/agent-glossary)は、両者を明確に切り分けています。

| 用語 | 定義 |
|---|---|
| **Model** | テキストを受けてテキストを返す LLM そのもの。記憶も実行ループも持たない |
| **Scaffolding** | 振る舞いを規定する層——システムプロンプト、ツールの説明、応答のパース方法、ステップ間で何を覚えているか（文脈管理） |
| **Harness** | エージェント内部の**実行層**——モデルを呼び、そのツール呼び出しを処理し、いつ止めるかを決める |
| **Agent** | Model + Harness |

この狭義（harness＝実行層、scaffold＝指示層）と、OpenAI・Anthropic・Fowler が使う広義（harness＝モデル以外すべて、scaffold はその一部）は**食い違っています**。実務のブログやベンダー文書はほぼ広義です。

:::message
「harness」と書いてある文章を読むときは、まず**それが実行ループだけを指しているのか、AGENTS.md や CI まで含めているのか**を確認してください。ここを取り違えると議論が噛み合いません。
:::

---

## 3. ハーネスの部品表

実装を6つ読み比べると、名前は違っても同じ部品が出てきます。1ターンの流れはこうです。

```
  ┌──圧縮・メモリ──┐   ┌─停止条件で終了─┐        ┌──人間の承認──┐
  │                 │   │                │        │              │
  │ 注入            │   │ 歩数/コスト/時間│        │ 承認要求      │
  ▼                 │   │                ▲        ▲              │
┌─────────────┐  ┌──────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐
│コンテキスト  │→│ モデル呼出し  │→│ツール解決  │→│ポリシー判定│→│ 隔離実行 │
│  構築       │  │  ★モデル★   │  │            │  │            │  │          │
└─────────────┘  └──────────────┘  └────────────┘  └────────────┘  └──────────┘
  ▲                                                                       │
  └──── 観測を追記： stdout / 終了コード / 差分 ─────────────────────────┘
```

★が付いた1箱だけがモデルで、残りの全部がハーネスです。ツール呼び出しは必ずポリシー判定を通ってから隔離実行に届く——この2ホップがハーネスの安全性の中身です。

部品を列挙するとこうなります。

- **エージェントループ** — 「モデルを呼ぶ → 行動を取り出す → 実行する → 観測を追記する」の繰り返し
- **コンテキスト構築** — 何をモデルに見せるか。AGENTS.md／CLAUDE.md、リポジトリマップ、grep、セマンティック検索
- **コンテキスト維持** — 窓が埋まったときの手当て。圧縮（要約）、リセット（全消去）、サブエージェントへの隔離、ファイルへの外部化
- **ツール層** — 定義・登録・ディスパッチ・並列実行・名前空間、そして MCP による外部接続
- **編集プリミティブ** — ファイルをどう書き換えさせるか。差分フォーマット、apply_patch、全文置換
- **実行環境と隔離** — bash をどこで走らせるか。ローカル／OS サンドボックス／Docker／リモート
- **権限と承認** — 何を自動で許し、何を人間に投げるか
- **検証ループ** — テスト・lint・型・ブラウザ操作・LLM-as-judge
- **予算と停止条件** — 歩数上限、コスト上限、壁時計時間、連続フォーマットエラー
- **永続化と再開** — 軌跡（trajectory / rollout）の保存、セッション再開、再生可能性
- **拡張点** — hooks、skills、plugins、サブエージェント

---

## 4. 実装6例、中身を開ける

下限（100行）と上限（100超クレートの Rust モノレポ）で3桁の開きがあります。

### OpenAI Codex — OS の隔離機構まで抱え込んだ最大構成

言語は Rust（`codex-rs/` に100超のクレート）、[Apache-2.0](https://github.com/openai/codex)。クレート名を眺めるだけで部品表がそのまま出てきます。

`core/src/tools/` には `registry.rs` / `router.rs` / `orchestrator.rs` / `parallel.rs` / `approvals.rs` / `sandboxing.rs` が並び、ツールの登録・ルーティング・並列実行・承認・隔離が明確に分離されています。圧縮は `context_manager/` と `compact*.rs`（`compact_remote_v2` まである）。軌跡の永続化は `rollout/`・`thread_store/`・`history/`。拡張点は `hooks/`・`skills/`・`plugin/`・`memories/`・`worktree/`。MCP は `mcp-server/`（提供側）と `rmcp-client/`（消費側）の両方向。IDE やデスクトップからは `app-server/` の JSON-RPC を叩きます。

**いちばん特徴的なのは隔離の実装です。**抽象的なポリシーではなく、OS のプリミティブに直接落ちています。

| OS | 実装 |
|---|---|
| macOS | Seatbelt。`sandboxing/src/seatbelt.rs` と、ポリシーそのものを書いた `seatbelt_base_policy.sbpl` / `seatbelt_network_policy.sbpl` を同梱し、`sandbox-exec` でコマンドを起動 |
| Linux | `linux-sandbox/src/landlock.rs`（Landlock LSM）＋ `bwrap.rs` / `bundled_bwrap.rs`（bubblewrap を同梱）。既定は bwrap + seccomp |
| Windows | `windows-sandbox-rs/` のネイティブ実装。WSL2 なら Linux 側 |

そのうえに2軸の設定が乗ります。サンドボックスモードが `read-only` / `workspace-write` / `danger-full-access`、承認ポリシーが `untrusted` / `on-request` / `never` / `auto_review`。最後の `auto_review` は**承認要求を別のレビュワー・エージェントに通してから実行する**という設計で、「人間の承認」を部分的にエージェントへ委譲しています。さらに `execpolicy/` がコマンド単位のポリシー言語を持ちます。

編集フォーマットも作り込まれていて、`core/src/tools/handlers/apply_patch.lark` に **Lark 文法として形式定義**されています。「モデルの出力を正規表現で頑張って読む」のではなく、パーサに食わせる文法を先に決めている。全文がこれです。

```
start: begin_patch hunk+ end_patch
begin_patch: "*** Begin Patch" LF
end_patch: "*** End Patch" LF?

hunk: add_hunk | delete_hunk | update_hunk
add_hunk: "*** Add File: " filename LF add_line+
delete_hunk: "*** Delete File: " filename LF
update_hunk: "*** Update File: " filename LF change_move? change?

filename: /(.+)/
add_line: "+" /(.*)/ LF -> line

change_move: "*** Move to: " filename LF
change: (change_context | change_line)+ eof_line?
change_context: ("@@" | "@@ " /(.+)/) LF
change_line: ("+" | "-" | " ") /(.*)/ LF
eof_line: "*** End of File" LF
```

### Claude Code / Claude Agent SDK — 接合部を全部外に開ける

コンテキストの扱いに独特の哲学があります。「フォルダとファイル構造そのものがコンテキストエンジニアリングの一形態になる」——インデックスを別途持つより、**ファイルシステムを文脈のストアとして使い、`grep` や `tail` で必要な分だけ引く**（agentic search）。セマンティック検索は速いが不透明なので、ファイルシステム的アプローチを尽くしてから使え、という順序づけです。

文脈が溢れたときの手当ては2系統。**サブエージェント**（並列化と、文脈の隔離＝親に要約だけ返す）と、**compact**（上限が近づくと過去メッセージを自動要約）。

外側ハーネスを書くための穴が **hooks** です。ループのほぼ全接合部にイベントが用意されています。

- ツール実行まわり — `PreToolUse` / `PostToolUse` / `PostToolUseFailure` / `PostToolBatch` / `PermissionRequest` / `PermissionDenied`
- ターン境界 — `UserPromptSubmit` / `Stop` / `StopFailure`
- 文脈操作 — `PreCompact` / `PostCompact` / `InstructionsLoaded`
- エージェント階層 — `SubagentStart` / `SubagentStop` / `TaskCreated` / `TaskCompleted`
- 環境 — `SessionStart` / `SessionEnd` / `FileChanged` / `CwdChanged` / `WorktreeCreate` / `Elicitation`

フックは外部プロセスとして起動され、stdout の JSON で判断を返します。

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "...",
    "updatedInput": {},
    "additionalContext": "..."
  }
}
```

`permissionDecision` でツール呼び出しを止められ、`updatedInput` で引数を書き換えられ、`additionalContext` で文脈を注入できる。終了コード 2 は JSON によらず強制ブロック。**つまりハーネスの制御点が、シェルスクリプトから触れる公開 API になっている**——これが Fowler のいう外側ハーネスの実装手段そのものです。

長時間タスク向けの設計として、Anthropic は[別の記事](https://www.anthropic.com/engineering/harness-design-long-running-apps)で **planner / generator / evaluator の3エージェント構成**を報告しています。ポイントは3つ。

1. 圧縮ではなく**コンテキストのリセット**——窓を丸ごと空にして新しいエージェントを立てる方が、一貫性の劣化と「context anxiety」を避けられる
2. **作る側と裁く側を分ける**（GAN 由来）——自己評価バイアスに対する強いレバー
3. エージェント間の受け渡しは**ファイル経由**——一方が書き、他方が読んで同じファイルか新しいファイルに返す

評価者は Playwright MCP で実際にアプリをクリックして回ります。

### mini-swe-agent — ハーネスの下限、約100行

Princeton / Stanford の SWE-bench チームによる、意図的に最小化されたハーネス。**bash だけ、tool-calling API すら使わない**構成で、[SWE-bench verified 74%超](https://github.com/SWE-agent/mini-swe-agent)。

設計の割り切りが明快です。

- ツールは bash だけ。ベンダー固有の編集プリミティブも、モデル固有の指示も持たない
- 各アクションは `subprocess.run` で**完全に独立して実行**される。ステートフルなシェルセッションを保持しない
- 履歴は完全に線形。**軌跡＝そのままモデルに渡す messages** で、両者に差がない

:::message
なぜこれが重要かというと、SWE-bench のリーダーボードが**ハーネスを固定してモデルだけを測る**ために使っているのがこれだからです。逆に言えば、**100行のハーネスでも74%出る**という事実が、残りの複雑さが何を買っているのかを問う基準線になります。
:::

ループの実体（`agents/default.py` より抜粋・整形）：

```python
def run(self, task: str = "", **kwargs) -> dict:
    self.messages = []
    self.add_messages(
        self.model.format_message(role="system",
            content=self._render_template(self.config.system_template)),
        self.model.format_message(role="user",
            content=self._render_template(self.config.instance_template)),
    )
    while True:
        try:
            self.step()
            self.n_consecutive_format_errors = 0   # clean step でリセット
        except FormatError as e:
            ...  # 連続 N 回で打ち切り
        finally:
            self.save(self.config.output_path)     # 毎ステップ軌跡を保存
        if self.messages[-1].get("role") == "exit":
            break
    return self.messages[-1].get("extra", {})

def step(self) -> list[dict]:
    return self.execute_actions(self.query())

def execute_actions(self, message: dict) -> list[dict]:
    outputs = [self.env.execute(a)
               for a in message.get("extra", {}).get("actions", [])]
    return self.add_messages(
        *self.model.format_observation_messages(message, outputs, ...))
```

停止条件は `query()` の先頭で押さえられていて、`step_limit`・`cost_limit`（既定 $3）・`wall_time_limit_seconds`・`max_consecutive_format_errors`（既定3）を超えると例外を投げてループが終わります。**予算と停止条件がハーネスの一級の関心事**であることが、100行の中でもはっきり分かります。

### SWE-agent — ACI、「人間用の CLI をそのまま渡さない」

元論文のタイトルが主張そのものです——*Agent-Computer Interfaces Enable Automated Software Engineering*。人間向けに最適化されたコマンド群（`vim` や生の `cat`）をそのまま渡すのではなく、**LM が扱いやすいように設計し直したインターフェース**を用意する、という発想。行番号つきのウィンドウ型ファイルビューアや、編集後に自動で構文チェックを走らせるエディタなどがそれにあたります。

プロンプト・ツール・環境が単一の YAML で宣言されるため、**ハーネス設計そのものが差分の取れる成果物になる**——研究用途で重宝される理由です。実行環境は SWE-ReX 経由で Docker・リモートを抽象化します。

### OpenHands — イベントストリームを唯一の状態にする

アーキテクチャが一本の流れとして定義されています。

```
User Message → Agent → LLM → Action → Runtime(sandbox) → Observation → Agent
```

要点は、**世界とのやり取りがすべて Action か Observation のどちらかで、両方が typed な Pydantic モデル**であること。そして**イベントストリームが state そのもの**であること——エージェントが認識しているものは、そのログの畳み込み（fold）に、累積コストや委譲メタデータのような補助情報を足したものです。

この設計の効き目は、UI もエージェントもランタイムも互いを直接呼ばないところに出ます。全員が同じ時系列ログを読み書きするだけなので、**UI がエージェント非依存になり、あらゆる実行が構造上リプレイ可能**になる。デバッグと評価のコストが根本から下がります。

ランタイムはタスクセッションごとに Docker コンテナを立て、その内部で動く REST API サーバに接続してアクションを実行し、結果を Observation として返します。旗艦の **CodeActAgent** は「20個の専用ツールにそれぞれ JSON スキーマを与えるのではなく、bash と Python とブラウザ DSL を渡して、あらゆる行動をコードとして表現させる」という設計です。

### Aider — コンテキスト構築だけを深く掘る

他の5例と違い、Aider が磨いているのは主に**「何をモデルに見せるか」**の一点です。

tree-sitter で各ファイルを AST に落とし、関数・クラス・変数・型の**定義シンボル**を抜き出します（ファイル全文ではなく、シグネチャを含む重要な行だけ）。大規模リポジトリでは、**ファイルをノード、依存をエッジとするグラフを作り、グラフランキングで重要な部分を選抜**します。トークン予算は `--map-tokens`（既定1k）で制御され、会話の状態に応じて動的に拡縮します。

実装は `py-tree-sitter-languages`（各言語のバイナリホイール）に、言語ごとの `tags.scm` の改変版を組み合わせたもの。`universal-ctags` の外部依存を排したのが前世代からの改善点です。**コンテキストエンジニアリングが「静的解析＋グラフ理論＋予算配分」の問題になる**という具体例として読む価値があります。

---

## 5. 横断比較

| 部品 | Codex | Claude Code | mini-swe-agent | OpenHands |
|---|---|---|---|---|
| 状態 | thread_store / rollout | セッション + 圧縮 | 線形な messages 配列 | append-only EventLog |
| ツール | registry + router + 並列実行、MCP 双方向 | Read/Edit/Bash/Glob/Grep + MCP + skills | bash のみ | bash / Python / ブラウザ DSL |
| 編集 | apply_patch（Lark 文法で形式定義） | 専用 Edit ツール | bash 内で完結 | コードとして表現 |
| 隔離 | Seatbelt(.sbpl) / Landlock+bwrap / Windows ネイティブ | 権限モード + サンドボックス | subprocess.run（隔離は外部任せ） | Docker + 内部 REST API |
| 承認 | untrusted / on-request / never / auto_review | hooks の permissionDecision | なし | confirmation mode |
| 文脈維持 | context_manager + compact_remote_v2 | compact + サブエージェント隔離 | なし（線形のまま） | condenser |
| 拡張点 | hooks / skills / plugin / MCP | hooks（20超のイベント）/ skills / plugins | Python のサブクラス | agenthub にエージェント追加 |
| 停止条件 | ターン・トークン予算 | ターン上限 + 予算 | 歩数 / コスト / 壁時計 / 連続フォーマットエラー | イテレーション上限 + 予算 |

横に読むと、**差が出るのは主に「隔離」「承認」「文脈維持」の3つ**だと分かります。ループとツールディスパッチは、どの実装でもほぼ同じ形に落ち着いています。

---

## 6. 自分で作るなら、どこから

mini-swe-agent が示した通り、動くハーネスの骨格は短く書けます。

```python
messages = [system_prompt, task_prompt]

while True:
    # 1. 予算と停止条件（ここを先に置くのが肝）
    if steps >= STEP_LIMIT or cost >= COST_LIMIT or elapsed >= TIME_LIMIT:
        break

    # 2. モデルを呼ぶ
    reply = model.query(messages)
    messages.append(reply)

    # 3. 行動を取り出す（tool_calls でも、テキストからのパースでもよい）
    actions = parse_actions(reply)
    if not actions:
        break                       # 終了宣言

    # 4. ポリシー判定 → 隔離実行 → 観測
    for action in actions:
        if not policy.allows(action):
            obs = ask_human(action)     # or deny
        else:
            obs = sandbox.execute(action)
        messages.append(format_observation(obs))

    # 5. 毎ステップ軌跡を保存（再開とデバッグの前提）
    save_trajectory(messages)
```

ここから先、複雑さを足す順序は**自分のリスクの高い順**で決まります。破壊的コマンドが怖ければ隔離と承認を先に。長いタスクで壊れるなら文脈維持を先に。どのファイルを見せるかで精度が決まるならコンテキスト構築を先に。

ただし現在の一次情報が揃って示唆するのは、**多くの人にとって投資対効果が高いのは内側ではなく外側だ**ということです。Fowler は外側ハーネスを2種類の制御に整理しています。

- **フィードフォワード（ガイド）** — エージェントが動く*前*に効くもの。ルール、ドキュメント、AGENTS.md。「最初の試行で良い結果を出す確率を上げる」
- **フィードバック（センサー）** — 動いた*後*に効くもの。テスト、リンタ、型チェッカ、AI コードレビュー。とくに**LLM が読むことを前提に書き直したリンタのメッセージ**は効く

速くて決定的な計算的チェック（テスト・lint・型）と、遅くて高価な推論的チェック（意味解析・AI レビュー）を使い分ける。そして規制の対象を、保守性ハーネス・アーキテクチャ適合ハーネス・振る舞いハーネスに分ける——最後の「振る舞い（機能的正しさ）」が**もっとも未成熟**だ、というのが Fowler の診断です。

実際、OpenAI は AGENTS.md を **約100行の「地図」**に保ち、そこから設計文書・アーキテクチャマップ・実行計画・品質評価といったより深い真実の源へポインタを張る、という運用を報告しています（初版の AGENTS.md 自体を Codex に書かせた）。アーキテクチャ制約は文章ではなく、**依存レイヤ（Types → Config → Repo → Service → Runtime → UI）を強制する機械的なルールと構造テスト**として書かれます。5ヶ月の実験では、エンジニアがソースを手書きせずに約100万行のベータ製品を出荷し、監督は PR とフィードバックで行った、と報告されています。

---

## まとめ

「ハーネスを作る」は、多くの場合**ゼロからループを書くことではありません**。既製のハーネス（Claude Code / Codex）を内側として受け入れ、自分のリポジトリに**ガイドとセンサーを機械可読な成果物として置く**ことが外側ハーネスの実体です。hooks の JSON 契約や AGENTS.md は、そのための公開 API にあたります。

- ハーネスは「賢さ」ではなく「制御」の層。モデルを差し替えても残る
- harness と scaffold は狭義では別物。ベンダー文書はほぼ広義（モデル以外すべて）
- 実装の差は「隔離」「承認」「文脈維持」に集中する。ループとツールディスパッチは収束済み
- 100行のハーネスが SWE-bench verified で74%。残りの複雑さが何を買っているかは、常に問える

---

## 出典

**OpenAI**

- [Codex as a platform: build on the open agent harness](https://developers.openai.com/blog/codex-as-a-platform)
- [Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/)（本文は取得不可、内容は下記 InfoQ 経由で確認）
- [OpenAI Introduces Harness Engineering — InfoQ](https://www.infoq.com/news/2026/02/openai-harness-engineering-codex/)
- [Codex — Agent approvals & security](https://learn.chatgpt.com/codex/agent-approvals-security)
- [github.com/openai/codex](https://github.com/openai/codex)（Apache-2.0）

**Anthropic**

- [Building agents with the Claude Agent SDK](https://claude.com/blog/building-agents-with-the-claude-agent-sdk)
- [Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Claude Code — Hooks リファレンス](https://code.claude.com/docs/en/hooks)

**用語と方法論**

- [Harness engineering for coding agent users — Martin Fowler](https://martinfowler.com/articles/harness-engineering.html)
- [Harness, Scaffold, and the AI Agent Terms Worth Getting Right — Hugging Face](https://huggingface.co/blog/agent-glossary)
- [AGENTS.md](https://agents.md/)（Linux Foundation 傘下 Agentic AI Foundation、6万超のリポジトリで採用）

**実装**

- [SWE-agent/mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent)
- [SWE-agent/SWE-agent](https://github.com/SWE-agent/SWE-agent)
- [OpenHands — Runtime Architecture](https://docs.openhands.dev/openhands/usage/architecture/runtime)
- [Aider — Building a better repository map with tree-sitter](https://aider.chat/2023/10/22/repomap.html)
