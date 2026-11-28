import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { SAMPLE_LANGUAGES, expectedIndex, indexPath, readSample, runSamples, sampleFiles, shownScreens, type SampleRun } from "../scripts/samples.ts";
import { sampleableRules, withoutCoverage } from "../scripts/samples-index.ts";
import { inPart, partOf } from "../scripts/sample-part.ts";

// docs/samples/<言語>/<rule>.md の見本は、元の文章でその rule が出て、直した文章で出ず、載せた画面が chaff のいま出すものと
// 同じでなければならない。古い画面は、読み手に今の chaff と違うものを見せる。直すのは yarn samples:update。

const UPDATE = "run yarn samples:update and read the diff";
const GUIDE = join(import.meta.dirname, "..", "site", "src", "content", "guide", "en");
/** CI splits the samples over several jobs (CHAFF_SAMPLE_PART=2/3); locally every sample runs. */
const FILES = inPart(sampleFiles(), partOf(process.env["CHAFF_SAMPLE_PART"]));

/** Every chaff.yaml key the English guide writes as `key` or `key:`; a sample's settings may use only these. */
const documentedKeys = (): Set<string> => {
  const pages = readdirSync(GUIDE).filter((name) => name.endsWith(".md"));
  const text = pages.map((name) => readFileSync(join(GUIDE, name), "utf8")).join("\n");
  return new Set([...text.matchAll(/`([a-z_$]+):?`|^ *([a-z_$]+):/gmu)].map((found) => found[1] ?? found[2] ?? ""));
};

const failures = (runs: readonly SampleRun[], problem: (run: SampleRun) => string | undefined): string[] =>
  runs.flatMap((run) => {
    const said = problem(run);
    return said === undefined ? [] : [`${run.path}: ${said}`];
  });

describe("ルールの見本", () => {
  const runs: SampleRun[] = [];
  before(async () => {
    runs.push(...(await runSamples(FILES)));
  });

  it("ファイルの名前は rule の id で、その rule はその言語で動き、lint として出る", () => {
    const problems = FILES.flatMap((file) => {
      const run = runs.find((entry) => entry.path === file.path);
      const known = sampleableRules(loadRules(file.language), file.language).map((rule) => rule.id);
      if (run === undefined) return [`${file.path}: not run`];
      if (basename(file.path) !== `${run.rule}.md`) return [`${file.path}: rename it ${run.rule}.md, or fix rule: in its chaff-sample comment`];
      return known.includes(run.rule) ? [] : [`${file.path}: ${run.rule} is not a rule that runs on ${file.language} documents as a lint`];
    });
    assert.deepEqual(problems, []);
  });

  it("元の文章では、その rule が指摘する", () => {
    const problems = failures(runs, (run) =>
      run.beforeRules.includes(run.rule)
        ? undefined
        : `${run.rule} does not report the chaff-before text (it reported: ${run.beforeRules.join(", ") || "nothing"}); check the genre with npx chaffjs explain ${run.rule}`,
    );
    assert.deepEqual(problems, []);
  });

  it("直した文章では、その rule も、見本が名指ししていない rule も指摘しない", () => {
    const problems = failures(runs, (run) => {
      const unexpected = run.afterRules.filter((rule) => rule === run.rule || !run.afterAllows.includes(rule));
      return unexpected.length === 0
        ? undefined
        : `the chaff-after text is reported by ${unexpected.join(", ")}; fix the text, or list another rule under after_allows and say why in the sample`;
    });
    assert.deepEqual(problems, []);
  });

  it("after_allows に挙げた rule は、見本の本文で名指しして理由を書いている", () => {
    const problems = failures(runs, (run) => {
      const body = readSample(run.path).replace(/^<!-- chaff-sample[\s\S]*?-->/u, "");
      const unexplained = run.afterAllows.filter((rule) => rule === run.rule || !body.includes(rule));
      return unexplained.length === 0 ? undefined : `after_allows lists ${unexplained.join(", ")} but the sample never says why`;
    });
    assert.deepEqual(problems, []);
  });

  it("載せた指摘と explain の画面は、chaff がいま出すものと同じ", () => {
    const problems = failures(runs, (run) => {
      const shown = shownScreens(run.path);
      if (shown.screen === undefined || shown.explain === undefined)
        return "needs an empty ```text chaff-output block and an empty ```text chaff-explain block";
      return shown.screen === run.screen && shown.explain === run.explain ? undefined : `its screens differ from what chaff prints now; ${UPDATE}`;
    });
    assert.deepEqual(problems, []);
  });

  it("載せた chaff.yaml は、chaff がそのまま読める設定で、手引きにある項目だけを使う", () => {
    const keys = documentedKeys();
    const problems = failures(runs, (run) => {
      const unknown = run.settingKeys.filter((key) => !keys.has(key));
      const said = [...run.settingProblems, ...unknown.map((key) => `${key}: is not a chaff.yaml key the guide documents`)];
      return said.length === 0 ? undefined : said.join("; ");
    });
    assert.deepEqual(problems, []);
  });

  // まだ見本の無い rule の行は、rule が増えるたびに動く。rule を足す変更がこのファイルに触れずに済むよう、その行は比べない。
  it("言語ごとの一覧（README.md）は、見本の載せ方がいまの rule と見本から作ったものと同じ", () => {
    const stale = SAMPLE_LANGUAGES.filter(
      (language) => withoutCoverage(readSample(indexPath(language)), language) !== withoutCoverage(expectedIndex(language), language),
    );
    assert.deepEqual(stale.map(indexPath), [], UPDATE);
  });
});
