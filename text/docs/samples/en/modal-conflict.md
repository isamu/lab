<!-- chaff-sample
rule: modal-conflict
genre: legal/contract
file: services-agreement.md
-->

# Opposite obligations on the same act (`modal-conflict`)

**Where it helps:** contracts, policies, staff rules. Any document long enough for two clauses to say opposite things.

## Original

```markdown chaff-before
# Consulting Services Agreement

## 4. Personnel

The Consultant must not subcontract the Services to a third party.

## 5. Resources

The Consultant may subcontract the Services to a third party.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre legal/contract services-agreement.md

services-agreement.md   legal/contract · English   genre from --genre

─── line 9 ───────────────────────────────────────────────────

    The Consultant may subcontract the Services to a third party.

  ⚠  Opposite obligations on the same act

     This says "may", but line 5 says "must not" about the same act
     The same act by the same party written as "must" or "may" in one sentence and "must not" in another leaves the reader unable to tell which to follow. It happens when a clause is added later or copied from another document. A condition or an exception changes the sentence's words, so a carefully scoped pair is not reported.

     → Decide which one holds and delete the other, or add the condition or exception ("unless the Customer agrees in writing") that separates them.

     Relax this rule:  npx chaffjs relax modal-conflict


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Consulting Services Agreement

## 4. Personnel

The Consultant must not subcontract the Services to a third party without the Client's written consent.

## 5. Resources

The Consultant may subcontract the Services to a third party with the Client's written consent.
```

## How it was fixed

Section 4 says the Consultant must not subcontract the work. Section 5 says the Consultant may.
The two sentences are about the same act by the same party, and they cannot both hold.
Section 5 was probably taken from another agreement, where subcontracting was allowed.

The fix decides which one holds and adds the condition that separates them: subcontracting needs the Client's written consent.
The other fix is to delete one of the two sentences.
chaff compares only sentences with the same content words, so a pair that is already scoped by a condition is not reported.

## Settings

Conflicting duties are a warning at the default level; `strict` makes it an error and `relaxed` a note.

If your documents state a rule and its opposite on purpose (a policy that lists what one group may and another must not do in separate sections), relax it:

```yaml chaff-settings
rules:
  modal-conflict: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain modal-conflict --genre legal/contract

  Opposite obligations on the same act   (modal-conflict)

  The same act by the same party written as "must" or "may" in one sentence and "must not" in another leaves the reader unable to tell which to follow. It happens when a clause is added later or copied from another document. A condition or an exception changes the sentence's words, so a carefully scoped pair is not reported.

  How to fix: Decide which one holds and delete the other, or add the condition or exception ("unless the Customer agrees in writing") that separates them.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax modal-conflict --why "reason"
```

[All samples](README.md)
