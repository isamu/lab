import type { FileKind, StackAdapter, StackDetection } from "../plugin.ts";
import { readPackageJson, hasDependency } from "../package-json.ts";

/**
 * react は .tsx / .jsx の扱いを ts stack と共有するため、分類には何も足さない。
 * 独立した stack として持つのは、検出結果を設定に凍結するためと、
 * 今後 UI 次元の probe（design token、component shape）が react 固有の知識を要するため。
 */
const classify = (): FileKind => "ignored";

const detect = async (root: string): Promise<StackDetection> => {
  const pkg = await readPackageJson(root);
  const evidence = ["react", "next"].filter((name) => hasDependency(pkg, name)).map((name) => `dependencies.${name}`);
  return { matched: evidence.length > 0, confidence: evidence.length > 0 ? 1 : 0, evidence };
};

export const stackReact: StackAdapter = { kind: "stack", id: "react", apiVersion: 1, detect, classify };
