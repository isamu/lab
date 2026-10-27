import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// no-mixed-desumasu: ページが添えた注記（※…）、行に並べ直した表のセル、叫び（…かっ！）、「これだけで」で受ける行いの書き出しは、数えたうえで指さない。
// どれも、形が外れれば今までどおり指すことを一緒に確かめる。例文は自作と、国税庁の通達のページ・政府広報の表を縮めたもの。

const findingsOf = (source: string, genre = "business/report"): readonly string[] => namedRuleRun("no-mixed-desumasu", source, ja, "a.md", genre).findings;

const polite = ["新しい制度は来月から始まります。", "申請の窓口は区役所です。", "受付は平日の九時からです。", "必要な書類は三つあります。"].join("");
const plain = ["新しい制度は来月から始まる。", "申請の窓口は区役所である。", "受付は平日の九時からである。", "必要な書類は三つある。"].join("");

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("no-mixed-desumasu: ※で始まる行の注記", () => {
  it("である調の通達の下の「※…をご覧ください。」を指さない", () =>
    assert.deepEqual(
      findingsOf(`# 一部改正について\n\n${plain}\n\n※PDFファイルが開けない、印刷できないなどの場合はこちらをご覧ください。\n`, "business/email"),
      [],
    ));

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
