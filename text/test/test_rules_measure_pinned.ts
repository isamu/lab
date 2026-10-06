import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { missingPinned, parsePinned, pinnedOnly } from "../scripts/rules-measure-pinned.ts";
import { docEntries } from "../scripts/corpus-docs.ts";

const CORPUS = join(import.meta.dirname, "..", "corpus");
const PINNED = { statutes: ["minpo.txt"], documents: ["a", "b"] };
const law = { id: "minpo.txt", statute: true, present: true };

describe("parsePinned: the committed list of measured documents", () => {
  it("reads statutes and documents", () => {
    assert.deepEqual(parsePinned(JSON.stringify(PINNED), "f.json"), PINNED);
    assert.deepEqual(parsePinned('{"statutes":[],"documents":[]}', "f.json"), { statutes: [], documents: [] });
  });

  it("names the file when the shape is wrong", () => {
    ["{}", "[]", "null", '{"statutes":["x"]}', '{"statutes":[1],"documents":[]}', '{"statutes":[],"documents":[""]}'].forEach((text) =>
      assert.throws(() => parsePinned(text, "f.json"), /f\.json/),
    );
    assert.throws(() => parsePinned("not json", "f.json"));
  });
});

describe("missingPinned: a pinned document not on this machine", () => {
  it("nothing when every pinned one is present, extra ones notwithstanding", () => {
    const candidates = [
      law,
      { id: "a", statute: false, present: true },
      { id: "b", statute: false, present: true },
      { id: "c", statute: false, present: false },
    ];
    assert.deepEqual(missingPinned(candidates, PINNED), []);
  });

  it("a pinned document whose text was not fetched, or that the manifest no longer has", () => {
    const candidates = [law, { id: "a", statute: false, present: false }];
    assert.deepEqual(missingPinned(candidates, PINNED), ["document a", "document b"]);
  });

  it("a statute and a document of the same name are different entries", () => {
    const candidates = [
      { id: "a", statute: true, present: true },
      { id: "minpo.txt", statute: false, present: true },
    ];
    assert.deepEqual(missingPinned(candidates, PINNED), ["statute minpo.txt", "document a", "document b"]);
  });
});

describe("pinnedOnly: what the measurement runs", () => {
  it("keeps the pinned candidates in their order and leaves the rest out", () => {
    const candidates = [
      { id: "c", statute: false, present: true },
      { id: "b", statute: false, present: true },
      law,
      { id: "a", statute: false, present: true },
    ];
    assert.deepEqual(
      pinnedOnly(candidates, PINNED).map((candidate) => candidate.id),
      ["b", "minpo.txt", "a"],
    );
    assert.deepEqual(pinnedOnly(candidates, { statutes: [], documents: [] }), []);
  });
});

describe("corpus/rules-measure-documents.json", () => {
  it("pins only documents the manifest has, each once", () => {
    const file = join(CORPUS, "rules-measure-documents.json");
    const pinned = parsePinned(readFileSync(file, "utf8"), file);
    const ids = new Set(docEntries(JSON.parse(readFileSync(join(CORPUS, "manifest.json"), "utf8"))).map((entry) => entry.id));
    assert.deepEqual(
      pinned.documents.filter((id) => !ids.has(id)),
      [],
    );
    assert.deepEqual(
      pinned.statutes.filter((file) => !existsSync(join(CORPUS, "laws", file))),
      [],
    );
    assert.equal(new Set(pinned.documents).size, pinned.documents.length);
    assert.equal(new Set(pinned.statutes).size, pinned.statutes.length);
  });
});
