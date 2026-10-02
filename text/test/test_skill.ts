import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SKILL_SOURCE, installSkill, runSkill, skillTarget } from "../packages/chaff/src/commands/skill.ts";
import { COMMANDS } from "../packages/chaff/src/cli.ts";
import { GENRES } from "../packages/chaff/src/genre.ts";

const temp = (): string => mkdtempSync(join(tmpdir(), "chaff-skill-"));

describe("同梱の skill", () => {
  const skill = readFileSync(SKILL_SOURCE, "utf8");

  it("パッケージの中にあり、名前は chaff", () => {
    assert.ok(existsSync(SKILL_SOURCE));
    assert.match(skill, /^---\nname: chaff\ndescription: ".+"\n---\n/u);
  });

  it("skill が挙げるコマンドは、chaff に実際にある", () => {
    const mentioned = [...skill.matchAll(/npx chaffjs ([a-z]+(?:-[a-z]+)*)\b/gu)].map((match) => match[1] ?? "");
    const unknown = mentioned.filter((command) => !COMMANDS.includes(command));
    assert.deepEqual(unknown, []);
    assert.ok(mentioned.length > 5);
  });

  it("skill が挙げるジャンルは、chaff に実際にある", () => {
    const named = [...skill.matchAll(/`((?:technical|blog|business|legal|docs|academic|literature|speech)\/[a-z-]+)`/gu)].map((match) => match[1] ?? "");
    assert.ok(named.length > 5);
    assert.deepEqual(
      named.filter((genre) => !GENRES.includes(genre)),
      [],
    );
  });

  it("ジャンルを選ぶことから始める（見つけたものを読む前に）", () => {
    const pick = skill.indexOf("## Pick the genre first");
    assert.ok(pick !== -1);
    assert.ok(pick < skill.indexOf("## For each finding"));
    assert.match(skill, /npx chaffjs genres/u);
    assert.match(skill, /npx chaffjs --genre /u);
    assert.match(skill, /Looks like: .+ Try --genre /u);
  });
});

describe("skill を入れる", () => {
  it("無ければ書く", () => {
    const target = skillTarget(temp());
    assert.deepEqual(installSkill("A", target, false), { status: "written", path: target });
    assert.equal(readFileSync(target, "utf8"), "A");
  });

  it("同じなら触らない", () => {
    const target = skillTarget(temp());
    installSkill("A", target, false);
    assert.equal(installSkill("A", target, false).status, "same");
  });

  it("違っていれば、手で直したかもしれないので --force が無ければ置き換えない", () => {
    const target = skillTarget(temp());
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, "edited by hand");
    assert.equal(installSkill("A", target, false).status, "kept");
    assert.equal(readFileSync(target, "utf8"), "edited by hand");
    assert.equal(installSkill("A", target, true).status, "updated");
    assert.equal(readFileSync(target, "utf8"), "A");
  });

  it("書けないときは、どこに書けなかったかを言って 1 で終わる", () => {
    const blocked = temp();
    writeFileSync(join(blocked, ".claude"), "a file where the folder should be");
    const saved = console.error;
    const said: string[] = [];
    console.error = (...parts: unknown[]) => {
      said.push(parts.join(" "));
    };
    try {
      assert.equal(runSkill(["skill"], { cwd: blocked, home: temp(), ui: "en" }), 1);
    } finally {
      console.error = saved;
    }
    assert.match(said.join("\n"), /^Could not write the skill to .*SKILL\.md: /u);
  });

  it("置き場所は .claude/skills/chaff/SKILL.md", () => {
    assert.equal(skillTarget("/p"), join("/p", ".claude", "skills", "chaff", "SKILL.md"));
  });

  it("コマンドは、ふつうはこのフォルダに、--global ならホームに入れる。置き換えずに残したら 1 で終わる", () => {
    const cwd = temp();
    const home = temp();
    const saved = { log: console.log, error: console.error };
    const said: string[] = [];
    console.log = (...parts: unknown[]) => {
      said.push(parts.join(" "));
    };
    console.error = console.log;
    try {
      assert.equal(runSkill(["skill"], { cwd, home, ui: "en" }), 0);
      assert.equal(readFileSync(skillTarget(cwd), "utf8"), readFileSync(SKILL_SOURCE, "utf8"));
      assert.equal(existsSync(skillTarget(home)), false);
      assert.equal(runSkill(["skill", "--global"], { cwd, home, ui: "ja" }), 0);
      assert.ok(existsSync(skillTarget(home)));
      writeFileSync(skillTarget(cwd), "mine");
      assert.equal(runSkill(["skill"], { cwd, home, ui: "en" }), 1);
      assert.equal(runSkill(["skill", "--force"], { cwd, home, ui: "en" }), 0);
    } finally {
      console.log = saved.log;
      console.error = saved.error;
    }
    assert.match(said.join("\n"), /Wrote the Claude Code skill/u);
    assert.match(said.join("\n"), /skill を書きました/u);
    assert.match(said.join("\n"), /Add --force/u);
  });
});
