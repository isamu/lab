import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { codeLines, rewriteFirst, type Plant } from "../scripts/bench-text.ts";
import { doubleHonorific, doubleParticle, dotList, glueKanji, humbleForms, kanjiAdverb, passiveJa } from "../scripts/bench-mutations-ja.ts";
import { doubleArticle, expletiveOf, expletives, flipFirstList, flipLastHeading, isTitleCase, oxfordOf, passiveEn } from "../scripts/bench-mutations-en.ts";
import {
  TEAM_JARGON,
  boldSection,
  dashes,
  decorate,
  dropSection,
  echoHeading,
  jargon,
  joinParagraphs,
  requiredSectionsOf,
} from "../scripts/bench-mutations-layout.ts";
import { MUTATIONS } from "../scripts/bench-mutations.ts";

// yarn bench で足した誤りの植えかた。どの行に何を植えるか、植えないのはどんなときかを、短い自作の文書で固定する。

const lines = (...rows: string[]): string => rows.join("\n");
const limits = (entries: Record<string, number>): { readonly limits: Readonly<Record<string, number>> } => ({ limits: entries });

/** 植えた行の中身と行番号。 */
const at = (plant: Plant | undefined): readonly [number, string] | undefined =>
  plant === undefined ? undefined : [plant.line, plant.source.split("\n")[plant.line - 1] ?? ""];

describe("codeLines / rewriteFirst", () => {
  it("囲みの行とその中の行をコードとし、そこには植えない", () => {
    const source = lines("前の行。", "```sh", "相談する", "```", "後の行で相談する。");
    assert.deepEqual([...codeLines(source.split("\n"))], [1, 2, 3]);
    assert.deepEqual(
      at(
        rewriteFirst(
          source,
          (line) => line.includes("相談"),
          (line) => line.replace("相談", "壁打ち"),
        ),
      ),
      [5, "後の行で壁打ちする。"],
    );
  });

  it("閉じていない囲みは、文書の終わりまでコード", () => {
    assert.deepEqual([...codeLines(["a", "```", "b"])], [1, 2]);
  });
});

describe("kanjiAdverb / doubleHonorific", () => {
  it("ひらがなの副詞を漢字にし、敬語を一つ重ねる", () => {
    assert.deepEqual(at(kanjiAdverb(lines("# 案内", "", "あらかじめ登録してください。"))), [3, "予め登録してください。"]);
    assert.deepEqual(at(doubleHonorific("明日、御社へ伺います。")), [1, "明日、御社へお伺いさせていただきます。"]);
  });

  it("書き換える語が無ければ植えない。見出しには植えない", () => {
    assert.equal(kanjiAdverb("# ほとんど"), undefined);
    assert.equal(doubleHonorific("明日、御社へ行きます。"), undefined);
  });
});

describe("humbleForms", () => {
  const polite = lines("資料を共有します。", "日程を調整します。", "結果を報告しました。", "費用を請求します。");

  it("漢語に続く「します」を、上限の数だけ「させていただきます」にする", () => {
    const plant = humbleForms(polite, limits({ "sasete-itadaku": 3 }));
    assert.deepEqual(plant?.source.split("\n"), [
      "資料を共有させていただきます。",
      "日程を調整させていただきます。",
      "結果を報告させていただきました。",
      "費用を請求します。",
    ]);
    assert.equal(plant?.line, 1);
  });

  it("上限に届く数が無ければ、または上限が分からなければ植えない。「いたします」は替えない", () => {
    assert.equal(humbleForms(polite, limits({ "sasete-itadaku": 5 })), undefined);
    assert.equal(humbleForms(polite, limits({})), undefined);
    assert.equal(humbleForms(lines("お願いいたします。", "お知らせいたします。"), limits({ "sasete-itadaku": 1 })), undefined);
  });
});

describe("glueKanji", () => {
  it("「の」を抜くと上限より長くなる漢字の組だけをつなぐ", () => {
    assert.deepEqual(at(glueKanji("総務部門の管理責任者が見る。", limits({ "max-kanji-continuous": 8 }))), [1, "総務部門管理責任者が見る。"]);
    assert.equal(glueKanji("総務部門の管理責任者が見る。", limits({ "max-kanji-continuous": 9 })), undefined);
  });

  it("「の」の前後が漢字でなければ、または上限が分からなければ植えない", () => {
    assert.equal(glueKanji("総務部門の、管理責任者が見る。", limits({ "max-kanji-continuous": 8 })), undefined);
    assert.equal(glueKanji("タブレットの管理責任者が見る。", limits({ "max-kanji-continuous": 1 })), undefined);
    assert.equal(glueKanji("総務部門の管理責任者が見る。", limits({})), undefined);
  });
});

describe("dotList", () => {
  it("読点が上限より多い文の読点を中黒にする。ほかの文は替えない", () => {
    const plant = dotList("前の文、そのまま。A、B、C、D、E、Fを使う。", limits({ "no-nakaguro-parallel": 4 }));
    assert.deepEqual(at(plant), [1, "前の文、そのまま。A・B・C・D・E・Fを使う。"]);
  });

  it("読点が上限ちょうどなら植えない", () => {
    assert.equal(dotList("A、B、C、D、Eを使う。", limits({ "no-nakaguro-parallel": 4 })), undefined);
  });
});

describe("passiveJa", () => {
  it("「〜を〇〇した」を、動作主の無い「〜が〇〇された」にする。箇条書きの記号は残す", () => {
    assert.deepEqual(at(passiveJa("九月末に、各部へ結果を共有した。")), [1, "九月末に、各部へ結果が共有された。"]);
    assert.deepEqual(at(passiveJa("- 春に試験を実施しました。")), [1, "- 春に試験が実施されました。"]);
  });

  it("主語や動作主の書いてある文には植えない", () => {
    assert.equal(passiveJa("委員会は方針を決定した。"), undefined);
    assert.equal(passiveJa("総務部から結果を共有した。"), undefined);
  });
});

describe("expletiveOf / expletives", () => {
  it("must / should / will の文を、主語を後ろへ押しやる書き出しにする", () => {
    assert.equal(expletiveOf("The team must review the plan."), "It is essential that the team review the plan.");
    assert.equal(expletiveOf("We should meet early."), "It is important that we meet early.");
    assert.equal(expletiveOf("Room C will get blinds."), "It is expected that room C will get blinds.");
    assert.equal(expletiveOf("It will rain."), undefined);
    assert.equal(expletiveOf("In the second half we will try."), undefined);
  });

  it("上限より一つ多い文だけを書き換え、最初の行を指す。足りなければ植えない", () => {
    const source = lines("# Plan", "", "We must go. We should stay.", "They will call.", "Staff must sign. Nobody asked.");
    const plant = expletives(source, limits({ "expletive-construction": 3 }));
    assert.equal(plant?.line, 3);
    assert.deepEqual(plant?.source.split("\n").slice(2), [
      "It is essential that we go. It is important that we stay.",
      "It is expected that they will call.",
      "It is essential that staff sign. Nobody asked.",
    ]);
    assert.equal(expletives(source, limits({ "expletive-construction": 4 })), undefined);
  });
});

describe("oxfordOf / flipFirstList", () => {
  it("最後の and の前に読点があるか。読点の無い文は判定しない", () => {
    assert.equal(oxfordOf("We sell pens, ink, and paper."), true);
    assert.equal(oxfordOf("We sell pens, ink and paper."), false);
    assert.equal(oxfordOf("We sell pens and paper."), undefined);
  });

  it("揃った文書の最初の並列だけ逆にする。三文に満たない、揃っていない文書には植えない", () => {
    const oxford = lines("A, B, and C.", "D, E, and F.", "G, H, and I.");
    assert.deepEqual(at(flipFirstList(oxford)), [1, "A, B and C."]);
    assert.deepEqual(at(flipFirstList(lines("A, B and C.", "D, E and F.", "G, H and I."))), [1, "A, B, and C."]);
    assert.equal(flipFirstList(lines("A, B, and C.", "D, E, and F.")), undefined);
    assert.equal(flipFirstList(lines("A, B, and C.", "D, E and F.", "G, H, and I.")), undefined);
  });

  it("読点が一つだけの「X, and Y」は節のつなぎなので、Oxford の側からは替えない", () => {
    assert.equal(flipFirstList(lines("It rained, and we left.", "It snowed, and we stayed.", "It cleared, and we met.")), undefined);
  });
});

describe("isTitleCase / flipLastHeading", () => {
  it("大文字化の効く語が二つ以上ある見出しだけを判定する", () => {
    assert.equal(isTitleCase("Price and Setup"), true);
    assert.equal(isTitleCase("Price and setup"), false);
    assert.equal(isTitleCase("Contact"), undefined);
  });

  it("揃った見出しの最後の一つだけ流儀を逆にする。略語は大文字のまま", () => {
    const plant = flipLastHeading(lines("# Room booking guide", "## Why we built it", "## Price and setup", "## Contact"));
    assert.deepEqual(at(plant), [3, "## Price and Setup"]);
    assert.deepEqual(at(flipLastHeading(lines("# Room Booking Guide", "## Why We Built It", "## Using the API Key"))), [3, "## Using the API key"]);
  });

  it("三つに満たない、揃っていない見出しには植えない", () => {
    assert.equal(flipLastHeading(lines("# Room booking", "## Price and setup")), undefined);
    assert.deepEqual(at(flipLastHeading(lines("# Room Booking Guide", "## Why We Built It", "## API and SDK"))), [2, "## Why we built it"]);
    assert.equal(flipLastHeading(lines("# Room booking", "## Price and Setup", "## Why we built it")), undefined);
  });
});

describe("passiveEn", () => {
  it("「We 〜ed the X」を、動作主の無い受け身にする。前置詞からは残す", () => {
    assert.deepEqual(at(passiveEn("We tested the first version with three teams.")), [1, "The first version was tested with three teams."]);
    assert.deepEqual(at(passiveEn("- We shared the results.")), [1, "- The results were shared."]);
  });

  it("by のある文、不規則動詞の文には植えない", () => {
    assert.equal(passiveEn("We tested the app by hand."), undefined);
    assert.equal(passiveEn("We sent the report."), undefined);
  });
});

describe("doubleArticle / doubleParticle", () => {
  it("本文の最初の the と、名詞の後ろの最初の を を重ねる", () => {
    assert.deepEqual(at(doubleArticle(lines("# The plan", "", "Send the report to the team."))), [3, "Send the the report to the team."]);
    assert.deepEqual(at(doubleParticle(lines("# 計画", "", "資料を送り、結果を待つ。"))), [3, "資料をを送り、結果を待つ。"]);
  });

  it("見出し・表・コードと、重ねる語の無い文書には植えない", () => {
    assert.equal(doubleArticle(lines("# Read the plan", "| the value |", "```", "the code", "```", "Other text.")), undefined);
    assert.equal(doubleArticle("There is theory here."), undefined);
    assert.equal(doubleParticle(lines("# 資料を送る", "| 資料を送る |", "ここを見る。")), undefined);
  });
});

describe("joinParagraphs", () => {
  const three = "One. Two. Three.";

  it("空行だけを挟む二つの段落を一つにし、上の段落の最初の行を指す", () => {
    const plant = joinParagraphs(lines("# T", "", three, "", three), limits({ "max-paragraph-length": 5 }));
    assert.deepEqual(plant?.source.split("\n"), ["# T", "", three, three]);
    assert.equal(plant?.line, 3);
  });

  it("文が上限を超えない組、見出しを挟む組、文で終わらない行の段落はつながない", () => {
    assert.equal(joinParagraphs(lines(three, "", three), limits({ "max-paragraph-length": 6 })), undefined);
    assert.equal(joinParagraphs(lines(three, "## H", three), limits({ "max-paragraph-length": 5 })), undefined);
    assert.equal(joinParagraphs(lines("第4条（管理）", three, "", three), limits({ "max-paragraph-length": 5 })), undefined);
  });
});

describe("echoHeading", () => {
  it("節の番号を除いて六文字ある最初の見出しの後に、見出しを言い直す文を足す", () => {
    assert.deepEqual(at(echoHeading(lines("# T", "## 目的", "## 2. サービスの特徴", "本文です。"))), [5, "サービスの特徴について説明します。"]);
    assert.deepEqual(at(echoHeading(lines("## 1. Overview", "Body."))), [3, "This section covers Overview."]);
  });

  it("である調の文書は、である調で言い直す。短い見出しばかりなら植えない", () => {
    assert.deepEqual(at(echoHeading(lines("## 機能に関する要件", "本文である。"))), [3, "機能に関する要件について説明する。"]);
    assert.equal(echoHeading(lines("## 目的", "## 3.2 データ")), undefined);
  });
});

describe("boldSection", () => {
  const long = "a".repeat(40);
  const section = lines("## Words", ...Array.from({ length: 5 }, () => `Word alpha beta gamma delta ${long}.`));

  it("200 字以上ある最初の節で、上限の倍の密度になるまで太字にする", () => {
    const plant = boldSection(section, limits({ "bold-density": 10 }));
    assert.equal(plant?.line, 2);
    assert.equal((plant?.source.match(/\*\*/gu)?.length ?? 0) / 2, 7);
  });

  it("200 字に満たない節、太字にする語が足りない節には植えない", () => {
    assert.equal(boldSection(lines("## Short", "Word alpha beta."), limits({ "bold-density": 10 })), undefined);
    assert.equal(boldSection(lines("## Middle", `Word alpha beta gamma delta ${"a".repeat(150)}.`), limits({ "bold-density": 10 })), undefined);
    assert.equal(boldSection(section, limits({ "bold-density": 1000 })), undefined);
  });
});

describe("decorate / dashes", () => {
  const words = Array.from({ length: 50 }, () => "word").join(" ");
  const english = lines("# T", ...Array.from({ length: 4 }, () => `- ${words}, end.`));

  it("本文のすべての行を書き換え、最初の行を指す。見出しは替えない", () => {
    assert.deepEqual(at(decorate(english)), [2, `- ✅ ${words}, end.`]);
    assert.deepEqual(at(dashes(english)), [2, `- ${words} — end.`]);
    assert.equal(decorate(english)?.source.startsWith("# T\n"), true);
    assert.equal(decorate(lines(english, "```", "code, here", "```"))?.source.endsWith("```\ncode, here\n```"), true);
  });

  it("日本語は読点をダッシュにする。短い文書には植えない", () => {
    assert.deepEqual(at(dashes(`${"あ".repeat(500)}、い。`)), [1, `${"あ".repeat(500)}——い。`]);
    assert.equal(decorate("# T\n\n- short, line."), undefined);
  });
});

describe("jargon / TEAM_JARGON", () => {
  it("普通の語を一つ社内用語にする。植える語がチームの jargon", () => {
    assert.deepEqual(at(jargon("来週に相談する。")), [1, "来週に壁打ちする。"]);
    assert.deepEqual(at(jargon("We meet on Monday.")), [1, "We sync up on Monday."]);
    assert.equal(TEAM_JARGON.includes("壁打ち") && TEAM_JARGON.includes("sync up"), true);
  });

  it("語の一部には当てない", () => {
    assert.equal(jargon("The meeting is on Monday."), undefined);
  });
});

describe("requiredSectionsOf / dropSection", () => {
  const source = lines("# Title", "## Scope", "text", "### Detail", "text", "## Risks", "text");

  it("節見出しをすべて必須とし、最後の節見出しを消す", () => {
    assert.deepEqual(requiredSectionsOf(source), ["Scope", "Detail", "Risks"]);
    const plant = dropSection(source);
    assert.equal(plant?.source.includes("## Risks"), false);
    assert.equal(plant?.line, 6);
  });

  it("節見出しの無い文書には植えない", () => {
    assert.equal(dropSection(lines("# Title", "text")), undefined);
  });
});

describe("MUTATIONS", () => {
  it("文書全体に言う rule の誤りだけが、どこで言っても見つけたとする", () => {
    assert.deepEqual(
      MUTATIONS.filter((mutation) => mutation.reportsOn === "document").map((mutation) => mutation.rule),
      ["required-sections"],
    );
  });
});
