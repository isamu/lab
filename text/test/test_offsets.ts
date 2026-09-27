import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { maskSpans } from "../packages/chaff/src/mask.ts";
import { lineStarts, placeOf } from "../packages/chaff/src/position.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

/**
 * mdast のオフセットは UTF-16 単位。覆う処理も行の表もそれに合わせないと、
 * 絵文字より後ろの指摘がすべてずれる。
 */
describe("オフセットは UTF-16 単位で揃える", () => {
  it("覆っても長さが変わらない（サロゲートペア）", () => {
    const source = "`😀` あ";
    assert.equal(maskSpans(source, [{ start: 0, end: 4 }]).length, source.length);
  });

  it("覆っても長さが変わらない（普通の文字）", () => {
    const source = "`code` あ";
    assert.equal(maskSpans(source, [{ start: 0, end: 6 }]).length, source.length);
  });

  it("改行は残す", () => {
    assert.equal(maskSpans("a\nb", [{ start: 0, end: 3 }]), " \n ");
  });

  it("行頭の表が UTF-16 の位置と一致する", () => {
    const source = "😀\nあ\n😀い";
    const starts = lineStarts(source);
    assert.deepEqual(starts, [0, source.indexOf("\n") + 1, source.lastIndexOf("\n") + 1]);
  });

  it("絵文字のあとでも行と桁が合う", () => {
    const source = "😀\nあ";
    assert.deepEqual(placeOf(lineStarts(source), source.indexOf("あ")), { line: 2, column: 1 });
  });

  it("絵文字を含む文書で、指摘の行が本文と合う", () => {
    const source = "# 🎉 見出し\n\n`😀コード`\n\n近年、注目されています。\n";
    const found = runRules(buildDocument("t.md", source, ja), loadRules("ja"), {}, false, "blog/tech").findings;
    const padded = found.find((finding) => finding.rule === "padded-intro");
    assert.match(source.split("\n")[(padded?.line ?? 1) - 1] ?? "", /近年/u);
  });
});

describe("placeOf over generated documents", () => {
  // 性質: offset を含む行は、行頭が offset 以下のもののうち最後の行。行頭より前（負、NaN）は 1 行目。
  const expectedLine = (starts: readonly number[], offset: number): number => starts.reduce((line, start, index) => (start <= offset ? index + 1 : line), 1);
  const PIECES = ["", "a", "\n", "\n\n", "あ", "😀", "\r\n", "abc\n"];
  const SEED = 20260927;

  it(`agrees with the property on every line boundary (seed ${String(SEED)})`, () => {
    let seed = SEED;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    Array.from({ length: 500 }).forEach(() => {
      const source = Array.from({ length: Math.floor(next() * 30) }, () => PIECES[Math.floor(next() * PIECES.length)] ?? "").join("");
      const starts = lineStarts(source);
      const offsets = [-1, 0, Number.NaN, source.length, source.length + 3, ...starts.flatMap((start) => [start - 1, start, start + 1])];
      offsets.forEach((offset) => {
        const place = placeOf(starts, offset);
        assert.equal(place.line, expectedLine(starts, offset), `${JSON.stringify(source)} @ ${String(offset)}`);
        assert.equal(Object.is(place.column, offset - (starts[place.line - 1] ?? 0) + 1), true);
      });
    });
  });
});
