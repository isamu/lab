<!-- chaff-sample
rule: date-stamp-order
genre: legal/contract
file: privacy-policy.md
-->

# An established date after the last update (`date-stamp-order`)

**Where it helps:** privacy policies, terms of use, house rules, internal regulations. Any document that ends with when it was first set and when it was last changed.

## Original

```markdown chaff-before
# Privacy Policy

## What we collect

When you book a class, we keep your name, your email address and the classes you have booked. We do not keep card details: payments are handled by our payment provider.

## How long we keep it

We delete your details two years after your last booking, or sooner if you ask us to.

## Contact

Write to the studio manager at the address on our website.

Established: March 1, 2027

Last updated: September 15, 2026
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre legal/contract privacy-policy.md

privacy-policy.md   legal/contract · English   genre from --genre

─── line 15 ──────────────────────────────────────────────────

    March 1, 2027

  ✖  An established date after the last update

     The established date March 1, 2027 is after the update September 15, 2026
     The "Established: April 1, 2023" and "Last updated: September 1, 2026" lines of a policy or terms say when the document was first set and when it was last changed. An established date after an update means the document was changed before it existed, and the reader cannot tell which date is right or how old the current version is. It happens when the dates of the previous version are rewritten and one is missed. Lines holding only a date and an established or updated word are read, and when the established date is later than an update both lines are reported: nothing tells which of the two is wrong.

     → Check which is right, the established date or the update, and correct the other.

     Relax this rule:  npx chaffjs relax date-stamp-order


─── line 17 ──────────────────────────────────────────────────

    September 15, 2026

  ✖  An established date after the last update

     The update September 15, 2026 is before the established date March 1, 2027
     The "Established: April 1, 2023" and "Last updated: September 1, 2026" lines of a policy or terms say when the document was first set and when it was last changed. An established date after an update means the document was changed before it existed, and the reader cannot tell which date is right or how old the current version is. It happens when the dates of the previous version are rewritten and one is missed. Lines holding only a date and an established or updated word are read, and when the established date is later than an update both lines are reported: nothing tells which of the two is wrong.

     → Check which is right, the established date or the update, and correct the other.

     Relax this rule:  npx chaffjs relax date-stamp-order


────────────────────────────────────────────────────────────

  2 errors   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Privacy Policy

## What we collect

When you book a class, we keep your name, your email address and the classes you have booked. We do not keep card details: payments are handled by our payment provider.

## How long we keep it

We delete your details two years after your last booking, or sooner if you ask us to.

## Contact

Write to the studio manager at the address on our website.

Established: March 1, 2023

Last updated: September 15, 2026
```

## How it was fixed

The policy says it was established in March 2027 and last updated in September 2026: it was changed six months before it existed.
The year of the established date was retyped when the update was added, and the wrong line got the new year.
A customer, or a regulator asking how long the policy has been in force, cannot tell from the page which of the two dates to believe.

The fix restores the date the policy was first set, March 1, 2023.
chaff reports both lines, because nothing on the page says which of the two is wrong; check the records before choosing.

## Settings

An established date after the update is an error at the default level, since the two can never be in that order; `relaxed` makes it a warning:

```yaml chaff-settings
rules:
  date-stamp-order: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

Only lines that hold nothing but a date and an established or updated word are read.
Stamps seven lines or more apart are taken as two documents in one file and are not compared.
An effective date is not compared: a policy is often updated before the day it takes effect.
The rule does not run in literature or in speech transcripts.

```text chaff-explain
$ npx chaffjs explain date-stamp-order --genre legal/contract

  An established date after the last update   (date-stamp-order)

  The "Established: April 1, 2023" and "Last updated: September 1, 2026" lines of a policy or terms say when the document was first set and when it was last changed. An established date after an update means the document was changed before it existed, and the reader cannot tell which date is right or how old the current version is. It happens when the dates of the previous version are rewritten and one is missed. Lines holding only a date and an established or updated word are read, and when the established date is later than an update both lines are reported: nothing tells which of the two is wrong.

  How to fix: Check which is right, the established date or the update, and correct the other.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   error
    relaxed  warning
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax date-stamp-order --why "reason"
```

[All samples](README.md)
