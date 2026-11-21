<!-- chaff-sample
rule: unused-definition
genre: legal/contract
file: nda.md
-->

# Term defined but never used (`unused-definition`)

**Where it helps:** contracts, NDAs, terms of service. Any document with a definitions section.

## Original

```markdown chaff-before
# Mutual Non-Disclosure Agreement

## 1. Definitions

"Confidential Information" means any information one party gives the other about its business.

"Purpose" means discussing a possible joint venture between the parties.

## 2. Use

Each party will use the other party's Confidential Information only to evaluate the joint venture.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre legal/contract nda.md

nda.md   legal/contract · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    "Purpose" means discussing a possible joint venture between the parties.

  ·  Term defined but never used

     "Purpose" is defined but never used
     A term defined and then never used makes the reader learn it for nothing. Usually the body was reworded to another word and the definition stayed behind, so check whether the body now uses a different word for the same thing.

     → Delete the definition if nothing uses it. If the body calls the same thing by another word, use one of the two throughout.

     Relax this rule:  npx chaffjs relax unused-definition


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Mutual Non-Disclosure Agreement

## 1. Definitions

"Confidential Information" means any information one party gives the other about its business.

"Purpose" means discussing a possible joint venture between the parties.

## 2. Use

Each party will use the other party's Confidential Information only for the Purpose.
```

## How it was fixed

"Purpose" is defined but never used: the body says "to evaluate the joint venture" instead.
A reader learns the definition for nothing, and a careful one starts to wonder whether "evaluating" and "discussing" are meant to be different things.
Usually the body was reworded after the definitions were written.

The fix uses the defined term where the body means it.
The other fix is to delete the definition, if nothing needs it.
Plurals and possessives count as uses.

## Settings

A definition nothing uses is a note at the default level and a warning at `strict`; `relaxed` keeps it a note.

If your definitions come from a standard list that every agreement carries, turn it off:

```yaml chaff-settings
rules:
  unused-definition: off
```

It is off for glossaries, which define terms for other documents.

```text chaff-explain
$ npx chaffjs explain unused-definition --genre legal/contract

  Term defined but never used   (unused-definition)

  A term defined and then never used makes the reader learn it for nothing. Usually the body was reworded to another word and the definition stayed behind, so check whether the body now uses a different word for the same thing.

  How to fix: Delete the definition if nothing uses it. If the body calls the same thing by another word, use one of the two throughout.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax unused-definition --why "reason"
```

[All samples](README.md)
