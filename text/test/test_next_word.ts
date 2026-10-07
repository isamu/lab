import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { articleSoundsOf, startsWithVowelSound } from "../packages/chaff/src/detectors/next-word.ts";

// Rules that read the word after another: article-sound (a / an) and very-adjective. Every example is self-written.

before(async () => {
  await en.prepare?.({ pos: true });
});

const findingsOf = (rule: string, source: string): readonly string[] => namedRuleRun(rule, source, en).findings;

describe("startsWithVowelSound: the sound a word starts with, from lexicon article-sound", () => {
  const sounds = articleSoundsOf(en.lexicons?.["article-sound"] ?? []);
  const soundOf = (word: string): boolean | undefined => startsWithVowelSound(word, sounds);

  it("spelling by default, the lexicon where sound and spelling disagree", () => {
    assert.deepEqual(["apple", "banana", "user", "hour", "European", "one-off", "unimportant", "onerous"].map(soundOf), [
      true,
      false,
      false,
      true,
      false,
      false,
      true,
      true,
    ]);
  });

  it("capitals letter by letter, or as a word, or both ways", () => {
    assert.deepEqual(["MBA", "URL", "X", "U", "NASA", "UNESCO", "SQL"].map(soundOf), [true, undefined, true, false, false, false, undefined]);
  });

  it("long capitals with a vowel may be a word, and H is said both ways", () => {
    assert.deepEqual(["SALT", "HTTP", "HR", "NTSB"].map(soundOf), [undefined, undefined, undefined, true]);
    assert.deepEqual(["mRNA", "iPhone", "eBay"].map(soundOf), [true, true, true]);
  });

  it("short capitals said as a word (SYN, FIN), or as the word they stand for (RST: reset)", () => {
    assert.deepEqual(["SYN", "FIN", "RST", "RCV", "SWS"].map(soundOf), [false, false, undefined, undefined, undefined]);
    assert.deepEqual(["SUV", "NBA", "FBI"].map(soundOf), [true, true, true]);
  });

  it("short capitals with a vowel said as a word (RAG, MIR, SEP) take the word's sound", () => {
    assert.deepEqual(["RAG", "MIR", "SEP"].map(soundOf), [false, false, false]);
  });
});

describe("article-sound", () => {
  const RULE = "article-sound";

  it("an article against the sound of the next word is reported", () => {
    assert.deepEqual(findingsOf(RULE, "We waited a hour.\n"), ['"a hour" takes "an" before that sound']);
    assert.deepEqual(findingsOf(RULE, "We waited a hour for an user to reply.\n"), [
      '"a hour" takes "an" before that sound',
      '"an user" takes "a" before that sound',
    ]);
    assert.deepEqual(findingsOf(RULE, "It was an one-off task with a mRNA vaccine.\n"), [
      '"an one" takes "a" before that sound',
      '"a mRNA" takes "an" before that sound',
    ]);
    assert.deepEqual(findingsOf(RULE, "A apple fell. It was a MBA course.\n"), [
      '"A apple" takes "An" before that sound',
      '"a MBA" takes "an" before that sound',
    ]);
    assert.deepEqual(findingsOf(RULE, "The peer sends an SYN and later an FIN.\n"), [
      '"an SYN" takes "a" before that sound',
      '"an FIN" takes "a" before that sound',
    ]);
  });

  it("the right article, a letter label, a digit and words said both ways are not", () => {
    const right =
      "A user waited an hour. An MBA, a NASA probe, a one-off and an X-ray. Pick option A or B. It was a 8-hour day. Run a SQL query or an SQL query. If a is zero, stop. Pass a `URL` object, an lvalue. Buy grade A eggs for vitamin A intake. It was a historic and an historic day.\n";
    assert.deepEqual(findingsOf(RULE, right), []);
  });

  it("capitals said as a word take the word's article (a SYN), and those said both ways are left alone (a RST, an RST)", () => {
    const tcp =
      "A SYN arrives first. The peer answers with a SYN and a FIN. Send a RST or an RST to abort. Keep a RCV.WND that fits, and a SWS avoidance algorithm.\n";
    assert.deepEqual(findingsOf(RULE, tcp), []);
  });

  it("an acronym said as a word takes the article of its sound (a RAG answer), not of its first letter's name", () => {
    assert.deepEqual(findingsOf(RULE, "Check a RAG answer, a MIR lvalue and a SEP plan.\n"), []);
    assert.deepEqual(findingsOf(RULE, "Check an RAG answer.\n"), ['"an RAG" takes "a" before that sound']);
  });
});

describe("very-adjective", () => {
  const RULE = "very-adjective";
  const padding = Array.from({ length: 40 }, (_unused, at) => `Item ${String(at + 1)} shipped on time and the team moved on.`).join(" ");

  it('"very" + adjective dense for the length is reported', () => {
    const source = `The launch was very important. The team was very busy and the plan was very good. ${padding}\n`;
    assert.equal(findingsOf(RULE, source).length, 3);
  });

  it('"very" before an adverb or an excepted word is not counted', () => {
    const source = `It went very well and ran very smoothly. The very first step and the very same plan took very few hours. It was very \`not\` good. It was very \`not\` important. ${padding}\n`;
    assert.deepEqual(findingsOf(RULE, source), []);
  });
});
