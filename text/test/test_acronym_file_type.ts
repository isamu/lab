import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { fileTypeNames } from "../packages/chaff/src/detectors/acronym-file-type.ts";

// undefined-acronym and capitals a document writes only as the name of a kind of file (the MAP files). The text is self-written.

before(async () => {
  await en.prepare?.({ pos: true });
  await ja.prepare?.({ pos: true });
});

const enDoc = (body: string): string => `# Notice\n\n${body}\n`;
const jaDoc = (body: string): string => `# お知らせ\n\n${body}\n`;

describe("undefined-acronym: capitals written only before a file noun", () => {
  it("leaves out a kind of file named by its capitals", () => {
    assert.deepEqual(reportedAcronyms(en, enDoc("The engine reads the MAP files. Each MAP file says what goes where.")), []);
    assert.deepEqual(reportedAcronyms(en, enDoc("The engine reads the MAP files, so called because they end with “.MAP”.")), []);
    assert.deepEqual(reportedAcronyms(ja, jaDoc("エンジンは MAPファイルを読みます。MAP ファイルには配置が書いてあります。")), []);
  });

  it("still reports capitals used once without a file noun, or before files as a verb", () => {
    assert.deepEqual(reportedAcronyms(en, enDoc("The WAL receiver writes a WAL file.")), ["WAL"]);
    assert.deepEqual(reportedAcronyms(en, enDoc("The SEC files a suit today.")), ["SEC"]);
    assert.deepEqual(reportedAcronyms(en, enDoc("The MAP filesystem is new.")), ["MAP"]);
    assert.deepEqual(reportedAcronyms(en, enDoc("The MAP team wrote the MAP files.")), ["MAP"]);
    assert.deepEqual(reportedAcronyms(ja, jaDoc("WALファイルは WAL 受信が書きます。")), ["WAL"]);
  });
});

describe("fileTypeNames", () => {
  const nouns = ["file", "files", "ファイル"];

  it("names the acronyms every use of which is a file noun's", () => {
    const uses = [
      { word: "MAP", preceding: " ", following: " files." },
      { word: "MAP", preceding: " ", following: "ファイルを読む", nextPos: "NOUN" },
      { word: "WAL", preceding: " ", following: " file" },
      { word: "WAL", preceding: " ", following: " receiver" },
      { word: "SEC", preceding: " ", following: " files a suit", nextPos: "VERB" },
    ];
    assert.deepEqual([...fileTypeNames(uses, nouns)], ["MAP"]);
    const misread = [
      { word: "MAP", preceding: " ", following: " files themselves", nextPos: "VERB" },
      { word: "MAP", preceding: " ", following: " files contain", nextPos: "NOUN" },
    ];
    assert.deepEqual([...fileTypeNames(misread, nouns)], ["MAP"]);
  });

  it("gives nothing for no uses, no nouns, a following word that only starts with a noun, or empty text", () => {
    assert.deepEqual([...fileTypeNames([], nouns)], []);
    assert.deepEqual([...fileTypeNames([{ word: "MAP", preceding: " ", following: " files" }], [])], []);
    assert.deepEqual([...fileTypeNames([{ word: "MAP", preceding: " ", following: " filed" }], nouns)], []);
    assert.deepEqual([...fileTypeNames([{ word: "MAP", preceding: " ", following: "" }], nouns)], []);
    assert.deepEqual([...fileTypeNames([{ word: "MAP", preceding: " ", following: "\n\nfiles" }], nouns)], []);
    assert.deepEqual([...fileTypeNames([{ word: "MAP", preceding: "“.", following: "”" }], nouns)], ["MAP"]);
    assert.deepEqual([...fileTypeNames([{ word: "MAP", preceding: "S.", following: " team" }], nouns)], []);
    assert.deepEqual([...fileTypeNames([{ word: "MAP", preceding: ".", following: "" }], nouns)], ["MAP"]);
  });
});
