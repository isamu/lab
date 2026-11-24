import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { offRequired, requiredOf, requiresAny } from "../packages/chaff/src/detectors/register-required.ts";
import { runCli } from "./cli-run.ts";

// no-mixed-desumasu with a register the team requires (options body, list, heading). Self-written text.

describe("requiredOf", () => {
  it("reads desumasu and dearu per region, and nothing for consistent or an unknown value", () => {
    assert.deepEqual(requiredOf({ body: "desumasu", list: "dearu", heading: "consistent" }), { body: "polite", list: "plain" });
    assert.deepEqual(requiredOf({ body: "consistent", list: "consistent", heading: "consistent" }), {});
    assert.deepEqual(requiredOf({ body: "polite" }), {});
    assert.deepEqual(requiredOf(undefined), {});
    assert.equal(requiresAny({}), false);
    assert.equal(requiresAny({ heading: "plain" }), true);
  });
});

describe("offRequired", () => {
  const body = (register: "polite" | "plain", quiet = false) => ({ register, group: undefined, quiet });
  const list = (register: "polite" | "plain") => ({ register, group: 10, quiet: false });

  it("keeps the sentences in the other register of a region that requires one, and no quiet form", () => {
    const judged = [body("polite"), body("plain"), body("plain", true), list("polite"), list("plain")];
    assert.deepEqual(offRequired(judged, { body: "polite" }), [judged[1]]);
    assert.deepEqual(offRequired(judged, { list: "plain" }), [judged[3]]);
    assert.deepEqual(offRequired(judged, {}), []);
  });
});

const CONFIG = (options: string): string => `genre: business/report\noptions:\n  no-mixed-desumasu: { ${options} }\n`;

const reported = async (doc: string, options: string | undefined): Promise<string[]> => {
  const files: Record<string, string> = { "a.md": doc, ...(options === undefined ? {} : { "chaff.yaml": CONFIG(options) }) };
  const run = await runCli(files, ["a.md", "--compact"], "ja_JP.UTF-8");
  const lines = run.out.split("\n");
  return lines.filter((_line, index) => lines[index + 1]?.trim() === "no-mixed-desumasu");
};

const PLAIN_BODY = "# 手引き\n\n新しい料金は来月から始まる。請求書の形式も変わる。支払いの期限は月末である。\n";
const POLITE_LIST = "# 手引き\n\n新しい料金は来月から始まります。\n\n- 請求書の形式が変わります。\n- 期限は月末です。\n";

describe("no-mixed-desumasu with a required register", () => {
  it("without the option, a document in one register is left alone, as before", async () => {
    assert.deepEqual(await reported(PLAIN_BODY, undefined), []);
  });

  it("body: desumasu reports every plain body sentence, with no mix", async () => {
    const lines = await reported(PLAIN_BODY, "body: desumasu");
    assert.equal(lines.filter((line) => line.includes("ですます調で書きます")).length, 3);
  });

  it("body: dearu leaves a plain body alone", async () => {
    assert.deepEqual(await reported(PLAIN_BODY, "body: dearu"), []);
  });

  it("list: dearu reports the polite list items and not the polite body", async () => {
    const lines = await reported(POLITE_LIST, "list: dearu");
    assert.equal(lines.filter((line) => line.includes("である調で書きます")).length, 2);
    assert.equal(lines.length, 2);
  });

  it("in a region that requires a register, the minority in that register is not reported as a mix", async () => {
    const doc = "# 手引き\n\n料金は来月から始まる。形式も変わる。期限は月末である。窓口は二階です。\n";
    assert.equal((await reported(doc, undefined)).length, 1);
    const lines = await reported(doc, "body: desumasu");
    assert.equal(lines.filter((line) => line.includes("ですます調で書きます")).length, 3);
    assert.equal(lines.filter((line) => line.includes("他と文末の調子が違います")).length, 0);
  });

  it("heading: dearu reports a heading that ends politely, and not a noun heading", async () => {
    const doc = "# 手引き\n\n## 料金が変わります\n\n料金は来月から始まる。\n\n## 期限\n\n期限は月末である。\n";
    const lines = await reported(doc, "heading: dearu");
    assert.equal(lines.length, 1);
  });
});
