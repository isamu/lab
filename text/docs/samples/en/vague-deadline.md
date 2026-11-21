<!-- chaff-sample
rule: vague-deadline
genre: legal/contract
file: cleaning-agreement.md
-->

# A time limit left to the reader (`vague-deadline`)

**Where it helps:** service agreements, supply contracts, leases. Any contract where one party must do something in time.

## Original

```markdown chaff-before
# Office Cleaning Agreement

1. The Contractor shall clean the premises every weekday evening after 18:00.

2. The Contractor shall send an invoice by the third business day of each month.

3. The Client shall pay each invoice within fourteen days of receiving it.

4. The Contractor shall replace any damaged equipment promptly.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre legal/contract cleaning-agreement.md

cleaning-agreement.md   legal/contract · English   genre from --genre

─── line 9 ───────────────────────────────────────────────────

    promptly.

  ·  A time limit left to the reader (promptly)

     "promptly" sets no deadline; a number of days makes it one that can be met or missed
     An obligation written with "promptly" or "without undue delay" alone lets each party read the deadline its own way, and a dispute has no measure of whether it was met. A number ("within seven days of receiving notice") reads the same to everyone. How to write limits is the drafter's choice, so chaff points only at the minority: in a document where more sentences state a limit in numbers (days, business days) than hold a word that leaves the limit to the reader (each language's word list has them), it points at those words, unless their own sentence states a number too.

     → Write the limit as a start and a number of days ("within seven days of receiving notice"). To stress urgency too, add the number: "promptly, and in any case within seven days".

     Relax this rule:  npx chaffjs relax vague-deadline


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Office Cleaning Agreement

1. The Contractor shall clean the premises every weekday evening after 18:00.

2. The Contractor shall send an invoice by the third business day of each month.

3. The Client shall pay each invoice within fourteen days of receiving it.

4. The Contractor shall replace any damaged equipment within five business days of the damage being reported.
```

## How it was fixed

"Promptly" lets each party read the deadline its own way.
The client may expect new equipment the next morning; the contractor may think two weeks is prompt for a part on order.
If it comes to a dispute, there is no measure of whether the clause was met.

The rest of this agreement already writes its limits in days, so the fix does the same: five business days, counted from when the damage is reported.
To keep the sense of urgency, it could also say "promptly, and in any case within five business days".

## Settings

The rule points only at the minority.
In a contract where more sentences state a limit in numbers than hold a vague one ("promptly", "without undue delay"), it reports the vague ones. A contract that writes all its limits that way is taken to do so on purpose.
It is a note at `normal` and `relaxed`, and a warning at `strict`:

```yaml chaff-settings
rules:
  vague-deadline: strict
```

It runs on contracts.
It does not run on statutes, where "promptly" and "without delay" are terms of art, or on court decisions and patents.
A sentence that also gives a number, and a right ("We may promptly suspend"), are not reported.

```text chaff-explain
$ npx chaffjs explain vague-deadline --genre legal/contract

  A time limit left to the reader (promptly)   (vague-deadline)

  An obligation written with "promptly" or "without undue delay" alone lets each party read the deadline its own way, and a dispute has no measure of whether it was met. A number ("within seven days of receiving notice") reads the same to everyone. How to write limits is the drafter's choice, so chaff points only at the minority: in a document where more sentences state a limit in numbers (days, business days) than hold a word that leaves the limit to the reader (each language's word list has them), it points at those words, unless their own sentence states a number too.

  How to fix: Write the limit as a start and a number of days ("within seven days of receiving notice"). To stress urgency too, add the number: "promptly, and in any case within seven days".

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax vague-deadline --why "reason"
```

[All samples](README.md)
