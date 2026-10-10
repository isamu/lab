/**
 * A role word in the plural with nothing before it at the head of a sentence (Customers who register …, Buyers may …) is
 * the ordinary noun, capitalised because it opens the sentence. A contract that calls a party by its role writes it in the
 * singular (Vendor shall …) or with an article (the Vendors).
 */
const PLURAL = /^s(?![\p{L}\p{N}'’])/u;

export const isGenericPlural = (bare: boolean, after: string): boolean => bare && PLURAL.test(after);
