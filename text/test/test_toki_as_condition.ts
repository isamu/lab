import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules, namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { conditionSpellingsIn, conditionWordsOf } from "../packages/chaff/src/detectors/condition-toki.ts";

// 条件を言う「時」（toki-as-condition）。法務のジャンルだけで動く。例文は自作か、法令（著作権法 13 条で権利の目的とならない）の抜粋。

const RULE = "toki-as-condition";
const CONTRACT = "legal/contract";
const STATUTE = "legal/statute";

before(async () => {
  await ja.prepare?.({ pos: true });
});

const findingsOf = (source: string, genre = CONTRACT): readonly string[] => namedRuleRun(RULE, source, ja, "a.md", genre).findings;

const SAYS = "条件を言うなら「時」は「とき」と書きます";

describe("toki-as-condition: 条件の「時」を指す", () => {
  it("〜た時は・〜る時には・〜た時も", () => {
    assert.deepEqual(findingsOf("第1条　乙は、認定を受けた時は、甲に届け出る。\n第2条　期限を過ぎる時には通知する。契約が終了した時も同様とする。\n"), [
      SAYS,
      SAYS,
      SAYS,
    ]);
  });

  it("〜ない時は・〜な時は（否定と形容動詞で終わる節）", () => {
    assert.deepEqual(findingsOf("第3条　乙が支払わない時は、甲は解除できる。必要な時は甲に申請する。\n"), [SAYS, SAYS]);
  });

  it("法令の「とき」を「時」に替えると指し、元の文は指さない（労働基準法第十八条第五項）", () => {
    const written =
      "使用者は、労働者の貯蓄金をその委託を受けて管理する場合において、労働者がその返還を請求したときは、遅滞なく、これを返還しなければならない。";
    assert.deepEqual(findingsOf(`第十八条\u3000${written}\n`, STATUTE), []);
    assert.deepEqual(findingsOf(`第十八条\u3000${written.replace("請求したときは", "請求した時は")}\n`, STATUTE), [SAYS]);
  });

  it("どの位置か: 時の字を指す", () => {
    const doc = buildDocument("a.md", "認定を受けた時は届け出る。\n", ja);
    const words = conditionWordsOf(doc.lexicons["condition-toki"], doc.lexicons["condition-follower"]);
    const sentence = doc.sentences[0];
    assert.ok(sentence !== undefined);
    assert.deepEqual(conditionSpellingsIn(sentence, words), [{ written: "時", preferred: "とき", offset: 6 }]);
  });
});

describe("toki-as-condition: 時点の「時」と、ほかの語は指さない", () => {
  it("時から・時まで・時に・時において（時点）", () => {
    assert.deepEqual(
      findingsOf("第4条　相続開始の時から起算する。契約が終了する時まで有効とする。乙が死亡した時に、この契約は終わる。損害が生じた時において判断する。\n"),
      [],
    );
  });

  it("名詞・その・ある の後ろ（事故の時は、その時は、ある時は）と、文頭の「時には」", () => {
    assert.deepEqual(findingsOf("第5条　事故の時は連絡する。その時は届け出る。ある時は北へ行く。時には休む。\n"), []);
  });

  it("時効・時間・同時・随時・臨時・当時・時点・時期", () => {
    assert.deepEqual(
      findingsOf(
        "第6条　時効は五年とする。時間は甲が決める。同時に通知する。随時の検査は、臨時の会議で決める。当時の価格、その時点の価格、支払の時期は別に定める。\n",
      ),
      [],
    );
  });

  it("「とき」と書いた所", () => {
    assert.deepEqual(findingsOf("第7条　乙は、認定を受けたときは、甲に届け出る。期限を過ぎるときには通知する。\n"), []);
  });

  it("鉤括弧で引いた中（読み替えの文）", () => {
    assert.deepEqual(findingsOf("第8条　第三条中「認定を受けた時は」とあるのは「承認を受けたときは」と読み替える。\n"), []);
  });

  it("法令の時点の「時」（民法第八百八十二条、第百六十六条第一項第一号）", () => {
    assert.deepEqual(
      findingsOf(
        "第八百八十二条　相続は、死亡によって開始する。\n第百六十六条　債権は、次に掲げる場合には、時効によって消滅する。\n一　債権者が権利を行使することができることを知った時から五年間行使しないとき。\n",
        STATUTE,
      ),
      [],
    );
  });
});

describe("toki-as-condition: 法務のジャンルだけで動く", () => {
  const source = "第1条　乙は、認定を受けた時は、甲に届け出る。\n";

  it("契約書と法令では動き、報告書・ブログでは動かない", () => {
    assert.ok(firedRules(ja, source, CONTRACT).includes(RULE));
    assert.ok(firedRules(ja, source, STATUTE).includes(RULE));
    assert.ok(!firedRules(ja, source, "business/report").includes(RULE));
    assert.ok(!firedRules(ja, source, "blog/tech").includes(RULE));
  });
});
