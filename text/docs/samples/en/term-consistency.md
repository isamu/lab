<!-- chaff-sample
rule: term-consistency
genre: docs/manual
file: account-help.md
-->

# Words the team keeps to one, mixed (`term-consistency`)

**Where it helps:** help pages, onboarding guides, customer letters. Anywhere sections are written at different times, by different people or by an AI one section at a time, and two right words for one thing creep in.

## Original

```markdown chaff-before
# Your account

Log in with the email address you registered.
If you cannot log in, reset your password from the link on the page.
After the reset, sign in again with the new password.
```

```yaml chaff-config
consistent:
  - [log in, sign in]
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual account-help.md

account-help.md   docs/manual · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    After the reset, sign in again with the new password.

  ⚠  Words the team keeps to one, mixed

     "sign in" here, but the document uses "log in" in 2 other places
     Some words are each right but should not be mixed in one document: "log in" and "sign in", "customer" and "client". Mixed, they leave the reader wondering whether two things are meant, and a search misses one. It happens when an AI writes a document section by section, or several people add to it. Which one a document uses may differ, so chaff takes no side and points at the one the document uses less; when they are used equally, it only says they are mixed. The team lists the groups under consistent in chaff.yaml. With nothing listed, this rule does not run.

     → Use the word the document uses more; when they are used equally, pick one. Where two are meant differently, silence that place with stet and the reason.

     Relax this rule:  npx chaffjs relax term-consistency


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Your account

Log in with the email address you registered.
If you cannot log in, reset your password from the link on the page.
After the reset, log in again with the new password.
```

## How it was fixed

"Log in" and "sign in" are both right, and the team does not mind which a page uses, as long as it uses one.
The page wrote "log in" twice and "sign in" once, so a reader could wonder whether signing in is another step.

The fix keeps the word the page uses more. Another page may keep "sign in"; this rule only asks each document to keep to one.

## Settings

The rule reads only the groups under `consistent` in chaff.yaml. Each group lists words that are each right but are not to be mixed.
chaff ships no groups of its own. A team takes them from its style guide, or from the pairs its reviewers keep correcting:

```yaml chaff-settings
consistent:
  - [log in, sign in]
  - [customer, client]
  - [e-mail address, email address]
```

Case does not count, so "Log in" at the start of a sentence counts as "log in". A longer word such as "login" is not counted.
When the members are used equally often, it takes no side and reports once that they are mixed.
When files are checked together, `cross-doc-term-variant` also points at a file that uses another member than the rest.
A listed group is one the team has already decided to keep to one word, so one stray word is enough at `normal`; `relaxed` waits for three:

```yaml chaff-settings
rules:
  term-consistency: relaxed
```

Where the two words are meant differently, silence that place with stet and the reason.
It runs in every genre. With nothing under `consistent`, it does not run, and the list of rules that did not run says so.

```text chaff-explain
$ npx chaffjs explain term-consistency --genre docs/manual

  Words the team keeps to one, mixed   (term-consistency)

  Some words are each right but should not be mixed in one document: "log in" and "sign in", "customer" and "client". Mixed, they leave the reader wondering whether two things are meant, and a search misses one. It happens when an AI writes a document section by section, or several people add to it. Which one a document uses may differ, so chaff takes no side and points at the one the document uses less; when they are used equally, it only says they are mixed. The team lists the groups under consistent in chaff.yaml. With nothing listed, this rule does not run.

  How to fix: Use the word the document uses more; when they are used equally, pick one. Where two are meant differently, silence that place with stet and the reason.

  Levels:
    strict   reported once the less-used word appears 1 time
  → normal   reported once the less-used word appears 1 time
    relaxed  reported once the less-used word appears 3 times
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax term-consistency --why "reason"
```

[All samples](README.md)
