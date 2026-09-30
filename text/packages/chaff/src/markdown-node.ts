import type { Span } from "./plugin.ts";

type Place = { readonly offset?: number | undefined };

/** The part of an mdast node chaff reads. */
export type MarkdownNode = {
  readonly type: string;
  readonly url?: string | undefined;
  readonly value?: string | undefined;
  readonly identifier?: string | undefined;
  readonly position?: { readonly start: Place; readonly end: Place } | undefined;
  readonly children?: readonly MarkdownNode[] | undefined;
};

export const spanOf = (node: MarkdownNode): Span | undefined => {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return start === undefined || end === undefined ? undefined : { start, end };
};
