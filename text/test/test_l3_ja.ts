import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

const RULES = loadRules("ja");

const idsFor = (source: string): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, {}, true, "business/report").findings.map((finding) => finding.rule);

const countFor = (source: string, rule: string): number => idsFor(source).filter((id) => id === rule).length;

describe("L3 日本語", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  describe("no-mixed-desumasu", () => {
    it("invalid: ですます調の中に 1 文だけ である調が混ざる", () => {
      assert.ok(idsFor("運用を始めます。手順を作ります。研修も予定しています。効果は来期に測定する。").includes("no-mixed-desumasu"));
    });

    it("valid: ですます調で揃っていれば指摘しない", () => {
      assert.ok(!idsFor("運用を始めます。手順を作ります。効果は来期に測定します。").includes("no-mixed-desumasu"));
    });

    it("valid: である調で揃っていれば指摘しない", () => {
      assert.ok(!idsFor("運用を始める。手順を作る。効果は来期に測定する。").includes("no-mixed-desumasu"));
    });

    it("valid: 「〜ください」は ですます調（原形は「くださる」でも、書いた形で当てる）", () => {
      // Kubernetes の日本語の文書の末尾の「〜をご覧ください。」が、少数派として指摘されていた。
      assert.ok(!idsFor("運用を始めます。手順を作ります。効果は来期に測定します。詳しくは手順書をご覧ください。").includes("no-mixed-desumasu"));
    });

    it("valid: 「〜しません」「〜でした」は原形（ます・です）で当てる", () => {
      assert.ok(!idsFor("運用を始めます。手順を作ります。効果は測定しません。準備は十分でした。").includes("no-mixed-desumasu"));
    });

    it("valid: 文の途中の丁寧語（引用、連体）は文末の調子ではない", () => {
      assert.ok(!idsFor("運用を始める。手順を作る。本文では「ご覧ください」という表現を使う。効果を測定する。").includes("no-mixed-desumasu"));
      assert.ok(!idsFor("運用を始める。手順を作る。作成してくださいという表示を出す。効果を測定する。").includes("no-mixed-desumasu"));
      assert.ok(!idsFor("運用を始める。手順を作る。「確認します」と書いた欄を置く。効果を測定する。").includes("no-mixed-desumasu"));
    });

    it("valid: 引用で終わる文は、引用の中の文末で判定しない", () => {
      assert.ok(!idsFor("運用を始める。手順を作る。画面には「確認します。」。効果を測定する。").includes("no-mixed-desumasu"));
      assert.ok(!idsFor("運用を始める。手順を作る。表示は『完了しました』。効果を測定する。").includes("no-mixed-desumasu"));
      assert.ok(!idsFor("運用を始めます。手順を作ります。表示は『完了した』。効果を測定します。").includes("no-mixed-desumasu"));
    });

    it("valid: 文末の終助詞と添えた括弧の手前を見る（でしたか・です（§3））", () => {
      assert.ok(!idsFor("運用を始めます。手順を作ります。準備は十分でしたか。この件は重要です（§3）。").includes("no-mixed-desumasu"));
    });

    it("invalid: である調の中の「〜ください」は、ですます調として少数派になる", () => {
      assert.ok(idsFor("運用を始める。手順を作る。効果は来期に測定する。詳しくは手順書をご覧ください。").includes("no-mixed-desumasu"));
    });

    it("valid: 述語を持たない断片は文として数えない", () => {
      // 見出しの下の名前だけの行。実文書の誤検知はすべてこれだった。
      assert.ok(!idsFor("運用を始めます。手順を作ります。研修も予定しています。\n\nMaaSサービス\n\nWeb3").includes("no-mixed-desumasu"));
    });

    it("valid: 終止符で終わらない行は、述語で終わっていても文として数えない", () => {
      assert.ok(!idsFor("運用を始めます。手順を作ります。効果を測定します。\n\n設定を確認する\n").includes("no-mixed-desumasu"));
    });

    it("valid: 述語の無い文末（後ろへ渡す「以下の通り。」、名詞で終わる説明）は調子に数えない", () => {
      assert.ok(
        !idsFor("運用を始めます。手順を作ります。作業で出力するファイルは以下の通り。\n\n- 設定\n- 記録\n\n効果を測定します。").includes("no-mixed-desumasu"),
      );
      assert.ok(!idsFor("駅に着きます。観光客がよく使う出口は駅の北口。バスに乗ります。").includes("no-mixed-desumasu"));
      assert.ok(!idsFor("運用を始めます。手順を作ります。効果を測定します。移行は明日でも可能ですから。").includes("no-mixed-desumasu"));
    });

    it("invalid: 要件の「〜できること。」はである調として数え、ですます調の 1 文が少数派になる", () => {
      assert.ok(idsFor("会議室を予約できること。二重に予約できないこと。予約を取り消せること。前日に通知します。").includes("no-mixed-desumasu"));
    });

    it("valid: 「！」「？」の直後に助詞が続けば、そこは文末ではない", () => {
      assert.ok(!idsFor("運用を始めます。徹夜で作っていた！！という人を歓迎します。手順を作ります。").includes("no-mixed-desumasu"));
      assert.ok(!idsFor("運用を始める。日報を導入しませんか？が断られた。手順を作る。").includes("no-mixed-desumasu"));
    });

    it("invalid: 「。」の後が助詞で始まっても、手前の文の文末は数える", () => {
      assert.ok(idsFor("運用を始める。設定します。という方針を採用する。手順を作る。").includes("no-mixed-desumasu"));
    });

    it("valid: 「〜しましたこと。」は丁寧体として数える", () => {
      assert.ok(!idsFor("対応します。確認します。ご迷惑をおかけしましたこと。通知します。").includes("no-mixed-desumasu"));
    });

    it("invalid: 「！」「？」の後が助詞で始まらなければ、そこで文は終わる", () => {
      assert.ok(idsFor("運用を始める。日報を導入しませんか？ 手順を作る。効果を測る。").includes("no-mixed-desumasu"));
      assert.ok(idsFor("運用を始めます。徹夜で作っていた！手順を作ります。効果を測ります。").includes("no-mixed-desumasu"));
    });

    it("invalid: 述語で終わる文は、名詞が挟まっても調子を持つ（〜である・〜だ）", () => {
      assert.ok(idsFor("運用を始めます。手順を作ります。効果を測定します。出力するファイルは以下の通りである。").includes("no-mixed-desumasu"));
    });

    it("valid: ですます調の本文に、常体で揃えた箇条書き", () => {
      const source =
        "巡礼を始めます。装束を選びます。準備を整えます。\n\n- 白衣には死装束の意味があった。\n- 金剛杖は巡礼者であることを示す。\n\n寺を回ります。";
      assert.ok(!idsFor(source).includes("no-mixed-desumasu"));
    });

    it("invalid: 箇条書きの中で調子が混ざる", () => {
      assert.equal(countFor("手順を説明します。\n\n- 名前を記載します。\n- 所管を記載します。\n- 所在を記載する。\n", "no-mixed-desumasu"), 1);
    });

    it("invalid: 入れ子の項目は外側の箇条書きと一緒に見る", () => {
      assert.equal(countFor("手順を説明します。\n\n- 名前を記載します。\n  - 所管を記載する。\n- 所在を記載します。\n", "no-mixed-desumasu"), 1);
    });

    it("invalid: 本文の混在は、常体の箇条書きがあっても指摘する", () => {
      const source = "運用を始めます。手順を作ります。効果は来期に測定する。\n\n- 設定を確認する。\n- 記録を残す。\n\n研修も予定しています。";
      assert.equal(countFor(source, "no-mixed-desumasu"), 1);
    });
  });

  describe("no-doubled-joshi", () => {
    it("invalid: 「の」が読点を挟まずに 3 回続く", () => {
      assert.equal(countFor("弊社の新製品の販売の計画を説明します。", "no-doubled-joshi"), 1);
    });

    it("valid: 読点で区切られた並列は数えない", () => {
      assert.equal(countFor("サービスの運営や、ドキュメントの作成、イベントの運営などです。", "no-doubled-joshi"), 0);
    });

    it("valid: 「も」の並列と「て」の連用は何重でも読める", () => {
      assert.equal(countFor("実装もテストもレビューも機械に移しました。", "no-doubled-joshi"), 0);
      assert.equal(countFor("そのままコピーして持っていってください。", "no-doubled-joshi"), 0);
    });

    it("valid: 他の助詞で句が閉じたら、そこで連なりは切れる", () => {
      assert.equal(countFor("弊社の新製品は他社の製品の後に出ます。", "no-doubled-joshi"), 0);
    });
  });

  describe("taigen-dome-in-prose", () => {
    const five = "手当ては2系統。原因は設定漏れ。対象は全社員。期限は今月末。方針は据え置き。結論は現状維持。";

    it("invalid: 本文で体言止めが続く", () => {
      assert.ok(idsFor(five).includes("taigen-dome-in-prose"));
    });

    it("文書あたり 1 件にまとめる。1 文ずつ並べない", () => {
      assert.equal(countFor(five, "taigen-dome-in-prose"), 1);
    });

    it("valid: 箇条書きの体言止めは数えない", () => {
      const list = five
        .split("。")
        .filter((part) => part.length > 0)
        .map((part) => `- ${part}。`)
        .join("\n");
      assert.ok(!idsFor(list).includes("taigen-dome-in-prose"));
    });

    it("valid: 「〜のか」の「の」は体言止めではない", () => {
      const questions = "なぜ速いのか。どこが効くのか。誰が決めるのか。いつ出すのか。何を測るのか。どう直すのか。";
      assert.ok(!idsFor(questions).includes("taigen-dome-in-prose"));
    });

    it("valid: 述語で終わる文が並んでも指摘しない", () => {
      assert.ok(!idsFor("手当ては2系統です。原因は設定漏れです。対象は全社員です。期限は今月末です。方針は据え置きです。").includes("taigen-dome-in-prose"));
    });
  });

  it("日本語の rule は英語で動かさない", () => {
    const result = runRules(buildDocument("t.md", "The plan of the sale of the product.", en), loadRules("en"), {}, true, "business/report");
    ["no-mixed-desumasu", "no-doubled-joshi", "taigen-dome-in-prose"].forEach((id) => {
      assert.ok(
        result.skipped.some((entry) => entry.rule === id),
        `${id} が skip されていない`,
      );
    });
  });
});
