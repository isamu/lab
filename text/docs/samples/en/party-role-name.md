<!-- chaff-sample
rule: party-role-name
genre: legal/contract
file: supply.md
-->

# A party named by its role instead of the name the contract gave it (`party-role-name`)

**Where it helps:** contracts, purchase terms, service agreements. Especially a contract assembled from clauses of other templates.

## Original

```markdown chaff-before
# Supply Agreement

This agreement is made between Greenleaf Cafés Ltd (the "Buyer") and Millbrook Dairy Ltd (the "Supplier").

## 1. Deliveries

1.1 The Supplier shall deliver milk and cream to each café before 7 am on every weekday.

1.2 The Buyer shall check each delivery and report any shortfall the same day.

## 2. Quality

2.1 The Vendor shall replace any product that is past its date when delivered, at no cost to the Buyer.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre legal/contract supply.md

supply.md   legal/contract · English   genre from --genre

─── line 13 ──────────────────────────────────────────────────

    Vendor shall replace any product that is past its date when delivered, at no cos

  ·  A party named by its role instead of the name the contract gave it

     "Vendor" is not a name this contract gave a party (Buyer, Supplier)
     Once a contract says "Harbour Works Ltd (the "Supplier")", writing "the Vendor" later makes the reader check whether the Supplier is meant or someone else, such as a subcontractor. It happens when clauses from another template are pasted in with that template's names. In a document that gives its parties short names in brackets, chaff points at each later role word (the Vendor, the Recipient, the Company, 受託者, 売主) that the document did not define. The words are in each language's word list.

     → Use the name the contract gave the party. If someone else is meant, define them first.

     Relax this rule:  npx chaffjs relax party-role-name


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Supply Agreement

This agreement is made between Greenleaf Cafés Ltd (the "Buyer") and Millbrook Dairy Ltd (the "Supplier").

## 1. Deliveries

1.1 The Supplier shall deliver milk and cream to each café before 7 am on every weekday.

1.2 The Buyer shall check each delivery and report any shortfall the same day.

## 2. Quality

2.1 The Supplier shall replace any product that is past its date when delivered, at no cost to the Buyer.
```

## How it was fixed

The contract names the dairy "the Supplier", but the quality clause, taken from another template, says "the Vendor".
No one in this contract is called the Vendor.
The café chain may assume it means the dairy; the dairy may argue it means someone else, a distributor or a subcontractor, and that the duty to replace stale stock is not its own.

The fix uses "the Supplier", the name the contract gave the dairy.
If another party really were meant, it would have to be named and defined first.

## Settings

The rule gives a note at `normal` and `relaxed`, and a warning at `strict`.
It reads only a document that gives its parties short names in brackets.
A role word the document defines itself, a role word in lower case ("a vendor"), and a role word inside a defined term ("Receiving Party") are not reported.

To stop checking:

```yaml chaff-settings
rules:
  party-role-name: off
```

It runs only on legal texts, and not on statutes, which name people by their role on purpose.

```text chaff-explain
$ npx chaffjs explain party-role-name --genre legal/contract

  A party named by its role instead of the name the contract gave it   (party-role-name)

  Once a contract says "Harbour Works Ltd (the "Supplier")", writing "the Vendor" later makes the reader check whether the Supplier is meant or someone else, such as a subcontractor. It happens when clauses from another template are pasted in with that template's names. In a document that gives its parties short names in brackets, chaff points at each later role word (the Vendor, the Recipient, the Company, 受託者, 売主) that the document did not define. The words are in each language's word list.

  How to fix: Use the name the contract gave the party. If someone else is meant, define them first.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax party-role-name --why "reason"
```

[All samples](README.md)
