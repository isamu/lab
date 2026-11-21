<!-- chaff-sample
rule: defined-name-repeated
genre: legal/contract
file: agreement.md
-->

# A long name used again after its short name was defined (`defined-name-repeated`)

**Where it helps:** contracts, agreements, terms of service. Any document that gives a party a short name and then has to keep to it.

## Original

```markdown chaff-before
# Cleaning Services Agreement

This agreement is made between Brookside Medical Centre (the "Client") and Clearwater Cleaning Ltd (the "Contractor").

## 1. Services

1.1 The Contractor shall clean the waiting room, the consulting rooms and the corridors every weekday evening after 7 pm.

1.2 The Client shall give the Contractor keys to the building and the code for the alarm.

## 2. Payment

2.1 Brookside Medical Centre shall pay a monthly fee of £1,800, within 30 days of each invoice.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre legal/contract agreement.md

agreement.md   legal/contract · English   genre from --genre

─── line 13 ──────────────────────────────────────────────────

    Brookside Medical Centre shall pay a monthly fee of £1,800, within 30 days of ea

  ·  A long name used again after its short name was defined

     "Brookside Medical Centre" was given the short name "Client" on line 3
     Once a contract says "Harbour Works Ltd (the "Supplier")", it refers to the Supplier as "the Supplier". Writing "Harbour Works Ltd" again later makes the reader check whether it is the same party in the same role. chaff takes the name right before an inline definition's bracket (a run of nouns and names) as the long name, and points at each later use of it. Lines that give the short name too, little more than the name (a signature block), a field whose value is the name (Attention: Harbour Works Ltd, Legal Department), or a signature at the end with no label, the name and the parts of an address (Harbour Works Ltd, Customer Support) are not read. A field whose label is a contact label (Contact:, Attention:) is not read however long its value or wherever the name sits in it, unless the name goes on as a sentence.

     → Use the short name the contract defined. Where the full name is needed (a signature block, a list beside other companies), leave it.

     Relax this rule:  npx chaffjs relax defined-name-repeated


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Cleaning Services Agreement

This agreement is made between Brookside Medical Centre (the "Client") and Clearwater Cleaning Ltd (the "Contractor").

## 1. Services

1.1 The Contractor shall clean the waiting room, the consulting rooms and the corridors every weekday evening after 7 pm.

1.2 The Client shall give the Contractor keys to the building and the code for the alarm.

## 2. Payment

2.1 The Client shall pay a monthly fee of £1,800, within 30 days of each invoice.
```

## How it was fixed

The opening gives the medical centre the short name "the Client", and the services clause uses it.
The payment clause goes back to the full name.
A reader checking the contract asks whether the fee is owed by the Client in that role, or by the medical centre in some other capacity, perhaps under a separate agreement or on behalf of another practice.

The fix uses "the Client", the name the contract defined.
Where the full name is needed, in the signature block or a list beside other companies, leave it: chaff does not read a line that holds little more than the name.

## Settings

The rule gives a note at `normal` and `relaxed`, and a warning at `strict`.
Uses before the short name is defined, a line that also gives the short name and a contact field ("Attention: Brookside Medical Centre") are not reported.

To stop checking:

```yaml chaff-settings
rules:
  defined-name-repeated: off
```

It runs only on legal texts; manuals, papers, literature and speeches are not read.

```text chaff-explain
$ npx chaffjs explain defined-name-repeated --genre legal/contract

  A long name used again after its short name was defined   (defined-name-repeated)

  Once a contract says "Harbour Works Ltd (the "Supplier")", it refers to the Supplier as "the Supplier". Writing "Harbour Works Ltd" again later makes the reader check whether it is the same party in the same role. chaff takes the name right before an inline definition's bracket (a run of nouns and names) as the long name, and points at each later use of it. Lines that give the short name too, little more than the name (a signature block), a field whose value is the name (Attention: Harbour Works Ltd, Legal Department), or a signature at the end with no label, the name and the parts of an address (Harbour Works Ltd, Customer Support) are not read. A field whose label is a contact label (Contact:, Attention:) is not read however long its value or wherever the name sits in it, unless the name goes on as a sentence.

  How to fix: Use the short name the contract defined. Where the full name is needed (a signature block, a list beside other companies), leave it.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax defined-name-repeated --why "reason"
```

[All samples](README.md)
