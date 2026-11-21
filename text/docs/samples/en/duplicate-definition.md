<!-- chaff-sample
rule: duplicate-definition
genre: legal/contract
file: terms.md
-->

# Term defined twice (`duplicate-definition`)

**Where it helps:** contracts, terms of service, policies. Any document with a definitions section that grows over several drafts.

## Original

```markdown chaff-before
# Terms of Use

## 1. Definitions

"Account" means the profile a user creates to book classes.

## 2. Booking

A user may book up to four classes a week.

## 3. Cancellation

"Account" means the profile and the payment card a user registers with us. A user may cancel a class from the Account up to 12 hours before it starts.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre legal/contract terms.md

terms.md   legal/contract · English   genre from --genre

─── line 13 ──────────────────────────────────────────────────

    "Account" means the profile and the payment card a user registers with us. A use

  ⚠  Term defined twice

     "Account" is also defined on line 5
     A term defined in two places makes the reader check whether the two definitions agree. In long contracts a definition added later often drifts from the first. Whether they conflict is not something a machine can decide, so chaff only points at the second one. A heading that names the term is not counted as a definition.

     → Keep one definition and refer to it from the other place. If the meaning changes on purpose, use a different term.

     Relax this rule:  npx chaffjs relax duplicate-definition


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Terms of Use

## 1. Definitions

"Account" means the profile and the payment card a user registers with us.

## 2. Booking

A user may book up to four classes a week.

## 3. Cancellation

A user may cancel a class from the Account up to 12 hours before it starts.
```

## How it was fixed

"Account" is defined in section 1 and again in section 3, and the two definitions differ: the second adds the payment card.
A reader has to stop and decide which one counts, and in a dispute about a charge that is the question both sides will ask.

This happens when a clause is reworded and a new definition is written next to it, while the old one in the definitions section stays.
chaff cannot tell whether two definitions conflict, so it points at the second one.
The fix keeps a single definition, in the definitions section, and lets section 3 use the term.

## Settings

A term defined twice is a warning at the default level; `strict` makes it an error and `relaxed` a note.

If your documents repeat a definition on purpose (a policy that restates it in each chapter), relax it:

```yaml chaff-settings
rules:
  duplicate-definition: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

It is off for literature.

```text chaff-explain
$ npx chaffjs explain duplicate-definition --genre legal/contract

  Term defined twice   (duplicate-definition)

  A term defined in two places makes the reader check whether the two definitions agree. In long contracts a definition added later often drifts from the first. Whether they conflict is not something a machine can decide, so chaff only points at the second one. A heading that names the term is not counted as a definition.

  How to fix: Keep one definition and refer to it from the other place. If the meaning changes on purpose, use a different term.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax duplicate-definition --why "reason"
```

[All samples](README.md)
