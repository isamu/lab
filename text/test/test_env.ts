import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ENV_FILE, loadEnvFile } from "../packages/chaff/src/env.ts";

const withEnvFile = (body: string): string => {
  const dir = mkdtempSync(join(tmpdir(), "chaff-env-"));
  writeFileSync(join(dir, ENV_FILE), body, "utf8");
  return dir;
};

const restore = (names: readonly string[], run: () => void): void => {
  const saved = names.map((name) => [name, process.env[name]] as const);
  try {
    run();
  } finally {
    saved.forEach(([name, value]) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    });
  }
};

describe(".env を読む", () => {
  it("書いてある値が環境変数になる", () => {
    const dir = withEnvFile("CHAFF_TEST_ONE=from-file\n");
    restore(["CHAFF_TEST_ONE"], () => {
      delete process.env["CHAFF_TEST_ONE"];
      assert.equal(loadEnvFile(dir), join(dir, ENV_FILE));
      assert.equal(process.env["CHAFF_TEST_ONE"], "from-file");
    });
  });

  it("すでにある環境変数は上書きしない", () => {
    // 逆にすると、一時的に別の鍵で試したいときに .env が黙って勝つ。
    const dir = withEnvFile("CHAFF_TEST_TWO=from-file\n");
    restore(["CHAFF_TEST_TWO"], () => {
      process.env["CHAFF_TEST_TWO"] = "from-shell";
      loadEnvFile(dir);
      assert.equal(process.env["CHAFF_TEST_TWO"], "from-shell");
    });
  });

  it("無ければ何もせず undefined を返す", () => {
    assert.equal(loadEnvFile(mkdtempSync(join(tmpdir(), "chaff-noenv-"))), undefined);
  });
});
