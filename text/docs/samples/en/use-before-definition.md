<!-- chaff-sample
rule: use-before-definition
genre: legal/contract
file: lease.md
-->

# Term used before it is defined (`use-before-definition`)

**Where it helps:** contracts, leases, agreements. Any document that defines its terms as it goes, as in (the "Seller").

## Original

```markdown chaff-before
# Equipment Lease

The Lessee will return the equipment in good working order at the end of the term, and the Lessor will refund the deposit within 14 days.

This lease is made between Coastline Rentals Ltd (the "Lessor") and Meadow Studio Ltd (the "Lessee").
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre legal/contract lease.md

lease.md   legal/contract · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    Lessee will return the equipment in good working order at the end of the term, a

  ·  Term used before it is defined

     "Lessee" is used here, before it is defined on line 5
     A term defined in passing, as in (the "Seller"), and used before that point makes the reader meet a word whose meaning has not been given yet. The earlier use is usually a sentence added later, in front of a definition that stayed where it was.

     → Move the definition to the first use, or reword the earlier sentence without the defined term.

     Relax this rule:  npx chaffjs relax use-before-definition


─── line 3 ───────────────────────────────────────────────────

    Lessor will refund the deposit within 14 days.

  ·  Term used before it is defined

     "Lessor" is used here, before it is defined on line 5
     A term defined in passing, as in (the "Seller"), and used before that point makes the reader meet a word whose meaning has not been given yet. The earlier use is usually a sentence added later, in front of a definition that stayed where it was.

     → Move the definition to the first use, or reword the earlier sentence without the defined term.

     Relax this rule:  npx chaffjs relax use-before-definition


────────────────────────────────────────────────────────────

  2 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Equipment Lease

This lease is made between Coastline Rentals Ltd (the "Lessor") and Meadow Studio Ltd (the "Lessee").

The Lessee will return the equipment in good working order at the end of the term, and the Lessor will refund the deposit within 14 days.
```

## How it was fixed

The first sentence talks about the Lessee and the Lessor. Who they are is only said in the next sentence.
A reader meets two capitalised words with no meaning yet, and has to read on and come back.
The first sentence was added later, in front of the definition.

The fix moves the sentence that defines the parties to the top.
Terms defined in a definitions clause ("X" means ...) are not checked, since such a clause may come first or last.

## Settings

A term used before its definition is a note at the default level and a warning at `strict`; `relaxed` keeps it a note.

If your documents name the parties in a heading or a cover page first, turn it off:

```yaml chaff-settings
rules:
  use-before-definition: off
```

```text chaff-explain
$ npx chaffjs explain use-before-definition --genre legal/contract

  Term used before it is defined   (use-before-definition)

  A term defined in passing, as in (the "Seller"), and used before that point makes the reader meet a word whose meaning has not been given yet. The earlier use is usually a sentence added later, in front of a definition that stayed where it was.

  How to fix: Move the definition to the first use, or reword the earlier sentence without the defined term.

  Rewrite depth: structure (sections, headings and paragraphs are reorganised). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax use-before-definition --why "reason"
```

[All samples](README.md)
