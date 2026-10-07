import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

const RULES = loadRules("en");

const idsFor = (source: string): string[] => firedRules(en, source);

/** adverb-overuse は 200 語未満を測らない。密度を見る test はこれで嵩を足す。 */
const padded = (source: string): string => `${source}\n\n${"We shipped the release and the team reported the numbers. ".repeat(22)}`;

describe("L3 英語", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  describe("adverb-overuse", () => {
    it("invalid: -ly 副詞の密度が高い", () => {
      const source = "The team moved quickly and delivered carefully. We wrote the code rapidly and reviewed it thoroughly and shipped it smoothly.";
      assert.ok(idsFor(padded(source)).includes("adverb-overuse"));
    });

    it("valid: 副詞が少なければ指摘しない", () => {
      assert.ok(!idsFor(padded("The team hurried and delivered. We wrote the code and reviewed it.")).includes("adverb-overuse"));
    });

    it("短い文書は測らない。密度が暴れるため", () => {
      assert.ok(!idsFor("We moved quickly and carefully and thoroughly.").includes("adverb-overuse"));
    });
  });

  describe("expletive-construction", () => {
    it("invalid: There is / It is ... that が重なる", () => {
      const source = "There is a need to review. There are risks. It is clear that we must act. There is no answer.";
      assert.ok(idsFor(source).includes("expletive-construction"));
    });

    it("valid: 主語が前に出ていれば指摘しない", () => {
      const source = "The board must review the budget. Several risks remain. We must act now. Nobody has an answer.";
      assert.ok(!idsFor(source).includes("expletive-construction"));
    });

    it("valid: that 節を伴わない it is は数えない", () => {
      // "It is raining" は正当な用法。
      const source = "It is raining. It is cold. It is late. It is quiet.";
      assert.ok(!idsFor(source).includes("expletive-construction"));
    });
  });

  describe("sentence-initial-conjunction-run", () => {
    it("invalid: 接続詞で始まる文が 4 つ続く", () => {
      assert.ok(
        idsFor("We shipped it. And we told the team. But the schedule slipped. So we adjusted. Yet nobody complained.").includes(
          "sentence-initial-conjunction-run",
        ),
      );
    });

    it("valid: 1 つだけなら指摘しない", () => {
      assert.ok(!idsFor("We shipped it. And we told the team. The schedule held.").includes("sentence-initial-conjunction-run"));
    });

    const japaneseRun = (source: string): boolean => firedRules(ja, source).includes("sentence-initial-conjunction-run");

    it("invalid: 日本語でも、接続詞で始まる文が 3 つ続けば指摘する", () => {
      assert.ok(
        japaneseRun("会議室を予約しました。そして、資料を配りました。しかし、議事録が漏れました。また、結果も共有していません。つまり、やり直しです。"),
      );
    });

    it("valid: 日本語で 2 つまで、語の途中（またたく間）、話し言葉の文頭（でも）は数えない", () => {
      assert.ok(!japaneseRun("会議室を予約しました。そして、資料を配りました。しかし、議事録が漏れました。結果は共有しました。"));
      assert.ok(!japaneseRun("会議室を予約しました。そして、資料を配りました。またたく間に終わりました。しかし、議事録が漏れました。"));
      assert.ok(!japaneseRun("会議室を予約しました。でも、資料は配りました。だから、議事録が漏れました。なので、やり直しです。"));
    });
  });

  describe("title-case-consistency", () => {
    it("invalid: sentence case の中に Title Case が 1 つ", () => {
      const source = "## About the parser\n\nText.\n\n## When using arrays\n\nText.\n\n## Usage Example Here\n\nText.";
      assert.ok(idsFor(source).includes("title-case-consistency"));
    });

    it("valid: 揃っていれば指摘しない", () => {
      const source = "## About the parser\n\nText.\n\n## When using arrays\n\nText.\n\n## Usage example here\n\nText.";
      assert.ok(!idsFor(source).includes("title-case-consistency"));
    });

    it("1 語の見出しは判定できない。どちらの流儀でも先頭は大文字", () => {
      const source = "## Parser\n\nText.\n\n## Renderer\n\nText.\n\n## Exporter\n\nText.";
      assert.ok(!idsFor(source).includes("title-case-consistency"));
    });
  });

  describe("oxford-comma-consistency", () => {
    it("invalid: 打つ文と打たない文が混ざる", () => {
      const source =
        "We shipped the parser, the renderer, and the exporter.\nThe team reviewed the plan, the budget, and the schedule.\nWe tested the code, the docs and the samples.";
      assert.ok(idsFor(source).includes("oxford-comma-consistency"));
    });

    it("valid: 揃っていれば、どちらの流儀でも指摘しない", () => {
      const with_ = "We shipped the parser, the renderer, and the exporter.\nWe tested the code, the docs, and the samples.";
      const without = "We shipped the parser, the renderer and the exporter.\nWe tested the code, the docs and the samples.";
      assert.ok(!idsFor(with_).includes("oxford-comma-consistency"));
      assert.ok(!idsFor(without).includes("oxford-comma-consistency"));
    });

    it("2 つの並列は判定しない。読点が入らないため", () => {
      assert.ok(!idsFor("We shipped the parser and the renderer.\nWe tested the code, the docs, and the samples.").includes("oxford-comma-consistency"));
    });

    // 候補の文が「読点のない並列」と判定されたときだけ、Oxford 側 2 文の中で少数派として指摘される。
    const WITH_COMMA = "We shipped the parser, the renderer, and the exporter.\nThe team reviewed the plan, the budget, and the schedule.";
    const WITHOUT_COMMA = "We shipped the parser, the renderer and the exporter.\nThe team reviewed the plan, the budget and the schedule.";
    const judgedAgainst = (base: string, candidate: string): boolean => idsFor(`${base}\n${candidate}`).includes("oxford-comma-consistency");

    [
      ["導入の句の読点と、2 つの動詞", "After the review, the team fixed the bug and shipped it."],
      ["導入の節の読点", "If it fails, retry and report."],
      ["導入の副詞の読点", "Finally, retry and report."],
      ["過去分詞で始まる導入の句の読点", "Based on the review, fix the parser and ship it."],
      ["to で始まる導入の句の読点", "To test the parser, build it and run it."],
      ["前置詞のあとの名詞は、主語の前の導入の句", "Over this period, the subcommittees and the full committee considered the bills."],
      ["名詞の前で重ねた形容詞の読点", "Take the long, winding bridge and enjoy the view."],
      ["挿入の関係節の読点", "The team, which met on Monday, approved the plan and the budget."],
      ["セミコロンの前の読点は別の節", "It rained, the deadline moved; the parser and the renderer shipped."],
      ["節の並びに見えて、and の後ろが節ではない", "We listen, these are crucial to the team and getting results."],
      ["括弧の中の and は、括弧の外の項目と並べない", "It rained, it snowed (the roads and the rails closed)."],
      ["and の後ろの項目は次の読点まで", "We listen, the team is crucial to us and the results, which vary."],
    ].forEach(([why, candidate]) => {
      it(`valid: ${why ?? ""}`, () => {
        assert.ok(!judgedAgainst(WITH_COMMA, candidate ?? ""));
      });
    });

    it("valid: 節をつなぐ and の前の読点は Oxford comma ではない", () => {
      assert.ok(!judgedAgainst(WITHOUT_COMMA, "We tested it, and the team shipped it."));
    });

    it("valid: 地名に添えた州や国の名の読点は並びの読点ではない（City, State, and …）", () => {
      assert.ok(!judgedAgainst(WITHOUT_COMMA, "The map shows the flooding in New London, Wisconsin, and a photo shows the streets."));
      assert.ok(!judgedAgainst(WITHOUT_COMMA, "The map of the flooding in New London, Wisconsin, and a photo of the streets."));
      assert.ok(!judgedAgainst(WITHOUT_COMMA, "The office in Lyon, France, and the team in Austin, Texas, met."));
      assert.ok(!judgedAgainst(WITHOUT_COMMA, "We met the mayor of Portland, Oregon, and the governor."));
      assert.ok(!judgedAgainst(WITHOUT_COMMA, "We met the mayor of Albany, New York, and the governor."));
      assert.ok(!judgedAgainst(WITHOUT_COMMA, "We visited Washington, D.C., and a museum in Baltimore."));
    });

    it("invalid: 州や国そのものの並びと、地名に州を添えた項目の並びは、並び", () => {
      assert.ok(judgedAgainst(WITHOUT_COMMA, "We visited Texas, Florida, and Ohio."));
      assert.ok(judgedAgainst(WITHOUT_COMMA, "We visited Japan, France, and Germany."));
      assert.ok(judgedAgainst(WITHOUT_COMMA, "We visited Austin, Texas, Boston, Massachusetts, and Denver, Colorado."));
      assert.ok(judgedAgainst(WITHOUT_COMMA, "We hired Alice, Bob, and Carol."));
      assert.ok(judgedAgainst(WITH_COMMA, "We visited Austin, Texas, Boston, Massachusetts and Denver."));
      assert.ok(judgedAgainst(WITH_COMMA, "We hired Bob, Georgia and Lee."));
      assert.ok(judgedAgainst(WITHOUT_COMMA, "We visited the lake, Texas, and Ohio."));
    });

    it("valid: and の後ろが項目と違う形なら並列ではない", () => {
      assert.ok(!judgedAgainst(WITHOUT_COMMA, "We fixed the parser, the renderer, and then we rested."));
    });

    it("valid: 述語の並びなら、どの項目にも動詞がある。主語は項目ではない", () => {
      assert.ok(!judgedAgainst(WITHOUT_COMMA, "The scope of the data, in contrast, is larger, and covers the whole body."));
    });

    it("valid: 節の並びなら、どの項目も節。導入の語は項目ではない", () => {
      assert.ok(!judgedAgainst(WITHOUT_COMMA, "Additionally, when we share them, others can learn from us, and the same mistake is rarer."));
    });

    it("invalid: 動詞で始まる最初の項目は、名詞の並びの前置き", () => {
      assert.ok(judgedAgainst(WITH_COMMA, "Read the guide, the notes and the index."));
    });

    it("invalid: 動詞で始まる項目は、後ろに動詞があっても節ではない", () => {
      assert.ok(judgedAgainst(WITHOUT_COMMA, "They wrote the code, explained what changed, and shipped the release."));
    });

    it("invalid: 主語の並びは、and の後ろに述語が続いても並列", () => {
      assert.ok(judgedAgainst(WITH_COMMA, "The parser, the renderer and the exporter shipped."));
    });

    it("invalid: 節が 3 つ並べば並列", () => {
      assert.ok(judgedAgainst(WITHOUT_COMMA, "The parser failed, the renderer crashed, and the exporter stopped."));
    });

    it("invalid: 括弧の中の読点は項目を切らない", () => {
      assert.ok(judgedAgainst(WITHOUT_COMMA, "We tested the parser, the renderer (the slow one, sadly), and the exporter."));
    });

    it("invalid: 導入の句のあとの本当の並列は判定する", () => {
      assert.ok(judgedAgainst(WITH_COMMA, "After the review, we fixed the parser, the renderer and the exporter."));
    });

    it("invalid: 冠詞の有無は形の違いにしない", () => {
      assert.ok(judgedAgainst(WITH_COMMA, "We need the code, the docs and samples."));
    });

    it("invalid: 固有名詞・形容詞で始まる項目も名詞の並び", () => {
      assert.ok(judgedAgainst(WITH_COMMA, "We visited Paris, the old port and the museums."));
    });

    it("invalid: to の並びは並列", () => {
      assert.ok(judgedAgainst(WITH_COMMA, "We plan to test, to build and to run."));
    });

    it("invalid: 過去分詞が並べば、文頭でも並列", () => {
      assert.ok(judgedAgainst(WITH_COMMA, "Tested, reviewed and approved, the release went out."));
    });

    it("invalid: 形容詞そのものの並びは切ったまま", () => {
      assert.ok(judgedAgainst(WITH_COMMA, "The tool is quick, cheap and reliable."));
    });

    it("invalid: 同じ形の副詞が並べば、文頭でも並列", () => {
      assert.ok(judgedAgainst(WITH_COMMA, "Quickly, quietly and carefully, we moved."));
    });

    // 分詞の句と同格の名詞句は、読点で挟まれていても並列の項目ではない（#277 の triage）。
    [
      ["分詞で始まる句の中の or（meaning は解析器が名詞と読む）", WITH_COMMA, "The name comes from Latin, meaning ship or boat."],
      [
        "現在分詞の挿入句と、別の形の述語（Gideon v. Wainwright）",
        WITHOUT_COMMA,
        "He was found guilty by the judge, sitting without a jury, and sentenced to eight years in prison.",
      ],
      ["副詞のあとの過去分詞の句が 2 つ", WITHOUT_COMMA, "The parser, originally written by the core team, and now maintained by volunteers, runs everywhere."],
      ["現在分詞の句の中の and", WITH_COMMA, "The team met on Monday, filling the gaps and fixing the bugs."],
      [
        "名詞のあとの同格の名詞句（NIH Research Matters）",
        WITH_COMMA,
        "A bivalent vaccine targeted two HPV types, HPV16 and HPV18, that account for more than 77% of cervical cancers worldwide.",
      ],
      [
        "主語のあとの同格の句（Gideon v. Wainwright）",
        WITH_COMMA,
        "Governments, both state and federal, quite properly spend vast sums of money to establish machinery to try defendants.",
      ],
    ].forEach(([why, base, candidate]) => {
      it(`valid: ${why ?? ""}`, () => {
        assert.ok(!judgedAgainst(base ?? "", candidate ?? ""));
      });
    });

    it("valid: 最後の項目の中の and は、その後ろに並列が続くなら並列の and ではない（Gideon v. Wainwright）", () => {
      const candidate =
        "The Court has made obligatory the Fifth Amendment's command, the Fourth Amendment's prohibition of unreasonable searches and seizures, and the Eighth's ban on cruel and unusual punishment.";
      assert.ok(!judgedAgainst(WITH_COMMA, candidate));
      assert.ok(judgedAgainst(WITHOUT_COMMA, candidate));
    });

    it("invalid: including のあとの並列は判定する（GSA）", () => {
      assert.ok(judgedAgainst(WITH_COMMA, "We hired top talent across our programs, including the grants office, the help desk and the travel team."));
    });

    it("invalid: 動詞の並びは判定する（Kubernetes overview の形）", () => {
      assert.ok(judgedAgainst(WITH_COMMA, "You can create new containers for your deployment, remove old containers and adopt their resources."));
    });

    it("invalid: 現在分詞そのものの並びは判定する", () => {
      assert.ok(judgedAgainst(WITH_COMMA, "We are hiring engineers, buying laptops and renting desks."));
      assert.ok(judgedAgainst(WITH_COMMA, "The team is fixing the parser, testing the renderer and shipping the exporter."));
    });

    it("invalid: and の前に読点があれば、後ろに読点が続いても 3 つの並列（CRS）", () => {
      const candidate =
        "Each bill follows a sequential process involving consideration at the subcommittee, full committee, and chamber levels, as well as action between the chambers.";
      assert.ok(judgedAgainst(WITHOUT_COMMA, candidate));
    });

    it("valid: 分詞の句の中の挿入の語は項目ではない", () => {
      assert.ok(!judgedAgainst(WITHOUT_COMMA, "Send us your notes on the call, including, for example, any reference numbers, and the times of the calls."));
    });

    it("valid: 項目の中の and は、後ろに並列が続くなら並列の and ではない（18F）", () => {
      const candidate = "Documentation makes it easier to onboard a new team member, explain and justify historic decisions, and ultimately ensure success.";
      assert.ok(!judgedAgainst(WITH_COMMA, candidate));
    });

    it("valid: and / or で閉じた並びのあとの項目は、次の並びと並べない", () => {
      assert.ok(!judgedAgainst(WITH_COMMA, "Neither party will allow the offering, giving, or receiving, directly or indirectly, money or anything of value."));
    });

    it("valid: 分詞の句のあとが同じ形でなければ並びではない", () => {
      assert.ok(!judgedAgainst(WITH_COMMA, "The other party may seek relief, including an injunction, in any court without a bond and without notice."));
    });

    [
      [
        "後ろの項目が動詞で始まれば、分詞に読まれた項目も述語の並び（Gideon v. Wainwright）",
        WITHOUT_COMMA,
        "He made an opening statement to the jury, cross-examined the State's witnesses, presented witnesses in his own defense, declined to testify himself, and made a short argument.",
      ],
      ["並びのあとに別の形の and が続いても並列", WITH_COMMA, "We bought apples, pears and plums, and went home."],
      ["並びのあとに別の形の and が続いても並列（読点あり）", WITHOUT_COMMA, "We bought apples, pears, and plums, and went home."],
      ["並びのあとに節をつなぐ and が続いても並列", WITH_COMMA, "We bought apples, pears and plums, and the figs fell."],
      ["並びのあとに節をつなぐ and が続いても並列（読点あり）", WITHOUT_COMMA, "We bought apples, pears, and plums, and the figs fell."],
      [
        "閉じた並びの項目の中から次の並びが始まる",
        WITHOUT_COMMA,
        "We promise nothing about it being safe, secure, or fast, or that it will run without errors, delays, or crashes.",
      ],
      ["動詞のある項目は同格ではない", WITH_COMMA, "We found the bug in the parser, fixed the code and shipped the release, then rested."],
      ["and で始まる項目から次の並びが始まる", WITH_COMMA, "The file gets a comment explaining the rule, and the date, the reason and a name."],
      ["括弧の中の読点は、and の後ろの項目を閉じない", WITH_COMMA, "Opening, welcome and roll call (Chair, 10 minutes)"],
      ["引用符の中の -ing の語は分詞の句ではない", WITHOUT_COMMA, "Use ‘organise’ not ‘organize’, ‘modelling’ not ‘modeling’, and ‘fill in’, not ‘fill out’."],
      [
        "挿入の分詞の句のあとの並び",
        WITHOUT_COMMA,
        "It means information disclosed by a party, including before the start date, to a recipient that the party marks as “secret”, “private”, or the like.",
      ],
    ].forEach(([why, base, candidate]) => {
      it(`invalid: ${why ?? ""}`, () => {
        assert.ok(judgedAgainst(base ?? "", candidate ?? ""));
      });
    });

    it("invalid: 項目が 3 つより多ければ、後ろに読点が続いても並列", () => {
      assert.ok(judgedAgainst(WITH_COMMA, "We bought apples, pears, plums and figs, then went home."));
    });

    it("invalid: 最初の and が並列でなくても、後ろの並列を見る", () => {
      assert.ok(judgedAgainst(WITHOUT_COMMA, "We wrote the parser and the renderer, the exporter, and the tests."));
    });

    // 例の句・2 つだけを取る語・名詞を共有する修飾語・前置詞の目的語の中の and / or は、並びの最後の継ぎ目ではない（#170 の corpus round 11）。
    const neitherSide = (candidate: string): boolean => judgedAgainst(WITH_COMMA, candidate) || judgedAgainst(WITHOUT_COMMA, candidate);

    [
      ["such as のあとの 2 つ（Login.gov）", "This will rely on the screen lock on your phone, such as a PIN or phone-based fingerprint."],
      ["括弧の中の e.g. のあとの 2 つ", "Invite external users (e.g., guests or vendors) to the call."],
      ["i.e. のあとの 2 つ", "Use a second factor, i.e. a security key or an authentication app."],
      ["for example のあとの 2 つ", "Bring a document, for example a passport or a driving licence."],
      [
        "名詞を共有する形容詞の and（成分表示）",
        "Inactive ingredients: carnauba wax, microcrystalline cellulose, natural and artificial flavor, titanium dioxide",
      ],
      ["名詞を共有する過去分詞の or（解析器が過去形と読む）", "Notices are given upon delivery by email, registered or certified mail, or personal delivery."],
      [
        "最後の項目の前置詞の目的語の or（cloud.gov）",
        "Updates and real-time chat should continue as above (updates on the Google Doc, chat in Slack or Google Hangouts).",
      ],
      [
        "both のあとが複数形でも、and の後ろが冠詞の無い複数形なら 2 つを結ぶ（18F）",
        "Teams should make a recommendation to the Director of Account Management, who is accountable for both project impact goals and business goals and will make the ultimate decision.",
      ],
      [
        "either のあとが動詞なら 2 つを結ぶ（GitLab）",
        "Some meetings may benefit from introductions, so be intentional about either doing introductions or not.",
      ],
      ["目的語のあとの副詞は目的語の品詞を変えない", "Updates should continue as above (updates on the Google Doc, chat in Slack or Teams only)."],
      ["目的語のあとの名詞は目的語の品詞を変えない", "Updates should continue as above (updates on the Google Doc, chat in Slack or Teams desktop)."],
      ["目的語のあとの括弧は目的語の品詞を変えない", "Updates should continue as above (updates on the Google Doc, chat in Slack or Teams (beta))."],
    ].forEach(([why, candidate]) => {
      it(`valid: ${why ?? ""}`, () => {
        assert.ok(!neitherSide(candidate ?? ""));
      });
    });

    it("valid: between の中の and は項目の中。Oxford の並びとして読む", () => {
      const candidate =
        "The terms mean these standard terms, the key terms between the provider and the customer, and any policies referenced in or attached to them.";
      assert.ok(!judgedAgainst(WITH_COMMA, candidate));
      assert.ok(judgedAgainst(WITHOUT_COMMA, candidate));
    });

    [
      ["such as のあとの 3 つ", WITH_COMMA, "This will rely on the screen lock on your phone, such as a PIN, a password or a fingerprint."],
      ["括弧の中の e.g. のあとの 3 つ", WITH_COMMA, "Invite external users (e.g., guests, vendors and partners) to the call."],
      ["such as が最初の項目の中にあっても、後ろの並び", WITHOUT_COMMA, "We sell tools such as hammers, saws, and drills."],
      ["between が最後の項目に無ければ並び", WITH_COMMA, "The contract is between the provider, the reseller and the customer."],
      ["形容詞の並びが名詞を共有しても並び", WITH_COMMA, "We sell red, white and blue flags."],
      ["過去分詞の並びが名詞を共有しても並び", WITH_COMMA, "We ship tested, reviewed and approved code."],
      ["修飾語の前の読点は項目の区切り（BLS）", WITHOUT_COMMA, "We count federal government, military, and agricultural workers."],
      ["both のあとが複数形なら 2 つは揃っていて、and は並びの継ぎ目", WITH_COMMA, "We tested the parser, the renderer in both modes and the exporter."],
      ["and の後ろが冠詞を連れた複数形なら、both の 2 つは揃っている", WITH_COMMA, "We tested the parser, the renderer in both modes and the exporters."],
      ["both のあとの読点は項目の区切り", WITHOUT_COMMA, "We tested the parser, the renderer in both views, and the exporter."],
      ["either のあとの読点は項目の区切り", WITHOUT_COMMA, "We can drop the parser, the renderer with either option, or the exporter."],
      ["between の 2 つが揃ったあとの and は並びの継ぎ目", WITH_COMMA, "We read the notes, the terms between the provider and the customer and the policies."],
      ["括弧の中の either は括弧の外の or と組まない", WITH_COMMA, "The plan covers pricing, implementation (either way) or support."],
      ["either の相手は or。and なら either は名詞にかかるだけ", WITH_COMMA, "The review covers pricing, the impact of either option and implementation."],
      ["and で閉じた例の句は 1 つの項目", WITHOUT_COMMA, "The menu includes apples, oranges such as navels and mandarins, and pears."],
      ["空けて書いた頭文字は e.g. ではない", WITH_COMMA, "The attendees (A. B. Clark, E. G. Evans and C. D. Ford) arrived."],
      ["続けて書いた頭文字は e.g. ではない", WITH_COMMA, "The attendees (A.B. Clark, E.G. Evans and C.D. Ford) arrived."],
      ["続けて書いた頭文字は i.e. ではない", WITH_COMMA, "We invited Alice, I.E. Evans and Carol."],
      ["括弧の中の例の句は、括弧の外の並びを切らない", WITH_COMMA, "We tested the parser, the renderer (such as the slow one) and the exporter."],
      ["修飾語だけでない項目は、名詞を共有しない", WITH_COMMA, "We sell cheese, blue cheese and white bread."],
      ["冠詞や目的語を連れた後ろの項目は、名詞を共有しない", WITH_COMMA, "We built the parser, tested and shipped the release."],
      ["and の後ろも前置詞の句を連れれば並び", WITH_COMMA, "We keep updates on the Google Doc, chat in Slack and notes on paper."],
      ["and の後ろが項目の頭と同じ品詞なら並び", WITH_COMMA, "The policy applies to requests for records, petitions for waivers and appeals."],
      ["and の後ろが項目の頭と同じ品詞なら並び（別の形）", WITH_COMMA, "We track requirements for admins, settings for editors and viewers."],
      ["固有名詞の目的語でも、or の前の読点は項目の区切り", WITHOUT_COMMA, "We keep updates on the Google Doc, chat in Slack, and Google Hangouts."],
      ["前置詞の句を連れない項目があれば、固有名詞でも並び", WITH_COMMA, "We keep updates, chat in Slack and Google Hangouts."],
      ["and の後ろが前置詞の句を連れれば、固有名詞でも並び", WITH_COMMA, "We keep notes on the Google Doc, chat in Slack and Zoom in Chrome."],
      ["and の後ろに述語が続けば、固有名詞でも主語の並び", WITH_COMMA, "Updates on the Google Doc, chat in Slack and Google Hangouts replaced Skype."],
      ["最後の項目の目的語と品詞が違えば並び", WITH_COMMA, "We keep updates on the doc, chat in rooms and Google Hangouts."],
      [
        "例の句の中の項目の形が揃わなければ、句の前からの並び（CRS）",
        WITHOUT_COMMA,
        "It cannot be analyzed further (e.g., by location of performance, contract type, or contract preference).",
      ],
      [
        "項目の中の例の句の形が揃わなければ、句の前からの並び",
        WITHOUT_COMMA,
        "Such capabilities include producing materials such as green steel, utilizing gas power, and adopting data centers.",
      ],
      ["前置詞の句を連れない項目があれば並び", WITH_COMMA, "We need updates on the Google Doc, chat and email."],
      ["前置詞の句が揃っても、and の前の読点は並び", WITHOUT_COMMA, "We keep updates on the Google Doc, chat in Slack, and notes."],
    ].forEach(([why, base, candidate]) => {
      it(`invalid: ${why ?? ""}`, () => {
        assert.ok(judgedAgainst(base ?? "", candidate ?? ""));
      });
    });

    it("2 つの X or Y は、読点があってもなくても並びではない", () => {
      ["We accept cash or cards.", "We accept cash, or cards.", "Pay by cash or by card."].forEach((candidate) => assert.ok(!neitherSide(candidate)));
    });
  });

  it("英語の rule は日本語で動かさない", () => {
    const result = runRules(buildDocument("t.md", "これは文です。", ja), loadRules("ja"), {}, true, "business/report");
    ["adverb-overuse", "expletive-construction", "title-case-consistency", "oxford-comma-consistency"].forEach((id) => {
      assert.ok(
        result.skipped.some((entry) => entry.rule === id),
        `${id} が skip されていない`,
      );
    });
  });

  it("書き出しの同じさは、英語では語で測る", () => {
    // 文字で切ると "We continued" が "Wecont" になり、引用がそのまま読み手に出る。
    const source = "We continued the work and reported the numbers. ".repeat(5);
    const findings = runRules(buildDocument("t.md", source, en), RULES, {}, true, "blog/tech").findings;
    const head = findings.find((finding) => finding.rule === "repeated-sentence-head");
    assert.equal(head?.values["head"], "We continued the");
  });
});
