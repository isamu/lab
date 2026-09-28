import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { maskAddresses } from "../packages/chaff/src/address-chain.ts";
import { loadProfiles } from "../packages/chaff/src/profile/load.ts";
import type { DocumentProfile } from "../packages/chaff/src/plugin.ts";

// 番地（第二十二条第二項）は漢字の連なりに数えず、区切りとして扱う。書き方は同梱の profiles/statute.yaml が持つ。

const statute = loadProfiles().find((definition) => definition.id === "statute")?.languages["ja"];
if (statute === undefined) throw new Error("profiles/statute.yaml has no ja section");

const maskLegalAddresses = (text: string): string => maskAddresses(text, statute);

describe("maskAddresses — 法令（statute）", () => {
  const cases: readonly (readonly [string, string])[] = [
    ["第二十二条第二項", "  "],
    ["第二百三十六条第一項第七号", "   "],
    ["第五十二条の二第一項", "  "],
    ["第十六条の二第五項に規定する", "  に規定する"],
    ["第三条の規定", " の規定"],
    ["第一編第二章第三節第一款第一目", "     "],
    ["金融商品取引法第二十四条第一項", "金融商品取引法  "],
    ["第二百九十八条第一項各号", "  各号"],
    ["第〇条", " "],
    ["第十一条の二の三第一項", "  "],
    ["第一項本文", " 本文"],
    ["第二条第一項及び第二項", "  及び "],
    ["第五条中", " 中"],
    ["第九百三十九条第三項後段", "  後段"],
    ["第一条件", "第一条件"],
    ["第十項目標管理制度導入", "第十項目標管理制度導入"],
    ["第一目標達成管理基準", "第一目標達成管理基準"],
    ["第一編集部", "第一編集部"],
    ["第三号機", "第三号機"],
    ["第二条第一号機", "第二条第一号機"],
    ["第五条中央銀行", "第五条中央銀行"],
    ["第五条並行処理", "第五条並行処理"],
    ["第五条若年雇用", "第五条若年雇用"],
    ["第五条及川研究所", "第五条及川研究所"],
    ["第五条各項目標", "第五条各項目標"],
    ["第五十二条の二中央銀行", " の二中央銀行"],
    ["第五条第三者委員会", "第五条第三者委員会"],
    ["第一項各号又は", " 各号又は"],
    ["同条第一項本文中", "同条 本文中"],
    ["第三項乃至第六項", " 乃至 "],
    ["第五条第五項中央銀行", "第五条第五項中央銀行"],
    ["第五条及第五項中央銀行", "第五条及第五項中央銀行"],
    ["第五条第五項。第六条中央銀行", "  。第六条中央銀行"],
    ["第3条第2項", "第3条第2項"],
    ["第三者", "第三者"],
    ["第二", "第二"],
    ["次第", "次第"],
    ["二十二条", "二十二条"],
    ["第条", "第条"],
    ["情報処理推進機構認定試験", "情報処理推進機構認定試験"],
    ["", ""],
  ];
  cases.forEach(([source, masked]) => {
    it(`${source || "(空)"} → ${masked || "(空)"}`, () => {
      assert.equal(maskLegalAddresses(source), masked);
    });
  });

  ["各号", "各項", "及", "又", "若", "並", "中", "本文", "前段", "後段", "但書", "同条", "乃至"].forEach((follower) => {
    it(`番地のあとに「${follower}」が続いても番地として扱う`, () => {
      assert.equal(maskLegalAddresses(`第二条第一項${follower}`), `  ${follower}`);
    });
  });
});

describe("maskAddresses — 種類の知識はコードに無い", () => {
  const section: DocumentProfile = { id: "toy", addresses: ["§[0-9]+"], connectives: ["及"] };

  it("種類を選ばなければ、番地に見えても何もしない", () => {
    assert.equal(maskAddresses("第二十二条第二項", undefined), "第二十二条第二項");
  });

  it("番地の書き方の無い種類は、何もしない", () => {
    assert.equal(maskAddresses("第二十二条第二項", { id: "empty", addresses: [], connectives: [] }), "第二十二条第二項");
  });

  it("別の種類の番地は、その種類の書き方で読む", () => {
    assert.equal(maskAddresses("§12及§13の定め", section), " 及 の定め");
    assert.equal(maskAddresses("第二十二条", section), "第二十二条");
  });

  it("つなぎの語の中の記号は、正規表現として読まない", () => {
    assert.equal(maskAddresses("§1.§2", { id: "dot", addresses: ["§[0-9]+"], connectives: ["."] }), " . ");
    // 「.」を正規表現のまま入れると「漢」までつなぎと読み、§1 を番地にしてしまう。
    assert.equal(maskAddresses("§1漢§2", { id: "dot", addresses: ["§[0-9]+"], connectives: ["."] }), "§1漢 ");
  });
});
