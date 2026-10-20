// An address the document cites to another document once ("Section 504 of the Rehabilitation Act") is that document's
// address wherever the document writes it bare ("In Section 504, …", "Section 504/501 complaints"): a reader who met the
// named form reads the bare one the same way. Pure.
import type { StructureNode } from "../plugin.ts";

/** The unit (section, article; 条) and the address. A reference without both takes no part. */
const keyOf = (node: StructureNode): string | undefined => {
  const unit = node.attrs["numbering"] ?? node.attrs["unitWord"];
  const target = node.attrs["target"];
  return unit === undefined || target === undefined || target === "" ? undefined : `${String(unit)}:${String(target)}`;
};

/** Whether a bare reference names the same unit and address as a reference the document cites to another document. */
export const citedElsewhereReader = (
  references: readonly StructureNode[],
  citesOther: (node: StructureNode) => boolean,
): ((node: StructureNode) => boolean) => {
  const cited = new Set(references.filter(citesOther).flatMap((node) => keyOf(node) ?? []));
  return (node) => {
    const key = keyOf(node);
    return key !== undefined && cited.has(key);
  };
};
