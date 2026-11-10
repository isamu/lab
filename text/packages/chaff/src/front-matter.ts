/** YAML の 1 行の値。行末のコメントと、値を囲む引用符を外す。 */
const scalarOf = (raw: string): string => {
  const comment = raw.search(/\s#/u);
  const value = (comment === -1 ? raw : raw.slice(0, comment)).trim();
  return /^(["'])(.*)\1$/u.exec(value)?.[2] ?? value;
};

const valuesOf = (block: string, key: string): string[] => [...block.matchAll(new RegExp(`^${key}:(.*)$`, "gmu"))].map((line) => scalarOf(line[1] ?? ""));

/** front matter の 1 つの欄に書かれた値。front matter が無ければ空。 */
export const frontMatterValues = (source: string, key: string): string[] => {
  const block = /^---\n([\s\S]*?)\n---/u.exec(source)?.[1];
  return block === undefined ? [] : valuesOf(block, key);
};
