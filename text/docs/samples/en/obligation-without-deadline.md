<!-- chaff-sample
rule: obligation-without-deadline
genre: legal/contract
file: design-agreement.md
-->

# A duty to act with no deadline (`obligation-without-deadline`)

**Where it helps:** service agreements, supply contracts, terms of business. Any contract where one party must pay, deliver, return or notify.

## Original

```markdown chaff-before
# Design Services Agreement

1. The Designer shall deliver the first drafts of the logo within fifteen business days of the start date.

2. The Client shall send its comments on the drafts within ten business days of receiving them.

3. The Client shall pay each invoice within thirty days of its date.

4. On termination, the Designer shall return to the Client all photographs and files that the Client supplied.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre legal/contract design-agreement.md

design-agreement.md   legal/contract · English   genre from --genre

─── line 9 ───────────────────────────────────────────────────

    return to the Client all photographs and files that the Client supplied.

  ·  A duty to act with no deadline (shall pay, shall return)

     "return" is a duty with no deadline; a time makes it one that can be met or missed
     A duty to pay, deliver, return or notify can be met or missed only once it has a time. "The Customer shall pay the fees" with no time is not breached by paying a year later. How to write limits is the drafter's choice, so chaff points only at the minority: in a document where more sentences state a limit (within seven days, by the fifth business day) than hold a duty with none, it points at those duties (each language's word list has the acts read).

     → State when the act is due: a start and a number of days ("within thirty days of termination") or a date ("by the fifth business day of each month").

     Relax this rule:  npx chaffjs relax obligation-without-deadline


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Design Services Agreement

1. The Designer shall deliver the first drafts of the logo within fifteen business days of the start date.

2. The Client shall send its comments on the drafts within ten business days of receiving them.

3. The Client shall pay each invoice within thirty days of its date.

4. Within ten business days of termination, the Designer shall return to the Client all photographs and files that the Client supplied.
```

## How it was fixed

Three of the four duties say when they fall due. The fourth, returning the client's photographs and files, does not.
Without a time it can be met at any point, so a designer who keeps the files for a year has not broken the agreement, and the client has nothing to point to.

The fix gives the duty a time in the same form as the others: a number of business days.
Now it can be met or missed, like the rest of the contract.

## Settings

The rule points only at the minority.
In a contract where more sentences state a limit ("within thirty days", "by the fifth business day") than hold a duty with none, it reports the duties with none. A contract that never states limits is taken to be written that way on purpose.
It is a note at `normal` and `relaxed`, and a warning at `strict`:

```yaml chaff-settings
rules:
  obligation-without-deadline: strict
```

It runs on contracts.
It does not run on statutes, court decisions or patents, where other provisions set the time or there is none to set.
A right ("may") and a duty that only states an amount are not read, and "promptly" alone is left to `vague-deadline`.

```text chaff-explain
$ npx chaffjs explain obligation-without-deadline --genre legal/contract

  A duty to act with no deadline (shall pay, shall return)   (obligation-without-deadline)

  A duty to pay, deliver, return or notify can be met or missed only once it has a time. "The Customer shall pay the fees" with no time is not breached by paying a year later. How to write limits is the drafter's choice, so chaff points only at the minority: in a document where more sentences state a limit (within seven days, by the fifth business day) than hold a duty with none, it points at those duties (each language's word list has the acts read).

  How to fix: State when the act is due: a start and a number of days ("within thirty days of termination") or a date ("by the fifth business day of each month").

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax obligation-without-deadline --why "reason"
```

[All samples](README.md)
