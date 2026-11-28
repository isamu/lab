// An address the document cites to another document once ("Section 504 of the Rehabilitation Act") is that document's
// address wherever the document writes it bare ("In Section 504, …", "Section 504/501 complaints"): a reader who met the
// named form reads the bare one the same way. So is a part of that unit ("§111(a)" after "§111(c) of the Act") when the
// document has no unit of that number of its own. Pure.
import type { StructureNode } from "../plugin.ts";

/** The unit (section, article; 条) and the address. A reference without both takes no part. */
const keyOf = (node: StructureNode, address: (target: string) => string = (target) => target): string | undefined => {
  const unit = node.attrs["numbering"] ?? node.attrs["unitWord"];
  const target = node.attrs["target"];
  return unit === undefined || target === undefined || target === "" ? undefined : `${String(unit)}:${address(String(target))}`;
};

/** The top unit of an address: 111 of 111.a.1. */
const topOf = (target: string): string => target.split(".")[0] ?? target;

/**
 * Whether a bare reference names the same unit and address as a reference the document cites to another document, or a
 * part of a unit cited there whose number the document does not hold itself (own says whether an address is the document's).
 */
export const citedElsewhereReader = (
  references: readonly StructureNode[],
  citesOther: (node: StructureNode) => boolean,
  own: (address: string) => boolean = () => true,
): ((node: StructureNode) => boolean) => {
  const named = references.filter(citesOther);
  const cited = new Set(named.flatMap((node) => keyOf(node) ?? []));
  const citedTops = new Set(named.flatMap((node) => keyOf(node, topOf) ?? []));
  return (node) => {
    const key = keyOf(node);
    if (key === undefined) return false;
    const top = topOf(String(node.attrs["target"]));
    return cited.has(key) || (!own(top) && citedTops.has(keyOf(node, topOf) ?? ""));
  };
};
