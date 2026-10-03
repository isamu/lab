// Splitting a list of jobs across several workers, and putting their results back in the jobs' order.

/** The number of hands a list is dealt into: at least one, and no more than there are items. */
const handCount = (items: number, hands: number): number => (Number.isInteger(hands) && hands > 1 ? Math.min(hands, Math.max(items, 1)) : 1);

/** Item k goes to hand k % hands, like cards: hands of near-equal size, and a sorted list spread over all of them. */
export const deal = <T>(items: readonly T[], hands: number): T[][] => {
  const count = handCount(items.length, hands);
  return Array.from({ length: count }, (_, hand) => items.filter((_, index) => index % count === hand));
};

const sizesOf = (hands: readonly (readonly unknown[])[]): string => hands.map((hand) => hand.length).join(", ");

/** The inverse of deal: one result per item of each hand, put back in the order the items were dealt in. */
export const undeal = <T>(hands: readonly (readonly T[])[], total: number): T[] => {
  const expected = deal(
    Array.from({ length: total }, (_, index) => index),
    hands.length,
  );
  if (sizesOf(expected) !== sizesOf(hands))
    throw new Error(`undeal: ${total} items dealt into hands of ${sizesOf(expected)}, but the hands hold ${sizesOf(hands)}`);
  return Array.from({ length: total }, (_, index) => index).flatMap((index) => {
    const place = Math.floor(index / hands.length);
    return hands[index % hands.length]?.slice(place, place + 1) ?? [];
  });
};
