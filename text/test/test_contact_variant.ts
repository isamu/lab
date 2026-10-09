import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { editDistance, emailVariants, isEmailSlip } from "../packages/chaff/src/contacts/emails.ts";
import { addressVariants, isBlockSlip, labelledAddresses } from "../packages/chaff/src/contacts/addresses.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 同じ連絡先（メールアドレス・住所）の書き違い（contact-variant）。宛先と例文は自作。

const RULE = "contact-variant";

const found = (source: string, adapter: LanguageAdapter, genre = "legal/contract"): number[] =>
  runRules(buildDocument("policy.md", source, adapter), loadRules(adapter.id), {}, false, genre)
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => finding.line);

const jaDoc = (...lines: string[]): string => ["# お問合せ", "", ...lines, ""].join("\n");
const enDoc = (...lines: string[]): string => ["# Contact", "", ...lines, ""].join("\n");

describe("contact-variant", () => {
  it("ja: ハイフンの抜けたメールアドレスと、一語だけ綴りの違うメールアドレスを指す", () => {
    assert.deepEqual(found(jaDoc("- メールアドレス：privacy@hibari-lab.example", "", "質問は、privacy@hibarilab.example で受け付けます。"), ja), [5]);
    assert.deepEqual(found(jaDoc("- メール：support@hibari-lab.example", "", "変更は suport@hibari-lab.example へ。"), ja), [5]);
  });

  it("ja: 同じ町の住所で、番地の入れ替わり、一つだけ違う番地、郵便番号だけの違いを指す", () => {
    const address = "- 住所：〒100-0005 東京都千代田区丸の内二丁目4番1号";
    assert.deepEqual(found(jaDoc(address, "", "当社の本店所在地（東京都千代田区丸の内二丁目1番4号）を管轄する裁判所とします。"), ja), [5]);
    assert.deepEqual(found(jaDoc(address, "", "- 送付先：千代田区丸の内二丁目4番7号"), ja), [5]);
    assert.deepEqual(found(jaDoc(address, "", "- 送付先：〒100-0050 東京都千代田区丸の内二丁目4番1号"), ja), [5]);
  });

  it("ja: 別のアドレス、同じ住所、本店と支店、町の違う住所、語の無い住所は指さない", () => {
    assert.deepEqual(found(jaDoc("- 営業：sales@hibari-lab.example", "", "- サポート：support@hibari-lab.example"), ja), []);
    assert.deepEqual(found(jaDoc("- 住所：東京都千代田区丸の内二丁目4番1号", "", "- 送付先：東京都千代田区丸の内二丁目4番1号"), ja), []);
    assert.deepEqual(found(jaDoc("- 本社：東京都千代田区丸の内二丁目4番1号", "", "- 大阪支店：東京都千代田区丸の内二丁目7番1号"), ja), []);
    assert.deepEqual(found(jaDoc("- 住所：東京都千代田区丸の内二丁目4番1号", "", "- 送付先：東京都千代田区大手町二丁目1番4号"), ja), []);
    assert.deepEqual(found(jaDoc("東京都千代田区丸の内二丁目4番1号", "", "東京都千代田区丸の内二丁目1番4号"), ja), []);
    assert.deepEqual(
      found(jaDoc("- 住所：〒100-0005 東京都千代田区丸の内二丁目4番1号", "", "- 送付先：〒460-0002 愛知県名古屋市中区丸の内二丁目4番1号"), ja),
      [],
    );
    assert.deepEqual(found(jaDoc("- 住所：東京都千代田区丸の内二丁目4番1号", "", "- 送付先：名古屋市中区丸の内二丁目1番4号"), ja), []);
  });

  it("en: an address with a hyphen dropped, a misspelt mailbox, swapped block numbers, another postcode", () => {
    assert.deepEqual(found(enDoc("- Email: privacy@hibari-lab.example", "", "Questions can be sent to privacy@hibarilab.example."), en), [5]);
    assert.deepEqual(found(enDoc("- Email: support@hibari-lab.example", "", "Write to suport@hibari-lab.example."), en), [5]);
    const address = "- Address: 2-4-1 Marunouchi, Chiyoda-ku, Tokyo 100-0005, Japan";
    assert.deepEqual(found(enDoc(address, "", "The court has jurisdiction over our head office at 2-1-4 Marunouchi, Chiyoda-ku, Tokyo."), en), [5]);
    assert.deepEqual(
      found(enDoc("- Address: 120 Main Street, Springfield, IL 62701", "", "- Send notices by post to 120 Main Street, Springfield, IL 62707"), en),
      [5],
    );
  });

  it("en: two mailboxes, the same address, a head office and a branch, unlabelled numbers stay silent", () => {
    assert.deepEqual(found(enDoc("- Sales: sales@hibari-lab.example", "", "- Support: support@hibari-lab.example"), en), []);
    assert.deepEqual(found(enDoc("- HR: hr@hibari-lab.example", "", "- Press: pr@hibari-lab.example"), en), []);
    assert.deepEqual(found(enDoc("- Team 1: support1@hibari-lab.example", "", "- Team 2: support2@hibari-lab.example"), en), []);
    assert.deepEqual(found(enDoc("- Head office: 2-4-1 Marunouchi, Chiyoda-ku", "", "- Branch: 2-7-1 Marunouchi, Chiyoda-ku"), en), []);
    assert.deepEqual(found(enDoc("Read 2-4-1 Marunouchi first.", "", "Then 2-1-4 Marunouchi."), en), []);
    assert.deepEqual(found(enDoc("- Office: 365 Plan", "", "- Office: 356 Plan"), en), []);
    assert.deepEqual(found(enDoc("- Address: 120 Main Street, Springfield, IL 62701", "", "- Address: 120 Main Street, Shelbyville, IL 62565"), en), []);
    assert.deepEqual(found(enDoc("- Sales: sales@hibari-lab.example", "", "- Campaign: sale@hibari-lab.example"), en), []);
  });

  it("reports the writing that differs from the one written more often, and nothing in code", () => {
    assert.deepEqual(found(enDoc("Mail suport@hibari-lab.example.", "", "Mail support@hibari-lab.example.", "", "Mail support@hibari-lab.example."), en), [3]);
    assert.deepEqual(found(enDoc("```text", "support@hibari-lab.example", "suport@hibari-lab.example", "```"), en), []);
  });

  it("does not run in literature", () => {
    assert.deepEqual(found(enDoc("Email: support@hibari-lab.example", "", "Email: suport@hibari-lab.example"), en, "literature/fiction"), []);
  });
});

describe("contacts", () => {
  it("editDistance counts inserts, deletes, replacements and swaps of neighbours", () => {
    assert.equal(editDistance("support", "suport"), 1);
    assert.equal(editDistance("support", "supprot"), 1);
    assert.equal(editDistance("support", "sopport"), 1);
    assert.equal(editDistance("sales", "support"), 6);
    assert.equal(editDistance("", "abc"), 3);
    assert.equal(editDistance("", ""), 0);
  });

  it("isEmailSlip holds for a dropped separator or one long word misspelt, not for other mailboxes or domains", () => {
    assert.equal(isEmailSlip("privacy@hibari-lab.example", "privacy@hibarilab.example"), true);
    assert.equal(isEmailSlip("support@hibari-lab.example", "suport@hibari-lab.example"), true);
    assert.equal(isEmailSlip("support@hibari-lab.example", "support@hibari-lab.example"), false);
    assert.equal(isEmailSlip("jp@hibari-lab.example", "us@hibari-lab.example"), false);
    assert.equal(isEmailSlip("info@hibari-lab.example", "info@other-lab.example"), false);
    assert.equal(isEmailSlip("support@hibari-lab.example", "support@hibari-lab.co.jp"), false);
    assert.equal(isEmailSlip("team1@hibari-lab.example", "team2@hibari-lab.example"), false);
    assert.equal(isEmailSlip(`${"a".repeat(100)}@hibari-lab.example`, `${"a".repeat(99)}b@hibari-lab.example`), false);
    assert.equal(isEmailSlip("", ""), false);
  });

  it("emailVariants reads nothing from text without addresses, and leaves a version's @ out of a sentence end", () => {
    assert.deepEqual(emailVariants(""), []);
    assert.deepEqual(emailVariants("plugin-legacy@8.2.0 and plugin-legacy@8.1.0"), []);
  });

  it("isBlockSlip holds for numbers in another order or one changed, not for two changed or another count", () => {
    assert.equal(isBlockSlip([2, 4, 1], [2, 1, 4]), true);
    assert.equal(isBlockSlip([2, 4, 1], [2, 4, 7]), true);
    assert.equal(isBlockSlip([2, 4, 1], [2, 4, 1]), false);
    assert.equal(isBlockSlip([2, 4, 1], [3, 5, 1]), false);
    assert.equal(isBlockSlip([2, 4, 1], [2, 4]), false);
    assert.equal(isBlockSlip([], []), false);
  });

  const labels = [
    { pattern: "住所", group: "address" },
    { pattern: "本店", group: "head-office" },
    { pattern: "支店", group: "branch" },
    { pattern: "address", group: "address" },
  ];

  it("labelledAddresses reads the town, the 丁目 as a number and the line's postcode", () => {
    const [first] = labelledAddresses("住所：〒100-0005 東京都千代田区丸の内二丁目4番1号", labels);
    assert.equal(first?.street, "丸の内");
    assert.deepEqual(first?.numbers, [2, 4, 1]);
    assert.equal(first?.postcode, "100-0005");
    assert.equal(labelledAddresses("Address: 2-4-1 Marunouchi, Tokyo", labels)[0]?.street, "marunouchi");
    assert.deepEqual(labelledAddresses("第3条第2項の1-2", labels), []);
    assert.deepEqual(labelledAddresses("", labels), []);
    assert.deepEqual(labelledAddresses("住所：東京都千代田区丸の内二丁目4番1号", []), []);
  });

  it("addressVariants compares a head office with an unnamed address, not with a branch", () => {
    const pairs = (text: string): string[][] =>
      addressVariants(text, labels).map(({ variant, found }) => [variant, found.writing.written, found.other.written]);
    assert.deepEqual(pairs("本店：東京都千代田区丸の内二丁目4番1号\n支店：東京都千代田区丸の内二丁目1番4号"), []);
    assert.deepEqual(pairs("本店：東京都千代田区丸の内二丁目4番1号\n住所：東京都千代田区丸の内二丁目1番4号"), [
      ["address", "丸の内二丁目1番4号", "丸の内二丁目4番1号"],
    ]);
    assert.deepEqual(pairs("住所：〒100-0005 千代田区丸の内二丁目4番1号\n住所：〒100-0050 千代田区丸の内二丁目4番1号"), [
      ["postcode", "丸の内二丁目4番1号", "丸の内二丁目4番1号"],
    ]);
  });
});
