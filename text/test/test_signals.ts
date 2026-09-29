import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

const idsFor = (source: string, genre = "business/report", adapter: LanguageAdapter = ja): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, genre).findings.map((finding) => finding.rule);

/** 密度を見る rule は短い文書を測らない。嵩を足すための本文。 */
const BULK = "本日の連絡です。今日も順調に進めます。明日も続けます。".repeat(20);
const BULK_EN = "We shipped the release and reported the numbers to the team. ".repeat(40);

describe("emoji-density", () => {
  it("invalid: 絵文字が並ぶ", () => {
    assert.ok(idsFor(`# 連絡\n\n${"🎉 進捗 🚀 順調 ✨ 期待 💪 頑張り 🔥 ".repeat(4)}${BULK}`).includes("emoji-density"));
  });

  it("valid: 絵文字が無ければ指摘しない", () => {
    assert.ok(!idsFor(`# 連絡\n\n${BULK}`).includes("emoji-density"));
  });

  it("英語でも同じ rule が動く", () => {
    assert.ok(idsFor(`# Report\n\n${"🎉 Great 🚀 progress ✨ today 💪 ".repeat(4)}${BULK_EN}`, "business/report", en).includes("emoji-density"));
  });

  it("短い文書は測らない。密度が暴れるため", () => {
    assert.ok(!idsFor("# 連絡\n\n🎉 進捗 🚀 順調 ✨ 期待。").includes("emoji-density"));
  });
});

describe("ngram-repetition", () => {
  it("invalid: 同じ言い回しが繰り返される", () => {
    const source = `# 見出し\n\n${"これは大事ではありません。あれも大事ではありません。".repeat(5)}${BULK}`;
    assert.ok(idsFor(source).includes("ngram-repetition"));
  });

  it("valid: 用語に助詞が 1 つ付いただけのものは数えない", () => {
    // 「detectorは」は仕様書で繰り返して当たり前の用語。本物の言い回しはひらがなをもっと含む。
    const source = `# 見出し\n\n${"detectorは純関数である。detectorは fs に触れない。".repeat(6)}${BULK}`;
    const worst = runRules(buildDocument("t.md", source, ja), loadRules("ja"), {}, true, "business/report").findings.find(
      (finding) => finding.rule === "ngram-repetition",
    );
    assert.ok(!String(worst?.values["word"] ?? "").includes("etector"));
  });

  it("valid: 固有名詞の繰り返しは数えない", () => {
    // 実文書で測ったら、上位は「AGENTS.m」「シンギュラリティ」のような名前だった。
    const source = `# 見出し\n\n${"シンギュラリティソサエティが主催します。".repeat(8)}${BULK}`;
    const worst = runRules(buildDocument("t.md", source, ja), loadRules("ja"), {}, true, "business/report").findings.find(
      (finding) => finding.rule === "ngram-repetition",
    );
    assert.ok(!String(worst?.values["word"] ?? "").includes("シンギュラリティ"));
  });

  it("invalid: 名詞の前の動詞を含む日本語の言い回し（〜の中にあるコンポーネント）は数える", async () => {
    await ja.prepare?.({ pos: true });
    // 英語では名詞の前の動詞を飾りの語として外すが、日本語の連体の動詞は言い回しの一部になる。
    const places = ["画面", "一覧", "表", "図", "枠", "欄", "箱", "列"];
    // 埋め草は平仮名を含まず番号だけが違う文。言い回しとして数えられない。
    const filler = Array.from({ length: 80 }, (_, index) => `資料${String(index)}番号${String(index)}。`).join("");
    const body = places.map((place) => place + "の中にあるコンポーネントを選びます。").join("");
    const source = `# 見出し\n\n${body}${filler}`;
    const worst = runRules(buildDocument("t.md", source, ja), loadRules("ja"), {}, true, "business/report").findings.find(
      (finding) => finding.rule === "ngram-repetition",
    );
    assert.match(String(worst?.values["word"] ?? ""), /にある/u);
  });

  it("文をまたいで数えない", () => {
    // 文の終わりと次の文の始まりが繋がると、名前が言い回しに見える。
    const source = `# 見出し\n\n${"です。シンギュラ。".repeat(8)}${BULK}`;
    const worst = runRules(buildDocument("t.md", source, ja), loadRules("ja"), {}, true, "business/report").findings.find(
      (finding) => finding.rule === "ngram-repetition",
    );
    assert.ok(!String(worst?.values["word"] ?? "").includes("す。シンギュラ"));
  });
});

describe("ngram-repetition: 英語の名詞の語句は言い回しではない", () => {
  // どの語も重ならない埋め草。これ自体は繰り返しにならない。
  const FILLER = Array.from({ length: 60 }, (_, index) => `Zq${String(index)}a Yk${String(index)}b Xm${String(index)}c Wp${String(index)}d.`).join(" ");
  // 動詞の語尾がそろうと「ed the state and loc」のような語尾の繰り返しができるので、ばらばらにする。
  const CONTEXTS = [
    "Congress changed",
    "Economists study",
    "Governors defend",
    "Critics attack",
    "Analysts track",
    "Voters discuss",
    "Reports cover",
    "Lawmakers keep",
  ];

  const worstWord = async (source: string): Promise<string | undefined> => {
    await en.prepare?.({ pos: true });
    const finding = runRules(buildDocument("t.md", source, en), loadRules("en"), {}, true, "business/report").findings.find(
      (each) => each.rule === "ngram-repetition",
    );
    return finding === undefined ? undefined : String(finding.values["word"]);
  };

  it("valid: 主題の名前（state and local tax deduction）は、何度出ても数えない", async () => {
    const body = CONTEXTS.map((context) => context + " the state and local tax deduction.").join(" ");
    const source = `# Report\n\n${body} ${FILLER}`;
    assert.equal(await worstWord(source), undefined);
  });

  it("invalid: 動詞を含む言い回し（it is important to note that）は数える", async () => {
    const body = CONTEXTS.map((context) => context + " it, and it is important to note that.").join(" ");
    const source = `# Report\n\n${body} ${FILLER}`;
    assert.match((await worstWord(source)) ?? "", /is important|important to/u);
  });
});

describe("undefined-acronym", () => {
  it("invalid: 説明のない略語が並ぶ", () => {
    assert.ok(idsFor(`# 連絡\n\nSRE と SLO と MTTR と RPO の方針を見直します。${BULK}`).includes("undefined-acronym"));
  });

  it("valid: 括弧で展開してあれば指摘しない", () => {
    const source = `# 連絡\n\nSRE（信頼性工学）と SLO（目標）と MTTR（復旧時間）と RPO（目標復旧点）を見直します。${BULK}`;
    assert.ok(!idsFor(source).includes("undefined-acronym"));
  });

  it("誰でも分かる略語は見ない", () => {
    assert.ok(!idsFor(`# 連絡\n\nURL と API と JSON と HTML と CSS を直します。${BULK}`).includes("undefined-acronym"));
  });

  // Kubernetes の文書と GitLab Handbook で指摘されていた、通信・機器・役職の略語。見慣れない略語 2 つ（閾値の 1 つ手前）に足して、数えないことを確かめる。
  [
    "DNS",
    "IP",
    "TCP",
    "UDP",
    "SSH",
    "SSL",
    "TLS",
    "VPN",
    "LAN",
    "UTF",
    "ASCII",
    "PC",
    "IT",
    "SDK",
    "IDE",
    "PNG",
    "JPEG",
    "GIF",
    "SVG",
    "QR",
    "GPS",
    "SNS",
    "TV",
    "KB",
    "MB",
    "GB",
    "TB",
    "CEO",
    "CTO",
    "CFO",
    "US",
    "USA",
    "UK",
    "EU",
    "UN",
    "DNA",
    "TIP",
  ].forEach((acronym) => {
    it(`よく知られた略語 ${acronym} は数えない`, () => {
      assert.ok(!idsFor(`# 連絡\n\nSRE と SLO と ${acronym} を確かめます。${BULK}`).includes("undefined-acronym"));
    });
  });

  it("invalid: 分野や社内でしか通じない略語は、よく知られた略語と並んでも指摘する", () => {
    assert.ok(idsFor(`# 連絡\n\nDNS と KEP と SIG と EMEA と APAC を確かめます。${BULK}`).includes("undefined-acronym"));
  });
});

/** 1 個でも出す段階で、出た略語だけを返す。どの語が略語と見なされたかを確かめるため。 */
const acronymsIn = (source: string, adapter: LanguageAdapter = en): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { "undefined-acronym": "strict" }, true, "business/report")
    .findings.filter((finding) => finding.rule === "undefined-acronym")
    .map((finding) => String(finding.values["word"]));

describe("undefined-acronym: 略語でない大文字を数えない（コーパスの誤検出）", () => {
  describe("大文字だけの語が 3 つ以上続くのは強調であって略語ではない", () => {
    it("valid: 免責の定型文", () => {
      assert.deepEqual(acronymsIn("# Terms\n\nTHE SERVICE IS PROVIDED AS IS WITHOUT WARRANTY OF ANY KIND."), []);
    });

    it("valid: 引用符や強調が挟まっても続いている", () => {
      assert.deepEqual(acronymsIn("# Terms\n\nTHE SERVICE IS PROVIDED “AS IS” AND **WITH ALL FAULTS**."), []);
    });

    it("valid: 2 語で終わる強調の断片も、同じ続きの中なら数えない", () => {
      assert.deepEqual(acronymsIn("# Notice\n\nThis page is FOR INFORMATION ONLY. It changes often."), []);
    });

    it("valid: 強調は読点や括弧をまたいで続く", () => {
      const source = "# Terms\n\nIt is provided on this basis and THE AUTHOR, THE COMPANY SHE WORKS FOR (IF ANY), AND THE BOARD DISCLAIM ALL WARRANTIES.";
      assert.deepEqual(acronymsIn(source), []);
    });

    it("valid: 小文字の文の中で、引用符に包まれた大文字の句", () => {
      assert.deepEqual(acronymsIn("# Terms\n\nAll feedback is provided “AS IS” and may be used freely."), []);
    });

    it("invalid: 引用符に包まれていても、1 語の略語は数える", () => {
      assert.deepEqual(acronymsIn("# Notes\n\nThe team said “SRE” twice."), ["SRE"]);
    });

    it("invalid: 強調の隣でも、小文字で区切られた略語は数える", () => {
      assert.deepEqual(acronymsIn("# Notice\n\nIMPORTANT NOTICE FOR ALL STAFF: the SRE team owns this."), ["SRE"]);
    });

    it("invalid: 読点で区切った略語の並びは強調ではない", () => {
      assert.deepEqual(acronymsIn("# Notes\n\nWe track SRE, SLO, MTTR every week."), ["SRE", "SLO", "MTTR"]);
    });

    it("invalid: 2 語だけの略語の並びは強調ではない", () => {
      assert.deepEqual(acronymsIn("# Notes\n\nThe NIST SP series applies."), ["NIST", "SP"]);
    });
  });

  describe("RFC 2119 の要件語は略語ではない", () => {
    it("valid: MUST NOT、SHOULD、MAY、SHALL、REQUIRED、RECOMMENDED、OPTIONAL", () => {
      const source =
        "# Rules\n\nThe client MUST NOT retry. The server SHOULD log it. A proxy MAY cache it. It SHALL stop. This field is REQUIRED. That one is RECOMMENDED. The last is OPTIONAL.";
      assert.deepEqual(acronymsIn(source), []);
    });

    it("invalid: 要件語の隣の略語は数える", () => {
      assert.deepEqual(acronymsIn("# Rules\n\nThe client MUST send an SRE report."), ["SRE"]);
    });

    it("valid: 単独の NOT は要件語ではないが、略語でもない（強調）", () => {
      assert.deepEqual(acronymsIn("# Rules\n\nDo NOT touch it."), []);
    });

    it("invalid: 単独の NOT の隣の略語は数える", () => {
      assert.deepEqual(acronymsIn("# Rules\n\nDo NOT touch the SRE queue."), ["SRE"]);
    });
  });

  describe("& で繋いだ名前は 1 語", () => {
    it("invalid: ATT&CK は ATT と CK に割らず、1 語として数える", () => {
      assert.deepEqual(acronymsIn("# Map\n\nEach control maps to ATT&CK techniques."), ["ATT&CK"]);
    });

    it("valid: 展開された M&IE から IE を切り出さない", () => {
      assert.deepEqual(acronymsIn("# Travel\n\nMeals and Incidental Expenses (M&IE) are paid daily."), []);
    });

    it("invalid: 空白を挟んだ & は略語 2 つ", () => {
      assert.deepEqual(acronymsIn("# Notes\n\nSRE & SLO matter."), ["SRE", "SLO"]);
    });
  });

  describe("展開の書きかたを広げる。すぐ隣だけは変えない", () => {
    it("valid: 角括弧で、直前の語の頭文字と揃う", () => {
      assert.deepEqual(acronymsIn("# Tax\n\nThe Tax Cuts and Jobs Act [TCJA] changed it. The TCJA also capped it."), []);
    });

    it("invalid: 角括弧でも、直前の語が展開になっていなければ引用の印", () => {
      assert.deepEqual(acronymsIn("# Refs\n\nThe registry is described in [IANA] and elsewhere."), ["IANA"]);
    });

    it("invalid: 略語のあとの角括弧は注の番号", () => {
      assert.deepEqual(acronymsIn("# Refs\n\nThe SLO [1] is strict."), ["SLO"]);
    });

    it("valid: 括弧の中で引用符と太字に包まれた定義語", () => {
      assert.deepEqual(acronymsIn("# NDA\n\nThis agreement (“**MNDA**”) covers it."), []);
    });

    it("valid: 太字の名前のあとの、太字の略語", () => {
      assert.deepEqual(acronymsIn("# DPA\n\nThe **Data Protection Addendum** (**DPA**) applies."), []);
    });

    it("valid: 日本語のかぎ括弧に包まれた定義語", () => {
      assert.deepEqual(acronymsIn(`# 契約\n\n本契約（「MNDA」）は双方を拘束します。${BULK}`, ja), []);
    });

    it("valid: 初出が見出し代わりでも、あとの 1 か所で展開してあればよい", () => {
      assert.deepEqual(acronymsIn("# Terms\n\nDPA. The parties follow the Data Protection Addendum (DPA) here."), []);
    });

    it("invalid: 別の語の一部に続く括弧は、その略語の展開ではない", () => {
      assert.deepEqual(acronymsIn("# Notes\n\nAsk CISA (the agency) about SA rules."), ["SA"]);
    });

    it("invalid: 括弧との間に語が挟まれば展開ではない", () => {
      assert.deepEqual(acronymsIn("# Notes\n\nWe use SRE heavily (see below)."), ["SRE"]);
    });
  });

  describe("ライセンス名", () => {
    it("valid: CC BY 4.0 と CC BY-SA 4.0 は 1 つの名前", () => {
      assert.deepEqual(acronymsIn("# License\n\nFree to use under CC BY 4.0. The photos are CC BY-SA 3.0."), []);
    });

    it("invalid: 単独の CC は数える", () => {
      assert.deepEqual(acronymsIn("# Mail\n\nPut the SRE on CC for the memo."), ["SRE", "CC"]);
    });
  });

  describe("数字と繋がった識別子", () => {
    it("valid: 管理策の番号と方針の番号", () => {
      assert.deepEqual(acronymsIn("# Controls\n\nControls AC-2 and SC-7 apply. See MS.TEAMS.1.1v1 for details."), []);
    });

    it("invalid: 数字を含まない繋がりは識別子ではない", () => {
      assert.deepEqual(acronymsIn("# Notes\n\nThe SRE-SLO handoff is weekly."), ["SRE", "SLO"]);
    });

    it("invalid: 小文字の語に繋がった略語は数える", () => {
      assert.deepEqual(acronymsIn("# Notes\n\nThe NIST-approved method and SRE-led reviews."), ["NIST", "SRE"]);
    });

    it("invalid: 文末の句点は識別子を作らない", () => {
      assert.deepEqual(acronymsIn("# Notes\n\nAsk the SRE. Then ask again."), ["SRE"]);
    });
  });

  describe("数字の隣で決まった書き方になる大文字（時刻・通貨・住所）", () => {
    it("valid: 時刻のあとの PM と時間帯", () => {
      assert.deepEqual(acronymsIn("# Travel\n\nSubmit it by 3:30 PM Eastern. The call starts at 2pm ET and ends at 16:00 UTC."), []);
    });

    it("invalid: 時刻の隣でない PM と ET は数える", () => {
      assert.deepEqual(acronymsIn("# Roles\n\nThe PM owns the plan. The ET team reviews it."), ["PM", "ET"]);
    });

    it("valid: 太字の時刻のあとの PM（強調の記号は空白になる）", () => {
      assert.deepEqual(acronymsIn("# Travel\n\nSubmit it by **3:30** PM."), []);
    });

    it("invalid: 時刻になりえない数の隣の PM は数える", () => {
      assert.deepEqual(acronymsIn("# Roles\n\nTeam 99 PM owns the plan."), ["PM"]);
    });

    it("valid: 金額の前後の通貨コード", () => {
      assert.deepEqual(acronymsIn("# Offer\n\nYou may buy up to USD 1,000,000 of stock. The fee is 250 EUR."), []);
    });

    it("invalid: 番号のあとの読点に続く略語は金額ではない", () => {
      assert.deepEqual(acronymsIn("# Drawings\n\nIn item 1, CAD owns the drawing."), ["CAD"]);
    });

    it("invalid: 金額の隣でない通貨コードと、一覧に無い通貨コードは数える", () => {
      assert.deepEqual(acronymsIn("# Offer\n\nPrices are in USD. The fee is XYZ 250."), ["USD", "XYZ"]);
    });

    it("valid: 米国の住所の州略号", () => {
      assert.deepEqual(acronymsIn("# Contact\n\nWrite to 2300 Main Street, Kansas City, MO 64108 or Berkeley, CA 94720-1234."), []);
    });

    it("invalid: 住所の形でない CA は数える（certificate authority）", () => {
      assert.deepEqual(acronymsIn("# Certs\n\nThe CA signs each certificate."), ["CA"]);
    });

    it("valid: 単独の AND は強調", () => {
      assert.deepEqual(acronymsIn("# Charts\n\nUse both color AND symbols."), []);
    });

    it("valid: TIP は NOTE と同じ見出し語、USA は US と同じ国名", () => {
      assert.deepEqual(acronymsIn("# Travel\n\n**TIP**: ask first. The office is in the USA."), []);
    });

    it("invalid: 語の形をした本物の略語は数える", () => {
      assert.deepEqual(acronymsIn("# Values\n\nThis touches our CREDIT values and the SAFE framework."), ["CREDIT", "SAFE"]);
    });
  });
});

describe("concrete-evidence-density", () => {
  const leadWord = (source: string, adapter: LanguageAdapter): string | number | undefined =>
    runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { "concrete-evidence-density": "strict" }, true, "business/report").findings.find(
      (finding) => finding.rule === "concrete-evidence-density" && finding.line === 1,
    )?.values["word"];

  it("見出しのない導入部は、その書き出しで呼ぶ。英語の文書に日本語を混ぜない", () => {
    const source = "We write for people who are busy. We keep it short. We say what we mean in plain words.\n\n## Next\n\nMore text.";
    assert.equal(leadWord(source, en), "We write for people…");
  });

  it("日本語の文書でも書き出しで呼ぶ", () => {
    const source = "抽象的な説明をこれから始めます。考えかたを述べます。理念を語ります。\n\n## 次\n\n続きです。";
    assert.equal(leadWord(source, ja), "抽象的な説明をこれから始…");
  });

  it("短い書き出しはそのまま", () => {
    const source = "Be kind. We keep it short. We say what we mean.\n\n## Next\n\nMore text.";
    assert.equal(leadWord(source, en), "Be kind.");
  });

  it("invalid: 数値もコードもリンクも無い節が並ぶ", () => {
    const sections = ["一", "二", "三", "四"].map((name) => `## ${name}\n\n抽象的な説明です。考えかたを述べます。理念を語ります。`).join("\n\n");
    assert.ok(idsFor(`# 表題\n\n${sections}`).includes("concrete-evidence-density"));
  });

  it("valid: 具体物があれば指摘しない", () => {
    const sections = ["一", "二", "三", "四"].map((name, index) => `## ${name}\n\n${String(index)} 件でした。実例を挙げます。数字で示します。`).join("\n\n");
    assert.ok(!idsFor(`# 表題\n\n${sections}`).includes("concrete-evidence-density"));
  });

  it("valid: 漢数字で書いた数（二割、十五分、三人）も具体的な数", async () => {
    await ja.prepare?.({ pos: true });
    const amounts = ["二割", "十五分", "三人", "百件"];
    const sections = amounts.map((amount, index) => `## 節${String(index)}\n\n参加は${amount}でした。実例を挙げます。結果を示します。`).join("\n\n");
    assert.ok(!idsFor(`# 表題\n\n${sections}`).includes("concrete-evidence-density"));
  });

  it("invalid: 言い回しの中の漢字（一人ひとり、十分、二人三脚）は数ではない", async () => {
    await ja.prepare?.({ pos: true });
    // 辞書が一語として持つ言い回し。「誰一人」「万人」は辞書でも数と単位に分かれるので、ここには入れない。
    const words = ["一人ひとりに届けます", "十分に検討します", "数年かけて進めます", "何人かで止めます"];
    const idioms = ["三日坊主になりません", "百人一首を読みます", "十人十色の考えです", "一緒に考えます"];
    const sections = words.map((word, index) => `## 節${String(index)}\n\n${word}。考えかたを述べます。理念を語ります。`).join("\n\n");
    assert.ok(idsFor(`# 表題\n\n${sections}`).includes("concrete-evidence-density"));
    const idiomSections = idioms.map((word, index) => `## 節${String(index)}\n\n${word}。考えかたを述べます。理念を語ります。`).join("\n\n");
    assert.ok(idsFor(`# 表題\n\n${idiomSections}`).includes("concrete-evidence-density"));
  });

  it("valid: 単位の後ろに語が続く数（二割程度、三日間、五年後）や、一件・一万円も数える", async () => {
    await ja.prepare?.({ pos: true });
    const amounts = ["二割程度", "三日間", "一件", "一万円"];
    const sections = amounts.map((amount, index) => `## 節${String(index)}\n\n期間は${amount}です。実例を挙げます。結果を示します。`).join("\n\n");
    assert.ok(!idsFor(`# 表題\n\n${sections}`).includes("concrete-evidence-density"));
  });

  it("仕様書では動かさない。定義の節に具体物は要らない", () => {
    // 「error とは何か」のような節は、数値もコードも無くて当たり前。
    const sections = ["error", "warning", "info", "Phase 1"].map((name) => `## ${name}\n\n抽象的な説明です。考えかたを述べます。理念を語ります。`).join("\n\n");
    assert.ok(!idsFor(`# 仕様\n\n${sections}`, "technical/spec").includes("concrete-evidence-density"));
    assert.ok(idsFor(`# 表題\n\n${sections}`, "business/report").includes("concrete-evidence-density"));
  });

  it("文の少ない節は測らない", () => {
    const sections = ["一", "二", "三", "四"].map((name) => `## ${name}\n\n一言だけ。`).join("\n\n");
    assert.ok(!idsFor(`# 表題\n\n${sections}`).includes("concrete-evidence-density"));
  });
});

describe("heading-echo の絞り込み", () => {
  const echoed = (source: string): boolean => idsFor(source, "blog/tech").includes("heading-echo");

  it("invalid: 見出しを繰り返して何も足さない", () => {
    assert.ok(echoed("## キャッシュの仕組み\n\nキャッシュの仕組みについて説明します。"));
  });

  it("valid: 見出しの語を含んでいても、中身を足していれば指摘しない", () => {
    // 実文書（英語 11 本）で測ったら、この条件なしでは 72.7% の文書が該当した。
    const source = "## ToolsAgent\n\nGraphAI provides ToolsAgent components that use LLMs to dynamically invoke agents from natural language input.";
    assert.ok(!idsFor(source, "blog/tech", en).includes("heading-echo"));
  });

  it("英語でも短い繰り返しは拾う", () => {
    assert.ok(idsFor("## Generating Output\n\nVarious outputs can be generated:", "blog/tech", en).includes("heading-echo"));
  });

  it("valid: コロンで後ろの箇条書きへ渡す文は、見出しの語を含んでいても指摘しない", () => {
    assert.ok(!idsFor("## Generating Output\n\nVarious outputs can be generated:\n\n- Movie\n- PDF", "blog/tech", en).includes("heading-echo"));
  });
});
