import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { posix } from "node:path";
import { dirname, extname, isAbsolute, join, normalize, relative, resolve, sep } from "../packages/chaff/src/browser/path.ts";

// The browser's node:path against Node's posix one, on paths made from the pieces that change the answer: slashes at
// either end and doubled, ".", "..", dots inside and at the start of a name, and the empty path.

const PIECES = ["", ".", "..", "a", "b.md", ".hidden", "c.d.e", "..x", "x..", "...", "/"];

const pathsOf = (length: number): string[] =>
  length === 0 ? [""] : pathsOf(length - 1).flatMap((head) => PIECES.flatMap((piece) => [`${head}${piece}`, `${head}/${piece}`]));

const PATHS = [...new Set([...pathsOf(1), ...pathsOf(2), ...pathsOf(3)])];

/** Every pair from a spread of the paths, so the two-argument functions see each shape on both sides. */
const PAIRS = PATHS.filter((_, index) => index % 7 === 0).flatMap((left) =>
  PATHS.filter((_, index) => index % 11 === 0).map((right): [string, string] => [left, right]),
);

const sameAs = (name: string, ours: (path: string) => unknown, node: (path: string) => unknown): void => {
  PATHS.forEach((path) => assert.equal(ours(path), node(path), `${name}(${JSON.stringify(path)})`));
};

describe("browser path: the same answers as node:path posix", () => {
  it("has many paths to compare", () => assert.ok(PATHS.length > 1000 && PAIRS.length > 1000));
  it("sep", () => assert.equal(sep, posix.sep));
  it("normalize", () => sameAs("normalize", normalize, posix.normalize));
  it("isAbsolute", () => sameAs("isAbsolute", isAbsolute, posix.isAbsolute));
  it("dirname", () => sameAs("dirname", dirname, posix.dirname));
  it("extname", () => sameAs("extname", extname, posix.extname));
  it("resolve from / (the browser's working folder)", () => sameAs("resolve", resolve, (path) => posix.resolve("/", path)));
  it("join of two", () => PAIRS.forEach(([left, right]) => assert.equal(join(left, right), posix.join(left, right), `join(${left}, ${right})`)));
  it("join of three", () => PAIRS.forEach(([left, right]) => assert.equal(join(left, right, left), posix.join(left, right, left))));
  it("resolve of two", () =>
    PAIRS.forEach(([left, right]) => assert.equal(resolve(left, right), posix.resolve("/", left, right), `resolve(${left}, ${right})`)));
  it("relative", () => PAIRS.forEach(([left, right]) => assert.equal(relative(`/${left}`, right), posix.relative(`/${left}`, posix.resolve("/", right)))));
});
