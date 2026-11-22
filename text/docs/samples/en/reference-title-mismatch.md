<!-- chaff-sample
rule: reference-title-mismatch
genre: legal/contract
file: maintenance-agreement.md
-->

# A reference whose name does not match its target's heading (`reference-title-mismatch`)

**Where it helps:** contracts, terms of service, policies and manuals that refer to their own sections by number and name.

## Original

```markdown chaff-before
# Website maintenance agreement

## 1. Services

The Provider keeps the Client's website up to date, backed up and secure, as listed in Schedule A.

## 2. Fees

The Client pays $450 each month, invoiced on the first business day of the month. Fees already paid are not refunded when this agreement ends under Section 4 (Termination).

## 3. Termination

Either party may end this agreement by giving the other 30 days' notice in writing.

## 4. Liability

The Provider's total liability in any year is limited to the fees paid in that year.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre legal/contract maintenance-agreement.md

maintenance-agreement.md   legal/contract · English   genre from --genre

─── line 9 ───────────────────────────────────────────────────

    Termination).

  ·  A reference whose name does not match its target's heading

     Section 4 is called "Termination" here, but its heading is "Liability"
     When "Section 5 (Confidentiality)" points at a Section 5 headed "Liability", the reader cannot tell whether the number or the name is right. It happens when sections are added or removed and the numbers shift, but the references are not updated. The name in brackets or quotes right after a reference is compared with the target's heading; they agree when either contains the other.

     → Check whether the number or the name is right and correct the other. If the numbers shifted, check the other references too.

     Relax this rule:  npx chaffjs relax reference-title-mismatch


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Website maintenance agreement

## 1. Services

The Provider keeps the Client's website up to date, backed up and secure, as listed in Schedule A.

## 2. Fees

The Client pays $450 each month, invoiced on the first business day of the month. Fees already paid are not refunded when this agreement ends under Section 3 (Termination).

## 3. Termination

Either party may end this agreement by giving the other 30 days' notice in writing.

## 4. Liability

The Provider's total liability in any year is limited to the fees paid in that year.
```

## How it was fixed

Section 2 refers to "Section 4 (Termination)", but Section 4 is Liability; termination is Section 3.
The agreement probably had another section once, and the numbers shifted when it was removed.
A reader cannot tell whether the number or the name is right, and in a contract that can decide what a clause means.

The fix keeps the name and corrects the number.
If the numbers shifted, check the other references too.
The name is compared with the target's heading; they agree when either contains the other.

## Settings

A reference whose name does not match its heading is a note at the default and at `relaxed`.

To stop checking it, turn it off:

```yaml chaff-settings
rules:
  reference-title-mismatch: off
```

```text chaff-explain
$ npx chaffjs explain reference-title-mismatch --genre legal/contract

  A reference whose name does not match its target's heading   (reference-title-mismatch)

  When "Section 5 (Confidentiality)" points at a Section 5 headed "Liability", the reader cannot tell whether the number or the name is right. It happens when sections are added or removed and the numbers shift, but the references are not updated. The name in brackets or quotes right after a reference is compared with the target's heading; they agree when either contains the other.

  How to fix: Check whether the number or the name is right and correct the other. If the numbers shifted, check the other references too.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax reference-title-mismatch --why "reason"
```

[All samples](README.md)
