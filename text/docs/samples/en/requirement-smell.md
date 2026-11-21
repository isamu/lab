<!-- chaff-sample
rule: requirement-smell
genre: technical/spec
file: booking-spec.md
-->

# A requirement that leaves its reader to decide (`requirement-smell`)

**Where it helps:** specifications, requirements documents, acceptance criteria, contracts. Anywhere two people must agree whether something was done.

## Original

```markdown chaff-before
# Room booking: requirements

## Search

The search page must show the free rooms as fast as possible.
The results must list the room name, the floor, the number of seats, etc.

## Confirmation

The system shall send a confirmation by email and/or text message.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre technical/spec booking-spec.md

booking-spec.md   technical/spec · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    The search page must show the free rooms as fast as possible.

  ·  A requirement that leaves its reader to decide

     "as fast as possible" does not say how much is enough to meet the requirement
     A requirement in a specification or a contract must be one that any reader can check the same way. "As far as possible" and "if necessary" leave open how much is enough. "Etc." in a requirement leaves open what else it covers, and "and/or" leaves open whether both are meant or one is enough. Studies of requirements (Femmer et al. 2017; Berry et al. 2003) and ISO/IEC/IEEE 29148 all list these among the phrases to avoid. Only a sentence that states a requirement (with shall, must or is required to) is checked.

     → Rewrite it so that meeting it can be checked: "as fast as possible" becomes "within 3 seconds", "logs, etc." becomes the full list, and "A and/or B" becomes "A, B, or both".

     Relax this rule:  npx chaffjs relax requirement-smell


─── line 6 ───────────────────────────────────────────────────

    The results must list the room name, the floor, the number of seats, etc.

  ·  A requirement that leaves its reader to decide

     "etc." in a requirement does not say what else it covers
     A requirement in a specification or a contract must be one that any reader can check the same way. "As far as possible" and "if necessary" leave open how much is enough. "Etc." in a requirement leaves open what else it covers, and "and/or" leaves open whether both are meant or one is enough. Studies of requirements (Femmer et al. 2017; Berry et al. 2003) and ISO/IEC/IEEE 29148 all list these among the phrases to avoid. Only a sentence that states a requirement (with shall, must or is required to) is checked.

     → Rewrite it so that meeting it can be checked: "as fast as possible" becomes "within 3 seconds", "logs, etc." becomes the full list, and "A and/or B" becomes "A, B, or both".

     Relax this rule:  npx chaffjs relax requirement-smell


─── line 10 ──────────────────────────────────────────────────

    The system shall send a confirmation by email and/or text message.

  ·  A requirement that leaves its reader to decide

     "and/or" does not say whether both are meant or either is enough
     A requirement in a specification or a contract must be one that any reader can check the same way. "As far as possible" and "if necessary" leave open how much is enough. "Etc." in a requirement leaves open what else it covers, and "and/or" leaves open whether both are meant or one is enough. Studies of requirements (Femmer et al. 2017; Berry et al. 2003) and ISO/IEC/IEEE 29148 all list these among the phrases to avoid. Only a sentence that states a requirement (with shall, must or is required to) is checked.

     → Rewrite it so that meeting it can be checked: "as fast as possible" becomes "within 3 seconds", "logs, etc." becomes the full list, and "A and/or B" becomes "A, B, or both".

     Relax this rule:  npx chaffjs relax requirement-smell


────────────────────────────────────────────────────────────

  3 notes   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Room booking: requirements

## Search

The search page must show the free rooms within two seconds.
The results must list the room name, the floor, the number of seats and the equipment in the room.

## Confirmation

The system shall send a confirmation by email, and also by text message when the user has given a phone number.
```

## How it was fixed

A requirement is something a tester will check and a supplier will be held to.
"As fast as possible" cannot be checked: any speed can be called possible.
"Etc." leaves the list of fields open, so the developer and the tester can each be right.
"And/or" does not say whether both messages are meant or either one is enough.

The fix makes each one checkable: a time in seconds, the full list of fields, and a rule that says when the text message is sent.

## Settings

The rule reads only sentences that state a requirement (with "shall", "must" or "is required to").
It is a note at `normal` and `relaxed`, and a warning at `strict`:

```yaml chaff-settings
rules:
  requirement-smell: strict
```

It runs on specifications, contracts and documentation, not on blogs or business documents.
In a contract, "including, but not limited to" is a term of art and is not reported, and "as soon as possible" followed by a limit in numbers is bounded and not reported either.

```text chaff-explain
$ npx chaffjs explain requirement-smell --genre technical/spec

  A requirement that leaves its reader to decide   (requirement-smell)

  A requirement in a specification or a contract must be one that any reader can check the same way. "As far as possible" and "if necessary" leave open how much is enough. "Etc." in a requirement leaves open what else it covers, and "and/or" leaves open whether both are meant or one is enough. Studies of requirements (Femmer et al. 2017; Berry et al. 2003) and ISO/IEC/IEEE 29148 all list these among the phrases to avoid. Only a sentence that states a requirement (with shall, must or is required to) is checked.

  How to fix: Rewrite it so that meeting it can be checked: "as fast as possible" becomes "within 3 seconds", "logs, etc." becomes the full list, and "A and/or B" becomes "A, B, or both".

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax requirement-smell --why "reason"
```

[All samples](README.md)
