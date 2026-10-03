import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { plainSource } from "../packages/chaff/src/plain-source.ts";
import { main } from "../packages/chaff/src/cli.ts";

describe("plainSource: BOM を外し、改行を \\n にそろえる", () => {
  const cases: readonly (readonly [string, string, string])[] = [
    ["空", "", ""],
    ["改行だけ", "\n", "\n"],
    ["LF はそのまま", "a\nb\n", "a\nb\n"],
    ["CRLF", "a\r\nb\r\n", "a\nb\n"],
    ["CR だけ", "a\rb\r", "a\nb\n"],
    ["混在", "a\r\nb\rc\nd", "a\nb\nc\nd"],
    ["空行の CRLF", "a\r\n\r\nb", "a\n\nb"],
    ["CR が続く", "a\r\r\nb", "a\n\nb"],
    ["BOM", "\uFEFF# T\n", "# T\n"],
    ["BOM と CRLF", "\uFEFF# T\r\n", "# T\n"],
    ["BOM だけ", "\uFEFF", ""],
    ["途中の U+FEFF は文字として残す", "a\uFEFFb", "a\uFEFFb"],
    ["BOM が二つなら二つとも外す（二度かけても一度と同じ）", "\uFEFF\uFEFFa", "a"],
    ["先頭の BOM の後の文字の後ろの U+FEFF は残す", "\uFEFF\uFEFFa\uFEFF", "a\uFEFF"],
    ["行の中の \\r でない空白は触らない", "a\tb\u00A0c\u3000d", "a\tb\u00A0c\u3000d"],
    ["U+2028 は改行にしない", "a\u2028b", "a\u2028b"],
  ];
  cases.forEach(([label, input, expected]) => {
    it(label, () => assert.equal(plainSource(input), expected));
  });

  it("二度かけても一度と同じ", () => {
    const pieces = [String.fromCodePoint(0xfeff), "\r", "\n", "\r\n", "a", " ", String.fromCodePoint(0x2028)];
    const texts = Array.from({ length: 2000 }, (_, seed) =>
      Array.from({ length: seed % 12 }, (_, index) => pieces[(seed * 7 + index * 13 + (seed >> 3)) % pieces.length] ?? "").join(""),
    );
    texts.forEach((text) => assert.equal(plainSource(plainSource(text)), plainSource(text), JSON.stringify(text)));
  });

  it("行の数と、各行の中身は変わらない（CRLF / CR）", () => {
    const lines = ["# T", "", "One.", "Two three."];
    [lines.join("\r\n"), lines.join("\r")].forEach((raw) => assert.deepEqual(plainSource(raw).split("\n"), lines));
  });
});

const LONG =
  "This first sentence keeps going with one more clause and then another clause and yet another one until it is far longer than any reader would like it to be today.";

const runIn = async (name: string, body: string, args: readonly string[]): Promise<string> => {
  const dir = mkdtempSync(join(tmpdir(), "chaff-plain-"));
  writeFileSync(join(dir, name), body);
  // The long-sentence finding these tests place is off by default in every genre group with enough documents (spec §21.1).
  writeFileSync(join(dir, "chaff.yaml"), "rules:\n  max-sentence-length: normal\n");
  const out: string[] = [];
  const saved = { log: console.log, cwd: process.cwd(), lang: process.env["LANG"] };
  console.log = (...parts: unknown[]) => {
    out.push(parts.join(" "));
  };
  process.env["LANG"] = "en_US.UTF-8";
  process.chdir(dir);
  try {
    await main(args.map((arg) => (arg === "FILE" ? name : arg)));
    return out.join("\n");
  } finally {
    process.chdir(saved.cwd);
    console.log = saved.log;
    if (saved.lang === undefined) delete process.env["LANG"];
    else process.env["LANG"] = saved.lang;
  }
};

describe("Windows と古い Mac の改行、BOM 付きのファイル", () => {
  it("CR だけの改行でも、指摘は本当の行を指す", async () => {
    const out = await runIn("a.md", `# Notes\r\r${LONG}\r`, ["FILE", "--compact"]);
    assert.match(out, /^ {2}3:1 +warning/mu);
  });

  it("BOM 付きでも、引用が文の最後の文字まで届く", async () => {
    const short = "We go to it as we do so and we see it as we go on up to it if we do so or we be it now.";
    const out = await runIn("a.md", `\uFEFF# Notes\n\n${short}\n`, ["FILE"]);
    assert.match(out, /line 3/u);
    assert.ok(out.split("\n").includes(`    ${short}`), out);
  });

  it("BOM が二つでも、見出しと引用が 1 文字もずれない", async () => {
    const short = "We go to it as we do so and we see it as we go on up to it if we do so or we be it now.";
    const out = await runIn("a.md", `\uFEFF\uFEFF# Notes\n\n${short}\n`, ["FILE"]);
    assert.ok(out.split("\n").includes(`    ${short}`), out);
    const tree = await runIn("a.md", `\uFEFF\uFEFF# Notes\n\n${short}\n`, ["tree", "FILE"]);
    assert.match(tree, /:heading "Notes"/u);
  });

  const FRONT = "---\ngenre: business/report\n---\n\n# Report\n\nThe results are stated here.\n";

  it("CRLF の front matter からジャンルを読む", async () => {
    const out = await runIn("a.md", FRONT.replace(/\n/gu, "\r\n"), ["FILE", "--compact"]);
    assert.match(out, /business\/report · English {3}genre from front matter/u);
  });

  it("BOM 付きの front matter からジャンルを読む", async () => {
    const out = await runIn("a.md", `\uFEFF${FRONT}`, ["FILE", "--compact"]);
    assert.match(out, /business\/report · English {3}genre from front matter/u);
  });

  it("CR だけの改行の法令でも、条を一つずつ読む", async () => {
    const out = await runIn("law.txt", "第一条\u3000この法律は、第三条に定めるところによる。\r第二条\u3000前条の規定は、第九条に準用する。\r", [
      "tree",
      "FILE",
    ]);
    assert.match(out, /\(article "1" :label "第一条" :line 1/u);
    assert.match(out, /\(article "2" :label "第二条" :line 2/u);
  });

  const REPORT_CR = `${FRONT}\n${LONG}\n`.replace(/\n/gu, "\r");

  it("test --dry-run も CR だけの front matter からジャンルを読み、そのジャンルの検査を送る", async () => {
    const out = await runIn("a.md", REPORT_CR, ["test", "FILE", "--dry-run"]);
    assert.match(out, /No risk disclosed/u);
  });

  it("eval も CR だけの front matter からジャンルを読み、そのジャンルの rule を測る", async () => {
    const out = await runIn("a.md", REPORT_CR, ["eval", "."]);
    assert.match(out, /\(agentless-passive\)/u);
  });

  it("feedback は CR だけの改行の行を数える", async () => {
    const out = await runIn("a.md", REPORT_CR, ["feedback", "FILE", "--missed", "--line", "9"]);
    assert.match(out, /Wrote a draft report/u);
  });
});
