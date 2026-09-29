import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { listedTags } from "../packages/chaff/src/structure/listed-tags.ts";

// 文書が一覧の項目として載せている角括弧の語。載っていれば、その語で指した参照は他の文書を指す。

const tagsOf = (...rows: string[]): string[] => [...listedTags(rows.join("\n"))].sort((left, right) => left.localeCompare(right));

describe("listedTags: an entry of a list", () => {
  const listed: readonly (readonly [string, string])[] = [
    ["alone on its line, indented", "   [WEB-CACHE]"],
    ["alone, with spaces after it", "[WEB-CACHE]   "],
    ["alone, before a CRLF", "[WEB-CACHE]\r"],
    ["set apart by two spaces", "   [WEB-CACHE]  Doe, J., 2020."],
    ["set apart by a tab", "[WEB-CACHE]\tDoe, J., 2020."],
    ["a tag without a hyphen", "[HPACK]    Peon, R., 2015."],
  ];
  listed.forEach(([name, line]) => {
    it(name, () => assert.deepEqual(tagsOf(line), [line.slice(line.indexOf("[") + 1, line.indexOf("]"))]));
  });

  it("every entry of a list, once each", () => {
    assert.deepEqual(tagsOf("[B-1]  one", "text", "[A-1]", "[B-1]  again"), ["A-1", "B-1"]);
  });
});

describe("listedTags: not an entry", () => {
  const prose: readonly (readonly [string, string])[] = [
    ["one space before the text: a sentence", "[BUYER-1] pays the fee."],
    ["in the middle of a line", "see Section 9 of [WEB-CACHE]."],
    ["a comma after the tag", "[WEB-CACHE], Section 9"],
    ["empty brackets", "[]"],
    ["a space inside", "[WEB CACHE]"],
    ["nested brackets", "[[WEB-CACHE]]"],
    ["a Markdown link", "[WEB-CACHE](https://example.com)"],
    ["too long to be a tag", `[${"A".repeat(61)}]`],
  ];
  prose.forEach(([name, line]) => {
    it(name, () => assert.deepEqual(tagsOf(line), []));
  });

  it("an empty document lists nothing", () => assert.deepEqual(tagsOf(""), []));
});
