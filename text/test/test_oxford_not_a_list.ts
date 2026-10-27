import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { excerptSpans } from "../packages/chaff/src/detectors/quoted-excerpt.ts";

// oxford-comma-consistency: shapes that look like "A, B and C" but are not a list of three, so they cast no vote for or
// against the serial comma, and the lists next to them that still do. Excerpts are from US federal documents (18F, the
// Federal Reserve, the National Park Service, the US Code, the Supreme Court; public domain) or self-written.

const RULE = "oxford-comma-consistency";
const WITH_COMMA = "We sell posters, cards, and calendars.\nWe ship to shops, schools, and libraries.";
const WITHOUT_COMMA = "We sell posters, cards and calendars.\nWe ship to shops, schools and libraries.";

/** Whether the sentence is reported against two sentences of the given style: it was read as a list in the other style. */
const reportedAgainst = (base: string, sentence: string): boolean => firedRules(en, `${base}\n\n${sentence}\n`).includes(RULE);

const reportedWith = (sentence: string): boolean => reportedAgainst(WITH_COMMA, sentence);
const reportedWithout = (sentence: string): boolean => reportedAgainst(WITHOUT_COMMA, sentence);

describe("oxford-comma-consistency: what is not a list", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("starts after a clause opened by but, unless that clause ends with the first item", () => {
    assert.equal(
      reportedWith("If you need help with something, but it’s not a priority right now, add it to the backlog and bring it up when the time is right."),
      false,
    );
    assert.equal(reportedWith("We use issues, but other teams may use boards, wikis and spreadsheets."), true);
    assert.equal(reportedWith("Tools (including, but not limited to, saws, drills and sanders) are provided."), true);
  });

  it("does not count a word that ties the sentence to the one before as an item", () => {
    const sentence =
      "However, even more important is that the progress of the team be immediately and constantly shown to the customer, who may make adjustments at any time.";
    assert.equal(reportedWith(sentence), false);
    assert.equal(reportedWith("However, we also sell posters, cards and calendars."), true);
  });

  it("reads an indefinite article with only adjectives as waiting for its noun", () => {
    assert.equal(reportedWith("A simple, minimalist palette of cool blue and gray provides a neutral backdrop."), false);
    assert.equal(reportedWith("To hold the content, we provide a grid using Neat, a flexible and lightweight Sass grid by thoughtbot."), false);
    assert.equal(reportedWith("We hired a designer, a writer and an engineer."), true);
  });

  it("reads an and inside an item when the list goes on past it", () => {
    const congress =
      "Congress passed legislation that includes provisions for expanding rental assistance, guidelines for addressing zoning barriers, homeownership counseling and financial literacy, commercial conversions to housing, and support for manufactured housing.";
    assert.equal(reportedWith(congress), false);
    assert.equal(reportedWith("Users bring their interests—their health, their judgment, time and attention, their savings—to every exchange."), false);
    assert.equal(reportedWith("Users bring three things—time, attention and money—to every exchange."), true);
    assert.equal(reportedWith("We fund rent, zoning, outreach and counseling, all four programs."), true);
  });

  it("reads the list as going on to the words that stand for its rest", () => {
    const wiredata = "Brokers want data on properties—address, the age of the property, the number and type of rooms, and so forth—from the towns.";
    assert.equal(reportedWith(wiredata), false);
    assert.equal(reportedWith("We sell posters, cards and calendars, and so on."), false);
  });

  it("does not walk from a list of authors into the quoted title after it", () => {
    const powell =
      'See Brent Bundick, Isabel Cairó, and Nicolas Petrosky-Nadeau (2025), "Labor Market Dynamics, Monetary Policy Tradeoffs, and a Shortfalls Approach," Finance and Economics Discussion Series.';
    assert.equal(reportedWithout(powell), true);
  });

  it("reads two particles joined after a verb as one item", () => {
    assert.equal(reportedWith("We leave the gates open at night, so you are welcome to drive in and out."), false);
  });

  it("does not take two lists for one when the and's item is long", () => {
    const sentence = "The account turns the duties of loyalty, care, good faith and candour into criteria governing optimisation, monitoring, and disclosure.";
    assert.equal(reportedWith(sentence), true);
  });

  it("does not count an item that ends before its object", () => {
    const fed =
      "The Secretary may prohibit, or impose conditions upon, certain transmittals of funds by any domestic financial institution or domestic financial agency.";
    assert.equal(reportedWith(fed), false);
    assert.equal(reportedWith("Pay the rent if it is due, or the deposit if it is held, on or before the first of the month."), false);
    assert.equal(reportedWith("Pay the rent, the deposit and the fee on the first of the month."), true);
  });

  it("does not count the comma before a pair of adjectives set off after a noun", () => {
    const order =
      "(c) This order is not intended to, and does not, create any right or benefit, substantive or procedural, enforceable at law or in equity by any party against the United States, its departments, agencies, or entities, its officers, employees, or agents, or any other person.";
    assert.equal(reportedWith(order), false);
  });

  it("does not count the same conjunction repeated without commas", () => {
    const waller =
      "Panels today will get into all of this and, I suspect, unearth questions and issues and use cases that we haven't thought of, which is why gatherings like this one are so valuable.";
    assert.equal(reportedWith(waller), false);
    assert.equal(reportedWith("Wilderness protects fresh air, clean water and other attributes important to our physical and mental health."), true);
    assert.equal(reportedWith("We met designers, writers and engineers and they shipped the site."), true);
  });

  it("does not count an and inside the predicate after an example phrase the tagger misreads", () => {
    assert.equal(reportedWith("Financial institutions, including CDFIs, support affordable housing development through lending and investment."), false);
    assert.equal(reportedWith("Full details of the parameters, including meaning, data type and any other constraints."), true);
    assert.equal(reportedWith("We grow many fruits, including apples, pears and plums."), true);
  });

  it("does not count a list inside a quotation that marks an omission", () => {
    const jackson =
      "That authority must be matched against words of the Fifth Amendment that 'No person shall be * * * deprived of life, liberty, or property, without due process of law * * *.'";
    assert.equal(reportedWithout(jackson), false);
    assert.equal(reportedWithout('The Commission "shall monitor gaming, inspect premises, and audit records...." under the Act.'), false);
    assert.equal(reportedWithout("“FIM has been a game changer for managers, responders, and communities,” said the director."), true);
    assert.equal(reportedWithout("She said 'we need posters, cards, and calendars' at the meeting."), true);
  });
});

describe("excerptSpans", () => {
  const MARKS = ["...", "…", "* * *"];
  const spans = (text: string): string[] => excerptSpans(text, 0, text.length, MARKS).map((span) => text.slice(span.start, span.end));

  it("finds quotations, double or single, that hold an elision mark", () => {
    assert.deepEqual(spans("words that 'No person shall be * * * deprived of life' here"), ["'No person shall be * * * deprived of life'"]);
    assert.deepEqual(spans('It "may inspect, examine, and audit…" and more'), ['"may inspect, examine, and audit…"']);
    assert.deepEqual(spans("as “the licensing and regulation of...” class III"), ["“the licensing and regulation of...”"]);
  });

  it("skips quotations without one, and apostrophes inside words", () => {
    assert.deepEqual(spans("She said “we need posters, cards, and calendars” today."), []);
    assert.deepEqual(spans("It's the team's plan... and they don't mind."), []);
    assert.deepEqual(spans("the 'rule's text, as written... ' and"), []);
  });

  it("reads nothing from an empty mark list or empty text", () => {
    assert.deepEqual(excerptSpans("'a ... b'", 0, 9, []), []);
    assert.deepEqual(spans(""), []);
  });
});
