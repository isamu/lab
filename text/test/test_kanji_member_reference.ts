import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";

// max-kanji-continuous: 会議体の名前の後ろの「委員」と、連なりの中ほどの「当」。例文は自作。

const RULES = loadRules("ja");
const GENRE = "business/report";
const KANJI_AT_NORMAL = { "max-kanji-continuous": RULES.find((rule) => rule.id === "max-kanji-continuous")?.by_genre?.["business"]?.normal ?? 0 };

const kanjiWords = (source: string): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, measuredOffOn(GENRE), true, GENRE, KANJI_AT_NORMAL)
    .findings.filter((finding) => finding.rule === "max-kanji-continuous")
    .map((finding) => String(finding.values?.["word"]));

describe("max-kanji-continuous: 連なりを閉じる職と、中ほどで語の頭を見せる語", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 会議体の名前の後ろの「委員」は、その前を別に数える", () => {
    assert.deepEqual(kanjiWords("以下の分析は、気象災害要因検討会委員と協同で行いました。\n"), []);
  });

  it("invalid: 「委員」を外しても上限を超えれば、その前を数える", () => {
    assert.deepEqual(kanjiWords("以下の分析は、大規模気象災害要因分析検討会委員と協同で行いました。\n"), ["大規模気象災害要因分析検討会"]);
  });

  it("valid: 連なりの中ほどの「当」（見出しと文が一行に詰まったもの）は、そこで割る", () => {
    assert.deepEqual(kanjiWords("家庭用品事業当連結会計年度の売上高は前年を上回りました。\n"), []);
  });

  it("invalid: 「当」の無い連なりは割らない", () => {
    assert.deepEqual(kanjiWords("家庭用品事業連結会計年度売上高は前年を上回りました。\n"), ["家庭用品事業連結会計年度売上高"]);
  });
});
