<!-- chaff-sample
rule: request-without-deadline
genre: business/email
file: brochure-email.md
-->

# Request with no deadline or owner (`request-without-deadline`)

**Where it helps:** emails to a group, project updates, handover notes. Anywhere a request goes to several people at once.

## Original

```markdown chaff-before
Subject: Spring brochure, second draft

Hi team,

The second draft of the spring brochure is in the shared folder.
The prices on pages four and five are new, and the photos on the cover are still placeholders.

Please review the draft and send your corrections.

Thanks,
Alex
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email brochure-email.md

brochure-email.md   business/email · English   genre from --genre

─── line 8 ───────────────────────────────────────────────────

    Please review the draft and send your corrections.

  ·  Request with no deadline or owner

     This request says neither who should do it nor by when
     A request ("Please review the draft.") with no deadline and no named person leaves every reader assuming someone else will do it, some day. The sender waits for an answer that has no date.

     → Add a deadline or an owner, ideally both ("Yamada, please review the draft by Tuesday, October 20.").

     Relax this rule:  npx chaffjs relax request-without-deadline


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Spring brochure, second draft

Hi team,

The second draft of the spring brochure is in the shared folder.
The prices on pages four and five are new, and the photos on the cover are still placeholders.

Please review the draft and send your corrections by Wednesday, 12 March.
Jo, could you check the new prices in particular?

Thanks,
Alex
```

## How it was fixed

"Please review the draft and send your corrections" goes to the whole team with no date and no name.
Everyone reads it as a request to someone else, or for some day next week, and Alex waits for replies that have no reason to come.

The fix gives the request a date, so everyone knows when the corrections are needed, and names one person for the part that matters most, the new prices.
A date or an owner is enough for chaff; both together make the request hard to miss.

## Settings

The rule reads requests for an action whose completion can be checked (review, reply, send).
It is a note at `normal` and `relaxed`, and a warning at `strict`:

```yaml chaff-settings
rules:
  request-without-deadline: strict
```

It runs on business documents only.
A deadline or a name in the same sentence or the next is enough.
Courtesy requests and open offers ("If you have questions, let me know", "Please send any questions to me") are not read.

```text chaff-explain
$ npx chaffjs explain request-without-deadline --genre business/email

  Request with no deadline or owner   (request-without-deadline)

  A request ("Please review the draft.") with no deadline and no named person leaves every reader assuming someone else will do it, some day. The sender waits for an answer that has no date.

  How to fix: Add a deadline or an owner, ideally both ("Yamada, please review the draft by Tuesday, October 20.").

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax request-without-deadline --why "reason"
```

[All samples](README.md)
