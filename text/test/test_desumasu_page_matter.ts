import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// no-mixed-desumasu: ページが添えた注記（※…、＊…）、行に並べ直した表のセル、叫び（…かっ！）、「これだけで」で受ける行いの書き出しは、数えたうえで指さない。
// どれも、形が外れれば今までどおり指すことを一緒に確かめる。例文は自作と、国税庁の通達のページ・政府広報の表を縮めたもの。

const findingsOf = (source: string, genre = "business/report"): readonly string[] => namedRuleRun("no-mixed-desumasu", source, ja, "a.md", genre).findings;

const polite = ["新しい制度は来月から始まります。", "申請の窓口は区役所です。", "受付は平日の九時からです。", "必要な書類は三つあります。"].join("");
const plain = ["新しい制度は来月から始まる。", "申請の窓口は区役所である。", "受付は平日の九時からである。", "必要な書類は三つある。"].join("");

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("no-mixed-desumasu: ※や＊で始まる行の注記", () => {
  it("である調の通達の下の「※…をご覧ください。」を指さない", () =>
    assert.deepEqual(
      findingsOf(`# 一部改正について\n\n${plain}\n\n※PDFファイルが開けない、印刷できないなどの場合はこちらをご覧ください。\n`, "business/email"),
      [],
    ));

  const minutes = (mark: string): string =>
    [
      "# 第4回会合の概要\n\n## 1．議事要旨\n\n(1) 報告書（案）について\n資料1について事務局から説明があり、質疑応答が行われた。\n",
      "(2) 報告書の承認について\n質疑での意見を反映することとして、報告書（案）が承認された。\n\n",
      "## 2．事務局からの連絡\n\n(1) 報告書の取扱い\n\n- 構成員に配布するとともに、ホームページに掲載する。\n\n",
      "(2) 議事録の確認について\n\n- 本日の会合の議事録案をメールで送付する。\n\n",
      `## 3．配布資料\n\n(1) 資料1　　調査検討報告書（案）（5，690KB）\n${mark}承認された報告書については、後日掲載します。\n`,
      `(2) 参考資料　調査検討報告書（案）概要版（165KB）\n${mark}図は圧縮しているため、見にくくなっています。詳細な図は、後日掲載する報告書で確認してください。\n\n`,
      "## 4．その他\n\n承認された報告書を座長から局長へ提出した。\n",
    ].join("");

  it("である調の議事の配布資料の下の「＊…」の行の注記も指さない", () => {
    assert.deepEqual(findingsOf(minutes("＊"), "business/meeting-notes"), []);
    assert.equal(findingsOf(minutes(""), "business/meeting-notes").length, 3);
  });

  it("※の無い依頼と、行の途中の※の後ろの文は今までどおり指す", () => {
    assert.equal(findingsOf(`# 一部改正について\n\n${plain}\n\nPDFファイルが開けない場合はこちらをご覧ください。\n`, "business/email").length, 1);
    assert.equal(
      findingsOf(`# 一部改正について\n\n${plain}別紙のとおり改める（※印の箇所）。開けない場合はこちらをご覧ください。\n`, "business/email").length,
      1,
    );
  });
});

describe("no-mixed-desumasu: 行に並べ直した表のセル", () => {
  const ahead = "電池の種類\n\n受託要件\n\n";
  const after = "\n\nリチウムイオン電池\n\n一部の車いすに使用されている\n";
  const cell = "制限なし。\nただし航空会社の規定により、「2個」に制限されている場合がある。";

  it("文で終わらない行の塊に前後を二つずつ挟まれたセルを指さない", () =>
    assert.deepEqual(findingsOf(`# 持込みのルール\n\n${polite}\n\n${ahead}${cell}${after}`, "blog/owned-media"), []));

  it("片側の塊が一つだけ、または見出しで挟まれた段落は今までどおり指す", () => {
    assert.equal(findingsOf(`# 持込みのルール\n\n${polite}\n\n受託要件\n\n${cell}${after}`, "blog/owned-media").length, 2);
    assert.equal(findingsOf(`# 持込みのルール\n\n${polite}\n\n## 電池\n\n## 制限\n\n${cell}\n\n## 予備\n\n## 場所\n`, "blog/owned-media").length, 2);
  });
});

describe("no-mixed-desumasu: 「！」で終わる叫び", () => {
  it("ですます調の記事の「わかるかっ！！！」を指さない", () => assert.deepEqual(findingsOf(`# 性能\n\n${polite}\n\nわかるかっ！！！\n`, "blog/tech"), []));

  it("「！」の無い常体の文は今までどおり指す", () => assert.equal(findingsOf(`# 性能\n\n${polite}\n\nこれでは原因がわからない。\n`, "blog/tech").length, 1));
});

describe("no-mixed-desumasu: 「これだけで」で受ける行いの書き出し", () => {
  it("次の文が「これだけで」で受ける常体の文を指さない", () =>
    assert.deepEqual(findingsOf(`# 読書メモ\n\n${polite}たとえば、案内に決めることを書いて送る。これだけで、会議が短くなりました。\n`, "blog/essay"), []));

  it("次の文が「これは」「この」で始まる常体の文は今までどおり指す", () => {
    assert.equal(findingsOf(`# 読書メモ\n\n${polite}たとえば、案内に決めることを書いて送る。これは会議を短くしました。\n`, "blog/essay").length, 1);
    assert.equal(findingsOf(`# 読書メモ\n\n${polite}たとえば、案内に決めることを書いて送る。この方法で会議が短くなりました。\n`, "blog/essay").length, 1);
  });
});
