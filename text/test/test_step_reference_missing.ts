import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { missingSteps, type StepText } from "../packages/chaff/src/detectors/step-reference.ts";

// 無い手順を指す参照（step-reference-missing）。例文はすべて自作。

const RULE = "step-reference-missing";
const WORDS = ["手順", "ステップ", "Step", "step"];

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

const plain = (text: string, elsewhere: StepText["elsewhere"] = () => false): StepText => ({ source: text, prose: text, elsewhere });

const labelsIn = (text: string): string[] => missingSteps(plain(text), WORDS).map((missing) => `${missing.label}>${String(missing.last)}`);

describe("step-reference-missing: 無い手順を指す参照", () => {
  it("番号付きの箇条書きの最後を超える手順を指す", () => {
    assert.deepEqual(findingsOf("1. アプリを開きます。\n2. 設定を選びます。\n3. 保存します。\n\nうまくいかないときは、手順4からやり直してください。\n"), [
      "「手順4」を指していますが、手順は 3 までです",
    ]);
    assert.deepEqual(findingsOf("1. Open the app.\n2. Choose Settings.\n3. Save.\n\nIf it fails, start again from step 4.\n", en), [
      '"step 4" is referred to, but the steps end at 3',
    ]);
  });

  it("見出しの手順も読む。見出しそのものは参照ではない", () => {
    assert.deepEqual(labelsIn("## Step 1 Install\n## Step 2 Configure\n\nSee Step 3 and step 2."), ["Step 3>2"]);
    assert.deepEqual(labelsIn("## ステップ１ 準備\n## ステップ２ 実行\n\nステップ２を参照。"), []);
  });

  it("Markdown の見出しの手順を、規則を通しても読む", () => {
    assert.deepEqual(findingsOf("## Step 1 Install\n\nText.\n\n## Step 2 Configure\n\nSee step 3.\n", en), ['"step 3" is referred to, but the steps end at 2']);
  });

  it("全角の空白も読む", () => {
    assert.deepEqual(labelsIn("1. A\n\nステップ　2を参照。"), ["ステップ　2>1"]);
  });

  it("ほかの文書の手順（step 5 of the guide）は言わない", () => {
    assert.deepEqual(findingsOf("1. Open this app.\n2. Save.\n\nFor setup, see step 5 of the Partner Portal guide.\n", en), []);
  });

  it("ある手順を指す参照は言わない", () => {
    assert.deepEqual(labelsIn("1. A\n2. B\n3. C\n\n手順2に戻る。step 3 again."), []);
  });

  it("手順が一つも無い文書では言わない", () => {
    assert.deepEqual(labelsIn("詳しくは手順5を参照してください。See step 9."), []);
  });

  it("語の一部や番号の続き（footstep 5、step 5a、step 12345）は読まない", () => {
    assert.deepEqual(labelsIn("1. A\n2. B\n\nfootstep 5, step 5a, step 12345"), []);
  });

  it("コードの中は読まない", () => {
    assert.deepEqual(findingsOf("1. A\n2. B\n\n例：`step 7` と書きます。\n", en), []);
  });

  it("空の文字列と語の無い言語", () => {
    assert.deepEqual(missingSteps(plain(""), WORDS), []);
    assert.deepEqual(missingSteps(plain("1. A\n\nstep 5"), []), []);
  });
});
